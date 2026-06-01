import { describe, expect, it } from 'vitest';
import {
  extractCiCandidates,
  extractFechaNacimiento,
  extractNombre,
  extractSexo,
  parseCedulaOcrText,
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

describe('cedula-ocr-parse', () => {
  it('extrae CI, nombre, fecha y sexo del niño', () => {
    const r = parseCedulaOcrText(SAMPLE_NINO, 'nino');
    expect(r.documento).toBe('4567890');
    expect(r.nombre).toContain('GONZALEZ');
    expect(r.fechaNacimiento).toBe('2015-03-15');
    expect(r.sexo).toBe('F');
    expect(r.documentoMadre).toBe('1234567');
  });

  it('extrae CI de madre', () => {
    const r = parseCedulaOcrText('CEDULA\nAPELLIDOS: PEREZ\nNOMBRES: ANA\nC.I. 9876543', 'madre');
    expect(r.documentoMadre).toBe('9876543');
    expect(r.nombre).toContain('PEREZ');
  });

  it('detecta CI con puntos', () => {
    expect(extractCiCandidates('C.I. N° 4.567.890')).toContain('4567890');
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
});
