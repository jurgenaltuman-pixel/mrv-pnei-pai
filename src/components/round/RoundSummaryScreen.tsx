import type { RoundSummary } from '@/types/round-monitoring';
import type { RoundEvaluation } from '@/lib/round-evaluation';
import { UMBRAL_COBERTURA_APROBADO } from '@/lib/round-evaluation';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FileText, RotateCcw } from 'lucide-react';

interface Props {
  summary: RoundSummary;
  evaluation: RoundEvaluation;
  moduloLabel: string;
  roundCodigo?: string;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onNuevaRonda: () => void;
}

export default function RoundSummaryScreen({
  summary,
  evaluation,
  moduloLabel,
  roundCodigo,
  onExportExcel,
  onExportPdf,
  onNuevaRonda,
}: Props) {
  const { aprobado, coberturaVacunacion, mensaje } = evaluation;

  return (
    <div className="mrv-panel p-6 sm:p-8 max-w-lg mx-auto">
      <div className="text-center mb-6">
        {aprobado ? (
          <CheckCircle2 className="w-20 h-20 text-success mx-auto mb-4" />
        ) : (
          <AlertTriangle className="w-20 h-20 text-warning mx-auto mb-4" />
        )}
        <h2 className="text-2xl sm:text-3xl font-black mb-1">{evaluation.titulo}</h2>
        <p className="text-sm font-bold text-primary">{moduloLabel}</p>
        {roundCodigo && (
          <p className="text-[11px] font-mono text-muted-foreground mt-1">Ronda {roundCodigo}</p>
        )}
        <p className="text-sm text-muted-foreground mt-2">{mensaje}</p>
        {!aprobado && (
          <p className="text-xs text-warning font-medium mt-3 px-2 leading-relaxed">
            La repetición es en campo (volver a abordar el módulo), no desde esta pantalla.
          </p>
        )}
      </div>

      <div className="rounded-2xl border bg-muted/30 p-4 sm:p-5 space-y-4 text-sm mb-6">
        <section>
          <h3 className="text-[11px] font-bold uppercase text-muted-foreground mb-2">Módulo</h3>
          <ul className="space-y-1.5">
            <li className="flex justify-between gap-2">
              <span>Casas visitadas</span>
              <strong>
                {summary.visitadas} / {summary.totalCasas}
              </strong>
            </li>
            <li className="flex justify-between gap-2 text-success">
              <span>Casas efectivas (E)</span>
              <strong>{summary.efectivas}</strong>
            </li>
            <li className="flex justify-between gap-2">
              <span>No efectivas (N)</span>
              <strong>{summary.noEfectivas}</strong>
            </li>
            <li className="flex justify-between gap-2">
              <span>Fallidas (F)</span>
              <strong>{summary.fallidas}</strong>
            </li>
            <li className="flex justify-between gap-2">
              <span>Renuentes (R)</span>
              <strong>{summary.renuentes}</strong>
            </li>
          </ul>
        </section>

        <section className="pt-3 border-t">
          <h3 className="text-[11px] font-bold uppercase text-muted-foreground mb-2">Niños encuestados</h3>
          <ul className="space-y-1.5">
            <li className="flex justify-between gap-2">
              <span>Total registrados</span>
              <strong>{summary.totalNinos}</strong>
            </li>
            <li className="flex justify-between gap-2 text-success">
              <span>Vacunados</span>
              <strong>{summary.vacunados}</strong>
            </li>
            <li className="flex justify-between gap-2 text-destructive">
              <span>No vacunados</span>
              <strong>{summary.noVacunados}</strong>
            </li>
            <li className="flex justify-between gap-2 pt-2 border-t border-dashed">
              <span className="font-semibold">Cobertura vacunal</span>
              <strong className={aprobado ? 'text-success' : 'text-destructive'}>
                {coberturaVacunacion != null ? `${coberturaVacunacion}%` : 'Sin datos'}
              </strong>
            </li>
            <li className="text-[10px] text-muted-foreground">
              Meta de aprobación: ≥ {UMBRAL_COBERTURA_APROBADO}% en casas con niño/a registrado.
            </li>
          </ul>
        </section>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onExportExcel} className="mrv-btn-ghost border-primary text-primary">
            <FileSpreadsheet className="w-5 h-5 inline mr-1" />
            Excel
          </button>
          <button type="button" onClick={onExportPdf} className="mrv-btn-ghost border-primary text-primary">
            <FileText className="w-5 h-5 inline mr-1" />
            PDF
          </button>
        </div>
        <button type="button" onClick={onNuevaRonda} className="mrv-btn-primary">
          <RotateCcw className="w-5 h-5" />
          Cerrar e iniciar otra ronda
        </button>
      </div>
    </div>
  );
}
