/** Línea base (padrón o al abrir edición) para detectar cambio de residencia sanitaria. */
export type UbicacionSanitariaBaseline = {
  regionId: number | null;
  distritoId: number | null;
  servicioId: number | null;
  servicioManual: string;
  regionText: string;
  distritoText: string;
  servicioText: string;
};

export type UbicacionSanitariaActual = UbicacionSanitariaBaseline;

export function normalizeUbicacionText(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function servicioComparableText(
  servicioId: number | null,
  servicioManual: string,
  servicioText: string
): string {
  if (servicioId != null) return `id:${servicioId}`;
  return normalizeUbicacionText(servicioManual || servicioText);
}

export function ubicacionSanitariaDifiereDeBaseline(
  base: UbicacionSanitariaBaseline | null | undefined,
  actual: UbicacionSanitariaActual
): boolean {
  if (!base) return false;

  const hasBaseline =
    base.regionId != null ||
    base.distritoId != null ||
    base.servicioId != null ||
    Boolean(base.servicioManual.trim()) ||
    Boolean(base.regionText.trim()) ||
    Boolean(base.distritoText.trim()) ||
    Boolean(base.servicioText.trim());
  if (!hasBaseline) return false;

  const norm = normalizeUbicacionText;

  if (base.regionId != null && actual.regionId != null) {
    if (actual.regionId !== base.regionId) return true;
  } else if (base.regionText.trim() && actual.regionText.trim()) {
    if (norm(actual.regionText) !== norm(base.regionText)) return true;
  } else if (base.regionId != null && actual.regionId !== base.regionId) {
    return true;
  }

  if (base.distritoId != null && actual.distritoId != null) {
    if (actual.distritoId !== base.distritoId) return true;
  } else if (base.distritoText.trim() && actual.distritoText.trim()) {
    if (norm(actual.distritoText) !== norm(base.distritoText)) return true;
  } else if (base.distritoId != null && actual.distritoId !== base.distritoId) {
    return true;
  }

  const baseServ = servicioComparableText(base.servicioId, base.servicioManual, base.servicioText);
  const actServ = servicioComparableText(actual.servicioId, actual.servicioManual, actual.servicioText);
  if (baseServ && actServ && baseServ !== actServ) return true;

  return false;
}

export function baselineDesdePersona(
  persona: {
    region_sanitaria?: string | null;
    distrito?: string | null;
    servicio_salud?: string | null;
  },
  ids: {
    regionId: number | null;
    distritoId: number | null;
    servicioId: number | null;
    servicioManual: string;
  }
): UbicacionSanitariaBaseline {
  return {
    regionId: ids.regionId,
    distritoId: ids.distritoId,
    servicioId: ids.servicioId,
    servicioManual: ids.servicioManual,
    regionText: (persona.region_sanitaria || '').trim(),
    distritoText: (persona.distrito || '').trim(),
    servicioText: (persona.servicio_salud || '').trim(),
  };
}
