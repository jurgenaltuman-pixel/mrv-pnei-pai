import type { CasaEstadoCode, RoundSummary } from '@/types/round-monitoring';

/** Cobertura vacunal mínima para aprobar el monitoreo de la ronda. */
export const UMBRAL_COBERTURA_APROBADO = 95;

export type RoundEvaluation = {
  coberturaVacunacion: number | null;
  rondaCompleta: boolean;
  aprobado: boolean;
  titulo: 'MONITOREO APROBADO' | 'MONITOREO CAÍDO';
  mensaje: string;
};

export function computeCoberturaVacunacion(vacunados: number, totalNinos: number): number | null {
  if (totalNinos < 1) return null;
  return Math.round((vacunados / totalNinos) * 1000) / 10;
}

export function evaluateRoundMonitoring(summary: RoundSummary): RoundEvaluation {
  const coberturaVacunacion = computeCoberturaVacunacion(summary.vacunados, summary.totalNinos);
  // La ronda se considera completa cuando se visitaron todas las casas asignadas.
  // "efectivas" depende del resultado de campo y no debe bloquear el cierre.
  const rondaCompleta = summary.visitadas >= summary.totalCasas;

  const aprobado =
    rondaCompleta &&
    coberturaVacunacion != null &&
    coberturaVacunacion >= UMBRAL_COBERTURA_APROBADO;

  if (aprobado) {
    return {
      coberturaVacunacion,
      rondaCompleta,
      aprobado: true,
      titulo: 'MONITOREO APROBADO',
      mensaje: `Cobertura vacunal ${coberturaVacunacion}% (meta ≥ ${UMBRAL_COBERTURA_APROBADO}%).`,
    };
  }

  if (!rondaCompleta) {
    return {
      coberturaVacunacion,
      rondaCompleta: false,
      aprobado: false,
      titulo: 'MONITOREO CAÍDO',
      mensaje: `Completá ${summary.totalCasas} casas efectivas (E) para cerrar la ronda.`,
    };
  }

  if (summary.totalNinos < 1) {
    return {
      coberturaVacunacion: null,
      rondaCompleta: true,
      aprobado: false,
      titulo: 'MONITOREO CAÍDO',
      mensaje:
        'No hay niños registrados en casas efectivas. Debe repetir el monitoreo en terreno (nueva visita al módulo).',
    };
  }

  return {
    coberturaVacunacion,
    rondaCompleta: true,
    aprobado: false,
    titulo: 'MONITOREO CAÍDO',
    mensaje: `Cobertura vacunal ${coberturaVacunacion}% (se requiere ≥ ${UMBRAL_COBERTURA_APROBADO}%). Debe repetir el monitoreo en terreno; este registro queda como referencia en el sistema.`,
  };
}

export function deltaContadorPorEstadoCasa(code: CasaEstadoCode): {
  efectivas?: number;
  noEfectivas?: number;
  fallidas?: number;
  renuentes?: number;
} {
  switch (code) {
    case 'E':
      return { efectivas: 1 };
    case 'N':
      return { noEfectivas: 1 };
    case 'F':
      return { fallidas: 1 };
    case 'R':
      return { renuentes: 1 };
    default:
      return {};
  }
}
