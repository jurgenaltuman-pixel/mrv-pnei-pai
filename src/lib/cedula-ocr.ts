import {
  hasUsefulCedulaData,
  normalizeOcrRawText,
  parseCedulaOcrText,
  type CedulaOcrFields,
  type CedulaOcrTarget,
} from '@/lib/cedula-ocr-parse';

let workerPromise: Promise<import('tesseract.js').Worker> | null = null;

function tesseractAsset(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path}`.replace(/([^:]\/)\/+/g, '$1');
}

async function getOcrWorker(): Promise<import('tesseract.js').Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import('tesseract.js');
      const worker = await createWorker('spa', 1, {
        workerPath: tesseractAsset('tesseract/worker.min.js'),
        langPath: tesseractAsset('tesseract'),
        corePath: tesseractAsset('tesseract/tesseract-core-lstm.wasm.js'),
        gzip: true,
        logger: () => {},
      });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: '1',
      });
      return worker;
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

function drawPreprocessed(ctx: CanvasRenderingContext2D, source: CanvasImageSource, w: number, h: number) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.filter = 'grayscale(1) contrast(1.55) brightness(1.08)';
  ctx.drawImage(source, 0, 0, w, h);
  ctx.filter = 'none';
}

async function canvasFromImageElement(file: File): Promise<HTMLCanvasElement> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
    fr.onload = () => resolve(String(fr.result || ''));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo cargar la imagen seleccionada'));
    image.src = dataUrl;
  });
  const maxSide = 3200;
  const scale = Math.min(2.5, maxSide / Math.max(img.width, img.height, 1));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  drawPreprocessed(ctx, img, w, h);
  return canvas;
}

async function preprocessImage(file: File): Promise<HTMLCanvasElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const maxSide = 3200;
      const scale = Math.min(2.5, maxSide / Math.max(bitmap.width, bitmap.height, 1));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawPreprocessed(ctx, bitmap, w, h);
        bitmap.close();
        return canvas;
      }
      bitmap.close();
    } catch {
      /* fallback */
    }
  }
  return canvasFromImageElement(file);
}

async function recognizeWithModes(
  worker: import('tesseract.js').Worker,
  canvas: HTMLCanvasElement,
  onProgress?: (p: CedulaOcrProgress) => void
): Promise<string> {
  const { PSM } = await import('tesseract.js');
  const modes = [PSM.AUTO, PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT] as const;
  const chunks: string[] = [];

  for (let i = 0; i < modes.length; i += 1) {
    onProgress?.({
      status: 'recognizing',
      progress: 0.2 + (i / modes.length) * 0.65,
      message: `Escaneando cédula (${i + 1}/${modes.length})…`,
    });
    await worker.setParameters({ tessedit_pageseg_mode: modes[i] });
    const { data } = await worker.recognize(canvas);
    const text = (data.text || '').trim();
    if (text.length > 20) chunks.push(text);
  }

  const merged = [...new Set(chunks)].join('\n');
  return normalizeOcrRawText(merged);
}

export type CedulaOcrProgress = {
  status: 'loading' | 'recognizing' | 'parsing' | 'done';
  progress: number;
  message: string;
};

/** OCR offline (Tesseract WASM). Optimizado para cédula paraguaya en APK. */
export async function scanCedulaFromFile(
  file: File | Blob,
  target: CedulaOcrTarget,
  onProgress?: (p: CedulaOcrProgress) => void
): Promise<CedulaOcrFields> {
  onProgress?.({ status: 'loading', progress: 0.05, message: 'Preparando escáner…' });
  const worker = await getOcrWorker();
  const asFile =
    file instanceof File ? file : new File([file], 'cedula.jpg', { type: 'image/jpeg' });
  const canvas = await preprocessImage(asFile);

  const rawMerged = await recognizeWithModes(worker, canvas, onProgress);

  onProgress?.({ status: 'parsing', progress: 0.92, message: 'Autocompletando datos…' });
  const parsed = parseCedulaOcrText(rawMerged, target);

  if (!rawMerged || rawMerged.replace(/\s/g, '').length < 12) {
    throw new Error(
      'No se leyó texto en la foto. Usá buena luz, encuadre la cédula completa y volvé a intentar.'
    );
  }

  if (!hasUsefulCedulaData(parsed, target)) {
    throw new Error(
      'No se detectaron datos claros de la cédula. Acercá la foto, evitá reflejos y reintentá.'
    );
  }

  onProgress?.({ status: 'done', progress: 1, message: 'Listo' });
  return parsed;
}

export async function preloadCedulaOcr(): Promise<void> {
  await getOcrWorker();
}
