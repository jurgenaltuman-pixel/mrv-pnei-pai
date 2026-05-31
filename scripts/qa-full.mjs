#!/usr/bin/env node
/**
 * QA local: tests + health BD + padrón + build.
 */
import { spawn } from 'child_process';
import { loadEnv } from './lib/load-env.mjs';
import { connectAivenWritable, createAivenClient } from './lib/pg-aiven.mjs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);

const failures = [];

function ok(msg) {
  console.log('  OK', msg);
}
function fail(msg, e) {
  console.log('  FAIL', msg, e?.message || e || '');
  failures.push(msg);
}

async function checkDb(label, url) {
  if (!url) {
    fail(`${label}: sin URL`);
    return;
  }
  const c = createAivenClient(url);
  try {
    await connectAivenWritable(c);
    await c.query('SELECT 1');
    ok(`${label} conecta`);
  } catch (e) {
    fail(`${label} conecta`, e);
  } finally {
    try {
      await c.end();
    } catch {
      /* ignore */
    }
  }
}

async function checkPadron() {
  const urls = [
    process.env.PADRON_DATABASE_URL,
    process.env.PADRON_DEDICADO_URL || process.env.PADRON_DATABASE_URL_2,
  ].filter(Boolean);
  const unique = [...new Set(urls)];
  if (!unique.length) {
    fail('PADRON_DATABASE_URL no configurada');
    return;
  }

  let total = 0;
  let conSexo = 0;
  let muestraDoc = null;
  let muestraSexo = null;

  for (const url of unique) {
    const c = createAivenClient(url);
    try {
      await connectAivenWritable(c);
      const { rows } = await c.query(`
        SELECT count(*)::int AS total,
          count(*) FILTER (WHERE sexo IN ('M','F'))::int AS con_sexo
        FROM base_personas
      `);
      total += rows[0].total;
      conSexo += rows[0].con_sexo;
      if (!muestraDoc) {
        const { rows: muestra } = await c.query(
          `SELECT documento, sexo
           FROM base_personas
           WHERE sexo IN ('M','F')
           ORDER BY random()
           LIMIT 1`
        );
        if (muestra[0]?.documento) {
          muestraDoc = muestra[0].documento;
          muestraSexo = muestra[0].sexo;
        }
      }
    } catch (e) {
      fail(`padrón shard (${url.slice(0, 40)}…)`, e);
    } finally {
      try {
        await c.end();
      } catch {
        /* ignore */
      }
    }
  }

  if (total < 750_000) fail(`padrón filas (${total})`, new Error('esperado ~815000 en shards'));
  else ok(`padrón ${total.toLocaleString('es-PY')} filas (${unique.length} shard(s)), sexo ${conSexo.toLocaleString('es-PY')}`);
  if (muestraDoc && (muestraSexo === 'M' || muestraSexo === 'F')) {
    ok(`muestra padrón sexo válido (${muestraDoc}: ${muestraSexo})`);
  } else {
    fail('muestra padrón sexo válido', new Error('sin fila con sexo M/F'));
  }
}

