#!/usr/bin/env node
/**
 * QA garantía funcional APK / web móvil (estático + artefactos post-build).
 * Ejecutar tras: npm run build
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist-vite');
const failures = [];
const MIN_TRAINED = 100_000;

function ok(msg) {
  console.log('  OK', msg);
}
function fail(msg) {
  console.log('  FAIL', msg);
  failures.push(msg);
}

function mustExist(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(label || filePath);
    return false;
  }
  ok(label || filePath);
  return true;
}

function mustContain(filePath, needle, label) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (!text.includes(needle)) {
    fail(label || `${filePath} debe contener ${needle}`);
    return false;
  }
  ok(label || needle);
  return true;
}

function fileMinSize(filePath, minBytes, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label}: archivo ausente`);
    return false;
  }
  const size = fs.statSync(filePath).size;
  if (size < minBytes) {
    fail(`${label}: ${size} bytes (mín. ${minBytes})`);
    return false;
  }
  ok(`${label} (${Math.round(size / 1024)} KB)`);
  return true;
}

console.log('\n=== QA APP MÓVIL (APK / PWA) ===\n');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
ok(`versión package.json ${pkg.version}`);

console.log('\n--- Contratos en código fuente ---');
mustContain(path.join(root, 'src/lib/cedula-ocr.ts'), 'canvasFromImageElement', 'OCR fallback canvas');
mustNotHaveWorkerFailed();

mustContain(
  path.join(root, 'src/components/mrv/RegistroClipAdjuntos.tsx'),
  'puedeGuardarClipDrive',
  'Drive usa helper de elegibilidad'
);
mustContain(
  path.join(root, 'src/components/mrv/RegistroClipAdjuntos.tsx'),
  "openPicker(i, 'camera')",
  'Drive botón cámara'
);
mustContain(
  path.join(root, 'src/components/mrv/CedulaOcrButtons.tsx'),
  "openPicker(t, 'gallery')",
  'OCR botón galería'
);

mustContain(path.join(root, 'src/service-worker.ts'), 'mrv-v38-web-offline', 'SW cache v38');
mustContain(path.join(root, 'src/service-worker.ts'), '/tesseract/spa.traineddata.gz', 'SW precache OCR');

console.log('\n--- Vitest (incl. app-mobile-guards) ---');
const testRun = spawnSync('npm', ['test', '--', '--run', 'src/test/app-mobile-guards.test.ts'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
if (testRun.status !== 0) fail('app-mobile-guards tests');
else ok('app-mobile-guards');

console.log('\n--- Build dist-vite (OCR embebido para Capacitor) ---');
if (!fs.existsSync(dist)) {
  fail('dist-vite ausente — ejecutá npm run build');
} else {
  mustExist(path.join(dist, 'index.html'), 'dist-vite/index.html');
  const tessDir = path.join(dist, 'tesseract');
  if (!fs.existsSync(tessDir)) {
    fail('dist-vite/tesseract/ — OCR no empaquetado en build');
  } else {
    ok('dist-vite/tesseract/');
    fileMinSize(path.join(tessDir, 'worker.min.js'), 50_000, 'worker.min.js');
    fileMinSize(path.join(tessDir, 'tesseract-core-lstm.wasm'), 1_000_000, 'tesseract WASM');
    fileMinSize(path.join(tessDir, 'spa.traineddata.gz'), MIN_TRAINED, 'spa.traineddata.gz');
  }

  const assetsDir = path.join(dist, 'assets');
  if (fs.existsSync(assetsDir)) {
    const appChunks = fs.readdirSync(assetsDir).filter((n) => n.startsWith('App-') && n.endsWith('.js'));
    if (appChunks.length === 1) {
      const appJs = fs.readFileSync(path.join(assetsDir, appChunks[0]), 'utf8');
      if (appJs.includes('scanCedulaFromFile') || appJs.includes('CedulaOcr') || appJs.includes('tesseract')) {
        ok('bundle App incluye OCR/adjuntos');
      } else {
        fail('bundle App sin referencias OCR/adjuntos detectables');
      }
    }
  }
}

console.log('\n--- Capacitor copy Android (assets embebidos en APK) ---');
const capCopy = spawnSync('npx', ['cap', 'copy', 'android'], {
  cwd: root,
  stdio: 'pipe',
  shell: true,
  encoding: 'utf8',
});
if (capCopy.status !== 0) {
  console.log(capCopy.stdout || capCopy.stderr);
  fail('npx cap copy android');
} else {
  ok('cap copy android');
  const androidPublic = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'public');
  const androidTess = path.join(androidPublic, 'tesseract');
  if (fs.existsSync(androidTess)) {
    fileMinSize(path.join(androidTess, 'spa.traineddata.gz'), MIN_TRAINED, 'APK asset spa.traineddata.gz');
    fileMinSize(path.join(androidTess, 'worker.min.js'), 50_000, 'APK asset worker.min.js');
  } else {
    fail('android/.../public/tesseract no copiado — OCR fallará offline en APK');
  }
}

console.log('\n--- PWA checks ---');
const pwa = spawnSync('node', ['scripts/qa-pwa-apk.mjs'], { cwd: root, stdio: 'inherit', shell: true });
if (pwa.status !== 0) fail('qa-pwa-apk');

console.log('\n=== Resumen QA APP ===');
if (failures.length) {
  console.log('\nFallos:', failures.join('\n  - '));
  process.exit(1);
}
console.log('\nQA APP OK — funcionalidad móvil verificada (estático + assets APK).');
console.log('Manual en dispositivo: CI cámara/galería, 2 fotos Drive guardar, OCR offline.');

function mustNotHaveWorkerFailed() {
  const src = fs.readFileSync(path.join(root, 'src/lib/cedula-ocr.ts'), 'utf8');
  if (src.includes('workerFailed') || src.includes('OCR no disponible en este dispositivo')) {
    fail('OCR no debe bloquearse permanentemente');
    return;
  }
  ok('OCR sin bloqueo permanente');
}
