import { countCasasEfectivas } from '@/lib/croquis-housing';
import { isRoundResumable } from '@/lib/round-resume';
import type { RoundMonitoring } from '@/types/round-monitoring';

/** Máximo de rondas incompletas simultáneas por usuario (propias o como colaborador). */
export const MAX_ACTIVE_ROUNDS_PER_USER = 2;

export function isRoundDraftActive(round: RoundMonitoring): boolean {
  if (!isRoundResumable(round)) return false;
  if (round.completedAt != null && countCasasEfectivas(round.casas) >= round.totalCasas) {
    return false;
  }
  return countCasasEfectivas(round.casas) < round.totalCasas;
}

export function countActiveRounds(rounds: RoundMonitoring[]): number {
  return rounds.filter(isRoundDraftActive).length;
}
