import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Upload, ExternalLink, Loader2, CloudOff, Cloud, Camera, Images } from 'lucide-react';
import { resizeImageFileForUpload } from '@/lib/resize-image-for-upload';
import { uploadPersonSearchImages } from '@/services/personSearchAttachmentsApi';
import type { ClipNinoMeta, RegistroClipAdjuntos } from '@/lib/registro-clip-adjuntos';
import { clipStorageKey } from '@/lib/registro-clip-adjuntos';
import { isPendingDriveUrl, pendingDriveUrl } from '@/lib/pending-drive-url';
import { flushPendingDriveForClip, queueDriveImage } from '@/services/driveAdjuntosOfflineQueue';
import { useToast } from '@/hooks/use-toast';

const MAX_IMAGES = 2;

interface Props {
  meta: ClipNinoMeta;
  adjuntos: RegistroClipAdjuntos;
  onAdjuntosChange: (a: RegistroClipAdjuntos) => void;
  alternativas?: ClipNinoMeta[];
  onElegirAlternativa?: (m: ClipNinoMeta) => void;
  sinHistorialSpr?: boolean;
  opcional?: boolean;
  /** Solo fotos (sin transcripción). */
  soloFotos?: boolean;
  /** Dentro de un <details> colapsable (sin borde/título duplicado). */
  embedded?: boolean;
  isOnline?: boolean;
}

