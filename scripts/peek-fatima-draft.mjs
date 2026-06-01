#!/usr/bin/env node
import { loadEnv } from './lib/load-env.mjs';
import { createAivenClient } from './lib/pg-aiven.mjs';
loadEnv();
const c = createAivenClient(process.env.DATABASE_URL);
await c.connect();
const { rows } = await c.query(
  `SELECT payload, efectivas_count FROM round_monitoring_drafts WHERE modulo_label ILIKE 'FATIMA' LIMIT 1`
);
const p = rows[0].payload;
const guardadas = (p.casas || []).filter((x) => x.guardada);
for (const x of guardadas) {
  console.log(
    `Casa ${x.numero}: ${x.estado} | ${(x.ninos || []).length} niños | vac=${(x.ninos || []).filter((n) => n.vacunado).length}`
  );
}
console.log('E=', guardadas.filter((x) => x.estado === 'E').length, 'efectivas_count col=', rows[0].efectivas_count);
await c.end();
