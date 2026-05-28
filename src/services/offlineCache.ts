import { dataService } from '@/services/dataService';
import { PendingRegistroPayloadSchema, validarOLanzar } from '@/lib/validation-schemas';
import type { RegistroMRV } from '@/services/dataService';

const DB_NAME = 'mrv_offline';
const DB_VERSION = 1;
const PENDING_STORE = 'pending_registros';

export interface PendingRegistro {
  id: string;
  timestamp: number;
  data: Record<string, unknown>;
  syncAttempts?: number;
  lastError?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** Solo pruebas: libera la conexión IDB cacheada entre casos */
export function resetOfflineDbCacheForTests() {
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
        if (!db.objectStoreNames.contains(PENDING_STORE)) {
          db.createObjectStore(PENDING_STORE, { keyPath: 'id' });
        }
      };
    });
  }
  return dbPromise;
}

function toRegistroMRV(raw: Record<string, unknown>): Omit<RegistroMRV, 'id' | 'fecha_hora'> {
  const v = validarOLanzar(PendingRegistroPayloadSchema, raw);
  return {
    user_id: v.user_id,
    region: v.region,
    distrito: v.distrito,
    servicio: v.servicio ?? null,
    barrio: v.barrio,
    responsable: v.responsable ?? null,
    nombre: v.nombre,
    documento: v.documento,
    fecha_nacimiento: v.fecha_nacimiento,
    edad: v.edad != null ? String(v.edad) : null,
    sexo: v.sexo,
    libreta: v.libreta ?? false,
    estado_vacuna: v.estado_vacuna,
    motivo: v.motivo ?? null,
    latitud: v.latitud,
    longitud: v.longitud,
    tipo_vivienda: v.tipo_vivienda ?? null,
    esquema_completo: v.esquema_completo ?? null,
    fuente_verificacion: (v as { fuente_verificacion?: string }).fuente_verificacion ?? null,
    accion_tomada: (v as { accion_tomada?: string }).accion_tomada ?? null,
    observaciones: (v as { observaciones?: string }).observaciones ?? null,
    fecha_dosis_spr: (v as { fecha_dosis_spr?: string }).fecha_dosis_spr ?? null,
    dosis_spr: (v as { dosis_spr?: string }).dosis_spr ?? null,
    estado_intervencion: (v as { estado_intervencion?: string }).estado_intervencion ?? null,
    tiene_cvs: (v as { tiene_cvs?: boolean }).tiene_cvs ?? null,
  };
}

export const offlineCache = {
  async savePending(data: Record<string, unknown>) {
    const validated = validarOLanzar(PendingRegistroPayloadSchema, data);
    const db = await openDB();
    const transaction = db.transaction([PENDING_STORE], 'readwrite');
    const store = transaction.objectStore(PENDING_STORE);
    const pending: PendingRegistro = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      data: validated as unknown as Record<string, unknown>,
      syncAttempts: 0,
    };
    await new Promise<void>((resolve, reject) => {
      const request = store.add(pending);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getPending(): Promise<PendingRegistro[]> {
    const db = await openDB();
    const transaction = db.transaction([PENDING_STORE], 'readonly');
    const store = transaction.objectStore(PENDING_STORE);
    return new Promise<PendingRegistro[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async getPendingCount(): Promise<number> {
    const all = await this.getPending();
    return all.length;
  },

  async removePending(id: string) {
    const db = await openDB();
    const transaction = db.transaction([PENDING_STORE], 'readwrite');
    const store = transaction.objectStore(PENDING_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async syncAll(): Promise<{ synced: number; failed: number }> {
    const pending = await this.getPending();
    if (!pending.length) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;
    const maxRetries = 5;
    const batchSize = 5;

    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);
      const promises = batch.map(async (item) => {
        try {
          const registro = toRegistroMRV(item.data);
          const { ok } = await dataService.guardarRegistro(registro);
          if (!ok) throw new Error('insert_rejected');

          await this.removePending(item.id);
          synced++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);

          const attempts = (item.syncAttempts || 0) + 1;
          if (attempts < maxRetries) {
            const db = await openDB();
            const transaction = db.transaction([PENDING_STORE], 'readwrite');
            const store = transaction.objectStore(PENDING_STORE);
            await new Promise<void>((resolve, reject) => {
              const request = store.put({
                ...item,
                syncAttempts: attempts,
                lastError: errorMsg,
              });
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            });
          } else {
            await this.removePending(item.id);
          }
          failed++;
        }
      });
      await Promise.allSettled(promises);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    return { synced, failed };
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    const count = await offlineCache.getPendingCount();
    if (count > 0) {
      offlineCache.syncAll().then(({ synced }) => {
        if (synced > 0) {
          console.log(`Synced ${synced} pending records`);
        }
      });
    }
  });
}
