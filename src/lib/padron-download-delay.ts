import { isNativeApp } from '@/lib/capacitor-platform';

/** Espera al inicio: mínima en APK (una sesión); escalonada en web masiva. */
export function padronDownloadStartDelayMs(): number {
  if (isNativeApp()) return 0;
  const maxSec = Number(import.meta.env.VITE_PADRON_STAGGER_MAX_SEC || 120);
  return Math.floor(Math.random() * Math.max(0, maxSec) * 1000);
}

/** Pausa entre páginas: más corta en APK para descarga fluida. */
export function padronDownloadPageDelayMs(): number {
  const base = isNativeApp()
    ? Number(import.meta.env.VITE_PADRON_PAGE_DELAY_MS_NATIVE || 40)
    : Number(import.meta.env.VITE_PADRON_PAGE_DELAY_MS || 280);
  const jitter = isNativeApp() ? Math.floor(Math.random() * 30) : Math.floor(Math.random() * 220);
  return base + jitter;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
