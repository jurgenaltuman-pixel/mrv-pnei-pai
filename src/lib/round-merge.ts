import type { CasaEstadoCode, CasaMonitoreo, NinoCasa, RoundMonitoring } from '@/types/round-monitoring';
import { aplicarMetaFija } from '@/lib/round-meta';

function mergeNino(a: NinoCasa, b: NinoCasa): NinoCasa {
  const aAt = a.registroId ? 1 : 0;
  const bAt = b.registroId ? 1 : 0;
  if (bAt > aAt) return { ...a, ...b };
  if (aAt > bAt) return { ...a, ...b };
  return { ...b, ...a };
}

function mergeNinos(a: NinoCasa[], b: NinoCasa[]): NinoCasa[] {
  const map = new Map<string, NinoCasa>();
  for (const n of a) map.set(n.id, n);
  for (const n of b) {
    const ex = map.get(n.id);
    map.set(n.id, ex ? mergeNino(ex, n) : n);
  }
  return [...map.values()];
}

/** Evita que un borrador viejo en la nube convierta E→N/F/R sin edición real. */
function mergeEstadoGuardada(
  older: CasaMonitoreo,
  newer: CasaMonitoreo,
  merged: CasaEstadoCode | null
): CasaEstadoCode | null {
  if (!older.estado || !newer.estado || older.estado === newer.estado) return merged;
  if (older.estado !== 'E') return merged;

  const olderKids = older.ninos?.length ?? 0;
  const newerKids = newer.ninos?.length ?? 0;
  const newerIsDowngrade = newer.estado === 'N' || newer.estado === 'F' || newer.estado === 'R';

  if (!newerIsDowngrade) return merged;

  // Borrador remoto sin niños que pisa una E con datos → mantener E
  if (olderKids > 0 && newerKids === 0) return 'E';

  // Re-edición explícita: más de 2 min después y con datos en la visita nueva
  const delta = (newer.guardadaAt ?? 0) - (older.guardadaAt ?? 0);
  if (delta >= 120_000 && (newerKids > 0 || newer.latitud != null)) return merged;

  return 'E';
}

function mergeCasa(a: CasaMonitoreo, b: CasaMonitoreo): CasaMonitoreo {
  if (!b.guardada && a.guardada) return a;
  if (!a.guardada && b.guardada) return b;
  if (!a.guardada && !b.guardada) return a.numero <= b.numero ? a : b;

  const aAt = a.guardadaAt ?? 0;
  const bAt = b.guardadaAt ?? 0;
  const newer = bAt >= aAt ? b : a;
  const older = bAt >= aAt ? a : b;
  const base = { ...older, ...newer };
  const estado = mergeEstadoGuardada(older, newer, base.estado ?? null);

  return {
    ...base,
    estado,
    ninos: mergeNinos(a.ninos || [], b.ninos || []),
  };
}

/** Une el trabajo de dos brigadistas en la misma ronda (mismo round.id). */
export function mergeRoundMonitoring(
  local: RoundMonitoring,
  remote: RoundMonitoring
): RoundMonitoring {
  const byNum = new Map<number, CasaMonitoreo>();
  for (const c of local.casas || []) byNum.set(c.numero, c);
  for (const c of remote.casas || []) {
    const ex = byNum.get(c.numero);
    byNum.set(c.numero, ex ? mergeCasa(ex, c) : c);
  }

  const maxNum = Math.max(0, ...byNum.keys(), local.casas?.length ?? 0, remote.casas?.length ?? 0);
  const casas: CasaMonitoreo[] = [];
  for (let n = 1; n <= maxNum; n += 1) {
    if (byNum.has(n)) casas.push(byNum.get(n)!);
  }

  const colabIds = new Set<string>([
    ...(local.colaboradorUserIds || []).map(String),
    ...(remote.colaboradorUserIds || []).map(String),
  ]);
  const colabNames = [...new Set([...(local.colaboradores || []), ...(remote.colaboradores || [])])];

  const merged: RoundMonitoring = {
    ...local,
    ...remote,
    userId: local.userId || remote.userId,
    colaboradorUserIds: [...colabIds].filter(Boolean),
    colaboradores: colabNames,
    casas,
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0),
    createdAt: Math.min(local.createdAt || 0, remote.createdAt || 0) || local.createdAt,
  };

  if (local.fase !== 'start' && remote.fase !== 'start') {
    const faseRank: Record<string, number> = {
      start: 0,
      croquis: 1,
      house: 2,
      'add-child': 3,
      'edit-casa': 3,
      summary: 4,
    };
    merged.fase =
      (faseRank[remote.fase] ?? 0) > (faseRank[local.fase] ?? 0) ? remote.fase : local.fase;
  }

  return aplicarMetaFija(merged);
}
