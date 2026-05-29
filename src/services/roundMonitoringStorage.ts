import type { CasaMonitoreo, RoundMonitoring } from '@/types/round-monitoring';
import { getRoundConfig, MAX_CASAS_POR_MODULO } from '@/lib/round-config';
import { ensureRoundCodigo, generarCodigoRonda } from '@/lib/round-codigo';
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

export function crearCasasVacias(total: number): CasaMonitoreo[] {
  return Array.from({ length: total }, (_, i) => ({
    numero: i + 1,
    estado: null,
    ninos: [],
    guardada: false,
    latitud: null,
    longitud: null,
    guardadaAt: null,
  }));
}

export function anadirCasaARonda(round: RoundMonitoring): RoundMonitoring | null {
  if (round.casas.length >= MAX_CASAS_POR_MODULO) return null;
  const nuevoNumero = round.casas.length + 1;
  const nuevaCasa: CasaMonitoreo = {
    numero: nuevoNumero,
    estado: null,
    ninos: [],
    guardada: false,
    latitud: null,
    longitud: null,
    guardadaAt: null,
  };
  return {
    ...round,
    totalCasas: nuevoNumero,
    casas: [...round.casas, nuevaCasa],
    casaActiva: nuevoNumero,
    fase: 'croquis',
    completedAt: null,
    ultimaCasaResumen: round.ultimaCasaResumen,
  };
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
  const total = params.totalCasas ?? getRoundConfig().casasPorModulo;
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    codigo: generarCodigoRonda(),
    userId: params.userId,
    moduloLabel: params.moduloLabel.trim() || 'Módulo',
    totalCasas: total,
    casas: crearCasasVacias(total),
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
  };
}

export const roundMonitoringStorage = {
  async save(round: RoundMonitoring): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(ROUNDS_STORE, 'readwrite');
    round.updatedAt = Date.now();
    tx.objectStore(ROUNDS_STORE).put(round);
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
        const normalized = ensureRoundCodigo({ ...r, userId: r.userId || userId });
        const local = await this.get(normalized.id);
        if (!local || normalized.updatedAt >= local.updatedAt) {
          await this.save(normalized);
        }
      }
    } catch (e) {
      console.warn('syncDraftsFromServer:', e);
    }
  },

  /** Rondas activas visibles para el usuario (propias + equipo), máx. 2 en servidor. */
  async listActiveDraftsForUser(userId: string): Promise<RoundMonitoring[]> {
    await this.syncDraftsFromServer(userId);
    const merged = new Map<string, RoundMonitoring>();
    for (const r of await fetchRoundDraftsFromServer()) {
      merged.set(r.id, ensureRoundCodigo(r));
    }
    for (const r of await this.listByUser(userId, 40)) {
      const prev = merged.get(r.id);
      if (!prev || r.updatedAt > prev.updatedAt) merged.set(r.id, ensureRoundCodigo(r));
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
    const rows = await this.listByUser(userId, 30);
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
