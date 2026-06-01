/** Parseo heurístico de texto OCR de cédula paraguaya (niño/a o madre). */

export type CedulaOcrTarget = 'nino' | 'madre';

export type CedulaOcrFields = {
  rawText: string;
  documento: string | null;
  nombre: string | null;
  fechaNacimiento: string | null;
  sexo: 'M' | 'F' | null;
  documentoMadre: string | null;
  warnings: string[];
};

const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function normalizeCiDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidCi(digits: string): boolean {
  return /^\d{6,8}$/.test(digits);
}

function normalizeText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\r/g, '\n')
    .toUpperCase();
}

function isoFromDmy(d: number, m: number, y: number): string | null {
  if (y < 1900 || y > new Date().getFullYear() + 1) return null;
  if (m < 1 || m > 12 || d < 1 || d > MONTH_DAYS[m - 1]) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function extractFechaNacimiento(text: string): string | null {
  const t = normalizeText(text);
  const labeled = t.match(
    /(?:FECHA\s*(?:DE\s*)?NAC(?:IMIENTO)?|NAC(?:IMIENTO)?|F\.?\s*N\.?)[:\s]*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/
  );
  if (labeled) {
    const iso = isoFromDmy(Number(labeled[1]), Number(labeled[2]), Number(labeled[3]));
    if (iso) return iso;
  }
  const dates = [...t.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g)];
  for (const m of dates) {
    const iso = isoFromDmy(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) return iso;
  }
  return null;
}

export function extractSexo(text: string): 'M' | 'F' | null {
  const t = normalizeText(text);
  if (/\b(FEMENINO|SEXO\s*[:.\s]*F\b)/m.test(t)) return 'F';
  if (/\b(MASCULINO|SEXO\s*[:.\s]*M\b)/m.test(t)) return 'M';
  return null;
}

export function extractCiCandidates(text: string): string[] {
  const t = normalizeText(text);
  const found = new Set<string>();
  const patterns = [
    /\bC\.?\s*I\.?\s*N[°O.]?\s*[:.\s]*([\d.\s-]{6,14})/g,
    /\bDOC(?:UMENTO)?\.?\s*[:.\s]*([\d.\s-]{6,14})/g,
    /\b(\d{1,3}[.\s]\d{3}[.\s]\d{3})\b/g,
    /\b(\d{6,8})\b/g,
  ];
  for (const re of patterns) {
    for (const m of t.matchAll(re)) {
      const digits = normalizeCiDigits(m[1]);
      if (isValidCi(digits)) found.add(digits);
    }
  }
  return [...found];
}

function cleanNameLine(line: string): string {
  return line
    .replace(/^(APELLIDOS?|NOMBRES?|A\.?\s*Y\s*N\.?|APELLIDO\s*Y\s*NOMBRE)[:\s]*/i, '')
    .replace(/[^A-ZÑ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractNombre(text: string): string | null {
  const rawLines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const lines = rawLines.map((l) => normalizeText(l));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^NOMBRES?\s*[:.]/.test(line)) {
      const n = cleanNameLine(line);
      const a =
        i > 0 && /^APELLIDOS?\s*[:.]/.test(lines[i - 1]) ? cleanNameLine(lines[i - 1]) : '';
      const full = [a, n].filter(Boolean).join(' ').trim();
      if (full.length >= 6) return full;
    }
    if (/^APELLIDOS?\s*[:.]/.test(line) && i + 1 < lines.length && /^NOMBRES?\s*[:.]/.test(lines[i + 1])) {
      const full = `${cleanNameLine(line)} ${cleanNameLine(lines[i + 1])}`.trim();
      if (full.length >= 6) return full;
    }
    if (/^APELLIDO\s*Y\s*NOMBRE\s*[:.]/.test(line)) {
      const full = cleanNameLine(line);
      if (full.length >= 6) return full;
    }
  }

  const candidates = lines
    .map(cleanNameLine)
    .filter(
      (l) =>
        l.length >= 8 &&
        /^[A-ZÑ ]+$/.test(l) &&
        !/REPUBLICA|PARAGUAY|IDENTIDAD|REGISTRO|CEDULA/.test(l)
    );
  if (candidates.length) {
    return candidates.sort((a, b) => b.length - a.length)[0];
  }
  return null;
}

export function parseCedulaOcrText(rawText: string, target: CedulaOcrTarget = 'nino'): CedulaOcrFields {
  const warnings: string[] = [];
  const cis = extractCiCandidates(rawText);
  let documento: string | null = null;
  let documentoMadre: string | null = null;

  if (target === 'madre') {
    documentoMadre = cis[0] ?? null;
    if (!documentoMadre) warnings.push('No se detectó número de CI en la foto.');
  } else {
    documento = cis[0] ?? null;
    if (cis.length > 1) documentoMadre = cis[1];
    const t = normalizeText(rawText);
    const madreMatch = t.match(/(?:MADRE|CI\s*MADRE|DOC\.?\s*MADRE)[:\s]*([\d.\s-]{6,14})/);
    if (madreMatch) {
      const d = normalizeCiDigits(madreMatch[1]);
      if (isValidCi(d)) documentoMadre = d;
    }
    if (!documento) warnings.push('No se detectó CI del niño/a. Revisá el número manualmente.');
  }

  const nombre = extractNombre(rawText);
  if (!nombre) warnings.push('No se detectó nombre completo. Completá manualmente.');

  const fechaNacimiento = target === 'nino' ? extractFechaNacimiento(rawText) : null;
  if (target === 'nino' && !fechaNacimiento) warnings.push('No se detectó fecha de nacimiento.');

  const sexo = target === 'nino' ? extractSexo(rawText) : null;

  return {
    rawText,
    documento: target === 'nino' ? documento : null,
    nombre,
    fechaNacimiento,
    sexo,
    documentoMadre,
    warnings,
  };
}
