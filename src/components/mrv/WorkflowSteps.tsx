import { WORKFLOW_STEPS } from '@/lib/mrv-constants';
import { Check } from 'lucide-react';

interface Props {
  currentStep: number;
  maxReachable: number;
  onStepClick?: (step: number) => void;
}

export default function WorkflowSteps({ currentStep, maxReachable, onStepClick }: Props) {
  return (
    <div className="mb-3 rounded-2xl border bg-card p-3 shadow-sm overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {WORKFLOW_STEPS.map((step) => {
          const done = step.id < currentStep;
          const active = step.id === currentStep;
          const reachable = step.id <= maxReachable;
          return (
            <button
              key={step.id}
              type="button"
              disabled={!reachable || !onStepClick}
              onClick={() => onStepClick?.(step.id)}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-all min-w-[52px] ${
                active
                  ? 'bg-primary text-primary-foreground shadow-md scale-105'
                  : done
                    ? 'bg-success/15 text-success'
                    : reachable
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-muted/50 text-muted-foreground opacity-50'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  active ? 'bg-white/25' : done ? 'bg-success text-success-foreground' : 'bg-background/80'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : step.id}
              </span>
              <span className="text-[9px] font-bold uppercase leading-tight text-center">{step.short}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
