import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, History, Play } from 'lucide-react';
import { formatRoundCodigoDisplay } from '@/lib/round-codigo';
import { formatFechaHoraPy } from '@/lib/format-fecha';
import { rondaIncompleta } from '@/lib/round-resume';
import { countCasasEfectivas } from '@/lib/croquis-housing';
import { roundMonitoringStorage } from '@/services/roundMonitoringStorage';
import type { RoundMonitoring } from '@/types/round-monitoring';

interface Props {
  userId: string;
  activeRoundId?: string | null;
  onResume: (round: RoundMonitoring) => void;
  refreshKey?: number;
}

const MAX_VISIBLE = 6;

function fmtUltima(r: RoundMonitoring): string {
  return formatFechaHoraPy(new Date(r.updatedAt || r.createdAt));
}

function fmtInicio(r: RoundMonitoring): string {
  return formatFechaHoraPy(new Date(r.createdAt));
}

export default function RecentRoundsDock({
  userId,
  activeRoundId,
  onResume,
  refreshKey = 0,
}: Props) {
  const [rounds, setRounds] = useState<RoundMonitoring[]>([]);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    const rows = await roundMonitoringStorage.listResumableForUser(userId, {
      includeDismissed: false,
    });
    setRounds(rows.filter((r) => r.id !== activeRoundId));
  }, [userId, activeRoundId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const pendientes = useMemo(() => rounds.filter((r) => rondaIncompleta(r)), [rounds]);

  if (!pendientes.length) return null;

  const primary = pendientes[0];
  const more = pendientes.length > 1;
  const visibles = expanded ? pendientes.slice(0, MAX_VISIBLE) : [];
  const restantes = pendientes.length - MAX_VISIBLE;

  return (
    <div className="fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-2 sm:px-3 pointer-events-none">
      <div className="max-w-6xl mx-auto pointer-events-auto">
        <div
          className={`rounded-xl border border-border/80 bg-card/90 backdrop-blur-sm shadow-md overflow-hidden transition-all ${
            expanded ? 'max-w-md sm:max-w-lg ml-auto mr-0 sm:mr-2' : 'max-w-full'
          }`}
        >
          <div className="flex items-stretch">
            <button
              type="button"
              onClick={() => {
                if (more) setExpanded((v) => !v);
                else onResume(primary);
              }}
              className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 text-left sm:px-3"
            >
              <History className="w-3.5 h-3.5 text-primary shrink-0 opacity-80" />
              <span className="min-w-0 flex-1">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {pendientes.length === 1 ? 'Ronda pendiente' : `${pendientes.length} recientes`}
                </span>
                <span className="text-[11px] sm:text-xs font-semibold truncate block text-foreground">
                  {primary.moduloLabel}
                </span>
                <span className="text-[9px] sm:text-[10px] text-muted-foreground font-mono truncate block">
                  {formatRoundCodigoDisplay(primary)} · {countCasasEfectivas(primary.casas)}/{primary.totalCasas} E
                </span>
                <span className="text-[9px] text-muted-foreground truncate block">
                  Última vez: {fmtUltima(primary)}
                </span>
              </span>
            </button>
            {more ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="shrink-0 px-2.5 border-l border-border/60 flex items-center text-muted-foreground hover:bg-muted/40"
                aria-label={expanded ? 'Contraer' : 'Ver lista'}
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onResume(primary)}
                className="shrink-0 px-3 border-l border-border/60 flex items-center text-primary hover:bg-primary/5"
                aria-label="Continuar"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
          </div>

          {expanded && more && (
            <ul className="border-t border-border/60 max-h-[min(38vh,220px)] overflow-y-auto overscroll-contain divide-y">
              {visibles.map((r) => {
                const eff = countCasasEfectivas(r.casas);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onResume(r);
                        setExpanded(false);
                      }}
                      className="w-full flex items-start gap-2 px-2.5 py-2 text-left hover:bg-muted/40 sm:px-3"
                    >
                      <Play className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="text-[11px] font-bold truncate block">{r.moduloLabel}</span>
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {formatRoundCodigoDisplay(r)} · {eff}/{r.totalCasas} E
                        </span>
                        <span className="text-[9px] text-muted-foreground block">
                          Inicio: {fmtInicio(r)}
                        </span>
                        <span className="text-[9px] text-muted-foreground block">
                          Última vez: {fmtUltima(r)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {restantes > 0 && (
                <li className="px-3 py-1.5 text-[9px] text-center text-muted-foreground">
                  +{restantes} más en este equipo
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
