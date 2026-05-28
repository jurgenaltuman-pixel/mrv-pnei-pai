import { describe, expect, it } from 'vitest';
import { buildDashboardData, isNoVacunadoDeCasaEfectiva } from '@/lib/dashboard-stats';
import type { RegistroMRV } from '@/services/dataService';

function reg(partial: Partial<RegistroMRV>): RegistroMRV {
  return {
    region: 'Central',
    distrito: 'Lambare',
    servicio: null,
    barrio: null,
    responsable: null,
    nombre: 'Nino',
    documento: '12345',
    fecha_nacimiento: '2020-01-01',
    sexo: 'F',
    estado_vacuna: 'no_vacunado',
    motivo: null,
    latitud: null,
    longitud: null,
    tipo_vivienda: null,
    ...partial,
  };
}

describe('dashboard-stats no vacunados', () => {
  it('solo cuenta no vacunados de casas efectivas', () => {
    const rows: RegistroMRV[] = [
      reg({ estado_vacuna: 'vacunado', tipo_vivienda: 'efectiva', distrito: 'A', responsable: 'Ana' }),
      reg({ estado_vacuna: 'no_vacunado', tipo_vivienda: 'efectiva', distrito: 'A', responsable: 'Ana' }),
      reg({ estado_vacuna: 'no_vacunado', tipo_vivienda: 'revisitada', distrito: 'A', responsable: 'Ana' }),
      reg({ estado_vacuna: 'no_vacunado', tipo_vivienda: 'sin_adulto_responsable', distrito: 'B', responsable: 'Beto' }),
      reg({ estado_vacuna: 'no_vacunado', tipo_vivienda: 'renuente', distrito: 'B', responsable: 'Beto' }),
    ];

    const data = buildDashboardData(rows);
    expect(data.totalVacunados).toBe(1);
    expect(data.totalNoVacunados).toBe(1);
    expect(data.porDistrito.A.noVacunados).toBe(1);
    expect(data.porDistrito.B.noVacunados).toBe(0);
    expect(data.porResponsable?.Ana.noVacunados).toBe(1);
    expect(data.porResponsable?.Beto.noVacunados).toBe(0);
  });

  it('detecta no vacunado computable solo en efectiva', () => {
    expect(isNoVacunadoDeCasaEfectiva(reg({ estado_vacuna: 'no_vacunado', tipo_vivienda: 'efectiva' }))).toBe(true);
    expect(isNoVacunadoDeCasaEfectiva(reg({ estado_vacuna: 'no_vacunado', tipo_vivienda: 'renuente' }))).toBe(false);
    expect(isNoVacunadoDeCasaEfectiva(reg({ estado_vacuna: 'vacunado', tipo_vivienda: 'efectiva' }))).toBe(false);
  });
});
