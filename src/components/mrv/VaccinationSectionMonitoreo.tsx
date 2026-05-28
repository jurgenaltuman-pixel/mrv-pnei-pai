import { ACCIONES_TOMADAS, type AccionTomada } from '@/lib/mrv-constants';
import { esquemaAutomaticoLabel, esquemaFromDosisMonitoreo } from '@/lib/mrv-esquema';
import { MOTIVOS_NO_VACUNACION } from '@/types/mrv';
import { Check, ChevronRight, ClipboardCheck, Hospital, ShieldAlert, Syringe, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ACCION_ICON: Record<AccionTomada, LucideIcon> = {
  vacunado_visita: Syringe,
  derivado_salud: Hospital,
};

interface Props {
  estadoVacuna: 'vacunado' | 'no_vacunado' | null;
  setEstadoVacuna: (v: 'vacunado' | 'no_vacunado') => void;
  dosisMonitoreo: '1' | '2plus' | null;
  setDosisMonitoreo: (v: '1' | '2plus' | null) => void;
  edadTotalMeses?: number | null;
  motivo: string;
  setMotivo: (v: string) => void;
  rechazoVacunacion: boolean;
  setRechazoVacunacion: (v: boolean) => void;
  accionTomada: AccionTomada | '';
  setAccionTomada: (v: AccionTomada) => void;
}

export default function VaccinationSectionMonitoreo({
  estadoVacuna,
  setEstadoVacuna,
  dosisMonitoreo,
  setDosisMonitoreo,
  edadTotalMeses = null,
  motivo,
  setMotivo,
  rechazoVacunacion,
  setRechazoVacunacion,
  accionTomada,
  setAccionTomada,
}: Props) {
  const noVac = estadoVacuna === 'no_vacunado';
  const vac = estadoVacuna === 'vacunado';
  const esquemaAuto = esquemaFromDosisMonitoreo(dosisMonitoreo, edadTotalMeses);

  return (
    <div className="mrv-panel mrv-panel-accent">
      <div className="mrv-panel-header">
        <Syringe className="w-5 h-5 text-primary shrink-0" />
        <span className="mrv-step-pill">Paso 4</span>
        <h3 className="mrv-panel-title">Vacunación</h3>
      </div>

      <label className="field-label">Estado de vacunación</label>
      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2 sm:gap-3 mb-4">
        <button
          type="button"
          onClick={() => {
            setEstadoVacuna('vacunado');
            setRechazoVacunacion(false);
            setMotivo('');
            setAccionTomada('');
          }}
          className={`mrv-choice-btn mrv-choice-success ${vac ? 'mrv-choice-active' : ''}`}
        >
          <Check className="w-6 h-6 shrink-0" />
          <span>Vacunado</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setEstadoVacuna('no_vacunado');
            setDosisMonitoreo(null);
          }}
          className={`mrv-choice-btn mrv-choice-danger ${noVac ? 'mrv-choice-active' : ''}`}
        >
          <X className="w-6 h-6 shrink-0" />
          <span>No vacunado</span>
        </button>
      </div>

      {vac && (
        <div className="space-y-3">
          <label className="field-label">¿Cuántas dosis SPR / Triple Viral tiene?</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setDosisMonitoreo('1');
                setEstadoVacuna('vacunado');
              }}
              className={`mrv-dosis-btn ${dosisMonitoreo === '1' ? 'mrv-dosis-active-success' : ''}`}
            >
              <span className="text-lg font-black">1</span>
              <span className="text-sm font-semibold">Primera dosis</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDosisMonitoreo('2plus');
                setEstadoVacuna('vacunado');
              }}
              className={`mrv-dosis-btn ${dosisMonitoreo === '2plus' ? 'mrv-dosis-active-success' : ''}`}
            >
              <span className="text-lg font-black">2+</span>
              <span className="text-sm font-semibold">Dos o más</span>
            </button>
          </div>

          {dosisMonitoreo && esquemaAuto !== null && (
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border text-sm font-semibold ${
                esquemaAuto
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'bg-warning/10 border-warning/30 text-amber-900 dark:text-amber-100'
              }`}
            >
              <ClipboardCheck className="w-5 h-5 shrink-0" aria-hidden />
              <div className="min-w-0 text-left">
                <p className="text-[10px] uppercase tracking-wide opacity-80 font-bold">Esquema (automático)</p>
                <p>
                  {dosisMonitoreo
                    ? esquemaAutomaticoLabel(esquemaAuto, dosisMonitoreo, edadTotalMeses)
                    : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {noVac && (
        <div className="space-y-3 pt-1 border-t border-dashed">
          <label className="field-label flex items-center gap-1">
            ¿Por qué no está vacunado/a? <span className="text-destructive">*</span>
          </label>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={rechazoVacunacion}
            className="w-full min-h-[48px] px-3 rounded-xl border bg-background text-base font-medium"
          >
            <option value="">Seleccionar motivo…</option>
            {MOTIVOS_NO_VACUNACION.map((m, i) => (
              <option key={m} value={m}>
                {i + 1}. {m}
              </option>
            ))}
          </select>

          {!rechazoVacunacion && (
            <div className="space-y-2">
              <label className="field-label flex items-center gap-1">
                Acción tomada <span className="text-destructive">*</span>
              </label>
              {ACCIONES_TOMADAS.map((a) => {
                const Icon = ACCION_ICON[a.id];
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAccionTomada(a.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-colors flex items-start gap-3 min-h-[56px] touch-manipulation ${
                      accionTomada === a.id
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border bg-card'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        accionTomada === a.id ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{a.label}</p>
                      <p className="text-[11px] text-muted-foreground">{a.hint}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              const next = !rechazoVacunacion;
              setRechazoVacunacion(next);
              if (next) {
                setMotivo('Los padres rechazaron la vacunación');
                setAccionTomada('');
              }
            }}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors min-h-[56px] touch-manipulation ${
              rechazoVacunacion
                ? 'border-destructive bg-destructive/10 text-destructive'
                : 'border-border bg-card'
            }`}
          >
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <div className="text-left flex-1">
              <p className="font-bold text-sm">Rechazo a la vacunación</p>
              <p className="text-[11px] opacity-80 font-normal">Casa efectiva — abordaje sin aplicar dosis</p>
            </div>
          </button>

          <p className="text-xs text-warning font-medium bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
            Un niño no vacunado debe registrarse en casa <strong>Efectiva (E)</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
