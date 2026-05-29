/** Copia server/ → functions/server/ antes del deploy de Cloud Functions */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'server');
const dest = path.join(root, 'functions', 'server');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const sf = path.join(from, name);
    const df = path.join(to, name);
    if (fs.statSync(sf).isDirectory()) copyDir(sf, df);
    else fs.copyFileSync(sf, df);
  }
}

fs.rmSync(dest, { recursive: true, force: true });
copyDir(src, dest);
console.log('functions/server sincronizado desde server/');
