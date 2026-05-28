import type { RoundMonitoring } from '@/types/round-monitoring';

const dismissKey = (userId: string) => `mrv_round_dismissed_${userId}`;

/** Ronda guardada que el usuario puede retomar (no quedó en pantalla de inicio vacía). */
export function isRoundResumable(round: RoundMonitoring): boolean {
  return round.fase !== 'start';
}

export function dismissRound(userId: string, roundId: string): void {
  try {
    const raw = localStorage.getItem(dismissKey(userId));
    const ids = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    ids.add(roundId);
    localStorage.setItem(dismissKey(userId), JSON.stringify([...ids]));
  } catch {
    localStorage.setItem(dismissKey(userId), JSON.stringify([roundId]));
  }
}

export function isRoundDismissed(userId: string, roundId: string): boolean {
  try {
    const raw = localStorage.getItem(dismissKey(userId));
    if (!raw) return false;
    return (JSON.parse(raw) as string[]).includes(roundId);
  } catch {
    return false;
  }
}

export function undismissRound(userId: string, roundId: string): void {
  try {
    const raw = localStorage.getItem(dismissKey(userId));
    if (!raw) return;
    const ids = (JSON.parse(raw) as string[]).filter((id) => id !== roundId);
    if (ids.length === 0) localStorage.removeItem(dismissKey(userId));
    else localStorage.setItem(dismissKey(userId), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function clearAllDismissedRounds(userId: string): void {
  try {
    localStorage.removeItem(dismissKey(userId));
  } catch {
    /* ignore */
  }
}

/** Ronda incompleta (meta de efectivas no alcanzada). */
export function rondaIncompleta(round: RoundMonitoring): boolean {
  const efectivas = round.casas.filter((c) => c.guardada && c.estado === 'E').length;
  return efectivas < round.totalCasas;
}
