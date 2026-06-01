#!/usr/bin/env node
/** Copia WASM/worker de Tesseract y descarga spa.traineddata.gz para OCR offline. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'public', 'tesseract');

function copy(src, name) {
  const from = path.join(src, name);
  const to = path.join(dest, name);
  if (!fs.existsSync(from)) {
    console.warn(`⚠ Falta ${from}`);
    return false;
  }
  fs.copyFileSync(from, to);
  return true;
}

function download(url, outPath) {
  return (async () => {
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 100_000) {
      return false;
    }
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100_000) throw new Error(`Archivo demasiado pequeño (${buf.length} bytes)`);
    fs.writeFileSync(outPath, buf);
    return true;
  })();
}

fs.mkdirSync(dest, { recursive: true });

const tesseractDist = path.join(root, 'node_modules', 'tesseract.js', 'dist');
const coreDir = path.join(root, 'node_modules', 'tesseract.js-core');

const copies = [
  [tesseractDist, 'worker.min.js'],
  [coreDir, 'tesseract-core-lstm.wasm.js'],
  [coreDir, 'tesseract-core-lstm.wasm'],
];

for (const [dir, name] of copies) {
  if (copy(dir, name)) console.log(`✓ ${name}`);
}

const trainedUrl =
  'https://cdn.jsdelivr.net/npm/@tesseract.js-data/spa/4.0.0/spa.traineddata.gz';
const trainedOut = path.join(dest, 'spa.traineddata.gz');

try {
  const fresh = await download(trainedUrl, trainedOut);
  console.log(fresh ? '✓ spa.traineddata.gz descargado' : '✓ spa.traineddata.gz ya existe');
} catch (e) {
  if (!fs.existsSync(trainedOut) || fs.statSync(trainedOut).size < 100_000) {
    console.error('✗ No se pudo obtener spa.traineddata.gz:', e.message);
    process.exit(1);
  }
  console.warn('⚠ Reutilizando spa.traineddata.gz existente');
}

console.log(`\nOCR offline listo en public/tesseract/`);
