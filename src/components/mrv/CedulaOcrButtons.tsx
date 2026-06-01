import { useRef, useState, useEffect } from 'react';
import { Camera, Loader2, ScanLine, Images } from 'lucide-react';
import { preloadCedulaOcr, scanCedulaFromFile, type CedulaOcrProgress } from '@/lib/cedula-ocr';
import type { CedulaOcrFields, CedulaOcrTarget } from '@/lib/cedula-ocr-parse';

type Props = {
  disabled?: boolean;
  onResult: (target: CedulaOcrTarget, fields: CedulaOcrFields) => void;
  onError?: (message: string) => void;
};

export default function CedulaOcrButtons({ disabled, onResult, onError }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<CedulaOcrTarget>('nino');
  const [busy, setBusy] = useState<CedulaOcrTarget | null>(null);
  const [progress, setProgress] = useState<CedulaOcrProgress | null>(null);

  useEffect(() => {
    void preloadCedulaOcr().catch(() => {});
  }, []);

  const openPicker = (t: CedulaOcrTarget, source: 'camera' | 'gallery') => {
    if (disabled || busy) return;
    setTarget(t);
    if (source === 'camera') cameraRef.current?.click();
    else galleryRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(target);
    setProgress({ status: 'loading', progress: 0, message: 'Iniciando…' });
    try {
      const fields = await scanCedulaFromFile(file, target, setProgress);
      onResult(target, fields);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'No se pudo leer la cédula');
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-2.5 space-y-2">
      <p className="text-[11px] font-semibold text-primary flex items-center gap-1.5">
        <ScanLine className="w-3.5 h-3.5" />
        Leer cédula desde foto (offline)
      </p>
      <p className="text-[10px] text-muted-foreground">
        Opcional: sacá foto o elegí de galería. Funciona sin internet una vez instalada la app.
      </p>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Tomar foto de cédula"
        title="Tomar foto de cédula"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void onFile(f);
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Elegir foto de cédula"
        title="Elegir foto de cédula"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void onFile(f);
        }}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(['nino', 'madre'] as const).map((t) => (
          <div key={t} className="rounded-lg border bg-background p-2 space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground">
              {t === 'nino' ? 'CI niño/a' : 'CI madre'}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={disabled || Boolean(busy)}
                onClick={() => openPicker(t, 'camera')}
                className="h-8 rounded-md border border-primary/40 bg-primary/10 text-[11px] font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {busy === t ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                Cámara
              </button>
              <button
                type="button"
                disabled={disabled || Boolean(busy)}
                onClick={() => openPicker(t, 'gallery')}
                className="h-8 rounded-md border text-[11px] font-semibold inline-flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Images className="w-3.5 h-3.5" />
                Galería
              </button>
            </div>
          </div>
        ))}
      </div>
      {progress && (
        <p className="text-[10px] text-muted-foreground" role="status">
          {progress.message}
          {progress.progress > 0 && progress.progress < 1
            ? ` · ${Math.round(progress.progress * 100)}%`
            : ''}
        </p>
      )}
    </div>
  );
}
