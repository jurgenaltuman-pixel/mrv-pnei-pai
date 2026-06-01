import { describe, expect, it } from 'vitest';
import { puedeGuardarClipDrive } from '@/lib/clip-upload-eligibility';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('app mobile guards', () => {
  it('habilita guardado Drive con documento >= 4 (sin exigir nombre)', () => {
    expect(puedeGuardarClipDrive('1234')).toBe(true);
    expect(puedeGuardarClipDrive('  9876543  ')).toBe(true);
    expect(puedeGuardarClipDrive('123')).toBe(false);
    expect(puedeGuardarClipDrive('')).toBe(false);
  });

  it('OCR no bloquea permanentemente el worker tras un fallo', () => {
    const src = fs.readFileSync(path.join(root, 'src/lib/cedula-ocr.ts'), 'utf8');
    expect(src).not.toContain('workerFailed');
    expect(src).not.toContain('OCR no disponible en este dispositivo');
    expect(src).toContain('workerPromise = null');
    expect(src).toContain('fileToOcrBitmap');
  });

  it('adjuntos Drive exponen cámara y galería por imagen', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/components/mrv/RegistroClipAdjuntos.tsx'),
      'utf8'
    );
    expect(src).toContain('cameraRefs');
    expect(src).toContain('galleryRefs');
    expect(src).toContain("openPicker(i, 'camera')");
    expect(src).toContain("openPicker(i, 'gallery')");
    expect(src).toContain('puedeGuardarClipDrive');
  });

  it('OCR escáner solo en app nativa (ChildDataSection)', () => {
    const child = fs.readFileSync(path.join(root, 'src/components/mrv/ChildDataSection.tsx'), 'utf8');
    expect(child).toContain('isNativeApp()');
    expect(child).toContain('CedulaOcrButtons');
  });

  it('OCR APK: flujo escanear y autocompletar', () => {
    const src = fs.readFileSync(path.join(root, 'src/components/mrv/CedulaOcrButtons.tsx'), 'utf8');
    expect(src).toContain('Cámara');
    expect(src).toContain('Galería');
    expect(src).toContain('Autocompletar');
    expect(src).toContain('scanCedulaFromFile');
  });

  it('OCR multipaso y sin bloqueo permanente', () => {
    const src = fs.readFileSync(path.join(root, 'src/lib/cedula-ocr.ts'), 'utf8');
    expect(src).toContain('recognizeWithModes');
    expect(src).toContain('hasUsefulCedulaData');
    expect(src).toContain('buildOcrVariantCanvases');
  });

  it('service worker precachea assets Tesseract offline', () => {
    const sw = fs.readFileSync(path.join(root, 'src/service-worker.ts'), 'utf8');
    expect(sw).toContain('/tesseract/spa.traineddata.gz');
    expect(sw).toContain('mrv-v38-web-offline');
  });
});
