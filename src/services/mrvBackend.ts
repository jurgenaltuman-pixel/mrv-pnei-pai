import { USE_MRV_API, mrvApiFetch } from '@/lib/api-config';

export async function apiGet<T>(path: string): Promise<{ data?: T; error?: string }> {
  if (!USE_MRV_API) return { error: 'API no activa' };
  const { data, error } = await mrvApiFetch<T>(path);
  return error ? { error } : { data };
}

export async function apiPost<T>(path: string, body?: unknown): Promise<{ data?: T; error?: string }> {
  if (!USE_MRV_API) return { error: 'API no activa' };
  const { data, error } = await mrvApiFetch<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  return error ? { error } : { data };
}

export async function apiPatch(path: string, body: unknown): Promise<{ error?: string }> {
  if (!USE_MRV_API) return { error: 'API no activa' };
  const { error } = await mrvApiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
  return error ? { error } : {};
}

export async function apiPut(path: string, body: unknown): Promise<{ error?: string }> {
  if (!USE_MRV_API) return { error: 'API no activa' };
  const { error } = await mrvApiFetch(path, { method: 'PUT', body: JSON.stringify(body) });
  return error ? { error } : {};
}

export async function apiDelete(path: string): Promise<{ error?: string }> {
  if (!USE_MRV_API) return { error: 'API no activa' };
  const { error } = await mrvApiFetch(path, { method: 'DELETE' });
  return error ? { error } : {};
}

/** Admin: perfiles + roles */
export async function fetchProfilesRoles() {
  return apiGet<{ profiles: unknown[]; roles: unknown[] }>('/api/admin/profiles-roles');
}

export async function updateMyScope(patch: {
  assigned_region: string;
  assigned_distrito: string;
  assigned_servicio?: string | null;
}) {
  return apiPatch('/api/profiles/scope', patch);
}

export async function updateProfile(userId: string, patch: Record<string, unknown>) {
  return apiPatch(`/api/admin/profiles/${userId}`, patch);
}

export async function setUserRole(userId: string, role: string) {
  return apiPut(`/api/admin/profiles/${userId}/role`, { role });
}

export async function resetUserPassword(userId: string, tempPassword = 'Cambio2026!') {
  return apiPost<{ password: string }>(`/api/admin/profiles/${userId}/reset-password`, { temp_password: tempPassword });
}

export async function deleteUser(userId: string) {
  return apiDelete(`/api/admin/users/${userId}`);
}

export async function fetchPendingApprovals() {
  return apiGet<{ data: unknown[] }>('/api/admin/pending-approvals');
}

export async function approveUser(userId: string) {
  return apiPost(`/api/admin/users/${userId}/approve`);
}

export async function rejectUser(userId: string) {
  return apiPost(`/api/admin/users/${userId}/reject`);
}

export async function createUser(payload: Record<string, unknown>) {
  return apiPost('/api/admin/users/create', payload);
}

export async function importOrgRows(rows: unknown[]) {
  return apiPost('/api/admin/org/import', { rows });
}

export async function importPadronBatch(rows: unknown[]) {
  return apiPost<{ inserted: number }>('/api/admin/padron/batch', { rows });
}

export async function clearPadron() {
  return apiDelete('/api/admin/padron/all');
}

export async function deleteRegistro(id: string) {
  return apiDelete(`/api/registros/${id}`);
}

export async function fetchAdminRegistros(limit = 10000, national = false) {
  const q = national ? '&national=1' : '';
  return apiGet<{
    data: Record<string, unknown>[];
    total?: number;
    nationalView?: boolean;
    totalAiven?: number;
    totalSupabase?: number;
    sources?: { aiven?: number; supabase?: number; merged?: number };
  }>(`/api/admin/registros?limit=${limit}${q}`);
}

export async function patchAdminRegistro(id: string, patch: Record<string, unknown>) {
  return apiPatch(`/api/admin/registros/${id}`, patch);
}

/** Actualizar registro propio (encuestador en ronda o corrección en campo). */
export async function patchRegistro(id: string, patch: Record<string, unknown>) {
  return apiPatch(`/api/registros/${id}`, patch);
}

export async function importAdminRegistros(rows: Record<string, unknown>[]) {
  return apiPost<{ ok: boolean; inserted: number; skipped: number; total: number }>(
    '/api/admin/registros/import',
    { rows }
  );
}

export async function queryPadron(body: Record<string, unknown>) {
  return apiPost<{ data: unknown[] }>('/api/padron/query', body);
}

export async function fetchPadronPage(offset: number, limit: number) {
  return apiGet<{ data: unknown[] }>(`/api/padron/page?offset=${offset}&limit=${limit}`);
}

export async function fetchPadronCount() {
  return apiGet<{ count: number }>('/api/padron/count');
}
