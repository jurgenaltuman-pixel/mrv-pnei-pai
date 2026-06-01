#!/usr/bin/env node
/**
 * Crea 5 usuarios de prueba con la misma contraseña.
 * Uso: TEST_PASSWORD=Subsistema.115 node scripts/create-test-users.mjs
 */
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

loadEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

const password = process.env.TEST_PASSWORD || 'Subsistema.115';
const users = [
  { email: 'prueba.mrv01@mrv.test', username: 'prueba.mrv01', nombre: 'PRUEBA MRV UNO', doc: '99001001' },
  { email: 'prueba.mrv02@mrv.test', username: 'prueba.mrv02', nombre: 'PRUEBA MRV DOS', doc: '99001002' },
  { email: 'prueba.mrv03@mrv.test', username: 'prueba.mrv03', nombre: 'PRUEBA MRV TRES', doc: '99001003' },
  { email: 'prueba.mrv04@mrv.test', username: 'prueba.mrv04', nombre: 'PRUEBA MRV CUATRO', doc: '99001004' },
  { email: 'prueba.mrv05@mrv.test', username: 'prueba.mrv05', nombre: 'PRUEBA MRV CINCO', doc: '99001005' },
];

const client = createAivenClient(process.env.DATABASE_URL);
await client.connect();
const hash = await bcrypt.hash(password, 10);
const now = new Date().toISOString();

console.log('\n=== Usuarios de prueba MRV ===\n');
console.log('Contraseña (todos):', password);
console.log('');

for (const u of users) {
  const { rows: ex } = await client.query(
    `SELECT user_id FROM profiles WHERE lower(email) = $1 OR nomina_documento = $2 LIMIT 1`,
    [u.email, u.doc]
  );
  let userId = ex[0]?.user_id;
  if (!userId) {
    userId = randomUUID();
    await client.query(
      `INSERT INTO profiles (
         user_id, email, username, display_name, nomina_documento,
         is_active, is_approved, must_change_password, scope_locked, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,true,true,false,false,$6,$6)`,
      [userId, u.email, u.username, u.nombre, u.doc, now]
    );
    await client.query(`INSERT INTO user_roles (user_id, role) VALUES ($1,'user') ON CONFLICT DO NOTHING`, [
      userId,
    ]);
    console.log(`Creado: ${u.email}`);
  } else {
    await client.query(
      `UPDATE profiles SET display_name=$2, username=$3, nomina_documento=$4,
         is_active=true, is_approved=true, must_change_password=false, updated_at=$5
       WHERE user_id=$1`,
      [userId, u.nombre, u.username, u.doc, now]
    );
    console.log(`Actualizado: ${u.email}`);
  }
  await client.query(
    `INSERT INTO auth_credentials (user_id, email, password_hash) VALUES ($1,$2,$3)
     ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id, password_hash = EXCLUDED.password_hash`,
    [userId, u.email, hash]
  );
  console.log(`  Usuario: ${u.username}`);
  console.log(`  Correo:  ${u.email}`);
  console.log(`  CI:      ${u.doc}`);
  console.log('');
}

await client.end();
