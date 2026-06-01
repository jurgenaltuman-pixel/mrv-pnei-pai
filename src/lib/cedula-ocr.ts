import { parseCedulaOcrText, type CedulaOcrFields, type CedulaOcrTarget } from '@/lib/cedula-ocr-parse';

let workerPromise: Promise<import('tesseract.js').Worker> | null = null;
let workerFailed = false;

function tesseractAsset(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path}`.replace(/([^:]\/)\/+/g, '$1');
}

async function getOcrWorker(): Promise<import('tesseract.js').Worker> {
  if (workerFailed) throw new Error('OCR no disponible en este dispositivo');
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
      });
      return worker;
    })().catch((e) => {
      workerFailed = true;
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

async function preprocessImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 2200;
  const scale = Math.min(2, maxSide / Math.max(bitmap.width, bitmap.height, 1));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.filter = 'grayscale(1) contrast(1.35) brightness(1.05)';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  return blob || file;
}

export type CedulaOcrProgress = {
  status: 'loading' | 'recognizing' | 'parsing' | 'done';
  progress: number;
  message: string;
};

/** OCR 100% offline (Tesseract WASM + spa embebido en /public/tesseract). */
export async function scanCedulaFromFile(
  file: File | Blob,
  target: CedulaOcrTarget,
  onProgress?: (p: CedulaOcrProgress) => void
): Promise<CedulaOcrFields> {
  onProgress?.({ status: 'loading', progress: 0.05, message: 'Preparando lectura offline…' });
  const worker = await getOcrWorker();
  onProgress?.({ status: 'recognizing', progress: 0.15, message: 'Leyendo cédula…' });
  const asFile =
    file instanceof File ? file : new File([file], 'cedula.jpg', { type: 'image/jpeg' });
  const image = await preprocessImage(asFile);
  const { data } = await worker.recognize(image);
  onProgress?.({ status: 'parsing', progress: 0.92, message: 'Extrayendo datos…' });
  const parsed = parseCedulaOcrText(data.text || '', target);
  onProgress?.({ status: 'done', progress: 1, message: 'Listo' });
  return parsed;
}

export async function preloadCedulaOcr(): Promise<void> {
  await getOcrWorker();
}
