import { memo, useMemo } from 'react';
import { computeRoundSummary, getEstadoConfig } from '@/lib/croquis-housing';
import type { CasaMonitoreo } from '@/types/round-monitoring';
import { Home } from 'lucide-react';

interface Props {
  moduloLabel?: string;
  roundCodigo?: string;
  casas: CasaMonitoreo[];
  totalCasas: number;
  /** Vista más compacta en tarjeta «Continuar ronda». */
  compact?: boolean;
}

function RoundProgressPanel({ moduloLabel, roundCodigo, casas, totalCasas, compact }: Props) {
  const summary = useMemo(() => computeRoundSummary(casas, totalCasas), [casas, totalCasas]);
  const pct =
    totalCasas > 0 ? Math.min(100, Math.round((summary.efectivas / totalCasas) * 100)) : 0;
  const siguiente = casas.find((c) => !c.guardada);

  return (
    <div
      className={`rounded-xl border border-primary/30 bg-primary/5 dark:bg-primary/10 ${
        compact ? 'px-3 py-2.5 space-y-2' : 'px-3 py-3 space-y-2.5 mb-3'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <Home className="w-4 h-4 max-lg:w-5 max-lg:h-5 shrink-0 text-primary" />
          <div className="min-w-0">
            {moduloLabel && (
              <p className="text-xs max-lg:text-sm font-bold text-foreground truncate">Ronda: {moduloLabel}</p>
            )}
            {roundCodigo && (
              <p className="text-[10px] font-mono text-muted-foreground">ID {roundCodigo}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              <span className="text-success font-bold">{summary.efectivas}</span>
              {' / '}
              {totalCasas} casas efectivas (E)
              {summary.visitadas > summary.efectivas
                ? ` · ${summary.visitadas} visitas`
                : ''}
            </p>
          </div>
        </div>
        <span className="text-sm max-lg:text-base font-black tabular-nums text-primary shrink-0">{pct}%</span>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden>
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] font-semibold">
        <span className="text-success">E {summary.efectivas}</span>
        <span className="text-warning">N {summary.noEfectivas}</span>
        <span className="text-primary">F {summary.fallidas}</span>
        <span className="text-destructive">R {summary.renuentes}</span>
        {summary.totalNinos > 0 && (
          <span className="text-muted-foreground">
            · {summary.totalNinos} niño/a · {summary.vacunados} vac.
          </span>
        )}
      </div>

      <p className="text-[9px] text-muted-foreground text-center">
        Casillas = solo casas efectivas (E). N, F y R no marcan casilla.
      </p>
      <div className="flex flex-wrap gap-1 justify-center max-h-12 overflow-y-auto py-0.5" aria-hidden>
        {Array.from({ length: totalCasas }, (_, i) => {
          const slot = i + 1;
          const filled = slot <= summary.efectivas;
          const nextE = slot === summary.efectivas + 1 && summary.efectivas < totalCasas;
          return (
            <span
              key={slot}
              title={
                filled
                  ? `Efectiva ${slot} de ${totalCasas}`
                  : nextE
                    ? `Siguiente meta: efectiva ${slot}`
                    : `Meta efectiva ${slot} (pendiente)`
              }
              className={`inline-flex items-center justify-center min-w-[1.35rem] h-5 px-0.5 rounded text-[9px] font-black border ${
                filled
                  ? 'bg-success text-success-foreground border-success'
                  : nextE
                    ? 'bg-muted/50 text-muted-foreground border-primary ring-2 ring-primary/40'
                    : 'bg-muted/50 text-muted-foreground border-border'
              }`}
            >
              {slot}
            </span>
          );
        })}
      </div>

      {siguiente ? (
        <p className="text-[10px] text-muted-foreground text-center">
          {siguiente.estado
            ? `Continuar casa ${siguiente.numero} (${getEstadoConfig(siguiente.estado).titulo})`
            : `Próxima: casa ${siguiente.numero}`}
        </p>
      ) : (
        <p className="text-[10px] text-success font-semibold text-center">Módulo completo — revisá resumen</p>
      )}
    </div>
  );
}

export default memo(RoundProgressPanel);
