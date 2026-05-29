import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { mrvApiFetch, USE_MRV_API } from '@/lib/api-config';

export type EquipoMiembro = {
  user_id: string;
  display_name: string;
};

interface Props {
  region: string;
  distrito: string;
  servicio: string | null;
  entrevistadorNombre?: string | null;
  seleccionados: EquipoMiembro[];
  onToggle: (miembro: EquipoMiembro) => void;
}

export default function RoundEquipoUsuarios({
  region,
  distrito,
  servicio,
  entrevistadorNombre,
  seleccionados,
  onToggle,
}: Props) {
  const [open, setOpen] = useState(false);
  const [miembros, setMiembros] = useState<EquipoMiembro[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!USE_MRV_API || !region.trim() || !distrito.trim()) {
      setMiembros([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const q = new URLSearchParams({
      region: region.trim(),
      distrito: distrito.trim(),
    });
    if (servicio?.trim()) q.set('servicio', servicio.trim());
    void mrvApiFetch<{ data: EquipoMiembro[] }>(`/api/equipo/misma-asignacion?${q}`).then(({ data }) => {
      if (cancelled) return;
      const rows = (data?.data || []).filter(
        (m) => m.display_name && m.display_name !== entrevistadorNombre
      );
      setMiembros(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [region, distrito, servicio, entrevistadorNombre]);

  const countSel = seleccionados.length;
  const isSelected = (m: EquipoMiembro) =>
    seleccionados.some((s) => s.user_id === m.user_id);

  return (
    <div className="mb-4 rounded-lg border border-border/80 bg-muted/15 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
        <Users className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground block">
            Equipo en la ronda <span className="font-normal normal-case">(1 o más personas)</span>
          </span>
          {!open && countSel > 0 && (
            <span className="text-[10px] text-primary font-semibold">{countSel} seleccionado(s)</span>
          )}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-border/60 space-y-2">
          <p className="text-[10px] text-muted-foreground leading-snug">
            Vos sos el entrevistador principal
            {entrevistadorNombre ? ` (${entrevistadorNombre})` : ''}. Sumá compañeros con la misma
            asignación ({region} · {distrito}
            {servicio ? ` · ${servicio}` : ''}) para completar la ronda juntos; el avance se guarda en la
            nube (hasta 2 rondas activas por usuario).
          </p>
          {loading && (
            <p className="text-[10px] text-muted-foreground animate-pulse">Cargando equipo…</p>
          )}
          {!loading && miembros.length === 0 && (
            <p className="text-[10px] text-muted-foreground">No hay otros usuarios en esta asignación.</p>
          )}
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {miembros.map((m) => {
              const on = isSelected(m);
              return (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => onToggle(m)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-colors ${
                    on
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {m.display_name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
