import { describe, expect, it } from 'vitest';
import { resumenAbiertasCerradas } from '@/lib/housing-stats';

describe('resumenAbiertasCerradas', () => {
  it('abiertas = E+N+R y cerradas = F', () => {
    const r = resumenAbiertasCerradas({
      efectivas: 1,
      noEfectivas: 0,
      fallidas: 1,
      renuentes: 1,
    });
    expect(r.abiertas).toBe(2);
    expect(r.fallidas).toBe(1);
    expect(r.cerradas).toBe(1);
    expect(r.total).toBe(3);
  });

  it('cerradas solo cuenta F', () => {
    const r = resumenAbiertasCerradas({
      efectivas: 1,
      noEfectivas: 1,
      fallidas: 2,
      renuentes: 0,
    });
    expect(r.abiertas).toBe(2);
    expect(r.fallidas).toBe(2);
    expect(r.total).toBe(4);
  });
});
