import { mrvApiFetch, USE_MRV_API } from '@/lib/api-config';
import type { RondaHistorialItem } from '@/lib/jornada-storage';

export type RoundHistoryRow = RondaHistorialItem & {
  id: string;
  user_id: string;
  display_name?: string | null;
  email?: string | null;
  assigned_region?: string | null;
  assigned_distrito?: string | null;
  assigned_servicio?: string | null;
  round_local_id?: string | null;
  round_codigo?: string | null;
  barrio?: string | null;
  responsable?: string | null;
  entrevistador?: string | null;
  colaboradores?: string[];
};

export async function saveRoundHistoryToServer(payload: {
  roundLocalId: string;
  roundCodigo?: string;
  moduloLabel: string;
  region: string;
  distrito: string;
  servicio: string | null;
  barrio?: string;
  responsable?: string | null;
  entrevistador?: string | null;
  colaboradores?: string[];
  item: RondaHistorialItem;
}): Promise<void> {
  if (!USE_MRV_API) return;
  const { error } = await mrvApiFetch('/api/rounds/history', {
    method: 'POST',
    body: JSON.stringify({
      round_local_id: payload.roundLocalId,
      round_codigo: payload.roundCodigo || null,
      modulo_label: payload.moduloLabel,
      assigned_region: payload.region,
      assigned_distrito: payload.distrito,
      assigned_servicio: payload.servicio,
      barrio: payload.barrio || payload.moduloLabel,
      responsable: payload.responsable || null,
      entrevistador: payload.entrevistador || null,
      colaboradores: payload.colaboradores || [],
      efectivas: payload.item.efectivas,
      no_efectivas: payload.item.noEfectivas,
      fallidas: payload.item.fallidas,
      renuentes: payload.item.renuentes,
      total_ninos: payload.item.totalNinos,
      vacunados: payload.item.vacunados,
      visitadas: payload.item.visitadas,
      total_casas: payload.item.totalCasas,
      cobertura_vacunacion: payload.item.coberturaVacunacion,
      aprobado: payload.item.aprobado,
      completada_at: payload.item.completadaAt,
    }),
  });
  if (error) console.warn('round history sync:', error);
}

export async function fetchMyRoundHistory(): Promise<RoundHistoryRow[]> {
  if (!USE_MRV_API) return [];
  const { data, error } = await mrvApiFetch<{ data: RoundHistoryRow[] }>('/api/rounds/history');
  if (error || !data?.data) return [];
  return data.data;
}

export async function fetchAdminRoundHistory(filters?: {
  region?: string;
  distrito?: string;
  servicio?: string;
  responsable?: string;
  roundCodigo?: string;
  limit?: number;
}): Promise<RoundHistoryRow[]> {
  if (!USE_MRV_API) return [];
  const q = new URLSearchParams();
  q.set('limit', String(filters?.limit ?? 500));
  if (filters?.region) q.set('region', filters.region);
  if (filters?.distrito) q.set('distrito', filters.distrito);
  if (filters?.servicio) q.set('servicio', filters.servicio);
  if (filters?.responsable) q.set('responsable', filters.responsable);
  if (filters?.roundCodigo) q.set('round_codigo', filters.roundCodigo);
  const { data, error } = await mrvApiFetch<{ data: RoundHistoryRow[] }>(
    `/api/admin/rounds/history?${q.toString()}`
  );
  if (error || !data?.data) return [];
  return data.data;
}
