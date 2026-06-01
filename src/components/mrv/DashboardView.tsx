import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Syringe,
  XCircle,
  Home,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { useRegistrosQuery } from '@/hooks/useRegistrosQuery';
import { buildDashboardData } from '@/lib/dashboard-stats';
import { filterRegistrosByVisita, type VisitaMapFilter } from '@/lib/visita-filter';
import RoundHistoryPanel from '@/components/mrv/RoundHistoryPanel';
import { contadorDesdeDashboard } from '@/lib/housing-stats';
import HousingStatsPanel from '@/components/mrv/HousingStatsPanel';
import type { DashboardData, RegistroMRV } from '@/services/dataService';
import { PageSkeleton } from '@/components/mrv/PageSkeleton';
import { downloadRegistrosExcel } from '@/lib/export-registros-excel';
import { downloadDashboardPdf } from '@/lib/export-dashboard-pdf';
import { filterRegistrosByDate, type DateRangePreset } from '@/lib/registros-date-filter';
import {
  filterRegistrosByProfileScope,
  hasProfileScopeAssignment,
} from '@/lib/registro-scope';
import { useProfileScope } from '@/hooks/useProfileScope';
import { getJornadaStats } from '@/lib/jornada-storage';
import JornadaSummary from '@/components/mrv/JornadaSummary';
import type { RoundMonitoring } from '@/types/round-monitoring';
import VisitaMapFilterBar from '@/components/mrv/VisitaMapFilterBar';
import { defaultUseNationalView } from '@/lib/report-scope';

const DashboardCharts = lazy(() => import('@/components/mrv/DashboardCharts'));
const MrvMapPanel = lazy(() => import('@/components/mrv/MrvMapPanel'));

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

interface DashboardViewProps {
  onResumeRound?: (round: RoundMonitoring) => void;
}

