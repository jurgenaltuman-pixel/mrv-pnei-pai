import * as React from 'react';
import { MOTIVOS_NO_VACUNACION } from '@/types/mrv';
import {
  FUENTES_VERIFICACION,
  ACCIONES_TOMADAS,
  type FuenteVerificacion,
  type AccionTomada,
} from '@/lib/mrv-constants';
import { Check, X, ShieldAlert, Syringe, ChevronRight } from 'lucide-react';

interface Props {
  visible: boolean;
  stepLabel: string;
  stepNumber: number;
  fuenteVerificacion: FuenteVerificacion | '';
  setFuenteVerificacion: (v: FuenteVerificacion) => void;
  libreta: boolean | null;
  setLibreta: (v: boolean) => void;
  tieneCvs: boolean | null;
  setTieneCvs: (v: boolean | null) => void;
  estadoVacuna: 'vacunado' | 'no_vacunado' | null;
  setEstadoVacuna: (v: 'vacunado' | 'no_vacunado') => void;
  dosisSpr: 'primera' | 'segunda' | 'adicional' | null;
  setDosisSpr: (v: 'primera' | 'segunda' | 'adicional' | null) => void;
  fechaSpr: string;
  setFechaSpr: (v: string) => void;
  fechaSprValida: boolean;
  motivo: string;
  setMotivo: (v: string) => void;
  esquemaCompleto: boolean | null;
  setEsquemaCompleto: (v: boolean) => void;
  accionTomada: AccionTomada | '';
  setAccionTomada: (v: AccionTomada) => void;
  rechazoVacunacion: boolean;
  setRechazoVacunacion: (v: boolean) => void;
  visitaSinDatosNino?: boolean;
  subStep?: 'validacion' | 'evaluacion' | 'justificacion' | 'intervencion' | 'all';
}

