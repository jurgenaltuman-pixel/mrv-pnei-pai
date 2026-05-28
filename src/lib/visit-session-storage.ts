import type { ContadorViviendas } from '@/types/mrv';

const KEY_PREFIX = 'mrv_visita_';

export type VisitSessionDraft = {
  regionId: number | null;
  distritoId: number | null;
  servicioId: number | null;
  servicioManual: string;
  barrio: string;
  responsable: string;
  mapsLink: string;
  contador: ContadorViviendas;
  viviendaTipo: 'efectiva' | 'revisitada' | 'sin_adulto_responsable' | 'renuente';
  workflowStep: number;
  updatedAt: number;
};

const EMPTY_CONTADOR: ContadorViviendas = {
  efectivas: 0,
  noEfectivas: 0,
  fallidas: 0,
  renuentes: 0,
};

function sessionKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export function loadVisitSession(userId: string): VisitSessionDraft | null {
  try {
    const raw = localStorage.getItem(sessionKey(userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<VisitSessionDraft>;
    return {
      regionId: p.regionId ?? null,
      distritoId: p.distritoId ?? null,
      servicioId: p.servicioId ?? null,
      servicioManual: p.servicioManual ?? '',
      barrio: p.barrio ?? '',
      responsable: p.responsable ?? '',
      mapsLink: p.mapsLink ?? '',
      contador: { ...EMPTY_CONTADOR, ...p.contador },
      viviendaTipo: p.viviendaTipo ?? 'efectiva',
      workflowStep: p.workflowStep ?? 1,
      updatedAt: p.updatedAt ?? 0,
    };
  } catch {
    return null;
  }
}

export function saveVisitSession(userId: string, draft: Omit<VisitSessionDraft, 'updatedAt'>): void {
  try {
    localStorage.setItem(
      sessionKey(userId),
      JSON.stringify({ ...draft, updatedAt: Date.now() })
    );
  } catch {
    /* quota */
  }
}

export function clearVisitSession(userId: string): void {
  localStorage.removeItem(sessionKey(userId));
}

/** Incremento de un solo código al guardar registro */
export function deltaContadorPorTipo(
  tipo: VisitSessionDraft['viviendaTipo']
): Partial<ContadorViviendas> {
  switch (tipo) {
    case 'efectiva':
      return { efectivas: 1 };
    case 'revisitada':
      return { noEfectivas: 1 };
    case 'sin_adulto_responsable':
      return { fallidas: 1 };
    case 'renuente':
      return { renuentes: 1 };
    default:
      return {};
  }
}
