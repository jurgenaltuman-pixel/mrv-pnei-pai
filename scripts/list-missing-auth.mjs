import pg from 'pg';
import { loadEnv } from './lib/load-env.mjs';

loadEnv(process.cwd());
const ref = 'fqdddcineslaxdkyiksf';
const pwd = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD || '8738Altu#man');
const supa = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${pwd}@aws-1-us-east-1.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
});
const aiv = new pg.Client({
  connectionString: process.env.DATABASE_URL.split('?')[0],
  ssl: { rejectUnauthorized: false },
});
await supa.connect();
await aiv.connect();
const { rows: supUsers } = await supa.query(
  'SELECT lower(email) AS email FROM auth.users WHERE encrypted_password IS NOT NULL'
);
const { rows: aivUsers } = await aiv.query('SELECT lower(email) AS email FROM auth_credentials');
const have = new Set(aivUsers.map((r) => r.email));
const missing = supUsers.filter((r) => !have.has(r.email));
console.log('missing', missing.length, missing.map((r) => r.email));
await supa.end();
await aiv.end();
