import { mrvAppCache } from '@/services/mrvAppCache';
import { mrvPadronIndexed } from '@/services/mrvPadronIndexed';

export type OfflinePackStatus = {
  orgReady: boolean;
  padronComplete: boolean;
  padronRows: number;
  padronExpected: number | null;
  padronPartial: boolean;
  allReady: boolean;
};

/** Estado real verificado en IndexedDB (no confiar en localStorage). */
export async function getOfflinePackStatus(): Promise<OfflinePackStatus> {
  const [org, meta, rows] = await Promise.all([
    mrvAppCache.getOrgSnapshot(),
    mrvPadronIndexed.getMeta(),
    mrvPadronIndexed.getLocalRowCount(),
  ]);
  const orgReady = Boolean(org?.distritos?.length && org?.regiones?.length);
  const padronExpected = meta?.expectedTotal ?? null;
  const padronComplete = Boolean(
    meta?.complete && rows > 0 && (padronExpected == null || rows >= padronExpected)
  );
  return {
    orgReady,
    padronComplete,
    padronRows: rows,
    padronExpected,
    padronPartial: rows > 0 && !padronComplete,
    allReady: orgReady && padronComplete,
  };
}

/** Limpia flags viejos que ocultaban el banner sin datos reales. */
export function clearStaleOfflineFlags(): void {
  try {
    localStorage.removeItem('mrv_padron_offline_complete');
    localStorage.removeItem('mrv_org_offline_done');
    localStorage.removeItem('mrv_padron_banner_dismissed');
  } catch {
    /* ignore */
  }
}