export default function RegistroClipAdjuntosSection({
  meta,
  adjuntos,
  onAdjuntosChange,
  alternativas,
  onElegirAlternativa,
  sinHistorialSpr,
  opcional = true,
  soloFotos = false,
  embedded = false,
  isOnline = true,
}: Props) {
  const { toast } = useToast();
  const [files, setFiles] = useState<(File | null)[]>([null, null]);
  const [uploading, setUploading] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const cameraRefs = useRef<(HTMLInputElement | null)[]>([]);
  const galleryRefs = useRef<(HTMLInputElement | null)[]>([]);

  const docRef = meta.documento.trim();
  const nombreRef = meta.nombre.trim();
  const clipKey = clipStorageKey(meta.tipo, docRef);
  const puedeSubir = docRef.length >= 4;

  const openPicker = (index: number, source: 'camera' | 'gallery') => {
    if (source === 'camera') cameraRefs.current[index]?.click();
    else galleryRefs.current[index]?.click();
  };

  const pickFile = (index: number, file: File | undefined) => {
    if (!file) return;
    setFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  };

  const subirOnline = async (
    images: { filename: string; mimeType: string; dataBase64: string }[]
  ) => {
    const { urls, error } = await uploadPersonSearchImages({
      documento: docRef,
      tipoDocumento: meta.tipo,
      nombre: nombreRef,
      images,
    });
    if (error) throw new Error(error);
    return urls;
  };

  const subir = async () => {
    if (!puedeSubir) {
      toast({
        title: 'Datos del niño/a',
        description: 'Completá nombre (mín. 2 letras) y documento (mín. 4 caracteres) antes de subir.',
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
      let enlace1 = adjuntos.enlace_imagen_1;
      let enlace2 = adjuntos.enlace_imagen_2;

      if (isOnline) {
        const urls = await subirOnline(images);
        if (urls[0]) enlace1 = urls[0];
        if (urls[1]) enlace2 = urls[1] || enlace2;
        toast({
          title: 'Guardado en Drive',
          description: `Imágenes asociadas a ${meta.tipo} ${docRef}.`,
        });
      } else {
        const slots: ('enlace_imagen_1' | 'enlace_imagen_2')[] = ['enlace_imagen_1', 'enlace_imagen_2'];
        let slotIdx = 0;
        if (enlace1 && !isPendingDriveUrl(enlace1)) slotIdx = 1;
        for (let i = 0; i < images.length && slotIdx < slots.length; i += 1) {
          if (slots[slotIdx] === 'enlace_imagen_2' && enlace2 && !isPendingDriveUrl(enlace2)) break;
          const id = await queueDriveImage({
            clipKey,
            documento: docRef,
            tipoDocumento: meta.tipo,
            nombre: nombreRef,
            image: images[i],
          });
          if (slots[slotIdx] === 'enlace_imagen_1') enlace1 = pendingDriveUrl(id);
          else enlace2 = pendingDriveUrl(id);
          slotIdx += 1;
        }
        toast({
          title: 'Guardado en el dispositivo',
          description: 'Sin conexión: las fotos se subirán a Drive al reconectar.',
        });
      }

      onAdjuntosChange({
        ...adjuntos,
        enlace_imagen_1: enlace1,
        enlace_imagen_2: enlace2,
      });
      setFiles([null, null]);
      [...cameraRefs.current, ...galleryRefs.current].forEach((el) => {
        if (el) el.value = '';
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

  useEffect(() => {
    if (!isOnline || !puedeSubir) return;
    const hasPending =
      isPendingDriveUrl(adjuntos.enlace_imagen_1) || isPendingDriveUrl(adjuntos.enlace_imagen_2);
    if (!hasPending) return;

    let cancelled = false;
    setFlushing(true);
    void flushPendingDriveForClip(clipKey, adjuntos)
      .then((resolved) => {
        if (cancelled) return;
        if (
          resolved.enlace_imagen_1 !== adjuntos.enlace_imagen_1 ||
          resolved.enlace_imagen_2 !== adjuntos.enlace_imagen_2
        ) {
          onAdjuntosChange({ ...adjuntos, ...resolved });
          toast({
            title: 'Fotos subidas a Drive',
            description: 'Se sincronizaron las imágenes guardadas sin conexión.',
          });
        }
      })
      .catch(() => {
        /* reintenta al próximo online */
      })
      .finally(() => {
        if (!cancelled) setFlushing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOnline, clipKey, puedeSubir]); // eslint-disable-line react-hooks/exhaustive-deps

  const activoKey = `${meta.tipo}:${meta.documento}`;
  const pendingCount = [adjuntos.enlace_imagen_1, adjuntos.enlace_imagen_2].filter((u) =>
    isPendingDriveUrl(u)
  ).length;

  return (
    <div
      className={
        embedded
          ? 'space-y-2.5'
          : 'rounded-lg border-2 border-[#0055A4]/25 bg-[#0055A4]/5 p-3 space-y-2.5'
      }
    >
      {!embedded && (
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-[#0055A4] flex items-center gap-1.5">
            <ImagePlus className="w-4 h-4 shrink-0" />
            Subir imágenes a Drive
            <span className="font-normal text-[11px] text-muted-foreground">(opcional · máx. {MAX_IMAGES})</span>
          </p>
          {!isOnline ? (
            <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
              <CloudOff className="w-3 h-3" /> Offline
            </span>
          ) : flushing ? (
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Sincronizando…
            </span>
          ) : (
            <span className="text-[10px] text-emerald-700 inline-flex items-center gap-1 shrink-0">
              <Cloud className="w-3 h-3" /> Online
            </span>
          )}
        </div>
      )}
      {embedded && (
        <div className="flex justify-end">
          {!isOnline ? (
            <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
              <CloudOff className="w-3 h-3" /> Offline
            </span>
          ) : flushing ? (
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Sincronizando…
            </span>
          ) : (
            <span className="text-[10px] text-emerald-700 inline-flex items-center gap-1">
              <Cloud className="w-3 h-3" /> Online
            </span>
          )}
        </div>
      )}

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

      <p className="text-[10px] text-foreground/90">
        <span className="font-semibold">{nombreRef || '(completá el nombre)'}</span>
        {' · '}
        <span className="font-mono">{meta.tipo} {docRef || '…'}</span>
      </p>

      {!soloFotos && (
        <textarea
          value={adjuntos.transcripcion_clip || ''}
          onChange={(e) =>
            onAdjuntosChange({ ...adjuntos, transcripcion_clip: e.target.value.slice(0, 2000) })
          }
          rows={2}
          className="w-full text-xs rounded-md border bg-background px-2 py-1.5 resize-y min-h-[2.5rem]"
          placeholder="Transcripción o nota (opcional)…"
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border bg-background p-2 space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground">Imagen {i + 1}</p>
            <input
              ref={(el) => {
                cameraRefs.current[i] = el;
              }}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              aria-label={`Tomar foto ${i + 1}`}
              title={`Tomar foto ${i + 1}`}
              onChange={(e) => pickFile(i, e.target.files?.[0])}
            />
            <input
              ref={(el) => {
                galleryRefs.current[i] = el;
              }}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label={`Elegir imagen ${i + 1}`}
              title={`Elegir imagen ${i + 1}`}
              onChange={(e) => pickFile(i, e.target.files?.[0])}
            />
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => openPicker(i, 'camera')}
                className="h-8 rounded-md border border-[#0055A4]/35 bg-[#0055A4]/5 text-[11px] font-bold text-[#0055A4] inline-flex items-center justify-center gap-1 active:scale-[0.98]"
              >
                <Camera className="w-3.5 h-3.5" />
                Cámara
              </button>
              <button
                type="button"
                onClick={() => openPicker(i, 'gallery')}
                className="h-8 rounded-md border text-[11px] font-semibold inline-flex items-center justify-center gap-1 active:scale-[0.98]"
              >
                <Images className="w-3.5 h-3.5" />
                Galería
              </button>
            </div>
            <input
              value={files[i]?.name || ''}
              readOnly
              className="w-full h-8 px-2 rounded-md border bg-muted/40 text-[10px] text-foreground/80"
              placeholder="Sin archivo"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={uploading || flushing || !puedeSubir}
        onClick={() => void subir()}
        className="h-9 w-full rounded-lg bg-[#0055A4] text-white text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {isOnline ? 'Subir imágenes a Drive' : 'Guardar imágenes (subir al reconectar)'}
      </button>
      {!puedeSubir && (
        <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
          Completá el <strong>documento</strong> (mín. 4 caracteres) del niño/a para habilitar el guardado.
        </p>
      )}

      {(adjuntos.enlace_imagen_1 || adjuntos.enlace_imagen_2 || pendingCount > 0) && (
        <ul className="text-[11px] space-y-1 break-all">
          {adjuntos.enlace_imagen_1 && (
            <li>
              {isPendingDriveUrl(adjuntos.enlace_imagen_1) ? (
                <span className="text-amber-800 font-medium">Imagen 1 · pendiente de Drive (offline)</span>
              ) : (
                <a
                  href={adjuntos.enlace_imagen_1}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline inline-flex items-center gap-0.5"
                >
                  Imagen 1 en Drive <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </li>
          )}
          {adjuntos.enlace_imagen_2 && (
            <li>
              {isPendingDriveUrl(adjuntos.enlace_imagen_2) ? (
                <span className="text-amber-800 font-medium">Imagen 2 · pendiente de Drive (offline)</span>
              ) : (
                <a
                  href={adjuntos.enlace_imagen_2}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline inline-flex items-center gap-0.5"
                >
                  Imagen 2 en Drive <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </li>
          )}
        </ul>
      )}

      <p className="text-[10px] text-muted-foreground">
        {opcional
          ? 'Opcional. Las fotos se guardan con el registro de la visita. Funciona sin internet: se encolan y suben solas al volver la conexión.'
          : 'Las imágenes van al registro y al Excel del dashboard.'}
        {sinHistorialSpr ? ' · Sin historial SPR en padrón.' : ''}
      </p>
    </div>
  );
}
