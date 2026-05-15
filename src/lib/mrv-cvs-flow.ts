/** Validación del bloque CVS (terreno) — misma regla que MainApp `cvsCompleto` (sin visita N/F/R). */
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
  const {
    fuenteVerificacion,
    libreta,
    tieneCvs,
    rechazoVacunacion,
    motivo,
    accionTomada,
    dosisSpr,
    fechaSpr,
  } = input;

  return (
    fuenteVerificacion !== '' &&
    libreta !== null &&
    tieneCvs !== null &&
    (tieneCvs === true || rechazoVacunacion || Boolean(motivo.trim())) &&
    (tieneCvs === false ? Boolean(accionTomada) : true) &&
    (tieneCvs === true ? Boolean(dosisSpr) && Boolean(fechaSpr.trim()) : true)
  );
}
