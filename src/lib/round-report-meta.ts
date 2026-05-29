import type { RoundMonitoring } from '@/types/round-monitoring';

export type RoundPersonnelHints = {
  entrevistadorNombre?: string | null;
  responsable?: string | null;
  colaboradores?: string[];
  /** Nombre del brigadista (historial / perfil) si la ronda no lo guardó */
  displayNameFallback?: string | null;
};

function pick(...values: (string | null | undefined)[]): string | null {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
}

/** Completa entrevistador, responsable y equipo antes de exportar o guardar snapshot. */
export function enrichRoundPersonnel(
  round: RoundMonitoring,
  hints?: RoundPersonnelHints
): RoundMonitoring {
  const responsable = pick(round.responsable, hints?.responsable, hints?.displayNameFallback);
  const entrevistador = pick(
    round.entrevistador,
    hints?.entrevistadorNombre,
    responsable,
    hints?.displayNameFallback
  );
  const colaboradores =
    (round.colaboradores?.length ? round.colaboradores : hints?.colaboradores) || [];

  return {
    ...round,
    responsable,
    entrevistador,
    colaboradores: colaboradores.map((s) => s.trim()).filter(Boolean),
  };
}
