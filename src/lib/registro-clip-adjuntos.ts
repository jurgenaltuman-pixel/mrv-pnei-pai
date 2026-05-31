/** Transcripción/nota + hasta 2 imágenes en Drive (por registro MRV). */
export interface RegistroClipAdjuntos {
  transcripcion_clip?: string;
  enlace_imagen_1?: string;
  enlace_imagen_2?: string;
}

export const REGISTRO_CLIP_ADJUNTOS_VACIO: RegistroClipAdjuntos = {};

export type ClipNinoMeta = {
  tipo: string;
  documento: string;
  nombre: string;
};

/** Clave estable por niño (tipo + documento). */
export function clipStorageKey(tipo: string, documento: string): string {
  const t = (tipo || 'CI').trim().toUpperCase();
  const d = documento.trim().replace(/\s+/g, '');
  return `${t}:${d}`;
}

export function clipAdjuntosTienenDatos(a: RegistroClipAdjuntos | undefined): boolean {
  if (!a) return false;
  return Boolean(
    a.transcripcion_clip?.trim() ||
      a.enlace_imagen_1?.trim() ||
      a.enlace_imagen_2?.trim()
  );
}
