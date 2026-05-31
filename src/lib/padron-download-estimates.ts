/** Estimaciones de tiempo para descarga offline (APK). */

export const PADRON_ROWS_ESTIMATE = 831_000;
export const PADRON_PAGE_SIZE = 800;

export type OfflineNetworkKind = 'wifi' | 'cellular' | 'unknown';

export function formatDurationEs(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `~${Math.ceil(seconds)} s`;
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return m > 0 ? `~${h} h ${m} min` : `~${h} h`;
}

/** Paso 1: unidad organizativa (regiones, distritos, servicios, barrios). */
export function estimateOrgDownload(network: OfflineNetworkKind): {
  typicalSec: number;
  label: string;
} {
  const typicalSec = network === 'wifi' ? 30 : network === 'cellular' ? 75 : 50;
  return {
    typicalSec,
    label: formatDurationEs(typicalSec),
  };
}

/** Paso 2: padrón nominal completo (~831k filas, lotes de 800). */
export function estimatePadronDownload(network: OfflineNetworkKind): {
  minSec: number;
  maxSec: number;
  typicalSec: number;
  rangeLabel: string;
  typicalLabel: string;
} {
  const pages = Math.ceil(PADRON_ROWS_ESTIMATE / PADRON_PAGE_SIZE);
  const msPerPage =
    network === 'wifi'
      ? 70 + 420
      : network === 'cellular'
        ? 120 + 950
        : 90 + 650;
  const typicalSec = Math.round((pages * msPerPage) / 1000);
  const minSec = Math.round(typicalSec * 0.7);
  const maxSec = Math.round(typicalSec * 1.45);
  return {
    minSec,
    maxSec,
    typicalSec,
    rangeLabel: `${formatDurationEs(minSec)} – ${formatDurationEs(maxSec)}`,
    typicalLabel: formatDurationEs(typicalSec),
  };
}

export function estimateTotalOfflineDownload(network: OfflineNetworkKind): string {
  const org = estimateOrgDownload(network);
  const pad = estimatePadronDownload(network);
  const totalTypical = org.typicalSec + pad.typicalSec;
  return formatDurationEs(totalTypical);
}

/** ETA en vivo según filas ya descargadas. */
export function etaRemainingFromProgress(
  imported: number,
  total: number | null,
  startedAtMs: number
): string | null {
  if (!total || total <= 0 || imported <= 100) return null;
  const elapsedSec = (Date.now() - startedAtMs) / 1000;
  if (elapsedSec < 5) return null;
  const rate = imported / elapsedSec;
  if (rate <= 0) return null;
  return formatDurationEs((total - imported) / rate);
}
