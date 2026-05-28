import { describe, it, expect } from 'vitest';
import { normalizeText, nombreCoincidePartes } from '@/services/dataService';
import { normalizePadronSprDosis } from '@/lib/padron-spr';
import { resolveFechaNacimientoPersona } from '@/lib/persona-fecha';

describe('normalizeText', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(normalizeText('  José María  ')).toBe('jose maria');
  });
});

describe('normalizePadronSprDosis', () => {
  it('extrae lugar y vacunador desde observacion legacy', () => {
    const d = normalizePadronSprDosis({
      vacuna: '1.ª dosis SPR',
      fecha: '2023-05-11',
      observacion: 'Servicio Central · Vacunador: MARIA LOPEZ',
    });
    expect(d.lugar_vacunacion).toBe('Servicio Central');
    expect(d.vacunador).toBe('MARIA LOPEZ');
  });
});

describe('resolveFechaNacimientoPersona', () => {
  it('usa fecha ISO o estima desde edad en nómina', () => {
    expect(resolveFechaNacimientoPersona({ fecha_nacimiento: '2020-05-11T00:00:00Z' })).toBe('2020-05-11');
    const est = resolveFechaNacimientoPersona({ edad_anos: 1, edad_meses: 4 });
    expect(est).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('nombreCoincidePartes', () => {
  it('acepta iniciales y fragmentos', () => {
    expect(nombreCoincidePartes('Pérez Gómez Juan Carlos', ['juan', 'pe'])).toBe(true);
    expect(nombreCoincidePartes('Pérez Gómez Juan', ['x'])).toBe(false);
  });
});
