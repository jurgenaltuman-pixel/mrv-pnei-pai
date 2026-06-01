#!/usr/bin/env node
/**
 * Reemplazo de nómina desde Excel → profiles + auth_credentials.
 * Archivo por defecto: Documents/Listado de usuarios activos para MRV.xlsx
 *
 *   node scripts/sync-nomina-excel.mjs [ruta.xlsx]
 *   node scripts/sync-nomina-excel.mjs --sin-crear   (solo actualiza existentes)
 *   node scripts/sync-nomina-excel.mjs --respect-credenciales  (default: no toca cuentas con bcrypt + correo real)
 */
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { loadEnv } from './lib/load-env.mjs';
import { connectAivenWritable, createAivenClient } from './lib/pg-aiven.mjs';
import { parseNominaExcelRow, pickCatalogName, normOrgKey } from './lib/nomina-excel.mjs';
import { hasProtectedCredentials } from './lib/nomina-protected.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);

const url = process.env.DATABASE_URL?.split('?')[0];
const xlsxPath =
  process.argv.find((a) => a.endsWith('.xlsx')) ||
  path.join(process.env.USERPROFILE || '', 'Documents', 'Listado de usuarios activos para MRV.xlsx');
const allowCreate = !process.argv.includes('--sin-crear');
const respectCredentials =
  !process.argv.includes('--sin-respetar-credenciales') && !process.argv.includes('--force-all');

console.log('DB:', url?.split('@')[1]);
console.log('Archivo:', xlsxPath);
if (!fs.existsSync(xlsxPath)) {
  console.error('No existe el Excel');
  process.exit(1);
}

const wb = XLSX.readFile(xlsxPath, { cellDates: false });
const rows = XLSX.utils
  .sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  .filter((r) => Object.values(r).some((v) => String(v).trim()));
console.log(`Filas Excel: ${rows.length}`);

const client = createAivenClient(url);
await connectAivenWritable(client);

