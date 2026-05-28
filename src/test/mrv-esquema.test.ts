import { describe, it, expect } from 'vitest';
import { edadTotalEnMeses, esquemaFromDosisMonitoreo } from '@/lib/mrv-esquema';

describe('esquemaFromDosisMonitoreo', () => {
  it('sin dosis devuelve null', () => {
    expect(esquemaFromDosisMonitoreo(null, 15)).toBe(null);
  });

  it('2+ dosis siempre completo', () => {
    expect(esquemaFromDosisMonitoreo('2plus', 14)).toBe(true);
    expect(esquemaFromDosisMonitoreo('2plus', 24)).toBe(true);
  });

  it('1 dosis: hasta 1a5m completo, desde 1a6m incompleto', () => {
    expect(esquemaFromDosisMonitoreo('1', 6)).toBe(true);
    expect(esquemaFromDosisMonitoreo('1', 17)).toBe(true);
    expect(esquemaFromDosisMonitoreo('1', 18)).toBe(false);
    expect(esquemaFromDosisMonitoreo('1', 36)).toBe(false);
  });

  it('2+ dosis desde 1a6m completo', () => {
    expect(esquemaFromDosisMonitoreo('2plus', 18)).toBe(true);
    expect(esquemaFromDosisMonitoreo('2plus', 30)).toBe(true);
  });
});

describe('edadTotalEnMeses', () => {
  it('suma años y meses de nómina', () => {
    expect(edadTotalEnMeses({ edad_anos: 1, edad_meses: 1 })).toBe(13);
    expect(edadTotalEnMeses({ edad_anos: 1, edad_meses: 6 })).toBe(18);
    expect(edadTotalEnMeses({ edad_anos: 0, edad_meses: 15 })).toBe(15);
  });

  it('prioriza edad nominal sobre fecha que daría más meses', () => {
    expect(
      edadTotalEnMeses({
        edad_anos: 1,
        edad_meses: 1,
        fechaNacimiento: '2019-01-01',
      })
    ).toBe(13);
  });

  it('1 año 1 mes + 1 dosis → completo', () => {
    expect(esquemaFromDosisMonitoreo('1', 13)).toBe(true);
  });
});