async function checkAuthAndCapacity() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    fail('DATABASE_URL no configurada (auth QA)');
    return;
  }
  const c = createAivenClient(url);
  try {
    await connectAivenWritable(c);

    const { rows: counts } = await c.query(`
      SELECT
        (SELECT count(*)::int FROM profiles) AS profiles,
        (SELECT count(*)::int FROM auth_credentials) AS credentials,
        (SELECT count(*)::int FROM registros_vacunacion) AS registros,
        (SELECT count(*)::int FROM profiles p
           INNER JOIN auth_credentials ac ON ac.user_id = p.user_id
           WHERE p.is_active = true AND p.is_approved = false) AS cred_sin_aprobar,
        (SELECT count(*)::int FROM profiles
           WHERE is_active = true AND nomina_documento IS NOT NULL
             AND length(trim(nomina_documento)) >= 4) AS nomina_perfiles
    `);
    const s = counts[0];
    ok(`BD app: ${s.profiles} perfiles, ${s.credentials} credenciales, ${s.registros.toLocaleString('es-PY')} registros vacunación`);
    ok(`nómina precargada: ${s.nomina_perfiles} perfiles con documento`);

    if (s.credentials > 15_000) fail(`credenciales (${s.credentials})`, new Error('esperado ~4000-5000'));
    else if (s.credentials < 100) fail(`credenciales (${s.credentials})`, new Error('muy pocas — migración incompleta?'));

    if (s.registros > 160_000) {
      fail(`registros_vacunacion (${s.registros})`, new Error('supera 160k — riesgo de llenar la BD'));
    } else {
      ok(`registros bajo límite 160k (${s.registros.toLocaleString('es-PY')})`);
    }

    if (Number(s.cred_sin_aprobar) > 0) {
      fail(`cuentas con credenciales sin aprobar (${s.cred_sin_aprobar})`, new Error('deben ser 0 tras signup auto-aprobado'));
    } else {
      ok('0 cuentas activas con credenciales pendientes de aprobación');
    }

    const { rows: dupEmail } = await c.query(`
      SELECT lower(trim(email)) AS em, count(*)::int AS n
      FROM auth_credentials
      GROUP BY lower(trim(email))
      HAVING count(*) > 1
      LIMIT 5
    `);
    if (dupEmail.length) fail('emails duplicados en auth_credentials', new Error(dupEmail.map((r) => r.em).join(', ')));
    else ok('sin emails duplicados en auth_credentials');

    const { rows: dupUser } = await c.query(`
      SELECT lower(trim(username)) AS un, count(*)::int AS n
      FROM profiles
      WHERE username IS NOT NULL AND trim(username) <> ''
      GROUP BY lower(trim(username))
      HAVING count(*) > 1
      LIMIT 5
    `);
    if (dupUser.length) fail('usernames duplicados en profiles', new Error(dupUser.map((r) => r.un).join(', ')));
    else ok('sin usernames duplicados en profiles');

    const { rows: dupUserId } = await c.query(`
      SELECT user_id, count(*)::int AS n
      FROM profiles
      GROUP BY user_id
      HAVING count(*) > 1
      LIMIT 3
    `);
    if (dupUserId.length) fail('user_id duplicados en profiles', new Error(`${dupUserId.length} casos`));
    else ok('sin user_id duplicados en profiles');

    const { rows: nominaSinAprobar } = await c.query(`
      SELECT count(*)::int AS n
      FROM profiles p
      INNER JOIN auth_credentials ac ON ac.user_id = p.user_id
      WHERE p.nomina_documento IS NOT NULL
        AND length(trim(p.nomina_documento)) >= 4
        AND p.is_active = true
        AND p.is_approved = false
    `);
    if (nominaSinAprobar[0]?.n > 0) {
      fail(`nómina con credenciales sin aprobar (${nominaSinAprobar[0].n})`, new Error('signup debe auto-aprobar'));
    } else {
      ok('nómina con credenciales: todas aprobadas');
    }

    const { rows: orphanCred } = await c.query(`
      SELECT count(*)::int AS n
      FROM auth_credentials ac
      LEFT JOIN profiles p ON p.user_id = ac.user_id
      WHERE p.user_id IS NULL
    `);
    if (orphanCred[0]?.n > 0) fail(`auth_credentials huérfanas (${orphanCred[0].n})`, new Error('integridad rota'));
    else ok('auth_credentials ligadas a profiles');

    const { rows: ratio } = await c.query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE nomina_documento IS NOT NULL)::int AS con_nomina
      FROM profiles p
      INNER JOIN auth_credentials ac ON ac.user_id = p.user_id
      WHERE p.is_active = true
    `);
    ok(`${ratio[0].con_nomina}/${ratio[0].total} cuentas activas vinculadas a nómina (documento)`);
  } catch (e) {
    fail('auth/capacity consulta', e);
  } finally {
    try {
      await c.end();
    } catch {
      /* ignore */
    }
  }
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: root, stdio: 'inherit', shell: true });
    p.on('close', (code) => resolve(code === 0));
  });
}

console.log('\n=== QA MRV ===\n');
await checkDb('PADRON_DATABASE_URL', process.env.PADRON_DATABASE_URL);
await checkDb('DATABASE_URL (app)', process.env.DATABASE_URL);
await checkPadron();

console.log('\n--- auth / capacidad BD ---');
await checkAuthAndCapacity();

console.log('\n--- vitest ---');
if (!(await run('npm', ['test', '--', '--run']))) fail('vitest', new Error('tests fallaron'));

console.log('\n--- build ---');
if (!(await run('npm', ['run', 'build']))) fail('vite build', new Error('build falló'));

console.log('\n--- PWA / APK (estático) ---');
if (!(await run('node', ['scripts/qa-pwa-apk.mjs']))) fail('qa-pwa-apk', new Error('checks PWA/APK'));

console.log('\n=== Resumen ===');
if (failures.length) {
  console.log('Fallos:', failures.join('; '));
  process.exit(1);
}
console.log('Todo OK (revisá BD si alguna instancia estaba caída).');
