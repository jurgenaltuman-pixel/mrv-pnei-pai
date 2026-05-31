/** Prefijo en enlace_imagen_* mientras la foto espera subir a Drive (offline). */
export const PENDING_DRIVE_URL_PREFIX = 'pending://drive/';

export function isPendingDriveUrl(url?: string | null): boolean {
  return Boolean(url?.startsWith(PENDING_DRIVE_URL_PREFIX));
}

export function pendingDriveUrl(id: string): string {
  return `${PENDING_DRIVE_URL_PREFIX}${id}`;
}

export function pendingDriveId(url: string): string | null {
  if (!url.startsWith(PENDING_DRIVE_URL_PREFIX)) return null;
  return url.slice(PENDING_DRIVE_URL_PREFIX.length) || null;
}
