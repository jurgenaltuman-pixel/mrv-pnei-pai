import { getRoundConfig } from '@/lib/round-config';
import { upperText } from '@/lib/text-uppercase';
import type { RoundMonitoring } from '@/types/round-monitoring';
import { formatRoundCodigoDisplay } from '@/lib/round-codigo';
import RoundProgressPanel from '@/components/round/RoundProgressPanel';
import { Grid3x3, Play, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

interface Props {
  barrio: string;
  setBarrio: (v: string) => void;
  barriosDisponibles: string[];
  distritoNombre: string;
  servicioNombre?: string | null;
  onStart: () => void;
  canStart: boolean;
  loadingResume?: boolean;
  savedRound?: RoundMonitoring | null;
  recoverableRounds?: RoundMonitoring[];
  onRecoverRound?: (round: RoundMonitoring) => void;
  onContinueRound?: () => void;
  onDiscardSavedRound?: () => void;
}

export default function RoundStartScreen({
  barrio,
  setBarrio,
  barriosDisponibles,
  distritoNombre,
  servicioNombre,
  onStart,
  canStart,
  loadingResume,
  savedRound,
  recoverableRounds = [],
  onRecoverRound,
  onContinueRound,
  onDiscardSavedRound,
}: Props) {
  const cfg = getRoundConfig();
  const [manualBarrio, setManualBarrio] = useState(false);
  const barriosOrdenados = useMemo(
    () => [...barriosDisponibles].sort((a, b) => a.localeCompare(b, 'es')),
    [barriosDisponibles]
  );
  const barrioEnLista = useMemo(
    () => barriosOrdenados.some((b) => b.toLowerCase() === barrio.trim().toLowerCase()),
    [barriosOrdenados, barrio]
  );
  const mostrarManual = manualBarrio || (!barrioEnLista && barrio.trim().length > 0);
  const selectValue = mostrarManual ? '__OTHER__' : barrio;
  const sinCatalogo = distritoNombre && barriosOrdenados.length === 0;

  return (
    <div className="mrv-hero-card">
      {loadingResume && (
        <p className="text-xs text-muted-foreground mb-4 animate-pulse">Buscando ronda guardada…</p>
      )}
      {!savedRound && recoverableRounds.length > 0 && onRecoverRound && (
        <div className="mb-5 rounded-2xl border-2 border-warning/50 bg-warning/10 p-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-warning">
            Ronda guardada en este equipo
          </p>
          <p className="text-xs text-muted-foreground">
            Los avances no se borran solos; a veces quedan ocultos al cerrar pantalla o iniciar otra ronda.
          </p>
          {recoverableRounds.map((r) => {
            const eff = r.casas.filter((c) => c.guardada && c.estado === 'E').length;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onRecoverRound(r)}
                className="w-full text-left rounded-xl border border-warning/40 bg-background px-3 py-2.5 text-sm hover:bg-warning/5"
              >
                <span className="font-bold block">{r.moduloLabel}</span>
                <span className="text-[10px] font-mono text-muted-foreground">ID {formatRoundCodigoDisplay(r)}</span>
                <span className="text-[10px] text-muted-foreground block">
                  {eff}/{r.totalCasas} efectivas (E) · {r.casas.filter((c) => c.guardada).length} visitas
                </span>
              </button>
            );
          })}
        </div>
      )}

      {savedRound && onContinueRound && (
        <div className="mb-5 rounded-2xl border-2 border-primary/40 bg-primary/10 p-4 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Ronda en curso</p>
          <p className="text-[10px] font-mono text-muted-foreground">ID {formatRoundCodigoDisplay(savedRound)}</p>
          <RoundProgressPanel
            moduloLabel={savedRound.moduloLabel}
            casas={savedRound.casas}
            totalCasas={savedRound.totalCasas}
            compact
          />
          {savedRound.fase === 'summary' && (
            <p className="text-[10px] text-warning font-semibold text-center">
              Ronda visitada — pendiente de cerrar o exportar
            </p>
          )}
          <button type="button" onClick={onContinueRound} className="mrv-btn-primary w-full text-base">
            <RotateCcw className="w-5 h-5" />
            Continuar ronda
          </button>
          {onDiscardSavedRound && (
            <button
              type="button"
              onClick={onDiscardSavedRound}
              className="w-full text-xs font-semibold text-muted-foreground hover:text-destructive flex items-center justify-center gap-1 py-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Descartar y empezar otra
            </button>
          )}
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Grid3x3 className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-black text-foreground leading-tight">Inicio de ronda</h2>
          <p className="text-sm text-muted-foreground">{cfg.casasPorModulo} casas efectivas (E) por ronda</p>
        </div>
      </div>

      <label htmlFor="round-barrio-select" className="field-label">
        Barrio (nombre de la ronda)
      </label>
      <select
        id="round-barrio-select"
        className="w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base mb-2 min-h-[48px]"
        value={selectValue}
        disabled={!distritoNombre}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__OTHER__') {
            setManualBarrio(true);
            if (barrioEnLista) setBarrio('');
            return;
          }
          setManualBarrio(false);
          setBarrio(v);
        }}
      >
        <option value="">
          {!distritoNombre
            ? 'Elegí primero distrito/servicio arriba'
            : sinCatalogo
              ? 'Sin barrios en catálogo — usá Otro'
              : 'Seleccioná barrio'}
        </option>
        {barriosOrdenados.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
        <option value="__OTHER__">Otro (escribir manual)</option>
      </select>
      {servicioNombre ? (
        <p className="text-[10px] text-muted-foreground mb-2">
          Distrito: {distritoNombre} · Servicio: {servicioNombre}
        </p>
      ) : distritoNombre ? (
        <p className="text-[10px] text-muted-foreground mb-2">Distrito: {distritoNombre}</p>
      ) : null}
      {(mostrarManual || sinCatalogo) && (
        <input
          type="text"
          className="w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base mb-5 min-h-[48px]"
          placeholder="Nombre del barrio / ronda"
          value={barrio}
          onChange={(e) => setBarrio(upperText(e.target.value))}
          autoFocus={sinCatalogo}
        />
      )}
      {!mostrarManual && !sinCatalogo && <div className="mb-5" />}

      {canStart && barrio.trim() && !savedRound && (
        <div className="mb-4 rounded-xl border border-dashed border-muted-foreground/40 px-3 py-2 text-center">
          <p className="text-[10px] text-muted-foreground">
            Ronda: <span className="font-bold text-foreground">{barrio.trim()}</span> ·{' '}
            <span className="font-bold text-success">0</span> / {cfg.casasPorModulo} efectivas (E)
          </p>
        </div>
      )}
      <button type="button" onClick={onStart} disabled={!canStart} className="mrv-btn-primary text-lg">
        <Play className="w-6 h-6" />
        Comenzar monitoreo
      </button>
    </div>
  );
}
