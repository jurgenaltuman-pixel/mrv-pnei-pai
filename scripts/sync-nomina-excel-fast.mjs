#!/usr/bin/env node
/**
 * Sync rápido Excel → profiles (respeta credenciales válidas).
 * node scripts/sync-nomina-excel-fast.mjs [ruta.xlsx]
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

console.log('DB:', url?.split('@')[1]);
console.log('Archivo:', xlsxPath);

const wb = XLSX.readFile(xlsxPath);
const excelRows = XLSX.utils
  .sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  .filter((r) => Object.values(r).some((v) => String(v).trim()));

const client = createAivenClient(url);
await connectAivenWritable(client);

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
  return {
    region: regionName,
    distrito: distritoName,
    servicio: pickCatalogName(servPool, servicio),
  };
}

console.log('Cargando perfiles…');
const { rows: dbRows } = await client.query(`
  SELECT p.user_id, p.nomina_documento, p.username, p.display_name, p.email,
         ac.email AS ac_email, ac.password_hash,
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

const byDoc = new Map();
const byUsername = new Map();
for (const row of dbRows) {
  const doc =
    String(row.nomina_documento || '').replace(/\D/g, '') ||
    String(row.username || '').replace(/\D/g, '');
  if (doc.length >= 4) {
    const prev = byDoc.get(doc);
    if (!prev || hasProtectedCredentials(row)) byDoc.set(doc, row);
  }
  const un = String(row.username || '').trim().toLowerCase();
  if (un) byUsername.set(un, row);
}

let updated = 0;
let created = 0;
let skippedProtected = 0;
let errors = 0;
const toCreate = [];

for (const raw of excelRows) {
  const parsed = parseNominaExcelRow(raw);
  const { doc, nombres, excelUser } = parsed;
  if (!doc || doc.length < 4 || !nombres) {
    errors++;
    continue;
  }
  const territory = canonTerritory(parsed.region, parsed.distrito, parsed.servicio);
  const email = `${excelUser.replace(/[^a-z0-9._-]/g, '') || doc}@mrv.import`;
  let match = byDoc.get(doc) || byUsername.get(excelUser);
  if (!match && excelUser !== doc) {
    const digitsUser = byUsername.get(doc);
    if (digitsUser) match = digitsUser;
  }

  if (match) {
    if (hasProtectedCredentials(match)) {
      skippedProtected++;
      continue;
    }
    try {
      const { rows: clash } = await client.query(
        `SELECT 1 FROM profiles WHERE lower(trim(username)) = lower($1) AND user_id <> $2 LIMIT 1`,
        [excelUser, match.user_id]
      );
      if (clash.length) {
        await client.query(
          `UPDATE profiles SET nomina_documento=$1, display_name=$2,
             assigned_region=$3, assigned_distrito=$4, assigned_servicio=$5,
             is_active=true, is_approved=true, updated_at=now()
           WHERE user_id=$6`,
          [doc, nombres, territory.region, territory.distrito, territory.servicio, match.user_id]
        );
      } else {
        await client.query(
          `UPDATE profiles SET nomina_documento=$1, display_name=$2, username=$3,
             assigned_region=$4, assigned_distrito=$5, assigned_servicio=$6,
             is_active=true, is_approved=true, updated_at=now()
           WHERE user_id=$7`,
          [doc, nombres, excelUser, territory.region, territory.distrito, territory.servicio, match.user_id]
        );
      }
      const { rows: cred } = await client.query(
        `SELECT 1 FROM auth_credentials WHERE user_id=$1`,
        [match.user_id]
      );
      if (!cred.length) {
        const hash = await bcrypt.hash(`Mrv${doc.slice(-4).padStart(4, '0')}!`, 10);
        await client.query(`INSERT INTO auth_credentials (user_id, email, password_hash) VALUES ($1,$2,$3)`, [
          match.user_id,
          email,
          hash,
        ]);
      }
      updated++;
    } catch (e) {
      errors++;
      if (errors <= 5) console.error('update', doc, e.message);
    }
  } else {
    toCreate.push({ doc, nombres, excelUser, email, territory });
  }
}

console.log(`Creando ${toCreate.length} usuarios nuevos…`);
for (const item of toCreate) {
  try {
    const userId = randomUUID();
    const hash = await bcrypt.hash(`Mrv${item.doc.slice(-4).padStart(4, '0')}!`, 10);
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO profiles (
         user_id, email, username, display_name, nomina_documento, is_active, is_approved, must_change_password,
         assigned_region, assigned_distrito, assigned_servicio, scope_locked, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,true,true,true,$6,$7,$8,false,$9,$9)`,
      [
        userId,
        item.email,
        item.excelUser,
        item.nombres,
        item.doc,
        item.territory.region,
        item.territory.distrito,
        item.territory.servicio,
        now,
      ]
    );
    await client.query(`INSERT INTO auth_credentials (user_id, email, password_hash) VALUES ($1,$2,$3)`, [
      userId,
      item.email,
      hash,
    ]);
    await client.query(`INSERT INTO user_roles (user_id, role) VALUES ($1,'user') ON CONFLICT DO NOTHING`, [userId]);
    created++;
  } catch (e) {
    errors++;
    if (errors <= 8) console.error('create', item.doc, e.message);
  }
}

const { rows: stats } = await client.query(`
  SELECT
    count(*) FILTER (WHERE nomina_documento IS NOT NULL AND is_active AND is_approved)::int AS nomina_ok,
    count(*) FILTER (
      WHERE is_active AND nomina_documento IS NOT NULL AND COALESCE(display_name,'') NOT ILIKE '%@%'
    )::int AS buscables
  FROM profiles
`);

console.log('\nResumen (fast):');
console.log({ updated, created, skippedProtected, errors, excel: excelRows.length, ...stats[0] });
await client.end();
