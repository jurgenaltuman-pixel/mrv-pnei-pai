#!/usr/bin/env node
/**
 * Importa padrón nominal desde CSV a PADRON_DATABASE_URL (instancia dedicada).
 * Uso: node scripts/import-padron-csv.mjs "ruta.csv" [--sin-vaciar] [--resume]
 */
import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { fileURLToPath } from 'url';
import { loadEnv } from './lib/load-env.mjs';
import { connectAivenWritable, createAivenClient } from './lib/pg-aiven.mjs';
import { mapPersona, validPersona } from './lib/padron-row-map.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

loadEnv(root);

const url = process.env.PADRON_DATABASE_URL;
if (!url) {
  console.error('Falta PADRON_DATABASE_URL en .env.local');
  process.exit(1);
}

const csvArg = process.argv.find((a) => a.endsWith('.csv'));
const CSV_PATH =
  csvArg || path.join(process.env.USERPROFILE || '', 'Documents', 'Listado de niños para MRV.csv');
const sinVaciar = process.argv.includes('--sin-vaciar');
const BATCH = Math.min(600, Math.max(100, parseInt(process.env.MRV_BATCH || '350', 10)));

const client = createAivenClient(url);

async function insertBatch(rows) {
  if (!rows.length) return true;
  const cols = [
    'nombre',
    'tipo_documento',
    'documento',
    'fecha_nacimiento',
    'sexo',
    'region_sanitaria',
    'distrito',
    'servicio_salud',
    'documento_madre',
    'nombre_madre',
    'edad_anos',
    'edad_meses',
    'historial_spr',
  ];
  const values = [];
  const params = [];
  let i = 1;
  for (const r of rows) {
    values.push(
      `($${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`
    );
    params.push(
      r.nombre,
      r.tipo_documento,
      r.documento,
      r.fecha_nacimiento,
      r.sexo,
      r.region_sanitaria,
      r.distrito,
      r.servicio_salud,
      r.documento_madre,
      r.nombre_madre,
      r.edad_anos ?? null,
      r.edad_meses ?? null,
      r.historial_spr ? JSON.stringify(r.historial_spr) : null
    );
  }
  const sql = `
    INSERT INTO base_personas (${cols.join(', ')})
    VALUES ${values.join(', ')}
    ON CONFLICT (documento) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      tipo_documento = EXCLUDED.tipo_documento,
      fecha_nacimiento = EXCLUDED.fecha_nacimiento,
      sexo = EXCLUDED.sexo,
      region_sanitaria = EXCLUDED.region_sanitaria,
      distrito = EXCLUDED.distrito,
      servicio_salud = EXCLUDED.servicio_salud,
      documento_madre = EXCLUDED.documento_madre,
      nombre_madre = EXCLUDED.nombre_madre,
      edad_anos = EXCLUDED.edad_anos,
      edad_meses = EXCLUDED.edad_meses,
      historial_spr = EXCLUDED.historial_spr`;
  try {
    await client.query(sql, params);
    return true;
  } catch (e) {
    if (rows.length > 1) {
      const mid = Math.floor(rows.length / 2);
      const a = await insertBatch(rows.slice(0, mid));
      const b = await insertBatch(rows.slice(mid));
      return a && b;
    }
    console.error('Lote:', e.message, rows[0]?.documento);
    return false;
  }
}

async function main() {
  console.log('Import CSV padrón →', url.replace(/:[^:@]+@/, ':****@'));
  console.log('Archivo:', CSV_PATH);
  if (!fs.existsSync(CSV_PATH)) {
    console.error('No existe el CSV');
    process.exit(1);
  }

  await connectAivenWritable(client);

  if (!sinVaciar) {
    console.log('Vaciando base_personas…');
    await client.query('TRUNCATE base_personas RESTART IDENTITY CASCADE');
  }

  let read = 0;
  let inserted = 0;
  let skipped = 0;
  let batch = [];
  const t0 = Date.now();

  const parser = createReadStream(CSV_PATH, { encoding: 'utf8' }).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      bom: true,
    })
  );

  for await (const row of parser) {
    read += 1;
    const p = mapPersona(row);
    if (!validPersona(p)) {
      skipped += 1;
      continue;
    }
    batch.push(p);
    if (batch.length >= BATCH) {
      if (await insertBatch(batch)) inserted += batch.length;
      batch = [];
      if (read % 25000 === 0) {
        const sec = ((Date.now() - t0) / 1000).toFixed(0);
        console.log(`… ${read.toLocaleString('es-PY')} leídas, ${inserted.toLocaleString('es-PY')} insertadas (${sec}s)`);
      }
    }
  }
  if (batch.length) {
    if (await insertBatch(batch)) inserted += batch.length;
  }

  const { rows } = await client.query('SELECT count(*)::int AS n FROM base_personas');
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `Listo en ${sec}s. Leídas: ${read}, insertadas: ${inserted}, omitidas: ${skipped}, total BD: ${rows[0].n}`
  );
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
