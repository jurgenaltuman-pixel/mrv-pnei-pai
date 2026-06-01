#!/usr/bin/env node
/**
 * Monitoreo: Excel de nómina vs profiles en Aiven (sin modificar datos).
 *   node scripts/monitor-nomina-import.mjs [ruta.xlsx]
 */
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';
import { parseNominaExcelRow } from './lib/nomina-excel.mjs';
import { hasProtectedCredentials } from './lib/nomina-protected.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);

const xlsxPath =
  process.argv.find((a) => a.endsWith('.xlsx')) ||
  path.join(process.env.USERPROFILE || '', 'Documents', 'Listado de usuarios activos para MRV.xlsx');

if (!fs.existsSync(xlsxPath)) {
  console.error('No existe:', xlsxPath);
  process.exit(1);
}

const wb = XLSX.readFile(xlsxPath, { cellDates: false });
const excelRows = XLSX.utils
  .sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  .filter((r) => Object.values(r).some((v) => String(v).trim()));

const excelByDoc = new Map();
let excelInvalid = 0;
for (const row of excelRows) {
  const { doc, nombres } = parseNominaExcelRow(row);
  if (!doc || doc.length < 4 || !nombres) {
    excelInvalid++;
    continue;
  }
  excelByDoc.set(doc, parseNominaExcelRow(row));
}

const client = createAivenClient(process.env.DATABASE_URL);
await client.connect();

const { rows: dbStats } = await client.query(`
  SELECT
    count(*)::int AS total_profiles,
    count(*) FILTER (WHERE is_active AND is_approved)::int AS activos_aprobados,
    count(*) FILTER (WHERE nomina_documento IS NOT NULL AND is_active)::int AS con_nomina_doc,
    count(*) FILTER (
      WHERE is_active AND nomina_documento IS NOT NULL
        AND COALESCE(display_name, '') NOT ILIKE '%@%'
    )::int AS buscables_registro
  FROM profiles
`);

const { rows: credStats } = await client.query(`
  SELECT
    count(*)::int AS con_auth,
    count(*) FILTER (WHERE password_hash LIKE '$2%')::int AS bcrypt_ok,
    count(*) FILTER (
      WHERE password_hash LIKE '$2%'
        AND lower(trim(email)) NOT LIKE '%@mrv.import'
        AND lower(trim(email)) NOT LIKE '%@system.vaccinator%'
    )::int AS credenciales_protegidas
  FROM auth_credentials
`);

const { rows: profileRows } = await client.query(`
  SELECT
    p.user_id,
    p.nomina_documento,
    p.display_name,
    p.email,
    p.username,
    p.assigned_region,
    p.assigned_distrito,
    p.assigned_servicio,
    p.is_active,
    ac.email AS ac_email,
    ac.password_hash,
    EXISTS (
      SELECT 1 FROM auth_credentials ac2
      WHERE ac2.user_id = p.user_id
        AND ac2.password_hash LIKE '$2%'
        AND lower(trim(ac2.email)) NOT LIKE '%@mrv.import'
        AND lower(trim(ac2.email)) NOT LIKE '%@system.vaccinator%'
    ) AS credenciales_protegidas
  FROM profiles p
  LEFT JOIN auth_credentials ac ON ac.user_id = p.user_id
  WHERE p.is_active = true
`);

const dbByDoc = new Map();
const protectedUsers = [];
for (const p of profileRows) {
  const doc =
    String(p.nomina_documento || '').replace(/\D/g, '') ||
    String(p.username || '').replace(/\D/g, '');
  if (doc.length >= 4) {
    if (!dbByDoc.has(doc)) dbByDoc.set(doc, p);
    else if (hasProtectedCredentials(p) && !hasProtectedCredentials(dbByDoc.get(doc))) {
      dbByDoc.set(doc, p);
    }
  }
  if (hasProtectedCredentials(p)) {
    protectedUsers.push({
      doc: p.nomina_documento || doc,
      email: p.ac_email || p.email,
      nombre: p.display_name,
    });
  }
}

let enExcelYDb = 0;
let enExcelFaltaDb = 0;
let enExcelSinNominaDoc = 0;
let enExcelProtegidos = 0;
let enExcelSinServicio = 0;
const faltantesSample = [];

for (const [doc, excel] of excelByDoc) {
  const db = dbByDoc.get(doc);
  if (!db) {
    enExcelFaltaDb++;
    if (faltantesSample.length < 8) {
      faltantesSample.push({ doc, nombre: excel.nombres, motivo: 'no existe en BD' });
    }
    continue;
  }
  enExcelYDb++;
  if (hasProtectedCredentials(db)) enExcelProtegidos++;
  if (!db.nomina_documento) enExcelSinNominaDoc++;
  if (!db.assigned_servicio && excel.servicio) enExcelSinServicio++;
}

let enDbNoExcel = 0;
for (const doc of dbByDoc.keys()) {
  if (!excelByDoc.has(doc)) enDbNoExcel++;
}

const pct = excelByDoc.size
  ? Math.round((enExcelYDb / excelByDoc.size) * 1000) / 10
  : 0;

console.log('\n=== Monitoreo nómina MRV ===\n');
console.log('Excel:', xlsxPath);
console.log('Filas Excel (útiles):', excelByDoc.size, `(omitidas inválidas: ${excelInvalid})`);
console.log('BD:', process.env.DATABASE_URL?.split('@')[1] || '(DATABASE_URL)');
console.log('\n--- Base de datos ---');
console.log(dbStats[0]);
console.log('Auth:', credStats[0]);
console.log('\n--- Cobertura Excel → BD ---');
console.log(`  En Excel y BD (por CI):     ${enExcelYDb} (${pct}%)`);
console.log(`  En Excel, faltan en BD:     ${enExcelFaltaDb}`);
console.log(`  En BD, no están en Excel:   ${enDbNoExcel}`);
console.log(`  Coinciden pero sin nomina_documento: ${enExcelSinNominaDoc}`);
console.log(`  Coinciden pero sin servicio en BD:   ${enExcelSinServicio}`);
console.log(`  Coinciden y credenciales protegidas: ${enExcelProtegidos} (no tocar en sync)`);
console.log(`  Cuentas protegidas totales (activas):  ${protectedUsers.length}`);

if (faltantesSample.length) {
  console.log('\n  Ejemplos faltantes en BD:');
  for (const s of faltantesSample) console.log(`    · ${s.doc} — ${s.nombre}`);
}

if (protectedUsers.length) {
  console.log('\n  Ejemplos protegidos (muestra 5):');
  for (const u of protectedUsers.slice(0, 5)) {
    console.log(`    · ${u.doc} — ${u.email} — ${String(u.nombre).slice(0, 40)}`);
  }
}

const pendienteImport = enExcelFaltaDb + enExcelSinNominaDoc;
console.log('\n--- Recomendación ---');
if (pendienteImport > 0) {
  console.log(
    `  Quedan ~${pendienteImport} filas por alinear. Ejecutá:\n` +
      `  node scripts/sync-nomina-excel.mjs --respect-credenciales\n` +
      `  (crea faltantes; no modifica cuentas con Gmail/correo real y bcrypt)`
  );
} else {
  console.log('  Nómina alineada con el Excel. No hace falta reimportar.');
}

await client.end();
