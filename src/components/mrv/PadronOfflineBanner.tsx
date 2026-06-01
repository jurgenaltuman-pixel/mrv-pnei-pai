import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Download, Loader2, WifiOff } from 'lucide-react';
import { isNativeApp } from '@/lib/capacitor-platform';
import {
  getPadronBackgroundDownloadState,
  maybeAutoStartPadronBackgroundDownload,
  refreshPadronBackgroundPack,
  startPadronBackgroundDownload,
  subscribePadronBackgroundDownload,
  type PadronBackgroundState,
} from '@/services/padron-background-download';
import { useToast } from '@/hooks/use-toast';

interface Props {
  isOnline: boolean;
}

/** APK: descarga offline en segundo plano + banner minimizable. */
export function PadronOfflineBanner({ isOnline }: Props) {
  const native = isNativeApp();
  const { toast } = useToast();
  const [bg, setBg] = useState<PadronBackgroundState>(() => getPadronBackgroundDownloadState());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!native) return;
    return subscribePadronBackgroundDownload(setBg);
  }, [native]);

  useEffect(() => {
    if (!native) return;
    void refreshPadronBackgroundPack();
    const onUpd = () => void refreshPadronBackgroundPack();
    window.addEventListener('mrv-padron-updated', onUpd);
    window.addEventListener('mrv-org-updated', onUpd);
    return () => {
      window.removeEventListener('mrv-padron-updated', onUpd);
      window.removeEventListener('mrv-org-updated', onUpd);
    };
  }, [native]);

  useEffect(() => {
    if (!native || !isOnline) return;
    void maybeAutoStartPadronBackgroundDownload(isOnline);
  }, [native, isOnline]);

  const start = useCallback(
    (resume: boolean) => {
      if (!isOnline || bg.active) return;
      void startPadronBackgroundDownload({ resume, silent: false }).then(() => {
        const s = getPadronBackgroundDownloadState();
        if (s.lastError) {
          toast({
            title: 'Descarga pausada',
            description: `${s.lastError}. Se reanuda sola al volver a la app con internet.`,
            variant: 'destructive',
          });
        } else if (!s.pack?.allReady) {
          toast({
            title: 'Descargando en segundo plano',
            description: 'Podés seguir usando la app. El progreso queda arriba.',
          });
        }
      });
    },
    [isOnline, bg.active, toast]
  );

  if (!native || !bg.pack) return null;
  if (bg.pack.allReady) return null;

  const hasPartial = bg.pack.padronPartial;
  const needsOrg = !bg.pack.orgReady;
  const p = bg.progress;
  const pct = p?.percent;

  if (!isOnline) {
    return (
      <div className="mx-3 sm:mx-5 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2 text-xs text-amber-950">
        <WifiOff className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="font-bold">Sin conexión</p>
          <p className="opacity-90 mt-0.5">
            {hasPartial
              ? `Padrón parcial (${bg.pack.padronRows.toLocaleString('es-PY')}). Conectate para completar en segundo plano.`
              : 'Conectate para descargar el padrón (sigue en segundo plano al minimizar).'}
          </p>
        </div>
      </div>
    );
  }

  if (bg.active && !expanded) {
    return (
      <div className="mx-3 sm:mx-5 mt-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-950">
        <button
          type="button"
          className="w-full flex items-center gap-2 text-left"
          onClick={() => setExpanded(true)}
        >
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
          <span className="flex-1 min-w-0 font-bold truncate">
            Descargando en segundo plano
            {p
              ? ` · ${p.imported.toLocaleString('es-PY')}${
                  p.total != null ? ` / ${p.total.toLocaleString('es-PY')}` : ''
                }${pct != null ? ` (${pct}%)` : ''}`
              : ''}
          </span>
          <ChevronDown className="w-4 h-4 shrink-0" />
        </button>
        {pct != null && (
          <progress className="w-full h-1.5 mt-1.5 rounded accent-[#0055A4]" value={pct} max={100} />
        )}
        <p className="text-[10px] mt-1 opacity-80">Podés seguir registrando visitas.</p>
      </div>
    );
  }

  return (
    <div className="mx-3 sm:mx-5 mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-slate-800">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sky-950">
            {bg.active ? 'Descarga en curso' : hasPartial || needsOrg ? 'Completar datos offline' : 'Datos para trabajar sin internet'}
          </p>
          <p className="mt-0.5 opacity-90">
            Por paquetes de 2.000 personas; se guarda en el teléfono y reanuda si se corta la red.
          </p>
        </div>
        {bg.active && (
          <button
            type="button"
            className="text-[10px] font-bold text-sky-800 shrink-0"
            onClick={() => setExpanded(false)}
          >
            Minimizar
          </button>
        )}
      </div>

      {bg.active && p && (
        <div className="mt-2 space-y-1" aria-live="polite">
          <div className="flex justify-between text-[10px] font-semibold">
            <span>
              {bg.phase === 'org'
                ? 'Unidad organizativa…'
                : p.total != null
                  ? `${p.imported.toLocaleString('es-PY')} / ${p.total.toLocaleString('es-PY')}`
                  : `${p.imported.toLocaleString('es-PY')} importadas`}
            </span>
            <span>{pct != null ? `${pct}%` : `Lote ${p.page}`}</span>
          </div>
          <progress
            className="w-full h-2 rounded accent-[#0055A4]"
            value={pct ?? undefined}
            max={100}
          />
        </div>
      )}

      {!bg.active && (
        <button
          type="button"
          disabled={bg.active}
          onClick={() => start(hasPartial || needsOrg)}
          className="mt-2 h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          {hasPartial || needsOrg ? 'Continuar en segundo plano' : 'Descargar en segundo plano'}
        </button>
      )}
    </div>
  );
}
