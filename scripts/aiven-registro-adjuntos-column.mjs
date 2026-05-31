#!/usr/bin/env node
/** Añade columnas transcripcion_clip, enlace_imagen_1, enlace_imagen_2 en registros_vacunacion. */
import pg from 'pg';
import { loadEnv } from './lib/load-env.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(`
  ALTER TABLE registros_vacunacion
    ADD COLUMN IF NOT EXISTS transcripcion_clip text,
    ADD COLUMN IF NOT EXISTS enlace_imagen_1 text,
    ADD COLUMN IF NOT EXISTS enlace_imagen_2 text;
`);
console.log('OK: columnas adjuntos en registros_vacunacion');
await client.end();
