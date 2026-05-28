/**
 * Operaciones de panel admin: API Aiven o Supabase legacy.
 */
import { supabase, isSupabaseEnabled } from '@/integrations/supabase/client';
import { USE_MRV_API } from '@/lib/api-config';
import * as backend from '@/services/mrvBackend';

export type AppRole = 'super_admin' | 'admin' | 'moderator' | 'user';

export interface ProfileRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  username: string | null;
  is_active?: boolean | null;
  is_approved?: boolean | null;
  approved_at?: string | null;
  assigned_region?: string | null;
  assigned_distrito?: string | null;
  assigned_servicio?: string | null;
  assigned_barrio?: string | null;
  scope_locked?: boolean;
}

export interface UserRoleRow {
  user_id: string;
  role: AppRole;
}

export async function loadProfilesRoles(): Promise<{ profiles: ProfileRow[]; roles: UserRoleRow[]; error?: string }> {
  if (USE_MRV_API) {
    const { data, error } = await backend.fetchProfilesRoles();
    if (error) return { profiles: [], roles: [], error };
    return {
      profiles: (data?.profiles || []) as ProfileRow[],
      roles: (data?.roles || []) as UserRoleRow[],
    };
  }
  const selectCols =
    'user_id, display_name, email, username, is_active, is_approved, approved_at, assigned_region, assigned_distrito, assigned_servicio, assigned_barrio, scope_locked';
  const pageSize = 1000;
  let from = 0;
  let profiles: ProfileRow[] = [];
  while (true) {
    const { data, error } = await supabase
      .from('profiles')
      .select(selectCols)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) return { profiles: [], roles: [], error: error.message };
    if (!data?.length) break;
    profiles = profiles.concat(data as ProfileRow[]);
    if (data.length < pageSize) break;
    from += pageSize;
    if (from > 100_000) break;
  }
  let roles: UserRoleRow[] = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase.from('user_roles').select('user_id, role').range(from, from + pageSize - 1);
    if (error || !data?.length) break;
    roles = roles.concat(data as UserRoleRow[]);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { profiles, roles };
}

export async function setPrimaryRole(userId: string, role: AppRole): Promise<string | null> {
  if (USE_MRV_API) {
    const { error } = await backend.setUserRole(userId, role);
    return error || null;
  }
  const { error: delErr } = await supabase.from('user_roles').delete().eq('user_id', userId);
  if (delErr) return delErr.message;
  const { error: insErr } = await supabase.from('user_roles').insert({ user_id: userId, role });
  return insErr?.message || null;
}

export async function patchProfile(userId: string, patch: Record<string, unknown>): Promise<string | null> {
  if (USE_MRV_API) {
    const { error } = await backend.updateProfile(userId, patch);
    return error || null;
  }
  const { error } = await supabase.from('profiles').update(patch as never).eq('user_id', userId);
  return error?.message || null;
}

export async function resetPassword(userId: string): Promise<{ password?: string; error?: string }> {
  if (USE_MRV_API) {
    const { data, error } = await backend.resetUserPassword(userId);
    return error ? { error } : { password: data?.password || 'Cambio2026!' };
  }
  const { data, error } = await supabase.rpc('admin_reset_password', {
    target_user_id: userId,
    temp_password: 'Cambio2026!',
  });
  if (error) return { error: error.message };
  return { password: (typeof data === 'string' && data) ? data : 'Cambio2026!' };
}

export async function syncProfilesIdentity(): Promise<string | null> {
  if (USE_MRV_API) {
    const { error } = await backend.apiPost('/api/admin/sync-profiles');
    return error || null;
  }
  const { error } = await supabase.rpc('sync_profiles_identity');
  return error?.message || null;
}

export async function deleteRegistro(id: string): Promise<string | null> {
  if (USE_MRV_API) {
    const { error } = await backend.deleteRegistro(id);
    return error || null;
  }
  const { error } = await supabase.from('registros_vacunacion').delete().eq('id', id);
  return error?.message || null;
}

export async function patchRegistro(id: string, patch: Record<string, unknown>): Promise<string | null> {
  if (USE_MRV_API) {
    const { error } = await backend.patchAdminRegistro(id, patch);
    return error || null;
  }
  const { error } = await supabase.from('registros_vacunacion').update(patch as never).eq('id', id);
  return error?.message || null;
}

