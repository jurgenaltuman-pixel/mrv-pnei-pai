#!/usr/bin/env node
/**
 * QA estático PWA + APK (sin emulador): manifest, SW, Capacitor, chunks críticos.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist-vite');
const failures = [];

function ok(msg) {
  console.log('  OK', msg);
}
function fail(msg) {
  console.log('  FAIL', msg);
  failures.push(msg);
}

function mustExist(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    fail(`falta ${rel}`);
    return false;
  }
  ok(rel);
  return true;
}

console.log('\n=== QA PWA / APK (estático) ===\n');

mustExist('capacitor.config.ts');
mustExist('android');
mustExist('.github/workflows/android.yml');
mustExist('public/manifest.json');
mustExist('index.html');

if (!fs.existsSync(dist)) {
  fail('dist-vite — ejecutá npm run build primero');
} else {
  ok('dist-vite/');
  for (const f of ['index.html', 'service-worker.js', 'manifest.json']) {
    const p = path.join(dist, f);
    if (fs.existsSync(p)) ok(`dist-vite/${f}`);
    else fail(`dist-vite/${f}`);
  }
  const tess = path.join(dist, 'tesseract', 'spa.traineddata.gz');
  if (fs.existsSync(tess) && fs.statSync(tess).size > 100_000) {
    ok('dist-vite/tesseract/spa.traineddata.gz');
  } else {
    fail('dist-vite/tesseract/spa.traineddata.gz inválido o ausente');
  }
  const assetsDir = path.join(dist, 'assets');
  if (fs.existsSync(assetsDir)) {
    const js = fs.readdirSync(assetsDir).filter((n) => n.startsWith('App-') && n.endsWith('.js'));
    if (js.length === 1) {
      const kb = Math.round(fs.statSync(path.join(assetsDir, js[0])).size / 1024);
      ok(`bundle App (~${kb} KB)`);
      if (kb > 1500) fail(`bundle App muy grande (${kb} KB) — revisar dependencias`);
    } else fail('chunk App-*.js');
  }
}

const cap = fs.readFileSync(path.join(root, 'capacitor.config.ts'), 'utf8');
if (cap.includes("webDir: 'dist-vite'") || cap.includes('webDir: "dist-vite"')) {
  ok('Capacitor webDir → dist-vite');
} else {
  fail('Capacitor webDir debe ser dist-vite');
}

const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (idx.includes('manifest') || idx.includes('theme-color')) ok('index.html PWA meta');
else fail('index.html sin meta PWA');

const viteCfg = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
if (viteCfg.includes('dist-vite')) ok('vite outDir dist-vite');

const swSrc = fs.readFileSync(path.join(root, 'src/service-worker.ts'), 'utf8');
if (swSrc.includes('mrv-v38-web-offline')) ok('service-worker cache v38');
else fail('service-worker debe usar cache mrv-v38-web-offline');

const appSrc = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
if (appSrc.includes('registerServiceWorker')) ok('App registra service worker (web)');
else fail('App.tsx debe registrar SW en web');

console.log('\n=== Resumen PWA/APK ===');
if (failures.length) {
  console.log('Fallos:', failures.join('; '));
  process.exit(1);
}
console.log('Checks estáticos OK. APK: validar artefacto en GitHub Actions tras push a main.');