export default function DashboardView({ onResumeRound }: DashboardViewProps = {}) {
  const { user } = useAuth();
  const role = useRole();
  const {
    isAdmin,
    isSuperAdmin,
    isSupervisor,
    isRegional,
    canViewNationalReports,
    canAccessDashboardReports,
  } = role;
  const { data: profileScope } = useProfileScope();
  const tieneAsignacionZonal = hasProfileScopeAssignment(profileScope);
  const [vistaNacional, setVistaNacional] = useState(true);
  useEffect(() => {
    if (!role.loading) {
      setVistaNacional(
        defaultUseNationalView(
          {
            roles: role.roles,
            isSuperAdmin: role.isSuperAdmin,
            isAdmin: role.isAdmin,
            isSupervisor: role.isSupervisor,
            isRegional: role.isRegional,
          },
          tieneAsignacionZonal
        )
      );
    }
  }, [role.loading, role.roles, role.isSuperAdmin, role.isAdmin, role.isSupervisor, role.isRegional, tieneAsignacionZonal]);
  const usarVistaNacional =
    canViewNationalReports && (!tieneAsignacionZonal || vistaNacional);
  const verReportesAmpliados = canAccessDashboardReports;

  const {
    data: registros = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useRegistrosQuery(5000, Boolean(user?.id), { national: usarVistaNacional });

  const [datePreset, setDatePreset] = useState<DateRangePreset>('hoy');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [regionFilter, setRegionFilter] = useState('todas');
  const [distritoFilter, setDistritoFilter] = useState('todos');
  const [servicioFilter, setServicioFilter] = useState('todos');
  const [barrioFilter, setBarrioFilter] = useState('todos');
  const [responsableFilter, setResponsableFilter] = useState('todos');
  const [roundCodigoFilter, setRoundCodigoFilter] = useState('');
  const [chartMode, setChartMode] = useState<'stacked' | 'coverage'>('stacked');
  const [visitaMapFilter, setVisitaMapFilter] = useState<VisitaMapFilter>('todos');
  const [dashTab, setDashTab] = useState<'resumen' | 'graficos' | 'rondas'>('resumen');
  const [exporting, setExporting] = useState(false);
  const assignmentFiltersApplied = useRef(false);
  const [jornadaStats, setJornadaStats] = useState(() => getJornadaStats(''));

  const refreshJornada = useCallback(() => {
    if (!user?.id) return;
    setJornadaStats(getJornadaStats(user.id));
  }, [user?.id]);

  useEffect(() => {
    refreshJornada();
  }, [refreshJornada]);

  useEffect(() => {
    if (assignmentFiltersApplied.current || !profileScope) return;
    const reg = profileScope.assigned_region?.trim();
    const dist = profileScope.assigned_distrito?.trim();
    const serv = profileScope.assigned_servicio?.trim();
    if (!reg && !dist) return;
    if (reg) setRegionFilter(reg);
    if (dist) setDistritoFilter(dist);
    if (serv) setServicioFilter(serv);
    assignmentFiltersApplied.current = true;
  }, [profileScope]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshJornada();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshJornada]);

  const normalize = (v: string | null | undefined) =>
    (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

  const registrosVisibles = useMemo(() => {
    if (verReportesAmpliados) {
      if (isRegional && !usarVistaNacional && profileScope?.assigned_region) {
        const reg = profileScope.assigned_region;
        return registros.filter(
          (r) =>
            (r.region || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() ===
            reg.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
        );
      }
      return filterRegistrosByProfileScope(registros, profileScope, {
        forceNational: usarVistaNacional,
      });
    }
    if (hasProfileScopeAssignment(profileScope)) {
      return filterRegistrosByProfileScope(registros, profileScope);
    }
    return registros;
  }, [registros, verReportesAmpliados, isRegional, profileScope, usarVistaNacional]);

  const registrosPorFecha = useMemo(
    () => filterRegistrosByDate(registrosVisibles, datePreset, customFrom, customTo),
    [registrosVisibles, datePreset, customFrom, customTo]
  );

  const regionesDisponibles = useMemo(
    () => Array.from(new Set(registrosPorFecha.map((r) => r.region).filter(Boolean))).sort(),
    [registrosPorFecha]
  );

  const distritosDisponibles = useMemo(() => {
    const base = regionFilter === 'todas' ? registrosPorFecha : registrosPorFecha.filter((r) => r.region === regionFilter);
    return Array.from(new Set(base.map((r) => r.distrito).filter(Boolean))).sort();
  }, [registrosPorFecha, regionFilter]);

  const serviciosDisponibles = useMemo(() => {
    let base = registrosPorFecha;
    if (regionFilter !== 'todas') base = base.filter((r) => r.region === regionFilter);
    if (distritoFilter !== 'todos') base = base.filter((r) => r.distrito === distritoFilter);
    return Array.from(new Set(base.map((r) => r.servicio?.trim()).filter(Boolean) as string[])).sort(
      (a, b) => a.localeCompare(b, 'es')
    );
  }, [registrosPorFecha, regionFilter, distritoFilter]);

  const barriosDisponibles = useMemo(() => {
    let base = registrosPorFecha;
    if (regionFilter !== 'todas') base = base.filter((r) => r.region === regionFilter);
    if (distritoFilter !== 'todos') base = base.filter((r) => r.distrito === distritoFilter);
    if (servicioFilter !== 'todos' && servicioFilter !== '_sin_servicio') {
      base = base.filter((r) => (r.servicio?.trim() || '') === servicioFilter);
    }
    return Array.from(new Set(base.map((r) => r.barrio?.trim()).filter(Boolean) as string[])).sort(
      (a, b) => a.localeCompare(b, 'es')
    );
  }, [registrosPorFecha, regionFilter, distritoFilter, servicioFilter]);

  const responsablesDisponibles = useMemo(() => {
    let base = registrosPorFecha;
    if (regionFilter !== 'todas') base = base.filter((r) => r.region === regionFilter);
    if (distritoFilter !== 'todos') base = base.filter((r) => r.distrito === distritoFilter);
    return Array.from(new Set(base.map((r) => r.responsable?.trim()).filter(Boolean) as string[])).sort(
      (a, b) => a.localeCompare(b, 'es')
    );
  }, [registrosPorFecha, regionFilter, distritoFilter]);

  const registrosFiltrados = useMemo(
    () =>
      registrosPorFecha.filter((r) => {
        if (regionFilter !== 'todas' && r.region !== regionFilter) return false;
        if (distritoFilter !== 'todos' && r.distrito !== distritoFilter) return false;
        if (servicioFilter === 'todos') {
          /* ok */
        } else if (servicioFilter === '_sin_servicio') {
          if (r.servicio?.trim()) return false;
        } else if ((r.servicio?.trim() || '') !== servicioFilter) {
          return false;
        }
        if (barrioFilter !== 'todos' && (r.barrio?.trim() || '') !== barrioFilter) return false;
        if (responsableFilter !== 'todos' && (r.responsable?.trim() || '') !== responsableFilter) {
          return false;
        }
        if (roundCodigoFilter.trim()) {
          const needle = roundCodigoFilter.trim().toLowerCase();
          const obs = (r.observaciones || '').toLowerCase();
          if (!obs.includes(needle) && !obs.includes(`ronda ${needle}`)) return false;
        }
        return true;
      }),
    [
      registrosPorFecha,
      regionFilter,
      distritoFilter,
      servicioFilter,
      barrioFilter,
      responsableFilter,
      roundCodigoFilter,
    ]
  );

  const data = useMemo(() => buildDashboardData(registrosFiltrados), [registrosFiltrados]);
  const registrosVisitaView = useMemo(
    () => filterRegistrosByVisita(registrosFiltrados, visitaMapFilter),
    [registrosFiltrados, visitaMapFilter]
  );
  const dataVisita = useMemo(() => buildDashboardData(registrosVisitaView), [registrosVisitaView]);
  const registrosMapa = registrosVisitaView;
  const total = data.totalVacunados + data.totalNoVacunados;
  const cobertura = total > 0 ? ((data.totalVacunados / total) * 100).toFixed(1) : '0';
  const contadorViviendas = contadorDesdeDashboard(
    visitaMapFilter === 'todos' ? data.viviendas : dataVisita.viviendas
  );
  const conGps = registrosMapa.filter((r) => r.latitud != null && r.longitud != null).length;

  const filtrosExportLabel = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Período: ${datePreset}`);
    if (regionFilter !== 'todas') parts.push(`Región: ${regionFilter}`);
    if (distritoFilter !== 'todos') parts.push(`Distrito: ${distritoFilter}`);
    if (servicioFilter !== 'todos' && servicioFilter !== '_sin_servicio') parts.push(`Servicio: ${servicioFilter}`);
    if (servicioFilter === '_sin_servicio') parts.push('Sin servicio');
    if (barrioFilter !== 'todos') parts.push(`Barrio: ${barrioFilter}`);
    if (responsableFilter !== 'todos') parts.push(`Responsable: ${responsableFilter}`);
    if (visitaMapFilter !== 'todos') parts.push(`Visita: ${visitaMapFilter}`);
    if (roundCodigoFilter.trim()) parts.push(`Ronda: ${roundCodigoFilter.trim()}`);
    return parts.join(' · ');
  }, [
    datePreset,
    regionFilter,
    distritoFilter,
    servicioFilter,
    barrioFilter,
    responsableFilter,
    visitaMapFilter,
    roundCodigoFilter,
  ]);

  const roundHistoryFilters = useMemo(
    () => ({
      region: regionFilter !== 'todas' ? regionFilter : undefined,
      distrito: distritoFilter !== 'todos' ? distritoFilter : undefined,
      servicio:
        servicioFilter !== 'todos' && servicioFilter !== '_sin_servicio' ? servicioFilter : undefined,
      responsable: responsableFilter !== 'todos' ? responsableFilter : undefined,
      roundCodigo: roundCodigoFilter.trim() || undefined,
      limit: verReportesAmpliados ? 120 : 40,
    }),
    [
      regionFilter,
      distritoFilter,
      servicioFilter,
      responsableFilter,
      roundCodigoFilter,
      verReportesAmpliados,
    ]
  );

  if (isLoading) return <PageSkeleton rows={5} />;

  return (
    <div className="px-3 sm:px-4 lg:px-6 pb-24 pt-2 w-full space-y-4 box-border">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-foreground tracking-tight">Panel · M R V (PNEI / PAI)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {registrosFiltrados.length} registros · {conGps} con GPS
            {isFetching && ' · actualizando…'}
          </p>
          {verReportesAmpliados && (
            <p className="text-[10px] text-primary font-semibold mt-1">
              {usarVistaNacional
                ? 'Vista país (todos los registros)'
                : isRegional && profileScope?.assigned_region
                  ? `Vista regional: ${profileScope.assigned_region}`
                  : `Vista zonal: ${profileScope?.assigned_region} · ${profileScope?.assigned_distrito}${
                      profileScope?.assigned_servicio ? ` · ${profileScope.assigned_servicio}` : ''
                    }`}
            </p>
          )}
          {isError && (
            <p className="text-[10px] text-destructive font-semibold mt-1">
              No se pudieron cargar registros: {(error as Error)?.message || 'error de red'}
            </p>
          )}
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
          <button
            type="button"
            disabled={exporting || !registrosVisibles.length}
            onClick={() => {
              setExporting(true);
              try {
                downloadRegistrosExcel(registrosFiltrados, 'MRV_Registros', {
                  total: registrosFiltrados.length,
                  filtros: filtrosExportLabel,
                  nota: `Exportación del panel (${registrosFiltrados.length} filas). Columnas sin datos en todo el lote omitidas; etiquetas en español.`,
                });
              } finally {
                setExporting(false);
              }
            }}
            className="dash-btn-secondary"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
          <button
            type="button"
            onClick={() =>
              downloadDashboardPdf(data, {
                titulo: 'Panel · filtros aplicados',
                subtitulo: profileScope?.assigned_region
                  ? `Asignación: ${profileScope.assigned_region}${profileScope.assigned_distrito ? ` · ${profileScope.assigned_distrito}` : ''}${profileScope.assigned_servicio ? ` · ${profileScope.assigned_servicio}` : ''}`
                  : undefined,
                filtros: filtrosExportLabel,
                totalRegistros: registrosFiltrados.length,
                conGps,
              })
            }
            className="dash-btn-primary"
          >
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {user && (
        <JornadaSummary
          stats={jornadaStats}
          userId={user.id}
          onContinueRound={onResumeRound}
        />
      )}

      {canViewNationalReports && tieneAsignacionZonal && (
        <label className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={vistaNacional}
            onChange={(e) => setVistaNacional(e.target.checked)}
            className="rounded border-input"
          />
          <span className="font-medium">Ver todos los registros (vista país)</span>
        </label>
      )}

      {registrosVisibles.length > 0 && registrosPorFecha.length === 0 && datePreset !== 'todos' && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
          <p className="font-semibold text-warning">Hay {registrosVisibles.length} registros en el sistema</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ninguno coincide con el período «
            {datePreset === 'hoy'
              ? 'Hoy'
              : datePreset === '7d'
                ? '7 días'
                : datePreset === '15d'
                  ? '15 días'
                  : datePreset === '30d'
                    ? '30 días'
                    : 'personalizado'}
            ». Probá <button type="button" className="underline font-bold" onClick={() => setDatePreset('todos')}>Todo</button>.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Período</p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['hoy', 'Hoy'],
              ['7d', '7 días'],
              ['15d', '15 días'],
              ['30d', '30 días'],
              ['todos', 'Todo'],
              ['custom', 'Personalizado'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDatePreset(id)}
              className={`h-8 px-3 rounded-lg text-xs font-bold border transition-colors ${
                datePreset === id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {datePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">Desde</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="dash-select w-full mt-0.5"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">Hasta</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="dash-select w-full mt-0.5"
              />
            </div>
          </div>
        )}
      </div>

      <div className="dash-filters grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        <select
          aria-label="Filtrar por región"
          value={regionFilter}
          onChange={(e) => {
            setRegionFilter(e.target.value);
            setDistritoFilter('todos');
            setServicioFilter('todos');
          }}
          className="dash-select"
        >
          <option value="todas">Todas las regiones</option>
          {regionesDisponibles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por distrito"
          value={distritoFilter}
          onChange={(e) => {
            setDistritoFilter(e.target.value);
            setServicioFilter('todos');
          }}
          className="dash-select"
        >
          <option value="todos">Todos los distritos</option>
          {distritosDisponibles.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por servicio de salud"
          value={servicioFilter}
          onChange={(e) => setServicioFilter(e.target.value)}
          className="dash-select"
        >
          <option value="todos">Todos los servicios</option>
          {serviciosDisponibles.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="_sin_servicio">Sin servicio indicado</option>
        </select>
        <select
          aria-label="Filtrar por barrio"
          value={barrioFilter}
          onChange={(e) => setBarrioFilter(e.target.value)}
          className="dash-select"
        >
          <option value="todos">Todos los barrios</option>
          {barriosDisponibles.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por responsable"
          value={responsableFilter}
          onChange={(e) => setResponsableFilter(e.target.value)}
          className="dash-select"
        >
          <option value="todos">Todos los responsables</option>
          {responsablesDisponibles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label="Filtrar por ID de ronda"
          placeholder="ID de ronda (ej. R250527)"
          value={roundCodigoFilter}
          onChange={(e) => setRoundCodigoFilter(e.target.value)}
          className="dash-select"
        />
        <select
          aria-label="Tipo de gráfico"
          value={chartMode}
          onChange={(e) => setChartMode(e.target.value as 'stacked' | 'coverage')}
          className="dash-select"
        >
          <option value="stacked">Barras apiladas</option>
          <option value="coverage">Cobertura %</option>
        </select>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-muted/60 border">
        {(
          [
            { id: 'resumen' as const, label: 'Resumen' },
            { id: 'graficos' as const, label: 'Gráficos' },
            { id: 'rondas' as const, label: 'Monitoreos' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setDashTab(t.id)}
            className={`flex-1 h-9 rounded-lg text-xs font-bold transition-colors ${
              dashTab === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-card'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {dashTab === 'resumen' && (
        <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard label="Vacunados" value={data.totalVacunados} icon={Syringe} tone="success" />
        <KpiCard label="No vacunados" value={data.totalNoVacunados} icon={XCircle} tone="danger" />
        <KpiCard label="Cobertura" value={`${cobertura}%`} icon={TrendingUp} tone="primary" />
        <KpiCard label="Total" value={total} icon={BarChart3} tone="warning" />
      </div>

      <div className="dash-card p-3 space-y-2">
        <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide">
          Filtro mapa · visitas E / N / F / R
        </p>
        <VisitaMapFilterBar value={visitaMapFilter} onChange={setVisitaMapFilter} />
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
            <MrvMapPanel registros={registrosMapa} height="280px" maxMarkers={150} showLegend />
          </Suspense>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8 px-4">
            Aún no hay registros con GPS en estos filtros.
          </p>
        )}
      </div>
        </>
      )}

      {dashTab === 'graficos' && (
        total === 0 ? (
          <div className="dash-card text-center py-12 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-40" />
            <p className="font-semibold">Sin datos para gráficos</p>
          </div>
        ) : (
          <Suspense fallback={<PageSkeleton rows={2} />}>
            <DashboardCharts data={data} chartMode={chartMode} />
          </Suspense>
        )
      )}

      {dashTab === 'rondas' && (
        <RoundHistoryPanel
          lazy={false}
          adminMode={isAdmin || isSuperAdmin}
          useAdminList={verReportesAmpliados}
          groupByUser={verReportesAmpliados && usarVistaNacional && canViewNationalReports}
          title="Monitoreos finalizados · reportes Excel/PDF"
          filters={roundHistoryFilters}
          showIdSearch={verReportesAmpliados}
        />
      )}

    </div>
  );
}
