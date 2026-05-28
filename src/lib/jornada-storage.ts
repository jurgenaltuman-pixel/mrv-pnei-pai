import type { ContadorViviendas } from '@/types/mrv';
import { resumenAbiertasCerradas } from '@/lib/housing-stats';

const KEY_PREFIX = 'mrv_jornada_';

function todayKey(userId: string): string {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${KEY_PREFIX}${userId}_${day}`;
}

export interface RondaHistorialItem {
  nombre: string;
  coberturaVacunacion: number | null;
  aprobado: boolean;
  efectivas: number;
  noEfectivas: number;
  fallidas: number;
  renuentes: number;
  totalNinos: number;
  vacunados: number;
  visitadas: number;
  totalCasas: number;
  completadaAt: number;
}

export interface JornadaStats extends ContadorViviendas {
  registrosGuardados: number;
  ultimaActualizacion: number;
  /** Nombre de la ronda/módulo en curso o la última cerrada. */
  rondaActivaNombre?: string;
  ultimasRondas?: RondaHistorialItem[];
}

const EMPTY: JornadaStats = {
  efectivas: 0,
  noEfectivas: 0,
  fallidas: 0,
  renuentes: 0,
  registrosGuardados: 0,
  ultimaActualizacion: 0,
  rondaActivaNombre: undefined,
  ultimasRondas: [],
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

export function setRondaActivaNombre(userId: string, nombre: string): JornadaStats {
  const current = getJornadaStats(userId);
  const next: JornadaStats = {
    ...current,
    rondaActivaNombre: nombre.trim(),
    ultimaActualizacion: Date.now(),
  };
  localStorage.setItem(todayKey(userId), JSON.stringify(next));
  return next;
}

export function registrarRondaCompletada(userId: string, item: RondaHistorialItem): JornadaStats {
  const current = getJornadaStats(userId);
  const historial = [...(current.ultimasRondas || []), item].slice(-10);
  const next: JornadaStats = {
    ...current,
    rondaActivaNombre: item.nombre,
    ultimasRondas: historial,
    ultimaActualizacion: Date.now(),
  };
  localStorage.setItem(todayKey(userId), JSON.stringify(next));
  return next;
}

export function casasAbiertasCerradas(stats: ContadorViviendas) {
  return resumenAbiertasCerradas(stats);
}
