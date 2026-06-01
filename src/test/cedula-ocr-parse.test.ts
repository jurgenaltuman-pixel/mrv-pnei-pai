import { describe, expect, it } from 'vitest';
import {
  extractCiCandidates,
  extractFechaNacimiento,
  extractNombre,
  extractSexo,
  fixOcrDigitConfusions,
  hasUsefulCedulaData,
  normalizeCiDigits,
  parseCedulaOcrText,
  scoreCedulaParse,
} from '@/lib/cedula-ocr-parse';

const SAMPLE_NINO = `
REPUBLICA DEL PARAGUAY
IDENTIDAD CIVIL
APELLIDOS: GONZALEZ LOPEZ
NOMBRES: MARIA ELENA
C.I. N 4567890
FECHA DE NACIMIENTO 15/03/2015
SEXO FEMENINO
CI MADRE 1234567
`;

const SAMPLE_NOISY = `
REPUBLICA DEL PARAGUAY
APBLLIDOS GONZALEZ LOPEZ
N0MBRES MARIA ELENA
C 1 N 4S6789O
FECHA DE NACIMIENTO 15/03/2015
SEXO FEMENINO
`;

describe('cedula-ocr-parse', () => {
  it('extrae CI, nombre, fecha y sexo del niño', () => {
    const r = parseCedulaOcrText(SAMPLE_NINO, 'nino');
    expect(r.documento).toBe('4567890');
    expect(r.nombre).toContain('GONZALEZ');
    expect(r.fechaNacimiento).toBe('2015-03-15');
    expect(r.sexo).toBe('F');
    expect(r.documentoMadre).toBe('1234567');
    expect(hasUsefulCedulaData(r, 'nino')).toBe(true);
  });

  it('corrige ruido OCR típico en CI y etiquetas', () => {
    const r = parseCedulaOcrText(SAMPLE_NOISY, 'nino');
    expect(r.documento).toBe('4567890');
    expect(r.nombre).toMatch(/GONZALEZ/i);
    expect(r.fechaNacimiento).toBe('2015-03-15');
  });

  it('extrae CI de madre', () => {
    const r = parseCedulaOcrText('CEDULA\nAPELLIDOS: PEREZ\nNOMBRES: ANA\nC.I. 9876543', 'madre');
    expect(r.documentoMadre).toBe('9876543');
    expect(r.nombre).toContain('PEREZ');
    expect(hasUsefulCedulaData(r, 'madre')).toBe(true);
  });

  it('detecta CI con puntos y confusiones', () => {
    expect(extractCiCandidates('C.I. N° 4.567.890')).toContain('4567890');
    expect(normalizeCiDigits(fixOcrDigitConfusions('4S6789O'))).toBe('4567890');
  });

  it('detecta fecha', () => {
    expect(extractFechaNacimiento('NAC: 01-12-2020')).toBe('2020-12-01');
  });

  it('detecta sexo', () => {
    expect(extractSexo('SEXO: MASCULINO')).toBe('M');
    expect(extractSexo('SEXO FEMENINO')).toBe('F');
  });

  it('detecta nombre compuesto', () => {
    expect(extractNombre(SAMPLE_NINO)).toMatch(/GONZALEZ.*MARIA/i);
  });

  it('puntúa mejor un parse con CI que uno vacío', () => {
    const full = parseCedulaOcrText(SAMPLE_NINO, 'nino');
    const empty = parseCedulaOcrText('texto sin datos', 'nino');
    expect(scoreCedulaParse(full, 'nino')).toBeGreaterThan(scoreCedulaParse(empty, 'nino'));
  });
});
