import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import type { DashboardData } from '@/services/dataService';
import type { RoundServicioStats } from '@/lib/round-dashboard-stats';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

interface Props {
  data: DashboardData;
  chartMode: 'stacked' | 'coverage';
  roundsByServicio?: RoundServicioStats[];
}

function topEntries(map: Record<string, { vacunados: number; noVacunados: number }> | undefined, n = 8) {
  return Object.entries(map || {})
    .map(([name, values]) => ({ name, ...values, total: values.vacunados + values.noVacunados }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

export default function DashboardCharts({ data, chartMode, roundsByServicio = [] }: Props) {
  const distritos = topEntries(data.porDistrito);
  const responsables = topEntries(data.porResponsable);
  const servicios = topEntries(data.porServicio);
  const barrios = topEntries(data.porBarrio);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="dash-card p-4">
          <h3 className="text-sm font-bold mb-3">Estado de vacunación</h3>
          <div className="h-44">
            <Doughnut
              data={{
                labels: ['Vacunados', 'No vacunados'],
                datasets: [{
                  data: [data.totalVacunados, data.totalNoVacunados],
                  backgroundColor: ['hsl(152 60% 38%)', 'hsl(0 72% 51%)'],
                  borderWidth: 0,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
              }}
            />
          </div>
        </div>
        <div className="dash-card p-4">
          <h3 className="text-sm font-bold mb-3">Esquema CVS</h3>
          <div className="h-44">
            <Doughnut
              data={{
                labels: ['Completo', 'Incompleto'],
                datasets: [{
                  data: [data.esquema?.completo || 0, data.esquema?.incompleto || 0],
                  backgroundColor: ['hsl(210 100% 32%)', 'hsl(38 92% 50%)'],
                  borderWidth: 0,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
              }}
            />
          </div>
        </div>
      </div>
      {distritos.length > 0 && (
        <div className="dash-card p-4">
          <h3 className="text-sm font-bold mb-3">Por distrito</h3>
          <Bar
            data={{
              labels: distritos.map((d) => d.name),
              datasets:
                chartMode === 'stacked'
                  ? [
                      { label: 'Vacunados', data: distritos.map((d) => d.vacunados), backgroundColor: 'hsl(152 60% 38%)' },
                      { label: 'No vacunados', data: distritos.map((d) => d.noVacunados), backgroundColor: 'hsl(0 72% 51%)' },
                    ]
                  : [
                      {
                        label: 'Cobertura %',
                        data: distritos.map((d) => (d.total > 0 ? Number(((d.vacunados / d.total) * 100).toFixed(1)) : 0)),
                        backgroundColor: 'hsl(210 100% 32%)',
                      },
                    ],
            }}
            options={{
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              scales: {
                x: { stacked: chartMode === 'stacked' },
                y: { stacked: chartMode === 'stacked', beginAtZero: true, max: chartMode === 'coverage' ? 100 : undefined },
              },
            }}
          />
        </div>
      )}
      {servicios.length > 0 && (
        <div className="dash-card p-4">
          <h3 className="text-sm font-bold mb-3">Por servicio de salud</h3>
          <Bar
            data={{
              labels: servicios.map((d) => d.name),
              datasets:
                chartMode === 'stacked'
                  ? [
                      { label: 'Vacunados', data: servicios.map((d) => d.vacunados), backgroundColor: 'hsl(152 60% 38%)' },
                      { label: 'No vacunados', data: servicios.map((d) => d.noVacunados), backgroundColor: 'hsl(0 72% 51%)' },
                    ]
                  : [
                      {
                        label: 'Cobertura %',
                        data: servicios.map((d) => (d.total > 0 ? Number(((d.vacunados / d.total) * 100).toFixed(1)) : 0)),
                        backgroundColor: 'hsl(210 100% 32%)',
                      },
                    ],
            }}
            options={{
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              scales: {
                x: { stacked: chartMode === 'stacked' },
                y: { stacked: chartMode === 'stacked', beginAtZero: true, max: chartMode === 'coverage' ? 100 : undefined },
              },
            }}
          />
        </div>
      )}
      {barrios.length > 0 && (
        <div className="dash-card p-4">
          <h3 className="text-sm font-bold mb-3">Por barrio</h3>
          <Bar
            data={{
              labels: barrios.map((d) => d.name),
              datasets:
                chartMode === 'stacked'
                  ? [
                      { label: 'Vacunados', data: barrios.map((d) => d.vacunados), backgroundColor: 'hsl(152 60% 38%)' },
                      { label: 'No vacunados', data: barrios.map((d) => d.noVacunados), backgroundColor: 'hsl(0 72% 51%)' },
                    ]
                  : [
                      {
                        label: 'Cobertura %',
                        data: barrios.map((d) => (d.total > 0 ? Number(((d.vacunados / d.total) * 100).toFixed(1)) : 0)),
                        backgroundColor: 'hsl(38 92% 50%)',
                      },
                    ],
            }}
            options={{
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              scales: {
                x: { stacked: chartMode === 'stacked' },
                y: { stacked: chartMode === 'stacked', beginAtZero: true, max: chartMode === 'coverage' ? 100 : undefined },
              },
            }}
          />
        </div>
      )}
      {responsables.length > 0 && (
        <div className="dash-card p-4">
          <h3 className="text-sm font-bold mb-3">Por responsable</h3>
          <Bar
            data={{
              labels: responsables.map((d) => d.name),
              datasets:
                chartMode === 'stacked'
                  ? [
                      { label: 'Vacunados', data: responsables.map((d) => d.vacunados), backgroundColor: 'hsl(152 60% 38%)' },
                      { label: 'No vacunados', data: responsables.map((d) => d.noVacunados), backgroundColor: 'hsl(0 72% 51%)' },
                    ]
                  : [
                      {
                        label: 'Cobertura %',
                        data: responsables.map((d) => (d.total > 0 ? Number(((d.vacunados / d.total) * 100).toFixed(1)) : 0)),
                        backgroundColor: 'hsl(210 100% 32%)',
                      },
                    ],
            }}
            options={{
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              scales: {
                x: { stacked: chartMode === 'stacked' },
                y: { stacked: chartMode === 'stacked', beginAtZero: true, max: chartMode === 'coverage' ? 100 : undefined },
              },
            }}
          />
        </div>
      )}
      {roundsByServicio.length > 0 && (
        <div className="dash-card p-4">
          <h3 className="text-sm font-bold mb-3">Rondas de monitoreo por servicio</h3>
          <Bar
            data={{
              labels: roundsByServicio.map((r) => r.servicio),
              datasets: [
                { label: 'Rondas completadas', data: roundsByServicio.map((r) => r.rondas), backgroundColor: 'hsl(210 100% 32%)' },
                { label: 'Aprobadas', data: roundsByServicio.map((r) => r.aprobadas), backgroundColor: 'hsl(152 60% 38%)' },
                { label: 'Niños vacunados', data: roundsByServicio.map((r) => r.vacunados), backgroundColor: 'hsl(38 92% 50%)' },
              ],
            }}
            options={{
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              scales: { y: { beginAtZero: true } },
            }}
          />
        </div>
      )}
    </>
  );
}
