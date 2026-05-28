import { supabase, isSupabaseEnabled } from '@/integrations/supabase/client';
import { USE_MRV_API, USE_SUPABASE_ORG, mrvApiFetch } from '@/lib/api-config';
import { mrvAppCache } from '@/services/mrvAppCache';
import { fetchAllBarriosPaginated } from '@/lib/supabase-paginate';
import type { Barrio, Distrito, RegionSanitaria, ServicioSalud } from '@/types/mrv';

const encoder = new TextEncoder();

async function fetchServiciosPaginated(pageSize = 1000): Promise<ServicioSalud[]> {
  const out: ServicioSalud[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('servicios_salud')
      .select('id, nombre, distrito_id')
      .order('nombre')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const chunk = (data || []) as ServicioSalud[];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function applyOrgData(
  regionesData: RegionSanitaria[],
  distritosData: Distrito[],
  serviciosData: ServicioSalud[],
  barriosData: Barrio[]
) {
  const regionIdsConDistrito = new Set(distritosData.map((d) => d.region_id));
  const regionesValidas = regionesData.filter((r) => regionIdsConDistrito.has(r.id));
  return { regiones: regionesValidas, distritos: distritosData, servicios: serviciosData, barrios: barriosData };
}

export interface OrgSyncResult {
  regiones: number;
  distritos: number;
  servicios: number;
  barrios: number;
  bytesApprox: number;
}

/** Descarga y guarda estructura territorial para uso offline. */
export async function syncOrgStructureOffline(): Promise<OrgSyncResult> {
  let regiones: RegionSanitaria[] = [];
  let distritos: Distrito[] = [];
  let servicios: ServicioSalud[] = [];
  let barrios: Barrio[] = [];

  if (USE_MRV_API && !USE_SUPABASE_ORG) {
    const { data, error } = await mrvApiFetch<{
      regiones: RegionSanitaria[];
      distritos: Distrito[];
      servicios: ServicioSalud[];
      barrios: Barrio[];
    }>('/api/org/structure');
    if (error || !data) throw new Error(error || 'No se pudo descargar la estructura territorial.');
    regiones = (data.regiones || []) as RegionSanitaria[];
    distritos = (data.distritos || []) as Distrito[];
    servicios = (data.servicios || []) as ServicioSalud[];
    barrios = (data.barrios || []) as Barrio[];
  } else {
    if (!isSupabaseEnabled) {
      throw new Error('Supabase no está habilitado para descargar la estructura territorial.');
    }
    const [rRes, dRes, serviciosData, barriosData] = await Promise.all([
      supabase.from('regiones_sanitarias').select('id, nombre, codigo').order('nombre'),
      supabase.from('distritos').select('id, nombre, region_id').order('nombre'),
      fetchServiciosPaginated(),
      fetchAllBarriosPaginated(),
    ]);
    if (rRes.error) throw new Error(rRes.error.message);
    if (dRes.error) throw new Error(dRes.error.message);
    regiones = (rRes.data || []) as RegionSanitaria[];
    distritos = (dRes.data || []) as Distrito[];
    servicios = serviciosData;
    barrios = barriosData;
  }

  const normalized = applyOrgData(regiones, distritos, servicios, barrios);
  await mrvAppCache.saveOrgSnapshot(normalized);
  const bytesApprox = encoder.encode(JSON.stringify(normalized)).length;
  return {
    regiones: normalized.regiones.length,
    distritos: normalized.distritos.length,
    servicios: normalized.servicios.length,
    barrios: normalized.barrios.length,
    bytesApprox,
  };
}
