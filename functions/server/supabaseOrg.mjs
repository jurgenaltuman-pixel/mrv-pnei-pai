/**
 * Catálogo organizacional en Supabase (regiones, distritos, barrios) vía service role.
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

const PAGE = 1000;

/** @returns {{ id: number, nombre: string, distrito_id: number }[]} */
export async function fetchBarriosByDistritoFromSupabase(distritoId) {
  const sb = getClient();
  if (!sb || !Number.isFinite(distritoId) || distritoId < 1) return [];

  const out = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('barrios')
      .select('id, nombre, distrito_id')
      .eq('distrito_id', distritoId)
      .order('nombre')
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn('[supabaseOrg] barrios:', error.message);
      break;
    }
    const chunk = data || [];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return out;
}
