/** Historial de vacunación SPR desde nómina nominal o visitas MRV */

export interface PadronSprDosis {
  numero?: number;
  fecha?: string | null;
  vacuna?: string | null;
  /** Lugar / servicio donde se aplicó la dosis (columna spr_*_servicio). */
  lugar_vacunacion?: string | null;
  vacunador?: string | null;
  observacion?: string | null;
}

/** Extrae lugar y vacunador desde campos estructurados o texto legacy en observacion. */
export function normalizePadronSprDosis(d: PadronSprDosis): PadronSprDosis {
  let lugar = d.lugar_vacunacion?.trim() || null;
  let vacunador = d.vacunador?.trim() || null;
  const obs = d.observacion?.trim();
  if (obs) {
    const vacMatch = obs.match(/Vacunador:\s*(.+?)(?:\s*·\s*|$)/i);
    if (vacMatch && !vacunador) vacunador = vacMatch[1].trim();
    if (!lugar) {
      const sinVac = obs
        .split('·')
        .map((p) => p.trim())
        .filter((p) => p && !/^Vacunador:/i.test(p));
      if (sinVac.length) lugar = sinVac.join(' · ');
    }
  }
  return { ...d, lugar_vacunacion: lugar, vacunador };
}

export interface PadronSprHistorialPadron {
  edad_anos?: number | null;
  edad_meses?: number | null;
  esquema_completo?: boolean | null;
  cantidad_dosis?: number | null;
  dosis: PadronSprDosis[];
  resumen?: string | null;
}

export interface HistorialSprVisitaMrv {
  id?: string;
  fecha_hora: string;
  estado_vacuna: string;
  dosis_spr: string | null;
  fecha_dosis_spr: string | null;
  esquema_completo: boolean | null;
  tiene_cvs: boolean | null;
  region: string;
  distrito: string;
  servicio: string | null;
  motivo: string | null;
  responsable: string | null;
}

export interface HistorialSprCompleto {
  documento: string;
  nombre?: string | null;
  padron: PadronSprHistorialPadron | null;
  visitas_mrv: HistorialSprVisitaMrv[];
}

function normKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function pick(row: Record<string, unknown>, ...aliases: string[]): string {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) map.set(normKey(k), v);
  for (const a of aliases) {
    const v = map.get(normKey(a));
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function toInt(v: string): number | null {
  if (!v) return null;
  const n = parseInt(v.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function excelDateToIso(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && value > 20000 && value < 60000) {
    return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s || null;
}

/** «4 anios 1 meses» → años/meses (siempre mostrar «años» en UI) */
export function parseEdadNominalTexto(edadRaw: unknown): { edad_anos: number | null; edad_meses: number | null } {
  if (edadRaw == null || edadRaw === '') return { edad_anos: null, edad_meses: null };
  const s = String(edadRaw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const anosM = s.match(/(\d+)\s*anio/);
  const mesesM = s.match(/(\d+)\s*mes/);
  return {
    edad_anos: anosM ? parseInt(anosM[1], 10) : null,
    edad_meses: mesesM ? parseInt(mesesM[1], 10) : null,
  };
}

/** Construye historial SPR desde columnas del Excel nominal */
export function historialSprFromExcelRow(row: Record<string, unknown>): PadronSprHistorialPadron | null {
  const fromText = parseEdadNominalTexto(row.edad ?? pick(row, 'edad'));
  const edadAnos =
    toInt(pick(row, 'edad_anos', 'edad anos', 'edad_años', 'edad en años', 'años')) ?? fromText.edad_anos;
  const edadMeses =
    toInt(pick(row, 'edad_en_meses', 'edad_meses', 'edad en meses', 'meses')) ?? fromText.edad_meses;

  const dosis: PadronSprDosis[] = [];
  const sprNominal: { n: number; fecha: string; serv: string; vac: string; label: string }[] = [
    { n: 1, fecha: 'spr_1_fecha', serv: 'spr_1_servicio', vac: 'spr_1_vacunador', label: '1.ª dosis SPR' },
    { n: 2, fecha: 'spr_2_fecha', serv: 'spr_2_servicio', vac: 'spr_2_vacunador', label: '2.ª dosis SPR' },
    {
      n: 3,
      fecha: 'spr_6_11m_fecha',
      serv: 'spr_6_11m_servicio',
      vac: 'spr_6_11m_vacunador',
      label: 'SPR 6-11 meses',
    },
    {
      n: 4,
      fecha: 'spr_adicional_fecha',
      serv: 'spr_adicional_servicio',
      vac: 'spr_adicional_vacunador',
      label: 'Dosis adicional SPR',
    },
    { n: 5, fecha: 'spr_oe_fecha', serv: 'spr_oe_servicio', vac: '', label: 'SPR oportunidad especial' },
  ];
  for (const col of sprNominal) {
    const fecha = excelDateToIso(row[col.fecha] ?? pick(row, col.fecha));
    const serv = pick(row, col.serv);
    const vac = col.vac ? pick(row, col.vac) : '';
    if (fecha || serv || vac) {
      const obs = [serv, vac ? `Vacunador: ${vac}` : ''].filter(Boolean).join(' · ');
      dosis.push({
        numero: col.n,
        fecha,
        vacuna: col.label,
        lugar_vacunacion: serv || null,
        vacunador: vac || null,
        observacion: obs || null,
      });
    }
  }

  for (let n = 1; n <= 5; n++) {
    const fecha = excelDateToIso(
      row[`fecha_dosis_spr_${n}`] ??
        row[`fecha_spr_${n}`] ??
        pick(row, `fecha_dosis_spr${n}`, `fecha_spr_${n}`, `fecha vacuna spr ${n}`)
    );
    const vacuna = pick(
      row,
      `dosis_spr_${n}`,
      `spr_${n}`,
      `vacuna_spr_${n}`,
      `dosis ${n} spr`,
      n === 1 ? 'dosis_spr' : '',
      n === 1 ? 'vacuna_spr' : ''
    );
    if (fecha || vacuna) {
      dosis.push({ numero: n, fecha, vacuna: vacuna || 'SPR', observacion: null });
    }
  }

  const fechaUnica = excelDateToIso(
    pick(row, 'fecha_dosis_spr', 'fecha_spr', 'fecha vacuna spr', 'fecha_ultima_dosis_spr')
  );
  const dosisUnica = pick(row, 'dosis_spr', 'cantidad_dosis_spr', 'nro_dosis_spr', 'dosis spr');
  if ((fechaUnica || dosisUnica) && dosis.length === 0) {
    dosis.push({ numero: 1, fecha: fechaUnica, vacuna: dosisUnica || 'SPR' });
  }

  const historialTxt = pick(
    row,
    'historial_spr',
    'historial vacunacion spr',
    'historial_vacunacion',
    'vacunacion_spr',
    'estado_spr',
    'estado_vacunacion_spr'
  );

  const cantidad = toInt(pick(row, 'cantidad_dosis_spr', 'total_dosis_spr', 'dosis_spr_total'));
  const esquemaTxt = pick(row, 'esquema_spr', 'esquema_completo_spr', 'esquema_completo').toLowerCase();
  let esquema: boolean | null = null;
  if (esquemaTxt.includes('complet')) esquema = true;
  if (esquemaTxt.includes('incomplet')) esquema = false;
  if (cantidad != null) esquema = cantidad >= 2;

  if (!edadAnos && !edadMeses && dosis.length === 0 && !historialTxt) return null;

  const resumen =
    historialTxt ||
    (dosis.length > 0
      ? dosis.map((d) => [d.vacuna, d.fecha].filter(Boolean).join(' · ')).join(' | ')
      : null);

  return {
    edad_anos: edadAnos,
    edad_meses: edadMeses,
    esquema_completo: esquema,
    cantidad_dosis: cantidad ?? (dosis.length || null),
    dosis,
    resumen,
  };
}

export function parseHistorialSprDb(raw: unknown): PadronSprHistorialPadron | null {
  if (!raw) return null;
  let parsed: PadronSprHistorialPadron | null = null;
  if (typeof raw === 'object') parsed = raw as PadronSprHistorialPadron;
  else if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as PadronSprHistorialPadron;
    } catch {
      return null;
    }
  }
  if (!parsed?.dosis?.length) return parsed;
  return {
    ...parsed,
    dosis: parsed.dosis.map((d) => normalizePadronSprDosis(d)),
  };
}

/** Texto de edad con «años» (nunca «anios») */
export function formatEdadPersona(
  persona: { edad_anos?: number | null; edad_meses?: number | null; fecha_nacimiento?: string | null },
  fechaNacimientoFallback?: string
): string | null {
  const anos = persona.edad_anos;
  const meses = persona.edad_meses;
  if (anos != null && Number.isFinite(anos)) {
    if (meses != null && meses > 0) return `${anos} años, ${meses} meses`;
    return `${anos} años`;
  }
  const fn = fechaNacimientoFallback || persona.fecha_nacimiento;
  if (!fn) return null;
  const nac = new Date(`${fn}T12:00:00`);
  if (Number.isNaN(nac.getTime())) return null;
  const hoy = new Date();
  let totalMeses = (hoy.getFullYear() - nac.getFullYear()) * 12 + (hoy.getMonth() - nac.getMonth());
  if (hoy.getDate() < nac.getDate()) totalMeses -= 1;
  if (totalMeses < 0) return null;
  const a = Math.floor(totalMeses / 12);
  const m = totalMeses % 12;
  if (a > 0 && m > 0) return `${a} años, ${m} meses`;
  if (a > 0) return `${a} años`;
  return `${m} meses`;
}

export function labelDosisSpr(dosis: string | null | undefined): string {
  if (!dosis) return '—';
  const d = dosis.toLowerCase();
  if (d.includes('segunda') || d.includes('2')) return '2.ª dosis SPR';
  if (d.includes('primera') || d.includes('1')) return '1.ª dosis SPR';
  if (d.includes('adic')) return 'Dosis adicional SPR';
  return dosis;
}
