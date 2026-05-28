import { describe, it, expect } from 'vitest';
import { deltaContadorPorTipo } from '@/lib/visit-session-storage';

describe('deltaContadorPorTipo', () => {
  it('mapea F y R a fallidas y renuentes', () => {
    expect(deltaContadorPorTipo('sin_adulto_responsable')).toEqual({ fallidas: 1 });
    expect(deltaContadorPorTipo('renuente')).toEqual({ renuentes: 1 });
  });
});
