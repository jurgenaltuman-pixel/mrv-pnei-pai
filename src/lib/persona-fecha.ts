import { fechaNacimientoFromEdadNominal, normalizeToIsoDate } from '@/lib/format-fecha';

export function resolveFechaNacimientoPersona(persona: {
  fecha_nacimiento?: string | null;
  edad_anos?: number | null;
  edad_meses?: number | null;
  historial_spr?: { edad_anos?: number | null; edad_meses?: number | null } | null;
}): string {
  const direct = normalizeToIsoDate(persona.fecha_nacimiento);
  if (direct) return direct;
  const anos = persona.edad_anos ?? persona.historial_spr?.edad_anos;
  const meses = persona.edad_meses ?? persona.historial_spr?.edad_meses;
  return fechaNacimientoFromEdadNominal(anos, meses);
}
