const META_EFECTIVAS = 20;

function mergeNino(a, b) {
  const aAt = a.registroId ? 1 : 0;
  const bAt = b.registroId ? 1 : 0;
  if (bAt > aAt) return { ...a, ...b };
  if (aAt > bAt) return { ...a, ...b };
  return { ...b, ...a };
}

function mergeNinos(a, b) {
  const map = new Map();
  for (const n of a || []) map.set(n.id, n);
  for (const n of b || []) {
    const ex = map.get(n.id);
    map.set(n.id, ex ? mergeNino(ex, n) : n);
  }
  return [...map.values()];
}

function mergeEstadoGuardada(older, newer, merged) {
  if (!older.estado || !newer.estado || older.estado === newer.estado) return merged;
  if (older.estado !== 'E') return merged;
  const olderKids = older.ninos?.length ?? 0;
  const newerKids = newer.ninos?.length ?? 0;
  const newerIsDowngrade = newer.estado === 'N' || newer.estado === 'F' || newer.estado === 'R';
  if (!newerIsDowngrade) return merged;
  if (olderKids > 0 && newerKids === 0) return 'E';
  const delta = (newer.guardadaAt ?? 0) - (older.guardadaAt ?? 0);
  if (delta >= 120_000 && (newerKids > 0 || newer.latitud != null)) return merged;
  return 'E';
}

function mergeCasa(a, b) {
  if (!b.guardada && a.guardada) return a;
  if (!a.guardada && b.guardada) return b;
  if (!a.guardada && !b.guardada) return a.numero <= b.numero ? a : b;
  const aAt = a.guardadaAt ?? 0;
  const bAt = b.guardadaAt ?? 0;
  const newer = bAt >= aAt ? b : a;
  const older = bAt >= aAt ? a : b;
  const base = { ...older, ...newer };
  const estado = mergeEstadoGuardada(older, newer, base.estado ?? null);
  return { ...base, estado, ninos: mergeNinos(a.ninos, b.ninos) };
}

export function mergeRoundPayload(local, remote) {
  const byNum = new Map();
  for (const c of local?.casas || []) byNum.set(c.numero, c);
  for (const c of remote?.casas || []) {
    const ex = byNum.get(c.numero);
    byNum.set(c.numero, ex ? mergeCasa(ex, c) : c);
  }
  const maxNum = Math.max(
    0,
    ...byNum.keys(),
    local?.casas?.length ?? 0,
    remote?.casas?.length ?? 0
  );
  const casas = [];
  for (let n = 1; n <= maxNum; n += 1) {
    if (byNum.has(n)) casas.push(byNum.get(n));
  }
  const colabIds = new Set([
    ...(local?.colaboradorUserIds || []).map(String),
    ...(remote?.colaboradorUserIds || []).map(String),
  ]);
  const colabNames = [
    ...new Set([...(local?.colaboradores || []), ...(remote?.colaboradores || [])]),
  ];
  const faseRank = { start: 0, croquis: 1, house: 2, 'add-child': 3, 'edit-casa': 3, summary: 4 };
  let fase = local?.fase ?? remote?.fase;
  if (local?.fase !== 'start' && remote?.fase !== 'start') {
    fase =
      (faseRank[remote?.fase] ?? 0) > (faseRank[local?.fase] ?? 0) ? remote.fase : local.fase;
  }
  const efectivas = casas.filter((c) => c.guardada && c.estado === 'E').length;
  return {
    ...local,
    ...remote,
    userId: local?.userId || remote?.userId,
    colaboradorUserIds: [...colabIds].filter(Boolean),
    colaboradores: colabNames,
    casas,
    totalCasas: META_EFECTIVAS,
    fase: efectivas < META_EFECTIVAS && fase === 'summary' ? 'croquis' : fase,
    completedAt:
      efectivas < META_EFECTIVAS && (local?.completedAt || remote?.completedAt)
        ? null
        : local?.completedAt ?? remote?.completedAt,
    updatedAt: Math.max(local?.updatedAt || 0, remote?.updatedAt || 0),
    createdAt: Math.min(local?.createdAt || 0, remote?.createdAt || 0) || local?.createdAt,
  };
}
