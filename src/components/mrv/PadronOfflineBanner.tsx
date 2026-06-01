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
import { mrvPadronIndexed, type PadronDownloadProgress } from '@/services/mrvPadronIndexed';
import { syncOrgStructureOffline, type OrgSyncResult } from '@/services/mrvOrgSync';
import { useToast } from '@/hooks/use-toast';

const ORG_DONE_KEY = 'mrv_org_offline_done';
const PADRON_COMPLETE_KEY = 'mrv_padron_offline_complete';

interface Props {
  isOnline: boolean;
}

type DownloadPhase = 'idle' | 'org' | 'padron';

/** Descarga masiva offline (nativa). Si ya está completo, no molesta. */
export function PadronOfflineBanner({ isOnline }: Props) {
  const native = isNativeApp();
  const { toast } = useToast();
  const [complete, setComplete] = useState(false);
  const [localRows, setLocalRows] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [phase, setPhase] = useState<DownloadPhase>('idle');
  const [progress, setProgress] = useState<PadronDownloadProgress | null>(null);
  const [orgSync, setOrgSync] = useState<OrgSyncResult | null>(null);
  const [networkType, setNetworkType] = useState<string>('unknown');
  const padronStartedAtRef = useRef<number | null>(null);

  const networkKind: OfflineNetworkKind =
    networkType === 'wifi' ? 'wifi' : networkType === 'cellular' ? 'cellular' : 'unknown';
  const orgEstimate = estimateOrgDownload(networkKind);
  const padronEstimate = estimatePadronDownload(networkKind);
  const totalEstimate = estimateTotalOfflineDownload(networkKind);
  const hasPartial = localRows > 0 && !complete;

  const refresh = useCallback(async () => {
    const [ready, rows] = await Promise.all([
      mrvPadronIndexed.isReady(),
      mrvPadronIndexed.getLocalRowCount(),
    ]);
    setComplete(ready);
    setLocalRows(rows);
    if (ready) {
      localStorage.setItem(PADRON_COMPLETE_KEY, '1');
    }
  }, []);

  useEffect(() => {
    if (!native) return;
    void refresh();
    const onUpd = () => void refresh();
    window.addEventListener('mrv-padron-updated', onUpd);
    return () => window.removeEventListener('mrv-padron-updated', onUpd);
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

  if (!native) return null;

  /** Padrón completo: lee directo de IndexedDB, sin banner. */
  if (complete || localStorage.getItem(PADRON_COMPLETE_KEY) === '1') {
    return null;
  }

  const handleDownload = async () => {
    if (!isOnline || downloading) return;
    setDownloading(true);
    setOrgSync(null);
    setProgress({ imported: localRows, total: null, page: 0, bytesApprox: 0, percent: null });

    try {
      const orgAlready = localStorage.getItem(ORG_DONE_KEY) === '1';
      if (!orgAlready) {
        setPhase('org');
        const org = await syncOrgStructureOffline();
        setOrgSync(org);
        localStorage.setItem(ORG_DONE_KEY, '1');
      }

      setPhase('padron');
      padronStartedAtRef.current = Date.now();
      const res = await mrvPadronIndexed.downloadFromServer((p) => setProgress(p), {
        resume: hasPartial,
      });

      if (res.skipped) {
        await refresh();
        return;
      }

      if (res.error) {
        toast({
          title: hasPartial ? 'Descarga pausada' : 'Descarga incompleta',
          description: `${res.imported.toLocaleString('es-PY')} personas guardadas. Podés continuar cuando vuelva la señal.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Datos offline listos',
          description: `${res.imported.toLocaleString('es-PY')} personas + estructura territorial.`,
        });
        localStorage.setItem(PADRON_COMPLETE_KEY, '1');
      }
      window.dispatchEvent(new Event('mrv-padron-updated'));
      await refresh();
    } catch (e) {
      toast({
        title: 'Error al descargar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
      setPhase('idle');
      setProgress(null);
    }
  };

  if (!isOnline) {
    if (hasPartial) {
      return (
        <div className="mx-3 sm:mx-5 mt-2 rounded-xl border border-sky-200/80 bg-sky-50/90 px-3 py-2 text-xs text-sky-950">
          <p className="font-medium">
            Padrón parcial ({localRows.toLocaleString('es-PY')} personas): búsqueda limitada sin señal.
            Conectate para completar el resto.
          </p>
        </div>
      );
    }
    return (
      <div className="mx-3 sm:mx-5 mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2 text-xs text-amber-950">
        <WifiOff className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="font-bold">Sin conexión</p>
          <p className="opacity-90 mt-0.5">
            Conectate y descargá la unidad organizativa y el padrón nominal para trabajar offline.
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
          {hasPartial ? 'Completar descarga offline' : 'Trabajo sin conexión'}
        </p>
        <p className="mt-0.5 opacity-90">
          {hasPartial ? (
            <>
              Ya tenés {localRows.toLocaleString('es-PY')} personas en el teléfono. Tocá «Continuar» para bajar solo
              lo que falta (no se borra lo descargado).
            </>
          ) : (
            <>
              Paso 1: unidad organizativa ({orgEstimate.label}). Paso 2: padrón nominal ~831 mil (
              {padronEstimate.typicalLabel}, rango {padronEstimate.rangeLabel}). Total estimado: {totalEstimate}.
            </>
          )}
        </p>
        <p className="mt-1 text-[10px] flex items-center gap-1.5">
          {networkType === 'wifi' ? <Wifi className="w-3.5 h-3.5" /> : <Signal className="w-3.5 h-3.5" />}
          <span>
            {networkType === 'wifi'
              ? 'Wi-Fi: ideal para esta descarga.'
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
          onClick={() => void handleDownload()}
          className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
        >
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {hasPartial ? 'Continuar descarga' : 'Descargar datos offline'}
        </button>
      </div>
    </div>
  );
}
