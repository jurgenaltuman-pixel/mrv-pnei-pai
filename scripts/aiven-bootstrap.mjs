/**
 * Aplica esquema y RPC en PostgreSQL Aiven.
 * Requiere DATABASE_URL en .env (no commitear contraseñas).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from './lib/load-env.mjs';
import { connectAivenWritable, createAivenClient } from './lib/pg-aiven.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

loadEnv(root);
const urlFromArg = process.argv.find((a) => a.startsWith('--url='))?.split('=').slice(1).join('=');
const url = urlFromArg || process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL o --url= en .env');
  process.exit(1);
}
console.log('Bootstrap operativa →', url.replace(/:[^:@]+@/, ':****@'));

const client = createAivenClient(url);

async function runFile(name) {
  const sql = fs.readFileSync(path.join(root, 'sql', name), 'utf8');
  console.log('Ejecutando', name, '…');
  await client.query(sql);
}

await connectAivenWritable(client);
await runFile('AIVEN_SCHEMA.sql');
await runFile('AIVEN_PADRON_SPR.sql');
await runFile('AIVEN_RPC.sql');
await runFile('AIVEN_NOMINA_COLUMN.sql');
console.log('Listo: esquema Aiven aplicado (incl. SPR y nomina_documento).');
await client.end();
