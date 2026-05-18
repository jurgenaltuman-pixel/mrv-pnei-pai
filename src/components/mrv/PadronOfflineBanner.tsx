import { useCallback, useEffect, useState } from 'react';
import { Download, CheckCircle2, Loader2, X, WifiOff } from 'lucide-react';
import { mrvPadronIndexed, type PadronDownloadProgress } from '@/services/mrvPadronIndexed';
import { useToast } from '@/hooks/use-toast';

const DISMISS_KEY = 'mrv_padron_banner_dismissed';

interface Props {
  isOnline: boolean;
}

export function PadronOfflineBanner({ isOnline }: Props) {
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<PadronDownloadProgress | null>(null);

  const refresh = useCallback(() => {
    void mrvPadronIndexed.isReady().then(setReady);
  }, []);

  useEffect(() => {
    refresh();
    const onUpd = () => refresh();
    window.addEventListener('mrv-padron-updated', onUpd);
    return () => window.removeEventListener('mrv-padron-updated', onUpd);
  }, [refresh]);

  const handleDownload = async () => {
    if (!isOnline || downloading) return;
    setDownloading(true);
    setProgress({ imported: 0, total: null, page: 0, bytesApprox: 0, percent: null });
    try {
      const res = await mrvPadronIndexed.downloadFromServer((p) => setProgress(p));
      if (res.error) {
        toast({
          title: 'Descarga incompleta',
          description: res.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Padrón guardado en el dispositivo',
          description: `${res.imported.toLocaleString('es-PY')} personas listas para búsqueda sin conexión.`,
        });
      }
      window.dispatchEvent(new Event('mrv-padron-updated'));
      refresh();
    } catch (e) {
      toast({
        title: 'Error al descargar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
      setProgress(null);
    }
  };

  if (dismissed) return null;
  if (ready) {
    return (
      <div className="mx-3 sm:mx-5 mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2 text-xs text-emerald-950">
        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
        <span className="font-medium">Padrón local instalado: búsqueda de personas disponible sin señal.</span>
        <button
          type="button"
          className="ml-auto text-[10px] underline font-semibold opacity-80 hover:opacity-100"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1');
            setDismissed(true);
          }}
        >
          Ocultar
        </button>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="mx-3 sm:mx-5 mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2 text-xs text-amber-950">
        <WifiOff className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="font-bold">Sin conexión</p>
          <p className="opacity-90 mt-0.5">
            Si aún no descargaste el padrón con datos, la búsqueda de personas puede estar limitada. Conectate y usá
            «Descargar padrón nominal».
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-3 sm:mx-5 mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-slate-800">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sky-950">Trabajo sin conexión — padrón nominal</p>
        <p className="mt-0.5 opacity-90">
          Descargá las personas autorizadas en tu dispositivo para que la búsqueda por documento o datos personales
          funcione en terreno sin señal (requiere espacio libre y unos minutos con WiFi/datos).
        </p>
        {downloading && progress && (
          <div className="mt-2 space-y-1.5" aria-live="polite">
            <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-[10px] font-semibold text-sky-950">
              <span>
                {progress.total != null
                  ? `${progress.imported.toLocaleString('es-PY')} / ${progress.total.toLocaleString('es-PY')} personas`
                  : progress.imported > 0
                    ? `${progress.imported.toLocaleString('es-PY')} personas importadas`
                    : 'Contando filas en el servidor…'}
              </span>
              <span className="font-mono tabular-nums shrink-0">
                {(progress.bytesApprox / (1024 * 1024)).toFixed(2)} MB
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
              {progress.total == null && progress.imported > 0
                ? ' · sin conteo previo: barra indeterminada; confiá en filas y MB.'
                : ''}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          disabled={downloading}
          onClick={() => void handleDownload()}
          className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
        >
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Descargar padrón
        </button>
        <button
          type="button"
          className="p-2 rounded-lg border bg-white/80 text-muted-foreground hover:text-foreground"
          aria-label="Cerrar aviso"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1');
            setDismissed(true);
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
