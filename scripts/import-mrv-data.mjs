/**
 * Importa catálogo y nómina MRV desde Excel a Supabase.
 * Uso: node scripts/import-mrv-data.mjs [--solo-catalogo] [--solo-nomina]
 * Requiere en .env / .env.local: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o VITE_SUPABASE_PUBLISHABLE_KEY).
 */
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL y clave Supabase en .env');
  process.exit(1);
}

const supabase = createClient(url, key);

const UNIDADES_PATH =
  process.argv.find((a) => a.endsWith('.xlsx') && a.includes('Unidad')) ||
  path.join(process.env.USERPROFILE || '', 'Documents', 'Unidad Organizativa para MRV.xlsx');
const NOMINA_PATH =
  process.argv.find((a) => a.endsWith('.xlsx') && (a.includes('Nómina') || a.includes('Nomina'))) ||
  path.join(root, 'scripts', 'import-nomina.xlsx');

const soloCatalogo = process.argv.includes('--solo-catalogo');
const soloNomina = process.argv.includes('--solo-nomina');

function normKey(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function pick(row, ...aliases) {
  const map = new Map();
  for (const [k, v] of Object.entries(row)) map.set(normKey(k), v);
  for (const a of aliases) {
    const v = map.get(normKey(a));
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function joinParts(...parts) {
  return parts.map((p) => String(p || '').trim()).filter((p) => p && p !== '-').join(' ');
}

function excelDateToIso(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && value > 20000 && value < 60000) {
    const utc = new Date(Math.round((value - 25569) * 86400 * 1000));
    return utc.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function mapUnit(row) {
  return {
    region: pick(row, 'region', 'región', 'region_sanitaria'),
    distrito: pick(row, 'distrito', 'municipio', 'departamento'),
    servicio_salud: pick(row, 'servicio_salud', 'servicio de salud', 'servicio'),
    barrio: pick(row, 'barrio', 'localidad') || undefined,
  };
}

function mapPersona(row) {
  const nombre =
    pick(row, 'nombre', 'nombres_completos') ||
    joinParts(
      pick(row, 'nombre1'),
      pick(row, 'nombre2'),
      pick(row, 'apellido1'),
      pick(row, 'apellido2')
    );
  const nombreMadre =
    pick(row, 'nombre_madre', 'madre_nombre') ||
    joinParts(pick(row, 'madre_nombre1'), pick(row, 'madre_nombre2'), pick(row, 'madre_apellido1'), pick(row, 'madre_apellido2'));
  let tipo = pick(row, 'tipo_documento', 'tipo documento').toUpperCase();
  if (tipo.includes('CEDULA') || tipo === 'CI') tipo = 'CI';
  else if (tipo.includes('EXTRANJ') || tipo === 'DEX') tipo = 'DEX';
  else if (tipo.length > 4) tipo = 'CI';

  let sexo = pick(row, 'sexo').toUpperCase();
  if (sexo.startsWith('MASC')) sexo = 'M';
  else if (sexo.startsWith('FEM')) sexo = 'F';
  else sexo = sexo.slice(0, 1);

  return {
    nombre,
    tipo_documento: tipo,
    documento: pick(row, 'documento', 'ci').replace(/\s/g, ''),
    fecha_nacimiento: excelDateToIso(row.fecha_nacimiento),
    sexo,
    region_sanitaria: pick(row, 'region_sanitaria', 'region', 'región'),
    distrito: pick(row, 'distrito', 'municipio', 'departamento'),
    servicio_salud: pick(row, 'servicio_salud', 'servicio de salud', 'servicio'),
    documento_madre: pick(row, 'documento_madre', 'madre_documento').replace(/\D/g, '') || null,
    nombre_madre: nombreMadre || null,
  };
}

function validUnit(u) {
  return u.region && u.distrito && u.servicio_salud;
}

function validPersona(p) {
  return (
    p.nombre &&
    p.tipo_documento &&
    p.documento &&
    p.fecha_nacimiento &&
    p.sexo &&
    p.region_sanitaria &&
    p.distrito &&
    p.servicio_salud
  );
}

async function importCatalogo(filePath) {
  console.log('\n📂 Catálogo:', filePath);
  if (!fs.existsSync(filePath)) {
    console.error('No existe el archivo de unidades');
    return;
  }
  const wb = XLSX.readFile(filePath);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  const tree = new Map();
  let validRows = 0;
  for (const raw of rows) {
    const u = mapUnit(raw);
    if (!validUnit(u)) continue;
    validRows++;
    if (!tree.has(u.region)) tree.set(u.region, new Map());
    const dm = tree.get(u.region);
    if (!dm.has(u.distrito)) dm.set(u.distrito, { servicios: new Set(), barrios: new Set() });
    const n = dm.get(u.distrito);
    n.servicios.add(u.servicio_salud);
    if (u.barrio) n.barrios.add(u.barrio);
  }
  console.log(`Filas válidas: ${validRows}, regiones únicas: ${tree.size}`);

  await supabase.from('barrios').delete().neq('id', 0);
  await supabase.from('servicios_salud').delete().neq('id', 0);
  await supabase.from('distritos').delete().neq('id', 0);
  await supabase.from('regiones_sanitarias').delete().neq('id', 0);

  const regionIdByName = new Map();
  const distritoIdByKey = new Map();
  const servicioKeySeen = new Set();
  const barrioKeySeen = new Set();
  let servicios = 0;
  let barrios = 0;

  for (const [regionName, distMap] of tree) {
    const { data: r, error } = await supabase
      .from('regiones_sanitarias')
      .insert({
        nombre: regionName,
        codigo: regionName.replace(/[^A-Za-z]/g, '').slice(0, 6).toUpperCase() || 'REG',
      })
      .select('id')
      .single();
    if (error) {
      console.error('Región', regionName, error.message);
      continue;
    }
    regionIdByName.set(regionName, r.id);

    for (const [distName, node] of distMap) {
      const dKey = `${r.id}|${distName}`;
      let distId = distritoIdByKey.get(dKey);
      if (!distId) {
        const { data: d, error: de } = await supabase
          .from('distritos')
          .insert({ nombre: distName, region_id: r.id })
          .select('id')
          .single();
        if (de) {
          console.error('Distrito', distName, de.message);
          continue;
        }
        distId = d.id;
        distritoIdByKey.set(dKey, distId);
      }

      for (const s of node.servicios) {
        const sk = `${distId}|${s}`;
        if (servicioKeySeen.has(sk)) continue;
        servicioKeySeen.add(sk);
        const { error: se } = await supabase.from('servicios_salud').insert({
          nombre: s,
          distrito_id: distId,
          tipo: 'Servicio',
        });
        if (!se) servicios++;
      }
      for (const b of node.barrios) {
        const bk = `${distId}|${b}`;
        if (barrioKeySeen.has(bk)) continue;
        barrioKeySeen.add(bk);
        const { error: be } = await supabase.from('barrios').insert({ nombre: b, distrito_id: distId });
        if (!be) barrios++;
      }
    }
  }
  console.log(`✅ Catálogo: ${regionIdByName.size} regiones, ${distritoIdByKey.size} distritos, ${servicios} servicios, ${barrios} barrios`);
}

async function importNominaStream(filePath) {
  console.log('\n📂 Nómina (streaming):', filePath);
  if (!fs.existsSync(filePath)) {
    console.error('No existe el archivo de nómina');
    return;
  }

  console.log('Vaciando base_personas…');
  await supabase.from('base_personas').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    worksheets: 'emit',
  });

  let headers = [];
  let rowIndex = 0;
  let valid = 0;
  let failed = 0;
  let batch = [];
  const BATCH = 400;

  for await (const worksheet of reader) {
    for await (const row of worksheet) {
      rowIndex++;
      const vals = row.values;
      if (rowIndex === 1) {
        headers = vals.slice(1).map((h) => (h != null ? String(h).trim() : ''));
        continue;
      }
      const obj = {};
      for (let c = 1; c < vals.length; c++) {
        const h = headers[c - 1];
        if (h) obj[h] = vals[c];
      }
      const p = mapPersona(obj);
      if (!validPersona(p)) {
        failed++;
        continue;
      }
      batch.push({
        nombre: p.nombre,
        tipo_documento: p.tipo_documento,
        documento: p.documento,
        fecha_nacimiento: p.fecha_nacimiento,
        sexo: p.sexo,
        region_sanitaria: p.region_sanitaria,
        distrito: p.distrito,
        servicio_salud: p.servicio_salud,
        documento_madre: p.documento_madre,
        nombre_madre: p.nombre_madre,
      });

      if (batch.length >= BATCH) {
        const { error } = await supabase.from('base_personas').insert(batch);
        if (error) {
          console.error('Lote', error.message);
          failed += batch.length;
        } else valid += batch.length;
        batch = [];
        if (valid % 20000 === 0 && valid > 0) console.log(`  … ${valid.toLocaleString('es-PY')} personas`);
      }
    }
    break;
  }

  if (batch.length) {
    const { error } = await supabase.from('base_personas').insert(batch);
    if (error) {
      console.error('Lote final', error.message);
      failed += batch.length;
    } else valid += batch.length;
  }

  console.log(`✅ Nómina: ${valid.toLocaleString('es-PY')} importadas, ${failed.toLocaleString('es-PY')} omitidas/fallidas`);
}

async function main() {
  console.log('Supabase:', url);
  if (!soloNomina) await importCatalogo(UNIDADES_PATH);
  if (!soloCatalogo) await importNominaStream(NOMINA_PATH);
  console.log('\nListo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