export async function patchOwnRegistro(id: string, patch: Record<string, unknown>): Promise<string | null> {
  if (USE_MRV_API) {
    const { error } = await backend.patchRegistro(id, patch);
    return error || null;
  }
  const { error } = await supabase.from('registros_vacunacion').update(patch as never).eq('id', id);
  return error?.message || null;
}

export async function deleteUserCompletely(userId: string): Promise<string | null> {
  if (USE_MRV_API) {
    const { error } = await backend.deleteUser(userId);
    return error || null;
  }
  await supabase.from('registros_vacunacion').delete().eq('responsable_id', userId);
  await supabase.from('user_roles').delete().eq('user_id', userId);
  const { error } = await supabase.from('profiles').delete().eq('user_id', userId);
  return error?.message || null;
}

export async function importOrgRows(rows: { region: string; distrito: string; servicio: string; barrio?: string }[]): Promise<string | null> {
  if (USE_MRV_API) {
    const { error } = await backend.importOrgRows(rows);
    return error || null;
  }
  await supabase.from('barrios').delete().gt('id', 0);
  await supabase.from('servicios_salud').delete().gt('id', 0);
  await supabase.from('distritos').delete().gt('id', 0);
  await supabase.from('regiones_sanitarias').delete().gt('id', 0);
  const norm = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const regionMap = new Map<string, number>();
  for (const regionName of [...new Set(rows.map((r) => r.region.trim()).filter(Boolean))].sort()) {
    const { data: inserted } = await supabase.from('regiones_sanitarias').insert({ nombre: regionName }).select('id, nombre').single();
    if (inserted) regionMap.set(norm(inserted.nombre), inserted.id);
  }
  const distritoMap = new Map<string, number>();
  for (const r of rows) {
    const regionId = regionMap.get(norm(r.region));
    if (!regionId) continue;
    const dKey = `${regionId}:${norm(r.distrito)}`;
    if (distritoMap.has(dKey)) continue;
    const { data: inserted } = await supabase.from('distritos').insert({ nombre: r.distrito.trim(), region_id: regionId }).select('id, nombre, region_id').single();
    if (inserted) distritoMap.set(`${inserted.region_id}:${norm(inserted.nombre)}`, inserted.id);
  }
  for (const r of rows) {
    const regionId = regionMap.get(norm(r.region));
    if (!regionId) continue;
    const distritoId = distritoMap.get(`${regionId}:${norm(r.distrito)}`);
    if (!distritoId || !r.servicio?.trim()) continue;
    await supabase.from('servicios_salud').insert({ nombre: r.servicio.trim(), distrito_id: distritoId });
  }
  for (const r of rows.filter((x) => x.barrio?.trim())) {
    const regionId = regionMap.get(norm(r.region));
    if (!regionId) continue;
    const distritoId = distritoMap.get(`${regionId}:${norm(r.distrito)}`);
    if (!distritoId) continue;
    await supabase.from('barrios').insert({ nombre: r.barrio!.trim(), distrito_id: distritoId });
  }
  return null;
}

export async function importPadronBatch(batch: Record<string, unknown>[]): Promise<string | null> {
  if (USE_MRV_API) {
    const { error } = await backend.importPadronBatch(batch);
    return error || null;
  }
  const { error } = await supabase.from('base_personas').insert(batch as never);
  return error?.message || null;
}

