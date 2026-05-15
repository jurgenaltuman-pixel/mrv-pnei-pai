import type { ContadorViviendas } from '@/types/mrv';
import { resumenAbiertasCerradas } from '@/lib/housing-stats';

const KEY_PREFIX = 'mrv_jornada_';

function todayKey(userId: string): string {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${KEY_PREFIX}${userId}_${day}`;
}

export interface JornadaStats extends ContadorViviendas {
  registrosGuardados: number;
  ultimaActualizacion: number;
}

const EMPTY: JornadaStats = {
  efectivas: 0,
  noEfectivas: 0,
  fallidas: 0,
  renuentes: 0,
  registrosGuardados: 0,
  ultimaActualizacion: 0,
};

export function getJornadaStats(userId: string): JornadaStats {
  try {
    const raw = localStorage.getItem(todayKey(userId));
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY };
  }
}

export function acumularJornada(
  userId: string,
  delta: Partial<ContadorViviendas>,
  registrosDelta = 1
): JornadaStats {
  const current = getJornadaStats(userId);
  const next: JornadaStats = {
    efectivas: current.efectivas + (delta.efectivas ?? 0),
    noEfectivas: current.noEfectivas + (delta.noEfectivas ?? 0),
    fallidas: current.fallidas + (delta.fallidas ?? 0),
    renuentes: current.renuentes + (delta.renuentes ?? 0),
    registrosGuardados: current.registrosGuardados + registrosDelta,
    ultimaActualizacion: Date.now(),
  };
  localStorage.setItem(todayKey(userId), JSON.stringify(next));
  return next;
}

export function casasAbiertasCerradas(stats: ContadorViviendas) {
  return resumenAbiertasCerradas(stats);
}
