import { describe, expect, it } from 'vitest';
import { ampliarViviendasRonda, elegirPresetCercano } from '@/lib/round-viviendas';
import type { RoundMonitoring } from '@/types/round-monitoring';

function round(totalCasas: number, casasLen: number): RoundMonitoring {
  const casas = Array.from({ length: casasLen }, (_, i) => ({
    numero: i + 1,
    estado: null as const,
    ninos: [],
    guardada: false,
    latitud: null,
    longitud: null,
    guardadaAt: null,
  }));
  return {
    id: '1',
    codigo: 'R1',
    userId: 'u',
    moduloLabel: 'M',
    totalCasas,
    casas,
    casaActiva: 1,
    fase: 'croquis',
    createdAt: 1,
    updatedAt: 1,
    completedAt: null,
    region: 'R',
    distrito: 'D',
    servicio: null,
    barrio: 'B',
    responsable: null,
    entrevistador: null,
    colaboradores: [],
    ultimaCasaResumen: null,
  };
}

describe('round-viviendas', () => {
  it('preset cercano incluye 120', () => {
    expect(elegirPresetCercano(120)).toBe(120);
    expect(elegirPresetCercano(55)).toBe(50);
  });

  it('ampliar sube totalCasas y casillas', () => {
    const r0 = round(50, 50);
    const r1 = ampliarViviendasRonda(r0, 10);
    expect(r1).not.toBeNull();
    expect(r1!.casas.length).toBe(60);
    expect(r1!.totalCasas).toBe(60);
  });
});
