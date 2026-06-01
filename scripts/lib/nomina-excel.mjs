/** Utilidades compartidas para import/sync de nómina desde Excel. */
export function normHeader(h) {
  return String(h || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function pick(row, ...names) {
  const m = new Map(Object.keys(row).map((k) => [normHeader(k), row[k]]));
  for (const n of names) {
    const v = m.get(normHeader(n));
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

export function collapseSpaces(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

export function parseNominaExcelRow(row) {
  const docRaw = pick(row, 'documento', 'ci', 'cedula');
  const doc = docRaw.replace(/\D/g, '') || docRaw.trim();
  const nombres = collapseSpaces(pick(row, 'nombre completo', 'nombres_completos', 'nombre'));
  let excelUser = pick(row, 'nombre de usuario', 'nombre_usuario', 'usuario').toLowerCase();
  if (!excelUser || excelUser.includes('@')) excelUser = doc;
  const region = pick(row, 'region sanitaria', 'region') || null;
  const distrito = pick(row, 'distrito') || null;
  const servicio = pick(row, 'servicio/vacunatorio', 'servicio', 'servicio_salud') || null;
  return { doc, nombres, excelUser, region, distrito, servicio };
}

export function normOrgKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function pickCatalogName(list, raw) {
  const target = normOrgKey(raw);
  if (!target || !list?.length) return String(raw || '').trim() || null;
  const exact = list.find((x) => normOrgKey(x.nombre) === target);
  if (exact) return exact.nombre;
  const partial = list.find((x) => {
    const n = normOrgKey(x.nombre);
    return n.includes(target) || target.includes(n);
  });
  return partial?.nombre || String(raw || '').trim() || null;
}
