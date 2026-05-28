/** Primera dosis cuenta como vacunado en monitoreo por casas */
export function esVacunadoMonitoreo(estadoVacuna: 'vacunado' | 'no_vacunado' | null): boolean {
  return estadoVacuna === 'vacunado';
}

export function etiquetaVacunacionMonitoreo(
  vacunado: boolean,
  dosisSpr: '1' | '2plus'
): string {
  if (!vacunado) return 'No vacunado';
  return dosisSpr === '2plus' ? 'Vacunado (2+ dosis)' : 'Vacunado (primera dosis)';
}

/** Visitas N, F y R: asignación administrativa + GPS en el punto de la visita. */
export function esVisitaNfr(estado: 'E' | 'N' | 'F' | 'R' | null): boolean {
  return estado === 'N' || estado === 'F' || estado === 'R';
}

/** @deprecated usar esVisitaNfr */
export function requiereUbicacionCasa(estado: 'E' | 'N' | 'F' | 'R' | null): boolean {
  return esVisitaNfr(estado);
}

export function usaUbicacionEncuestadorAsignada(estado: 'E' | 'N' | 'F' | 'R' | null): boolean {
  return esVisitaNfr(estado);
}

export function requiereGpsEnVisita(estado: 'E' | 'N' | 'F' | 'R' | null): boolean {
  return esVisitaNfr(estado);
}

export function etiquetaGuardarVisitaCasa(estado: 'E' | 'N' | 'F' | 'R' | null): string {
  if (estado === 'N') return 'Guardar visita no efectiva';
  if (estado === 'F') return 'Guardar visita fallida';
  if (estado === 'R') return 'Guardar visita renuente';
  return 'Guardar casa';
}
