import type { RoundMonitoring } from '@/types/round-monitoring';
import { MAX_CASAS_VISITADAS } from '@/lib/round-meta';
import { anadirCasaARonda } from '@/services/roundMonitoringStorage';

export const AMPLIAR_VISITAS_LOTES = [10, 20] as const;

export function puedeAmpliarVisitas(round: RoundMonitoring): boolean {
  return round.casas.length < MAX_CASAS_VISITADAS;
}

/** Solo añade casillas de visita; la meta E sigue en 20. */
export function ampliarVisitasRonda(
  round: RoundMonitoring,
  cantidad: number
): RoundMonitoring | null {
  if (!puedeAmpliarVisitas(round)) return null;
  const extra = Math.max(1, Math.min(cantidad, MAX_CASAS_VISITADAS - round.casas.length));
  let r = round;
  for (let i = 0; i < extra; i += 1) {
    const next = anadirCasaARonda(r);
    if (!next) return r;
    r = next;
  }
  if (r.fase === 'summary' || r.completedAt != null) {
    const siguiente = r.casas.find((c) => !c.guardada);
    return {
      ...r,
      fase: 'croquis',
      completedAt: null,
      casaActiva: siguiente?.numero ?? r.casaActiva,
    };
  }
  return r;
}
