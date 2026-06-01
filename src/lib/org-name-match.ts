/** Comparación flexible región / distrito / servicio (Excel vs catálogo org). */
export function normalizeOrgName(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function pickOrgName<T extends { nombre: string }>(
  catalog: T[],
  raw: string | null | undefined
): string {
  const target = normalizeOrgName(raw);
  if (!target || !catalog.length) return String(raw || '').trim();

  const exact = catalog.find((x) => normalizeOrgName(x.nombre) === target);
  if (exact) return exact.nombre;

  const contains = catalog.find((x) => {
    const n = normalizeOrgName(x.nombre);
    return n.includes(target) || target.includes(n);
  });
  if (contains) return contains.nombre;

  return String(raw || '').trim();
}

export function resolveSignupOrgSelection(
  catalog: {
    regiones: { id: number; nombre: string }[];
    distritos: { id: number; nombre: string; region_id: number }[];
    servicios: { id: number; nombre: string; distrito_id: number }[];
  },
  fromNomina: {
    assigned_region?: string | null;
    assigned_distrito?: string | null;
    assigned_servicio?: string | null;
  }
): { region: string; distrito: string; servicio: string } {
  const region = pickOrgName(catalog.regiones, fromNomina.assigned_region);
  const regionId = catalog.regiones.find((r) => normalizeOrgName(r.nombre) === normalizeOrgName(region))?.id;
  const distritos = regionId
    ? catalog.distritos.filter((d) => d.region_id === regionId)
    : catalog.distritos;
  const distrito = pickOrgName(distritos, fromNomina.assigned_distrito);
  const distritoId = distritos.find((d) => normalizeOrgName(d.nombre) === normalizeOrgName(distrito))?.id;
  const servicios = distritoId
    ? catalog.servicios.filter((s) => s.distrito_id === distritoId)
    : catalog.servicios;
  const servicio = pickOrgName(servicios, fromNomina.assigned_servicio);
  return { region, distrito, servicio };
}
