import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DashboardData } from '@/services/dataService';
import { formatFechaHoraPy } from '@/lib/format-fecha';

export function downloadDashboardPdf(data: DashboardData, titulo = 'Panel MRV') {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const total = data.totalVacunados + data.totalNoVacunados;
  const cobertura = total > 0 ? ((data.totalVacunados / total) * 100).toFixed(1) : '0';

  doc.setFillColor(0, 85, 164);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text('M R V — Resumen del panel', 14, 11);
  doc.setFontSize(10);
  doc.text(titulo, 14, 19);

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.text(`Generado: ${formatFechaHoraPy(new Date())}`, 14, 34);

  autoTable(doc, {
    startY: 40,
    head: [['Indicador', 'Valor']],
    body: [
      ['Vacunados', String(data.totalVacunados)],
      ['No vacunados', String(data.totalNoVacunados)],
      ['Cobertura global', `${cobertura}%`],
      [
        'Viviendas',
        `Efectiva ${data.viviendas.efectiva} · Revisitada ${data.viviendas.revisitada} · Sin adulto ${data.viviendas.sin_adulto_responsable} · Renuente ${data.viviendas.renuente}`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [0, 85, 164], textColor: 255, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    margin: { left: 14, right: 14 },
  });

  const distritos = Object.entries(data.porDistrito);
  if (distritos.length > 0) {
    const y0 = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 70;
    autoTable(doc, {
      startY: y0 + 8,
      head: [['Distrito', 'Vacunados', 'No vac.', 'Cobertura %']],
      body: distritos.map(([d, v]) => {
        const t = v.vacunados + v.noVacunados;
        const pct = t > 0 ? ((v.vacunados / t) * 100).toFixed(1) : '0';
        return [d, String(v.vacunados), String(v.noVacunados), pct];
      }),
      theme: 'striped',
      headStyles: { fillColor: [0, 85, 164], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    });
  }

  doc.save(`MRV_Panel_${new Date().toISOString().slice(0, 10)}.pdf`);
}
