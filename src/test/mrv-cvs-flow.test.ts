import { describe, it, expect } from 'vitest';
import { isMrvCvsTerrenoCompleto } from '@/lib/mrv-cvs-flow';

const base = {
  fuenteVerificacion: 'libreta',
  libreta: true as boolean | null,
  tieneCvs: null as boolean | null,
  rechazoVacunacion: false,
  motivo: '',
  accionTomada: '',
  dosisSpr: null as string | null,
  fechaSpr: '',
};

describe('isMrvCvsTerrenoCompleto', () => {
  it('rechaza si falta tieneCvs', () => {
    expect(isMrvCvsTerrenoCompleto({ ...base, tieneCvs: null })).toBe(false);
  });

  it('con NO tiene CVS: no exige dosis/fecha; exige motivo o rechazo y acción', () => {
    expect(
      isMrvCvsTerrenoCompleto({
        ...base,
        tieneCvs: false,
        motivo: 'Ausente',
        accionTomada: 'derivado_salud',
        dosisSpr: null,
        fechaSpr: '',
      })
    ).toBe(true);

    expect(
      isMrvCvsTerrenoCompleto({
        ...base,
        tieneCvs: false,
        motivo: '',
        rechazoVacunacion: true,
        accionTomada: 'rechazo_definitivo',
      })
    ).toBe(true);

    expect(
      isMrvCvsTerrenoCompleto({
        ...base,
        tieneCvs: false,
        motivo: 'x',
        accionTomada: '',
      })
    ).toBe(false);
  });

  it('con SÍ tiene CVS: exige tipo de dosis y fecha', () => {
    expect(
      isMrvCvsTerrenoCompleto({
        ...base,
        tieneCvs: true,
        dosisSpr: 'primera',
        fechaSpr: '',
      })
    ).toBe(false);

    expect(
      isMrvCvsTerrenoCompleto({
        ...base,
        tieneCvs: true,
        dosisSpr: null,
        fechaSpr: '2026-03-15',
      })
    ).toBe(false);

    expect(
      isMrvCvsTerrenoCompleto({
        ...base,
        tieneCvs: true,
        dosisSpr: 'primera',
        fechaSpr: '2026-03-15',
      })
    ).toBe(true);
  });
});
