/** Esquema SPR derivado de dosis + edad (meses). */

export type DosisMonitoreo = '1' | '2plus';

export interface EdadEsquemaInput {
  fechaNacimiento?: string | null;
  edad_anos?: number | null;
  edad_meses?: number | null;
}

/** Edad total en meses (hasta 1a5m = 17 · desde 1a6m = 18). */
export function edadTotalEnMeses(input: EdadEsquemaInput): number | null {
  const { fechaNacimiento, edad_anos, edad_meses } = input;
  // Priorizar edad nominal del padrón (1 año 1 mes, etc.); la fecha derivada puede desfasarse.
  if (edad_anos != null || edad_meses != null) {
    const a = edad_anos ?? 0;
    const m = edad_meses ?? 0;
    if (a > 0 || m > 0) return a * 12 + m;
  }
  if (fechaNacimiento?.trim()) {
    const nac = new Date(fechaNacimiento.trim().slice(0, 10));
    if (!Number.isNaN(nac.getTime())) {
      const hoy = new Date();
      let meses = (hoy.getFullYear() - nac.getFullYear()) * 12 + (hoy.getMonth() - nac.getMonth());
      if (hoy.getDate() < nac.getDate()) meses -= 1;
      if (meses >= 0) return meses;
    }
  }
  return null;
}

/** Años y meses de la nómina / historial SPR. */
export function edadNominalDesdePersona(persona: {
  edad_anos?: number | null;
  edad_meses?: number | null;
  historial_spr?: { edad_anos?: number | null; edad_meses?: number | null } | null;
}): { edad_anos: number | null; edad_meses: number | null } {
  return {
    edad_anos: persona.edad_anos ?? persona.historial_spr?.edad_anos ?? null,
    edad_meses: persona.edad_meses ?? persona.historial_spr?.edad_meses ?? null,
  };
}

/**
 * Reglas SPR (monitoreo):
 * - Hasta 1 año 5 meses (≤17 meses) + 1 dosis → completo
 * - Desde 1 año 6 meses (≥18 meses) + 1 dosis → incompleto
 * - Desde 1 año 6 meses + 2 o más dosis → completo
 */
export function esquemaFromDosisMonitoreo(
  dosis: DosisMonitoreo | null,
  edadTotalMeses: number | null = null
): boolean | null {
  if (dosis === '2plus') return true;
  if (dosis !== '1') return null;

  if (edadTotalMeses == null) return false;

  if (edadTotalMeses <= 17) return true;
  if (edadTotalMeses >= 18) return false;

  return false;
}

export function esquemaAutomaticoLabel(
  completo: boolean,
  dosis: DosisMonitoreo,
  edadTotalMeses: number | null = null
): string {
  if (dosis === '2plus') return 'Completo — 2 o más dosis SPR';
  if (completo && edadTotalMeses != null && edadTotalMeses <= 17) {
    return 'Completo — 1 dosis SPR (hasta 1 año 5 meses)';
  }
  if (!completo && edadTotalMeses != null && edadTotalMeses >= 18) {
    return 'Incompleto — 1 dosis SPR (desde 1 año 6 meses requiere 2ª dosis)';
  }
  return completo ? 'Completo — 1 dosis SPR' : 'Incompleto — 1 dosis SPR';
}
