import { describe, it, expect } from 'vitest';
import { isMrvTerrenoCompleto } from '@/lib/mrv-cvs-flow';

const base = {
  fuenteVerificacion: 'libreta',
  estadoVacuna: null as 'vacunado' | 'no_vacunado' | null,
  dosisMonitoreo: null as '1' | '2plus' | null,
  rechazoVacunacion: false,
  motivo: '',
  accionTomada: '',
};

describe('isMrvTerrenoCompleto', () => {
  it('exige fuente y estado', () => {
    expect(isMrvTerrenoCompleto({ ...base, fuenteVerificacion: '' })).toBe(false);
    expect(isMrvTerrenoCompleto({ ...base, estadoVacuna: null })).toBe(false);
  });

  it('vacunado exige dosis (esquema automático)', () => {
    expect(
      isMrvTerrenoCompleto({
        ...base,
        estadoVacuna: 'vacunado',
        dosisMonitoreo: null,
      })
    ).toBe(false);
    expect(
      isMrvTerrenoCompleto({
        ...base,
        estadoVacuna: 'vacunado',
        dosisMonitoreo: '2plus',
      })
    ).toBe(true);
  });

  it('no vacunado exige motivo, acción o rechazo', () => {
    expect(
      isMrvTerrenoCompleto({
        ...base,
        estadoVacuna: 'no_vacunado',
      })
    ).toBe(false);
    expect(
      isMrvTerrenoCompleto({
        ...base,
        estadoVacuna: 'no_vacunado',
        rechazoVacunacion: true,
      })
    ).toBe(true);
  });
});
