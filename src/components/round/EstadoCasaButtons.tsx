import { memo } from 'react';
import { CROQUIS_ESTADOS } from '@/lib/croquis-housing';
import type { CasaEstadoCode } from '@/types/round-monitoring';
import { CheckCircle2, DoorOpen, Home, UserX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ESTADO_ICON: Record<CasaEstadoCode, LucideIcon> = {
  E: CheckCircle2,
  N: DoorOpen,
  F: Home,
  R: UserX,
};

interface Props {
  titulo?: string;
  estadoSeleccionado: CasaEstadoCode | null;
  onEstadoChange: (code: CasaEstadoCode) => void;
}

function EstadoCasaButtons({
  titulo = '¿Qué pasó en esta casa?',
  estadoSeleccionado,
  onEstadoChange,
}: Props) {
  return (
    <div className="mrv-panel">
      <p className="text-base sm:text-lg font-bold text-foreground mb-4">{titulo}</p>
      <div className="grid grid-cols-1 gap-2.5">
        {CROQUIS_ESTADOS.map((e) => {
          const Icon = ESTADO_ICON[e.code];
          const active = estadoSeleccionado === e.code;
          return (
            <button
              key={e.code}
              type="button"
              onClick={() => onEstadoChange(e.code)}
              className={`min-h-[56px] rounded-xl border-2 px-4 py-3 text-left transition-colors touch-manipulation ${
                active ? `${e.colorClass} border-current shadow-md` : 'border-border bg-card'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
                    active ? 'bg-background/25' : 'bg-muted'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? '' : 'text-muted-foreground'}`} />
                </span>
                <span className="font-black text-xl leading-none w-7 shrink-0 pt-0.5">{e.code}</span>
                <div className="leading-tight min-w-0 flex-1">
                  <span className="block font-bold text-base">{e.linea1}</span>
                  {e.linea2 && <span className="block font-semibold text-sm opacity-95">{e.linea2}</span>}
                  {e.linea3 && <span className="block font-semibold text-sm opacity-95">{e.linea3}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(EstadoCasaButtons);
