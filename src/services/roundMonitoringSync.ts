import { offlineCache } from '@/services/offlineCache';
import { dataService } from '@/services/dataService';
import * as adminApi from '@/services/adminApi';
import type { CasaMonitoreo, NinoCasa, RoundMonitoring } from '@/types/round-monitoring';
import { estadoCodeToDb } from '@/lib/croquis-housing';
import { etiquetaRondaEnObservaciones } from '@/lib/round-codigo';

export interface SyncCasaResult {
  ok: number;
  fail: number;
  visitaRegistroId?: string | null;
  ninoRegistroIds?: Record<string, string>;
}

function obsRonda(round: RoundMonitoring, casaNumero: number, extra = ''): string {
  const tag = etiquetaRondaEnObservaciones(round.codigo, casaNumero);
  return extra ? `${tag} · ${extra}` : tag;
}

function buildVisitaPayload(
  round: RoundMonitoring,
  casa: CasaMonitoreo,
): Record<string, unknown> | null {
  if (!casa.estado || !casa.guardada) return null;
  const tipo = estadoCodeToDb(casa.estado);
  const lat = casa.latitud;
  const lng = casa.longitud;

  if (casa.estado === 'F' || casa.estado === 'R' || casa.estado === 'N') {
    if (casa.ninos.length === 0) {
      const labels = {
        N: { nombre: 'Visita N — no efectiva', doc: 'VISITA-N', motivo: 'Visita N: no efectiva abierta' },
        F: {
          nombre: 'Visita F — fallida',
          doc: 'VISITA-F',
          motivo: 'Visita F: cerrada con o sin niños / sin responsable',
        },
        R: { nombre: 'Visita R — renuente', doc: 'VISITA-R', motivo: 'Visita R: renuente rechazo' },
      }[casa.estado];
      return {
        user_id: round.userId,
        region: round.region,
        distrito: round.distrito,
        servicio: round.servicio,
        barrio: round.barrio,
        responsable: round.responsable,
        nombre: labels.nombre,
        documento: `${labels.doc}-${casa.numero}-${round.codigo}`,
        fecha_nacimiento: '2020-01-01',
        edad: null,
        sexo: 'M',
        libreta: false,
        estado_vacuna: 'no_vacunado',
        motivo: `${labels.motivo} · ${round.moduloLabel}`,
        latitud: lat,
        longitud: lng,
        tipo_vivienda: tipo,
        esquema_completo: false,
        observaciones: obsRonda(round, casa.numero),
      };
    }
  }

  return null;
}

