import type { RoundMonitoring } from '@/types/round-monitoring';

/** Código corto legible para identificar una ronda en UI y en observaciones de registros. */
export function generarCodigoRonda(): string {
  const d = new Date();
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `R${y}${m}${day}-${rnd}`;
}

export function etiquetaRondaEnObservaciones(codigo: string, casaNumero?: number): string {
  const base = `[Ronda ${codigo}]`;
  return casaNumero != null ? `${base} Casa ${casaNumero}` : base;
}

/** Asegura codigo en rondas guardadas antes de introducir el campo. */
export function ensureRoundCodigo(round: RoundMonitoring): RoundMonitoring {
  if (round.codigo?.trim()) return round;
  return { ...round, codigo: generarCodigoRonda() };
}

export function formatRoundCodigoDisplay(round: Pick<RoundMonitoring, 'codigo' | 'id'>): string {
  return round.codigo?.trim() || round.id.slice(0, 8).toUpperCase();
}
