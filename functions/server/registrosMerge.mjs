import { filterRowsByProfileScope } from './registroScope.mjs';
import { countRegistrosInSupabase, fetchRegistrosFromSupabase } from './supabaseRegistros.mjs';

/** Une Aiven + Supabase (sin duplicar id). */
export function mergeRegistroRows(aivenRows, supabaseRows) {
  const byId = new Map();
  for (const r of supabaseRows || []) {
    if (r?.id) byId.set(String(r.id), r);
  }
  for (const r of aivenRows || []) {
    if (r?.id) byId.set(String(r.id), r);
  }
  return [...byId.values()].sort((a, b) => {
    const ta = new Date(a.fecha_hora || 0).getTime();
    const tb = new Date(b.fecha_hora || 0).getTime();
    return tb - ta;
  });
}

/**
 * Lista registros para panel/admin: Aiven + legacy Supabase si hace falta.
 */
export async function listRegistrosMerged({ aivenRows, scope, limit, forceNational = false }) {
  const filteredAiven = filterRowsByProfileScope(aivenRows, scope, { forceNational });
  let merged = filteredAiven;

  const supaCount = await countRegistrosInSupabase();
  const shouldPullSupabase =
    supaCount > 0 && (filteredAiven.length === 0 || process.env.REGISTROS_MERGE_SUPABASE === 'true');

  if (shouldPullSupabase) {
    const { rows: supaRows } = await fetchRegistrosFromSupabase(Math.min(10000, limit * 2));
    const filteredSupa = filterRowsByProfileScope(supaRows, scope, { forceNational });
    merged = mergeRegistroRows(filteredAiven, filteredSupa);
  }

  return {
    data: merged.slice(0, limit),
    sources: {
      aiven: filteredAiven.length,
      supabase: shouldPullSupabase ? supaCount : 0,
      merged: merged.length,
    },
  };
}
