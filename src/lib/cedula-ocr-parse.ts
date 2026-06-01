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
  return fixOcrDigitConfusions(raw).replace(/\D/g, '');
}

/** Corrige confusiones típicas de OCR en números de CI. */
export function fixOcrDigitConfusions(raw: string): string {
  return raw
    .replace(/[OoQ]/g, '0')
    .replace(/[Il|¡!]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss$]/g, '5')
    .replace(/[Gg]/g, '6')
    .replace(/[Bb]/g, '8');
}

export function isValidCi(digits: string): boolean {
  return /^\d{6,8}$/.test(digits);
}

/** Normaliza etiquetas rotas por OCR antes de parsear. */
export function normalizeOcrRawText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\r/g, '\n')
    .replace(/[|]/g, 'I')
    .replace(/C\s*[\.|,]?\s*[Il1]\s*\.?\s*N[°ºoO.]?\s*/gi, 'C.I. N° ')
    .replace(/C\s*I\s*N[°ºo.]?\s*/gi, 'C.I. N° ')
    .replace(/N[°ºo]\s*°/gi, 'N° ')
    .replace(/APBLLIDOS/gi, 'APELLIDOS')
    .replace(/N0MBRES/gi, 'NOMBRES')
    .replace(/NOMBRES?\s+([A-Z])/gi, 'NOMBRES: $1')
    .replace(/APELLIDOS?\s+([A-Z])/gi, 'APELLIDOS: $1');
}

function normalizeText(raw: string): string {
  return normalizeOcrRawText(raw).toUpperCase();
}

function isoFromDmy(d: number, m: number, y: number): string | null {
  if (y < 1900 || y > new Date().getFullYear() + 1) return null;
  if (m < 1 || m > 12 || d < 1 || d > MONTH_DAYS[m - 1]) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function extractFechaNacimiento(text: string): string | null {
  const t = normalizeText(text);
  const labeled = t.match(
    /(?:FECHA\s*(?:DE\s*)?NAC(?:IMIENTO)?|NAC(?:IMIENTO)?|F\.?\s*N\.?|F\s*N)[:\s]*(\d{1,2})[/.-\s](\d{1,2})[/.-\s](\d{4})/
  );
  if (labeled) {
    const iso = isoFromDmy(Number(labeled[1]), Number(labeled[2]), Number(labeled[3]));
    if (iso) return iso;
  }
  const loose = [...t.matchAll(/\b(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})\b/g)];
  for (const m of loose) {
    const iso = isoFromDmy(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) return iso;
  }
  const compact = t.match(/\b(\d{2})(\d{2})(\d{4})\b/);
  if (compact) {
    const iso = isoFromDmy(Number(compact[1]), Number(compact[2]), Number(compact[3]));
    if (iso) return iso;
  }
  return null;
}

export function extractSexo(text: string): 'M' | 'F' | null {
  const t = normalizeText(text);
  if (/\b(FEMENIN[OA]|SEXO\s*[:.\s]*F\b|\bF\b\s*$)/m.test(t)) return 'F';
  if (/\b(MASCULIN[OA]|SEXO\s*[:.\s]*M\b)/m.test(t)) return 'M';
  return null;
}

function scoreCiCandidate(digits: string, text: string): number {
  let score = 0;
  if (digits.length === 7) score += 4;
  else if (digits.length === 6 || digits.length === 8) score += 2;
  const t = normalizeText(text);
  const idx = t.indexOf(digits);
  if (idx >= 0) {
    const ctx = t.slice(Math.max(0, idx - 25), idx + digits.length + 10);
    if (/C\.?\s*I|DOCUMENTO|N[°O]|IDENTIDAD|REGISTRO/i.test(ctx)) score += 6;
  }
  return score;
}

export function extractCiCandidates(text: string): string[] {
  const normalized = normalizeOcrRawText(text);
  const t = normalized.toUpperCase();
  const found = new Map<string, number>();

  const add = (digits: string, bonus = 0) => {
    if (!isValidCi(digits)) return;
    const prev = found.get(digits) ?? 0;
    found.set(digits, Math.max(prev, scoreCiCandidate(digits, t) + bonus));
  };

  const patterns = [
    /\bC\.?\s*I\.?\s*N[°O.]?\s*[:.\s]*([\dOoQIl|SsBbGgZz.\s-]{6,16})/gi,
    /\bDOC(?:UMENTO)?\.?\s*(?:N[°O.]?)?\s*[:.\s]*([\dOoQIl|SsBbGgZz.\s-]{6,16})/gi,
    /\bN[°O]\s*[:.\s]*([\dOoQIl|SsBbGgZz.\s-]{6,16})/gi,
    /\b(\d{1,3}[.\s]\d{3}[.\s]\d{3})\b/g,
    /\b(\d{6,8})\b/g,
  ];

  for (const re of patterns) {
    for (const m of t.matchAll(re)) {
      add(normalizeCiDigits(m[1]));
    }
  }

  return [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([digits]) => digits);
}

