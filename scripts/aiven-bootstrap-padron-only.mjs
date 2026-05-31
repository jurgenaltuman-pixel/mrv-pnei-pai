#!/usr/bin/env node
/** Esquema mínimo padrón en PADRON_DATABASE_URL (instancia dedicada). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from './lib/load-env.mjs';
import { connectAivenWritable, createAivenClient } from './lib/pg-aiven.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);

const url = process.env.PADRON_DATABASE_URL;
if (!url) {
  console.error('Falta PADRON_DATABASE_URL en .env.local (instancia dedicada padrón)');
  process.exit(1);
}

const client = createAivenClient(url);
await connectAivenWritable(client);

async function runFile(name) {
  const sql = fs.readFileSync(path.join(root, 'sql', name), 'utf8');
  console.log('Ejecutando', name, '…');
  await client.query(sql);
}

await runFile('AIVEN_PADRON_ONLY.sql');
await runFile('AIVEN_PADRON_SPR.sql');
await runFile('AIVEN_PADRON_RPC_ONLY.sql');
const { rows } = await client.query('SELECT count(*)::int AS n FROM base_personas');
console.log(`Listo. base_personas: ${rows[0].n} filas`);
await client.end();
