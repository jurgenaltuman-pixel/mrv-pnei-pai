import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DashboardData } from '@/services/dataService';
import { saveBlobAsFile } from '@/lib/download-file';
import { formatFechaHoraPy } from '@/lib/format-fecha';

export type DashboardPdfOptions = {
  titulo?: string;
  subtitulo?: string;
  filtros?: string;
  totalRegistros?: number;
  conGps?: number;
};

export function downloadDashboardPdf(data: DashboardData, opts: DashboardPdfOptions = {}) {
  const titulo = opts.titulo ?? 'Panel MRV';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const total = data.totalVacunados + data.totalNoVacunados;
  const cobertura = total > 0 ? ((data.totalVacunados / total) * 100).toFixed(1) : '0';
  const v = data.viviendas;

  doc.setFillColor(0, 85, 164);
  doc.rect(0, 0, 210, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('M R V — Resumen del panel', 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(titulo, 14, 20);
  if (opts.subtitulo) {
    doc.setFontSize(9);
    doc.text(opts.subtitulo, 14, 27);
  }
  doc.setFontSize(8);
  doc.text(`Generado: ${formatFechaHoraPy(new Date())}`, 14, 33);

  doc.setTextColor(40, 40, 40);
  let y = 44;

  if (opts.filtros) {
    doc.setFillColor(240, 244, 248);
    doc.roundedRect(14, y - 4, 182, 12, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const fl = doc.splitTextToSize(`Filtros: ${opts.filtros}`, 176);
    doc.text(fl, 16, y + 2);
    y += fl.length * 3.8 + 8;
  }

  const kpiBody = [
    ['Vacunados (casa E)', String(data.totalVacunados)],
    ['No vacunados (casa E)', String(data.totalNoVacunados)],
    ['Cobertura vacunal', `${cobertura}%`],
    ['Total niños evaluados', String(total)],
  ];
  if (opts.totalRegistros != null) {
    kpiBody.push(['Registros en exporte', String(opts.totalRegistros)]);
  }
  if (opts.conGps != null) {
    kpiBody.push(['Con GPS', String(opts.conGps)]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: kpiBody,
    theme: 'grid',
    headStyles: { fillColor: [0, 85, 164], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.8 },
    columnStyles: { 0: { cellWidth: 72, fontStyle: 'bold' }, 1: { cellWidth: 98 } },
    margin: { left: 14, right: 14 },
  });

  let y2 = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 28;

  autoTable(doc, {
    startY: y2 + 6,
    head: [['Código casa', 'Cantidad', 'Descripción']],
    body: [
      ['E · Efectiva', String(v.efectiva), 'Abierta con niños 1–5 años'],
      ['N · No efectiva', String(v.revisitada), 'Abierta sin niños elegibles'],
      ['F · Fallida', String(v.sin_adulto_responsable), 'Cerrada o sin responsable'],
      ['R · Renuente', String(v.renuente), 'Rechazo del adulto'],
      ['Sin dato', String(v.sin_dato), 'Tipo no indicado'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [30, 64, 110], textColor: 255, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 2.2 },
    margin: { left: 14, right: 14 },
  });

  y2 = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y2 + 30;

  const distritos = Object.entries(data.porDistrito);
  if (distritos.length > 0) {
    autoTable(doc, {
      startY: y2 + 6,
      head: [['Distrito', 'Vacunados', 'No vac.', 'Cobertura %']],
      body: distritos.map(([d, row]) => {
        const t = row.vacunados + row.noVacunados;
        const pct = t > 0 ? ((row.vacunados / t) * 100).toFixed(1) : '0';
        return [d, String(row.vacunados), String(row.noVacunados), pct];
      }),
      theme: 'plain',
      headStyles: { fillColor: [240, 244, 248], textColor: [30, 41, 59], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    });
  }

  const servicios = Object.entries(data.porServicio || {});
  if (servicios.length > 0) {
    const y3 = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y2 + 20;
    autoTable(doc, {
      startY: y3 + 6,
      head: [['Servicio', 'Vacunados', 'No vac.']],
      body: servicios.slice(0, 25).map(([s, row]) => [
        s.length > 42 ? `${s.slice(0, 39)}…` : s,
        String(row.vacunados),
        String(row.noVacunados),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [0, 85, 164], fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 1.8 },
      margin: { left: 14, right: 14 },
    });
  }

  const fn = `MRV_Panel_${new Date().toISOString().slice(0, 10)}.pdf`;
  void saveBlobAsFile(fn, doc.output('blob'), 'application/pdf');
}
