import type { AccionTomada, FuenteVerificacion } from '@/lib/mrv-constants';
import { esCodigoTemporal, validarFormatoCodigoTemporal } from '@/lib/temp-code-rve';
import type { NinoCasa } from '@/types/round-monitoring';

/** Campos del formulario MRV usados al añadir/editar un niño en casa E. */
export interface NinoCasaFormState {
  nombre: string;
  documento: string;
  sinDocumento: boolean;
  fechaNacimiento: string;
  sexo: string;
  estadoVacuna: 'vacunado' | 'no_vacunado' | null;
  dosisMonitoreo: '1' | '2plus' | null;
  rechazoVacunacion: boolean;
  motivo: string;
  accionTomada: AccionTomada | '';
  fuenteVerificacion: FuenteVerificacion | '';
  libreta: boolean | null;
  esquemaCompleto: boolean | null;
  cambioResidencia: boolean;
}

export type NinoCasaFormSetters = {
  [K in keyof NinoCasaFormState]: (v: NinoCasaFormState[K]) => void;
} & {
  setWorkflowStep: (n: number) => void;
};

export function aplicarNinoCasaAlFormulario(n: NinoCasa, set: NinoCasaFormSetters): void {
  set.setNombre(n.nombre);
  set.setDocumento(n.documento);
  set.setSinDocumento(n.tipo_documento === 'DEX' || validarFormatoCodigoTemporal(n.documento));
  set.setFechaNacimiento(n.fecha_nacimiento);
  set.setSexo(n.sexo);
  set.setEstadoVacuna(n.vacunado ? 'vacunado' : 'no_vacunado');
  set.setDosisMonitoreo(n.vacunado ? n.dosisSpr : null);
  set.setRechazoVacunacion(n.rechazoVacunacion);
  set.setMotivo(n.motivo || '');
  set.setAccionTomada((n.accionTomada as AccionTomada) || '');
  set.setFuenteVerificacion((n.fuenteVerificacion as FuenteVerificacion) || '');
  set.setLibreta(n.libreta ?? null);
  set.setEsquemaCompleto(n.esquemaCompleto ?? null);
  set.setCambioResidencia(n.cambioResidencia ?? false);
  set.setWorkflowStep(1);
}

export function ninoCasaDesdeFormulario(
  form: NinoCasaFormState,
  edadTexto: string | null,
  opts?: { id?: string; registroId?: string | null }
): NinoCasa | null {
  if (!form.estadoVacuna) return null;
  return {
    id: opts?.id ?? crypto.randomUUID(),
    registroId: opts?.registroId ?? null,
    nombre: form.nombre.trim(),
    tipo_documento: form.sinDocumento ? 'DEX' : 'CI',
    documento: form.documento.trim(),
    fecha_nacimiento: form.fechaNacimiento,
    sexo: form.sexo,
    edadTexto,
    dosisSpr: form.estadoVacuna === 'vacunado' && form.dosisMonitoreo ? form.dosisMonitoreo : '1',
    vacunado: form.estadoVacuna === 'vacunado',
    motivo:
      form.estadoVacuna === 'no_vacunado'
        ? form.rechazoVacunacion
          ? 'Rechazo a la vacunación'
          : form.motivo.trim() || null
        : null,
    rechazoVacunacion: form.estadoVacuna === 'no_vacunado' && form.rechazoVacunacion,
    accionTomada:
      form.estadoVacuna === 'no_vacunado' && !form.rechazoVacunacion ? form.accionTomada || null : null,
    cambioResidencia: form.cambioResidencia || undefined,
    libreta: form.fuenteVerificacion === 'libreta',
    fuenteVerificacion: form.fuenteVerificacion || undefined,
    esquemaCompleto: form.estadoVacuna === 'vacunado' ? (form.esquemaCompleto ?? false) : false,
    tieneCvs: form.estadoVacuna === 'vacunado',
  };
}
