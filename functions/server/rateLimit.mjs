/**
 * Rate limit en memoria (por instancia serverless).
 * Reduce picos cuando muchos brigadistas descargan padrón o hacen login a la vez.
 */
const buckets = new Map();

function clientKey(req) {
  const fwd = req.headers['x-forwarded-for'];
  const ip = typeof fwd === 'string' ? fwd.split(',')[0].trim() : req.socket?.remoteAddress;
  return ip || 'unknown';
}

function sweep() {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

export function createRateLimiter({ windowMs, max, keyFn }) {
  return (req, res, next) => {
    sweep();
    const key = keyFn(req);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retrySec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      res.status(429).json({
        error: 'Demasiadas solicitudes. Esperá unos segundos y reintentá.',
        retryAfterSec: retrySec,
      });
      return;
    }
    next();
  };
}

/** Login: evita saturación y fuerza bruta. */
export const loginRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_LOGIN_PER_MIN || 25),
  keyFn: (req) => `login:${clientKey(req)}`,
});

/** Padrón paginado: ~90 páginas/min por usuario (descarga completa en ~10–15 min). */
export const padronPageRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_PADRON_PAGE_PER_MIN || 90),
  keyFn: (req) => `padron:${req.user?.sub || clientKey(req)}`,
});

/** Búsquedas padrón en terreno. */
export const padronSearchRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_PADRON_SEARCH_PER_MIN || 120),
  keyFn: (req) => `padron-search:${req.user?.sub || clientKey(req)}`,
});
