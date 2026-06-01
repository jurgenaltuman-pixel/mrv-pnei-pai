import * as XLSX from 'xlsx';

/** Anchos de columna a partir de filas JSON. */
export function autoColWidths(rows: Record<string, unknown>[], maxRows = 80): { wch: number }[] {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  return headers.map((h) => ({
    wch: Math.min(
      52,
      Math.max(
        10,
        h.length + 2,
        ...rows.slice(0, maxRows).map((r) => String(r[h] ?? '').length)
      )
    ),
  }));
}

export function appendMetaSheet(
  wb: XLSX.WorkBook,
  rows: { campo: string; valor: string }[],
  sheetName = 'Info'
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 24 }, { wch: 76 }];
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

export function jsonSheetWithCols(
  wb: XLSX.WorkBook,
  rows: Record<string, unknown>[],
  sheetName: string
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (rows.length > 0) ws['!cols'] = autoColWidths(rows);
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  ws['!autofilter'] = rows.length
    ? { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: Object.keys(rows[0]).length - 1 } }) }
    : undefined;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

/** Omite columnas cuyo valor está vacío en todas las filas. */
export function pruneEmptyColumns(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!rows.length) return rows;
  const keys = Object.keys(rows[0]);
  const keep = keys.filter((k) =>
    rows.some((r) => {
      const v = r[k];
      if (v == null) return false;
      if (typeof v === 'number') return Number.isFinite(v);
      return String(v).trim() !== '';
    })
  );
  if (keep.length === keys.length) return rows;
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const k of keep) out[k] = r[k];
    return out;
  });
}

export type ExcelColumnDef = {
  key: string;
  label: string;
  /** Si true, siempre se exporta aunque esté vacía. */
  core?: boolean;
};

/** Convierte filas técnicas a etiquetas legibles y descarta columnas vacías (salvo core). */
export function buildLabeledExcelRows(
  rawRows: Record<string, unknown>[],
  columns: ExcelColumnDef[]
): Record<string, unknown>[] {
  const optionalKeys = columns.filter((c) => !c.core).map((c) => c.key);
  const includeOptional = new Set<string>();
  for (const key of optionalKeys) {
    const hasData = rawRows.some((r) => {
      const v = r[key];
      if (v == null) return false;
      if (typeof v === 'number') return Number.isFinite(v);
      return String(v).trim() !== '';
    });
    if (hasData) includeOptional.add(key);
  }

  const activeCols = columns.filter((c) => c.core || includeOptional.has(c.key));

  return rawRows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const col of activeCols) {
      out[col.label] = r[col.key] ?? '';
    }
    return out;
  });
}
