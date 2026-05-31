/** Mapeo fila Excel/CSV → base_personas (compartido por scripts de importación). */
import { historialSprFromExcelRow } from './padron-spr-import.mjs';
import { resolveSexo } from './infer-sexo.mjs';

export function normKey(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function pick(row, ...aliases) {
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

export function excelDateToIso(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && value > 20000 && value < 60000) {
    return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s || null;
}

function toInt(v) {
  if (!v) return null;
  const n = parseInt(String(v).replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export function mapPersona(row) {
  const nombre =
    pick(row, 'nombre', 'nombres_completos') ||
    joinParts(
      pick(row, 'nombre1', 'primer_nombre'),
      pick(row, 'nombre2', 'segundo_nombre'),
      pick(row, 'apellido1', 'primer_apellido'),
      pick(row, 'apellido2', 'segundo_apellido')
    );
  const doc = pick(row, 'documento', 'ci').replace(/\s/g, '');
  const tipo =
    (pick(row, 'tipo_documento', 'tipo doc') || (doc.startsWith('RN') ? 'RN' : 'CI')).toUpperCase();
  const sexoRaw = pick(row, 'sexo', 'genero', 'género');
  const sexo = resolveSexo(sexoRaw || null, nombre);
  const nombreMadre =
    pick(row, 'nombre_madre', 'madre_nombre', 'madre') ||
    joinParts(
      pick(row, 'madre_nombre1'),
      pick(row, 'madre_nombre2'),
      pick(row, 'madre_apellido1'),
      pick(row, 'madre_apellido2')
    );
  const spr = historialSprFromExcelRow(row);
  return {
    nombre,
    tipo_documento: tipo,
    documento: doc,
    fecha_nacimiento: excelDateToIso(
      pick(row, 'fecha_nacimiento', 'fecha_nac', 'nacimiento') || row.fecha_nacimiento
    ),
    sexo,
    region_sanitaria:
      pick(row, 'region_sanitaria', 'region', 'región', 'departamento') || 'Sin región',
    distrito: pick(row, 'distrito', 'municipio') || 'Sin distrito',
    servicio_salud: pick(row, 'servicio_salud', 'servicio de salud', 'servicio') || 'Sin servicio',
    documento_madre: pick(row, 'documento_madre', 'madre_documento').replace(/\D/g, '') || null,
    nombre_madre: nombreMadre || null,
    edad_anos: spr?.edad_anos ?? toInt(pick(row, 'edad_anos', 'edad anos', 'edad_años', 'años')),
    edad_meses: spr?.edad_meses ?? toInt(pick(row, 'edad_en_meses', 'edad_meses', 'meses')),
    historial_spr: spr,
  };
}

export function validPersona(p) {
  return (
    p.nombre &&
    p.tipo_documento &&
    p.documento &&
    p.fecha_nacimiento &&
    p.region_sanitaria &&
    p.distrito &&
    p.servicio_salud
  );
}
