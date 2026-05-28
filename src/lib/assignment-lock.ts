import type { ProfileScope } from '@/lib/registro-scope';
import { hasProfileScopeAssignment } from '@/lib/registro-scope';

/** Encuestador con región+distrito asignados: ubicación fija (no edita región/distrito/servicio). */
export function ubicacionBloqueadaPorAsignacion(
  scope: ProfileScope | null | undefined,
  opts?: { isAdmin?: boolean; isSuperAdmin?: boolean }
): boolean {
  if (opts?.isAdmin || opts?.isSuperAdmin) return false;
  if (scope?.scope_locked) return hasProfileScopeAssignment(scope);
  return hasProfileScopeAssignment(scope);
}
