import pg from 'pg';

const { Pool } = pg;

let mainPool;
const padronPoolsByUrl = new Map();

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

function poolForUrl(connectionString) {
  const key = normalizeConnectionString(connectionString);
  if (!padronPoolsByUrl.has(key)) {
    padronPoolsByUrl.set(key, createPool(connectionString));
  }
  return padronPoolsByUrl.get(key);
}

export function padronShardIndex(documento) {
  const d = String(documento || '').trim();
  if (!d.length) return 0;
  return d.charCodeAt(d.length - 1) % 2;
}

export function getPadronPoolForShard(shard) {
  const urls = getPadronShardUrls();
  if (!urls.length) throw new Error('PADRON_DATABASE_URL no configurada');
  const idx = Math.min(Math.max(0, shard), urls.length - 1);
  return poolForUrl(urls[idx]);
}

export function getPadronPoolForDocumento(documento) {
  return getPadronPoolForShard(padronShardIndex(documento));
}

/** URLs de shards de padrón (1 o 2 instancias Aiven). */
export function getPadronShardUrls() {
  const urls = [];
  if (process.env.PADRON_DATABASE_URL) urls.push(process.env.PADRON_DATABASE_URL);
  if (process.env.PADRON_DATABASE_URL_2) urls.push(process.env.PADRON_DATABASE_URL_2);
  return urls;
}

export function isPadronSharded() {
  return getPadronShardUrls().length > 1;
}

export function getPool() {
  if (mainPool) return mainPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no configurada (PostgreSQL Aiven — app)');
  }
  mainPool = createPool(connectionString);
  return mainPool;
}

/** Primer shard (instancia dedicada 1 GB o única). */
export function getPadronPool() {
  const urls = getPadronShardUrls();
  if (!urls.length) {
    throw new Error('PADRON_DATABASE_URL no configurada');
  }
  return poolForUrl(urls[0]);
}

/** Todos los pools de padrón configurados. */
export function getPadronPools() {
  const urls = getPadronShardUrls();
  if (!urls.length) {
    throw new Error('PADRON_DATABASE_URL no configurada');
  }
  return urls.map((u) => poolForUrl(u));
}

export function getPoolConfig() {
  return {
    runtime: isServerlessRuntime() ? 'serverless' : 'persistent',
    maxPerInstance: resolvePoolMax(),
    padronShards: getPadronShardUrls().length,
  };
}

export async function query(text, params) {
  return getPool().query(text, params);
}

/** Consulta el primer shard (compat). */
export async function padronQuery(text, params) {
  return getPadronPool().query(text, params);
}

/** Consulta todos los shards; concatena filas. */
export async function padronQueryAll(text, params) {
  const pools = getPadronPools();
  const parts = await Promise.allSettled(pools.map((p) => p.query(text, params)));
  const rows = [];
  const errors = [];
  for (const part of parts) {
    if (part.status === 'fulfilled') rows.push(...part.value.rows);
    else errors.push(part.reason?.message || String(part.reason));
  }
  if (!rows.length && errors.length === pools.length) {
    throw new Error(errors.join(' | '));
  }
  return { rows, errors: errors.length ? errors : undefined };
}

/** Conteo total en todos los shards. */
export async function padronCountAll() {
  const { rows, errors } = await padronQueryAll('SELECT count(*)::int AS n FROM base_personas', []);
  const total = rows.reduce((acc, r) => acc + (r.n || 0), 0);
  return { total, errors };
}

/** Paginación global: reparte offset/limit entre shards por orden documento. */
export async function padronPageAll(offset, limit, selectSql) {
  const pools = getPadronPools();
  const counts = [];
  for (const p of pools) {
    try {
      const { rows } = await p.query('SELECT count(*)::int AS n FROM base_personas');
      counts.push(rows[0]?.n ?? 0);
    } catch {
      counts.push(0);
    }
  }
  let skip = Math.max(0, offset);
  let need = limit;
  const out = [];
  for (let i = 0; i < pools.length && need > 0; i += 1) {
    const cnt = counts[i];
    if (skip >= cnt) {
      skip -= cnt;
      continue;
    }
    const take = Math.min(need, cnt - skip);
    const { rows } = await pools[i].query(
      `SELECT ${selectSql} FROM base_personas ORDER BY documento OFFSET $1 LIMIT $2`,
      [skip, take]
    );
    out.push(...rows);
    need -= rows.length;
    skip = 0;
  }
  return out;
}

/** Busca documento en todos los shards (dedupe por documento). */
export async function padronFindByDocumento(sql, params) {
  const { rows } = await padronQueryAll(sql, params);
  const seen = new Set();
  return rows.filter((r) => {
    const k = r.documento;
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
