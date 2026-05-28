import type { RoundHistoryRow } from '@/services/roundHistoryApi';

export type RoundServicioStats = {
  servicio: string;
  rondas: number;
  aprobadas: number;
  vacunados: number;
  totalNinos: number;
  coberturaPromedio: number | null;
};

export function aggregateRoundsByServicio(rows: RoundHistoryRow[]): RoundServicioStats[] {
  const map = new Map<string, RoundServicioStats>();
  for (const r of rows) {
    const servicio = (r.assigned_servicio || '').trim() || 'Sin servicio';
    let s = map.get(servicio);
    if (!s) {
      s = { servicio, rondas: 0, aprobadas: 0, vacunados: 0, totalNinos: 0, coberturaPromedio: null };
      map.set(servicio, s);
    }
    s.rondas += 1;
    if (r.aprobado) s.aprobadas += 1;
    s.vacunados += r.vacunados || 0;
    s.totalNinos += r.totalNinos || 0;
  }
  return [...map.values()]
    .map((s) => {
      const coberturas = rows
        .filter((r) => ((r.assigned_servicio || '').trim() || 'Sin servicio') === s.servicio)
        .map((r) => r.coberturaVacunacion)
        .filter((c): c is number => c != null && Number.isFinite(c));
      const coberturaPromedio =
        coberturas.length > 0
          ? Math.round((coberturas.reduce((a, b) => a + b, 0) / coberturas.length) * 10) / 10
          : null;
      return { ...s, coberturaPromedio };
    })
    .sort((a, b) => b.rondas - a.rondas)
    .slice(0, 12);
}
