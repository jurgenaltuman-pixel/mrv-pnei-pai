import type { ContadorViviendas } from '@/types/mrv';

/** Tipos de vivienda — etiquetas oficiales del informe MRV / dashboard */
export const TIPOS_VIVIENDA = [
  {
    code: 'E' as const,
    key: 'efectivas' as keyof ContadorViviendas,
    titulo: 'Efectiva',
    subtitulo: 'Abierta',
    descripcion: 'La brigada entró y registró datos del niño elegible (o rechazo con datos).',
    grupo: 'abierta' as const,
    colorClass: 'bg-success text-success-foreground',
    borderClass: 'border-success/40',
    bgSoft: 'bg-success/10',
  },
  {
    code: 'N' as const,
    key: 'noEfectivas' as keyof ContadorViviendas,
    titulo: 'No efectiva',
    subtitulo: 'Abierta',
    descripcion: 'Puerta cerrada, no hay niños elegibles o no se pudo abordar la vivienda.',
    grupo: 'cerrada' as const,
    colorClass: 'bg-warning text-warning-foreground',
    borderClass: 'border-warning/40',
    bgSoft: 'bg-warning/10',
  },
  {
    code: 'F' as const,
    key: 'fallidas' as keyof ContadorViviendas,
    titulo: 'Fallida',
    subtitulo: '(Cerrada/Sin adulto responsable)',
    descripcion: 'Casa cerrada o sin adulto responsable; hay niños elegibles pero no se pudo registrar.',
    grupo: 'cerrada' as const,
    colorClass: 'bg-primary text-primary-foreground',
    borderClass: 'border-primary/40',
    bgSoft: 'bg-primary/10',
  },
  {
    code: 'R' as const,
    key: 'renuentes' as keyof ContadorViviendas,
    titulo: 'Renuente',
    subtitulo: 'Rechazo',
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

/**
 * Resumen jornada (informe MRV):
 * - Cerradas (tarjeta «Fallida · cerradas») = E + N + F
 * - Abiertas (rechazo con adulto) = R
 */
export function resumenAbiertasCerradas(c: HousingCounts) {
  const cerradas = c.efectivas + c.noEfectivas + c.fallidas;
  const abiertas = c.renuentes;
  const total = sumarViviendas(c);
  return {
    abiertas,
    /** Visitas E+N+F — etiqueta «Fallida · cerradas» en UI */
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
