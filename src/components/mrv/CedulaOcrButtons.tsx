import { useRef, useState, useEffect } from 'react';
import { Camera, Loader2, ScanLine } from 'lucide-react';
import { preloadCedulaOcr, scanCedulaFromFile, type CedulaOcrProgress } from '@/lib/cedula-ocr';
import type { CedulaOcrFields, CedulaOcrTarget } from '@/lib/cedula-ocr-parse';

type Props = {
  disabled?: boolean;
  onResult: (target: CedulaOcrTarget, fields: CedulaOcrFields) => void;
  onError?: (message: string) => void;
};

export default function CedulaOcrButtons({ disabled, onResult, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<CedulaOcrTarget>('nino');
  const [busy, setBusy] = useState<CedulaOcrTarget | null>(null);
  const [progress, setProgress] = useState<CedulaOcrProgress | null>(null);

  useEffect(() => {
    void preloadCedulaOcr().catch(() => {});
  }, []);

  const openPicker = (t: CedulaOcrTarget) => {
    if (disabled || busy) return;
    setTarget(t);
    inputRef.current?.click();
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
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-primary flex items-center gap-1.5">
        <ScanLine className="w-3.5 h-3.5" />
        Leer cédula desde foto (offline)
      </p>
      <p className="text-[10px] text-muted-foreground">
        Opcional: sacá foto o elegí de galería. Funciona sin internet una vez instalada la app.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void onFile(f);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || Boolean(busy)}
          onClick={() => openPicker('nino')}
          className="h-9 px-3 rounded-lg border border-primary/40 bg-card text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy === 'nino' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          CI niño/a
        </button>
        <button
          type="button"
          disabled={disabled || Boolean(busy)}
          onClick={() => openPicker('madre')}
          className="h-9 px-3 rounded-lg border border-primary/40 bg-card text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy === 'madre' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          CI madre
        </button>
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
