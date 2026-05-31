import { X, CalendarClock, ImageIcon, Home, CheckCircle2 } from 'lucide-react';
import type { FridayAlertas } from '@/lib/friday-reminder';
import { buildFridayAlertMessage, fridayAlertNeedsAttention } from '@/lib/friday-reminder';

interface Props {
  alertas: FridayAlertas;
  onDismissTemporary: () => void;
  onConfirmProcessed: () => void;
}

export default function FridayReminderBanner({
  alertas,
  onDismissTemporary,
  onConfirmProcessed,
}: Props) {
  if (!fridayAlertNeedsAttention(alertas)) return null;

  return (
    <div
      role="alert"
      className="mx-3 mt-2 rounded-xl border border-violet-400/60 bg-violet-50 dark:bg-violet-950/40 px-3 py-2.5 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <CalendarClock className="w-5 h-5 text-violet-700 dark:text-violet-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm font-bold text-violet-900 dark:text-violet-100">
            Recordatorio de viernes
          </p>
          <p className="text-xs text-violet-900/90 dark:text-violet-100/90">
            {buildFridayAlertMessage(alertas)}
          </p>
          <ul className="text-[11px] space-y-0.5 text-violet-800 dark:text-violet-200">
            {alertas.pendientesTranscripcion > 0 && (
              <li className="flex items-center gap-1">
                <ImageIcon className="w-3 h-3" />
                Completá la transcripción en registros con fotos en Drive.
              </li>
            )}
            {alertas.cambiosResidencia > 0 && (
              <li className="flex items-center gap-1">
                <Home className="w-3 h-3" />
                Revisá los casos con cambio de residencia en el dashboard.
              </li>
            )}
          </ul>

          <div className="rounded-lg border border-violet-300/50 bg-white/60 dark:bg-black/20 p-2 space-y-2">
            <p className="text-[11px] font-semibold text-violet-900 dark:text-violet-100">
              ¿Ya procesaste estos pendientes?
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onConfirmProcessed}
                className="h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Sí, ya procesé
              </button>
              <button
                type="button"
                onClick={onDismissTemporary}
                className="h-8 px-3 rounded-md border bg-background text-[11px] font-medium text-muted-foreground"
              >
                Ahora no
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Si elegís «Ahora no» o cerrás sin confirmar, el recordatorio volverá al abrir la app hoy.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismissTemporary}
          className="shrink-0 p-1 rounded-md hover:bg-violet-200/60 dark:hover:bg-violet-800/60"
          aria-label="Cerrar por ahora"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
