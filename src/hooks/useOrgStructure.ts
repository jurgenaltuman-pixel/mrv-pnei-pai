import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RegionSanitaria, Distrito, ServicioSalud, Barrio } from '@/types/mrv';

export function useOrgStructure() {
  const [regiones, setRegiones] = useState<RegionSanitaria[]>([]);
  const [distritos, setDistritos] = useState<Distrito[]>([]);
  const [servicios, setServicios] = useState<ServicioSalud[]>([]);
  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('regiones_sanitarias').select('id, nombre, codigo').order('nombre'),
      supabase.from('distritos').select('id, nombre, region_id').order('nombre'),
      supabase.from('servicios_salud').select('id, nombre, distrito_id').order('nombre'),
      supabase.from('barrios').select('id, nombre, distrito_id').order('nombre'),
    ]).then(([rRes, dRes, sRes, bRes]) => {
      const regionesData = (rRes.data || []) as RegionSanitaria[];
      const distritosData = (dRes.data || []) as Distrito[];
      const serviciosData = (sRes.data || []) as ServicioSalud[];
      const barriosData = (bRes.data || []) as Barrio[];

      // Evita mostrar regiones huérfanas cuando la carga previa quedó mezclada.
      const regionIdsConDistrito = new Set(distritosData.map((d) => d.region_id));
      const regionesValidas = regionesData.filter((r) => regionIdsConDistrito.has(r.id));

      setRegiones(regionesValidas);
      setDistritos(distritosData);
      setServicios(serviciosData);
      setBarrios(barriosData);
      setLoading(false);
    });
  }, []);

  const getDistritosByRegion = (regionId: number) =>
    distritos.filter(d => d.region_id === regionId);

  const getServiciosByDistrito = (distritoId: number) =>
    servicios.filter(s => s.distrito_id === distritoId);

  const getBarriosByDistrito = (distritoId: number) =>
    barrios.filter((b) => b.distrito_id === distritoId);

  return { regiones, distritos, servicios, barrios, loading, getDistritosByRegion, getServiciosByDistrito, getBarriosByDistrito };
}
