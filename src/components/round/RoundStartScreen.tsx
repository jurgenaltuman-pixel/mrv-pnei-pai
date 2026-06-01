import { clampCasasPorModulo, getRoundConfig, MAX_CASAS_POR_MODULO } from '@/lib/round-config';
import { CASAS_META_PRESETS, elegirPresetCercano } from '@/lib/round-viviendas';
import { upperText } from '@/lib/text-uppercase';
import type { RoundMonitoring } from '@/types/round-monitoring';
import { formatRoundCodigoDisplay } from '@/lib/round-codigo';
import RoundProgressPanel from '@/components/round/RoundProgressPanel';
import { Grid3x3, Play, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import RoundEquipoUsuarios, { type EquipoMiembro } from '@/components/round/RoundEquipoUsuarios';

interface Props {
  barrio: string;
  setBarrio: (v: string) => void;
  barriosDisponibles: string[];
  regionNombre?: string;
  distritoNombre: string;
  servicioNombre?: string | null;
  entrevistadorNombre?: string | null;
  colaboradores: EquipoMiembro[];
  onToggleEquipo: (miembro: EquipoMiembro) => void;
  maxActiveRounds: number;
  activeDrafts?: RoundMonitoring[];
  onStart: (totalCasas: number) => void;
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
  regionNombre,
  distritoNombre,
  servicioNombre,
  entrevistadorNombre,
  colaboradores,
  onToggleEquipo,
  maxActiveRounds,
  activeDrafts = [],
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
  const [metaCasas, setMetaCasas] = useState(() => elegirPresetCercano(cfg.casasPorModulo));
  const [metaCustom, setMetaCustom] = useState(false);
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

  const otrasActivas = useMemo(() => {
    const ids = new Set<string>();
    if (savedRound?.id) ids.add(savedRound.id);
    return [
      ...(savedRound ? [] : []),
      ...recoverableRounds.filter((r) => !ids.has(r.id)),
    ];
  }, [recoverableRounds, savedRound]);

  return (
    <div className="mrv-hero-card">
      {loadingResume && (
        <p className="text-xs text-muted-foreground mb-4 animate-pulse">Sincronizando rondas…</p>
      )}

      {activeDrafts.length > 0 && (
        <p className="text-[10px] text-muted-foreground mb-3">
          Rondas activas en tu cuenta:{' '}
          <strong>
            {activeDrafts.length}/{maxActiveRounds}
          </strong>{' '}
          (se guardan en la nube y aparecen en cualquier dispositivo).
        </p>
      )}

      {!savedRound && otrasActivas.length > 0 && onRecoverRound && (
        <div className="mb-5 rounded-2xl border-2 border-warning/50 bg-warning/10 p-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-warning">
            Otras rondas activas
          </p>
          {otrasActivas.map((r) => {
            const eff = r.casas.filter((c) => c.guardada && c.estado === 'E').length;
            const equipo =
              r.colaboradores?.length > 0
                ? ` · Equipo: ${[r.entrevistador, ...r.colaboradores].filter(Boolean).join(', ')}`
                : '';
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
                  {equipo}
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
          {(savedRound.colaboradores?.length ?? 0) > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Equipo:{' '}
              <span className="font-semibold text-foreground">
                {[savedRound.entrevistador, ...savedRound.colaboradores].filter(Boolean).join(' · ')}
              </span>
            </p>
          )}
          <RoundProgressPanel
            moduloLabel={savedRound.moduloLabel}
            roundCodigo={formatRoundCodigoDisplay(savedRound)}
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
              Descartar y liberar cupo
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
          <p className="text-sm text-muted-foreground">
            Meta de casas efectivas (E) · hasta {maxActiveRounds} rondas activas
          </p>
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
      {(regionNombre || distritoNombre || servicioNombre) && (
        <p className="text-[10px] text-muted-foreground mb-2">
          {[regionNombre, distritoNombre, servicioNombre].filter(Boolean).join(' · ')}
        </p>
      )}
      {entrevistadorNombre && (
        <p className="text-[10px] text-muted-foreground mb-3">
          Entrevistador: <span className="font-semibold text-foreground">{entrevistadorNombre}</span>
        </p>
      )}

      {regionNombre && distritoNombre && (
        <RoundEquipoUsuarios
          region={regionNombre}
          distrito={distritoNombre}
          servicio={servicioNombre ?? null}
          entrevistadorNombre={entrevistadorNombre}
          seleccionados={colaboradores}
          onToggle={onToggleEquipo}
        />
      )}
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
      {!mostrarManual && !sinCatalogo && <div className="mb-3" />}

      {!savedRound && (
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-bold text-primary">Viviendas en esta ronda (meta E)</p>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Elegí cuántas casas efectivas necesitás. Si el barrio es grande, usá 120. Podés sumar más durante el
            monitoreo.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CASAS_META_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setMetaCustom(false);
                  setMetaCasas(n);
                }}
                className={`h-9 min-w-[3rem] px-3 rounded-lg text-sm font-bold border ${
                  !metaCustom && metaCasas === n
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMetaCustom(true)}
              className={`h-9 px-3 rounded-lg text-sm font-bold border ${
                metaCustom ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
              }`}
            >
              Otra
            </button>
          </div>
          {metaCustom && (
            <input
              type="number"
              min={4}
              max={MAX_CASAS_POR_MODULO}
              value={metaCasas}
              onChange={(e) => setMetaCasas(clampCasasPorModulo(Number(e.target.value) || 20))}
              className="w-full h-10 px-3 rounded-lg border bg-background text-sm font-mono"
              inputMode="numeric"
            />
          )}
          <p className="text-[10px] font-semibold text-foreground">
            Meta seleccionada: <span className="text-success">{metaCasas}</span> casas efectivas (E)
          </p>
        </div>
      )}

      {canStart && barrio.trim() && !savedRound && activeDrafts.length >= maxActiveRounds && (
        <p className="mb-3 text-xs text-destructive font-medium text-center">
          Ya tenés {maxActiveRounds} rondas activas. Descartá una arriba para comenzar otra.
        </p>
      )}

      {canStart && barrio.trim() && !savedRound && (
        <div className="mb-4 rounded-xl border border-dashed border-muted-foreground/40 px-3 py-2 text-center">
          <p className="text-[10px] text-muted-foreground">
            Ronda: <span className="font-bold text-foreground">{barrio.trim()}</span> ·{' '}
            <span className="font-bold text-success">0</span> / {metaCasas} efectivas (E)
            {colaboradores.length > 0 && (
              <>
                {' '}
                · Equipo: {colaboradores.length + 1} persona(s)
              </>
            )}
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => onStart(metaCasas)}
        disabled={!canStart || (!savedRound && activeDrafts.length >= maxActiveRounds)}
        className="mrv-btn-primary text-lg"
      >
        <Play className="w-6 h-6" />
        Comenzar monitoreo
      </button>
    </div>
  );
}
