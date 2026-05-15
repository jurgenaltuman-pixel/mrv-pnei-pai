import type { ContadorViviendas } from '@/types/mrv';

/** Tipos de vivienda según protocolo MRV en terreno */
export const TIPOS_VIVIENDA = [
  {
    code: 'E' as const,
    key: 'efectivas' as keyof ContadorViviendas,
    titulo: 'Efectiva',
    subtitulo: 'Se encuestó al niño/a',
    descripcion: 'La brigada entró y registró datos del niño elegible (o rechazo con datos).',
    grupo: 'abierta' as const,
    colorClass: 'bg-success text-success-foreground',
    borderClass: 'border-success/40',
    bgSoft: 'bg-success/10',
  },
  {
    code: 'N' as const,
    key: 'noEfectivas' as keyof ContadorViviendas,
    titulo: 'Cerrada / sin niño',
    subtitulo: 'No efectiva',
    descripcion: 'Puerta cerrada, no hay niños elegibles o no se pudo abordar la vivienda.',
    grupo: 'cerrada' as const,
    colorClass: 'bg-warning text-warning-foreground',
    borderClass: 'border-warning/40',
    bgSoft: 'bg-warning/10',
  },
  {
    code: 'F' as const,
    key: 'fallidas' as keyof ContadorViviendas,
    titulo: 'Sin adulto responsable',
    subtitulo: 'Fallida',
    descripcion: 'Hay niños elegibles pero no había adulto que autorice o informe.',
    grupo: 'abierta' as const,
    colorClass: 'bg-slate-600 text-white',
    borderClass: 'border-slate-400/40',
    bgSoft: 'bg-muted',
  },
  {
    code: 'R' as const,
    key: 'renuentes' as keyof ContadorViviendas,
    titulo: 'Adulto renuente',
    subtitulo: 'Renuente',
    descripcion: 'Había adulto pero se negó a dar información.',
    grupo: 'abierta' as const,
    colorClass: 'bg-destructive text-destructive-foreground',
    borderClass: 'border-destructive/40',
    bgSoft: 'bg-destructive/10',
  },
] as const;

export type HousingCounts = ContadorViviendas;

export function sumarViviendas(c: HousingCounts): number {
  return c.efectivas + c.noEfectivas + c.fallidas + c.renuentes;
}

/** Resumen oficial del informe: abiertas vs cerradas */
export function resumenAbiertasCerradas(c: HousingCounts) {
  const abiertas = c.efectivas + c.fallidas + c.renuentes;
  const cerradas = c.noEfectivas;
  const total = abiertas + cerradas;
  return {
    abiertas,
    cerradas,
    total,
    pctAbiertas: total > 0 ? Math.round((abiertas / total) * 100) : 0,
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
