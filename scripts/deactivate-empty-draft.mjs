#!/usr/bin/env node
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';
loadEnv();
const codigo = process.argv[2] || 'R260601-3OVK';
const c = createAivenClient(process.env.DATABASE_URL);
await c.connect();
const { rows } = await c.query(
  `UPDATE round_monitoring_drafts SET is_active = false, updated_at = now()
   WHERE round_codigo = $1 AND efectivas_count = 0
   RETURNING modulo_label, owner_user_id, round_codigo`,
  [codigo]
);
console.log('Desactivados:', rows);
await c.end();
