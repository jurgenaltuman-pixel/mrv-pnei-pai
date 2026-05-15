import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import type { DashboardData } from '@/services/dataService';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

interface Props {
  data: DashboardData;
  chartMode: 'stacked' | 'coverage';
}

export default function DashboardCharts({ data, chartMode }: Props) {
  const distritos = Object.entries(data.porDistrito)
    .map(([name, values]) => ({ name, ...values, total: values.vacunados + values.noVacunados }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

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
    </>
  );
}
