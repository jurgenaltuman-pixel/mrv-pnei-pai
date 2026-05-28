/** Lineamientos MRV en terreno — CVS Sarampión / Rubéola 2026 */

export const FUENTES_VERIFICACION = [
  { id: 'libreta', label: 'Libreta de salud del niño/a' },
  { id: 'rve', label: 'RVe' },
  { id: 'registro_vacunacion', label: 'Registro de vacunación' },
] as const;

export type FuenteVerificacion = (typeof FUENTES_VERIFICACION)[number]['id'];

export const ACCIONES_TOMADAS = [
  { id: 'vacunado_visita', label: 'Vacunado durante la visita', hint: 'Monitor o brigada con termo de vacunación' },
  { id: 'derivado_salud', label: 'Derivado al servicio de salud', hint: 'Notificación o papel para acudir al puesto' },
] as const;

export type AccionTomada = (typeof ACCIONES_TOMADAS)[number]['id'];

export const CVS_CAMPAIGN = {
  startMonth: 2,
  startDay: 9,
  endMonth: 4,
  endDay: 29,
} as const;

export function isFechaEnCampanaCvs(isoDate: string): boolean {
  if (!isoDate) return false;
  const d = new Date(isoDate + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  const start = new Date(y, CVS_CAMPAIGN.startMonth, CVS_CAMPAIGN.startDay);
  const end = new Date(y, CVS_CAMPAIGN.endMonth, CVS_CAMPAIGN.endDay, 23, 59, 59);
  return d >= start && d <= end;
}

export const WORKFLOW_STEPS = [
  { id: 1, label: 'Identificación', short: 'Niño/a' },
  { id: 2, label: 'Validación', short: 'Docs' },
  { id: 3, label: 'Evaluación CVS', short: 'CVS' },
  { id: 4, label: 'Justificación', short: 'Motivo' },
  { id: 5, label: 'Intervención', short: 'Acción' },
  { id: 6, label: 'Viviendas', short: 'Casas' },
  { id: 7, label: 'Cierre', short: 'Guardar' },
] as const;
