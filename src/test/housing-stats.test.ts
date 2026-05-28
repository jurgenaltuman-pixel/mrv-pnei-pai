import { describe, expect, it } from 'vitest';
import { resumenAbiertasCerradas } from '@/lib/housing-stats';

describe('resumenAbiertasCerradas', () => {
  it('cuenta F en fallidas del resumen, no en abiertas', () => {
    const r = resumenAbiertasCerradas({
      efectivas: 0,
      noEfectivas: 0,
      fallidas: 1,
      renuentes: 1,
    });
    expect(r.abiertas).toBe(1);
    expect(r.fallidas).toBe(1);
    expect(r.total).toBe(2);
  });

  it('suma F y N en fallidas', () => {
    const r = resumenAbiertasCerradas({
      efectivas: 1,
      noEfectivas: 1,
      fallidas: 1,
      renuentes: 0,
    });
    expect(r.abiertas).toBe(1);
    expect(r.fallidas).toBe(2);
    expect(r.total).toBe(3);
  });
});
