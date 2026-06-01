#!/usr/bin/env node
/**
 * Crea o restablece un usuario en Aiven (profiles + auth_credentials + rol user).
 * Uso:
 *   node scripts/aiven-provision-user.mjs email@ejemplo.com "Contraseña123" "Nombre Apellido" [username]
 */
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);

const email = (process.argv[2] || '').trim().toLowerCase();
const password = process.argv[3] || '';
const displayName = process.argv[4] || email.split('@')[0];
const username = (process.argv[5] || email.split('@')[0]).trim().toLowerCase();

if (!email.includes('@') || !password) {
  console.error('Uso: node scripts/aiven-provision-user.mjs <email> <password> [displayName] [username]');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL en .env.local');
  process.exit(1);
}

const client = createAivenClient(url);
await client.connect();
const hash = await bcrypt.hash(password, 10);
const now = new Date().toISOString();

const { rows: existing } = await client.query(
  `SELECT user_id FROM profiles WHERE lower(trim(email)) = $1 OR lower(trim(username)) = $2 LIMIT 1`,
  [email, username]
);

let userId = existing[0]?.user_id;
if (!userId) {
  userId = randomUUID();
  await client.query(
    `INSERT INTO profiles (
       user_id, email, username, display_name, is_active, is_approved, must_change_password, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,true,true,false,$5,$5)`,
    [userId, email, username, displayName, now]
  );
  console.log('Perfil creado:', email);
} else {
  await client.query(
    `UPDATE profiles SET email = $2, username = $3, display_name = $4,
       is_active = true, is_approved = true, must_change_password = false, updated_at = $5
     WHERE user_id = $1`,
    [userId, email, username, displayName, now]
  );
  console.log('Perfil actualizado:', email);
}

await client.query(
  `INSERT INTO auth_credentials (user_id, email, password_hash) VALUES ($1,$2,$3)
   ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id, password_hash = EXCLUDED.password_hash`,
  [userId, email, hash]
);
await client.query(
  `INSERT INTO user_roles (user_id, role) VALUES ($1,'user') ON CONFLICT DO NOTHING`,
  [userId]
);

console.log('Listo. Puede ingresar con:', email, 'o username:', username);
console.log('user_id:', userId);
await client.end();
