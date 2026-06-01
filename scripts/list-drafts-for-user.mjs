#!/usr/bin/env node
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';
loadEnv();
const needle = process.argv[2] || 'amanciob';
const c = createAivenClient(process.env.DATABASE_URL);
await c.connect();
const { rows: p } = await c.query(
  `SELECT user_id, display_name FROM profiles WHERE username ILIKE $1 OR email ILIKE $1 LIMIT 1`,
  [`%${needle}%`]
);
const uid = p[0].user_id;
const { rows } = await c.query(
  `SELECT modulo_label, round_codigo, efectivas_count, is_active, participant_user_ids
   FROM round_monitoring_drafts WHERE $1::uuid = ANY(participant_user_ids)`,
  [uid]
);
console.log(p[0].display_name, 'drafts:', rows);
await c.end();
