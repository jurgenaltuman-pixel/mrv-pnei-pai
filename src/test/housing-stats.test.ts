import { describe, expect, it } from 'vitest';
import { resumenAbiertasCerradas } from '@/lib/housing-stats';

describe('resumenAbiertasCerradas', () => {
  it('abiertas = R y cerradas = E+N+F', () => {
    const r = resumenAbiertasCerradas({
      efectivas: 0,
      noEfectivas: 0,
      fallidas: 1,
      renuentes: 1,
    });
    expect(r.abiertas).toBe(1);
    expect(r.fallidas).toBe(1);
    expect(r.cerradas).toBe(1);
    expect(r.total).toBe(2);
  });

  it('suma E, N y F en cerradas', () => {
    const r = resumenAbiertasCerradas({
      efectivas: 1,
      noEfectivas: 1,
      fallidas: 1,
      renuentes: 0,
    });
    expect(r.abiertas).toBe(0);
    expect(r.fallidas).toBe(3);
    expect(r.total).toBe(3);
  });
});
