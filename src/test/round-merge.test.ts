import { describe, expect, it } from 'vitest';
import { mergeRoundMonitoring } from '@/lib/round-merge';
import type { CasaMonitoreo, RoundMonitoring } from '@/types/round-monitoring';

function casa(
  numero: number,
  estado: CasaMonitoreo['estado'],
  guardadaAt: number,
  ninos: CasaMonitoreo['ninos'] = []
): CasaMonitoreo {
  return {
    numero,
    estado,
    ninos,
    guardada: true,
    latitud: -22,
    longitud: -56,
    guardadaAt,
  };
}

function round(casas: CasaMonitoreo[]): RoundMonitoring {
  return {
    id: 'r1',
    codigo: 'R1',
    userId: 'u1',
    moduloLabel: 'FATIMA',
    totalCasas: 20,
    casas,
    casaActiva: 2,
    fase: 'croquis',
    createdAt: 1,
    updatedAt: 100,
    completedAt: null,
    region: 'R',
    distrito: 'D',
    servicio: null,
    barrio: 'FATIMA',
    responsable: null,
    entrevistador: null,
    colaboradores: [],
    ultimaCasaResumen: null,
  };
}

describe('round-merge', () => {
  it('no degrada E a N cuando el remoto es un borrador vacío más nuevo', () => {
    const local = round([
      casa(1, 'E', 1000, [{ id: 'n1', nombre: 'A', documento: '1', vacunado: true } as never]),
    ]);
    const remote = round([casa(1, 'N', 5000, [])]);
    remote.updatedAt = 9000;

    const merged = mergeRoundMonitoring(local, remote);
    expect(merged.casas[0].estado).toBe('E');
    expect(merged.casas[0].ninos.length).toBeGreaterThanOrEqual(1);
  });

  it('acepta cambio E→N si la re-edición es posterior y trae datos', () => {
    const local = round([
      casa(1, 'E', 1000, [{ id: 'n1', nombre: 'A', documento: '1', vacunado: true } as never]),
    ]);
    const remote = round([
      casa(1, 'N', 1000 + 300_000, [{ id: 'n1', nombre: 'A', documento: '1', vacunado: false } as never]),
    ]);

    const merged = mergeRoundMonitoring(local, remote);
    expect(merged.casas[0].estado).toBe('N');
  });
});
