import * as XLSX from 'xlsx';
import type { RegistroMRV } from '@/services/dataService';
import { formatFechaHoraPy, formatFechaPy } from '@/lib/format-fecha';
import { saveBlobAsFile } from '@/lib/download-file';
import { appendMetaSheet, buildLabeledExcelRows, jsonSheetWithCols, type ExcelColumnDef } from '@/lib/xlsx-report-utils';
import { getVisitaCode } from '@/lib/visita-filter';

const CAMBIO_TAG = '[Cambio de residencia]';

export const REGISTROS_EXCEL_COLUMNS: ExcelColumnDef[] = [
  { key: 'fecha_hora', label: 'Fecha y hora', core: true },
  { key: 'region', label: 'Región', core: true },
  { key: 'distrito', label: 'Distrito', core: true },
  { key: 'servicio_salud', label: 'Servicio de salud', core: true },
  { key: 'barrio', label: 'Barrio', core: true },
  { key: 'responsable', label: 'Responsable', core: true },
  { key: 'tipo_vivienda', label: 'Casa (E/N/F/R)', core: true },
  { key: 'nombre_nino', label: 'Nombre niño/a', core: true },
  { key: 'tipo_documento', label: 'Tipo documento' },
  { key: 'documento', label: 'Documento', core: true },
  { key: 'fecha_nacimiento', label: 'Fecha nacimiento', core: true },
  { key: 'edad', label: 'Edad (años)' },
  { key: 'sexo', label: 'Sexo', core: true },
  { key: 'estado_vacuna', label: 'Estado vacuna', core: true },
  { key: 'motivo', label: 'Motivo / acción' },
  { key: 'dosis_spr', label: 'Dosis SPR' },
  { key: 'fecha_dosis_spr', label: 'Fecha dosis SPR' },
  { key: 'esquema_completo', label: 'Esquema completo' },
  { key: 'libreta_vacunacion', label: 'Libreta vacunación' },
  { key: 'fuente_verificacion', label: 'Fuente verificación' },
  { key: 'tiene_cvs', label: 'Tiene CVS' },
  { key: 'accion_tomada', label: 'Acción tomada' },
  { key: 'estado_intervencion', label: 'Estado intervención' },
  { key: 'cambio_residencia', label: 'Cambio residencia' },
  { key: 'observaciones', label: 'Observaciones' },
  { key: 'tiene_gps', label: 'Tiene GPS', core: true },
  { key: 'latitud', label: 'Latitud WGS84', core: true },
  { key: 'longitud', label: 'Longitud WGS84', core: true },
  { key: 'coordenadas_wgs84', label: 'Coordenadas WGS84' },
  { key: 'enlace_google_maps', label: 'Enlace Google Maps' },
  { key: 'transcripcion_clip', label: 'Transcripción clip' },
  { key: 'enlace_imagen_1', label: 'Imagen 1 (Drive)' },
  { key: 'enlace_imagen_2', label: 'Imagen 2 (Drive)' },
  { key: 'registro_id', label: 'ID registro' },
  { key: 'user_id', label: 'ID usuario' },
];

export function parseCambioResidencia(observaciones: string | null | undefined): {
  cambio: boolean;
  observacionesLimpias: string;
} {
  const raw = (observaciones || '').trim();
  if (!raw.includes(CAMBIO_TAG)) {
    return { cambio: false, observacionesLimpias: raw };
  }
  const cambio = raw.includes(CAMBIO_TAG);
  return {
    cambio,
    observacionesLimpias: raw
      .replace(CAMBIO_TAG, '')
      .replace(/^\s*·\s*|\s*·\s*$/g, '')
      .trim(),
  };
}

function boolTxt(v: boolean | null | undefined): string {
  if (v === true) return 'Sí';
  if (v === false) return 'No';
  return '';
}

function calcEdadAnios(fechaNacimiento: string | null | undefined, edadRaw: string | null | undefined): string {
  if (edadRaw != null && String(edadRaw).trim() !== '') return String(edadRaw).trim();
  const iso = (fechaNacimiento || '').slice(0, 10);
  if (!iso) return '';
  const birth = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age <= 120 ? String(age) : '';
}

function estadoVacunaLabel(v: string | null | undefined): string {
  if (v === 'vacunado') return 'Vacunado';
  if (v === 'no_vacunado') return 'No vacunado';
  return v || '';
}

