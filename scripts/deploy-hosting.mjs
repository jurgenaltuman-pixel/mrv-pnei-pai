#!/usr/bin/env node
/** Build con API de producción y deploy Firebase Hosting (evita localhost:8787 de .env.local). */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = 'https://rapid-vaccinator-main.vercel.app';

const env = {
  ...process.env,
  VITE_MRV_API_URL: api,
};

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true, env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log(`Build hosting con VITE_MRV_API_URL=${api}\n`);
run('npm', ['run', 'build']);
run('firebase', ['deploy', '--only', 'hosting:mrvpai']);
console.log('\n✓ Hosting desplegado → https://mrvpai.web.app');
