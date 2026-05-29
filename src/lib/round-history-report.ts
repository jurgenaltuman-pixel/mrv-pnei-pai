import { downloadRoundReportExcel, downloadRoundReportPdf } from '@/lib/export-round-report';
import { evaluateRoundMonitoring } from '@/lib/round-evaluation';
import {
  fetchRoundHistoryDetail,
  type RoundHistoryRow,
  type RoundHistorySnapshot,
} from '@/services/roundHistoryApi';
import type { RoundMonitoring, RoundSummary } from '@/types/round-monitoring';

function buildSyntheticSnapshot(row: RoundHistoryRow): RoundHistorySnapshot {
  const summary: RoundSummary = {
    totalCasas: row.totalCasas,
    visitadas: row.visitadas,
    efectivas: row.efectivas,
    noEfectivas: row.noEfectivas,
    fallidas: row.fallidas,
    renuentes: row.renuentes,
    totalNinos: row.totalNinos,
    vacunados: row.vacunados,
    noVacunados: Math.max(0, row.totalNinos - row.vacunados),
  };
  const evaluation = evaluateRoundMonitoring(summary);
  if (row.coberturaVacunacion != null) {
    evaluation.coberturaVacunacion = row.coberturaVacunacion;
  }
  evaluation.aprobado = row.aprobado;
  evaluation.titulo = row.aprobado ? 'MONITOREO APROBADO' : 'MONITOREO CAÍDO';

  const round: RoundMonitoring = {
    id: row.round_local_id || row.id,
    codigo: row.round_codigo || row.id.slice(0, 8),
    userId: row.user_id,
    moduloLabel: row.nombre,
    totalCasas: row.totalCasas,
    casas: [],
    casaActiva: 1,
    fase: 'summary',
    createdAt: row.completadaAt,
    updatedAt: row.completadaAt,
    completedAt: row.completadaAt,
    region: row.assigned_region || '',
    distrito: row.assigned_distrito || '',
    servicio: row.assigned_servicio || null,
    barrio: row.barrio || row.nombre,
    responsable: row.responsable || null,
    entrevistador: row.entrevistador || row.responsable || null,
    colaboradores: row.colaboradores || [],
    colaboradorUserIds: [],
    ultimaCasaResumen: null,
  };

  return { round, summary, evaluation };
}

function parseSnapshot(raw: unknown): RoundHistorySnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as RoundHistorySnapshot;
  if (!o.round || !o.summary || !o.evaluation) return null;
  return o;
}

async function loadSnapshot(row: RoundHistoryRow, admin?: boolean): Promise<RoundHistorySnapshot> {
  const { data, error } = await fetchRoundHistoryDetail(row.id, admin);
  if (!error && data?.snapshot) {
    const parsed = parseSnapshot(data.snapshot);
    if (parsed) return parsed;
  }
  return buildSyntheticSnapshot(row);
}

export async function downloadRoundHistoryExcel(row: RoundHistoryRow, admin?: boolean): Promise<void> {
  const { round, summary, evaluation } = await loadSnapshot(row, admin);
  downloadRoundReportExcel(round, summary, evaluation);
}

export async function downloadRoundHistoryPdf(row: RoundHistoryRow, admin?: boolean): Promise<void> {
  const { round, summary, evaluation } = await loadSnapshot(row, admin);
  downloadRoundReportPdf(round, summary, evaluation);
}
