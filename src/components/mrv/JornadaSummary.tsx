import { useEffect, useState } from 'react';
import { Home, FileCheck, DoorOpen, CircleX, ClipboardList, Loader2 } from 'lucide-react';
import { casasAbiertasCerradas, type JornadaStats } from '@/lib/jornada-storage';
import { getRoundConfig } from '@/lib/round-config';
import { UMBRAL_COBERTURA_APROBADO } from '@/lib/round-evaluation';
import RoundHistoryAccordion from '@/components/mrv/RoundHistoryAccordion';
import { fetchMyRoundHistory } from '@/services/roundHistoryApi';

interface Props {
  stats: JornadaStats;
}

export default function JornadaSummary({ stats }: Props) {
  const [serverRounds, setServerRounds] = useState<Awaited<ReturnType<typeof fetchMyRoundHistory>>>([]);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [showRoundHistory, setShowRoundHistory] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingRounds(true);
    void fetchMyRoundHistory().then((rows) => {
      if (!cancelled) setServerRounds(rows);
    }).finally(() => {
      if (!cancelled) setLoadingRounds(false);
    });
    return () => {
      cancelled = true;
    };
  }, [stats.ultimasRondas?.length, stats.rondaActivaNombre]);

  const contador = {
    efectivas: stats.efectivas,
    noEfectivas: stats.noEfectivas,
    fallidas: stats.fallidas,
    renuentes: stats.renuentes,
  };
  const { abiertas, fallidas, total } = casasAbiertasCerradas(contador);
  const metaCasas = getRoundConfig().casasPorModulo;
  const pctJornada = metaCasas > 0 ? Math.min(100, Math.round((stats.efectivas / metaCasas) * 100)) : 0;
  const ultimaRonda = stats.ultimasRondas?.length
    ? stats.ultimasRondas[stats.ultimasRondas.length - 1]
    : null;
  const historialRows = serverRounds.length > 0 ? serverRounds : (stats.ultimasRondas ?? []);

  if (total === 0 && stats.registrosGuardados === 0 && !stats.rondaActivaNombre) return null;

  return (
    <div className="mb-3 rounded-xl border border-border bg-primary/5 dark:bg-primary/10 px-3 py-2.5 text-xs space-y-2">
      {(stats.rondaActivaNombre || ultimaRonda) && (
        <div className="flex items-start gap-2 pb-2 border-b border-border/60">
          <ClipboardList className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div className="min-w-0">
            {stats.rondaActivaNombre && (
              <p className="font-bold text-foreground truncate">
                Ronda: <span className="text-primary">{stats.rondaActivaNombre}</span>
              </p>
            )}
            {ultimaRonda && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Última cerrada: {ultimaRonda.nombre}
                {ultimaRonda.coberturaVacunacion != null
                  ? ` · ${ultimaRonda.coberturaVacunacion}% cobertura`
                  : ''}
                {' · '}
                {ultimaRonda.aprobado ? (
                  <span className="text-success font-semibold">aprobada</span>
                ) : (
                  <span className="text-destructive font-semibold">caída</span>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Home className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-bold text-foreground truncate">
            Jornada: <span className="text-primary">{total}</span> viviendas · {stats.registrosGuardados}{' '}
            encuestas
          </span>
        </div>
        <span className="text-sm font-black tabular-nums text-primary shrink-0">{pctJornada}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden>
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${pctJornada}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Meta módulo: {metaCasas} casas · aprobación ≥ {UMBRAL_COBERTURA_APROBADO}% cobertura vacunal
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-semibold">
        <span className="text-success inline-flex items-center gap-1" title="Efectivas (E)">
          <DoorOpen className="w-3.5 h-3.5" aria-hidden />
          {stats.efectivas} efectivas (E)
        </span>
        <span className="text-warning inline-flex items-center gap-1" title="No efectivas (N)">
          <CircleX className="w-3.5 h-3.5" aria-hidden />
          {stats.noEfectivas} no efectivas
        </span>
        <span className="text-muted-foreground flex items-center gap-1">
          <FileCheck className="w-3 h-3" />
          F{stats.fallidas} R{stats.renuentes}
        </span>
      </div>

      {historialRows.length > 0 && (
        <div className="pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={() => setShowRoundHistory((v) => !v)}
            className="text-[11px] font-bold text-primary flex items-center gap-1"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            {showRoundHistory ? 'Ocultar' : 'Ver'} historial de rondas ({historialRows.length})
            {loadingRounds && <Loader2 className="w-3 h-3 animate-spin" />}
          </button>
          {showRoundHistory && (
            <div className="mt-2">
              <RoundHistoryAccordion
                rows={historialRows}
                groupByUser={false}
                title="Mis rondas cerradas"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
