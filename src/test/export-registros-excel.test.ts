import { describe, expect, it } from 'vitest';
import { buildLabeledExcelRows, type ExcelColumnDef } from '@/lib/xlsx-report-utils';
import { registroToExcelRow } from '@/lib/export-registros-excel';
import type { RegistroMRV } from '@/services/dataService';

describe('export-registros-excel', () => {
  it('omite columnas opcionales vacías en todo el lote', () => {
    const cols: ExcelColumnDef[] = [
      { key: 'nombre', label: 'Nombre', core: true },
      { key: 'tipo_documento', label: 'Tipo documento' },
      { key: 'fuente_verificacion', label: 'Fuente' },
    ];
    const labeled = buildLabeledExcelRows(
      [{ nombre: 'Ana', tipo_documento: '', fuente_verificacion: '' }],
      cols
    );
    expect(Object.keys(labeled[0])).toEqual(['Nombre']);
  });

  it('incluye columnas opcionales cuando hay al menos un valor', () => {
    const cols: ExcelColumnDef[] = [
      { key: 'nombre', label: 'Nombre', core: true },
      { key: 'observaciones', label: 'Observaciones' },
    ];
    const labeled = buildLabeledExcelRows(
      [
        { nombre: 'Ana', observaciones: '' },
        { nombre: 'Bob', observaciones: 'Nota terreno' },
      ],
      cols
    );
    expect(Object.keys(labeled[0])).toContain('Observaciones');
  });

  it('no exporta estado vacuna en visitas N/F/R', () => {
    const row = registroToExcelRow({
      nombre: 'Visita',
      documento: 'VISITA-N',
      tipo_vivienda: 'revisitada',
      estado_vacuna: 'no_vacunado',
    } as RegistroMRV);
    expect(row.estado_vacuna).toBe('');
    expect(row.tipo_vivienda).toBe('N');
  });
});