await client.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nomina_documento text`);
await client.query(
  `CREATE INDEX IF NOT EXISTS idx_profiles_nomina_documento ON profiles (nomina_documento)`
);
const { rows: regiones } = await client.query('SELECT id, nombre FROM regiones_sanitarias');
const { rows: distritos } = await client.query('SELECT id, nombre, region_id FROM distritos');
const { rows: servicios } = await client.query('SELECT id, nombre, distrito_id FROM servicios_salud');

function canonTerritory(region, distrito, servicio) {
  const regionName = pickCatalogName(regiones, region);
  const regionId = regiones.find((r) => normOrgKey(r.nombre) === normOrgKey(regionName))?.id;
  const distPool = regionId != null ? distritos.filter((d) => d.region_id === regionId) : distritos;
  const distritoName = pickCatalogName(distPool, distrito);
  const distritoId = distPool.find((d) => normOrgKey(d.nombre) === normOrgKey(distritoName))?.id;
  const servPool = distritoId != null ? servicios.filter((s) => s.distrito_id === distritoId) : servicios;
  const servicioName = pickCatalogName(servPool, servicio);
  return {
    region: regionName,
    distrito: distritoName,
    servicio: servicioName,
  };
}

let updated = 0;
let created = 0;
let deactivated = 0;
let noMatch = 0;
let skippedProtected = 0;
let errors = 0;
const docsInExcel = new Set();

for (let i = 0; i < rows.length; i++) {
  const parsed = parseNominaExcelRow(rows[i]);
  const { doc, nombres, excelUser } = parsed;
  if (!doc || doc.length < 4 || !nombres) {
    errors++;
    continue;
  }
  docsInExcel.add(doc);
  const territory = canonTerritory(parsed.region, parsed.distrito, parsed.servicio);
  const email = `${excelUser.replace(/[^a-z0-9._-]/g, '') || doc}@mrv.import`;

  try {
    const { rows: candidates } = await client.query(
      `SELECT p.user_id, p.username, p.display_name, p.email,
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
       WHERE p.nomina_documento = $1
          OR regexp_replace(COALESCE(p.username, ''), '[^0-9]', '', 'g') = $1
          OR lower(trim(p.username)) = $2
          OR lower(trim(p.email)) = $3
       ORDER BY
         (CASE WHEN p.nomina_documento = $1 THEN 0 ELSE 1 END),
         (CASE WHEN regexp_replace(COALESCE(p.username, ''), '[^0-9]', '', 'g') = $1 THEN 0 ELSE 1 END),
         credenciales_protegidas DESC,
         p.updated_at DESC NULLS LAST
       LIMIT 5`,
      [doc, excelUser, email]
    );

    if (candidates.length) {
      const primary = candidates[0];
      if (respectCredentials && hasProtectedCredentials(primary)) {
        skippedProtected++;
        continue;
      }
      const otherIds = candidates
        .slice(1)
        .filter((c) => !(respectCredentials && hasProtectedCredentials(c)))
        .map((c) => c.user_id);
      const { rows: userClash } = await client.query(
        `SELECT 1 FROM profiles WHERE lower(trim(username)) = lower($1) AND user_id <> $2 LIMIT 1`,
        [excelUser, primary.user_id]
      );
      if (userClash.length) {
        await client.query(
          `UPDATE profiles SET
             nomina_documento = $1,
             display_name = $2,
             assigned_region = $3,
             assigned_distrito = $4,
             assigned_servicio = $5,
             is_active = true,
             is_approved = true,
             updated_at = now()
           WHERE user_id = $6`,
          [doc, nombres, territory.region, territory.distrito, territory.servicio, primary.user_id]
        );
      } else {
        await client.query(
          `UPDATE profiles SET
             nomina_documento = $1,
             display_name = $2,
             username = $3,
             assigned_region = $4,
             assigned_distrito = $5,
             assigned_servicio = $6,
             is_active = true,
             is_approved = true,
             updated_at = now()
           WHERE user_id = $7`,
          [doc, nombres, excelUser, territory.region, territory.distrito, territory.servicio, primary.user_id]
        );
      }
      const { rows: cred } = await client.query(
        `SELECT user_id FROM auth_credentials WHERE user_id = $1`,
        [primary.user_id]
      );
      if (!cred.length && allowCreate) {
        const pwd = `Mrv${doc.slice(-4).padStart(4, '0')}!`;
        const hash = await bcrypt.hash(pwd, 10);
        await client.query(`INSERT INTO auth_credentials (user_id, email, password_hash) VALUES ($1,$2,$3)`, [
          primary.user_id,
          email,
          hash,
        ]);
      }
      updated++;
      if (otherIds.length) {
        const { rowCount } = await client.query(
          `UPDATE profiles SET is_active = false, updated_at = now() WHERE user_id = ANY($1::uuid[])`,
          [otherIds]
        );
        deactivated += rowCount || 0;
      }
    } else if (allowCreate) {
      const userId = randomUUID();
      const pwd = `Mrv${doc.slice(-4).padStart(4, '0')}!`;
      const hash = await bcrypt.hash(pwd, 10);
      const now = new Date().toISOString();
      await client.query(
        `INSERT INTO profiles (
           user_id, email, username, display_name, nomina_documento, is_active, is_approved, must_change_password,
           assigned_region, assigned_distrito, assigned_servicio, scope_locked, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,true,true,true,$6,$7,$8,false,$9,$9)`,
        [userId, email, excelUser, nombres, doc, territory.region, territory.distrito, territory.servicio, now]
      );
      await client.query(
        `INSERT INTO auth_credentials (user_id, email, password_hash) VALUES ($1,$2,$3)`,
        [userId, email, hash]
      );
      await client.query(`INSERT INTO user_roles (user_id, role) VALUES ($1,'user') ON CONFLICT DO NOTHING`, [
        userId,
      ]);
      created++;
    } else {
      noMatch++;
    }

    if ((i + 1) % 500 === 0) {
      console.log(
        `  … ${i + 1}/${rows.length} (upd=${updated} new=${created} protegidos=${skippedProtected} sin_match=${noMatch})`
      );
    }
  } catch (e) {
    errors++;
    if (errors <= 8) console.error('Error fila', doc, e.message);
  }
}

const { rowCount: off } = await client.query(
  `UPDATE profiles SET is_active = false, updated_at = now()
   WHERE is_active = true
     AND nomina_documento IS NULL
     AND (
       COALESCE(display_name, '') ILIKE '%@system.vaccinator%'
       OR COALESCE(email, '') ILIKE '%@system.vaccinator%'
     )`
);

const { rows: stats } = await client.query(
  `SELECT
     count(*) FILTER (WHERE nomina_documento IS NOT NULL AND is_active AND is_approved)::int AS nomina_ok,
     count(*) FILTER (WHERE is_active AND is_approved)::int AS activos_aprobados,
     count(*) FILTER (
       WHERE is_active AND nomina_documento IS NOT NULL
         AND COALESCE(display_name, '') NOT ILIKE '%@%'
     )::int AS buscables
   FROM profiles`
);

console.log('\nResumen:');
console.log(`  actualizados: ${updated}`);
console.log(`  creados: ${created}`);
console.log(`  omitidos (credenciales válidas): ${skippedProtected}`);
console.log(`  duplicados desactivados: ${deactivated}`);
if (respectCredentials) {
  console.log('  modo: --respect-credenciales (no se modificaron cuentas con correo real + bcrypt)');
}
console.log(`  sin coincidencia (sin --crear): ${noMatch}`);
console.log(`  errores: ${errors}`);
console.log(`  @system sin nómina desactivados: ${off}`);
console.log(`  con nomina_documento (activo+aprobado): ${stats[0].nomina_ok}`);
console.log(`  buscables en registro: ${stats[0].buscables}`);
console.log(`  activos+aprobados total: ${stats[0].activos_aprobados}`);

await client.end();
