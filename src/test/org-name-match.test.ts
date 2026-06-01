import { describe, expect, it } from 'vitest';
import { pickOrgName, resolveSignupOrgSelection } from '@/lib/org-name-match';

describe('org-name-match', () => {
  it('empareja región con o sin tildes', () => {
    const regiones = [{ id: 1, nombre: 'Paraguarí' }];
    expect(pickOrgName(regiones, 'Paraguari')).toBe('Paraguarí');
  });

  it('resuelve servicio dentro del distrito', () => {
    const catalog = {
      regiones: [{ id: 1, nombre: 'Central' }],
      distritos: [{ id: 10, nombre: 'FERNANDO DE LA MORA', region_id: 1 }],
      servicios: [{ id: 100, nombre: 'Puesto de Salud Santa Teresa', distrito_id: 10 }],
    };
    const r = resolveSignupOrgSelection(catalog, {
      assigned_region: 'central',
      assigned_distrito: 'fernando de la mora',
      assigned_servicio: 'santa teresa',
    });
    expect(r.region).toBe('Central');
    expect(r.distrito).toBe('FERNANDO DE LA MORA');
    expect(r.servicio).toBe('Puesto de Salud Santa Teresa');
  });
});
