import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RoundMonitoring, RoundSummary } from '@/types/round-monitoring';
import type { RoundEvaluation } from '@/lib/round-evaluation';
import { formatFechaHoraPy } from '@/lib/format-fecha';
import { UMBRAL_COBERTURA_APROBADO } from '@/lib/round-evaluation';

type DetalleFila = {
  casa: number;
  estado: string;
  nino: string;
  documento: string;
  vacunado: string;
  lat: string;
  lng: string;
};

function buildDetalleFilas(round: RoundMonitoring): DetalleFila[] {
  const filas: DetalleFila[] = [];
  for (const c of round.casas) {
    if (!c.guardada || !c.estado) continue;
    if (c.ninos.length === 0) {
      filas.push({
        casa: c.numero,
        estado: c.estado,
        nino: '(visita sin niño)',
        documento: '',
        vacunado: '—',
        lat: c.latitud != null ? String(c.latitud) : '',
        lng: c.longitud != null ? String(c.longitud) : '',
      });
      continue;
    }
    for (const n of c.ninos) {
      filas.push({
        casa: c.numero,
        estado: c.estado,
        nino: n.nombre,
        documento: n.documento,
        vacunado: n.vacunado ? 'Sí' : 'No',
        lat: c.latitud != null ? String(c.latitud) : '',
        lng: c.longitud != null ? String(c.longitud) : '',
      });
    }
  }
  return filas;
}

function resumenRows(
  round: RoundMonitoring,
  summary: RoundSummary,
  evaluation: RoundEvaluation
) {
  return [
    { campo: 'Ronda / módulo', valor: round.moduloLabel },
    { campo: 'Región', valor: round.region },
    { campo: 'Distrito', valor: round.distrito },
    { campo: 'Barrio', valor: round.barrio },
    { campo: 'Responsable', valor: round.responsable || '' },
    { campo: 'Resultado', valor: evaluation.titulo },
    { campo: 'Mensaje', valor: evaluation.mensaje },
    {
      campo: 'Cobertura vacunal',
      valor:
        evaluation.coberturaVacunacion != null
          ? `${evaluation.coberturaVacunacion}% (meta ≥ ${UMBRAL_COBERTURA_APROBADO}%)`
          : 'Sin niños registrados',
    },
    { campo: 'Casas visitadas', valor: `${summary.visitadas} / ${summary.totalCasas}` },
    { campo: 'Efectivas (E)', valor: String(summary.efectivas) },
    { campo: 'No efectivas (N)', valor: String(summary.noEfectivas) },
    { campo: 'Fallidas (F)', valor: String(summary.fallidas) },
    { campo: 'Renuentes (R)', valor: String(summary.renuentes) },
    { campo: 'Niños encuestados', valor: String(summary.totalNinos) },
    { campo: 'Vacunados', valor: String(summary.vacunados) },
    { campo: 'No vacunados', valor: String(summary.noVacunados) },
    { campo: 'Generado', valor: formatFechaHoraPy(new Date()) },
  ];
}

function safeFilename(label: string) {
  return label.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 40) || 'ronda';
}

export function downloadRoundReportExcel(
  round: RoundMonitoring,
  summary: RoundSummary,
  evaluation: RoundEvaluation
) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows(round, summary, evaluation)), 'Resumen');
  const detalle = buildDetalleFilas(round);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      detalle.length
        ? detalle
        : [{ casa: '', estado: '', nino: 'Sin detalle', documento: '', vacunado: '', lat: '', lng: '' }]
    ),
    'Detalle'
  );
  const fn = `MRV_Ronda_${safeFilename(round.moduloLabel)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fn);
}

export function downloadRoundReportPdf(
  round: RoundMonitoring,
  summary: RoundSummary,
  evaluation: RoundEvaluation
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const aprobado = evaluation.aprobado;
  const headerColor: [number, number, number] = aprobado ? [22, 101, 52] : [180, 83, 9];

  doc.setFillColor(0, 85, 164);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('M R V — Informe de ronda', 14, 12);
  doc.setFontSize(11);
  doc.text(round.moduloLabel, 14, 20);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  let y = 36;

  doc.setFillColor(...headerColor);
  doc.roundedRect(14, y - 5, 182, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(evaluation.titulo, 18, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  y += 14;

  const lines = doc.splitTextToSize(evaluation.mensaje, 180);
  doc.text(lines, 14, y);
  y += lines.length * 5 + 4;

  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['Ubicación', `${round.region} · ${round.distrito} · ${round.barrio}`],
      ['Casas visitadas', `${summary.visitadas} / ${summary.totalCasas}`],
      ['E · N · F · R', `${summary.efectivas} · ${summary.noEfectivas} · ${summary.fallidas} · ${summary.renuentes}`],
      ['Niños / vacunados', `${summary.totalNinos} / ${summary.vacunados}`],
      [
        'Cobertura vacunal',
        evaluation.coberturaVacunacion != null
          ? `${evaluation.coberturaVacunacion}% (≥ ${UMBRAL_COBERTURA_APROBADO}%)`
          : '—',
      ],
      ['Generado', formatFechaHoraPy(new Date())],
    ],
    theme: 'grid',
    headStyles: { fillColor: [0, 85, 164], textColor: 255, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;

  autoTable(doc, {
    startY: finalY + 8,
    head: [['Casa', 'Est.', 'Niño/a', 'Documento', 'Vac.']],
    body: buildDetalleFilas(round).map((r) => [
      String(r.casa),
      r.estado,
      r.nino.slice(0, 28),
      r.documento,
      r.vacunado,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [0, 85, 164], fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 1.8 },
    margin: { left: 14, right: 14 },
  });

  const fn = `MRV_Ronda_${safeFilename(round.moduloLabel)}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fn);
}
