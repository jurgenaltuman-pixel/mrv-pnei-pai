/** Convierte filas del Excel MRV_Registros (export) → payload API / Aiven. */

import { parseDDMMAAAA } from '@/lib/format-fecha';

const CAMBIO_TAG = '[Cambio de residencia]';

export type RegistroExcelRow = Record<string, unknown>;

function parseBool(val: unknown): boolean | null {
  const s = String(val ?? '')
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (s === 'sí' || s === 'si' || s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'no' || s === 'false' || s === '0') return false;
  return null;
}

/** dd/mm/aaaa HH:mm o ISO → ISO datetime */
export function parseFechaHoraExcel(val: unknown): string | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    const epoch = new Date((val - 25569) * 86400 * 1000);
    if (!Number.isNaN(epoch.getTime())) return epoch.toISOString();
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const year = parseInt(m[3], 10);
    const h = m[4] != null ? parseInt(m[4], 10) : 12;
    const min = m[5] != null ? parseInt(m[5], 10) : 0;
    const d = new Date(year, month, day, h, min);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

export function parseFechaNacimientoExcel(val: unknown): string | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    const epoch = new Date((val - 25569) * 86400 * 1000);
    if (!Number.isNaN(epoch.getTime())) {
      return epoch.toISOString().slice(0, 10);
    }
  }
  const s = String(val).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const py = parseDDMMAAAA(s);
  if (py) return py;
  return null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function mapExcelRowToRegistro(
  row: RegistroExcelRow,
  fallbackUserId: string
): Record<string, unknown> | null {
  const nombre = String(row.nombre_nino ?? row.nombre ?? '').trim();
  const documento = String(row.documento ?? '').trim();
  const region = String(row.region ?? '').trim();
  const distrito = String(row.distrito ?? '').trim();
  if (!nombre && !documento) return null;
  if (!region || !distrito) return null;

  const cambio = parseBool(row.cambio_residencia) === true;
  let observaciones = String(row.observaciones ?? '').trim();
  if (cambio && !observaciones.includes(CAMBIO_TAG)) {
    observaciones = observaciones ? `${CAMBIO_TAG} · ${observaciones}` : CAMBIO_TAG;
  }

  const estadoRaw = String(row.estado_vacuna ?? row.estado_vacunacion ?? 'no_vacunado')
    .trim()
    .toLowerCase();
  const estado = estadoRaw === 'vacunado' ? 'vacunado' : 'no_vacunado';

  const registroId = String(row.registro_id ?? row.id ?? '').trim();
  const userId = String(row.user_id ?? '').trim();
  const uid = UUID_RE.test(userId) ? userId : fallbackUserId;

  const payload: Record<string, unknown> = {
    user_id: uid,
    region,
    distrito,
    servicio: String(row.servicio_salud ?? row.servicio ?? '').trim() || null,
    barrio: String(row.barrio ?? '').trim() || null,
    responsable: String(row.responsable ?? '').trim() || null,
    nombre: nombre || documento,
    documento: documento || 'SIN-DOC',
    fecha_nacimiento: parseFechaNacimientoExcel(row.fecha_nacimiento),
    edad: String(row.edad ?? '').trim() || null,
    sexo: String(row.sexo ?? 'M').trim().toUpperCase().slice(0, 1) || 'M',
    libreta: parseBool(row.libreta_vacunacion ?? row.libreta) ?? false,
    estado_vacuna: estado,
    motivo: String(row.motivo ?? '').trim() || null,
    latitud: row.latitud != null && row.latitud !== '' ? Number(row.latitud) : null,
    longitud: row.longitud != null && row.longitud !== '' ? Number(row.longitud) : null,
    tipo_vivienda: String(row.tipo_vivienda ?? '').trim() || null,
    esquema_completo: parseBool(row.esquema_completo),
    fuente_verificacion: String(row.fuente_verificacion ?? '').trim() || null,
    accion_tomada: String(row.accion_tomada ?? '').trim() || null,
    observaciones: observaciones || null,
    fecha_dosis_spr: parseFechaNacimientoExcel(row.fecha_dosis_spr),
    dosis_spr: String(row.dosis_spr ?? '').trim() || null,
    estado_intervencion: String(row.estado_intervencion ?? '').trim() || null,
    tiene_cvs: parseBool(row.tiene_cvs),
    tipo_documento: String(row.tipo_documento ?? '').trim() || null,
    fecha_hora: parseFechaHoraExcel(row.fecha_hora),
  };

  if (UUID_RE.test(registroId)) {
    payload.id = registroId;
  }

  return payload;
}

export function mapExcelRowsToRegistros(
  rows: RegistroExcelRow[],
  fallbackUserId: string
): Record<string, unknown>[] {
  return rows
    .map((r) => mapExcelRowToRegistro(r, fallbackUserId))
    .filter((r): r is Record<string, unknown> => r != null);
}
