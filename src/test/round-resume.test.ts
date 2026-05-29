import { describe, it, expect } from 'vitest';
import { isRoundResumable } from '@/lib/round-resume';
import type { RoundMonitoring } from '@/types/round-monitoring';

const base = (): RoundMonitoring => ({
  id: '1',
  codigo: 'R250101-TEST',
  userId: 'u1',
  moduloLabel: 'M1',
  totalCasas: 20,
  casas: [],
  casaActiva: 1,
  fase: 'croquis',
  createdAt: 0,
  updatedAt: 0,
  completedAt: null,
  region: '',
  distrito: '',
  servicio: null,
  barrio: '',
  responsable: null,
  entrevistador: null,
  colaboradores: [],
  ultimaCasaResumen: null,
});

describe('isRoundResumable', () => {
  it('no retoma fase start', () => {
    expect(isRoundResumable({ ...base(), fase: 'start' })).toBe(false);
  });

  it('retoma croquis en curso', () => {
    expect(isRoundResumable({ ...base(), fase: 'croquis' })).toBe(true);
  });

  it('retoma summary pendiente de cerrar', () => {
    expect(isRoundResumable({ ...base(), fase: 'summary', completedAt: Date.now() })).toBe(true);
  });
});
