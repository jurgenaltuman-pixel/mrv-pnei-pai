import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, History, Play } from 'lucide-react';
import { formatRoundCodigoDisplay } from '@/lib/round-codigo';
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

  return (
    <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-2.5 pointer-events-none">
      <div className="max-w-6xl mx-auto pointer-events-auto">
        <div className="rounded-2xl border border-primary/35 bg-card/95 backdrop-blur-md shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={() => (more ? setExpanded((v) => !v) : onResume(primary))}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
          >
            <History className="w-4 h-4 text-primary shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-primary block">
                {pendientes.length === 1 ? 'Ronda pendiente' : `${pendientes.length} rondas recientes`}
              </span>
              <span className="text-xs font-semibold truncate block">{primary.moduloLabel}</span>
              <span className="text-[10px] font-mono text-muted-foreground">
                ID {formatRoundCodigoDisplay(primary)} · {countCasasEfectivas(primary.casas)}/{primary.totalCasas} E
              </span>
            </span>
            {more ? (
              expanded ? (
                <ChevronDown className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronUp className="w-4 h-4 shrink-0" />
              )
            ) : (
              <Play className="w-4 h-4 text-primary shrink-0" />
            )}
          </button>
          {(expanded || !more) && (
            <ul className={`border-t divide-y ${more && !expanded ? 'hidden' : ''}`}>
              {pendientes.map((r) => {
                const eff = countCasasEfectivas(r.casas);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onResume(r)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 text-xs"
                    >
                      <Play className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="font-bold block truncate">{r.moduloLabel}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ID {formatRoundCodigoDisplay(r)} · {eff}/{r.totalCasas} E · fase {r.fase}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
