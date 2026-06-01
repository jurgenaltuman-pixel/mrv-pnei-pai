#!/usr/bin/env node
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';
loadEnv();
const c = createAivenClient(process.env.DATABASE_URL);
await c.connect();
const needle = process.argv[2] || 'BOGADO';
const { rows: p } = await c.query(
  `SELECT user_id, username, email, display_name FROM profiles
   WHERE display_name ILIKE $1 OR username ILIKE $1 OR email ILIKE $1
   LIMIT 15`,
  [`%${needle}%`]
);
console.log('profiles:', p);
try {
  const { rows: n } = await c.query(
    `SELECT user_id, documento, nombre FROM nomina
     WHERE nombre ILIKE $1 OR documento::text LIKE $2 LIMIT 15`,
    [`%${needle}%`, `%4309066%`]
  );
  console.log('nomina:', n);
} catch (e) {
  console.log('nomina err', e.message);
}
await c.end();
