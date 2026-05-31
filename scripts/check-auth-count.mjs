import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';

loadEnv(process.cwd());
const c = createAivenClient(process.env.DATABASE_URL);
await c.connect();
const auth = await c.query('SELECT count(*)::int AS n FROM auth_credentials');
const profiles = await c.query('SELECT count(*)::int AS n FROM profiles');
let padron = 'n/a';
try {
  const p = await c.query('SELECT count(*)::int AS n FROM base_personas');
  padron = String(p.rows[0].n);
} catch {
  padron = 'missing';
}
await c.end();
console.log(JSON.stringify({ auth: auth.rows[0].n, profiles: profiles.rows[0].n, padron }));
