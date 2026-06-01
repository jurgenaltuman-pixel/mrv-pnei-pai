#!/usr/bin/env node
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

loadEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const c = createAivenClient(process.env.DATABASE_URL);
await c.connect();
const { rows } = await c.query(`
  SELECT count(*)::int AS n
  FROM profiles p
  WHERE p.is_active = true AND p.is_approved = true
    AND NOT EXISTS (SELECT 1 FROM auth_credentials ac WHERE ac.user_id = p.user_id)
`);
console.log('Activos+aprobados sin auth_credentials:', rows[0].n);
const sample = await c.query(`
  SELECT p.email, p.username, p.display_name
  FROM profiles p
  WHERE p.is_active = true AND p.is_approved = true
    AND NOT EXISTS (SELECT 1 FROM auth_credentials ac WHERE ac.user_id = p.user_id)
  LIMIT 10
`);
console.log('Ejemplos:', sample.rows);
await c.end();
