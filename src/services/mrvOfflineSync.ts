import { offlineCache, type PendingRegistro } from '@/services/offlineCache';
import {
  getAllPendingDrive,
  getPendingDriveCount,
  syncAllPendingDriveImages,
} from '@/services/driveAdjuntosOfflineQueue';

export interface OfflineSyncStatus {
  pendingRegistros: number;
  pendingDriveImages: number;
  totalPending: number;
  registros: Array<{
    id: string;
    nombre: string;
    documento: string;
    lastError?: string;
    timestamp: number;
  }>;
  allSynced: boolean;
}

export interface OfflineSyncResult {
  ok: boolean;
  message: string;
  registrosSynced: number;
  registrosFailed: number;
  registrosRemaining: number;
  driveUploaded: number;
  driveFailed: number;
  driveRemaining: number;
  allSynced: boolean;
}

function mapRegistro(item: PendingRegistro) {
  const data = item.data;
  return {
    id: item.id,
    nombre: String(data.nombre || 'Sin nombre'),
    documento: String(data.documento || '—'),
    lastError: item.lastError,
    timestamp: item.timestamp,
  };
}

export async function getOfflineSyncStatus(): Promise<OfflineSyncStatus> {
  const [registros, driveItems] = await Promise.all([offlineCache.getPending(), getAllPendingDrive()]);
  const pendingRegistros = registros.length;
  const pendingDriveImages = driveItems.length;
  return {
    pendingRegistros,
    pendingDriveImages,
    totalPending: pendingRegistros + pendingDriveImages,
    registros: registros.map(mapRegistro),
    allSynced: pendingRegistros === 0 && pendingDriveImages === 0,
  };
}

/** Sincroniza registros en cola + fotos Drive pendientes. Requiere conexión. */
export async function syncAllOfflineData(isOnline: boolean): Promise<OfflineSyncResult> {
  if (!isOnline) {
    const status = await getOfflineSyncStatus();
    return {
      ok: false,
      message: 'Sin conexión. Conectate a internet para subir los datos pendientes.',
      registrosSynced: 0,
      registrosFailed: 0,
      registrosRemaining: status.pendingRegistros,
      driveUploaded: 0,
      driveFailed: 0,
      driveRemaining: status.pendingDriveImages,
      allSynced: false,
    };
  }

  const before = await getOfflineSyncStatus();
  if (before.allSynced) {
    return {
      ok: true,
      message: 'Todo sincronizado. No hay datos pendientes en el dispositivo.',
      registrosSynced: 0,
      registrosFailed: 0,
      registrosRemaining: 0,
      driveUploaded: 0,
      driveFailed: 0,
      driveRemaining: 0,
      allSynced: true,
    };
  }

  const driveResult = await syncAllPendingDriveImages();
  const regResult = await offlineCache.syncAll();
  const after = await getOfflineSyncStatus();

  const parts: string[] = [];
  if (regResult.synced > 0) parts.push(`${regResult.synced} registro(s) subido(s)`);
  if (driveResult.uploaded > 0) parts.push(`${driveResult.uploaded} foto(s) a Drive`);
  if (regResult.failed > 0) parts.push(`${regResult.failed} registro(s) con error`);
  if (driveResult.failed > 0) parts.push(`${driveResult.failed} foto(s) fallaron`);

  const remaining = after.totalPending;
  let message: string;
  if (after.allSynced) {
    message = parts.length
      ? `Sincronización completa: ${parts.join(' · ')}.`
      : 'Todo sincronizado correctamente.';
  } else if (parts.length) {
    message = `${parts.join(' · ')}. Quedan ${remaining} pendiente(s) — reintentá en unos segundos.`;
  } else {
    message = `No se pudo subir todo. Quedan ${remaining} pendiente(s). Verificá la conexión e intentá de nuevo.`;
  }

  return {
    ok: after.allSynced,
    message,
    registrosSynced: regResult.synced,
    registrosFailed: regResult.failed,
    registrosRemaining: after.pendingRegistros,
    driveUploaded: driveResult.uploaded,
    driveFailed: driveResult.failed,
    driveRemaining: after.pendingDriveImages,
    allSynced: after.allSynced,
  };
}

/** Atajo para refrescar solo contadores en la UI. */
export async function refreshPendingCounts(): Promise<{ registros: number; drive: number }> {
  const [registros, drive] = await Promise.all([
    offlineCache.getPendingCount(),
    getPendingDriveCount(),
  ]);
  return { registros, drive };
}
