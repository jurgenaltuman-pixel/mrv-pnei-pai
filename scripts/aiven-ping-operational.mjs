#!/usr/bin/env node
/** Comprueba si la BD operativa (DATABASE_URL) responde y cuántos usuarios tiene. */
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';

loadEnv(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL');
  process.exit(1);
}
const host = url.match(/@([^:/]+)/)?.[1];
console.log('Operativa:', host);
const c = createAivenClient(url);
try {
  await c.connect();
  const { rows: a } = await c.query('SELECT count(*)::int n FROM auth_credentials');
  const { rows: p } = await c.query('SELECT count(*)::int n FROM profiles');
  console.log('OK — auth_credentials:', a[0].n, 'profiles:', p[0].n);
  process.exit(0);
} catch (e) {
  console.error('FAIL:', e.code || e.message);
  console.error('En Aiven: reanudá el servicio pg-mrv-pai-mrv-pai-2026 (puerto 21502).');
  process.exit(1);
} finally {
  await c.end().catch(() => {});
}
