import pg from 'pg';

const { Pool } = pg;

let mainPool;
let padronPool;

function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.FUNCTION_TARGET ||
      process.env.K_SERVICE
  );
}

function isAivenUrl(connectionString) {
  return connectionString.includes('aivencloud.com') || connectionString.includes('sslmode=require');
}

/** Pool pequeño por instancia en serverless; más grande en API persistente (Render/VM). */
function resolvePoolMax() {
  if (process.env.PG_POOL_MAX) return Math.max(1, Number(process.env.PG_POOL_MAX) || 2);
  if (isServerlessRuntime()) return 2;
  return 15;
}

function normalizeConnectionString(connectionString) {
  return String(connectionString).split('?')[0];
}

function createPool(connectionString) {
  const serverless = isServerlessRuntime();
  const max = resolvePoolMax();
  const base = {
    connectionString: normalizeConnectionString(connectionString),
    max,
    min: 0,
    idleTimeoutMillis: serverless ? 5_000 : 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: serverless,
  };

  if (!isAivenUrl(connectionString)) {
    return new Pool(base);
  }

  const pool = new Pool({ ...base, ssl: { rejectUnauthorized: false } });
  pool.on('connect', (client) => {
    void client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE');
  });
  pool.on('error', (err) => {
    console.error('[pg-pool]', err.message);
  });
  return pool;
}

/** Auth, perfiles, registros, catálogo org en Aiven principal (no el padrón masivo). */
export function getPool() {
  if (mainPool) return mainPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no configurada (PostgreSQL Aiven — app)');
  }
  mainPool = createPool(connectionString);
  return mainPool;
}

/** Solo base_personas (~625k). Instancia dedicada para no llenar la BD de operación. */
export function getPadronPool() {
  if (padronPool) return padronPool;
  const connectionString = process.env.PADRON_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('PADRON_DATABASE_URL o DATABASE_URL no configurada');
  }
  padronPool = createPool(connectionString);
  return padronPool;
}

export function getPoolConfig() {
  return {
    runtime: isServerlessRuntime() ? 'serverless' : 'persistent',
    maxPerInstance: resolvePoolMax(),
  };
}

export async function query(text, params) {
  return getPool().query(text, params);
}

export async function padronQuery(text, params) {
  return getPadronPool().query(text, params);
}
