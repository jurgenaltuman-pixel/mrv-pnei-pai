/** Validación mínima terreno: fuente + vacunación (esquema se deriva de las dosis). */
export function isMrvTerrenoCompleto(input: {
  fuenteVerificacion: string;
  estadoVacuna: 'vacunado' | 'no_vacunado' | null;
  dosisMonitoreo: '1' | '2plus' | null;
  rechazoVacunacion: boolean;
  motivo: string;
  accionTomada: string;
}): boolean {
  const { fuenteVerificacion, estadoVacuna, dosisMonitoreo, rechazoVacunacion, motivo, accionTomada } = input;
  if (!fuenteVerificacion || !estadoVacuna) return false;
  if (estadoVacuna === 'vacunado') return Boolean(dosisMonitoreo);
  return rechazoVacunacion || Boolean(motivo.trim()) || Boolean(accionTomada);
}

/** @deprecated usar isMrvTerrenoCompleto */
export function isMrvCvsTerrenoCompleto(input: {
  fuenteVerificacion: string;
  libreta: boolean | null;
  tieneCvs: boolean | null;
  rechazoVacunacion: boolean;
  motivo: string;
  accionTomada: string;
  dosisSpr: string | null;
  fechaSpr: string;
}): boolean {
  return input.fuenteVerificacion !== '';
}
