import type { RoundMonitoring } from '@/types/round-monitoring';
import { countCasasEfectivas } from '@/lib/croquis-housing';

/** Meta de cierre de ronda: siempre 20 casas efectivas (E). */
export const META_CASAS_EFECTIVAS = 20;

/** Casillas de visita al iniciar (N/F/R/E); se pueden ampliar. */
export const CASAS_VISITAS_INICIAL = 50;

/** Tope de viviendas visitables en una misma ronda. */
export const MAX_CASAS_VISITADAS = 200;

export function metaCasasEfectivas(): number {
  return META_CASAS_EFECTIVAS;
}

/** Normaliza rondas viejas que tenían totalCasas = 50/120 como meta. */
export function aplicarMetaFija(round: RoundMonitoring): RoundMonitoring {
  let casas = round.casas || [];
  const efectivas = countCasasEfectivas(casas);
  const meta = META_CASAS_EFECTIVAS;

  if (casas.length === 0) {
    casas = Array.from({ length: CASAS_VISITAS_INICIAL }, (_, i) => casaVacia(i + 1));
  }

  const sinGuardar = casas.filter((c) => !c.guardada);
  if (sinGuardar.length === 0 && efectivas < meta && casas.length < MAX_CASAS_VISITADAS) {
    const n = casas.length + 1;
    casas = [...casas, casaVacia(n)];
  }

  const fase =
    round.fase === 'summary' && efectivas < meta
      ? 'croquis'
      : round.fase;
  const completedAt =
    round.fase === 'summary' && efectivas < meta ? null : round.completedAt;

  return {
    ...round,
    totalCasas: meta,
    casas,
    fase,
    completedAt,
  };
}

function casaVacia(numero: number) {
  return {
    numero,
    estado: null as const,
    ninos: [],
    guardada: false,
    latitud: null,
    longitud: null,
    guardadaAt: null,
  };
}
