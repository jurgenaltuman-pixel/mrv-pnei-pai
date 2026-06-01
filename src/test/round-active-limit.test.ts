import { describe, expect, it } from 'vitest';
import { countActiveRounds, isRoundDraftActive, MAX_ACTIVE_ROUNDS_PER_USER } from '@/lib/round-active-limit';
import type { RoundMonitoring } from '@/types/round-monitoring';

function baseRound(over: Partial<RoundMonitoring> = {}): RoundMonitoring {
  return {
    id: 'r1',
    codigo: 'R1',
    userId: 'u1',
    moduloLabel: 'Test',
    totalCasas: 2,
    casas: [
      { numero: 1, estado: 'E', ninos: [], guardada: true, latitud: null, longitud: null, guardadaAt: 1 },
      { numero: 2, estado: null, ninos: [], guardada: false, latitud: null, longitud: null, guardadaAt: null },
    ],
    casaActiva: 2,
    fase: 'croquis',
    createdAt: 1,
    updatedAt: 2,
    completedAt: null,
    region: 'R',
    distrito: 'D',
    servicio: null,
    barrio: 'B',
    responsable: null,
    entrevistador: 'A',
    colaboradores: [],
    ultimaCasaResumen: null,
    ...over,
  };
}

describe('round-active-limit', () => {
  it('MAX_ACTIVE_ROUNDS_PER_USER es 2', () => {
    expect(MAX_ACTIVE_ROUNDS_PER_USER).toBe(2);
  });

  it('ronda incompleta cuenta como activa', () => {
    expect(isRoundDraftActive(baseRound())).toBe(true);
  });

  it('ronda con meta E cumplida no es activa', () => {
    const casasE = Array.from({ length: 20 }, (_, i) => ({
      numero: i + 1,
      estado: 'E' as const,
      ninos: [],
      guardada: true,
      latitud: null,
      longitud: null,
      guardadaAt: i + 1,
    }));
    const r = baseRound({ totalCasas: 20, casas: casasE, fase: 'summary', completedAt: Date.now() });
    expect(isRoundDraftActive(r)).toBe(false);
  });

  it('countActiveRounds', () => {
    expect(countActiveRounds([baseRound(), baseRound({ id: 'r2' })])).toBe(2);
  });
});
