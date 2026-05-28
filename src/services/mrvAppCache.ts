/**
 * Caché local (IndexedDB) para uso sin red: estructura territorial, última
 * búsqueda de personas y último snapshot de registros (dashboard).
 * No sustituye a Supabase para login inicial ni escrituras (ver offlineCache cola).
 */

const DB_NAME = 'mrv_app_cache';
const DB_VERSION = 1;
const STORE = 'kv';

export interface OrgStructureSnapshot {
  regiones: unknown[];
  distritos: unknown[];
  servicios: unknown[];
  barrios: unknown[];
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function resetMrvAppCacheDbForTests() {
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
          db.createObjectStore(STORE, { keyPath: 'key' });
        }
      };
    });
  }
  return dbPromise;
}

interface KVRow {
  key: string;
  value: string;
  updatedAt: number;
}

async function putJson(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([STORE], 'readwrite');
  const store = tx.objectStore(STORE);
  const row: KVRow = {
    key,
    value: JSON.stringify(value),
    updatedAt: Date.now(),
  };
  await new Promise<void>((resolve, reject) => {
    const r = store.put(row);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

async function getJson<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE], 'readonly');
    const store = tx.objectStore(STORE);
    const row = await new Promise<KVRow | undefined>((resolve, reject) => {
      const r = store.get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    if (!row?.value) return null;
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

const ORG_KEY = 'org_structure_v2';
const REG_KEY = 'registros_snapshot_v1';
const personaPrefix = 'persona_search:';

export const mrvAppCache = {
  async saveOrgSnapshot(snapshot: Omit<OrgStructureSnapshot, 'savedAt'>): Promise<void> {
    const payload: OrgStructureSnapshot = {
      ...snapshot,
      savedAt: Date.now(),
    };
    await putJson(ORG_KEY, payload);
  },

  async getOrgSnapshot(): Promise<OrgStructureSnapshot | null> {
    return getJson<OrgStructureSnapshot>(ORG_KEY);
  },

  async savePersonaSearch(key: string, rows: unknown[]): Promise<void> {
    const safeKey = `${personaPrefix}${key.slice(0, 200)}`;
    await putJson(safeKey, rows);
  },

  async getPersonaSearch(key: string): Promise<unknown[] | null> {
    const safeKey = `${personaPrefix}${key.slice(0, 200)}`;
    const data = await getJson<unknown[]>(safeKey);
    return Array.isArray(data) ? data : null;
  },

  async saveRegistrosSnapshot(rows: unknown[]): Promise<void> {
    await putJson(REG_KEY, rows);
  },

  async prependRegistro(row: unknown): Promise<void> {
    const existing = (await this.getRegistrosSnapshot()) || [];
    const id = (row as { id?: string })?.id;
    const withoutDup = id ? existing.filter((r) => (r as { id?: string })?.id !== id) : existing;
    await putJson(REG_KEY, [row, ...withoutDup].slice(0, 5000));
  },

  async getRegistrosSnapshot(): Promise<unknown[] | null> {
    const data = await getJson<unknown[]>(REG_KEY);
    return Array.isArray(data) ? data : null;
  },
};