function estadoIntervencionLabel(v: string | null | undefined): string {
  if (!v) return '';
  if (v === 'rechazo_vacunacion') return 'Rechazo a la vacunación';
  return v.replace(/_/g, ' ');
}

function tipoViviendaLabel(r: RegistroMRV): string {
  const code = getVisitaCode(r);
  if (code) return code;
  return r.tipo_vivienda || '';
}

/** WGS84 con 6 decimales (≈ 11 cm) — adecuado para Google Maps. */
export function formatCoordWgs84(v: number | null | undefined): number | '' {
  if (v == null || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  if (n < -180 || n > 180) return '';
  return Math.round(n * 1_000_000) / 1_000_000;
}

export function coordenadasValidas(lat: number | null | undefined, lng: number | null | undefined): boolean {
  const la = Number(lat);
  const lo = Number(lng);
  return (
    Number.isFinite(la) &&
    Number.isFinite(lo) &&
    la >= -90 &&
    la <= 90 &&
    lo >= -180 &&
    lo <= 180 &&
    !(la === 0 && lo === 0)
  );
}

export function enlaceGoogleMaps(lat: number | null | undefined, lng: number | null | undefined): string {
  if (!coordenadasValidas(lat, lng)) return '';
  const la = formatCoordWgs84(lat);
  const lo = formatCoordWgs84(lng);
  if (la === '' || lo === '') return '';
  return `https://www.google.com/maps?q=${la},${lo}`;
}

export function mapApiRowToRegistroMRV(row: Record<string, unknown>): RegistroMRV {
  const estadoRaw = String(row.estado_vacuna ?? row.estado_vacunacion ?? 'no_vacunado').toLowerCase();
  return {
    id: row.id != null ? String(row.id) : undefined,
    user_id: row.user_id != null ? String(row.user_id) : undefined,
    fecha_hora: row.fecha_hora != null ? String(row.fecha_hora) : undefined,
    region: String(row.region || ''),
    distrito: String(row.distrito || ''),
    servicio: row.servicio != null ? String(row.servicio) : null,
    barrio: row.barrio != null ? String(row.barrio) : null,
    responsable: row.responsable != null ? String(row.responsable) : null,
    nombre: String(row.nombre || ''),
    documento: String(row.documento || ''),
    fecha_nacimiento: String(row.fecha_nacimiento || '').slice(0, 10),
    edad: row.edad != null ? String(row.edad) : null,
    sexo: String(row.sexo || ''),
    libreta: row.libreta === true || row.libreta === 'true',
    estado_vacuna: estadoRaw === 'vacunado' ? 'vacunado' : 'no_vacunado',
    motivo: row.motivo != null ? String(row.motivo) : null,
    latitud: row.latitud != null && row.latitud !== '' ? Number(row.latitud) : null,
    longitud: row.longitud != null && row.longitud !== '' ? Number(row.longitud) : null,
    tipo_vivienda: (row.tipo_vivienda as RegistroMRV['tipo_vivienda']) ?? null,
    esquema_completo:
      row.esquema_completo === true || row.esquema_completo === 'true'
        ? true
        : row.esquema_completo === false || row.esquema_completo === 'false'
          ? false
          : null,
    fuente_verificacion: row.fuente_verificacion != null ? String(row.fuente_verificacion) : null,
    accion_tomada: row.accion_tomada != null ? String(row.accion_tomada) : null,
    observaciones: row.observaciones != null ? String(row.observaciones) : null,
    fecha_dosis_spr: row.fecha_dosis_spr != null ? String(row.fecha_dosis_spr).slice(0, 10) : null,
    dosis_spr: row.dosis_spr != null ? String(row.dosis_spr) : null,
    estado_intervencion: row.estado_intervencion != null ? String(row.estado_intervencion) : null,
    tiene_cvs:
      row.tiene_cvs === true || row.tiene_cvs === 'true'
        ? true
        : row.tiene_cvs === false || row.tiene_cvs === 'false'
          ? false
          : null,
    tipo_documento: row.tipo_documento != null ? String(row.tipo_documento) : null,
    transcripcion_clip: row.transcripcion_clip != null ? String(row.transcripcion_clip) : null,
    enlace_imagen_1: row.enlace_imagen_1 != null ? String(row.enlace_imagen_1) : null,
    enlace_imagen_2: row.enlace_imagen_2 != null ? String(row.enlace_imagen_2) : null,
  };
}

/** Fila técnica completa; columnas vacías se omiten al exportar (salvo core). */
export function registroToExcelRow(r: RegistroMRV & { tipo_documento?: string | null }) {
  const { cambio, observacionesLimpias } = parseCambioResidencia(r.observaciones);
  const lat = formatCoordWgs84(r.latitud);
  const lng = formatCoordWgs84(r.longitud);
  const tieneGps = coordenadasValidas(r.latitud, r.longitud);
  const mapsUrl = enlaceGoogleMaps(r.latitud, r.longitud);
  const code = getVisitaCode(r);
  const edad = calcEdadAnios(r.fecha_nacimiento, r.edad);

  return {
    registro_id: r.id || '',
    user_id: r.user_id || '',
    fecha_hora: r.fecha_hora ? formatFechaHoraPy(r.fecha_hora) : '',
    region: r.region || '',
    distrito: r.distrito || '',
    servicio_salud: r.servicio || '',
    barrio: r.barrio || '',
    responsable: r.responsable || '',
    cambio_residencia: cambio ? 'Sí' : 'No',
    nombre_nino: r.nombre || '',
    tipo_documento: r.tipo_documento || '',
    documento: r.documento || '',
    fecha_nacimiento: r.fecha_nacimiento ? formatFechaPy(r.fecha_nacimiento) : '',
    edad,
    sexo: r.sexo || '',
    libreta_vacunacion: boolTxt(r.libreta),
    fuente_verificacion: r.fuente_verificacion || '',
    tiene_cvs: code === 'E' || !code ? boolTxt(r.tiene_cvs) : '',
    dosis_spr: r.dosis_spr || '',
    fecha_dosis_spr: r.fecha_dosis_spr ? formatFechaPy(r.fecha_dosis_spr) : '',
    estado_vacuna: code === 'N' || code === 'F' || code === 'R' ? '' : estadoVacunaLabel(r.estado_vacuna),
    esquema_completo: code === 'E' || !code ? boolTxt(r.esquema_completo) : '',
    motivo: r.motivo || '',
    accion_tomada: r.accion_tomada || '',
    estado_intervencion: estadoIntervencionLabel(r.estado_intervencion),
    tipo_vivienda: tipoViviendaLabel(r),
    observaciones: observacionesLimpias,
    tiene_gps: tieneGps ? 'Sí' : 'No',
    latitud: lat,
    longitud: lng,
    coordenadas_wgs84: tieneGps ? `${lat},${lng}` : '',
    enlace_google_maps: mapsUrl,
    transcripcion_clip: r.transcripcion_clip || '',
    enlace_imagen_1: r.enlace_imagen_1 || '',
    enlace_imagen_2: r.enlace_imagen_2 || '',
  };
}

export function downloadRegistrosExcel(
  registros: (RegistroMRV & { tipo_documento?: string | null })[],
  filenamePrefix = 'MRV_Registros',
  meta?: { nota?: string; total?: number; filtros?: string }
) {
  const rawRows = registros.map(registroToExcelRow);
  const rows = buildLabeledExcelRows(rawRows, REGISTROS_EXCEL_COLUMNS);
  const wb = XLSX.utils.book_new();
  jsonSheetWithCols(wb, rows, 'Registros');
  appendMetaSheet(wb, [
    { campo: 'Sistema', valor: 'MRV — Monitoreo Rápido de Vacunación · MSPBS' },
    { campo: 'Generado', valor: formatFechaHoraPy(new Date()) },
    { campo: 'Total filas', valor: String(meta?.total ?? registros.length) },
    { campo: 'Columnas', valor: 'Solo se incluyen columnas con datos (excepto campos base). Etiquetas en español.' },
    ...(meta?.filtros ? [{ campo: 'Filtros aplicados', valor: meta.filtros }] : []),
    {
      campo: 'Nota GPS',
      valor:
        meta?.nota ||
        'Coordenadas WGS84 (lat, lon). «Enlace Google Maps» abre la ubicación. Columnas vacías en todo el lote no se exportan.',
    },
  ]);

  const fn = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  void saveBlobAsFile(fn, blob);
}
