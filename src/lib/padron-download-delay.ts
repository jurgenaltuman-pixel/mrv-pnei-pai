import { isNativeApp } from '@/lib/capacitor-platform';

/** Espera al inicio: mínima en APK (una sesión); escalonada en web masiva. */
export function padronDownloadStartDelayMs(): number {
  if (isNativeApp()) return 0;
  const maxSec = Number(import.meta.env.VITE_PADRON_STAGGER_MAX_SEC || 120);
  return Math.floor(Math.random() * Math.max(0, maxSec) * 1000);
}

/** Pausa entre páginas: mínima en APK para descarga rápida. */
export function padronDownloadPageDelayMs(): number {
  if (isNativeApp()) return 0;
  const base = Number(import.meta.env.VITE_PADRON_PAGE_DELAY_MS || 280);
  const jitter = Math.floor(Math.random() * 220);
  return base + jitter;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
