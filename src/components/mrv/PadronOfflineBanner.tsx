import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, WifiOff, Wifi, Signal } from 'lucide-react';
import { isNativeApp } from '@/lib/capacitor-platform';
import {
  estimateOrgDownload,
  estimatePadronDownload,
  estimateTotalOfflineDownload,
  etaRemainingFromProgress,
  type OfflineNetworkKind,
} from '@/lib/padron-download-estimates';
import { clearStaleOfflineFlags, getOfflinePackStatus, type OfflinePackStatus } from '@/lib/offline-pack-status';
import { mrvPadronIndexed, type PadronDownloadProgress } from '@/services/mrvPadronIndexed';
import { mrvAppCache } from '@/services/mrvAppCache';
import { syncOrgStructureOffline, type OrgSyncResult } from '@/services/mrvOrgSync';
import { useToast } from '@/hooks/use-toast';

interface Props {
  isOnline: boolean;
}

type DownloadPhase = 'idle' | 'org' | 'padron';

/** Descarga masiva offline (nativa). Verifica IndexedDB; no confía en flags sueltos. */
export function PadronOfflineBanner({ isOnline }: Props) {
  const native = isNativeApp();
  const { toast } = useToast();
  const [pack, setPack] = useState<OfflinePackStatus | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [phase, setPhase] = useState<DownloadPhase>('idle');
  const [progress, setProgress] = useState<PadronDownloadProgress | null>(null);
  const [orgSync, setOrgSync] = useState<OrgSyncResult | null>(null);
  const [networkType, setNetworkType] = useState<string>('unknown');
  const padronStartedAtRef = useRef<number | null>(null);
  const autoResumeTried = useRef(false);

  const networkKind: OfflineNetworkKind =
    networkType === 'wifi' ? 'wifi' : networkType === 'cellular' ? 'cellular' : 'unknown';
  const orgEstimate = estimateOrgDownload(networkKind);
  const padronEstimate = estimatePadronDownload(networkKind);
  const totalEstimate = estimateTotalOfflineDownload(networkKind);

  const refresh = useCallback(async () => {
    clearStaleOfflineFlags();
    const status = await getOfflinePackStatus();
    setPack(status);
    return status;
  }, []);

  const runDownload = useCallback(
    async (opts?: { resume?: boolean; silent?: boolean }) => {
      if (!isOnline || downloading) return;
      setDownloading(true);
      setOrgSync(null);
      const current = await refresh();
      setProgress({
        imported: current.padronRows,
        total: current.padronExpected,
        page: 0,
        bytesApprox: 0,
        percent:
          current.padronExpected && current.padronRows
            ? Math.min(100, Math.round((current.padronRows / current.padronExpected) * 100))
            : null,
      });

      try {
        const orgReady = await mrvAppCache.isOrgReady();
        if (!orgReady) {
          setPhase('org');
          const org = await syncOrgStructureOffline();
          setOrgSync(org);
          window.dispatchEvent(new Event('mrv-org-updated'));
        }

        setPhase('padron');
        padronStartedAtRef.current = Date.now();
        const res = await mrvPadronIndexed.downloadFromServer((p) => setProgress(p), {
          resume: opts?.resume ?? current.padronPartial,
        });

        const after = await refresh();

        if (res.skipped && after.allReady) {
          if (!opts?.silent) {
            toast({
              title: 'Datos offline verificados',
              description: `${after.padronRows.toLocaleString('es-PY')} personas + unidad organizativa.`,
            });
          }
          return;
        }

        if (res.error || !after.allReady) {
          if (!opts?.silent) {
            toast({
              title: after.padronPartial ? 'Descarga pausada' : 'Descarga incompleta',
              description: res.error
                ? res.error
                : `${after.padronRows.toLocaleString('es-PY')}${
                    after.padronExpected
                      ? ` / ${after.padronExpected.toLocaleString('es-PY')}`
                      : ''
                  } personas. Tocá «Continuar» cuando tengas señal.`,
              variant: 'destructive',
            });
          }
        } else if (!opts?.silent) {
          toast({
            title: 'Datos offline listos',
            description: `${after.padronRows.toLocaleString('es-PY')} personas + estructura territorial.`,
          });
        }
        window.dispatchEvent(new Event('mrv-padron-updated'));
      } catch (e) {
        if (!opts?.silent) {
          toast({
            title: 'Error al descargar',
            description: e instanceof Error ? e.message : 'Error desconocido',
            variant: 'destructive',
          });
        }
      } finally {
        setDownloading(false);
        setPhase('idle');
        setProgress(null);
      }
    },
    [isOnline, downloading, refresh, toast]
  );

  useEffect(() => {
    if (!native) return;
    void refresh();
    const onUpd = () => void refresh();
    window.addEventListener('mrv-padron-updated', onUpd);
    window.addEventListener('mrv-org-updated', onUpd);
    return () => {
      window.removeEventListener('mrv-padron-updated', onUpd);
      window.removeEventListener('mrv-org-updated', onUpd);
    };
  }, [refresh, native]);

  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    void (async () => {
      try {
        const { Network } = await import('@capacitor/network');
        const s = await Network.getStatus();
        if (!cancelled) setNetworkType((s.connectionType || 'unknown').toLowerCase());
      } catch {
        if (!cancelled) setNetworkType('unknown');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [native]);

  /** Reanudar automáticamente descargas ya iniciadas (no arrancar una nueva sola). */
  useEffect(() => {
    if (!native || !isOnline || downloading || autoResumeTried.current || !pack) return;
    if (pack.allReady) return;
    const shouldAuto = pack.padronPartial || (pack.padronComplete && !pack.orgReady);
    if (!shouldAuto) return;
    autoResumeTried.current = true;
    void runDownload({ resume: pack.padronPartial, silent: true });
  }, [native, isOnline, downloading, pack, runDownload]);

  if (!native || !pack) return null;

  if (pack.allReady) return null;

  const hasPartial = pack.padronPartial;
  const needsOrg = !pack.orgReady;

  if (!isOnline) {
    return (
      <div className="mx-3 sm:mx-5 mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2 text-xs text-amber-950">
        <WifiOff className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="font-bold">Sin conexión</p>
          <p className="opacity-90 mt-0.5">
            {needsOrg && !hasPartial
              ? 'Falta descargar la unidad organizativa y el padrón. Conectate a internet.'
              : needsOrg
                ? `Padrón parcial (${pack.padronRows.toLocaleString('es-PY')} personas) pero falta la unidad organizativa offline. Conectate y continuá.`
                : hasPartial
                  ? `Padrón parcial: ${pack.padronRows.toLocaleString('es-PY')}${
                      pack.padronExpected
                        ? ` / ${pack.padronExpected.toLocaleString('es-PY')}`
                        : ''
                    }. Conectate para completar.`
                  : 'Conectate y descargá los datos offline.'}
          </p>
        </div>
      </div>
    );
  }

  const phaseLabel =
    phase === 'org'
      ? 'Descargando unidad organizativa…'
      : phase === 'padron'
        ? hasPartial
          ? 'Completando padrón local…'
          : 'Descargando padrón nominal…'
        : null;

  return (
    <div className="mx-3 sm:mx-5 mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-slate-800">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sky-950">
          {hasPartial || needsOrg ? 'Completar datos offline' : 'Trabajo sin conexión'}
        </p>
        <p className="mt-0.5 opacity-90">
          {needsOrg && !hasPartial && (
            <>Paso 1: unidad organizativa ({orgEstimate.label}). Paso 2: padrón ~831 mil.</>
          )}
          {needsOrg && hasPartial && (
            <>
              Unidad organizativa pendiente + padrón {pack.padronRows.toLocaleString('es-PY')}
              {pack.padronExpected ? ` / ${pack.padronExpected.toLocaleString('es-PY')}` : ''} en el teléfono.
            </>
          )}
          {!needsOrg && hasPartial && (
            <>
              Ya tenés {pack.padronRows.toLocaleString('es-PY')}
              {pack.padronExpected ? ` / ${pack.padronExpected.toLocaleString('es-PY')}` : ''} personas. Continuá
              solo lo que falta (no se borra lo descargado).
            </>
          )}
          {!needsOrg && !hasPartial && (
            <>
              Paso 1: unidad organizativa ({orgEstimate.label}). Paso 2: padrón nominal ({padronEstimate.typicalLabel},
              rango {padronEstimate.rangeLabel}). Total estimado: {totalEstimate}.
            </>
          )}
        </p>
        <p className="mt-1 text-[10px] flex items-center gap-1.5">
          {networkType === 'wifi' ? <Wifi className="w-3.5 h-3.5" /> : <Signal className="w-3.5 h-3.5" />}
          <span>
            {networkType === 'wifi'
              ? 'Wi-Fi: ideal para esta descarga (lotes grandes, sin pausa).'
              : 'Recomendado Wi-Fi; también funciona con datos móviles.'}
          </span>
        </p>
        {downloading && (
          <div className="mt-2 space-y-1.5" aria-live="polite">
            {phaseLabel && <p className="text-[10px] font-bold text-sky-900">{phaseLabel}</p>}
            {phase === 'padron' && progress && (
              <>
                <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-[10px] font-semibold text-sky-950">
                  <span>
                    {progress.total != null
                      ? `${progress.imported.toLocaleString('es-PY')} / ${progress.total.toLocaleString('es-PY')} personas`
                      : progress.imported > 0
                        ? `${progress.imported.toLocaleString('es-PY')} personas importadas`
                        : 'Contando filas en el servidor…'}
                  </span>
                  <span className="font-mono tabular-nums shrink-0">
                    {((progress.bytesApprox + (orgSync?.bytesApprox || 0)) / (1024 * 1024)).toFixed(2)} MB
                    {progress.percent != null ? ` · ${progress.percent}%` : ''}
                  </span>
                </div>
                <progress
                  className="w-full h-2 rounded overflow-hidden accent-[#0055A4]"
                  value={progress.percent != null ? progress.percent : undefined}
                  max={100}
                />
                <p className="text-[10px] text-sky-800/90">
                  Lote {progress.page}
                  {padronStartedAtRef.current != null &&
                    (() => {
                      const eta = etaRemainingFromProgress(
                        progress.imported,
                        progress.total,
                        padronStartedAtRef.current
                      );
                      return eta ? ` · tiempo restante ${eta}` : '';
                    })()}
                </p>
              </>
            )}
            {phase === 'org' && orgSync && (
              <p className="text-[10px] text-sky-800/90">
                {orgSync.regiones} regiones, {orgSync.distritos} distritos, {orgSync.barrios} barrios.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          disabled={downloading}
          onClick={() => void runDownload({ resume: hasPartial || needsOrg })}
          className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
        >
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {hasPartial || needsOrg ? 'Continuar descarga' : 'Descargar datos offline'}
        </button>
      </div>
    </div>
  );
}
