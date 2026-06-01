import { memo } from 'react';
import type { CasaMonitoreo } from '@/types/round-monitoring';
import {
  CROQUIS_ESTADOS,
  casaPermiteReedicionVisita,
  countCasasEfectivas,
  getEstadoConfig,
} from '@/lib/croquis-housing';
import { AMPLIAR_VIVIENDAS_LOTES } from '@/lib/round-viviendas';
import { ChevronRight, Home, ListChecks, Plus, Undo2 } from 'lucide-react';

interface Props {
  casas: CasaMonitoreo[];
  metaEfectivas: number;
  onContinuarCasa: (numero: number) => void;
  onEditCasaGuardada?: (numero: number) => void;
  onReabrirCasa?: (numero: number) => void;
  canEditCasasGuardadas?: boolean;
  puedeAmpliar?: boolean;
  onAmpliarViviendas?: (cantidad: number) => void;
}

function CroquisMap({
  casas,
  metaEfectivas,
  onContinuarCasa,
  onEditCasaGuardada,
  onReabrirCasa,
  canEditCasasGuardadas,
  puedeAmpliar,
  onAmpliarViviendas,
}: Props) {
  const totalVisitadas = casas.length;
  const siguiente = casas.find((c) => !c.guardada);
  const visitadas = casas.filter((c) => c.guardada).length;
  const efectivas = countCasasEfectivas(casas);

  const ampliarBlock =
    puedeAmpliar && onAmpliarViviendas ? (
      <div className="mt-4 pt-4 border-t border-dashed space-y-2">
        <p className="text-[10px] text-muted-foreground text-left">
          ¿El barrio tiene más viviendas? Aumentá la meta sin perder lo ya cargado.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {AMPLIAR_VIVIENDAS_LOTES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onAmpliarViviendas(n)}
              className="h-10 px-3 rounded-xl border-2 border-primary/40 bg-primary/5 text-primary text-xs font-bold inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              +{n} viviendas
            </button>
          ))}
        </div>
      </div>
    ) : null;

  if (!siguiente) {
    return (
      <div className="mrv-panel text-center p-6">
        <p className="font-bold text-lg">
          {efectivas >= metaEfectivas ? 'Meta de efectivas alcanzada' : 'Todas las casillas visitadas'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="text-success font-bold">{efectivas}</span> / {metaEfectivas} efectivas (E)
          {visitadas > efectivas ? ` · ${visitadas - efectivas} visitas N/F/R` : ''}
        </p>
        {ampliarBlock}
      </div>
    );
  }

  return (
    <div className="mrv-panel">
      <div className="mrv-panel-header">
        <ListChecks className="w-5 h-5 text-primary shrink-0" />
        <h3 className="mrv-panel-title">Casa {siguiente.numero}</h3>
      </div>

      <p className="text-base font-bold text-foreground mb-1">
        <span className="text-success">{efectivas}</span> / {metaEfectivas} casas efectivas (E)
      </p>
      <p className="text-[11px] text-muted-foreground mb-3">
        Avance del módulo: {metaEfectivas > 0 ? Math.round((efectivas / metaEfectivas) * 100) : 0}% · N, F y R no suman
        {visitadas > metaEfectivas ? ` · ${visitadas}/${totalVisitadas} casas visitadas` : ''}
      </p>

      <div className="croquis-house-stage mb-5">
        <div className="croquis-house-progress" aria-hidden>
          {casas.map((c) => (
            <span
              key={c.numero}
              className={`croquis-house-dot ${
                c.guardada && c.estado === 'E' ? 'croquis-house-dot-done' : ''
              } ${c.numero === siguiente.numero ? 'croquis-house-dot-active' : ''}`}
              title={`Casa ${c.numero}${c.estado ? ` · ${c.estado}` : ''}${
                c.guardada && c.estado && c.estado !== 'E' ? ' (no suma a meta E)' : ''
              }`}
            />
          ))}
        </div>

        <div className="croquis-house-visual">
          <span className="croquis-house-icon" aria-hidden>
            <Home className="w-14 h-14 text-primary" strokeWidth={1.75} />
          </span>
          <span className="croquis-house-badge">#{siguiente.numero}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onContinuarCasa(siguiente.numero)}
        className="mrv-btn-primary text-lg"
      >
        <ChevronRight className="w-6 h-6" />
        {siguiente.estado ? 'Continuar casa' : 'Ingresar casa'} {siguiente.numero}
      </button>

      {visitadas > 0 && (
        <div className="mt-5 pt-4 border-t border-dashed mrv-completed-strip">
          <p className="text-[10px] text-muted-foreground mb-2">
            Visitas registradas (solo E suman en meta).{' '}
            <span className="font-semibold text-foreground">
              N, F o R: tocá «Retroceder» para corregir la visita.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {casas
              .filter((c) => c.guardada)
              .map((c) => {
                const cfg = c.estado ? getEstadoConfig(c.estado) : null;
                const puedeRetroceder =
                  canEditCasasGuardadas &&
                  c.estado &&
                  casaPermiteReedicionVisita(c.estado) &&
                  Boolean(onReabrirCasa);
                const chip = (
                  <>
                    <Home className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
                    {c.numero}
                    {c.estado && <span className={cfg?.colorClass}>{c.estado}</span>}
                  </>
                );
                if (puedeRetroceder) {
                  return (
                    <button
                      key={c.numero}
                      type="button"
                      onClick={() => onReabrirCasa!(c.numero)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border hover:ring-2 hover:ring-primary/40 ${
                        cfg?.bgSoft ?? 'bg-muted'
                      }`}
                      title={`Retroceder y editar casa ${c.numero} (${c.estado})`}
                    >
                      {chip}
                      <Undo2 className="w-3 h-3 shrink-0 opacity-80" aria-hidden />
                      <span className="sr-only sm:not-sr-only sm:text-[10px]">Retroceder</span>
                    </button>
                  );
                }
                if (canEditCasasGuardadas && onEditCasaGuardada) {
                  return (
                    <button
                      key={c.numero}
                      type="button"
                      onClick={() => onEditCasaGuardada(c.numero)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border hover:ring-2 hover:ring-primary/40 ${
                        cfg?.bgSoft ?? 'bg-muted'
                      }`}
                      title={`Editar casa ${c.numero}`}
                    >
                      {chip}
                    </button>
                  );
                }
                return (
                  <span
                    key={c.numero}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      cfg?.bgSoft ?? 'bg-muted'
                    }`}
                  >
                    {chip}
                  </span>
                );
              })}
          </div>
        </div>
      )}

      {ampliarBlock}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mt-5 pt-4 border-t">
        {CROQUIS_ESTADOS.map((e) => (
          <div key={e.code} className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-7 h-7 rounded-md flex items-center justify-center font-black text-xs shrink-0 ${e.colorClass}`}
            >
              {e.icon}
            </span>
            <span className="text-muted-foreground leading-tight truncate">
              {e.linea1}
              {e.linea2 ? ` · ${e.linea2}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(CroquisMap);
