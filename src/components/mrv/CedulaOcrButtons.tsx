import { useRef, useState, useEffect } from 'react';
import { Camera, ImagePlus, Loader2, ScanLine, Check, RotateCcw } from 'lucide-react';
import { preloadCedulaOcr, scanCedulaFromFile, type CedulaOcrProgress } from '@/lib/cedula-ocr';
import type { CedulaOcrFields, CedulaOcrTarget } from '@/lib/cedula-ocr-parse';
import { formatFechaPy } from '@/lib/format-fecha';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

type Props = {
  disabled?: boolean;
  onResult: (target: CedulaOcrTarget, fields: CedulaOcrFields) => void;
  onError?: (message: string) => void;
};

export default function CedulaOcrButtons({ disabled, onResult, onError }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<CedulaOcrTarget>('nino');
  const [busy, setBusy] = useState(false);
  const [ocrReady, setOcrReady] = useState(false);
  const [progress, setProgress] = useState<CedulaOcrProgress | null>(null);
  const [preview, setPreview] = useState<{ fields: CedulaOcrFields; target: CedulaOcrTarget } | null>(
    null
  );
  const isOnline = useOnlineStatus();

  useEffect(() => {
    let cancelled = false;
    void preloadCedulaOcr()
      .then(() => {
        if (!cancelled) setOcrReady(true);
      })
      .catch(() => {
        if (!cancelled) setOcrReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scan = async (file: File | undefined) => {
    if (!file || busy) return;
    if (!ocrReady) {
      try {
        await preloadCedulaOcr();
        setOcrReady(true);
      } catch (e) {
        onError?.(
          e instanceof Error
            ? e.message
            : 'El escáner aún no está listo. Esperá unos segundos y volvé a intentar.'
        );
        return;
      }
    }
    setBusy(true);
    setPreview(null);
    setProgress({ status: 'loading', progress: 0, message: 'Abriendo escáner…' });
    try {
      const fields = await scanCedulaFromFile(file, target, setProgress);
      setPreview({ fields, target });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Revisá la foto e intentá de nuevo.';
      onError?.(msg);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const aplicarPreview = () => {
    if (!preview) return;
    onResult(preview.target, preview.fields);
    setPreview(null);
  };

  const labelTarget = (t: CedulaOcrTarget) => (t === 'nino' ? 'niño/a' : 'madre');

  const pick = (source: 'camera' | 'gallery') => {
    if (source === 'camera') cameraRef.current?.click();
    else galleryRef.current?.click();
  };

  return (
    <div className="rounded-lg border border-primary/25 bg-primary/5 p-2 space-y-2">
      <p className="text-[10px] font-bold text-primary flex items-center gap-1">
        <ScanLine className="w-3.5 h-3.5" />
        Escanear cédula (funciona sin internet)
      </p>
      <p className="text-[9px] text-muted-foreground leading-snug">
        {ocrReady
          ? 'Escáner listo. Foto nítida, sin reflejos, cédula completa en el cuadro.'
          : 'Cargando escáner… la primera vez puede tardar unos segundos.'}
        {isOnline ? ' Con datos también podés usar Buscar en padrón.' : ''}
      </p>

      <div className="flex gap-1">
        {(['nino', 'madre'] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={disabled || busy}
            onClick={() => setTarget(t)}
            className={`flex-1 h-7 rounded-md text-[10px] font-bold border ${
              target === t
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground'
            }`}
          >
            CI {labelTarget(t)}
          </button>
        ))}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Foto de cédula con cámara"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void scan(f);
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Elegir foto de cédula desde galería"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void scan(f);
        }}
      />

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => pick('camera')}
          className="h-9 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          Cámara
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => pick('gallery')}
          className="h-9 rounded-lg border border-primary/40 bg-background text-primary text-[10px] font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          Galería
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

      {preview && (
        <div className="rounded-md border bg-background p-2 space-y-1.5 text-[10px]">
          <p className="font-bold text-foreground">Datos detectados</p>
          {preview.target === 'nino' && preview.fields.documento && (
            <p>
              <span className="text-muted-foreground">CI:</span> {preview.fields.documento}
            </p>
          )}
          {preview.target === 'madre' && preview.fields.documentoMadre && (
            <p>
              <span className="text-muted-foreground">CI madre:</span> {preview.fields.documentoMadre}
            </p>
          )}
          {preview.fields.nombre && (
            <p>
              <span className="text-muted-foreground">Nombre:</span> {preview.fields.nombre}
            </p>
          )}
          {preview.fields.fechaNacimiento && (
            <p>
              <span className="text-muted-foreground">Nac.:</span>{' '}
              {formatFechaPy(preview.fields.fechaNacimiento)}
            </p>
          )}
          {preview.fields.sexo && (
            <p>
              <span className="text-muted-foreground">Sexo:</span> {preview.fields.sexo}
            </p>
          )}
          {preview.fields.warnings.length > 0 && (
            <p className="text-amber-800">{preview.fields.warnings[0]}</p>
          )}
          <div className="flex gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={aplicarPreview}
              className="flex-1 h-8 rounded-md bg-success text-success-foreground font-bold inline-flex items-center justify-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              Autocompletar
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="h-8 px-2 rounded-md border font-semibold inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
