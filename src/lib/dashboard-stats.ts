import type { DashboardData, RegistroMRV } from '@/services/dataService';

export function normalizeTipoVivienda(value: string | null | undefined): RegistroMRV['tipo_vivienda'] {
  if (!value) return null;
  const n = value.toLowerCase().trim();
  if (n.includes('efect')) return 'efectiva';
  if (n.includes('revisit')) return 'revisitada';
  if (n.includes('sin') && n.includes('adulto')) return 'sin_adulto_responsable';
  if (n.includes('renuente')) return 'renuente';
  return null;
}

export function buildDashboardData(registros: RegistroMRV[]): DashboardData {
  let totalVacunados = 0;
  let totalNoVacunados = 0;
  const porDistrito: Record<string, { vacunados: number; noVacunados: number }> = {};
  const viviendas = { efectiva: 0, revisitada: 0, sin_adulto_responsable: 0, renuente: 0, sin_dato: 0 };
  const esquema = { completo: 0, incompleto: 0 };

  for (const r of registros) {
    const esVacunado = r.estado_vacuna === 'vacunado';
    if (esVacunado) totalVacunados++;
    else totalNoVacunados++;

    if (r.esquema_completo === true) esquema.completo++;
    else esquema.incompleto++;

    const distrito = r.distrito || 'Sin distrito';
    if (!porDistrito[distrito]) porDistrito[distrito] = { vacunados: 0, noVacunados: 0 };
    if (esVacunado) porDistrito[distrito].vacunados++;
    else porDistrito[distrito].noVacunados++;

    const tipo = normalizeTipoVivienda(r.tipo_vivienda);
    if (tipo && tipo in viviendas) viviendas[tipo]++;
    else viviendas.sin_dato++;
  }

  return { totalVacunados, totalNoVacunados, porDistrito, viviendas, esquema };
}

export function registrosConGps(registros: RegistroMRV[]) {
  return registros.filter((r) => r.latitud != null && r.longitud != null);
}
