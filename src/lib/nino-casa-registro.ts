import type { RegistroEditFields } from '@/components/mrv/RegistroEditDialog';
import type { NinoCasa } from '@/types/round-monitoring';
import type { RoundMonitoring } from '@/types/round-monitoring';
import { etiquetaRondaEnObservaciones } from '@/lib/round-codigo';

export function ninoToRegistroEditFields(
  n: NinoCasa,
  round: Pick<RoundMonitoring, 'region' | 'distrito' | 'servicio' | 'barrio' | 'responsable' | 'codigo'>,
  casaNumero: number
): RegistroEditFields {
  return {
    id: n.registroId || '',
    nombre: n.nombre,
    documento: n.documento,
    region: round.region,
    distrito: round.distrito,
    servicio: round.servicio || '',
    barrio: round.barrio,
    estado_vacunacion: n.vacunado ? 'vacunado' : 'no_vacunado',
    motivo: n.motivo || '',
    observaciones: etiquetaRondaEnObservaciones(round.codigo, casaNumero),
    responsable: round.responsable || '',
  };
}

export function patchFromRegistroEdit(
  patch: Record<string, unknown>,
  n: NinoCasa
): Partial<NinoCasa> {
  const ev = String(patch.estado_vacuna ?? patch.estado_vacunacion ?? '');
  const vacunado = ev === 'vacunado';
  return {
    nombre: String(patch.nombre ?? n.nombre),
    documento: String(patch.documento ?? n.documento),
    vacunado,
    dosisSpr: vacunado ? (n.dosisSpr === '2plus' ? '2plus' : '1') : n.dosisSpr,
    motivo: (patch.motivo as string) ?? n.motivo,
  };
}
