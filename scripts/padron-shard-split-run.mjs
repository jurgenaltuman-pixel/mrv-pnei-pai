#!/usr/bin/env node
/**
 * Reparte padrón 50/50: shard 0 → PADRON_DATABASE_URL, shard 1 → PADRON_DATABASE_URL_2.
 * Reintenta conexión hasta que Aiven responda.
 */
import { spawn } from 'child_process';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { loadEnv } from './lib/load-env.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);

const csv =
  process.argv.find((a) => a.endsWith('.csv')) ||
  path.join(process.env.USERPROFILE || '', 'Documents', 'Listado de niños para MRV.csv');
/** Shard 0: dedicada 1GB (11822). Shard 1: segunda instancia padrón (15143) si existe, si no operativa. */
const shard0Url = process.env.PADRON_DATABASE_URL;
const shard1Url =
  process.env.PADRON_DEDICADO_URL || process.env.PADRON_DATABASE_URL_2;
if (!shard1Url) {
  console.error(
    'Falta PADRON_DEDICADO_URL (o PADRON_DATABASE_URL_2) en .env.local — no usar DATABASE_URL operativa para shard 1.'
  );
  process.exit(1);
}
const maxWaitMin = Number(
  process.argv.find((a) => a.startsWith('--max-wait-min='))?.split('=')[1] || 45
);

function log(m) {
  console.log(`[${new Date().toLocaleTimeString('es-PY')}] ${m}`);
}

function pgClient(url) {
  return new pg.Client({
    connectionString: String(url).split('?')[0],
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
}

async function ping(url) {
  const c = pgClient(url);
  try {
    await c.connect();
    const { rows } = await c.query('SELECT count(*)::int n FROM base_personas').catch(() => ({
      rows: [{ n: -1 }],
    }));
    await c.end();
    return { ok: true, n: rows[0].n };
  } catch (e) {
    await c.end().catch(() => {});
    return { ok: false, err: e.code || e.message };
  }
}

async function waitFor(url, label) {
  const deadline = Date.now() + maxWaitMin * 60_000;
  let n = 0;
  while (Date.now() < deadline) {
    n += 1;
    const p = await ping(url);
    if (p.ok) {
      log(`${label} conecta (${p.n} filas)`);
      return p;
    }
    log(`${label} intento ${n}: ${p.err} — reintento en 15s…`);
    await new Promise((r) => setTimeout(r, 15_000));
  }
  throw new Error(`${label} no respondió en ${maxWaitMin} min`);
}

function runCopy(shard, url) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['scripts/import-padron-csv-copy.mjs', csv, `--shard=${shard}`, '--shards=2', `--url=${url}`],
      { cwd: root, stdio: 'inherit', env: { ...process.env, PADRON_DATABASE_URL: url } }
    );
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`shard ${shard} exit ${code}`))));
  });
}

async function truncatePadron(url, label) {
  const c = pgClient(url);
  await c.connect();
  await c.query("SET statement_timeout = '0'");
  log(`TRUNCATE base_personas (${label})…`);
  await c.query('DROP INDEX IF EXISTS idx_base_personas_nombre_trgm');
  await c.query('TRUNCATE base_personas RESTART IDENTITY CASCADE');
  const { rows } = await c.query('SELECT count(*)::int n FROM base_personas');
  await c.end();
  log(`${label}: ${rows[0].n} filas`);
}

async function ensureSchema(url, label) {
  const c = pgClient(url);
  await c.connect();
  const { rows } = await c.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = 'base_personas'`
  );
  if (!rows.length) {
    log(`Bootstrap esquema en ${label}…`);
    await c.end();
    await bootstrap(url);
    return;
  }
  await c.end();
}

function bootstrap(url) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/aiven-bootstrap-padron-only.mjs'], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, PADRON_DATABASE_URL: url },
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('bootstrap'))));
  });
}

async function importShard(shard, url, label) {
  await ensureSchema(url, label);
  await truncatePadron(url, label);
  log(`COPY shard ${shard} → ${label}…`);
  await runCopy(shard, url);
}

async function main() {
  if (!fs.existsSync(csv)) {
    throw new Error(`No existe CSV: ${csv}`);
  }
  log('CSV: ' + csv);
  log('Shard 0: ' + (shard0Url?.match(/@([^:/]+)/)?.[1] || '?'));
  log('Shard 1: ' + (shard1Url?.match(/@([^:/]+)/)?.[1] || '?'));

  await waitFor(shard1Url, 'Operativa (shard 1)');
  await importShard(1, shard1Url, 'operativa');

  const p0 = await ping(shard0Url);
  if (p0.ok) {
    await importShard(0, shard0Url, 'dedicada');
  } else {
    log(`Dedicada aún caída (${p0.err}). Reintentando 5 min…`);
    try {
      await waitFor(shard0Url, 'Dedicada (shard 0)');
      await importShard(0, shard0Url, 'dedicada');
    } catch {
      log('AVISO: solo shard 1 activo. Ampliá/reiniciá mrv-pai-mrvpai y ejecutá:');
      log(`  node scripts/import-padron-csv-copy.mjs "${csv}" --shard=0 --shards=2`);
    }
  }

  const c1 = await ping(shard1Url);
  const c0 = await ping(shard0Url);
  const total = (c1.ok ? c1.n : 0) + (c0.ok ? c0.n : 0);
  log(`FINAL shard1=${c1.ok ? c1.n : c1.err} shard0=${c0.ok ? c0.n : c0.err} total≈${total}`);
  if (c1.ok && c1.n < 300_000) throw new Error('Shard 1 incompleto');
  if (c0.ok && c0.n < 300_000) throw new Error('Shard 0 incompleto');
  if (c0.ok && c1.ok && total < 650_000) throw new Error(`Total bajo: ${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