export default function VaccinationSection(props: Props) {
  if (!props.visible) return null;

  const elegibleIntervencion =
    props.tieneCvs === false || props.estadoVacuna === 'no_vacunado';

  React.useEffect(() => {
    if (props.dosisSpr === 'segunda' || props.dosisSpr === 'adicional') {
      props.setEsquemaCompleto(true);
    } else if (props.dosisSpr === 'primera') {
      props.setEsquemaCompleto(false);
    }
  }, [props.dosisSpr]);

  React.useEffect(() => {
    if (props.rechazoVacunacion) {
      props.setAccionTomada('rechazo_definitivo');
      props.setEstadoVacuna('no_vacunado');
      props.setTieneCvs(false);
      props.setEsquemaCompleto(false);
      if (!props.motivo.includes('rechaz')) {
        props.setMotivo('Los padres rechazaron la vacunación');
      }
    }
  }, [props.rechazoVacunacion]);

  const handleTieneCvs = (tiene: boolean) => {
    props.setTieneCvs(tiene);
    props.setRechazoVacunacion(false);
    if (tiene) {
      props.setEstadoVacuna('vacunado');
    } else {
      props.setEstadoVacuna('no_vacunado');
      props.setEsquemaCompleto(false);
      props.setDosisSpr(null);
      props.setFechaSpr('');
    }
  };

  return (
    <div className="section-card border-l-4 border-l-primary">
      <div className="section-title">
        <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
          {props.stepNumber}
        </span>
        {props.stepLabel}
      </div>

      {!props.visitaSinDatosNino && (props.subStep === 'validacion' || props.subStep === 'all' || !props.subStep) && (
        <div className="space-y-3 pb-4 border-b mb-4">
          <div>
            <label className="field-label flex items-center gap-1">
              Fuente de verificación <span className="text-destructive font-bold">*</span>
            </label>
            <select
              value={props.fuenteVerificacion}
              onChange={(e) => props.setFuenteVerificacion(e.target.value as FuenteVerificacion)}
              className="w-full h-11 px-3 rounded-lg border bg-background text-sm font-medium"
            >
              <option value="">Seleccionar fuente...</option>
              {FUENTES_VERIFICACION.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">¿Presenta libreta o registro de vacunación?</label>
            <div className="flex gap-2 mt-1">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => props.setLibreta(v)}
                  className={`flex-1 h-10 rounded-lg font-semibold text-sm transition-colors ${
                    props.libreta === v
                      ? v
                        ? 'bg-success text-success-foreground shadow-sm'
                        : 'bg-destructive text-destructive-foreground shadow-sm'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {v ? 'Sí' : 'No'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!props.visitaSinDatosNino && (props.subStep === 'evaluacion' || props.subStep === 'all' || !props.subStep) && (
        <div className="space-y-3 pb-4 border-b mb-4">
          <label className="field-label flex items-center gap-1">
            ¿Tiene la dosis CVS (SPR) aplicada? <span className="text-destructive font-bold">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleTieneCvs(true)}
              className={`btn-vacunado h-auto py-3 ${props.tieneCvs === true ? 'ring-4 ring-success/30' : 'opacity-70'}`}
            >
              <Check className="w-5 h-5" /> SÍ tiene CVS
            </button>
            <button
              type="button"
              onClick={() => handleTieneCvs(false)}
              className={`btn-no-vacunado h-auto py-3 ${props.tieneCvs === false ? 'ring-4 ring-destructive/30' : 'opacity-70'}`}
            >
              <X className="w-5 h-5" /> NO tiene CVS
            </button>
          </div>

          {props.tieneCvs === true && (
            <div className="mt-3 space-y-3 p-3 rounded-xl bg-muted/40 border">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Fecha dosis SPR</p>
              <p className="text-[11px] text-muted-foreground -mt-2">
                Confirme esquema (2 dosis previas) o dosis en campaña (09 mar – 29 may 2026)
              </p>
              <div>
                <label className="field-label">Tipo de dosis</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['primera', 'segunda', 'adicional'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => props.setDosisSpr(d)}
                      className={`h-10 rounded-lg font-semibold text-sm ${
                        props.dosisSpr === d ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                      }`}
                    >
                      {d === 'primera' ? '1ra' : d === 'segunda' ? '2da' : 'Adic.'}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="date"
                value={props.fechaSpr}
                onChange={(e) => props.setFechaSpr(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
              />
              {props.fechaSpr && (
                <p className={`text-xs font-medium ${props.fechaSprValida ? 'text-success' : 'text-warning'}`}>
                  {props.fechaSprValida
                    ? '✓ Fecha dentro del periodo de campaña CVS'
                    : 'Fecha fuera de campaña — puede corresponder a esquema previo'}
                </p>
              )}
              <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-sm font-semibold text-success">
                Esquema: {props.esquemaCompleto ? 'Completo (2+ dosis)' : 'Incompleto'}
              </div>
            </div>
          )}
        </div>
      )}

      {!props.visitaSinDatosNino && (props.subStep === 'justificacion' || props.subStep === 'all' || !props.subStep) && props.tieneCvs === false && (
        <div className="space-y-3 pb-4 border-b mb-4">
          <label className="field-label flex items-center gap-1">
            ¿Por qué no tiene la dosis CVS? <span className="text-destructive font-bold">*</span>
          </label>
          <select
            value={props.motivo}
            onChange={(e) => props.setMotivo(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border bg-background text-sm"
            disabled={props.rechazoVacunacion}
          >
            <option value="">Seleccionar motivo...</option>
            {MOTIVOS_NO_VACUNACION.map((m, i) => (
              <option key={m} value={m}>{i + 1}. {m}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => props.setRechazoVacunacion(!props.rechazoVacunacion)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
              props.rechazoVacunacion
                ? 'border-destructive bg-destructive/10 text-destructive'
                : 'border-border bg-card hover:border-destructive/50'
            }`}
          >
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <div className="text-left flex-1">
              <p className="font-bold text-sm">Rechazo a la vacunación</p>
              <p className="text-[11px] opacity-80 font-normal">
                Casa efectiva — se registra el abordaje sin aplicar dosis
              </p>
            </div>
            {props.rechazoVacunacion && <Check className="w-5 h-5" />}
          </button>
        </div>
      )}

      {!props.visitaSinDatosNino && (props.subStep === 'intervencion' || props.subStep === 'all' || !props.subStep) && elegibleIntervencion && (
        <div className="space-y-3">
          <label className="field-label flex items-center gap-1">
            Acción tomada (niño/a elegible) <span className="text-destructive font-bold">*</span>
          </label>
          <div className="space-y-2">
            {ACCIONES_TOMADAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  props.setAccionTomada(a.id);
                  if (a.id === 'rechazo_definitivo') props.setRechazoVacunacion(true);
                  if (a.id === 'vacunado_visita') {
                    props.setEstadoVacuna('vacunado');
                    props.setTieneCvs(true);
                  }
                }}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-start gap-3 ${
                  props.accionTomada === a.id
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border bg-card'
                }`}
              >
                <Syringe className={`w-5 h-5 shrink-0 mt-0.5 ${props.accionTomada === a.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{a.label}</p>
                  <p className="text-[11px] text-muted-foreground">{a.hint}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
