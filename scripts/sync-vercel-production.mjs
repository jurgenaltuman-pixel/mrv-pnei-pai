#!/usr/bin/env node
/**
 * Sincroniza variables críticas de .env.local → Vercel production y redeploy.
 * Uso: node scripts/sync-vercel-production.mjs [--deploy]
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { loadEnv } from './lib/load-env.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);

const deploy = process.argv.includes('--deploy');
const force = process.argv.includes('--force');

const dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes('mrvpai2') && !force) {
  console.error(
    'DATABASE_URL apunta a mrvpai2 (solo padrón). Debe ser la operativa (21502). Corregí .env.local o usá --force.'
  );
  process.exit(1);
}

const keys = [
  'DATABASE_URL',
  'PADRON_DATABASE_URL',
  'PADRON_DEDICADO_URL',
  'JWT_SECRET',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

function mask(v) {
  return String(v || '').replace(/:([^@]+)@/, ':***@');
}

function vercel(args, input) {
  const r = spawnSync('npx', ['vercel', ...args], {
    cwd: root,
    input,
    encoding: 'utf8',
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return r;
}

console.log('Sincronizando → Vercel production…\n');
for (const name of keys) {
  const value = process.env[name];
  if (!value) {
    console.log(`⏭ ${name} (no en .env.local)`);
    continue;
  }
  vercel(['env', 'rm', name, 'production', '-y']);
  const add = vercel(['env', 'add', name, 'production', '--force'], value);
  if (add.status !== 0) {
    console.error(`✗ ${name}:`, (add.stderr || add.stdout || '').trim());
    process.exit(1);
  }
  console.log(`✓ ${name} →`, mask(value));
}

if (deploy) {
  console.log('\nDeploy production…');
  const d = spawnSync('npx', ['vercel', 'deploy', '--prod', '--yes'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  process.exit(d.status ?? 1);
}
console.log('\nListo. Ejecutá con --deploy para publicar: node scripts/sync-vercel-production.mjs --deploy');
