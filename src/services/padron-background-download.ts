/**
 * Descarga de padrón offline en segundo plano (APK).
 * Sigue aunque el usuario cambie de pantalla; reanuda al volver a la app.
 */
import { isNativeApp } from '@/lib/capacitor-platform';
import { clearStaleOfflineFlags, getOfflinePackStatus, type OfflinePackStatus } from '@/lib/offline-pack-status';
import { mrvAppCache } from '@/services/mrvAppCache';
import { mrvPadronIndexed, type PadronDownloadProgress } from '@/services/mrvPadronIndexed';
import { syncOrgStructureOffline, type OrgSyncResult } from '@/services/mrvOrgSync';

export type PadronBgPhase = 'idle' | 'org' | 'padron';

export type PadronBackgroundState = {
  active: boolean;
  phase: PadronBgPhase;
  progress: PadronDownloadProgress | null;
  orgSync: OrgSyncResult | null;
  pack: OfflinePackStatus | null;
  lastError: string | null;
};

type Listener = (state: PadronBackgroundState) => void;

const AUTO_START_KEY = 'mrv_padron_bg_autostart_v1';

let state: PadronBackgroundState = {
  active: false,
  phase: 'idle',
  progress: null,
  orgSync: null,
  pack: null,
  lastError: null,
};

const listeners = new Set<Listener>();
let runToken = 0;
let wakeLock: WakeLockSentinel | null = null;

function emit() {
  const snap = { ...state };
  listeners.forEach((fn) => fn(snap));
}

function setState(patch: Partial<PadronBackgroundState>) {
  state = { ...state, ...patch };
  emit();
}

async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock?.addEventListener('release', () => {
        wakeLock = null;
      });
    }
  } catch {
    /* ignore */
  }
}

function releaseWakeLock() {
  void wakeLock?.release();
  wakeLock = null;
}

export function subscribePadronBackgroundDownload(fn: Listener): () => void {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
}

export function getPadronBackgroundDownloadState(): PadronBackgroundState {
  return { ...state };
}

export async function refreshPadronBackgroundPack(): Promise<OfflinePackStatus> {
  clearStaleOfflineFlags();
  const pack = await getOfflinePackStatus();
  setState({ pack });
  return pack;
}

/** Inicia o reanuda descarga (idempotente si ya corre). */
export async function startPadronBackgroundDownload(opts?: {
  resume?: boolean;
  silent?: boolean;
  force?: boolean;
}): Promise<void> {
  if (!isNativeApp()) return;
  if (state.active) return;

  const token = ++runToken;
  setState({ active: true, phase: 'idle', lastError: null, progress: null, orgSync: null });

  await acquireWakeLock();

  try {
    const pack = await refreshPadronBackgroundPack();
    if (pack.allReady && !opts?.force) {
      return;
    }

    setState({
      progress: {
        imported: pack.padronRows,
        total: pack.padronExpected,
        page: 0,
        bytesApprox: 0,
        percent:
          pack.padronExpected && pack.padronRows
            ? Math.min(100, Math.round((pack.padronRows / pack.padronExpected) * 100))
            : null,
      },
    });

    const orgReady = await mrvAppCache.isOrgReady();
    if (!orgReady) {
      setState({ phase: 'org' });
      const org = await syncOrgStructureOffline();
      if (token !== runToken) return;
      setState({ orgSync: org });
      window.dispatchEvent(new Event('mrv-org-updated'));
    }

    setState({ phase: 'padron' });
    const res = await mrvPadronIndexed.downloadFromServer((p) => {
      if (token !== runToken) return;
      setState({ progress: p });
    }, {
      resume: opts?.resume ?? pack.padronPartial,
      force: opts?.force,
    });

    if (token !== runToken) return;

    const after = await refreshPadronBackgroundPack();
    if (res.error || !after.allReady) {
      setState({
        lastError:
          res.error ||
          `Incompleto: ${after.padronRows.toLocaleString('es-PY')}${
            after.padronExpected ? ` / ${after.padronExpected.toLocaleString('es-PY')}` : ''
          }`,
      });
    } else {
      setState({ lastError: null });
      try {
        localStorage.setItem(AUTO_START_KEY, 'done');
      } catch {
        /* ignore */
      }
    }
    window.dispatchEvent(new Event('mrv-padron-updated'));
  } catch (e) {
    if (token === runToken) {
      setState({
        lastError: e instanceof Error ? e.message : 'Error al descargar',
      });
    }
  } finally {
    if (token === runToken) {
      setState({ active: false, phase: 'idle' });
    }
    releaseWakeLock();
  }
}

/** Tras login / con Wi‑Fi: arranca en silencio si falta padrón u org. */
export async function maybeAutoStartPadronBackgroundDownload(isOnline: boolean): Promise<void> {
  if (!isNativeApp() || !isOnline || state.active) return;
  const pack = await refreshPadronBackgroundPack();
  if (pack.allReady) return;
  try {
    if (localStorage.getItem(AUTO_START_KEY) === 'done' && !pack.padronPartial && pack.orgReady) return;
  } catch {
    /* ignore */
  }
  const should =
    pack.padronPartial || !pack.orgReady || (!pack.padronComplete && pack.padronRows === 0);
  if (!should) return;
  void startPadronBackgroundDownload({ resume: pack.padronPartial, silent: true });
}

export function bindPadronBackgroundAppLifecycle(): () => void {
  if (!isNativeApp()) return () => {};

  let cancelled = false;
  const onVisible = () => {
    if (cancelled || document.visibilityState !== 'visible') return;
    void (async () => {
      const pack = await refreshPadronBackgroundPack();
      if (!pack.allReady && !state.active) {
        const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
        if (online) {
          void startPadronBackgroundDownload({ resume: pack.padronPartial, silent: true });
        }
      }
    })();
  };

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);

  return () => {
    cancelled = true;
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
  };
}
