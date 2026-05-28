import { describe, expect, it } from 'vitest';
import {
  baselineDesdePersona,
  ubicacionSanitariaDifiereDeBaseline,
} from '@/lib/cambio-residencia';

describe('ubicacionSanitariaDifiereDeBaseline', () => {
  const base = baselineDesdePersona(
    { region_sanitaria: 'Central', distrito: 'FERNANDO DE LA MORA', servicio_salud: 'Hospital Materno' },
    { regionId: 1, distritoId: 10, servicioId: 100, servicioManual: '' }
  );

  it('sin baseline no marca cambio', () => {
    expect(ubicacionSanitariaDifiereDeBaseline(null, { ...base })).toBe(false);
  });

  it('misma ubicación por ID no marca cambio', () => {
    expect(
      ubicacionSanitariaDifiereDeBaseline(base, {
        ...base,
        regionText: 'Central',
        distritoText: 'FERNANDO DE LA MORA',
        servicioText: 'Hospital Materno',
      })
    ).toBe(false);
  });

  it('cambio de servicio por ID marca cambio', () => {
    expect(
      ubicacionSanitariaDifiereDeBaseline(base, {
        ...base,
        servicioId: 101,
      })
    ).toBe(true);
  });

  it('compara por texto si faltan IDs en baseline', () => {
    const soloTexto = baselineDesdePersona(
      { region_sanitaria: 'Central', distrito: 'Asunción', servicio_salud: 'IPS Centro' },
      { regionId: null, distritoId: null, servicioId: null, servicioManual: 'IPS Centro' }
    );
    expect(
      ubicacionSanitariaDifiereDeBaseline(soloTexto, {
        ...soloTexto,
        regionId: 2,
        regionText: 'Alto Paraná',
      })
    ).toBe(true);
  });
});
