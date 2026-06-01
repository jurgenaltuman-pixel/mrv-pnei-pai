#!/usr/bin/env node
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);
const needle = (process.argv[2] || '').toLowerCase();
if (!needle) {
  console.error('Uso: node scripts/search-profile.mjs <texto>');
  process.exit(1);
}
const c = createAivenClient(process.env.DATABASE_URL);
await c.connect();
const { rows } = await c.query(
  `SELECT email, username, display_name, is_active, is_approved,
          left(password_hash, 12) AS hash FROM (
     SELECT p.email, p.username, p.display_name, p.is_active, p.is_approved, ac.password_hash
     FROM profiles p
     LEFT JOIN auth_credentials ac ON ac.user_id = p.user_id
   ) x
   WHERE lower(email) LIKE $1 OR lower(username) LIKE $1 OR lower(display_name) LIKE $1
   LIMIT 20`,
  [`%${needle}%`]
);
console.log(rows.length ? rows : 'Sin resultados');
await c.end();
