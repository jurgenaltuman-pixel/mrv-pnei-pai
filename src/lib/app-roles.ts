/** Roles de aplicación (alineado con enum app_role en PostgreSQL). */
export const APP_ROLES = [
  'user',
  'moderator',
  'regional',
  'supervisor',
  'admin',
  'super_admin',
] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  user: 'Brigadista (user)',
  moderator: 'Moderador',
  regional: 'Supervisor regional',
  supervisor: 'Supervisor nacional',
  admin: 'Administrador',
  super_admin: 'Super administrador',
};

const ADMIN_ASSIGNABLE: AppRole[] = ['user', 'moderator', 'regional', 'supervisor', 'admin'];
const SUPER_ASSIGNABLE: AppRole[] = [...APP_ROLES];

export function rolesAssignableBy(actor: { isSuperAdmin: boolean; isAdmin: boolean }): AppRole[] {
  if (actor.isSuperAdmin) return SUPER_ASSIGNABLE;
  if (actor.isAdmin) return ADMIN_ASSIGNABLE;
  return [];
}

export function canManageUserRoles(actor: { isSuperAdmin: boolean; isAdmin: boolean }): boolean {
  return actor.isSuperAdmin || actor.isAdmin;
}

export function canChangeTargetRole(
  actor: { isSuperAdmin: boolean; isAdmin: boolean },
  targetRole: AppRole | undefined
): boolean {
  if (!canManageUserRoles(actor)) return false;
  if (targetRole === 'super_admin' && !actor.isSuperAdmin) return false;
  return true;
}
