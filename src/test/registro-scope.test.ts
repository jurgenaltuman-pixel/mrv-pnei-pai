import { describe, expect, it } from 'vitest';
import {
  filterRegistrosByProfileScope,
  hasProfileScopeAssignment,
  registroMatchesProfileScope,
} from '@/lib/registro-scope';

describe('registro-scope', () => {
  const rows = [
    { region: 'San Pedro Sur', distrito: 'SAN ESTANISLAO', servicio: null },
    { region: 'Central', distrito: 'Asunción', servicio: 'Hospital' },
  ];

  it('sin asignación devuelve todos', () => {
    expect(filterRegistrosByProfileScope(rows, {})).toHaveLength(2);
    expect(hasProfileScopeAssignment(null)).toBe(false);
  });

  it('filtra por región y distrito', () => {
    const scope = {
      assigned_region: 'San Pedro Sur',
      assigned_distrito: 'SAN ESTANISLAO',
      assigned_servicio: 'Puesto de Salud Tacuara',
    };
    expect(filterRegistrosByProfileScope(rows, scope)).toHaveLength(1);
    expect(registroMatchesProfileScope(rows[0], scope)).toBe(true);
  });

  it('no excluye registro sin servicio cuando hay servicio asignado', () => {
    const scope = {
      assigned_region: 'San Pedro Sur',
      assigned_distrito: 'SAN ESTANISLAO',
      assigned_servicio: 'Puesto de Salud Tacuara',
    };
    expect(registroMatchesProfileScope(rows[0], scope)).toBe(true);
  });
});
