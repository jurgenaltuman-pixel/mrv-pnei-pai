/** Fechas Paraguay: visualización dd/mm/aaaa y DDMMAAAA · ISO yyyy-mm-dd en API/BD · hora 24 h. */



const RE_DDMMYYYY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

const RE_DDMMYY = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;

const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

const RE_DDMMAAAA = /^(\d{2})(\d{2})(\d{4})$/;



function pad2(n: number): string {

  return String(n).padStart(2, '0');

}



/** ISO → DDMMAAAA (ej. 2015-03-15 → 15032015). */

export function isoToDDMMAAAA(iso: string | null | undefined): string | null {

  const normalized = normalizeToIsoDate(iso);

  if (!normalized) return null;

  const m = normalized.match(RE_ISO);

  if (!m) return null;

  return `${m[3]}${m[2]}${m[1]}`;

}



/** DDMMAAAA o dd/mm/aaaa → ISO yyyy-mm-dd. */

export function parseDDMMAAAA(input: string): string | null {

  const s = String(input || '').trim();

  if (!s) return null;

  if (RE_ISO.test(s)) return s.slice(0, 10);



  const compact = s.replace(/\D/g, '');

  if (compact.length === 8) {

    const m = compact.match(RE_DDMMAAAA);

    if (!m) return null;

    const day = parseInt(m[1], 10);

    const month = parseInt(m[2], 10);

    const year = parseInt(m[3], 10);

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const d = new Date(year, month - 1, day);

    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;

    return `${year}-${pad2(month)}-${pad2(day)}`;

  }



  const m4 = s.match(RE_DDMMYYYY);

  if (m4) {

    const day = parseInt(m4[1], 10);

    const month = parseInt(m4[2], 10);

    const year = parseInt(m4[3], 10);

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const d = new Date(year, month - 1, day);

    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;

    return `${year}-${pad2(month)}-${pad2(day)}`;

  }



  const m2 = s.match(RE_DDMMYY);

  if (m2) {

    const day = parseInt(m2[1], 10);

    const month = parseInt(m2[2], 10);

    let year = parseInt(m2[3], 10);

    if (m2[3].length === 2) year = year >= 30 ? 1900 + year : 2000 + year;

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const d = new Date(year, month - 1, day);

    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;

    return `${year}-${pad2(month)}-${pad2(day)}`;

  }



  return null;

}



/** @alias parseDDMMAAAA */

export function parseFechaPyToIso(input: string): string | null {

  return parseDDMMAAAA(input);

}



/** ISO o Date → dd/mm/aaaa */

export function formatFechaPy(value: string | Date | null | undefined): string {

  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {

    return `${pad2(value.getDate())}/${pad2(value.getMonth() + 1)}/${value.getFullYear()}`;

  }

  const iso = normalizeToIsoDate(value);

  if (!iso) return String(value).trim();

  const m = iso.match(RE_ISO);

  if (!m) return '';

  return `${m[3]}/${m[2]}/${m[1]}`;

}



/** ISO datetime → dd/mm/aaaa HH:mm (24 h). */

export function formatFechaHoraPy(value: string | Date | null | undefined): string {

  if (!value) return '';

  const d = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(d.getTime())) return String(value);

  const fecha = formatFechaPy(d);

  const hora = d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false });

  return `${fecha} ${hora}`;

}



export function esFechaPyValida(input: string): boolean {

  return parseDDMMAAAA(input) !== null;

}



export function isoToDateInputValue(iso: string | null | undefined): string {

  if (!iso) return '';

  const m = String(iso).match(RE_ISO);

  return m ? m[0] : parseDDMMAAAA(iso) || '';

}



export function normalizeToIsoDate(value: string | Date | null | undefined): string {

  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {

    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;

  }

  const s = String(value).trim();

  if (!s) return '';

  const isoPrefix = s.match(/^(\d{4}-\d{2}-\d{2})/);

  if (isoPrefix) return isoPrefix[1];

  const fromPy = parseDDMMAAAA(s);

  if (fromPy) return fromPy;

  const d = new Date(s);

  if (!Number.isNaN(d.getTime())) return normalizeToIsoDate(d);

  return '';

}



export function fechaNacimientoFromEdadNominal(

  edadAnos?: number | null,

  edadMeses?: number | null

): string {

  if (edadAnos == null && edadMeses == null) return '';

  const hoy = new Date();

  const totalMeses = (edadAnos ?? 0) * 12 + (edadMeses ?? 0);

  if (totalMeses <= 0) return '';

  const fn = new Date(hoy.getFullYear(), hoy.getMonth() - totalMeses, hoy.getDate());

  return normalizeToIsoDate(fn);

}



/** Máscara visual mientras se escribe: dd/mm/aaaa */

export function maskFechaDDMMAAAAInput(raw: string): string {

  const digits = raw.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) return digits;

  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;

}


