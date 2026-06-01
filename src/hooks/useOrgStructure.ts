import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '@/integrations/supabase/client';
import type { RegionSanitaria, Distrito, ServicioSalud, Barrio } from '@/types/mrv';
import { mrvAppCache, type OrgStructureSnapshot } from '@/services/mrvAppCache';
import { fetchAllBarriosPaginated } from '@/lib/supabase-paginate';
import { USE_MRV_API, USE_SUPABASE_ORG, MRV_API_URL, getApiToken, mrvApiFetch } from '@/lib/api-config';
import { isNativeApp } from '@/lib/capacitor-platform';

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

function applySnapshot(
  snap: OrgStructureSnapshot,
  setRegiones: (v: RegionSanitaria[]) => void,
  setDistritos: (v: Distrito[]) => void,
  setServicios: (v: ServicioSalud[]) => void,
  setBarrios: (v: Barrio[]) => void
): boolean {
  if (!snap?.distritos?.length) return false;
  setRegiones((snap.regiones || []) as RegionSanitaria[]);
  setDistritos((snap.distritos || []) as Distrito[]);
  setServicios((snap.servicios || []) as ServicioSalud[]);
  setBarrios((snap.barrios || []) as Barrio[]);
  return true;
}

async function isNetworkAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined') return true;
  if (isNativeApp()) {
    try {
      const { Network } = await import('@capacitor/network');
      const s = await Network.getStatus();
      return s.connected;
    } catch {
      return navigator.onLine;
    }
  }
  return navigator.onLine;
}

export function useOrgStructure() {
  const [regiones, setRegiones] = useState<RegionSanitaria[]>([]);
  const [distritos, setDistritos] = useState<Distrito[]>([]);
  const [servicios, setServicios] = useState<ServicioSalud[]>([]);
  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFromCache = useCallback(async () => {
    const snap = await mrvAppCache.getOrgSnapshot();
    if (!snap) return false;
    const ok = applySnapshot(snap, setRegiones, setDistritos, setServicios, setBarrios);
    if (ok) setLoading(false);
    return ok;
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadFromCache();

    const loadRemote = async () => {
      if (!(await isNetworkAvailable())) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (USE_MRV_API && !USE_SUPABASE_ORG) {
        const base = MRV_API_URL;
        const token = getApiToken();
        const path = token ? '/api/org/structure' : '/api/public/org-structure';
        let payload: {
          regiones: RegionSanitaria[];
          distritos: Distrito[];
          servicios: ServicioSalud[];
          barrios: Barrio[];
        } | null = null;
        if (base) {
          const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
          const res = await fetch(`${base}${path}`, { headers });
          const body = (await res.json().catch(() => ({}))) as {
            regiones?: RegionSanitaria[];
            distritos?: Distrito[];
            servicios?: ServicioSalud[];
            barrios?: Barrio[];
            error?: string;
          };
          if (res.ok && body.regiones) payload = body as typeof payload;
          else if (!res.ok) console.warn('org-structure:', body.error || res.status);
        } else {
          const { data, error } = await mrvApiFetch<{
            regiones: RegionSanitaria[];
            distritos: Distrito[];
            servicios: ServicioSalud[];
            barrios: Barrio[];
          }>(path);
          if (!error && data) payload = data;
        }
        if (cancelled || !payload) return;
        const data = payload;
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
        await mrvAppCache.saveOrgSnapshot({
          regiones: regionesValidas,
          distritos: distritosData,
          servicios: serviciosData,
          barrios: barriosData,
        });
        window.dispatchEvent(new Event('mrv-org-updated'));
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
      await mrvAppCache.saveOrgSnapshot({
        regiones: regionesValidas,
        distritos: distritosData,
        servicios: serviciosData,
        barrios: barriosData,
      });
      window.dispatchEvent(new Event('mrv-org-updated'));
    };

    void loadRemote().catch(() => {
      if (!cancelled) setLoading(false);
    });

    const onOrgUpdated = () => void loadFromCache();
    const onOnline = () => void loadRemote();
    window.addEventListener('mrv-org-updated', onOrgUpdated);
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('mrv-org-updated', onOrgUpdated);
      window.removeEventListener('online', onOnline);
    };
  }, [loadFromCache]);

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
