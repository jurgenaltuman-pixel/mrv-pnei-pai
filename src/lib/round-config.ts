import type { RoundConfig } from '@/types/round-monitoring';

const CONFIG_KEY = 'mrv_round_config';
const ADMIN_SESSION_KEY = 'mrv_admin_session';
const DEFAULT_CASAS = 20;
const DEFAULT_ADMIN_PASS = 'mrvadmin';

/** Máximo de viviendas/casas por módulo (ronda + ampliaciones). */
export const MAX_CASAS_POR_MODULO = 100;
export const MIN_CASAS_POR_MODULO = 4;

export function clampCasasPorModulo(n: number): number {
  return Math.min(MAX_CASAS_POR_MODULO, Math.max(MIN_CASAS_POR_MODULO, n));
}

export function getRoundConfig(): RoundConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { casasPorModulo: DEFAULT_CASAS };
    const parsed = JSON.parse(raw) as RoundConfig;
    return {
      casasPorModulo: clampCasasPorModulo(parsed.casasPorModulo || DEFAULT_CASAS),
    };
  } catch {
    return { casasPorModulo: DEFAULT_CASAS };
  }
}

export function setRoundConfig(cfg: Partial<RoundConfig>) {
  const current = getRoundConfig();
  const next = { ...current, ...cfg };
  if (cfg.casasPorModulo != null) {
    next.casasPorModulo = clampCasasPorModulo(cfg.casasPorModulo);
  }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
}

export function verifyAdminPassword(input: string): boolean {
  const expected = import.meta.env.VITE_MRV_ADMIN_PASSWORD || DEFAULT_ADMIN_PASS;
  return input.trim() === expected;
}

export function setAdminSession(ok: boolean) {
  if (ok) sessionStorage.setItem(ADMIN_SESSION_KEY, String(Date.now()));
  else sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function hasAdminSession(): boolean {
  const t = sessionStorage.getItem(ADMIN_SESSION_KEY);
  if (!t) return false;
  const ts = Number(t);
  return Number.isFinite(ts) && Date.now() - ts < 8 * 60 * 60 * 1000;
}
