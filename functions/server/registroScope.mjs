/** Filtro territorial en API (misma lógica que src/lib/registro-scope.ts). */

export function normalizeUbicacionKey(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function hasProfileScopeAssignment(scope) {
  return Boolean(
    normalizeUbicacionKey(scope?.assigned_region) && normalizeUbicacionKey(scope?.assigned_distrito)
  );
}

export function registroMatchesProfileScope(row, scope) {
  const reg = normalizeUbicacionKey(scope?.assigned_region);
  const dist = normalizeUbicacionKey(scope?.assigned_distrito);
  if (!reg || !dist) return true;

  if (normalizeUbicacionKey(row.region) !== reg) return false;
  if (normalizeUbicacionKey(row.distrito) !== dist) return false;

  const serv = normalizeUbicacionKey(scope?.assigned_servicio);
  const rServ = normalizeUbicacionKey(row.servicio);
  if (serv && rServ && rServ !== serv) return false;

  const barrio = normalizeUbicacionKey(scope?.assigned_barrio);
  const rBarrio = normalizeUbicacionKey(row.barrio);
  if (barrio && rBarrio && rBarrio !== barrio) return false;

  return true;
}

export function filterRowsByProfileScope(rows, scope, { forceNational = false } = {}) {
  if (forceNational || !hasProfileScopeAssignment(scope)) return rows;
  return rows.filter((r) => registroMatchesProfileScope(r, scope));
}