function cleanNameLine(line: string): string {
  return line
    .replace(/^(APELLIDOS?|NOMBRES?|A\.?\s*Y\s*N\.?|APELLIDO\s*Y\s*NOMBRE)[:\s]*/i, '')
    .replace(/[^A-ZÑ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractNombre(text: string): string | null {
  const rawLines = normalizeOcrRawText(text).split(/\n/).map((l) => l.trim()).filter(Boolean);
  const lines = rawLines.map((l) => l.toUpperCase());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^NOMBRES?\s*[:.]/.test(line) || /^NOMBRES?\s+[A-Z]/.test(line)) {
      const n = cleanNameLine(line);
      const prev = lines[i - 1] ?? '';
      const a =
        /^APELLIDOS?\s*[:.]/.test(prev) || /^APELLIDOS?\s+[A-Z]/.test(prev)
          ? cleanNameLine(prev)
          : '';
      const full = [a, n].filter(Boolean).join(' ').trim();
      if (full.length >= 6) return full;
    }
    if (
      (/^APELLIDOS?\s*[:.]/.test(line) || /^APELLIDOS?\s+[A-Z]/.test(line)) &&
      i + 1 < lines.length &&
      (/^NOMBRES?\s*[:.]/.test(lines[i + 1]) || /^NOMBRES?\s+[A-Z]/.test(lines[i + 1]))
    ) {
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
        !/REPUBLICA|PARAGUAY|IDENTIDAD|REGISTRO|CEDULA|NACIONAL|POLICIA|VENCIMIENTO|DOMICILIO|FIRMA/.test(
          l
        )
    );
  if (candidates.length) {
    return candidates.sort((a, b) => b.length - a.length)[0];
  }
  return null;
}

export function hasUsefulCedulaData(fields: CedulaOcrFields, target: CedulaOcrTarget): boolean {
  if (target === 'madre') {
    return Boolean(fields.documentoMadre || (fields.nombre && fields.nombre.length >= 6));
  }
  return Boolean(
    fields.documento ||
      (fields.nombre && fields.nombre.length >= 6) ||
      fields.fechaNacimiento
  );
}

/** Puntaje para elegir el mejor resultado entre varias pasadas OCR. */
export function scoreCedulaParse(fields: CedulaOcrFields, target: CedulaOcrTarget): number {
  let score = 0;
  if (target === 'madre') {
    if (fields.documentoMadre) score += 12;
    if (fields.nombre && fields.nombre.length >= 6) score += 6;
    return score;
  }
  if (fields.documento) score += 12;
  if (fields.nombre && fields.nombre.length >= 6) score += 6;
  if (fields.fechaNacimiento) score += 4;
  if (fields.sexo) score += 2;
  if (fields.documentoMadre) score += 2;
  return score;
}

export function parseCedulaOcrText(rawText: string, target: CedulaOcrTarget = 'nino'): CedulaOcrFields {
  const warnings: string[] = [];
  const cleaned = normalizeOcrRawText(rawText);
  const cis = extractCiCandidates(cleaned);
  let documento: string | null = null;
  let documentoMadre: string | null = null;

  if (target === 'madre') {
    documentoMadre = cis[0] ?? null;
    if (!documentoMadre) warnings.push('No se detectó número de CI en la foto.');
  } else {
    documento = cis[0] ?? null;
    if (cis.length > 1) documentoMadre = cis[1];
    const t = cleaned.toUpperCase();
    const madreMatch = t.match(
      /(?:MADRE|CI\s*MADRE|DOC\.?\s*MADRE|MADRE\s*\/\s*PADRE)[:\s]*([\dOoQIl|SsBbGgZz.\s-]{6,16})/
    );
    if (madreMatch) {
      const d = normalizeCiDigits(madreMatch[1]);
      if (isValidCi(d)) documentoMadre = d;
    }
    if (!documento) warnings.push('No se detectó CI del niño/a. Revisá el número manualmente.');
  }

  const nombre = extractNombre(cleaned);
  if (!nombre) warnings.push('No se detectó nombre completo. Completá manualmente.');

  const fechaNacimiento = target === 'nino' ? extractFechaNacimiento(cleaned) : null;
  if (target === 'nino' && !fechaNacimiento) warnings.push('No se detectó fecha de nacimiento.');

  const sexo = target === 'nino' ? extractSexo(cleaned) : null;

  return {
    rawText: cleaned,
    documento: target === 'nino' ? documento : null,
    nombre,
    fechaNacimiento,
    sexo,
    documentoMadre,
    warnings,
  };
}
