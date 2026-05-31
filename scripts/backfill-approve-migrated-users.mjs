#!/usr/bin/env node
/**
 * Aprueba perfiles de usuarios migrados con auth_credentials.
 * En Supabase el login (signInWithPassword) no bloqueaba por is_approved;
 * la API Aiven sí — esto restaura acceso a la nómina operativa.
 */
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient, connectAivenWritable } from './lib/pg-aiven.mjs';

loadEnv(process.cwd());

const url = process.env.DATABASE_URL?.split('?')[0];
if (!url) {
  console.error('Falta DATABASE_URL');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const client = createAivenClient(url);
await connectAivenWritable(client);

const before = await client.query(
  `SELECT
     count(*) FILTER (WHERE is_approved)::int AS approved,
     count(*) FILTER (WHERE NOT is_approved)::int AS pending,
     count(*) FILTER (WHERE NOT is_active)::int AS inactive
   FROM profiles`
);
console.log('Antes:', before.rows[0]);

const sql = `
  UPDATE profiles p
  SET is_approved = true,
      approved_at = COALESCE(p.approved_at, NOW()),
      updated_at = NOW()
  FROM auth_credentials ac
  WHERE ac.user_id = p.user_id
    AND p.is_active = true
    AND p.is_approved = false
`;

if (dryRun) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS n FROM profiles p
     JOIN auth_credentials ac ON ac.user_id = p.user_id
     WHERE p.is_active = true AND p.is_approved = false`
  );
  console.log(`Dry-run: se aprobarían ${rows[0].n} perfiles`);
} else {
  const res = await client.query(sql);
  console.log(`Aprobados: ${res.rowCount}`);
}

const after = await client.query(
  `SELECT
     count(*) FILTER (WHERE is_approved)::int AS approved,
     count(*) FILTER (WHERE NOT is_approved)::int AS pending
   FROM profiles WHERE is_active = true`
);
console.log('Después (activos):', after.rows[0]);

const sample = await client.query(
  `SELECT email, is_approved FROM profiles WHERE lower(email) = 'altuman.andres@gmail.com'`
);
console.log('altuman.andres:', sample.rows[0]);

await client.end();
