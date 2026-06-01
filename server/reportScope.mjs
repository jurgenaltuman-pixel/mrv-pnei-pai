import { hasProfileScopeAssignment, filterRowsByProfileScope, normalizeUbicacionKey } from './registroScope.mjs';

export const REPORT_VIEWER_ROLES = ['super_admin', 'admin', 'supervisor', 'regional'];

export function isNationalReporter(roles) {
  return roles.some((r) => ['super_admin', 'admin', 'supervisor'].includes(r));
}

export function isRegionalReporter(roles) {
  return isNationalReporter(roles) || roles.includes('regional');
}

export function canAccessReports(roles) {
  return roles.some((r) => REPORT_VIEWER_ROLES.includes(r));
}

/** @returns {{ mode: 'national'|'regional'|'zonal'|'own', scope: object|null }} */
export function resolveReportScope(profileScope, roles) {
  if (isNationalReporter(roles)) {
    return { mode: 'national', scope: profileScope || null };
  }
  if (roles.includes('regional')) {
    return { mode: 'regional', scope: profileScope || null };
  }
  if (hasProfileScopeAssignment(profileScope)) {
    return { mode: 'zonal', scope: profileScope };
  }
  return { mode: 'own', scope: profileScope || null };
}

export function filterRowsByReportScope(rows, reportScope) {
  if (!reportScope) return rows;
  if (reportScope.mode === 'national') {
    return filterRowsByProfileScope(rows, reportScope.scope, { forceNational: true });
  }
  if (reportScope.mode === 'regional') {
    const reg = normalizeUbicacionKey(reportScope.scope?.assigned_region);
    if (!reg) return rows;
    return rows.filter((r) => normalizeUbicacionKey(r.region) === reg);
  }
  if (reportScope.mode === 'zonal') {
    return filterRowsByProfileScope(rows, reportScope.scope);
  }
  return rows;
}
