import { useRef, useState } from 'react';
import { ImagePlus, Upload, ExternalLink, Loader2, Mic, User } from 'lucide-react';
import { resizeImageFileForUpload } from '@/lib/resize-image-for-upload';
import { uploadPersonSearchImages } from '@/services/personSearchAttachmentsApi';
import type { ClipNinoMeta, RegistroClipAdjuntos } from '@/lib/registro-clip-adjuntos';
import { useToast } from '@/hooks/use-toast';

const MAX_IMAGES = 2;

interface Props {
  meta: ClipNinoMeta;
  adjuntos: RegistroClipAdjuntos;
  onAdjuntosChange: (a: RegistroClipAdjuntos) => void;
  /** Varios resultados: elegir otro niño de la misma búsqueda */
  alternativas?: ClipNinoMeta[];
  onElegirAlternativa?: (m: ClipNinoMeta) => void;
  sinHistorialSpr?: boolean;
  /** Campo opcional independiente del formulario (no obligatorio). */
  opcional?: boolean;
}

export default function RegistroClipAdjuntosSection({
  meta,
  adjuntos,
  onAdjuntosChange,
  alternativas,
  onElegirAlternativa,
  sinHistorialSpr,
  opcional = true,
}: Props) {
  const { toast } = useToast();
  const [files, setFiles] = useState<(File | null)[]>([null, null]);
  const [uploading, setUploading] = useState(false);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const docRef = meta.documento.trim();
  const nombreRef = meta.nombre.trim();
  const puedeSubir = docRef.length >= 4 && nombreRef.length >= 2;

  const pickFile = (index: number, file: File | undefined) => {
    if (!file) return;
    setFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  };

  const subir = async () => {
    if (!puedeSubir) {
      toast({
        title: 'Datos del niño/a',
        description: 'Seleccioná un resultado o completá nombre y documento antes de subir.',
        variant: 'destructive',
      });
      return;
    }
    const selected = files.filter((f): f is File => Boolean(f));
    if (selected.length === 0) {
      toast({ title: 'Elegí al menos una imagen', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const images = await Promise.all(selected.map((f) => resizeImageFileForUpload(f)));
      const { urls, error } = await uploadPersonSearchImages({
        documento: docRef,
        tipoDocumento: meta.tipo,
        nombre: nombreRef,
        images,
      });
      if (error) {
        toast({ title: 'Error al subir', description: error, variant: 'destructive' });
        return;
      }
      onAdjuntosChange({
        ...adjuntos,
        enlace_imagen_1: urls[0] || adjuntos.enlace_imagen_1,
        enlace_imagen_2: urls[1] || adjuntos.enlace_imagen_2,
      });
      setFiles([null, null]);
      fileRefs.current.forEach((el) => {
        if (el) el.value = '';
      });
      toast({
        title: 'Guardado en Drive',
        description: `Enlaces asociados a ${meta.tipo} ${docRef}. Se guardan con el registro de la visita.`,
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo subir',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const activoKey = `${meta.tipo}:${meta.documento}`;

  return (
    <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/20 p-2.5 space-y-2">
      <p className="text-[11px] font-bold text-amber-900 dark:text-amber-100 flex items-center gap-1">
        <Mic className="w-3.5 h-3.5 shrink-0" />
        {opcional ? 'Adjuntos opcionales' : 'Clip de esta búsqueda'}
        <span className="font-normal text-[10px] opacity-80">
          {opcional ? ' (transcripción / fotos)' : ''}
          {sinHistorialSpr ? ' · sin historial SPR' : ''}
        </span>
      </p>

      {alternativas && alternativas.length > 1 && onElegirAlternativa && (
        <div className="flex flex-wrap gap-1">
          {alternativas.map((alt) => {
            const k = `${alt.tipo}:${alt.documento}`;
            const activo = k === activoKey;
            return (
              <button
                key={k}
                type="button"
                onClick={() => onElegirAlternativa(alt)}
                className={`max-w-full text-left text-[10px] px-2 py-1 rounded-md border transition-colors ${
                  activo
                    ? 'bg-[#0055A4] text-white border-[#0055A4]'
                    : 'bg-background hover:bg-accent'
                }`}
              >
                <span className="font-semibold block truncate">{alt.nombre || alt.documento}</span>
                <span className={activo ? 'text-white/90' : 'text-muted-foreground'}>
                  {alt.tipo} {alt.documento}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-foreground/90 flex items-start gap-1">
        <User className="w-3 h-3 shrink-0 mt-0.5" />
        <span>
          <span className="font-semibold">{nombreRef || '(sin nombre)'}</span>
          {' · '}
          <span className="font-mono">
            {meta.tipo} {docRef}
          </span>
        </span>
      </p>

      <textarea
        value={adjuntos.transcripcion_clip || ''}
        onChange={(e) =>
          onAdjuntosChange({ ...adjuntos, transcripcion_clip: e.target.value.slice(0, 2000) })
        }
        rows={2}
        className="w-full text-xs rounded-md border bg-background px-2 py-1.5 resize-y min-h-[2.5rem]"
        placeholder="Transcripción, nota de la búsqueda o contexto…"
      />
      <div className="grid grid-cols-2 gap-1.5">
        {[0, 1].map((i) => (
          <label
            key={i}
            className="flex flex-col gap-0.5 cursor-pointer rounded border bg-background p-1.5 text-[10px]"
          >
            <span className="font-medium text-muted-foreground">Foto {i + 1}</span>
            <input
              ref={(el) => {
                fileRefs.current[i] = el;
              }}
              type="file"
              accept="image/*"
              capture="environment"
              className="text-[10px]"
              onChange={(e) => pickFile(i, e.target.files?.[0])}
            />
            {files[i] && <span className="truncate text-primary">{files[i]!.name}</span>}
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={uploading || !puedeSubir}
        onClick={() => void subir()}
        className="h-8 w-full rounded-md bg-[#0055A4] text-white text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
        Subir fotos a Drive (máx. {MAX_IMAGES})
      </button>
      {(adjuntos.enlace_imagen_1 || adjuntos.enlace_imagen_2) && (
        <ul className="text-[10px] space-y-0.5 break-all">
          {adjuntos.enlace_imagen_1 && (
            <li>
              <a
                href={adjuntos.enlace_imagen_1}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-0.5"
              >
                Imagen 1 <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </li>
          )}
          {adjuntos.enlace_imagen_2 && (
            <li>
              <a
                href={adjuntos.enlace_imagen_2}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-0.5"
              >
                Imagen 2 <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </li>
          )}
        </ul>
      )}
      <p className="text-[9px] text-muted-foreground flex items-start gap-1">
        <ImagePlus className="w-3 h-3 shrink-0" />
        {opcional
          ? 'No es obligatorio. Si completás datos, se guardan con el registro y en el Excel del dashboard.'
          : 'Cada niño de la búsqueda tiene su propio clip. Al guardar la visita, va al registro y al Excel del dashboard.'}
      </p>
    </div>
  );
}
