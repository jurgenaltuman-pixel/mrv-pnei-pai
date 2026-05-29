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
      <p className="text-base sm:text-lg max-lg:text-lg font-bold text-foreground mb-4">{titulo}</p>
      <div className="grid grid-cols-1 gap-3 max-lg:gap-3.5">
        {CROQUIS_ESTADOS.map((e) => {
          const Icon = ESTADO_ICON[e.code];
          const active = estadoSeleccionado === e.code;
          return (
            <button
              key={e.code}
              type="button"
              onClick={() => onEstadoChange(e.code)}
              className={`min-h-[56px] max-lg:min-h-[4.25rem] rounded-xl border-2 px-4 py-3 max-lg:px-4 max-lg:py-3.5 text-left transition-colors touch-manipulation ${
                active ? `${e.colorClass} border-current shadow-md` : 'border-border bg-card'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex items-center justify-center w-9 h-9 max-lg:w-11 max-lg:h-11 rounded-lg shrink-0 ${
                    active ? 'bg-background/25' : 'bg-muted'
                  }`}
                >
                  <Icon className={`w-5 h-5 max-lg:w-6 max-lg:h-6 ${active ? '' : 'text-muted-foreground'}`} />
                </span>
                <span className="font-black text-xl max-lg:text-2xl leading-none w-7 max-lg:w-8 shrink-0 pt-0.5">
                  {e.code}
                </span>
                <div className="leading-snug min-w-0 flex-1">
                  <span className="block font-bold text-base max-lg:text-lg">{e.linea1}</span>
                  {e.linea2 && (
                    <span className="block font-semibold text-sm max-lg:text-base opacity-95">{e.linea2}</span>
                  )}
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
