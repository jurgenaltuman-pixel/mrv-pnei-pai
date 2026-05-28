import { supabase } from '@/integrations/supabase/client';

const PAGE = 1000;

/** Todos los barrios de un distrito (sin límite de 1000 de Supabase). */
export async function fetchBarriosByDistritoId(distritoId: number): Promise<{ id: number; nombre: string }[]> {
  const out: { id: number; nombre: string }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('barrios')
      .select('id, nombre')
      .eq('distrito_id', distritoId)
      .order('nombre')
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn('fetchBarriosByDistritoId:', error.message);
      break;
    }
    const chunk = data || [];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

/** Todos los barrios del catálogo (paginado). */
export async function fetchAllBarriosPaginated(): Promise<{ id: number; nombre: string; distrito_id: number }[]> {
  const out: { id: number; nombre: string; distrito_id: number }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('barrios')
      .select('id, nombre, distrito_id')
      .order('nombre')
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn('fetchAllBarriosPaginated:', error.message);
      break;
    }
    const chunk = (data || []) as { id: number; nombre: string; distrito_id: number }[];
    out.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return out;
}
