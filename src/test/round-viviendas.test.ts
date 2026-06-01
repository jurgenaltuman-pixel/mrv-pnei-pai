import { describe, expect, it } from 'vitest';
import { ampliarVisitasRonda } from '@/lib/round-viviendas';
import { META_CASAS_EFECTIVAS } from '@/lib/round-meta';
import type { RoundMonitoring } from '@/types/round-monitoring';

function round(casasLen: number): RoundMonitoring {
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
    totalCasas: META_CASAS_EFECTIVAS,
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
  it('ampliar visitas no cambia meta efectivas', () => {
    const r0 = round(50);
    const r1 = ampliarVisitasRonda(r0, 10);
    expect(r1).not.toBeNull();
    expect(r1!.casas.length).toBe(60);
    expect(r1!.totalCasas).toBe(META_CASAS_EFECTIVAS);
  });
});
