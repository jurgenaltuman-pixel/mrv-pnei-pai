import { describe, it, expect } from 'vitest';
import { normalizeText, nombreCoincidePartes } from '@/services/dataService';

describe('normalizeText', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(normalizeText('  José María  ')).toBe('jose maria');
  });
});

describe('nombreCoincidePartes', () => {
  it('acepta iniciales y fragmentos', () => {
    expect(nombreCoincidePartes('Pérez Gómez Juan Carlos', ['juan', 'pe'])).toBe(true);
    expect(nombreCoincidePartes('Pérez Gómez Juan', ['x'])).toBe(false);
  });
});
