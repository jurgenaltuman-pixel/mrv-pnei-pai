import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';
import { formatFechaHoraPy } from '@/lib/format-fecha';
import type { RoundHistoryRow } from '@/services/roundHistoryApi';

function asignacionLabel(r: RoundHistoryRow): string {
  return [r.assigned_region, r.assigned_distrito, r.assigned_servicio].filter(Boolean).join(' · ') || '—';
}

interface Props {
  rows: RoundHistoryRow[];
  groupByUser?: boolean;
  title?: string;
}

export default function RoundHistoryAccordion({
  rows,
  groupByUser = false,
  title = 'Historial de rondas',
}: Props) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; sub: string; items: RoundHistoryRow[] }>();
    for (const r of rows) {
      const key = groupByUser
        ? r.user_id
        : `${r.user_id}::${r.assigned_region || ''}::${r.assigned_distrito || ''}::${r.assigned_servicio || ''}`;
      const label = groupByUser
        ? r.display_name || r.email || r.user_id.slice(0, 8)
        : asignacionLabel(r);
      const sub = groupByUser ? asignacionLabel(r) : r.display_name || r.email || '';
      if (!map.has(key)) map.set(key, { label, sub, items: [] });
      map.get(key)!.items.push(r);
    }
    return [...map.entries()].sort((a, b) => {
      const ta = a[1].items[0]?.completadaAt ?? 0;
      const tb = b[1].items[0]?.completadaAt ?? 0;
      return tb - ta;
    });
  }, [rows, groupByUser]);

  if (!rows.length) {
    return (
      <p className="text-xs text-muted-foreground py-2">Sin rondas cerradas registradas aún.</p>
    );
  }

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <ClipboardList className="w-3.5 h-3.5" />
        {title}
      </p>
      {groups.map(([key, g]) => {
        const open = openKeys.has(key);
        return (
          <div key={key} className="rounded-xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(key)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-muted/30 hover:bg-muted/50 text-sm"
            >
              {open ? (
                <ChevronDown className="w-4 h-4 shrink-0 text-primary" />
              ) : (
                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span className="font-bold block truncate">{g.label}</span>
                {g.sub ? (
                  <span className="text-[10px] text-muted-foreground block truncate">{g.sub}</span>
                ) : null}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                {g.items.length} ronda{g.items.length === 1 ? '' : 's'}
              </span>
            </button>
            {open && (
              <ul className="divide-y border-t">
                {g.items.map((r) => (
                  <li key={r.id || `${r.nombre}-${r.completadaAt}`} className="px-3 py-2 text-xs">
                    <p className="font-semibold text-foreground">{r.nombre}</p>
                    {r.round_codigo && (
                      <p className="text-[10px] font-mono text-muted-foreground">ID {r.round_codigo}</p>
                    )}
                    <p className="text-muted-foreground mt-0.5">
                      {r.efectivas}/{r.totalCasas} E · {r.visitadas} visitas ·{' '}
                      {r.coberturaVacunacion != null ? `${r.coberturaVacunacion}% cob.` : '— cob.'}
                      {' · '}
                      {r.aprobado ? (
                        <span className="text-success font-semibold">aprobada</span>
                      ) : (
                        <span className="text-destructive font-semibold">caída</span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatFechaHoraPy(new Date(r.completadaAt))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