function buildNinoPayload(round: RoundMonitoring, casa: CasaMonitoreo, n: NinoCasa): Record<string, unknown> {
  return {
    user_id: round.userId,
    region: round.region,
    distrito: round.distrito,
    servicio: round.servicio,
    barrio: round.barrio,
    responsable: round.responsable,
    nombre: n.nombre,
    documento: n.documento,
    fecha_nacimiento: n.fecha_nacimiento,
    edad: n.edadTexto,
    sexo: n.sexo,
    tipo_documento: n.tipo_documento,
    libreta: n.libreta ?? true,
    fuente_verificacion: n.fuenteVerificacion ?? null,
    estado_vacuna: n.vacunado ? 'vacunado' : 'no_vacunado',
    motivo: n.vacunado
      ? `SPR: ${n.dosisSpr === '2plus' ? '2 o más dosis' : 'Primera dosis (vacunado)'}`
      : n.motivo || 'No vacunado — monitoreo casa',
    estado_intervencion: n.rechazoVacunacion ? 'rechazo_vacunacion' : null,
    accion_tomada: n.accionTomada,
    latitud: casa.latitud,
    longitud: casa.longitud,
    tipo_vivienda: estadoCodeToDb(casa.estado!),
    esquema_completo: n.esquemaCompleto ?? n.vacunado,
    tiene_cvs: n.tieneCvs ?? n.vacunado,
    dosis_spr: n.dosisSpr === '2plus' ? 'segunda' : 'primera',
    fecha_dosis_spr: null,
    observaciones: [
      n.cambioResidencia ? '[Cambio de residencia]' : '',
      obsRonda(round, casa.numero, round.moduloLabel),
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

async function guardarPayload(
  payload: Record<string, unknown>,
  isOnline: boolean
): Promise<{ ok: boolean; id?: string }> {
  if (isOnline) {
    const res = await dataService.guardarRegistro(
      payload as Parameters<typeof dataService.guardarRegistro>[0]
    );
    if (res.ok) return { ok: true, id: res.id };
    try {
      await offlineCache.savePending(payload);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
  try {
    await offlineCache.savePending(payload);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function syncCasaGuardada(
  round: RoundMonitoring,
  casa: CasaMonitoreo,
  isOnline: boolean
): Promise<SyncCasaResult> {
  let ok = 0;
  let fail = 0;
  let visitaRegistroId: string | null | undefined;
  const ninoRegistroIds: Record<string, string> = {};

  const visita = buildVisitaPayload(round, casa);
  if (visita) {
    const res = await guardarPayload(visita, isOnline);
    if (res.ok) {
      ok++;
      if (res.id) visitaRegistroId = res.id;
    } else fail++;
    return { ok, fail, visitaRegistroId, ninoRegistroIds };
  }

  for (const n of casa.ninos) {
    const payload = buildNinoPayload(round, casa, n);
    const res = await guardarPayload(payload, isOnline);
    if (res.ok) {
      ok++;
      if (res.id) ninoRegistroIds[n.id] = res.id;
    } else fail++;
  }

  return { ok, fail, visitaRegistroId, ninoRegistroIds };
}

/** Actualiza registros ya guardados (casa editada o corrección). */
export async function syncCasaActualizada(
  round: RoundMonitoring,
  casa: CasaMonitoreo,
  isOnline: boolean,
  asAdmin: boolean
): Promise<SyncCasaResult> {
  if (!isOnline) {
    return { ok: 0, fail: 1 };
  }

  let ok = 0;
  let fail = 0;
  const tipo = casa.estado ? estadoCodeToDb(casa.estado) : null;

  const patchOne = async (registroId: string, patch: Record<string, unknown>) => {
    const err = asAdmin
      ? await adminApi.patchRegistro(registroId, patch)
      : await adminApi.patchOwnRegistro(registroId, patch);
    if (err) fail++;
    else ok++;
  };

  if (casa.visitaRegistroId && tipo) {
    await patchOne(casa.visitaRegistroId, {
      tipo_vivienda: tipo,
      latitud: casa.latitud,
      longitud: casa.longitud,
      observaciones: obsRonda(round, casa.numero),
    });
    return { ok, fail, visitaRegistroId: casa.visitaRegistroId, ninoRegistroIds: {} };
  }

  for (const n of casa.ninos) {
    if (!n.registroId) {
      const payload = buildNinoPayload(round, casa, n);
      const res = await guardarPayload(payload, isOnline);
      if (res.ok) {
        ok++;
        if (res.id) n.registroId = res.id;
      } else fail++;
      continue;
    }
    await patchOne(n.registroId, {
      nombre: n.nombre,
      documento: n.documento,
      estado_vacuna: n.vacunado ? 'vacunado' : 'no_vacunado',
      motivo: n.vacunado
        ? `SPR: ${n.dosisSpr === '2plus' ? '2 o más dosis' : 'Primera dosis (vacunado)'}`
        : n.motivo || 'No vacunado — monitoreo casa',
      tipo_vivienda: tipo,
      latitud: casa.latitud,
      longitud: casa.longitud,
      observaciones: [
        n.cambioResidencia ? '[Cambio de residencia]' : '',
        obsRonda(round, casa.numero, round.moduloLabel),
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }

  const ninoRegistroIds: Record<string, string> = {};
  for (const n of casa.ninos) {
    if (n.registroId) ninoRegistroIds[n.id] = n.registroId;
  }
  return { ok, fail, visitaRegistroId: casa.visitaRegistroId, ninoRegistroIds };
}

export function applySyncIdsToCasa(casa: CasaMonitoreo, sync: SyncCasaResult): CasaMonitoreo {
  return {
    ...casa,
    visitaRegistroId: sync.visitaRegistroId ?? casa.visitaRegistroId ?? null,
    ninos: casa.ninos.map((n) => ({
      ...n,
      registroId: sync.ninoRegistroIds?.[n.id] ?? n.registroId ?? null,
    })),
  };
}

export function roundToCsv(round: RoundMonitoring): string {
  const lines = [
    'ronda_id,ronda_codigo,modulo,casa,estado,nino,documento,dosis,vacunado,lat,lng,fecha',
    ...round.casas.flatMap((c) => {
      if (!c.guardada || !c.estado) return [];
      if (c.ninos.length === 0) {
        return [
          [
            round.id,
            round.codigo,
            round.moduloLabel,
            c.numero,
            c.estado,
            '',
            '',
            '',
            '',
            c.latitud ?? '',
            c.longitud ?? '',
            c.guardadaAt ? new Date(c.guardadaAt).toISOString() : '',
          ].join(','),
        ];
      }
      return c.ninos.map((n) =>
        [
          round.id,
          round.codigo,
          round.moduloLabel,
          c.numero,
          c.estado,
          `"${n.nombre.replace(/"/g, '""')}"`,
          n.documento,
          n.dosisSpr,
          n.vacunado ? 'si' : 'no',
          c.latitud ?? '',
          c.longitud ?? '',
          c.guardadaAt ? new Date(c.guardadaAt).toISOString() : '',
        ].join(',')
      );
    }),
  ];
  return lines.join('\n');
}
