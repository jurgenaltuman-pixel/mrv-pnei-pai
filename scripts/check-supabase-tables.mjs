#!/usr/bin/env node
import pg from 'pg';
import { loadEnv } from './lib/load-env.mjs';

loadEnv(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const pwd = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD || '');
const url = `postgresql://postgres.fqdddcineslaxdkyiksf:${pwd}@aws-1-us-east-1.pooler.supabase.com:6543/postgres`;
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
for (const t of ['profiles', 'auth_credentials', 'registros_vacunacion', 'user_roles']) {
  try {
    const { rows } = await c.query(`SELECT count(*)::int AS n FROM ${t}`);
    console.log(t, rows[0].n);
  } catch (e) {
    console.log(t, e.code || e.message);
  }
}
await c.end();
