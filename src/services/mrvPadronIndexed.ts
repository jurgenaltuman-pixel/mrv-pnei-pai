/**
 * Padrón nominal local (IndexedDB) para búsqueda offline completa.
 * Se llena con «Descargar metadatos» / sincronización paginada desde base_personas.
 */
import { supabase } from '@/integrations/supabase/client';

const DB_NAME = 'mrv_padron';
const DB_VERSION = 1;
const STORE = 'personas';
const META_STORE = 'meta';

export interface PadronMeta {
  key: 'padron';
  version: number;
  rowCount: number;
  updatedAt: number;
  /** true cuando la última descarga terminó sin error de red */
  complete: boolean;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function resetPadronDbForTests() {
  dbPromise = null;
}

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE)) {
          const st = db.createObjectStore(STORE, { keyPath: 'id' });
          st.createIndex('by_documento', 'documento', { unique: false });
          st.createIndex('by_tipo', 'tipo_documento', { unique: false });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      };
    });
  }
  return dbPromise;
}

const textEncoder = new TextEncoder();

/** Progreso de la descarga del padrón (filas, total estimado, peso aprox. de JSON). */
export interface PadronDownloadProgress {
  imported: number;
  /** Total de filas en `base_personas` (conteo exacto vía Supabase); null si falló el conteo. */
  total: number | null;
  page: number;
  /** Bytes UTF-8 aproximados acumulados del JSON recibido (por lote). */
  bytesApprox: number;
  /** 0–100 según filas importadas / total; null si no hay total. */
  percent: number | null;
}

export interface PadronRow {
  id: string;
  nombre: string;
  tipo_documento: string;
  documento: string;
  fecha_nacimiento: string | null;
  sexo: string | null;
  region_sanitaria: string | null;
  distrito: string | null;
  servicio_salud: string | null;
  documento_madre: string | null;
  nombre_madre: string | null;
}

function stableId(row: { id?: string | null; documento?: string | null; tipo_documento?: string | null }): string {
  if (row.id && String(row.id).length > 0) return String(row.id);
  return `${String(row.tipo_documento || 'CI').toUpperCase()}|${String(row.documento || '').trim()}`;
}

