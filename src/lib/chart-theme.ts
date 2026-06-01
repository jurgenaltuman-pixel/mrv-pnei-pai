import type { ChartOptions } from 'chart.js';

export const MRV_CHART = {
  vacunado: 'rgba(22, 163, 74, 0.9)',
  vacunadoSoft: 'rgba(22, 163, 74, 0.55)',
  noVacunado: 'rgba(220, 38, 38, 0.88)',
  noVacunadoSoft: 'rgba(220, 38, 38, 0.5)',
  primary: 'rgba(0, 85, 164, 0.92)',
  primarySoft: 'rgba(0, 85, 164, 0.45)',
  accent: 'rgba(245, 158, 11, 0.9)',
  accentSoft: 'rgba(245, 158, 11, 0.5)',
  grid: 'rgba(148, 163, 184, 0.22)',
  text: 'rgba(51, 65, 85, 0.95)',
} as const;

export const doughnutChartOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '62%',
  animation: { duration: 420, easing: 'easeOutQuad' },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 14,
        font: { size: 11, weight: '600' },
        color: MRV_CHART.text,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.94)',
      padding: 10,
      cornerRadius: 8,
      titleFont: { size: 11, weight: 'bold' },
      bodyFont: { size: 11 },
    },
  },
};

export function barChartOptions(opts?: {
  stacked?: boolean;
  horizontal?: boolean;
  max?: number;
}): ChartOptions<'bar'> {
  const horizontal = opts?.horizontal ?? false;
  const stacked = opts?.stacked ?? false;
  const indexAxis = horizontal ? ('y' as const) : ('x' as const);
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis,
    animation: { duration: 450, easing: 'easeOutQuad' },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'rectRounded',
          padding: 14,
          font: { size: 11, weight: '600' },
          color: MRV_CHART.text,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        stacked,
        grid: { display: horizontal, color: MRV_CHART.grid, drawBorder: false },
        ticks: { font: { size: 10 }, maxRotation: horizontal ? 0 : 35, minRotation: 0 },
      },
      y: {
        stacked,
        beginAtZero: true,
        max: opts?.max,
        grid: { display: !horizontal, color: MRV_CHART.grid, drawBorder: false },
        ticks: { font: { size: 10 }, precision: 0 },
      },
    },
  };
}

export function barDataset(label: string, data: number[], color: string, colorSoft?: string) {
  return {
    label,
    data,
    backgroundColor: color,
    hoverBackgroundColor: colorSoft || color,
    borderRadius: 6,
    borderSkipped: false as const,
    maxBarThickness: horizontalMaxThickness(data.length),
  };
}

function horizontalMaxThickness(count: number): number {
  if (count <= 4) return 36;
  if (count <= 8) return 28;
  return 22;
}
