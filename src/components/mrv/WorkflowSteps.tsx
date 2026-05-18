import { WORKFLOW_STEPS } from '@/lib/mrv-constants';
import { Check } from 'lucide-react';

interface Props {
  currentStep: number;
  maxReachable: number;
  onStepClick?: (step: number) => void;
}

/**
 * Pasos completados = todo lo anterior a `maxReachable` (primer paso aún pendiente).
 * El paso resaltado = `currentStep` (navegación manual); la barra refleja `maxReachable`.
 */
export default function WorkflowSteps({ currentStep, maxReachable, onStepClick }: Props) {
  const total = WORKFLOW_STEPS.length;
  const progressPct =
    total <= 1 ? 0 : Math.min(100, Math.max(0, Math.round(((maxReachable - 1) / (total - 1)) * 100)));

  return (
    <div className="mb-3 rounded-2xl border bg-card p-3 shadow-sm overflow-x-auto">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground shrink-0">
          Avance
        </span>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden" aria-hidden>
          <div
            className="h-full max-w-full rounded-full bg-[#0055A4] transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="sr-only">
          Avance del formulario según datos ingresados: {progressPct} por ciento
        </span>
        <span className="text-[10px] font-bold tabular-nums text-muted-foreground shrink-0 w-8 text-right">
          {progressPct}%
        </span>
      </div>

      <div className="flex gap-1 min-w-max">
        {WORKFLOW_STEPS.map((step) => {
          const completed = step.id < maxReachable;
          const active = step.id === currentStep;
          const reachable = step.id <= maxReachable;
          return (
            <button
              key={step.id}
              type="button"
              disabled={!reachable || !onStepClick}
              onClick={() => onStepClick?.(step.id)}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-all min-w-[52px] ${
                active && !completed
                  ? 'bg-[#0055A4] text-white shadow-md scale-105'
                  : active && completed
                    ? 'bg-success/20 text-success ring-2 ring-[#0055A4] ring-offset-2 ring-offset-card'
                    : completed
                      ? 'bg-success/15 text-success'
                      : reachable
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-muted/50 text-muted-foreground opacity-50'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  active && !completed
                    ? 'bg-white/25'
                    : completed
                      ? 'bg-success text-success-foreground'
                      : 'bg-background/80'
                }`}
              >
                {completed ? <Check className="w-3.5 h-3.5" /> : step.id}
              </span>
              <span className="text-[9px] font-bold uppercase leading-tight text-center">{step.short}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
