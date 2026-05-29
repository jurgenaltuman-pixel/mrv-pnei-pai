import { USE_MRV_API, mrvApiFetch } from '@/lib/api-config';
import { ensureRoundCodigo } from '@/lib/round-codigo';
import type { RoundMonitoring } from '@/types/round-monitoring';

export async function syncRoundDraftToServer(round: RoundMonitoring): Promise<string | null> {
  if (!USE_MRV_API) return null;
  const normalized = ensureRoundCodigo(round);
  const { error } = await mrvApiFetch<{ ok: boolean }>('/api/rounds/draft', {
    method: 'PUT',
    body: JSON.stringify({ round: normalized }),
  });
  return error || null;
}

export async function fetchRoundDraftsFromServer(): Promise<RoundMonitoring[]> {
  if (!USE_MRV_API) return [];
  const { data, error } = await mrvApiFetch<{ data: RoundMonitoring[] }>('/api/rounds/drafts');
  if (error || !data?.data) return [];
  return data.data.map((r) => ensureRoundCodigo(r));
}

export async function deleteRoundDraftOnServer(roundLocalId: string): Promise<void> {
  if (!USE_MRV_API) return;
  await mrvApiFetch(`/api/rounds/draft/${encodeURIComponent(roundLocalId)}`, { method: 'DELETE' });
}
