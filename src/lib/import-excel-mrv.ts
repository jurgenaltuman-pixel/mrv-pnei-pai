/**
 * Normaliza filas de Excel MRV (plantilla oficial o exportación PNEI).
 */
import type { PersonaImportRow, UnitImportRow } from '@/services/importService';

function normKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function pick(row: Record<string, unknown>, ...aliases: string[]): string {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    map.set(normKey(k), v);
  }
  for (const a of aliases) {
    const v = map.get(normKey(a));
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function joinParts(...parts: string[]): string {
  return parts.map((p) => p.trim()).filter((p) => p && p !== '-').join(' ');
}

export function excelValueToIsoDate(value: unknown): string {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && value > 20000 && value < 60000) {
    const utc = new Date(Math.round((value - 25569) * 86400 * 1000));
    return utc.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}

export function normalizeTipoDocumento(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (t === 'CI' || t.includes('CEDULA') || t.includes('CÉDULA')) return 'CI';
  if (t === 'DEX' || t.includes('EXTRANJ')) return 'DEX';
  if (t === 'OTR' || t.includes('OTRO')) return 'OTR';
  return t.length <= 4 ? t : 'CI';
}

export function normalizeSexo(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (t === 'M' || t.startsWith('MASC')) return 'M';
  if (t === 'F' || t.startsWith('FEM')) return 'F';
  return t.slice(0, 1);
}

/** Fila de catálogo → region, distrito, servicio_salud, barrio */
export function mapUnitImportRow(row: Record<string, unknown>): UnitImportRow {
  return {
    region: pick(row, 'region', 'región', 'region_sanitaria', 'region sanitaria'),
    distrito: pick(row, 'distrito', 'municipio', 'departamento'),
    servicio_salud: pick(row, 'servicio_salud', 'servicio de salud', 'servicio', 'establecimiento'),
    barrio: pick(row, 'barrio', 'localidad', 'comunidad') || undefined,
  };
}

/** Fila de nómina → PersonaImportRow (nombre completo + madre) */
export function mapPersonaImportRow(row: Record<string, unknown>): PersonaImportRow {
  const nombre =
    pick(row, 'nombre', 'nombres_completos', 'nombre_completo') ||
    joinParts(
      pick(row, 'nombre1', 'primer_nombre'),
      pick(row, 'nombre2', 'segundo_nombre'),
      pick(row, 'apellido1', 'primer_apellido'),
      pick(row, 'apellido2', 'segundo_apellido')
    );

  const nombreMadre =
    pick(row, 'nombre_madre', 'madre_nombre') ||
    joinParts(
      pick(row, 'madre_nombre1'),
      pick(row, 'madre_nombre2'),
      pick(row, 'madre_apellido1'),
      pick(row, 'madre_apellido2')
    );

  const distrito =
    pick(row, 'distrito', 'municipio') || pick(row, 'departamento');

  return {
    nombre,
    tipo_documento: normalizeTipoDocumento(pick(row, 'tipo_documento', 'tipo documento', 'tipo_doc')),
    documento: pick(row, 'documento', 'ci', 'nro_documento', 'numero_documento').replace(/\s/g, ''),
    fecha_nacimiento: excelValueToIsoDate(row.fecha_nacimiento ?? row['fecha nacimiento']),
    sexo: normalizeSexo(pick(row, 'sexo', 'genero', 'género')),
    region_sanitaria: pick(row, 'region_sanitaria', 'region', 'región', 'region sanitaria'),
    distrito,
    servicio_salud: pick(row, 'servicio_salud', 'servicio de salud', 'servicio'),
    documento_madre:
      pick(row, 'documento_madre', 'madre_documento', 'ci_madre', 'documento madre').replace(/\D/g, '') ||
      undefined,
    nombre_madre: nombreMadre || undefined,
  };
}

export function mapUnitRows(rows: Record<string, unknown>[]): UnitImportRow[] {
  return rows.map(mapUnitImportRow);
}

export function mapPersonaRows(rows: Record<string, unknown>[]): PersonaImportRow[] {
  return rows.map(mapPersonaImportRow);
}
