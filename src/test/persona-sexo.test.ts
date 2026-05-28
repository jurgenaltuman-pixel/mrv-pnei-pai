import { describe, expect, it } from 'vitest';
import {
  extractSexoFromPadronRow,
  inferSexoFromNombre,
  normalizeSexoForForm,
  resolveSexoPersona,
} from '@/lib/persona-sexo';

describe('normalizeSexoForForm', () => {
  it('acepta M y F directos', () => {
    expect(normalizeSexoForForm('M')).toBe('M');
    expect(normalizeSexoForForm('f')).toBe('F');
  });

  it('normaliza texto del padrón', () => {
    expect(normalizeSexoForForm('Masculino')).toBe('M');
    expect(normalizeSexoForForm('FEMENINO')).toBe('F');
  });
});

describe('resolveSexoPersona', () => {
  it('infiere masculino por nombre cuando sexo es null', () => {
    expect(resolveSexoPersona({ sexo: null, nombre: 'ESTEBAN JOSE MEZA MORINIGO' })).toBe('M');
  });

  it('prioriza sexo de la base', () => {
    expect(resolveSexoPersona({ sexo: 'F', nombre: 'ESTEBAN JOSE' })).toBe('F');
  });

  it('infiere femenino', () => {
    expect(inferSexoFromNombre('MARIA ELENA GONZALEZ')).toBe('F');
  });

  it('lee columna genero si sexo viene vacío', () => {
    expect(extractSexoFromPadronRow({ genero: 'F', nombre: 'X' })).toBe('F');
  });
});
