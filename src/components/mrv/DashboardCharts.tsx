import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import type { DashboardData } from '@/services/dataService';
import { barChartOptions, barDataset, doughnutChartOptions, MRV_CHART } from '@/lib/chart-theme';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

interface Props {
  data: DashboardData;
  chartMode: 'stacked' | 'coverage';
}

function topEntries(map: Record<string, { vacunados: number; noVacunados: number }> | undefined, n = 8) {
  return Object.entries(map || {})
    .map(([name, values]) => ({ name, ...values, total: values.vacunados + values.noVacunados }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

function truncateLabel(name: string, max = 22): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function VacunacionBarChart({
  title,
  entries,
  chartMode,
  horizontal = false,
  coverageColor = MRV_CHART.primary,
}: {
  title: string;
  entries: ReturnType<typeof topEntries>;
  chartMode: 'stacked' | 'coverage';
  horizontal?: boolean;
  coverageColor?: string;
}) {
  if (!entries.length) return null;
  const labels = entries.map((d) => truncateLabel(d.name, horizontal ? 32 : 18));

  return (
    <div className="dash-card p-4 overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold">{title}</h3>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          {chartMode === 'stacked' ? 'Apilado' : 'Cobertura %'}
        </span>
      </div>
      <div className={horizontal ? 'h-56' : 'h-52'}>
        <Bar
          data={{
            labels,
            datasets:
              chartMode === 'stacked'
                ? [
                    barDataset(
                      'Vacunados',
                      entries.map((d) => d.vacunados),
                      MRV_CHART.vacunado,
                      MRV_CHART.vacunadoSoft
                    ),
                    barDataset(
                      'No vacunados',
                      entries.map((d) => d.noVacunados),
                      MRV_CHART.noVacunado,
                      MRV_CHART.noVacunadoSoft
                    ),
                  ]
                : [
                    barDataset(
                      'Cobertura %',
                      entries.map((d) =>
                        d.total > 0 ? Number(((d.vacunados / d.total) * 100).toFixed(1)) : 0
                      ),
                      coverageColor,
                      MRV_CHART.primarySoft
                    ),
                  ],
          }}
          options={barChartOptions({
            stacked: chartMode === 'stacked',
            horizontal,
            max: chartMode === 'coverage' ? 100 : undefined,
          })}
        />
      </div>
    </div>
  );
}

export default function DashboardCharts({ data, chartMode }: Props) {
  const distritos = topEntries(data.porDistrito);
  const responsables = topEntries(data.porResponsable);
  const servicios = topEntries(data.porServicio);
  const barrios = topEntries(data.porBarrio);
  const totalVac = data.totalVacunados + data.totalNoVacunados;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="dash-card p-4">
          <h3 className="text-sm font-bold mb-1">Estado de vacunación</h3>
          <p className="text-[10px] text-muted-foreground mb-3">Solo casas efectivas (E)</p>
          <div className="h-48">
            <Doughnut
              data={{
                labels: ['Vacunados', 'No vacunados'],
                datasets: [
                  {
                    data: [data.totalVacunados, data.totalNoVacunados],
                    backgroundColor: [MRV_CHART.vacunado, MRV_CHART.noVacunado],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 6,
                  },
                ],
              }}
              options={doughnutChartOptions}
            />
          </div>
          {totalVac > 0 && (
            <p className="text-center text-xs font-bold text-primary mt-1">
              {((data.totalVacunados / totalVac) * 100).toFixed(1)}% cobertura
            </p>
          )}
        </div>
        <div className="dash-card p-4">
          <h3 className="text-sm font-bold mb-1">Esquema CVS</h3>
          <p className="text-[10px] text-muted-foreground mb-3">Completitud del esquema</p>
          <div className="h-48">
            <Doughnut
              data={{
                labels: ['Completo', 'Incompleto'],
                datasets: [
                  {
                    data: [data.esquema?.completo || 0, data.esquema?.incompleto || 0],
                    backgroundColor: [MRV_CHART.primary, MRV_CHART.accent],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 6,
                  },
                ],
              }}
              options={doughnutChartOptions}
            />
          </div>
        </div>
      </div>

      <VacunacionBarChart title="Por distrito" entries={distritos} chartMode={chartMode} />
      <VacunacionBarChart
        title="Por servicio de salud"
        entries={servicios}
        chartMode={chartMode}
        horizontal={servicios.length > 4}
      />
      <VacunacionBarChart
        title="Por barrio"
        entries={barrios}
        chartMode={chartMode}
        horizontal
        coverageColor={MRV_CHART.accent}
      />
      <VacunacionBarChart
        title="Por responsable"
        entries={responsables}
        chartMode={chartMode}
        horizontal
      />
    </div>
  );
}
