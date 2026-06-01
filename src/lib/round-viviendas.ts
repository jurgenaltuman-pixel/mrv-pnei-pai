import type { RoundMonitoring } from '@/types/round-monitoring';
import { MAX_CASAS_POR_MODULO, clampCasasPorModulo } from '@/lib/round-config';
import { anadirCasaARonda } from '@/services/roundMonitoringStorage';

/** Metas de viviendas al iniciar una ronda (casas efectivas E). */
export const CASAS_META_PRESETS = [20, 50, 80, 120] as const;

export const AMPLIAR_VIVIENDAS_LOTES = [10, 20] as const;

export function puedeAmpliarViviendas(round: RoundMonitoring): boolean {
  return round.casas.length < MAX_CASAS_POR_MODULO;
}

/** Añade casillas vacías y sube la meta E (totalCasas). */
export function ampliarViviendasRonda(
  round: RoundMonitoring,
  cantidad: number
): RoundMonitoring | null {
  if (!puedeAmpliarViviendas(round)) return null;
  const extra = Math.max(1, Math.min(cantidad, MAX_CASAS_POR_MODULO - round.casas.length));
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

export function elegirPresetCercano(n: number): number {
  const c = clampCasasPorModulo(n);
  const preset = CASAS_META_PRESETS.find((p) => p === c);
  if (preset) return preset;
  const menor = [...CASAS_META_PRESETS].reverse().find((p) => p <= c);
  return menor ?? CASAS_META_PRESETS[0];
}
