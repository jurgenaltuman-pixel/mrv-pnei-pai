#!/usr/bin/env node
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';

loadEnv(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

const urls = {
  DATABASE_URL: process.env.DATABASE_URL,
  OLD_DATABASE_URL: process.env.OLD_DATABASE_URL,
  PADRON_DATABASE_URL: process.env.PADRON_DATABASE_URL,
  PADRON_DEDICADO_URL: process.env.PADRON_DEDICADO_URL,
};

for (const [name, url] of Object.entries(urls)) {
  if (!url) {
    console.log(name, 'MISSING');
    continue;
  }
  const host = url.match(/@([^:/]+)/)?.[1];
  const c = createAivenClient(url);
  try {
    await c.connect();
    const tabs = await c.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public'
       AND tablename IN ('auth_credentials','profiles','registros_vacunacion','base_personas')
       ORDER BY 1`
    );
    const counts = {};
    for (const t of tabs.rows) {
      const { rows } = await c.query(`SELECT count(*)::int AS n FROM ${t.tablename}`);
      counts[t.tablename] = rows[0].n;
    }
    console.log(name, host, 'OK', JSON.stringify(counts));
    await c.end();
  } catch (e) {
    console.log(name, host, 'FAIL', e.code || e.message);
    await c.end().catch(() => {});
  }
}
