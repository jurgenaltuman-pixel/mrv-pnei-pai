/**
 * Lectura de registros_vacunacion en Supabase (legacy) con service role.
 * Los brigadistas guardaron ahí antes/durante la migración a Aiven.
 */
import { createClient } from '@supabase/supabase-js';

let client = null;

function getClient() {
  if (client) return client;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

/** Normaliza fila Supabase → forma Aiven/API. */
export function mapSupabaseRegistroRow(row) {
  if (!row) return null;
  const estado =
    row.estado_vacuna ??
    row.estado_vacunacion ??
    (row.esquema_completo === true ? 'vacunado' : 'no_vacunado');
  return {
    ...row,
    estado_vacuna: estado === 'vacunado' ? 'vacunado' : 'no_vacunado',
    estado_vacunacion: estado === 'vacunado' ? 'vacunado' : 'no_vacunado',
  };
}

export async function fetchRegistrosFromSupabase(limit = 10000) {
  const sb = getClient();
  if (!sb) return { rows: [], available: false };

  const lim = Math.min(10000, Math.max(1, limit));
  const { data, error } = await sb
    .from('registros_vacunacion')
    .select('*')
    .order('fecha_hora', { ascending: false })
    .limit(lim);

  if (error) {
    console.warn('[supabaseRegistros]', error.message);
    return { rows: [], available: true, error: error.message };
  }

  return {
    rows: (data || []).map(mapSupabaseRegistroRow).filter(Boolean),
    available: true,
  };
}

export async function countRegistrosInSupabase() {
  const sb = getClient();
  if (!sb) return 0;
  const { count, error } = await sb
    .from('registros_vacunacion')
    .select('*', { count: 'exact', head: true });
  if (error) return 0;
  return count ?? 0;
}
