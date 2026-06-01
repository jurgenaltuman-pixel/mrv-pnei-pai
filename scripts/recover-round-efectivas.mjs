#!/usr/bin/env node
/**
 * Recupera casas E en borrador desde registros_vacunacion (vacunado → E).
 * Uso: node scripts/recover-round-efectivas.mjs yaniseibarrola17 FATIMA [--apply]
 */
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';

loadEnv();

const needle = (process.argv[2] || 'yaniseibarrola17').toLowerCase();
const moduloHint = (process.argv[3] || 'FATIMA').trim();
const apply = process.argv.includes('--apply');
const META = 20;

function parsePayload(raw) {
  if (!raw) return null;
  return typeof raw === 'object' ? raw : JSON.parse(String(raw));
}

function countE(casas) {
  return (casas || []).filter((c) => c.guardada && c.estado === 'E').length;
}

function parseCasaNum(obs) {
  const m = String(obs || '').match(/Casa\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

function registroToNino(r) {
  const vacunado = r.estado_vacuna === 'vacunado';
  return {
    id: r.id,
    registroId: r.id,
    nombre: r.nombre,
    tipo_documento: r.tipo_documento || 'cedula',
    documento: r.documento,
    fecha_nacimiento: r.fecha_nacimiento ? String(r.fecha_nacimiento).slice(0, 10) : '',
    sexo: r.sexo || '',
    edadTexto: r.edad || null,
    dosisSpr: vacunado ? '1' : '1',
    vacunado,
    motivo: r.motivo || null,
    rechazoVacunacion: false,
    accionTomada: r.accion_tomada || null,
    libreta: Boolean(r.libreta),
    fuenteVerificacion: r.fuente_verificacion || undefined,
    esquemaCompleto: Boolean(r.esquema_completo),
    tieneCvs: Boolean(r.tiene_cvs),
  };
}

function inferCasaFromRegistros(regs) {
  const byCasa = new Map();
  for (const r of regs) {
    const num = parseCasaNum(r.observaciones);
    if (!num) continue;
    if (!byCasa.has(num)) byCasa.set(num, []);
    byCasa.get(num).push(r);
  }

  const result = new Map();
  for (const [num, rows] of byCasa) {
    const vac = rows.filter((x) => x.estado_vacuna === 'vacunado');
    const novac = rows.filter((x) => x.estado_vacuna === 'no_vacunado');
    const estado = vac.length > 0 ? 'E' : novac.length > 0 ? 'N' : 'N';
    const ninos = estado === 'E' ? vac.map(registroToNino) : [];
    const ref = rows[rows.length - 1];
    result.set(num, {
      numero: num,
      estado,
      ninos,
      guardada: true,
      latitud: ref.latitud ?? null,
      longitud: ref.longitud ?? null,
      guardadaAt: ref.created_at ? new Date(ref.created_at).getTime() : Date.now(),
      visitaRegistroId: estado !== 'E' && novac[0] ? novac[0].id : null,
    });
  }
  return result;
}

const c = createAivenClient(process.env.DATABASE_URL);
await c.connect();

const { rows: prof } = await c.query(
  `SELECT user_id, username, email FROM profiles
   WHERE lower(email) LIKE $1 OR lower(username) LIKE $1 LIMIT 3`,
  [`%${needle}%`]
);
if (!prof.length) {
  console.error('Usuario no encontrado');
  process.exit(1);
}
const userId = prof[0].user_id;
console.log('Usuario:', prof[0].username, userId);

const { rows: drafts } = await c.query(
  `SELECT round_local_id, round_codigo, modulo_label, payload, efectivas_count, updated_at
   FROM round_monitoring_drafts
   WHERE owner_user_id = $1::uuid OR $1::uuid = ANY(participant_user_ids)
   ORDER BY updated_at DESC`,
  [userId]
);

const draft =
  drafts.find((d) => d.modulo_label?.toLowerCase() === moduloHint.toLowerCase()) ||
  drafts.find((d) => d.modulo_label?.toLowerCase().includes(moduloHint.toLowerCase())) ||
  drafts[0];

if (!draft) {
  console.error('Sin borrador');
  process.exit(1);
}

const payload = parsePayload(draft.payload);
const codigo = payload.codigo || draft.round_codigo;
console.log('Ronda:', draft.modulo_label, codigo);
console.log('Antes en servidor: E=', countE(payload.casas), 'visitas=', (payload.casas || []).filter((c) => c.guardada).length);

const { rows: registros } = await c.query(
  `SELECT id, observaciones, estado_vacuna, nombre, documento, fecha_nacimiento, sexo, edad,
          tipo_documento, motivo, accion_tomada, latitud, longitud, libreta, fuente_verificacion,
          esquema_completo, tiene_cvs, created_at
   FROM registros_vacunacion
   WHERE user_id = $1::uuid AND observaciones ILIKE $2
   ORDER BY created_at`,
  [userId, `%[Ronda ${codigo}]%`]
);

console.log('Registros etiquetados:', registros.length);

const inferred = inferCasaFromRegistros(registros);
const maxCasa = Math.max(
  ...(payload.casas || []).map((c) => c.numero),
  ...inferred.keys(),
  7
);

const casasByNum = new Map();
for (const c0 of payload.casas || []) casasByNum.set(c0.numero, { ...c0 });

for (let n = 1; n <= maxCasa; n += 1) {
  const inf = inferred.get(n);
  if (!inf) continue;
  const prev = casasByNum.get(n);
  if (prev) {
    casasByNum.set(n, {
      ...prev,
      ...inf,
      ninos: inf.estado === 'E' && inf.ninos.length ? inf.ninos : prev.ninos?.length ? prev.ninos : inf.ninos,
      guardada: true,
    });
  } else {
    casasByNum.set(n, inf);
  }
}

const casas = [];
for (let n = 1; n <= maxCasa; n += 1) {
  if (casasByNum.has(n)) casas.push(casasByNum.get(n));
}

let changes = 0;
for (const [num, inf] of inferred) {
  const prev = (payload.casas || []).find((c) => c.numero === num);
  const next = casasByNum.get(num);
  if (!prev || prev.estado !== next.estado) {
    console.log(`  Casa ${num}: ${prev?.estado || '—'} → ${next.estado} (${next.ninos.length} niños)`);
    changes += 1;
  } else if (prev.estado === 'E' && prev.estado !== 'E') {
    console.log(`  Casa ${num}: restaurada E`);
    changes += 1;
  }
}

const efectivas = countE(casas);
const next = {
  ...payload,
  totalCasas: META,
  casas,
  fase: efectivas >= META ? payload.fase : 'croquis',
  completedAt: efectivas >= META ? payload.completedAt : null,
  updatedAt: Date.now(),
};

console.log('\nDespués: E=', efectivas, 'visitas=', casas.filter((c) => c.guardada).length, `(${changes} casas ajustadas)`);

if (!apply) {
  console.log('\nDry-run. Guardar: node scripts/recover-round-efectivas.mjs', needle, moduloHint, '--apply');
  await c.end();
  process.exit(0);
}

await c.query(
  `UPDATE round_monitoring_drafts SET
     payload = $1::jsonb,
     efectivas_count = $2,
     total_casas = $3,
     is_active = true,
     fase = $4,
     updated_at = now()
   WHERE owner_user_id = $5::uuid AND round_local_id = $6`,
  [
    JSON.stringify(next),
    efectivas,
    META,
    next.fase || 'croquis',
    userId,
    draft.round_local_id,
  ]
);

console.log('\n✓ Ronda recuperada en servidor. Que cierre sesión y vuelva a entrar (o Continuar FATIMA).');
await c.end();
