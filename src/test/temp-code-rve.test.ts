import { describe, expect, it } from 'vitest';
import {
  esCodigoTemporal,
  fechaNacimientoACodigo,
  generarCodigoTemporalDesdePersona,
  inicialesDesdeNombre,
  validarFormatoCodigoTemporal,
} from '@/lib/temp-code-rve';

describe('inicialesDesdeNombre', () => {
  it('genera iniciales por palabra', () => {
    expect(inicialesDesdeNombre('MARIA ELENA GONZALEZ')).toBe('MEG');
    expect(inicialesDesdeNombre('ESTEBAN JOSE MEZA MORINIGO')).toBe('EJMM');
  });
});

describe('generarCodigoTemporalDesdePersona', () => {
  it('concatena iniciales y fecha DDMMAAAA', () => {
    expect(generarCodigoTemporalDesdePersona('MARIA ELENA GONZALEZ', '2015-03-15')).toBe('MEG15032015');
  });

  it('requiere nombre y fecha', () => {
    expect(generarCodigoTemporalDesdePersona('', '2015-03-15')).toBeNull();
    expect(generarCodigoTemporalDesdePersona('JUAN PEREZ', '')).toBeNull();
  });
});

describe('validarFormatoCodigoTemporal', () => {
  it('acepta iniciales+fecha y CI numérica', () => {
    expect(validarFormatoCodigoTemporal('MEG15032015')).toBe(true);
    expect(validarFormatoCodigoTemporal('1234567')).toBe(true);
    expect(esCodigoTemporal('EJM15032015')).toBe(true);
  });
});

describe('fechaNacimientoACodigo', () => {
  it('parsea ISO y dd/mm/aaaa a DDMMAAAA', () => {
    expect(fechaNacimientoACodigo('2015-03-15')).toBe('15032015');
    expect(fechaNacimientoACodigo('15/03/2015')).toBe('15032015');
  });
});
