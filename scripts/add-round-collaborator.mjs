#!/usr/bin/env node
/**
 * Agrega colaborador a borrador de ronda (participant_user_ids + payload).
 * Uso: node scripts/add-round-collaborator.mjs FATIMA amanciob [--apply]
 */
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';

loadEnv();

const moduloHint = process.argv[2] || 'FATIMA';
const userNeedle = process.argv[3] || 'amanciob';
const ownerNeedle = process.argv[4] || 'yaniseibarrola17';
const apply = process.argv.includes('--apply');

function parsePayload(raw) {
  if (!raw) return null;
  return typeof raw === 'object' ? raw : JSON.parse(String(raw));
}

const c = createAivenClient(process.env.DATABASE_URL);
await c.connect();

async function findProfile(needle) {
  const { rows } = await c.query(
    `SELECT user_id, username, email, display_name FROM profiles
     WHERE lower(username) LIKE $1 OR lower(email) LIKE $1 OR display_name ILIKE $1
     LIMIT 5`,
    [`%${needle.toLowerCase()}%`]
  );
  return rows[0] || null;
}

const owner = await findProfile(ownerNeedle);
const collab = await findProfile(userNeedle);
if (!owner) {
  console.error('Titular no encontrado:', ownerNeedle);
  process.exit(1);
}
if (!collab) {
  console.error('Colaborador no encontrado:', userNeedle);
  process.exit(1);
}

console.log('Titular:', owner.display_name, owner.user_id);
console.log('Colaborador:', collab.display_name, collab.user_id);

const { rows: drafts } = await c.query(
  `SELECT * FROM round_monitoring_drafts
   WHERE owner_user_id = $1::uuid AND modulo_label ILIKE $2
   ORDER BY updated_at DESC LIMIT 1`,
  [owner.user_id, `%${moduloHint}%`]
);

if (!drafts.length) {
  console.error('Borrador no encontrado para', moduloHint);
  process.exit(1);
}

const draft = drafts[0];
const payload = parsePayload(draft.payload);
const colabIds = new Set([...(payload.colaboradorUserIds || []).map(String)]);
const colabNames = [...(payload.colaboradores || [])];
colabIds.add(String(collab.user_id));
const name = String(collab.display_name || collab.username).trim();
if (!colabNames.includes(name)) colabNames.push(name);

const participants = new Set([
  String(owner.user_id),
  ...colabIds,
  ...(draft.participant_user_ids || []).map(String),
]);
participants.add(String(collab.user_id));

const nextPayload = {
  ...payload,
  userId: owner.user_id,
  colaboradorUserIds: [...colabIds],
  colaboradores: colabNames,
  updatedAt: Date.now(),
};

console.log('\nRonda:', draft.modulo_label, draft.round_codigo);
console.log('Participantes:', [...participants]);
console.log('Equipo en payload:', colabNames.join(' · '));

if (!apply) {
  console.log('\nDry-run. Aplicar: agregar --apply');
  await c.end();
  process.exit(0);
}

await c.query(
  `UPDATE round_monitoring_drafts SET
     payload = $1::jsonb,
     participant_user_ids = $2::uuid[],
     updated_at = now()
   WHERE owner_user_id = $3::uuid AND round_local_id = $4`,
  [
    JSON.stringify(nextPayload),
    [...participants],
    owner.user_id,
    draft.round_local_id,
  ]
);

console.log('\n✓ Colaborador agregado. Debe ver la ronda al sincronizar / Continuar.');
await c.end();
