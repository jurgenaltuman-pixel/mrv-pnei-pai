import type { CasaMonitoreo, RoundMonitoring } from '@/types/round-monitoring';
import { crearCasasVacias, anadirCasaARonda } from '@/lib/round-casas';
import {
  aplicarMetaFija,
  CASAS_VISITAS_INICIAL,
  metaCasasEfectivas,
} from '@/lib/round-meta';

export { crearCasasVacias, anadirCasaARonda };
import { ensureRoundCodigo, generarCodigoRonda } from '@/lib/round-codigo';
import { mergeRoundMonitoring } from '@/lib/round-merge';
import { isRoundDismissed, isRoundResumable } from '@/lib/round-resume';
import { isRoundDraftActive, MAX_ACTIVE_ROUNDS_PER_USER } from '@/lib/round-active-limit';
import { fetchRoundDraftsFromServer } from '@/services/roundDraftApi';

const DB_NAME = 'mrv_rounds';
const DB_VERSION = 1;
const ROUNDS_STORE = 'rounds';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(ROUNDS_STORE)) {
          const store = db.createObjectStore(ROUNDS_STORE, { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });
  }
  return dbPromise;
}

export function crearRondaVacia(params: {
  userId: string;
  moduloLabel: string;
  totalCasas?: number;
  region: string;
  distrito: string;
  servicio: string | null;
  barrio: string;
  responsable: string | null;
  entrevistador?: string | null;
  colaboradores?: string[];
  colaboradorUserIds?: string[];
}): RoundMonitoring {
  const visitasInicial = params.totalCasas ?? CASAS_VISITAS_INICIAL;
  const now = Date.now();
  return aplicarMetaFija({
    id: crypto.randomUUID(),
    codigo: generarCodigoRonda(),
    userId: params.userId,
    moduloLabel: params.moduloLabel.trim() || 'Módulo',
    totalCasas: metaCasasEfectivas(),
    casas: crearCasasVacias(Math.max(visitasInicial, CASAS_VISITAS_INICIAL)),
    casaActiva: 1,
    fase: 'start',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    region: params.region,
    distrito: params.distrito,
    servicio: params.servicio,
    barrio: params.barrio,
    responsable: params.responsable,
    entrevistador: params.entrevistador?.trim() || params.responsable?.trim() || null,
    colaboradores: (params.colaboradores || []).map((s) => s.trim()).filter(Boolean),
    colaboradorUserIds: (params.colaboradorUserIds || []).map((s) => String(s).trim()).filter(Boolean),
    ultimaCasaResumen: null,
  });
}

export const roundMonitoringStorage = {
  async save(round: RoundMonitoring): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(ROUNDS_STORE, 'readwrite');
    const toStore = aplicarMetaFija({ ...round, updatedAt: Date.now() });
    tx.objectStore(ROUNDS_STORE).put(toStore);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },

  async get(id: string): Promise<RoundMonitoring | null> {
    const db = await openDB();
    const tx = db.transaction(ROUNDS_STORE, 'readonly');
    const req = tx.objectStore(ROUNDS_STORE).get(id);
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as RoundMonitoring) || null);
      req.onerror = () => reject(req.error);
    });
  },

  async listByUser(userId: string, limit = 50): Promise<RoundMonitoring[]> {
    const all = await this.listAll(limit * 2);
    return all.filter((r) => r.userId === userId).slice(0, limit);
  },

  /** Última ronda del usuario que puede retomarse (p. ej. al cambiar de pestaña o recargar). */
  async getActiveForUser(userId: string): Promise<RoundMonitoring | null> {
    const rows = await this.listResumableForUser(userId, { includeDismissed: false });
    return rows[0] ?? null;
  },

  /** Sincroniza borradores activos desde el servidor (otras sesiones / dispositivos). */
  async syncDraftsFromServer(userId: string): Promise<void> {
    try {
      const remote = await fetchRoundDraftsFromServer();
      for (const r of remote) {
        const normalized = aplicarMetaFija(
          ensureRoundCodigo({ ...r, userId: r.userId || userId })
        );
        const local = await this.get(normalized.id);
        if (!local) {
          await this.save(normalized);
        } else {
          await this.save(mergeRoundMonitoring(aplicarMetaFija(local), normalized));
        }
      }
    } catch (e) {
      console.warn('syncDraftsFromServer:', e);
    }
  },

  /** Rondas activas visibles para el usuario (titular o colaborador en equipo). */
  async listActiveDraftsForUser(userId: string): Promise<RoundMonitoring[]> {
    await this.syncDraftsFromServer(userId);
    const merged = new Map<string, RoundMonitoring>();
    const isParticipant = (r: RoundMonitoring) =>
      String(r.userId) === String(userId) ||
      (r.colaboradorUserIds || []).some((id) => String(id) === String(userId));

    for (const r of await fetchRoundDraftsFromServer()) {
      if (!isParticipant(r)) continue;
      const remote = aplicarMetaFija(ensureRoundCodigo(r));
      const prev = merged.get(r.id);
      merged.set(r.id, prev ? mergeRoundMonitoring(prev, remote) : remote);
    }
    for (const r of await this.listAll(80)) {
      if (!isParticipant(r)) continue;
      const local = aplicarMetaFija(ensureRoundCodigo(r));
      const prev = merged.get(r.id);
      merged.set(r.id, prev ? mergeRoundMonitoring(prev, local) : local);
    }
    return [...merged.values()]
      .filter((r) => isRoundDraftActive(r) && !isRoundDismissed(userId, r.id))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_ACTIVE_ROUNDS_PER_USER);
  },

  /** Todas las rondas retomables del usuario, más reciente primero. */
  async listResumableForUser(
    userId: string,
    opts?: { includeDismissed?: boolean }
  ): Promise<RoundMonitoring[]> {
    await this.syncDraftsFromServer(userId);
    const rows = (await this.listAll(50)).filter(
      (r) =>
        String(r.userId) === String(userId) ||
        (r.colaboradorUserIds || []).some((id) => String(id) === String(userId))
    );
    return rows.filter(
      (r) => isRoundResumable(r) && (opts?.includeDismissed || !isRoundDismissed(userId, r.id))
    );
  },

  async listAll(limit = 100): Promise<RoundMonitoring[]> {
    const db = await openDB();
    const tx = db.transaction(ROUNDS_STORE, 'readonly');
    const allReq = tx.objectStore(ROUNDS_STORE).getAll();
    return new Promise((resolve, reject) => {
      allReq.onsuccess = () => {
        const rows = (allReq.result as RoundMonitoring[])
          .map((r) => ensureRoundCodigo(r))
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, limit);
        resolve(rows);
      };
      allReq.onerror = () => reject(allReq.error);
    });
  },

  async remove(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(ROUNDS_STORE, 'readwrite');
    tx.objectStore(ROUNDS_STORE).delete(id);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
};
