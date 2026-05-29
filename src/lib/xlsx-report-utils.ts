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
  ws['!cols'] = [{ wch: 22 }, { wch: 72 }];
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
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}
