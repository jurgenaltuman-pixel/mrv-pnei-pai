import type { PadronSearchModo } from '@/lib/padron-search-status';

/** Texto mientras busca (expectativa para el usuario). */
export function padronSearchEtaHint(modo: PadronSearchModo, padronShards = 2): string {
  if (modo === 'documento') {
    return padronShards >= 2
      ? 'Consultando 2 bases de padrón en paralelo — suele tardar menos de 2 s'
      : 'Consultando padrón — suele tardar 1–3 s';
  }
  return 'Búsqueda nominal por nombre/datos — suele tardar 2–6 s';
}

export function formatPadronSearchDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function padronSearchSpeedLabel(ms: number): 'rápida' | 'normal' | 'lenta' {
  if (ms < 1200) return 'rápida';
  if (ms < 4500) return 'normal';
  return 'lenta';
}

export function padronSearchDurationLine(ms: number): string {
  const d = formatPadronSearchDuration(ms);
  if (!d) return '';
  const vel = padronSearchSpeedLabel(ms);
  return `Búsqueda ${vel} (${d}).`;
}
