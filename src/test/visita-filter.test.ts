import { describe, expect, it } from 'vitest';
import { registroMapEstadoLine } from '@/lib/map-labels';
import { filterRegistrosByVisita, getVisitaCode } from '@/lib/visita-filter';
import type { RegistroMRV } from '@/services/dataService';

function reg(partial: Partial<RegistroMRV>): RegistroMRV {
  return {
    id: '1',
    nombre: 'Test',
    documento: '123',
    estado_vacuna: 'no_vacunado',
    ...partial,
  } as RegistroMRV;
}

describe('visita-filter', () => {
  it('detecta código N/F/R/E', () => {
    expect(getVisitaCode(reg({ tipo_vivienda: 'revisitada' }))).toBe('N');
    expect(getVisitaCode(reg({ tipo_vivienda: 'sin_adulto_responsable' }))).toBe('F');
    expect(getVisitaCode(reg({ tipo_vivienda: 'renuente' }))).toBe('R');
    expect(getVisitaCode(reg({ tipo_vivienda: 'efectiva', estado_vacuna: 'vacunado' }))).toBe('E');
  });

  it('filtra N F R por tipo de vivienda', () => {
    const rows = [
      reg({ id: 'n', tipo_vivienda: 'revisitada' }),
      reg({ id: 'f', tipo_vivienda: 'sin_adulto_responsable' }),
      reg({ id: 'r', tipo_vivienda: 'renuente' }),
      reg({ id: 'e', tipo_vivienda: 'efectiva', estado_vacuna: 'vacunado' }),
    ];
    expect(filterRegistrosByVisita(rows, 'N')).toHaveLength(1);
    expect(filterRegistrosByVisita(rows, 'F')).toHaveLength(1);
    expect(filterRegistrosByVisita(rows, 'R')).toHaveLength(1);
    expect(filterRegistrosByVisita(rows, 'vacunado')).toHaveLength(1);
  });
});

describe('map-labels', () => {
  it('no muestra No vacunado en visitas N/F/R', () => {
    expect(registroMapEstadoLine(reg({ tipo_vivienda: 'revisitada' })).text).toContain('No efectiva');
    expect(registroMapEstadoLine(reg({ tipo_vivienda: 'sin_adulto_responsable' })).text).toContain('Fallida');
    expect(registroMapEstadoLine(reg({ tipo_vivienda: 'renuente' })).text).toContain('Renuente');
    expect(registroMapEstadoLine(reg({ tipo_vivienda: 'revisitada' })).text).not.toContain('No vacunado');
  });

  it('muestra No vacunado solo en casa efectiva', () => {
    expect(registroMapEstadoLine(reg({ tipo_vivienda: 'efectiva', estado_vacuna: 'no_vacunado' })).text).toBe(
      'No vacunado'
    );
    expect(registroMapEstadoLine(reg({ tipo_vivienda: 'efectiva', estado_vacuna: 'vacunado' })).text).toBe('Vacunado');
  });
});
