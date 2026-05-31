/** Alertas del recordatorio semanal (viernes). */
export interface FridayAlertas {
  pendientesTranscripcion: number;
  cambiosResidencia: number;
}

const STORAGE_PROCESSED_PREFIX = 'mrv_friday_processed_';

/** Viernes en hora Paraguay (America/Asuncion). */
export function isFridayInParaguay(d = new Date()): boolean {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Asuncion',
    weekday: 'short',
  }).format(d);
  return wd === 'Fri';
}

export function fridayWeekKey(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${day}`;
}

/** El usuario confirmó que ya procesó los pendientes de este viernes. */
export function isFridayReminderProcessed(d = new Date()): boolean {
  try {
    return localStorage.getItem(STORAGE_PROCESSED_PREFIX + fridayWeekKey(d)) === '1';
  } catch {
    return false;
  }
}

export function markFridayReminderProcessed(d = new Date()): void {
  try {
    localStorage.setItem(STORAGE_PROCESSED_PREFIX + fridayWeekKey(d), '1');
  } catch {
    /* ignore */
  }
}

export function buildFridayAlertMessage(a: FridayAlertas): string {
  const parts: string[] = [];
  if (a.pendientesTranscripcion > 0) {
    parts.push(
      `${a.pendientesTranscripcion} registro(s) con foto(s) sin transcripción (últimos 7 días)`
    );
  }
  if (a.cambiosResidencia > 0) {
    parts.push(`${a.cambiosResidencia} cambio(s) de residencia marcados (últimos 7 días)`);
  }
  if (parts.length === 0) {
    return 'Sin pendientes de transcripción ni cambios de residencia en la última semana.';
  }
  return parts.join(' · ');
}

export function fridayAlertNeedsAttention(a: FridayAlertas): boolean {
  return a.pendientesTranscripcion > 0 || a.cambiosResidencia > 0;
}

/** Desde listado local (offline / caché). */
export function countFridayAlertasFromRegistros(
  registros: {
    transcripcion_clip?: string | null;
    enlace_imagen_1?: string | null;
    enlace_imagen_2?: string | null;
    observaciones?: string | null;
    fecha_hora?: string | null;
  }[]
): FridayAlertas {
  const desde = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let pendientesTranscripcion = 0;
  let cambiosResidencia = 0;
  for (const r of registros) {
    const t = r.fecha_hora ? new Date(r.fecha_hora).getTime() : 0;
    if (t && t < desde) continue;
    const tieneImg = Boolean(
      String(r.enlace_imagen_1 || '').trim() || String(r.enlace_imagen_2 || '').trim()
    );
    const sinTrans = !String(r.transcripcion_clip || '').trim();
    if (tieneImg && sinTrans) pendientesTranscripcion += 1;
    if (String(r.observaciones || '').includes('[Cambio de residencia]')) {
      cambiosResidencia += 1;
    }
  }
  return { pendientesTranscripcion, cambiosResidencia };
}
