#!/usr/bin/env node
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';
loadEnv();
const userId = '6e50c328-80a2-4ef7-a5af-c2545ff1739a';
const c = createAivenClient(process.env.DATABASE_URL);
await c.connect();

const { rows: hist } = await c.query(
  `SELECT id, round_codigo, modulo_label, efectivas, snapshot_json, completada_at
   FROM round_monitoring_history
   WHERE user_id = $1 AND (modulo_label ILIKE '%FATIMA%' OR barrio ILIKE '%FATIMA%')
   ORDER BY completada_at DESC LIMIT 5`,
  [userId]
);
console.log('Historial:', hist.length);
for (const h of hist) {
  const snap = h.snapshot_json;
  const casas = snap?.casas || [];
  const e = casas.filter((x) => x.guardada && x.estado === 'E').length;
  console.log(h.modulo_label, h.round_codigo, 'E=', e, 'guardadas=', casas.filter((x) => x.guardada).length, h.completada_at);
}

const { rows: regs } = await c.query(
  `SELECT observaciones, estado_vacuna, count(*)::int n
   FROM registros_vacunacion
   WHERE user_id = $1 AND observaciones ILIKE '%R260601-9P0K%'
   GROUP BY observaciones, estado_vacuna
   ORDER BY 1, 2`,
  [userId]
);
console.log('\nRegistros por obs/estado (sample):', regs.length);
const byCasa = new Map();
const { rows: all } = await c.query(
  `SELECT observaciones, estado_vacuna FROM registros_vacunacion
   WHERE user_id = $1 AND observaciones ILIKE '%R260601-9P0K%'`,
  [userId]
);
for (const r of all) {
  const m = String(r.observaciones).match(/Casa\s+(\d+)/i);
  if (!m) continue;
  const num = Number(m[1]);
  if (!byCasa.has(num)) byCasa.set(num, { vac: 0, novac: 0, other: 0 });
  const b = byCasa.get(num);
  if (r.estado_vacuna === 'vacunado') b.vac += 1;
  else if (r.estado_vacuna === 'no_vacunado') b.novac += 1;
  else b.other += 1;
}
const inferE = [];
for (const [num, b] of [...byCasa.entries()].sort((a, b) => a[0] - b[0])) {
  const likelyE = b.vac > 0;
  if (likelyE) inferE.push(num);
  if (num <= 20 || likelyE) console.log(`Casa ${num}: vac=${b.vac} novac=${b.novac} other=${b.other} → ${likelyE ? 'E' : 'N/F/R'}`);
}
console.log('\nCasas inferidas E por vacunado:', inferE);
await c.end();
