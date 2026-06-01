import {
  hasUsefulCedulaData,
  normalizeOcrRawText,
  parseCedulaOcrText,
  scoreCedulaParse,
  type CedulaOcrFields,
  type CedulaOcrTarget,
} from '@/lib/cedula-ocr-parse';
import { buildOcrVariantCanvases, fileToOcrBitmap } from '@/lib/cedula-ocr-preprocess';

let workerPromise: Promise<import('tesseract.js').Worker> | null = null;

function tesseractAsset(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const rel = `${base}${path}`.replace(/([^:]\/)\/+/g, '$1');
  if (typeof window !== 'undefined' && window.location?.href) {
    return new URL(rel, window.location.href).href;
  }
  return rel;
}

async function createOcrWorker(): Promise<import('tesseract.js').Worker> {
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
}

async function getOcrWorker(): Promise<import('tesseract.js').Worker> {
  if (!workerPromise) {
    workerPromise = createOcrWorker().catch((e) => {
      workerPromise = null;
      const msg = e instanceof Error ? e.message : String(e);
      if (/fetch|network|failed to load|wasm/i.test(msg)) {
        throw new Error(
          'No se pudo cargar el escáner offline. Cerrá la app, abrila de nuevo y esperá 10 s antes de escanear.'
        );
      }
      throw e;
    });
  }
  return workerPromise;
}

async function recognizeCanvas(
  worker: import('tesseract.js').Worker,
  canvas: HTMLCanvasElement,
  psm: number
): Promise<string> {
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const { data } = await worker.recognize(canvas);
  return normalizeOcrRawText((data.text || '').trim());
}

async function recognizeWithModes(
  worker: import('tesseract.js').Worker,
  canvas: HTMLCanvasElement
): Promise<string> {
  const { PSM } = await import('tesseract.js');
  const modes = [PSM.AUTO, PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT] as const;
  const chunks: string[] = [];

  for (const mode of modes) {
    const text = await recognizeCanvas(worker, canvas, mode);
    if (text.length > 12) chunks.push(text);
  }

  return normalizeOcrRawText([...new Set(chunks)].join('\n'));
}

export type CedulaOcrProgress = {
  status: 'loading' | 'recognizing' | 'parsing' | 'done';
  progress: number;
  message: string;
};

function mergeBestParse(
  current: CedulaOcrFields | null,
  next: CedulaOcrFields,
  target: CedulaOcrTarget
): CedulaOcrFields {
  if (!current) return next;
  const curScore = scoreCedulaParse(current, target);
  const nextScore = scoreCedulaParse(next, target);
  if (nextScore > curScore) return next;
  if (nextScore < curScore) return current;
  return {
    ...current,
    documento: current.documento || next.documento,
    documentoMadre: current.documentoMadre || next.documentoMadre,
    nombre: current.nombre || next.nombre,
    fechaNacimiento: current.fechaNacimiento || next.fechaNacimiento,
    sexo: current.sexo || next.sexo,
    rawText: current.rawText.length >= next.rawText.length ? current.rawText : next.rawText,
    warnings: [...new Set([...current.warnings, ...next.warnings])],
  };
}

/** OCR offline (Tesseract WASM). Varias pasadas + orientación EXIF. */
export async function scanCedulaFromFile(
  file: File | Blob,
  target: CedulaOcrTarget,
  onProgress?: (p: CedulaOcrProgress) => void
): Promise<CedulaOcrFields> {
  onProgress?.({ status: 'loading', progress: 0.05, message: 'Preparando escáner…' });

  const asFile =
    file instanceof File ? file : new File([file], 'cedula.jpg', { type: 'image/jpeg' });

  let worker: import('tesseract.js').Worker;
  try {
    worker = await getOcrWorker();
  } catch (firstErr) {
    workerPromise = null;
    try {
      worker = await getOcrWorker();
    } catch {
      throw firstErr;
    }
  }

  onProgress?.({ status: 'loading', progress: 0.12, message: 'Procesando foto…' });
  const bitmap = await fileToOcrBitmap(asFile);
  const canvases = buildOcrVariantCanvases(bitmap);
  bitmap.close();

  let best: CedulaOcrFields | null = null;
  let bestRawLen = 0;
  const total = canvases.length;

  for (let i = 0; i < canvases.length; i += 1) {
    onProgress?.({
      status: 'recognizing',
      progress: 0.15 + (i / total) * 0.72,
      message: `Leyendo cédula (${i + 1}/${total})…`,
    });
    const raw = await recognizeWithModes(worker, canvases[i]);
    if (raw.replace(/\s/g, '').length > bestRawLen) bestRawLen = raw.replace(/\s/g, '').length;
    const parsed = parseCedulaOcrText(raw, target);
    best = mergeBestParse(best, parsed, target);
    if (best && scoreCedulaParse(best, target) >= 12) break;
  }

  onProgress?.({ status: 'parsing', progress: 0.92, message: 'Autocompletando datos…' });

  if (!best || bestRawLen < 8) {
    throw new Error(
      'No se leyó texto en la foto. Buena luz, sin reflejos, encuadre la cédula completa y probá de nuevo (también desde galería).'
    );
  }

  if (!hasUsefulCedulaData(best, target)) {
    const partialScore = scoreCedulaParse(best, target);
    if (partialScore >= 4) {
      best.warnings.unshift(
        'Lectura parcial: revisá CI, nombre y fecha antes de guardar.'
      );
    } else {
      throw new Error(
        'No se detectaron datos claros. Acercá la foto, enfocá el frente de la cédula y reintentá.'
      );
    }
  }

  onProgress?.({ status: 'done', progress: 1, message: 'Listo' });
  return best;
}

export async function preloadCedulaOcr(): Promise<void> {
  await getOcrWorker();
}

export function resetCedulaOcrWorkerForTests(): void {
  workerPromise = null;
}
