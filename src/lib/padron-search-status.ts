import { padronSearchDurationLine, padronSearchEtaHint } from '@/lib/padron-search-timing';

export type PadronSearchModo = 'documento' | 'personales';

export type PadronSearchStatus =
  | { kind: 'idle' }
  | { kind: 'searching'; modo: PadronSearchModo }
  | { kind: 'found'; count: number; modo: PadronSearchModo; ms?: number }
  | { kind: 'not_found'; modo: PadronSearchModo; ms?: number }
  | { kind: 'error'; message: string; modo?: PadronSearchModo; ms?: number };

export function padronSearchBannerText(status: PadronSearchStatus): string | null {
  switch (status.kind) {
    case 'idle':
      return null;
    case 'searching':
      return padronSearchEtaHint(status.modo);
    case 'found': {
      const base =
        status.count === 1
          ? 'Encontrado en el padrón (1 coincidencia).'
          : `Encontrado en el padrón (${status.count} coincidencias). Elegí una fila.`;
      const dur = status.ms != null ? padronSearchDurationLine(status.ms) : '';
      return dur ? `${base} ${dur}` : base;
    }
    case 'not_found': {
      const base = 'No encontrado en el padrón. Podés completar el alta o adjuntos opcionales.';
      const dur = status.ms != null ? padronSearchDurationLine(status.ms) : '';
      return dur ? `${base} ${dur}` : base;
    }
    case 'error':
      return status.message;
    default:
      return null;
  }
}

export function padronSearchBannerTone(
  status: PadronSearchStatus
): 'neutral' | 'success' | 'warning' | 'error' {
  switch (status.kind) {
    case 'searching':
      return 'neutral';
    case 'found':
      return 'success';
    case 'not_found':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'neutral';
  }
}
