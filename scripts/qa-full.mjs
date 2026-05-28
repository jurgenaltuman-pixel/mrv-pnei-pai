#!/usr/bin/env node
/**
 * QA local: tests + health BD + padrón + build.
 */
import { spawn } from 'child_process';
import { loadEnv } from './lib/load-env.mjs';
import { connectAivenWritable, createAivenClient } from './lib/pg-aiven.mjs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);

const failures = [];

function ok(msg) {
  console.log('  OK', msg);
}
function fail(msg, e) {
  console.log('  FAIL', msg, e?.message || e || '');
  failures.push(msg);
}

async function checkDb(label, url) {
  if (!url) {
    fail(`${label}: sin URL`);
    return;
  }
  const c = createAivenClient(url);
  try {
    await connectAivenWritable(c);
    await c.query('SELECT 1');
    ok(`${label} conecta`);
  } catch (e) {
    fail(`${label} conecta`, e);
  } finally {
    try {
      await c.end();
    } catch {
      /* ignore */
    }
  }
}

async function checkPadron() {
  const url = process.env.PADRON_DATABASE_URL || process.env.DATABASE_URL;
  const c = createAivenClient(url);
  try {
    await connectAivenWritable(c);
    const { rows } = await c.query(`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE sexo IN ('M','F'))::int AS con_sexo
      FROM base_personas
    `);
    const n = rows[0].total;
    if (n < 500_000) fail(`padrón filas (${n})`, new Error('esperado ~624799'));
    else ok(`padrón ${n.toLocaleString('es-PY')} filas, sexo ${rows[0].con_sexo}`);
    const { rows: muestra } = await c.query(
      `SELECT documento, sexo
       FROM base_personas
       WHERE sexo IN ('M','F')
       ORDER BY random()
       LIMIT 1`
    );
    if (muestra[0]?.documento && (muestra[0]?.sexo === 'M' || muestra[0]?.sexo === 'F')) {
      ok(`muestra padrón sexo válido (${muestra[0].documento}: ${muestra[0].sexo})`);
    } else {
      fail('muestra padrón sexo válido', new Error('sin fila con sexo M/F'));
    }
  } catch (e) {
    fail('padrón consulta', e);
  } finally {
    try {
      await c.end();
    } catch {
      /* ignore */
    }
  }
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: root, stdio: 'inherit', shell: true });
    p.on('close', (code) => resolve(code === 0));
  });
}

console.log('\n=== QA MRV ===\n');
await checkDb('PADRON_DATABASE_URL', process.env.PADRON_DATABASE_URL);
await checkDb('DATABASE_URL (app)', process.env.DATABASE_URL);
await checkPadron();

console.log('\n--- vitest ---');
if (!(await run('npm', ['test', '--', '--run']))) fail('vitest', new Error('tests fallaron'));

console.log('\n--- build ---');
if (!(await run('npm', ['run', 'build']))) fail('vite build', new Error('build falló'));

console.log('\n=== Resumen ===');
if (failures.length) {
  console.log('Fallos:', failures.join('; '));
  process.exit(1);
}
console.log('Todo OK (revisá BD si alguna instancia estaba caída).');
