import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RoundMonitoring, RoundSummary } from '@/types/round-monitoring';
import type { RoundEvaluation } from '@/lib/round-evaluation';
import { formatFechaHoraPy } from '@/lib/format-fecha';
import { UMBRAL_COBERTURA_APROBADO } from '@/lib/round-evaluation';
import { getEstadoConfig } from '@/lib/croquis-housing';
import { formatRoundCodigoDisplay } from '@/lib/round-codigo';
import { appendMetaSheet, jsonSheetWithCols } from '@/lib/xlsx-report-utils';

type DetalleFila = {
  casa: number;
  estado: string;
  estado_detalle: string;
  nino: string;
  documento: string;
  vacunado: string;
  lat: string;
  lng: string;
};

function estadoDetalleLabel(code: string): string {
  const cfg = ['E', 'N', 'F', 'R'].includes(code)
    ? getEstadoConfig(code as 'E' | 'N' | 'F' | 'R')
    : null;
  if (!cfg) return '';
  return [cfg.linea1, cfg.linea2, cfg.linea3].filter(Boolean).join(' · ');
}

function buildDetalleFilas(round: RoundMonitoring): DetalleFila[] {
  const filas: DetalleFila[] = [];
  for (const c of round.casas) {
    if (!c.guardada || !c.estado) continue;
    const det = estadoDetalleLabel(c.estado);
    if (c.ninos.length === 0) {
      filas.push({
        casa: c.numero,
        estado: c.estado,
        estado_detalle: det,
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
        estado_detalle: det,
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

function equipoLabel(round: RoundMonitoring): string {
  const parts = [round.entrevistador || round.responsable].filter(Boolean) as string[];
  for (const c of round.colaboradores || []) {
    if (c && !parts.includes(c)) parts.push(c);
  }
  return parts.join(' · ') || '—';
}

function resumenRows(
  round: RoundMonitoring,
  summary: RoundSummary,
  evaluation: RoundEvaluation
) {
  return [
    { campo: 'ID de ronda', valor: formatRoundCodigoDisplay(round) },
    { campo: 'Ronda / módulo (barrio)', valor: round.moduloLabel },
    { campo: 'Barrio de la ronda', valor: round.barrio || round.moduloLabel },
    { campo: 'Región', valor: round.region },
    { campo: 'Distrito', valor: round.distrito },
    { campo: 'Servicio de salud', valor: round.servicio || '—' },
    { campo: 'Entrevistador', valor: round.entrevistador || round.responsable || '—' },
    { campo: 'Brigadistas / equipo', valor: equipoLabel(round) },
    { campo: 'Responsable asignación', valor: round.responsable || '—' },
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
  jsonSheetWithCols(wb, resumenRows(round, summary, evaluation), 'Resumen');
  const detalle = buildDetalleFilas(round);
  jsonSheetWithCols(
    wb,
    detalle.length
      ? detalle
      : [
          {
            casa: '',
            estado: '',
            estado_detalle: '',
            nino: 'Sin detalle',
            documento: '',
            vacunado: '',
            lat: '',
            lng: '',
          },
        ],
    'Detalle casas'
  );
  appendMetaSheet(wb, [
    { campo: 'sistema', valor: 'MRV — Monitoreo Rápido de Vacunación' },
    { campo: 'id_ronda', valor: formatRoundCodigoDisplay(round) },
    { campo: 'generado', valor: formatFechaHoraPy(new Date()) },
  ]);
  const fn = `MRV_Ronda_${formatRoundCodigoDisplay(round)}_${safeFilename(round.moduloLabel)}.xlsx`;
  XLSX.writeFile(wb, fn);
}

export function downloadRoundReportPdf(
  round: RoundMonitoring,
  summary: RoundSummary,
  evaluation: RoundEvaluation
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const aprobado = evaluation.aprobado;
  const statusColor: [number, number, number] = aprobado ? [22, 101, 52] : [180, 83, 9];
  const roundId = formatRoundCodigoDisplay(round);

  doc.setFillColor(0, 85, 164);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('M R V — Informe de ronda', 14, 11);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(round.moduloLabel, 14, 19);
  doc.setFontSize(9);
  doc.text(`ID ${roundId}`, 14, 26);

  doc.setTextColor(40, 40, 40);
  let y = 42;

  doc.setFillColor(...statusColor);
  doc.roundedRect(14, y - 5, 182, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(evaluation.titulo, 18, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 55, 55);
  y += 14;

  const lines = doc.splitTextToSize(evaluation.mensaje, 180);
  doc.setFontSize(9);
  doc.text(lines, 14, y);
  y += lines.length * 4.5 + 2;

  autoTable(doc, {
    startY: y,
    head: [['Campo', 'Valor']],
    body: [
      ['Entrevistador', round.entrevistador || round.responsable || '—'],
      ['Equipo / brigadistas', equipoLabel(round)],
      ['Barrio de la ronda', round.barrio || round.moduloLabel],
      ['Región', round.region],
      ['Distrito', round.distrito],
      ['Servicio de salud', round.servicio || '—'],
      ['Responsable', round.responsable || '—'],
    ],
    theme: 'plain',
    headStyles: { fillColor: [240, 244, 248], textColor: [30, 41, 59], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 118 } },
    margin: { left: 14, right: 14 },
  });

  let y2 = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;

  autoTable(doc, {
    startY: y2 + 4,
    head: [['Indicador', 'Valor']],
    body: [
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

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y2 + 40;

  autoTable(doc, {
    startY: finalY + 6,
    head: [['Casa', 'Est.', 'Detalle visita', 'Niño/a', 'Doc.', 'Vac.']],
    body: buildDetalleFilas(round).map((r) => [
      String(r.casa),
      r.estado,
      r.estado_detalle.slice(0, 36),
      r.nino.slice(0, 22),
      r.documento,
      r.vacunado,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [0, 85, 164], fontSize: 7.5 },
    styles: { fontSize: 7, cellPadding: 1.6 },
    margin: { left: 14, right: 14 },
  });

  const fn = `MRV_Ronda_${roundId}_${safeFilename(round.moduloLabel)}.pdf`;
  doc.save(fn);
}
