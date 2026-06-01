import { uploadPersonSearchImages } from '@/services/personSearchAttachmentsApi';
import {
  PENDING_DRIVE_URL_PREFIX,
  pendingDriveId,
} from '@/lib/pending-drive-url';

const DB_NAME = 'mrv_offline';
const DB_VERSION = 2;
const PENDING_DRIVE_STORE = 'pending_drive_adjuntos';

export interface PendingDriveAdjunto {
  id: string;
  clipKey: string;
  documento: string;
  tipoDocumento: string;
  nombre: string;
  image: { filename: string; mimeType: string; dataBase64: string };
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function resetDriveQueueDbForTests() {
  dbPromise = null;
}

function openDriveDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('pending_registros')) {
          db.createObjectStore('pending_registros', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(PENDING_DRIVE_STORE)) {
          db.createObjectStore(PENDING_DRIVE_STORE, { keyPath: 'id' });
        }
      };
    });
  }
  return dbPromise;
}

async function getQueued(id: string): Promise<PendingDriveAdjunto | null> {
  const db = await openDriveDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PENDING_DRIVE_STORE], 'readonly');
    const req = tx.objectStore(PENDING_DRIVE_STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function removeQueued(id: string) {
  const db = await openDriveDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PENDING_DRIVE_STORE], 'readwrite');
    const req = tx.objectStore(PENDING_DRIVE_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function queueDriveImage(opts: {
  clipKey: string;
  documento: string;
  tipoDocumento: string;
  nombre: string;
  image: { filename: string; mimeType: string; dataBase64: string };
}): Promise<string> {
  const id = crypto.randomUUID();
  const item: PendingDriveAdjunto = {
    id,
    clipKey: opts.clipKey,
    documento: opts.documento,
    tipoDocumento: opts.tipoDocumento,
    nombre: opts.nombre,
    image: opts.image,
    timestamp: Date.now(),
  };
  const db = await openDriveDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PENDING_DRIVE_STORE], 'readwrite');
    const req = tx.objectStore(PENDING_DRIVE_STORE).add(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  return id;
}

export async function uploadQueuedDriveItem(id: string): Promise<string> {
  const item = await getQueued(id);
  if (!item) throw new Error('Adjunto offline no encontrado');
  const { urls, error } = await uploadPersonSearchImages({
    documento: item.documento,
    tipoDocumento: item.tipoDocumento,
    nombre: item.nombre,
    images: [item.image],
  });
  if (error || !urls[0]) throw new Error(error || 'No se pudo subir a Drive');
  await removeQueued(id);
  return urls[0];
}

/** Sustituye pending://drive/* por URLs reales antes de guardar/sync. */
export async function resolveDriveLinksInPayload(
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const next = { ...data };
  for (const field of ['enlace_imagen_1', 'enlace_imagen_2'] as const) {
    const raw = next[field];
    if (typeof raw !== 'string' || !raw.startsWith(PENDING_DRIVE_URL_PREFIX)) continue;
    const id = pendingDriveId(raw);
    if (!id) continue;
    next[field] = await uploadQueuedDriveItem(id);
  }
  return next;
}

/** Sube cola pendiente de un clip (al reconectar). */
export async function flushPendingDriveForClip(
  clipKey: string,
  adjuntos: { enlace_imagen_1?: string; enlace_imagen_2?: string }
): Promise<{ enlace_imagen_1?: string; enlace_imagen_2?: string }> {
  const next = { ...adjuntos };
  for (const field of ['enlace_imagen_1', 'enlace_imagen_2'] as const) {
    const raw = next[field];
    if (typeof raw !== 'string' || !raw.startsWith(PENDING_DRIVE_URL_PREFIX)) continue;
    const id = pendingDriveId(raw);
    if (!id) continue;
    const item = await getQueued(id);
    if (item && item.clipKey !== clipKey) continue;
    next[field] = await uploadQueuedDriveItem(id);
  }
  return next;
}

export async function getPendingDriveCount(): Promise<number> {
  const all = await getAllPendingDrive();
  return all.length;
}

export async function getAllPendingDrive(): Promise<PendingDriveAdjunto[]> {
  const db = await openDriveDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PENDING_DRIVE_STORE], 'readonly');
    const req = tx.objectStore(PENDING_DRIVE_STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** Sube todas las fotos en cola (aunque aún no tengan registro en servidor). */
export async function syncAllPendingDriveImages(): Promise<{
  uploaded: number;
  failed: number;
  remaining: number;
  lastError?: string;
}> {
  const items = await getAllPendingDrive();
  let uploaded = 0;
  let failed = 0;
  let lastError: string | undefined;
  for (const item of items) {
    try {
      await uploadQueuedDriveItem(item.id);
      uploaded += 1;
    } catch (e) {
      failed += 1;
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  const remaining = await getPendingDriveCount();
  return { uploaded, failed, remaining, lastError };
}
