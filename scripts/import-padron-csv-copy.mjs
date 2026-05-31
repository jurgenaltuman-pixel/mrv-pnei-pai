#!/usr/bin/env node
/**
 * Importación rápida CSV → COPY (mucho más veloz que INSERT por lotes).
 * Uso: node scripts/import-padron-csv-copy.mjs [ruta.csv]
 */
import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { finished } from 'stream/promises';
import { parse } from 'csv-parse';
import { from as copyFrom } from 'pg-copy-streams';
import { fileURLToPath } from 'url';
import { loadEnv } from './lib/load-env.mjs';
import { connectAivenWritable, createAivenClient } from './lib/pg-aiven.mjs';
import { mapPersona, validPersona } from './lib/padron-row-map.mjs';

function padronShardIndex(documento) {
  const d = String(documento || '').trim();
  if (!d.length) return 0;
  return d.charCodeAt(d.length - 1) % 2;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnv(root);

const shardArg = process.argv.find((a) => a.startsWith('--shard='));
const TARGET_SHARD = shardArg != null ? Number(shardArg.split('=')[1]) : null;
const SHARDS = Number(process.argv.find((a) => a.startsWith('--shards='))?.split('=')[1] || 2);
const urlFromArg = process.argv.find((a) => a.startsWith('--url='))?.split('=').slice(1).join('=');
const url =
  urlFromArg ||
  (TARGET_SHARD === 1 ? process.env.PADRON_DATABASE_URL_2 || process.env.DATABASE_URL : null) ||
  process.env.PADRON_DATABASE_URL;
if (!url) {
  console.error('Falta PADRON_DATABASE_URL o --url=');
  process.exit(1);
}
const TARGET_URL = url;

const csvArg = process.argv.find((a) => a.endsWith('.csv'));
const CSV_PATH =
  csvArg || path.join(process.env.USERPROFILE || '', 'Documents', 'Listado de niños para MRV.csv');

function tsvCell(v) {
  if (v == null || v === '') return '\\N';
  return String(v)
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');
}

function rowLine(p) {
  return [
    tsvCell(p.nombre),
    tsvCell(p.tipo_documento),
    tsvCell(p.documento),
    tsvCell(p.fecha_nacimiento),
    tsvCell(p.sexo),
    tsvCell(p.region_sanitaria),
    tsvCell(p.distrito),
    tsvCell(p.servicio_salud),
    tsvCell(p.documento_madre),
    tsvCell(p.nombre_madre),
    tsvCell(p.edad_anos),
    tsvCell(p.edad_meses),
    tsvCell(p.historial_spr ? JSON.stringify(p.historial_spr) : null),
  ].join('\t');
}

const client = createAivenClient(TARGET_URL);

async function main() {
  const shardLabel =
    TARGET_SHARD != null ? ` shard ${TARGET_SHARD}/${SHARDS}` : '';
  console.log('COPY rápido →', TARGET_URL.replace(/:[^:@]+@/, ':****@'), shardLabel);
  if (!fs.existsSync(CSV_PATH)) {
    console.error('No existe CSV:', CSV_PATH);
    process.exit(1);
  }
  await connectAivenWritable(client);
  await client.query("SET statement_timeout = '0'");
  await client.query("SET lock_timeout = '0'");
  const t0 = Date.now();
  console.log('Vaciando e índices temporales…');
  await client.query('TRUNCATE base_personas RESTART IDENTITY CASCADE');
  await client.query('DROP INDEX IF EXISTS idx_base_personas_nombre_trgm');
  await client.query('DROP INDEX IF EXISTS idx_base_personas_doc');
  await client.query('DROP INDEX IF EXISTS idx_base_personas_doc_madre');
  await client.query('DROP INDEX IF EXISTS idx_base_personas_fecha_nac');
  await client.query('DROP INDEX IF EXISTS base_personas_documento_key');

  const copySql = `COPY base_personas (
    nombre, tipo_documento, documento, fecha_nacimiento, sexo,
    region_sanitaria, distrito, servicio_salud, documento_madre, nombre_madre,
    edad_anos, edad_meses, historial_spr
  ) FROM STDIN WITH (FORMAT text, NULL '\\N')`;

  const stream = client.query(copyFrom(copySql));
  stream.on('error', (err) => {
    console.error('COPY stream error:', err.message);
  });
  let read = 0;
  let written = 0;
  let skipped = 0;
  let dupes = 0;
  const seenDoc = new Set();

  const parser = createReadStream(CSV_PATH, { encoding: 'utf8' }).pipe(
    parse({ columns: true, skip_empty_lines: true, relax_column_count: true, trim: true, bom: true })
  );

  for await (const row of parser) {
    read += 1;
    const p = mapPersona(row);
    if (!validPersona(p)) {
      skipped += 1;
      continue;
    }
    if (TARGET_SHARD != null && padronShardIndex(p.documento) % SHARDS !== TARGET_SHARD) {
      continue;
    }
    if (seenDoc.has(p.documento)) {
      dupes += 1;
      continue;
    }
    seenDoc.add(p.documento);
    const line = `${rowLine(p)}\n`;
    if (!stream.write(line)) {
      await new Promise((resolve) => stream.once('drain', resolve));
    }
    written += 1;
    if (read % 100_000 === 0) {
      const sec = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`… ${read.toLocaleString('es-PY')} leídas, ${written.toLocaleString('es-PY')} copiadas (${sec}s)`);
    }
  }

  stream.end();
  await finished(stream);

  console.log('Índices mínimos (ahorra disco; sin GIN trgm)…');
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS base_personas_documento_key ON base_personas (documento);
    CREATE INDEX IF NOT EXISTS idx_base_personas_doc ON base_personas (documento text_pattern_ops);
  `);

  const { rows } = await client.query('SELECT count(*)::int AS n FROM base_personas');
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `Listo COPY ${sec}s. Leídas ${read}, escritas ${written}, omitidas ${skipped}, dupes ${dupes}, total BD ${rows[0].n}`
  );
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
