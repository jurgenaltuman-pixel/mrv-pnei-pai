import { describe, it, expect } from 'vitest';
import { validarBusquedaPersonal } from '@/lib/busqueda-personal';

describe('validarBusquedaPersonal', () => {
  it('acepta un solo nombre', () => {
    expect(validarBusquedaPersonal({ nombre1: 'Juan' }).ok).toBe(true);
  });

  it('acepta solo apellido', () => {
    expect(validarBusquedaPersonal({ apellido1: 'Perez' }).ok).toBe(true);
  });

  it('acepta solo fecha de nacimiento', () => {
    const r = validarBusquedaPersonal({ fechaNacimiento: '26/03/2022' });
    expect(r.ok).toBe(true);
    expect(r.filtros?.fechaNacimiento).toBe('2022-03-26');
  });

  it('acepta solo CI madre/padre', () => {
    expect(validarBusquedaPersonal({ documentoMadrePadre: '1234567' }).ok).toBe(true);
  });

  it('acepta nombre + apellido + fecha válida', () => {
    const r = validarBusquedaPersonal({
      nombre1: 'Juan',
      apellido1: 'Perez',
      fechaNacimiento: '26/03/22',
    });
    expect(r.ok).toBe(true);
    expect(r.filtros?.fechaNacimiento).toBe('2022-03-26');
  });

  it('rechaza sin criterios', () => {
    expect(validarBusquedaPersonal({}).ok).toBe(false);
  });

  it('rechaza fecha inválida', () => {
    const r = validarBusquedaPersonal({
      nombre1: 'Juan',
      apellido1: 'Perez',
      fechaNacimiento: '32/13/99',
    });
    expect(r.ok).toBe(false);
  });
});
