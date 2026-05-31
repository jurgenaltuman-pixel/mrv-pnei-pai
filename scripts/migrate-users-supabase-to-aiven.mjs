/**
 * Migra usuarios Supabase → Aiven preservando contraseñas (hash bcrypt de auth.users).
 * Requiere: .env.local con DATABASE_URL (Aiven) y SUPABASE_DB_PASSWORD (o default 8738Altu#man).
 */
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const SUPABASE_REF = 'fqdddcineslaxdkyiksf';

import { loadEnv } from './lib/load-env.mjs';

loadEnv(root);

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || `https://${SUPABASE_REF}.supabase.co`;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || '8738Altu#man';

if (!DATABASE_URL) {
  console.error('Falta DATABASE_URL (Aiven)');
  process.exit(1);
}

const supabasePgUrl = `postgresql://postgres.${SUPABASE_REF}:${encodeURIComponent(SUPABASE_DB_PASSWORD)}@aws-1-us-east-1.pooler.supabase.com:6543/postgres`;

const supabase = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

async function fetchAllProfiles() {
  if (!supabase) return [];
  const all = [];
  let from = 0;
  const selectCols =
    'user_id, email, username, display_name, is_active, is_approved, must_change_password, scope_locked, assigned_region, assigned_distrito, assigned_servicio, assigned_barrio, approved_at, created_at, updated_at';
  while (true) {
    const { data, error } = await supabase.from('profiles').select(selectCols).range(from, from + 999);
    if (error) throw new Error(`profiles: ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function fetchAllRoles() {
  if (!supabase) return [];
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('user_roles').select('user_id, role').range(from, from + 999);
    if (error) throw new Error(`user_roles: ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function fetchAuthFromPostgres(supabaseClient) {
  const map = new Map();
  const batch = 500;
  let offset = 0;
  while (true) {
    const { rows } = await supabaseClient.query(
      `SELECT id, email, encrypted_password FROM auth.users
       WHERE encrypted_password IS NOT NULL
       ORDER BY created_at
       OFFSET $1 LIMIT $2`,
      [offset, batch]
    );
    if (!rows.length) break;
    for (const u of rows) {
      map.set(u.id, { email: u.email, hash: u.encrypted_password });
    }
    offset += rows.length;
    if (rows.length < batch) break;
    if (offset % 2000 === 0) console.log(`  auth.users leídos: ${offset}…`);
  }
  return map;
}

async function connectAiven() {
  const client = new pg.Client({
    connectionString: DATABASE_URL.split('?')[0],
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });
  client.on('error', (e) => console.warn('  aviso PG:', e.message));
  await client.connect();
  return client;
}

async function fetchExistingUserIds(aiven) {
  const { rows } = await aiven.query('SELECT user_id FROM auth_credentials');
  return new Set(rows.map((r) => r.user_id));
}

async function resolveUsername(aiven, userId, preferred, email) {
  let base = (preferred || email.split('@')[0] || 'user').slice(0, 50);
  const { rows } = await aiven.query('SELECT user_id FROM profiles WHERE username = $1 AND user_id <> $2 LIMIT 1', [
    base,
    userId,
  ]);
  if (!rows.length) return base;
  const suffix = userId.replace(/-/g, '').slice(0, 8);
  base = `${base.slice(0, 42)}_${suffix}`;
  return base.slice(0, 50);
}

async function migrateUser(aiven, userId, auth, p, rolesByUser) {
  const email = (p?.email || auth.email || '').trim().toLowerCase();
  const username = await resolveUsername(aiven, userId, p?.username || email.split('@')[0], email);
  await aiven.query('BEGIN');
  await aiven.query(
    `INSERT INTO profiles (
      user_id, email, username, display_name, is_active, is_approved, must_change_password,
      scope_locked, assigned_region, assigned_distrito, assigned_servicio, assigned_barrio,
      approved_at, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email, username = EXCLUDED.username, display_name = EXCLUDED.display_name,
      is_active = EXCLUDED.is_active, is_approved = EXCLUDED.is_approved,
      must_change_password = EXCLUDED.must_change_password, scope_locked = EXCLUDED.scope_locked,
      assigned_region = EXCLUDED.assigned_region, assigned_distrito = EXCLUDED.assigned_distrito,
      assigned_servicio = EXCLUDED.assigned_servicio, assigned_barrio = EXCLUDED.assigned_barrio,
      approved_at = EXCLUDED.approved_at, updated_at = EXCLUDED.updated_at`,
    [
      userId,
      email,
      username,
      p?.display_name || p?.username || email.split('@')[0],
      p?.is_active ?? true,
      p?.is_approved ?? false,
      p?.must_change_password ?? false,
      p?.scope_locked ?? false,
      p?.assigned_region ?? null,
      p?.assigned_distrito ?? null,
      p?.assigned_servicio ?? null,
      p?.assigned_barrio ?? null,
      p?.approved_at ?? null,
      p?.created_at || new Date().toISOString(),
      p?.updated_at || new Date().toISOString(),
    ]
  );
  await aiven.query(
    `INSERT INTO auth_credentials (user_id, email, password_hash) VALUES ($1,$2,$3)
     ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id, password_hash = EXCLUDED.password_hash`,
    [userId, email, auth.hash]
  );
  const userRoles = rolesByUser.get(userId) || ['user'];
  await aiven.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  for (const role of userRoles) {
    await aiven.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, $2::app_role)`, [userId, role]);
  }
  await aiven.query('COMMIT');
}

async function main() {
  console.log('Conectando a Supabase Postgres (auth.users)…');
  const supaPg = new pg.Client({ connectionString: supabasePgUrl, ssl: { rejectUnauthorized: false } });
  await supaPg.connect();

  const authMap = await fetchAuthFromPostgres(supaPg);
  await supaPg.end();
  console.log(`Hashes de contraseña: ${authMap.size}`);

  console.log('Leyendo profiles y roles vía API…');
  const [profiles, roles] = await Promise.all([fetchAllProfiles(), fetchAllRoles()]);
  console.log(`Perfiles: ${profiles.length}, filas de roles: ${roles.length}`);

  const rolesByUser = new Map();
  for (const r of roles) {
    const list = rolesByUser.get(r.user_id) || [];
    list.push(r.role);
    rolesByUser.set(r.user_id, list);
  }

  const profileById = new Map(profiles.map((p) => [p.user_id, p]));

  let aiven = await connectAiven();
  const existingUserIds = await fetchExistingUserIds(aiven);
  console.log(`Ya en Aiven: ${existingUserIds.size} credenciales (se omiten por user_id)`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  let already = 0;

  const userIds = [...new Set([...authMap.keys(), ...profileById.keys()])];

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    const auth = authMap.get(userId);
    const p = profileById.get(userId);
    if (!auth?.hash) {
      skipped++;
      continue;
    }
    const email = (p?.email || auth.email || '').trim().toLowerCase();
    if (!email) {
      skipped++;
      continue;
    }
    if (existingUserIds.has(userId)) {
      already++;
      continue;
    }
    try {
      await migrateUser(aiven, userId, auth, p, rolesByUser);
      existingUserIds.add(userId);
      migrated++;
      if (migrated % 200 === 0) console.log(`  migrados: ${migrated} (fila ${i + 1}/${userIds.length})…`);
    } catch (e) {
      try {
        await aiven.query('ROLLBACK');
      } catch {
        /* connection dead */
      }
      if (e.message?.includes('Connection terminated') || e.code === 'ECONNRESET') {
        console.warn(`  reconectando tras corte en ${email}…`);
        try {
          await aiven.end();
        } catch {
          /* ignore */
        }
        aiven = await connectAiven();
        try {
          await migrateUser(aiven, userId, auth, p, rolesByUser);
          existingUserIds.add(userId);
          migrated++;
        } catch (e2) {
          errors++;
          if (errors <= 10) console.error(`  ✗ ${email}:`, e2.message);
        }
      } else {
        errors++;
        if (errors <= 10) console.error(`  ✗ ${email}:`, e.message);
      }
    }
  }

  const { rows: cnt } = await aiven.query('SELECT count(*)::int AS n FROM auth_credentials');
  await aiven.end();

  console.log('\n=== Migración completada ===');
  console.log(`Usuarios migrados (nuevos): ${migrated}`);
  console.log(`Ya existían: ${already}`);
  console.log(`Omitidos (sin hash): ${skipped}`);
  console.log(`Errores: ${errors}`);
  console.log(`Total credenciales en Aiven: ${cnt[0].n}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
