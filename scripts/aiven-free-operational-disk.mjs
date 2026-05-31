#!/usr/bin/env node
/**
 * Libera disco en la BD operativa (21502): quita padrón duplicado y hace VACUUM.
 * El padrón oficial está en PADRON_DATABASE_URL + PADRON_DEDICADO_URL.
 *
 *   node scripts/aiven-free-operational-disk.mjs --confirm
 */
import { loadEnv } from './lib/load-env.mjs';
import { connectAivenWritable, createAivenClient } from './lib/pg-aiven.mjs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);

if (!process.argv.includes('--confirm')) {
  console.error('Uso: node scripts/aiven-free-operational-disk.mjs --confirm');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
const padron0 = process.env.PADRON_DATABASE_URL;
const padron1 = process.env.PADRON_DEDICADO_URL;
if (!url) {
  console.error('Falta DATABASE_URL');
  process.exit(1);
}

async function countPadron(u) {
  const c = createAivenClient(u);
  await c.connect();
  const { rows } = await c.query('SELECT count(*)::bigint AS n FROM base_personas');
  await c.end();
  return Number(rows[0].n);
}

const n0 = padron0 ? await countPadron(padron0) : 0;
const n1 = padron1 ? await countPadron(padron1) : 0;
const totalPadron = n0 + n1;
console.log(`Padrón en shards: ${n0} + ${n1} = ${totalPadron}`);
if (totalPadron < 700_000) {
  console.error('Los shards de padrón tienen pocas filas. No se borra el padrón de la operativa.');
  process.exit(1);
}

const client = createAivenClient(url);
await connectAivenWritable(client);

const { rows: before } = await client.query(
  `SELECT count(*)::bigint AS n,
          pg_size_pretty(pg_total_relation_size('base_personas'::regclass)) AS tam
   FROM base_personas`
);
console.log(`Operativa antes: ${before[0].n} filas, ${before[0].tam}`);

await client.query('TRUNCATE TABLE base_personas');
console.log('TRUNCATE base_personas OK');

await client.query('VACUUM FULL base_personas');
console.log('VACUUM FULL base_personas OK');

const { rows: sizes } = await client.query(`
  SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS tam
  FROM pg_catalog.pg_statio_user_tables
  ORDER BY pg_total_relation_size(relid) DESC LIMIT 5
`);
console.log('\nTop tablas tras limpieza:');
sizes.forEach((r) => console.log(`  ${r.relname}: ${r.tam}`));
await client.end();
console.log('\nListo. Login/usuarios intactos (profiles, auth_credentials).');
