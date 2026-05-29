/** Identificador de build (vite define en producción). */
export const APP_BUILD_ID = (import.meta.env.VITE_APP_BUILD_ID as string) || 'dev';

const BUILD_STORAGE_KEY = 'mrv-build-id';

export async function clearAppCaches(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

/** Limpia caché/SW y recarga (útil si la PWA muestra una versión vieja). */
export async function forceAppUpdate(): Promise<void> {
  try {
    localStorage.removeItem(BUILD_STORAGE_KEY);
    localStorage.removeItem('mrv-sw-sweep-2026-05-27-chunk-mapview');
    localStorage.removeItem('mrv-sw-sweep-2026-05-28-labels-map');
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  await clearAppCaches();
  window.location.reload();
}

/**
 * Tras un despliegue nuevo: una recarga automática si el usuario tenía otra versión guardada.
 */
export async function ensureFreshBuildOnBoot(): Promise<boolean> {
  if (!APP_BUILD_ID || APP_BUILD_ID === 'dev' || typeof window === 'undefined') {
    return false;
  }
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(BUILD_STORAGE_KEY);
  } catch {
    return false;
  }
  if (stored === APP_BUILD_ID) return false;

  try {
    localStorage.setItem(BUILD_STORAGE_KEY, APP_BUILD_ID);
  } catch {
    return false;
  }

  await clearAppCaches();

  if (stored != null) {
    window.location.reload();
    return true;
  }
  return false;
}
