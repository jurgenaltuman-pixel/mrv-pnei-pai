/** Carga y preprocesa fotos de cédula para Tesseract (APK / web). */

export async function loadOrientedBitmap(file: File | Blob): Promise<ImageBitmap> {
  const blob = file instanceof File ? file : file;
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      /* WebView antiguo */
    }
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('No se pudo leer la imagen'));
    fr.onload = () => resolve(String(fr.result || ''));
    fr.readAsDataURL(blob);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    image.src = dataUrl;
  });
  return createImageBitmap(img);
}

function drawFiltered(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  w: number,
  h: number,
  mode: 'standard' | 'high' | 'sharp'
) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  if (mode === 'standard') {
    ctx.filter = 'grayscale(1) contrast(1.45) brightness(1.06)';
  } else if (mode === 'high') {
    ctx.filter = 'grayscale(1) contrast(1.85) brightness(1.12)';
  } else {
    ctx.filter = 'grayscale(1) contrast(1.6) brightness(1.05) saturate(0)';
  }
  ctx.drawImage(source, 0, 0, w, h);
  ctx.filter = 'none';
}

function bitmapToCanvas(bitmap: ImageBitmap, rotateDeg: 0 | 90): HTMLCanvasElement {
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const swap = rotateDeg === 90;
  const maxSide = 2800;
  const baseW = swap ? srcH : srcW;
  const baseH = swap ? srcW : srcH;
  const scale = Math.min(2.8, maxSide / Math.max(baseW, baseH, 1));
  const w = Math.max(1, Math.round(baseW * scale));
  const h = Math.max(1, Math.round(baseH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  if (rotateDeg === 90) {
    ctx.translate(w, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(bitmap, 0, 0, Math.round(srcW * scale), Math.round(srcH * scale));
  } else {
    ctx.drawImage(bitmap, 0, 0, w, h);
  }
  return canvas;
}

/** Varias versiones de la misma foto para maximizar lectura OCR. */
export function buildOcrVariantCanvases(bitmap: ImageBitmap): HTMLCanvasElement[] {
  const rotations: (0 | 90)[] = bitmap.width > bitmap.height * 1.15 ? [0, 90] : [0];
  const out: HTMLCanvasElement[] = [];
  for (const rot of rotations) {
    const base = bitmapToCanvas(bitmap, rot);
    for (const mode of ['standard', 'high', 'sharp'] as const) {
      const c = document.createElement('canvas');
      c.width = base.width;
      c.height = base.height;
      const ctx = c.getContext('2d');
      if (!ctx) continue;
      drawFiltered(ctx, base, c.width, c.height, mode);
      out.push(c);
    }
  }
  return out.length ? out : [bitmapToCanvas(bitmap, 0)];
}

export async function fileToOcrBitmap(file: File): Promise<ImageBitmap> {
  return loadOrientedBitmap(file);
}
