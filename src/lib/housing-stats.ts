import type { ContadorViviendas } from '@/types/mrv';
import { CROQUIS_ESTADOS, getEstadoConfig } from '@/lib/croquis-housing';
import type { CasaEstadoCode } from '@/types/round-monitoring';

const KEY_BY_CODE: Record<CasaEstadoCode, keyof ContadorViviendas> = {
  E: 'efectivas',
  N: 'noEfectivas',
  F: 'fallidas',
  R: 'renuentes',
};

const GRUPO_BY_CODE: Record<CasaEstadoCode, 'abierta' | 'cerrada'> = {
  E: 'abierta',
  N: 'cerrada',
  F: 'cerrada',
  R: 'abierta',
};

const DESCRIPCION_BY_CODE: Record<CasaEstadoCode, string> = {
  E: 'La brigada entró y registró datos del niño elegible (o rechazo con datos).',
  N: 'Puerta cerrada, no hay niños elegibles o no se pudo abordar la vivienda.',
  F: 'Casa cerrada o sin responsable; puede haber o no niños elegibles en el hogar.',
  R: 'Había adulto pero se negó a dar información.',
};

function splitBgSoft(bgSoft: string) {
  const parts = bgSoft.split(' ');
  return {
    bgSoft: parts.find((p) => p.startsWith('bg-')) ?? bgSoft,
    borderClass: parts.find((p) => p.startsWith('border-')) ?? 'border-border',
  };
}

/** Tipos de vivienda — mismas etiquetas que monitoreo (CROQUIS_ESTADOS) */
export const TIPOS_VIVIENDA = CROQUIS_ESTADOS.map((e) => {
  const soft = splitBgSoft(e.bgSoft);
  return {
    code: e.code,
    key: KEY_BY_CODE[e.code],
    titulo: e.titulo,
    subtitulo: e.linea2,
    descripcion: DESCRIPCION_BY_CODE[e.code],
    grupo: GRUPO_BY_CODE[e.code],
    colorClass: e.colorClass.split(' ').filter((c) => !c.startsWith('border-')).join(' '),
    borderClass: soft.borderClass,
    bgSoft: soft.bgSoft,
  };
});

export function subtituloEstado(code: CasaEstadoCode): string {
  return getEstadoConfig(code).linea2;
}

export type HousingCounts = ContadorViviendas;

export function sumarViviendas(c: HousingCounts): number {
  return c.efectivas + c.noEfectivas + c.fallidas + c.renuentes;
}

/**
 * Resumen jornada (informe MRV):
 * - Abiertas = E + N + R
 * - Fallida · cerradas = solo F
 */
export function resumenAbiertasCerradas(c: HousingCounts) {
  const abiertas = c.efectivas + c.noEfectivas + c.renuentes;
  const cerradas = c.fallidas;
  const total = sumarViviendas(c);
  return {
    abiertas,
    fallidas: cerradas,
    cerradas,
    total,
    pctAbiertas: total > 0 ? Math.round((abiertas / total) * 100) : 0,
    pctFallidas: total > 0 ? Math.round((cerradas / total) * 100) : 0,
    pctCerradas: total > 0 ? Math.round((cerradas / total) * 100) : 0,
  };
}

export function contadorDesdeDashboard(v: {
  efectiva: number;
  revisitada: number;
  sin_adulto_responsable: number;
  renuente: number;
}): HousingCounts {
  return {
    efectivas: v.efectiva,
    noEfectivas: v.revisitada,
    fallidas: v.sin_adulto_responsable,
    renuentes: v.renuente,
  };
}
