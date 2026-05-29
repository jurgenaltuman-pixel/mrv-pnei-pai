import type { CasaEstadoCode, CasaEstadoDb } from '@/types/round-monitoring';

export const CROQUIS_ESTADOS = [
  {
    code: 'E' as const,
    titulo: 'Efectiva',
    linea1: 'Efectiva',
    linea2: 'Abierta con niños de 1 a 5 años',
    linea3: '',
    colorClass: 'bg-success text-success-foreground border-success',
    bgSoft: 'bg-success/15 border-success/40',
    icon: 'E',
  },
  {
    code: 'N' as const,
    titulo: 'No efectiva',
    linea1: 'No efectiva',
    linea2: 'Abierta sin niños de 1 a 5 años',
    linea3: '',
    colorClass: 'bg-warning text-warning-foreground border-warning',
    bgSoft: 'bg-warning/15 border-warning/40',
    icon: 'N',
  },
  {
    code: 'F' as const,
    titulo: 'Fallida',
    linea1: 'Fallida',
    linea2: 'Cerrada o casa con niños/as de 1 a 5 años, sin responsable',
    linea3: '',
    colorClass: 'bg-primary text-primary-foreground border-primary',
    bgSoft: 'bg-primary/15 border-primary/40',
    icon: 'F',
  },
  {
    code: 'R' as const,
    titulo: 'Renuente',
    linea1: 'Renuente',
    linea2: 'Rechazo',
    linea3: '',
    colorClass: 'bg-destructive text-destructive-foreground border-destructive',
    bgSoft: 'bg-destructive/15 border-destructive/40',
    icon: 'R',
  },
] as const;

export function estadoCodeToDb(code: CasaEstadoCode): CasaEstadoDb {
  const map: Record<CasaEstadoCode, CasaEstadoDb> = {
    E: 'efectiva',
    N: 'revisitada',
    F: 'sin_adulto_responsable',
    R: 'renuente',
  };
  return map[code];
}

/** Solo casa efectiva (E) requiere registro de niño/a. */
export function requiereNinos(code: CasaEstadoCode | null): boolean {
  return code === 'E';
}

export function puedeGuardarSinNinos(code: CasaEstadoCode | null): boolean {
  return code === 'F' || code === 'R';
}

export function getEstadoConfig(code: CasaEstadoCode) {
  return CROQUIS_ESTADOS.find((e) => e.code === code)!;
}

/** N, F y R: el brigadista puede volver al formulario de visita (GPS, estado, etc.). */
export function casaPermiteReedicionVisita(code: CasaEstadoCode | null): boolean {
  return code === 'N' || code === 'F' || code === 'R';
}

/** Casas efectivas (E) guardadas — único avance hacia la meta del módulo (X/20). */
export function countCasasEfectivas(
  casas: { guardada: boolean; estado: CasaEstadoCode | null }[]
): number {
  return casas.filter((c) => c.guardada && c.estado === 'E').length;
}

export function computeRoundSummary(
  casas: { estado: CasaEstadoCode | null; guardada: boolean; ninos: { vacunado: boolean }[] }[],
  totalCasas: number
) {
  let efectivas = 0;
  let noEfectivas = 0;
  let fallidas = 0;
  let renuentes = 0;
  let totalNinos = 0;
  let vacunados = 0;
  let visitadas = 0;

  for (const c of casas) {
    if (!c.guardada || !c.estado) continue;
    visitadas++;
    if (c.estado === 'E') efectivas++;
    else if (c.estado === 'N') noEfectivas++;
    else if (c.estado === 'F') fallidas++;
    else if (c.estado === 'R') renuentes++;
    for (const n of c.ninos) {
      totalNinos++;
      if (n.vacunado) vacunados++;
    }
  }

  return {
    totalCasas,
    visitadas,
    efectivas,
    noEfectivas,
    fallidas,
    renuentes,
    totalNinos,
    vacunados,
    noVacunados: totalNinos - vacunados,
  };
}
