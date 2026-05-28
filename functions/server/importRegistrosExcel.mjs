import { randomUUID } from 'crypto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseBool(val) {
  const s = String(val ?? '')
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (s === 'sí' || s === 'si' || s === 'true' || s === '1') return true;
  if (s === 'no' || s === 'false' || s === '0') return false;
  return null;
}

export function parseFechaHoraExcel(val) {
  if (val == null || val === '') return new Date().toISOString();
  if (typeof val === 'number' && Number.isFinite(val)) {
    const epoch = new Date((val - 25569) * 86400 * 1000);
    if (!Number.isNaN(epoch.getTime())) return epoch.toISOString();
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 12), +(m[5] || 0));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function parseFechaNacimientoExcel(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    const epoch = new Date((val - 25569) * 86400 * 1000);
    if (!Number.isNaN(epoch.getTime())) return epoch.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : null;
}

export function mapExcelRowToRegistro(row, fallbackUserId) {
  const nombre = String(row.nombre_nino ?? row.nombre ?? '').trim();
  const documento = String(row.documento ?? '').trim();
  const region = String(row.region ?? '').trim();
  const distrito = String(row.distrito ?? '').trim();
  if (!nombre && !documento) return null;
  if (!region || !distrito) return null;

  const cambio = parseBool(row.cambio_residencia) === true;
  let observaciones = String(row.observaciones ?? '').trim();
  if (cambio && !observaciones.includes('[Cambio de residencia]')) {
    observaciones = observaciones ? `[Cambio de residencia] · ${observaciones}` : '[Cambio de residencia]';
  }

  const estadoRaw = String(row.estado_vacuna ?? row.estado_vacunacion ?? 'no_vacunado')
    .trim()
    .toLowerCase();
  const estado = estadoRaw === 'vacunado' ? 'vacunado' : 'no_vacunado';
  const registroId = String(row.registro_id ?? row.id ?? '').trim();
  const userId = String(row.user_id ?? '').trim();
  const uid = UUID_RE.test(userId) ? userId : fallbackUserId;

  return {
    id: UUID_RE.test(registroId) ? registroId : randomUUID(),
    user_id: uid,
    fecha_hora: parseFechaHoraExcel(row.fecha_hora),
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
  };
}

export async function upsertRegistroRow(query, r) {
  await query(
    `INSERT INTO registros_vacunacion (
      id, user_id, fecha_hora, region, distrito, servicio, barrio, responsable,
      nombre, documento, fecha_nacimiento, edad, sexo, libreta, estado_vacuna, motivo,
      latitud, longitud, tipo_vivienda, esquema_completo, fuente_verificacion, accion_tomada,
      observaciones, fecha_dosis_spr, dosis_spr, estado_intervencion, tiene_cvs, tipo_documento
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
    ON CONFLICT (id) DO UPDATE SET
      fecha_hora = EXCLUDED.fecha_hora,
      region = EXCLUDED.region,
      distrito = EXCLUDED.distrito,
      servicio = EXCLUDED.servicio,
      barrio = EXCLUDED.barrio,
      nombre = EXCLUDED.nombre,
      documento = EXCLUDED.documento,
      estado_vacuna = EXCLUDED.estado_vacuna,
      motivo = EXCLUDED.motivo,
      observaciones = EXCLUDED.observaciones,
      latitud = EXCLUDED.latitud,
      longitud = EXCLUDED.longitud`,
    [
      r.id,
      r.user_id,
      r.fecha_hora,
      r.region,
      r.distrito,
      r.servicio,
      r.barrio,
      r.responsable,
      r.nombre,
      r.documento,
      r.fecha_nacimiento,
      r.edad,
      r.sexo,
      r.libreta,
      r.estado_vacuna,
      r.motivo,
      r.latitud,
      r.longitud,
      r.tipo_vivienda,
      r.esquema_completo,
      r.fuente_verificacion,
      r.accion_tomada,
      r.observaciones,
      r.fecha_dosis_spr,
      r.dosis_spr,
      r.estado_intervencion,
      r.tiene_cvs,
      r.tipo_documento,
    ]
  );
}
