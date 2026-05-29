import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Play } from 'lucide-react';
import { formatRoundCodigoDisplay } from '@/lib/round-codigo';
import { formatFechaHoraPy } from '@/lib/format-fecha';
import { rondaIncompleta } from '@/lib/round-resume';
import { countCasasEfectivas } from '@/lib/croquis-housing';
import { roundMonitoringStorage } from '@/services/roundMonitoringStorage';
import type { RoundMonitoring } from '@/types/round-monitoring';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface Props {
  userId: string;
  activeRoundId?: string | null;
  onResume: (round: RoundMonitoring) => void;
  refreshKey?: number;
}

const MAX_VISIBLE = 24;

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
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const visibles = pendientes.slice(0, MAX_VISIBLE);
  const restantes = pendientes.length - MAX_VISIBLE;

  const handleChipClick = () => {
    if (pendientes.length === 1) {
      onResume(pendientes[0]);
      return;
    }
    setSheetOpen(true);
  };

  const resumeFromSheet = (r: RoundMonitoring) => {
    onResume(r);
    setSheetOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleChipClick}
        className="fixed bottom-[calc(3.85rem+env(safe-area-inset-bottom))] right-2.5 z-40 flex items-center gap-1 rounded-full border border-border/80 bg-card/95 backdrop-blur-sm shadow-md pl-2 pr-2.5 py-1.5 text-left hover:bg-muted/50 active:scale-[0.98]"
        aria-label={
          pendientes.length === 1
            ? `Continuar ronda ${pendientes[0].moduloLabel}`
            : `Ver ${pendientes.length} rondas recientes`
        }
      >
        <History className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-[10px] font-bold tabular-nums text-primary leading-none">
          {pendientes.length}
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground hidden sm:inline">
          recientes
        </span>
      </button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-4 max-h-[min(72vh,520px)] flex flex-col"
        >
          <SheetHeader className="text-left pb-2 shrink-0">
            <SheetTitle className="text-base">Rondas recientes</SheetTitle>
            <SheetDescription>
              {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'} — elegí una para
              continuar
            </SheetDescription>
          </SheetHeader>
          <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y border-t border-border/60 -mx-1">
            {visibles.map((r) => {
              const eff = countCasasEfectivas(r.casas);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => resumeFromSheet(r)}
                    className="w-full flex items-start gap-2 px-2 py-2.5 text-left hover:bg-muted/40 rounded-lg"
                  >
                    <Play className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-bold truncate block">{r.moduloLabel}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {formatRoundCodigoDisplay(r)} · {eff}/{r.totalCasas} E
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Inicio: {fmtInicio(r)} · Última: {fmtUltima(r)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {restantes > 0 && (
              <li className="px-2 py-2 text-[10px] text-center text-muted-foreground">
                +{restantes} más en este equipo
              </li>
            )}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
