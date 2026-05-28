/** Espera aleatoria al inicio de descarga masiva (distribuye ~800 sesiones en el tiempo). */
export function padronDownloadStartDelayMs(): number {
  const maxSec = Number(import.meta.env.VITE_PADRON_STAGGER_MAX_SEC || 120);
  return Math.floor(Math.random() * Math.max(0, maxSec) * 1000);
}

/** Pausa entre páginas de padrón para no saturar la API/BD. */
export function padronDownloadPageDelayMs(): number {
  const base = Number(import.meta.env.VITE_PADRON_PAGE_DELAY_MS || 280);
  const jitter = Math.floor(Math.random() * 220);
  return base + jitter;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
