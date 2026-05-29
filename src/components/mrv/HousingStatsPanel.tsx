import { useState } from 'react';
import { DoorOpen, CircleX, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  TIPOS_VIVIENDA,
  resumenAbiertasCerradas,
  sumarViviendas,
  type HousingCounts,
} from '@/lib/housing-stats';

interface Props {
  contador: HousingCounts;
  /** compact = barra en registro; full = dashboard */
  variant?: 'compact' | 'full';
  showHelp?: boolean;
}

export default function HousingStatsPanel({ contador, variant = 'full', showHelp = true }: Props) {
  const [helpOpen, setHelpOpen] = useState(false);
  const { abiertas, fallidas, total, pctAbiertas, pctFallidas } = resumenAbiertasCerradas(contador);

  if (total === 0 && variant === 'compact') {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground text-center">
        Aún no sumó viviendas en esta visita. Elija tipo (E, N, F o R) y pulse «Añadir vivienda».
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Resumen principal: lo que pide el informe */}
      <div className="rounded-xl border-2 border-primary/20 dark:border-primary/30 bg-gradient-to-r from-primary/5 to-transparent dark:from-primary/10 p-3">
        <p className="text-[11px] font-bold uppercase text-primary mb-2 tracking-wide">
          Resumen de la jornada (viviendas)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-success/10 border border-success/30 p-3">
            <div className="flex items-center gap-2 mb-1">
              <DoorOpen className="w-5 h-5 text-success" />
              <span className="text-xs font-bold text-success">Abiertas</span>
            </div>
            <p className="text-3xl font-black text-success leading-none">{abiertas}</p>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
              Rechazo con adulto (R)
            </p>
            {total > 0 && (
              <p className="text-[10px] font-semibold text-success/80 mt-1">{pctAbiertas}% del total</p>
            )}
          </div>
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
            <div className="flex items-center gap-2 mb-1">
              <CircleX className="w-5 h-5 text-destructive" />
              <span className="text-xs font-bold text-destructive">
                Fallida <span className="font-semibold opacity-90">· cerradas</span>
              </span>
            </div>
            <p className="text-3xl font-black text-destructive leading-none">{fallidas}</p>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
              Visitas registradas (E + N + F)
            </p>
            {total > 0 && (
              <p className="text-[10px] font-semibold text-destructive/80 mt-1">{pctFallidas}% del total</p>
            )}
          </div>
        </div>
        <p className="text-center text-sm font-bold text-foreground mt-2 pt-2 border-t border-border/60">
          Total abordadas: <span className="text-primary">{total}</span> viviendas
        </p>
      </div>

      {/* Barra visual */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="h-3 rounded-full overflow-hidden flex bg-muted">
            <div
              className="bg-success transition-all duration-300"
              style={{ width: `${pctAbiertas}%` }}
              title={`Abiertas ${pctAbiertas}%`}
            />
            <div
              className="bg-destructive transition-all duration-300"
              style={{ width: `${pctFallidas}%` }}
              title={`Fallidas ${pctFallidas}%`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
            <span>■ Abiertas {abiertas}</span>
            <span>■ Cerradas (E+N+F) {fallidas}</span>
          </div>
        </div>
      )}

      {/* Desglose E N F R */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase text-muted-foreground">Desglose por código</p>
        {TIPOS_VIVIENDA.map((tipo) => {
          const n = contador[tipo.key];
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          return (
            <div
              key={tipo.code}
              className={`flex items-start gap-2 rounded-lg border p-2.5 ${tipo.bgSoft} ${tipo.borderClass}`}
            >
              <span
                className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-black ${tipo.colorClass}`}
              >
                {tipo.code}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-foreground leading-tight">{tipo.titulo}</p>
                  <p className="text-lg font-black tabular-nums shrink-0">{n}</p>
                </div>
                <p className="text-[11px] font-semibold text-muted-foreground">{tipo.subtitulo}</p>
                {variant === 'full' && n > 0 && (
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5">{pct}% del total</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showHelp && (
        <button
          type="button"
          onClick={() => setHelpOpen(!helpOpen)}
          className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-primary py-2 rounded-lg bg-primary/5 hover:bg-primary/10"
        >
          <HelpCircle className="w-4 h-4" />
          ¿Qué significa cada código?
          {helpOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      )}
      {helpOpen && (
        <div className="text-xs space-y-2 p-3 rounded-lg bg-muted/50 border">
          {TIPOS_VIVIENDA.map((t) => (
            <p key={t.code}>
              <strong className="text-foreground">
                {t.code} — {t.titulo} ({t.subtitulo}):
              </strong>{' '}
              <span className="text-muted-foreground">{t.descripcion}</span>
            </p>
          ))}
          <p className="pt-2 border-t text-muted-foreground">
            <strong className="text-foreground">Abiertas</strong> = R (renuente / rechazo con adulto).{' '}
            <strong className="text-foreground">Fallida · cerradas</strong> = E + N + F.
          </p>
        </div>
      )}
    </div>
  );
}