export async function clearPadron(): Promise<string | null> {
  if (USE_MRV_API) {
    const { error } = await backend.clearPadron();
    return error || null;
  }
  const { error } = await supabase.from('base_personas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  return error?.message || null;
}

async function loadNominalFromSupabase(): Promise<Record<string, unknown>[]> {
  let { data, error } = await supabase
    .from('registros_vacunacion')
    .select('id, fecha_hora, region, distrito, servicio, barrio, responsable, nombre, documento, fecha_nacimiento, sexo, estado_vacunacion, motivo, tipo_vivienda, esquema_completo')
    .order('fecha_hora', { ascending: false })
    .limit(10000);
  if (error) {
    const fallback = await supabase
      .from('registros_vacunacion')
      .select('id, fecha_hora, region, distrito, servicio, barrio, responsable, nombre, documento, fecha_nacimiento, sexo, estado_vacunacion, motivo')
      .order('fecha_hora', { ascending: false })
      .limit(10000);
    data = fallback.data;
    error = fallback.error;
  }
  if (error) return [];
  return (data || []) as Record<string, unknown>[];
}

export async function importRegistrosFromExcel(
  rows: Record<string, unknown>[]
): Promise<{ inserted: number; skipped: number; total?: number; error?: string }> {
  if (USE_MRV_API) {
    const { data, error } = await backend.importAdminRegistros(rows);
    if (error) return { inserted: 0, skipped: rows.length, error };
    return {
      inserted: data?.inserted ?? 0,
      skipped: data?.skipped ?? 0,
      total: data?.total,
    };
  }
  return { inserted: 0, skipped: rows.length, error: 'Importación Excel solo vía API Aiven.' };
}

export async function loadNominalRows(opts?: { national?: boolean }): Promise<{
  data: Record<string, unknown>[];
  total?: number;
  error?: string;
  nationalView?: boolean;
  sources?: { aiven?: number; supabase?: number; merged?: number };
  totalAiven?: number;
  totalSupabase?: number;
}> {
  if (USE_MRV_API) {
    const { data, error } = await backend.fetchAdminRegistros(10000, Boolean(opts?.national));
    if (error) return { data: [], error };
    const rows = data?.data || [];
    const total = data?.total ?? rows.length;
    if (rows.length > 0) {
      return {
        data: rows,
        total,
        nationalView: data?.nationalView,
        sources: data?.sources,
        totalAiven: data?.totalAiven,
        totalSupabase: data?.totalSupabase,
      };
    }
    if (isSupabaseEnabled) {
      const legacy = await loadNominalFromSupabase();
      if (legacy.length > 0) {
        return { data: legacy, total: legacy.length, sources: { supabase: legacy.length, merged: legacy.length } };
      }
    }
    return {
      data: rows,
      total,
      nationalView: data?.nationalView,
      sources: data?.sources,
      totalAiven: data?.totalAiven,
      totalSupabase: data?.totalSupabase,
    };
  }
  let { data, error } = await supabase
    .from('registros_vacunacion')
    .select('id, fecha_hora, region, distrito, servicio, barrio, responsable, nombre, documento, fecha_nacimiento, sexo, estado_vacunacion, motivo, tipo_vivienda, esquema_completo')
    .order('fecha_hora', { ascending: false })
    .limit(10000);
  if (error) {
    const fallback = await supabase
      .from('registros_vacunacion')
      .select('id, fecha_hora, region, distrito, servicio, barrio, responsable, nombre, documento, fecha_nacimiento, sexo, estado_vacunacion, motivo')
      .order('fecha_hora', { ascending: false })
      .limit(10000);
    data = fallback.data;
    error = fallback.error;
  }
  if (error) return { data: [], error: error.message };
  const rows = (data || []) as Record<string, unknown>[];
  return { data: rows, total: rows.length };
}

export type UserImportPayload = {
  ci: string;
  nombres_completos: string;
  nombre_usuario: string;
  assigned_region?: string;
  assigned_distrito?: string;
  assigned_servicio?: string;
  fecha_nacimiento?: string;
};

export async function importUsersBatch(
  users: UserImportPayload[],
  opts?: { replace?: boolean }
): Promise<{ created: number; updated: number; skipped: number; errors: number; deactivated?: number; error?: string }> {
  if (USE_MRV_API) {
    const { data, error } = await backend.apiPost<{
      created: number;
      updated: number;
      skipped: number;
      errors: number;
      deactivated?: number;
    }>('/api/admin/users/import', { users, replace: Boolean(opts?.replace) });
    if (error) return { created: 0, updated: 0, skipped: 0, errors: users.length, error };
    return data || { created: 0, updated: 0, skipped: 0, errors: 0 };
  }
  const { data, error } = await supabase.functions.invoke('import-users', {
    body: JSON.stringify({ users, replace: Boolean(opts?.replace) }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (error) return { created: 0, updated: 0, skipped: 0, errors: users.length, error: error.message };
  const result = (data as { created?: number; updated?: number; skipped?: number; errors?: number; deactivated?: number }) || {};
  return {
    created: result.created || 0,
    updated: result.updated || 0,
    skipped: result.skipped || 0,
    errors: result.errors || 0,
    deactivated: result.deactivated,
  };
}
