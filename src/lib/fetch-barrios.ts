import { mrvApiFetch, USE_MRV_API, USE_SUPABASE_ORG } from '@/lib/api-config';
import { canUseSupabaseCatalog } from '@/integrations/supabase/client';
import { fetchBarriosByDistritoId as fetchBarriosSupabase } from '@/lib/supabase-paginate';
import { mrvAppCache } from '@/services/mrvAppCache';
import type { Barrio } from '@/types/mrv';

export type BarrioOption = { id: number; nombre: string };

function normalizeBarrios(rows: { id: unknown; nombre: unknown; distrito_id?: unknown }[]): BarrioOption[] {
  return rows.map((r) => ({
    id: Number(r.id),
    nombre: String(r.nombre ?? '').trim(),
  })).filter((b) => b.id > 0 && b.nombre.length > 0);
}

async function barriosFromOrgCacheAsync(distritoId: number): Promise<BarrioOption[]> {
  const snap = await mrvAppCache.getOrgSnapshot();
  if (!snap?.barrios?.length) return [];
  const id = Number(distritoId);
  return (snap.barrios as Barrio[])
    .filter((b) => Number(b.distrito_id) === id)
    .map((b) => ({ id: Number(b.id), nombre: String(b.nombre) }));
}

/** Barrios del catálogo organizacional, solo del distrito indicado. */
export async function fetchBarriosForDistrito(distritoId: number): Promise<BarrioOption[]> {
  const id = Number(distritoId);
  if (!Number.isFinite(id) || id < 1) return [];

  // Con API MRV: el servidor lee Aiven y, si está vacío, Supabase (service role).
  if (USE_MRV_API) {
    const { data, error } = await mrvApiFetch<{ barrios: BarrioOption[] }>(
      `/api/org/barrios?distrito_id=${id}`
    );
    if (!error && data?.barrios?.length) {
      return normalizeBarrios(data.barrios);
    }
  }

  if (canUseSupabaseCatalog && USE_SUPABASE_ORG) {
    const rows = await fetchBarriosSupabase(id);
    if (rows.length > 0) return normalizeBarrios(rows);
  }

  const cached = await barriosFromOrgCacheAsync(id);
  if (cached.length > 0) return cached;

  return [];
}
