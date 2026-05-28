/** Alcance territorial del perfil (región / distrito / servicio). */

export type ProfileScope = {
  assigned_region?: string | null;
  assigned_distrito?: string | null;
  assigned_servicio?: string | null;
  assigned_barrio?: string | null;
  scope_locked?: boolean;
};

export function normalizeUbicacionKey(v: string | null | undefined): string {
  return (v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** Tiene región y distrito asignados → vista zonal (no nacional). */
export function hasProfileScopeAssignment(scope: ProfileScope | null | undefined): boolean {
  return Boolean(
    normalizeUbicacionKey(scope?.assigned_region) && normalizeUbicacionKey(scope?.assigned_distrito)
  );
}

export function registroMatchesProfileScope(
  r: {
    region?: string | null;
    distrito?: string | null;
    servicio?: string | null;
    barrio?: string | null;
  },
  scope: ProfileScope
): boolean {
  const reg = normalizeUbicacionKey(scope.assigned_region);
  const dist = normalizeUbicacionKey(scope.assigned_distrito);
  if (!reg || !dist) return true;

  if (normalizeUbicacionKey(r.region) !== reg) return false;
  if (normalizeUbicacionKey(r.distrito) !== dist) return false;

  const serv = normalizeUbicacionKey(scope.assigned_servicio);
  const rServ = normalizeUbicacionKey(r.servicio);
  // Solo excluir si el registro trae servicio y no coincide (null/vacío = del distrito)
  if (serv && rServ && rServ !== serv) return false;

  const barrio = normalizeUbicacionKey(scope.assigned_barrio);
  const rBarrio = normalizeUbicacionKey(r.barrio);
  if (barrio && rBarrio && rBarrio !== barrio) return false;

  return true;
}

/** Admin/super_admin sin asignación → todos los registros; con asignación → filtro zonal. */
export function filterRegistrosByProfileScope<T extends {
  region?: string | null;
  distrito?: string | null;
  servicio?: string | null;
  barrio?: string | null;
}>(
  registros: T[],
  scope: ProfileScope | null | undefined,
  opts?: { forceNational?: boolean }
): T[] {
  if (opts?.forceNational || !hasProfileScopeAssignment(scope)) return registros;
  return registros.filter((r) => registroMatchesProfileScope(r, scope!));
}
