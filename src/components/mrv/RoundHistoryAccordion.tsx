import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardList, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { formatFechaHoraPy } from '@/lib/format-fecha';
import { downloadRoundHistoryExcel, downloadRoundHistoryPdf } from '@/lib/round-history-report';
import { useToast } from '@/hooks/use-toast';
import type { RoundHistoryRow } from '@/services/roundHistoryApi';

function asignacionLabel(r: RoundHistoryRow): string {
  return [r.assigned_region, r.assigned_distrito, r.assigned_servicio].filter(Boolean).join(' · ') || '—';
}

interface Props {
  rows: RoundHistoryRow[];
  groupByUser?: boolean;
  title?: string;
  /** Usa API admin para descargar detalle de cualquier usuario */
  adminMode?: boolean;
}

export default function RoundHistoryAccordion({
  rows,
  groupByUser = false,
  title = 'Historial de rondas',
  adminMode = false,
}: Props) {
  const { toast } = useToast();
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [exportingId, setExportingId] = useState<string | null>(null);

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

  const runExport = async (row: RoundHistoryRow, kind: 'excel' | 'pdf') => {
    const key = `${row.id}-${kind}`;
    setExportingId(key);
    try {
      if (kind === 'excel') {
        await downloadRoundHistoryExcel(row, adminMode);
      } else {
        await downloadRoundHistoryPdf(row, adminMode);
      }
      toast({
        title: kind === 'excel' ? 'Excel generado' : 'PDF generado',
        description: row.round_codigo ? `Ronda ${row.round_codigo}` : row.nombre,
      });
    } catch (e) {
      toast({
        title: 'No se pudo generar el reporte',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setExportingId(null);
    }
  };

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
                {g.items.map((r) => {
                  const rowId = r.id || `${r.nombre}-${r.completadaAt}`;
                  const busyExcel = exportingId === `${rowId}-excel`;
                  const busyPdf = exportingId === `${rowId}-pdf`;
                  return (
                    <li key={rowId} className="px-3 py-2 text-xs">
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
                        {!r.has_snapshot && (
                          <span className="block text-amber-700 dark:text-amber-400 mt-0.5">
                            Reporte resumido (ronda anterior al detalle guardado)
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                          type="button"
                          disabled={Boolean(exportingId)}
                          onClick={() => void runExport(r, 'excel')}
                          className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 border border-emerald-600/30 text-[10px] font-bold disabled:opacity-50"
                        >
                          {busyExcel ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <FileSpreadsheet className="w-3 h-3" />
                          )}
                          Excel
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(exportingId)}
                          onClick={() => void runExport(r, 'pdf')}
                          className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-primary/10 text-primary border border-primary/30 text-[10px] font-bold disabled:opacity-50"
                        >
                          {busyPdf ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <FileText className="w-3 h-3" />
                          )}
                          PDF
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
