import { memo } from 'react';
import type { CasaMonitoreo } from '@/types/round-monitoring';
import {
  CROQUIS_ESTADOS,
  casaPermiteReedicionVisita,
  countCasasEfectivas,
  getEstadoConfig,
} from '@/lib/croquis-housing';
import { ChevronRight, ListChecks, Undo2 } from 'lucide-react';

interface Props {
  casas: CasaMonitoreo[];
  metaEfectivas: number;
  onContinuarCasa: (numero: number) => void;
  onEditCasaGuardada?: (numero: number) => void;
  onReabrirCasa?: (numero: number) => void;
  canEditCasasGuardadas?: boolean;
}

function CroquisMap({
  casas,
  metaEfectivas,
  onContinuarCasa,
  onEditCasaGuardada,
  onReabrirCasa,
  canEditCasasGuardadas,
}: Props) {
  const totalVisitadas = casas.length;
  const siguiente = casas.find((c) => !c.guardada);
  const visitadas = casas.filter((c) => c.guardada).length;
  const efectivas = countCasasEfectivas(casas);

  if (!siguiente) {
    return (
      <div className="mrv-panel text-center p-6">
        <p className="font-bold text-lg">Módulo completo</p>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="text-success font-bold">{efectivas} efectivas (E)</span>
          {visitadas > efectivas ? ` · ${visitadas - efectivas} visitas N/F/R` : ''}
        </p>
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
          <img
            src="/croquis-casa.png"
            alt=""
            className="croquis-house-img"
            width={120}
            height={120}
            loading="lazy"
            decoding="async"
          />
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
                    <img
                      src="/croquis-casa.png"
                      alt=""
                      className="w-4 h-4 object-contain opacity-80"
                      width={16}
                      height={16}
                      loading="lazy"
                      decoding="async"
                    />
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
