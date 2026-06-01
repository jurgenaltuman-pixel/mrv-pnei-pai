import type { RegistroMRV } from '@/services/dataService';
import { normalizeTipoVivienda } from '@/lib/dashboard-stats';

export type VisitaMapFilter = 'todos' | 'vacunado' | 'no_vacunado' | 'N' | 'F' | 'R';

export function getVisitaCode(r: RegistroMRV): 'E' | 'N' | 'F' | 'R' | null {
  const tipo = normalizeTipoVivienda(r.tipo_vivienda);
  if (tipo === 'efectiva') return 'E';
  if (tipo === 'revisitada') return 'N';
  if (tipo === 'sin_adulto_responsable') return 'F';
  if (tipo === 'renuente') return 'R';
  return null;
}

export function filterRegistrosByVisita(
  registros: RegistroMRV[],
  filtro: VisitaMapFilter
): RegistroMRV[] {
  if (filtro === 'todos') return registros;
  if (filtro === 'N' || filtro === 'F' || filtro === 'R') {
    return registros.filter((r) => getVisitaCode(r) === filtro);
  }
  if (filtro === 'vacunado') {
    return registros.filter((r) => getVisitaCode(r) === 'E' && r.estado_vacuna === 'vacunado');
  }
  return registros.filter((r) => getVisitaCode(r) === 'E' && r.estado_vacuna === 'no_vacunado');
}
