import type { AppRole } from '@/lib/app-roles';

export type ReportViewMode = 'national' | 'regional' | 'zonal' | 'own';

export type RoleFlags = {
  roles: AppRole[];
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isRegional: boolean;
};

export function roleFlagsFromList(roles: string[]): RoleFlags {
  const r = roles as AppRole[];
  const isSuperAdmin = r.includes('super_admin');
  const isAdmin = isSuperAdmin || r.includes('admin');
  return {
    roles: r,
    isSuperAdmin,
    isAdmin,
    isSupervisor: r.includes('supervisor'),
    isRegional: r.includes('regional'),
  };
}

export function canViewNationalReports(f: RoleFlags): boolean {
  return f.isSuperAdmin || f.isAdmin || f.isSupervisor;
}

export function canViewRegionalReports(f: RoleFlags): boolean {
  return canViewNationalReports(f) || f.isRegional;
}

export function canAccessDashboardReports(f: RoleFlags): boolean {
  return canViewRegionalReports(f);
}

/** Vista nacional por defecto para supervisor/admin sin asignación zonal. */
export function defaultUseNationalView(
  f: RoleFlags,
  hasZonalAssignment: boolean
): boolean {
  if (canViewNationalReports(f)) {
    if (f.isRegional && !f.isSupervisor && !f.isAdmin && !f.isSuperAdmin) return false;
    return !hasZonalAssignment || f.isSupervisor || f.isAdmin || f.isSuperAdmin;
  }
  return false;
}