export const mrvPadronIndexed = {
  async getMeta(): Promise<PadronMeta | null> {
    const db = await openDB();
    const tx = db.transaction([META_STORE], 'readonly');
    const store = tx.objectStore(META_STORE);
    return new Promise((resolve, reject) => {
      const r = store.get('padron');
      r.onsuccess = () => resolve((r.result as PadronMeta) ?? null);
      r.onerror = () => reject(r.error);
    });
  },

  async isReady(): Promise<boolean> {
    const m = await this.getMeta();
    return Boolean(m?.complete && m.rowCount > 0);
  },

  async clearAll(): Promise<void> {
    const db = await openDB();
    const tx = db.transaction([STORE, META_STORE], 'readwrite');
    await new Promise<void>((resolve, reject) => {
      const r = tx.objectStore(STORE).clear();
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const r = tx.objectStore(META_STORE).clear();
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  },

  async putBatch(rows: PadronRow[]): Promise<void> {
    if (!rows.length) return;
    const db = await openDB();
    const tx = db.transaction([STORE], 'readwrite');
    const store = tx.objectStore(STORE);
    for (const row of rows) {
      store.put(row);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },

  async setMeta(partial: Partial<Omit<PadronMeta, 'key'>> & Pick<PadronMeta, 'rowCount' | 'complete'>): Promise<void> {
    const db = await openDB();
    const tx = db.transaction([META_STORE], 'readwrite');
    const store = tx.objectStore(META_STORE);
    const row: PadronMeta = {
      key: 'padron',
      version: 1,
      rowCount: partial.rowCount,
      updatedAt: Date.now(),
      complete: partial.complete,
    };
    await new Promise<void>((resolve, reject) => {
      const r = store.put(row);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  },

  async downloadFromServer(onProgress?: (p: PadronDownloadProgress) => void): Promise<{ imported: number; error?: string }> {
    await this.clearAll();
    let imported = 0;
    let page = 0;
    let bytesApprox = 0;
    const pageSize = 800;

    let totalRows: number | null = null;
    try {
      const { count, error: countErr } = await supabase
        .from('base_personas')
        .select('id', { count: 'exact', head: true });
      if (!countErr && typeof count === 'number' && count >= 0) totalRows = count;
    } catch {
      /* sin total: la UI muestra solo filas/MB */
    }

    const emit = () => {
      const percent =
        totalRows != null && totalRows > 0
          ? Math.min(100, Math.round((imported / totalRows) * 100))
          : null;
      onProgress?.({
        imported,
        total: totalRows,
        page: page + 1,
        bytesApprox,
        percent,
      });
    };

    emit();

    if (totalRows === 0) {
      await this.setMeta({ rowCount: 0, complete: true });
      return { imported: 0 };
    }

    try {
      while (true) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from('base_personas')
          .select('id, nombre, tipo_documento, documento, fecha_nacimiento, sexo, region_sanitaria, distrito, servicio_salud, documento_madre, nombre_madre')
          .order('id', { ascending: true })
          .range(from, to);
        if (error) {
          await this.setMeta({ rowCount: imported, complete: false });
          return { imported, error: error.message };
        }
        if (!data?.length) break;
        bytesApprox += textEncoder.encode(JSON.stringify(data)).length;
        const batch: PadronRow[] = (data as Record<string, unknown>[]).map((raw) => ({
          id: stableId(raw as { id?: string; documento?: string; tipo_documento?: string }),
          nombre: String(raw.nombre ?? ''),
          tipo_documento: String(raw.tipo_documento ?? 'CI').toUpperCase(),
          documento: String(raw.documento ?? '').trim(),
          fecha_nacimiento: (raw.fecha_nacimiento as string | null) ?? null,
          sexo: (raw.sexo as string | null) ?? null,
          region_sanitaria: (raw.region_sanitaria as string | null) ?? null,
          distrito: (raw.distrito as string | null) ?? null,
          servicio_salud: (raw.servicio_salud as string | null) ?? null,
          documento_madre: raw.documento_madre != null ? String(raw.documento_madre) : null,
          nombre_madre: (raw.nombre_madre as string | null) ?? null,
        }));
        await this.putBatch(batch);
        imported += batch.length;
        emit();
        if (batch.length < pageSize) break;
        page += 1;
        if (page > 5000) break;
      }
      await this.setMeta({ rowCount: imported, complete: true });
      return { imported };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.setMeta({ rowCount: imported, complete: false });
      return { imported, error: msg };
    }
  },

  /** Búsqueda por documento (exacto o prefijo) + tipo. */
  async searchByDocument(docNorm: string, tipo: string, limit: number): Promise<PadronRow[]> {
    const db = await openDB();
    const tx = db.transaction([STORE], 'readonly');
    const store = tx.objectStore(STORE);
    const idx = store.index('by_documento');
    const upperTipo = (tipo || 'CI').toUpperCase();
    const out: PadronRow[] = [];
    const seen = new Set<string>();

    await new Promise<void>((resolve, reject) => {
      const req = idx.openCursor(IDBKeyRange.bound(docNorm, `${docNorm}\uffff`, false, true));
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve();
          return;
        }
        const row = cursor.value as PadronRow;
        if (String(row.tipo_documento || 'CI').toUpperCase() === upperTipo || upperTipo === '') {
          const k = row.documento;
          if (k && !seen.has(k)) {
            seen.add(k);
            out.push({ ...row });
          }
        }
        if (out.length >= limit) {
          resolve();
          return;
        }
        cursor.continue();
      };
    });

    if (out.length < limit && docNorm.length >= 4) {
      await new Promise<void>((resolve, reject) => {
        const req = store.openCursor();
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) {
            resolve();
            return;
          }
          const row = cursor.value as PadronRow;
          const d = String(row.documento || '');
          const t = String(row.tipo_documento || 'CI').toUpperCase();
          if (t === upperTipo && d.includes(docNorm) && !seen.has(d)) {
            seen.add(d);
            out.push({ ...row });
          }
          if (out.length >= limit) {
            resolve();
            return;
          }
          cursor.continue();
        };
      });
    }

    return out.slice(0, limit);
  },

  /** Filtros equivalentes a buscarPersonasDatosPersonales (servidor + nombre en cliente). */
  async searchDatosPersonales(
    filtros: {
      nombre1?: string;
      nombre2?: string;
      apellido1?: string;
      apellido2?: string;
      documentoMadrePadre?: string;
      fechaNacimiento?: string;
      sexo?: string;
    },
    nombreCoincide: (nombre: string, partes: string[]) => boolean,
    normalize: (s: string | null | undefined) => string,
    limit: number
  ): Promise<PadronRow[]> {
    const madre = filtros.documentoMadrePadre?.replace(/\D/g, '').trim();
    const fecha = filtros.fechaNacimiento?.trim();
    const sexo = filtros.sexo?.trim().toUpperCase();
    const parts = [filtros.nombre1, filtros.nombre2, filtros.apellido1, filtros.apellido2]
      .map((s) => normalize(s))
      .filter((s) => s.length >= 1);
    const hasServerFilter = (madre && madre.length >= 4) || Boolean(fecha) || sexo === 'M' || sexo === 'F';

    const db = await openDB();
    const tx = db.transaction([STORE], 'readonly');
    const store = tx.objectStore(STORE);
    const candidates: PadronRow[] = [];

    await new Promise<void>((resolve, reject) => {
      const req = store.openCursor();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve();
          return;
        }
        const row = cursor.value as PadronRow;
        let ok = true;
        if (madre && madre.length >= 4) {
          const dm = String(row.documento_madre || '').replace(/\D/g, '');
          ok = ok && dm === madre;
        }
        if (fecha) {
          ok = ok && String(row.fecha_nacimiento || '') === fecha;
        }
        if (sexo === 'M' || sexo === 'F') {
          ok = ok && String(row.sexo || '').toUpperCase() === sexo;
        }
        if (ok) candidates.push(row);
        cursor.continue();
      };
    });

    let rows = candidates;
    if (parts.length > 0) {
      rows = rows.filter((row) => nombreCoincide(row.nombre, parts));
    } else if (!hasServerFilter) {
      return [];
    }

    const seen = new Set<string>();
    const out: PadronRow[] = [];
    for (const row of rows) {
      const k = row.documento || '';
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push({ ...row });
      if (out.length >= limit) break;
    }
    return out;
  },

  /** Equivalente simplificado a getBasePersonas para texto / dígitos (solo local). */
  async searchGeneral(
    normalized: string,
    opts: {
      maxResults: number;
      isNumeric: boolean;
      needleTokens: string[];
      normalize: (s: string | null | undefined) => string;
    }
  ): Promise<PadronRow[]> {
    const { maxResults, isNumeric, needleTokens, normalize } = opts;
    const db = await openDB();
    const tx = db.transaction([STORE], 'readonly');
    const store = tx.objectStore(STORE);
    const results: PadronRow[] = [];

    await new Promise<void>((resolve, reject) => {
      const req = store.openCursor();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve();
          return;
        }
        const row = cursor.value as PadronRow;
        const doc = String(row.documento || '');
        const nom = normalize(row.nombre);
        let match = false;
        if (isNumeric) {
          match = doc === normalized || doc.startsWith(normalized) || doc.includes(normalized);
        } else {
          if (needleTokens.length > 0) {
            match = needleTokens.every((nt) => nt.length > 0 && nom.includes(nt));
          } else {
            match = nom.includes(normalize(normalized));
          }
        }
        if (match) results.push(row);
        if (results.length > 12000) {
          resolve();
          return;
        }
        cursor.continue();
      };
    });

    const seen = new Set<string>();
    const deduped = results.filter((r) => {
      const k = r.documento || '';
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const queryNormal = normalize(normalized);
    deduped.sort((a, b) => {
      const aIsExact = a.documento === normalized;
      const bIsExact = b.documento === normalized;
      if (aIsExact !== bIsExact) return aIsExact ? -1 : 1;
      const aNormal = normalize(a.nombre);
      const bNormal = normalize(b.nombre);
      if (!isNumeric && needleTokens.length > 0) {
        const score = (hay: string) =>
          needleTokens.reduce((acc, nt) => acc + (hay.includes(nt) ? nt.length : 0), 0);
        const diff = score(bNormal) - score(aNormal);
        if (diff !== 0) return diff;
      }
      const aStarts = aNormal.startsWith(queryNormal) ? 0 : 1;
      const bStarts = bNormal.startsWith(queryNormal) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return aNormal.localeCompare(bNormal);
    });

    return deduped.slice(0, maxResults);
  },
};
