import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/** Carga .env.local y .env; .env.local siempre gana en DATABASE_URL / OLD_DATABASE_URL. */
export function loadEnv(root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')) {
  const overrides = {};
  for (const f of ['.env', '.env.local']) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (
        f === '.env.local' &&
        (k === 'DATABASE_URL' ||
          k === 'OLD_DATABASE_URL' ||
          k === 'PADRON_DATABASE_URL' ||
          k === 'PADRON_DEDICADO_URL')
      ) {
        overrides[k] = v;
      } else if (!process.env[k] && !(k in overrides)) {
        process.env[k] = v;
      }
    }
  }
  Object.assign(process.env, overrides);
}
