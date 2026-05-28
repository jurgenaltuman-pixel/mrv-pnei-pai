import { useState, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '@/integrations/supabase/client';
import type { RegionSanitaria, Distrito, ServicioSalud, Barrio } from '@/types/mrv';
import { mrvAppCache } from '@/services/mrvAppCache';
import { fetchAllBarriosPaginated } from '@/lib/supabase-paginate';
import { USE_MRV_API, USE_SUPABASE_ORG, mrvApiFetch } from '@/lib/api-config';

const PAGE = 1000;

function applyOrgData(
  regionesData: RegionSanitaria[],
  distritosData: Distrito[],
  serviciosData: ServicioSalud[],
  barriosData: Barrio[]
) {
  const regionIdsConDistrito = new Set(distritosData.map((d) => d.region_id));
  const regionesValidas = regionesData.filter((r) => regionIdsConDistrito.has(r.id));
  return { regionesValidas, distritosData, serviciosData, barriosData };
}

async function fetchServiciosPaginated(): Promise<ServicioSalud[]> {
  const out: ServicioSalud[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('servicios_salud')
      .select('id, nombre, distrito_id')
      .order('nombre')
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn('servicios_salud:', error.message);
      break;
    }
    const chunk = (data || []) as ServicioSalud[];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export function useOrgStructure() {
  const [regiones, setRegiones] = useState<RegionSanitaria[]>([]);
  const [distritos, setDistritos] = useState<Distrito[]>([]);
  const [servicios, setServicios] = useState<ServicioSalud[]>([]);
  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void mrvAppCache.getOrgSnapshot().then((snap) => {
      if (cancelled || !snap?.distritos?.length) return;
      setRegiones((snap.regiones || []) as RegionSanitaria[]);
      setDistritos((snap.distritos || []) as Distrito[]);
      setServicios((snap.servicios || []) as ServicioSalud[]);
      setBarrios((snap.barrios || []) as Barrio[]);
      setLoading(false);
    });

    const loadRemote = async () => {
      if (USE_MRV_API && !USE_SUPABASE_ORG) {
        const { data, error } = await mrvApiFetch<{
          regiones: RegionSanitaria[];
          distritos: Distrito[];
          servicios: ServicioSalud[];
          barrios: Barrio[];
        }>('/api/org/structure');
        if (cancelled || error || !data) return;
        const barriosData = (data.barrios || []) as Barrio[];
        const { regionesValidas, distritosData, serviciosData } = applyOrgData(
          data.regiones || [],
          data.distritos || [],
          data.servicios || [],
          barriosData
        );
        setRegiones(regionesValidas);
        setDistritos(distritosData);
        setServicios(serviciosData);
        setBarrios(barriosData);
        setLoading(false);
        void mrvAppCache.saveOrgSnapshot({
          regiones: regionesValidas,
          distritos: distritosData,
          servicios: serviciosData,
          barrios: barriosData,
        });
        return;
      }
      if (!isSupabaseEnabled) {
        if (!cancelled) setLoading(false);
        return;
      }
      const [rRes, dRes, serviciosData, barriosData] = await Promise.all([
        supabase.from('regiones_sanitarias').select('id, nombre, codigo').order('nombre'),
        supabase.from('distritos').select('id, nombre, region_id').order('nombre'),
        fetchServiciosPaginated(),
        fetchAllBarriosPaginated(),
      ]);
      if (cancelled) return;
      const { regionesValidas, distritosData } = applyOrgData(
        (rRes.data || []) as RegionSanitaria[],
        (dRes.data || []) as Distrito[],
        serviciosData,
        barriosData
      );
      setRegiones(regionesValidas);
      setDistritos(distritosData);
      setServicios(serviciosData);
      setBarrios(barriosData);
      setLoading(false);
      void mrvAppCache.saveOrgSnapshot({
        regiones: regionesValidas,
        distritos: distritosData,
        servicios: serviciosData,
        barrios: barriosData,
      });
    };

    void loadRemote().catch(() => {
      if (!cancelled) setLoading(false);
    });

    const onOnline = () => void loadRemote();
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const getDistritosByRegion = (regionId: number) => distritos.filter((d) => d.region_id === regionId);
  const getServiciosByDistrito = (distritoId: number) => servicios.filter((s) => s.distrito_id === distritoId);
  const getBarriosByDistrito = (distritoId: number) =>
    barrios.filter((b) => Number(b.distrito_id) === Number(distritoId));

  return {
    regiones,
    distritos,
    servicios,
    barrios,
    loading,
    getDistritosByRegion,
    getServiciosByDistrito,
    getBarriosByDistrito,
  };
}
