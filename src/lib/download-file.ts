import { isNativeApp } from '@/lib/capacitor-platform';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? '');
      const comma = raw.indexOf(',');
      resolve(comma >= 0 ? raw.slice(comma + 1) : raw);
    };
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(blob);
  });
}

/** Guarda un archivo en móvil nativo (compartir / Descargas) o dispara descarga en navegador. */
export async function saveBlobAsFile(filename: string, blob: Blob, mimeType?: string): Promise<void> {
  const safeName = filename.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 120) || 'archivo';

  if (isNativeApp()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const base64 = await blobToBase64(blob);
      const written = await Filesystem.writeFile({
        path: safeName,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      });
      await Share.share({
        title: safeName,
        url: written.uri,
        dialogTitle: 'Guardar o compartir archivo',
      });
      return;
    } catch (e) {
      console.warn('saveBlobAsFile native fallback', e);
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  if (mimeType) anchor.type = mimeType;
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 4000);
}

export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** Escala de captura de mapa: en móvil menos píxeles = menos cortes por memoria. */
export function mapCaptureScale(): number {
  return isMobileBrowser() || isNativeApp() ? 1.25 : 2;
}
