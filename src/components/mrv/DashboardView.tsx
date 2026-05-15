import { lazy, Suspense, useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Syringe,
  XCircle,
  Home,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { useRegistrosQuery } from '@/hooks/useRegistrosQuery';
import { buildDashboardData } from '@/lib/dashboard-stats';
import { contadorDesdeDashboard } from '@/lib/housing-stats';
import HousingStatsPanel from '@/components/mrv/HousingStatsPanel';
import type { DashboardData, RegistroMRV } from '@/services/dataService';
import { PageSkeleton } from '@/components/mrv/PageSkeleton';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const DashboardCharts = lazy(() => import('@/components/mrv/DashboardCharts'));
const MrvMapPanel = lazy(() => import('@/components/mrv/MrvMapPanel'));

function exportCSV(data: DashboardData) {
  const rows = [['Distrito', 'Vacunados', 'No Vacunados', 'Cobertura %']];
  Object.entries(data.porDistrito).forEach(([d, v]) => {
    const total = v.vacunados + v.noVacunados;
    rows.push([d, String(v.vacunados), String(v.noVacunados), total > 0 ? ((v.vacunados / total) * 100).toFixed(1) : '0']);
  });
  const blob = new Blob(['\ufeff' + rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `MRV_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

async function exportExcel(registros: RegistroMRV[]) {
  const ws = XLSX.utils.json_to_sheet(
    registros.map((r) => ({
      Fecha: r.fecha_hora,
      Region: r.region,
      Distrito: r.distrito,
      Nombre: r.nombre,
      Documento: r.documento,
      Estado: r.estado_vacuna,
      Motivo: r.motivo,
      Latitud: r.latitud,
      Longitud: r.longitud,
    }))
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `MRV_Registros_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof Syringe;
  tone: 'success' | 'danger' | 'primary' | 'warning';
}) {
  const tones = {
    success: 'from-success/15 to-success/5 border-success/25 text-success',
    danger: 'from-destructive/15 to-destructive/5 border-destructive/25 text-destructive',
    primary: 'from-primary/15 to-primary/5 border-primary/25 text-primary',
    warning: 'from-warning/15 to-warning/5 border-warning/25 text-warning',
  };
  return (
    <div className={`dash-kpi bg-gradient-to-br border ${tones[tone]}`}>
      <Icon className="w-5 h-5 opacity-80" />
      <p className="text-2xl font-black leading-none mt-2">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80 mt-1">{label}</p>
    </div>
  );
}

export default function DashboardView() {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin } = useRole();
  const { data: registros = [], isLoading, isFetching, refetch } = useRegistrosQuery(2500, true);

  const { data: profileScope } = useQuery({
    queryKey: ['profile-scope', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('scope_locked, assigned_barrio')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
  });

  const [regionFilter, setRegionFilter] = useState('todas');
  const [distritoFilter, setDistritoFilter] = useState('todos');
  const [chartMode, setChartMode] = useState<'stacked' | 'coverage'>('stacked');
  const [exporting, setExporting] = useState(false);

  const normalize = (v: string | null | undefined) =>
    (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

  const registrosVisibles = useMemo(() => {
    if (isAdmin || isSuperAdmin) return registros;
    if (profileScope?.scope_locked && profileScope.assigned_barrio) {
      const b = normalize(profileScope.assigned_barrio);
      return registros.filter((r) => normalize(r.barrio) === b);
    }
    return registros;
  }, [registros, isAdmin, isSuperAdmin, profileScope]);

  const regionesDisponibles = useMemo(
    () => Array.from(new Set(registrosVisibles.map((r) => r.region).filter(Boolean))).sort(),
    [registrosVisibles]
  );

  const distritosDisponibles = useMemo(() => {
    const base = regionFilter === 'todas' ? registrosVisibles : registrosVisibles.filter((r) => r.region === regionFilter);
    return Array.from(new Set(base.map((r) => r.distrito).filter(Boolean))).sort();
  }, [registrosVisibles, regionFilter]);

  const registrosFiltrados = useMemo(
    () =>
      registrosVisibles.filter(
        (r) =>
          (regionFilter === 'todas' || r.region === regionFilter) &&
          (distritoFilter === 'todos' || r.distrito === distritoFilter)
      ),
    [registrosVisibles, regionFilter, distritoFilter]
  );

  const data = useMemo(() => buildDashboardData(registrosFiltrados), [registrosFiltrados]);
  const total = data.totalVacunados + data.totalNoVacunados;
  const cobertura = total > 0 ? ((data.totalVacunados / total) * 100).toFixed(1) : '0';
  const contadorViviendas = contadorDesdeDashboard(data.viviendas);
  const conGps = registrosFiltrados.filter((r) => r.latitud != null && r.longitud != null).length;

  if (isLoading) return <PageSkeleton rows={5} />;

  return (
    <div className="p-4 pb-24 max-w-4xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-foreground tracking-tight">Dashboard MRV</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {registrosFiltrados.length} registros · {conGps} con GPS
            {isFetching && ' · actualizando…'}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void refetch()}
            className="h-9 w-9 rounded-xl border bg-card flex items-center justify-center"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={() => exportCSV(data)} className="dash-btn-secondary">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await exportExcel(registrosVisibles);
              } finally {
                setExporting(false);
              }
            }}
            className="dash-btn-primary"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </div>

      <div className="dash-filters grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select aria-label="Filtrar por región" value={regionFilter} onChange={(e) => { setRegionFilter(e.target.value); setDistritoFilter('todos'); }} className="dash-select">
          <option value="todas">Todas las regiones</option>
          {regionesDisponibles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select aria-label="Filtrar por distrito" value={distritoFilter} onChange={(e) => setDistritoFilter(e.target.value)} className="dash-select">
          <option value="todos">Todos los distritos</option>
          {distritosDisponibles.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select aria-label="Tipo de gráfico" value={chartMode} onChange={(e) => setChartMode(e.target.value as 'stacked' | 'coverage')} className="dash-select">
          <option value="stacked">Barras apiladas</option>
          <option value="coverage">Cobertura %</option>
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard label="Vacunados" value={data.totalVacunados} icon={Syringe} tone="success" />
        <KpiCard label="No vacunados" value={data.totalNoVacunados} icon={XCircle} tone="danger" />
        <KpiCard label="Cobertura" value={`${cobertura}%`} icon={TrendingUp} tone="primary" />
        <KpiCard label="Total" value={total} icon={BarChart3} tone="warning" />
      </div>

      <HousingStatsPanel contador={contadorViviendas} variant="full" />

      <div className="dash-card overflow-hidden p-0">
        <div className="px-4 py-2 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">Mapa de registros</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">OpenStreetMap · gratis</span>
        </div>
        {conGps > 0 ? (
          <Suspense fallback={<PageSkeleton rows={1} />}>
            <MrvMapPanel registros={registrosFiltrados} height="280px" maxMarkers={150} showLegend />
          </Suspense>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8 px-4">
            Aún no hay registros con GPS en estos filtros.
          </p>
        )}
      </div>

      {total === 0 ? (
        <div className="dash-card text-center py-12 text-muted-foreground">
          <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-40" />
          <p className="font-semibold">Sin registros con estos filtros</p>
        </div>
      ) : (
        <Suspense fallback={<PageSkeleton rows={2} />}>
          <DashboardCharts data={data} chartMode={chartMode} />
        </Suspense>
      )}

    </div>
  );
}
