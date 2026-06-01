import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Loader2, RefreshCw, Search } from 'lucide-react';
import RoundHistoryAccordion from '@/components/mrv/RoundHistoryAccordion';
import {
  fetchAdminRoundHistory,
  fetchMyRoundHistory,
  type RoundHistoryRow,
} from '@/services/roundHistoryApi';
import { aggregateRoundsByServicio } from '@/lib/round-dashboard-stats';
import { Bar } from 'react-chartjs-2';
import { barChartOptions, barDataset, MRV_CHART } from '@/lib/chart-theme';

export type RoundHistoryFilters = {
  region?: string;
  distrito?: string;
  servicio?: string;
  responsable?: string;
  roundCodigo?: string;
  limit?: number;
};

interface Props {
  /** Carga bajo demanda al expandir (no satura el servidor al abrir el panel). */
  lazy?: boolean;
  adminMode?: boolean;
  useAdminList?: boolean;
  groupByUser?: boolean;
  title?: string;
  filters?: RoundHistoryFilters;
  /** Búsqueda local por ID visible en admin */
  showIdSearch?: boolean;
}

export default function RoundHistoryPanel({
  lazy = true,
  adminMode = false,
  useAdminList = false,
  groupByUser = false,
  title = 'Monitoreos finalizados',
  filters,
  showIdSearch = false,
}: Props) {
  const [expanded, setExpanded] = useState(!lazy);
  const [loaded, setLoaded] = useState(!lazy);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RoundHistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [idQuery, setIdQuery] = useState('');
  const initialLoadDone = useRef(false);

  const effectiveFilters = useMemo(() => {
    const f = { ...filters, limit: filters?.limit ?? (useAdminList ? 120 : 40) };
    const q = idQuery.trim() || filters?.roundCodigo?.trim();
    if (q) f.roundCodigo = q;
    return f;
  }, [filters, idQuery, useAdminList]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = useAdminList
        ? await fetchAdminRoundHistory(effectiveFilters)
        : await fetchMyRoundHistory(effectiveFilters.limit);
      setRows(data);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar rondas');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [useAdminList, effectiveFilters]);

  const open = () => {
    setExpanded(true);
    if (!loaded && !loading) void load();
  };

  useEffect(() => {
    if (lazy || initialLoadDone.current) return;
    initialLoadDone.current = true;
    void load();
  }, [lazy, load]);

  const roundsByServicio = useMemo(() => aggregateRoundsByServicio(rows), [rows]);

  if (!expanded) {
    return (
      <div className="dash-card p-4">
        <button
          type="button"
          onClick={open}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <ClipboardList className="w-4 h-4 text-primary" />
            {title}
          </span>
          <span className="text-[10px] font-semibold text-primary">Cargar reportes →</span>
        </button>
        <p className="text-[10px] text-muted-foreground mt-2">
          Listado liviano; Excel/PDF se descargan por ronda (detalle bajo demanda).
        </p>
      </div>
    );
  }

  return (
    <div className="dash-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          {title}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="h-8 px-3 rounded-lg border bg-card text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Actualizar
        </button>
      </div>

      {showIdSearch && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={idQuery}
              onChange={(e) => setIdQuery(e.target.value)}
              placeholder="Buscar por ID de ronda (ej. R250527)"
              className="dash-select w-full pl-8"
              aria-label="Buscar ronda por ID"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0"
          >
            Buscar
          </button>
        </div>
      )}

      {error && <p className="text-xs text-destructive font-medium">{error}</p>}

      {loading && !rows.length ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2 py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando rondas…
        </p>
      ) : (
        <RoundHistoryAccordion
          rows={rows}
          groupByUser={groupByUser}
          adminMode={adminMode}
          title=""
        />
      )}

      {roundsByServicio.length > 0 && (
        <div className="pt-2 border-t">
          <h4 className="text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">
            Rondas por servicio (cargadas)
          </h4>
          <div className="h-52">
            <Bar
              data={{
                labels: roundsByServicio.map((r) =>
                  r.servicio.length > 28 ? `${r.servicio.slice(0, 25)}…` : r.servicio
                ),
                datasets: [
                  barDataset(
                    'Completadas',
                    roundsByServicio.map((r) => r.rondas),
                    MRV_CHART.primary,
                    MRV_CHART.primarySoft
                  ),
                  barDataset(
                    'Aprobadas',
                    roundsByServicio.map((r) => r.aprobadas),
                    MRV_CHART.vacunado,
                    MRV_CHART.vacunadoSoft
                  ),
                ],
              }}
              options={barChartOptions({ horizontal: roundsByServicio.length > 4 })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
