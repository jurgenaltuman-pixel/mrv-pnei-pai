import { countCasasEfectivas } from '@/lib/croquis-housing';
import { META_CASAS_EFECTIVAS } from '@/lib/round-meta';
import { isRoundResumable, rondaCompletada } from '@/lib/round-resume';
import type { RoundMonitoring } from '@/types/round-monitoring';

/** Máximo de rondas incompletas simultáneas por usuario (propias o como colaborador). */
export const MAX_ACTIVE_ROUNDS_PER_USER = 2;

export function isRoundDraftActive(round: RoundMonitoring): boolean {
  if (!isRoundResumable(round) || rondaCompletada(round)) return false;
  return countCasasEfectivas(round.casas) < META_CASAS_EFECTIVAS;
}

export function countActiveRounds(rounds: RoundMonitoring[]): number {
  return rounds.filter(isRoundDraftActive).length;
}
