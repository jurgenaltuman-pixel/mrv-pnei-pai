/** API propia (PostgreSQL Aiven). Por defecto activa; Supabase solo con VITE_USE_SUPABASE=true */
export const USE_SUPABASE_LEGACY = import.meta.env.VITE_USE_SUPABASE === 'true';
export const USE_MRV_API = !USE_SUPABASE_LEGACY;

/**
 * Unidades organizativas desde Supabase (datos completos).
 * Padrón (niños) en API Aiven por defecto — activar VITE_USE_SUPABASE_PADRON=true solo si hace falta.
 */
export const USE_SUPABASE_ORG = import.meta.env.VITE_USE_SUPABASE_ORG !== 'false';

/** Padrón vía Supabase (desactivado por defecto; usar Aiven) */
export const USE_SUPABASE_PADRON = import.meta.env.VITE_USE_SUPABASE_PADRON === 'true';

/**
 * Registros en Supabase desde el navegador (legacy). Desactivado en producción:
 * el login es API Aiven y user_id del JWT no coincide con auth.users de Supabase.
 */
export const USE_SUPABASE_REGISTROS = import.meta.env.VITE_USE_SUPABASE_REGISTROS === 'true';

/** Registros siempre vía API Aiven cuando el login es API (user_id coherente con JWT). */
export const useRegistrosApi = () => USE_MRV_API;

/** @deprecated usar USE_SUPABASE_ORG / USE_SUPABASE_PADRON */
export const USE_SUPABASE_CATALOG = USE_SUPABASE_ORG || USE_SUPABASE_PADRON;

/** Producción por defecto (Firebase PWA, APK, builds sin .env). */
export const MRV_API_PRODUCTION_DEFAULT = 'https://rapid-vaccinator-main.vercel.app';

/**
 * Resuelve la base de la API MRV.
 * - VITE_MRV_API_URL en build si existe.
 * - Vercel / localhost: mismo origen (vacío → /api).
 * - Firebase Hosting y otros estáticos: API en Vercel.
 */
export function resolveMrvApiBaseUrl(): string {
  const fromEnv = String(import.meta.env.VITE_MRV_API_URL ?? '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.vercel.app')
    ) {
      return '';
    }
    return MRV_API_PRODUCTION_DEFAULT;
  }

  return MRV_API_PRODUCTION_DEFAULT;
}

/** Base URL vacía = mismo origen (/api en Vercel o proxy dev). */
export const MRV_API_URL = resolveMrvApiBaseUrl();

const TOKEN_KEY = 'mrv_api_token';
const SESSION_STARTED_KEY = 'mrv_session_started_at';
const USER_SNAPSHOT_KEY = 'mrv_user_snapshot';

export type MrvUserSnapshot = {
  id: string;
  email: string;
  nombre: string;
  username: string | null;
};

/** Duración máxima de sesión en el dispositivo (7 días, alineado con JWT). */
export const SESSION_MAX_MS = 7 * 24 * 60 * 60 * 1000;

export function saveUserSnapshot(user: MrvUserSnapshot) {
  try {
    localStorage.setItem(USER_SNAPSHOT_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

export function getUserSnapshot(): MrvUserSnapshot | null {
  try {
    const raw = localStorage.getItem(USER_SNAPSHOT_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as MrvUserSnapshot;
    return u?.id && u?.email ? u : null;
  } catch {
    return null;
  }
}

export function clearUserSnapshot() {
  try {
    localStorage.removeItem(USER_SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}

/** Decodifica payload JWT (sin verificar firma) para restaurar sesión offline. */
export function parseJwtPayload(token: string): { sub?: string; email?: string } | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as { sub?: string; email?: string };
  } catch {
    return null;
  }
}

export function getApiToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function getSessionStartedAt(): number | null {
  try {
    const v = localStorage.getItem(SESSION_STARTED_KEY);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function touchSessionStart() {
  try {
    localStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function isSessionExpired(): boolean {
  const token = getApiToken();
  if (!token) return false;
  const started = getSessionStartedAt();
  if (started == null) {
    touchSessionStart();
    return false;
  }
  return Date.now() - started >= SESSION_MAX_MS;
}

export function setApiToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      touchSessionStart();
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_STARTED_KEY);
    }
  } catch {
    /* ignore */
  }
}

export async function mrvApiFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<{ data?: T; error?: string; status: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  const token = getApiToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const base = resolveMrvApiBaseUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const method = (init.method || 'GET').toUpperCase();

  async function doFetch(): Promise<Response> {
    return fetch(url, { ...init, headers });
  }

  let res: Response;
  try {
    res = await doFetch();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /ECONNREFUSED|ETIMEDOUT|Failed to fetch|NetworkError/i.test(msg)
        ? 'No hay conexión con la API. Si el administrador migró la base de datos, debe actualizar DATABASE_URL en Vercel/Firebase y volver a desplegar.'
        : msg;
    return { error: hint, status: 0 };
  }

  if (res.status === 429 && method === 'GET') {
    const retrySec = Number(res.headers.get('Retry-After')) || 3;
    await new Promise((r) => setTimeout(r, Math.min(30, retrySec) * 1000));
    try {
      res = await doFetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { error: msg, status: 0 };
    }
  }

  let body: { error?: string; [k: string]: unknown } = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    const ct = res.headers.get('content-type') || '';
    const looksLikeHtml = ct.includes('text/html');
    let err = body.error || res.statusText;
    if (res.status === 404 && looksLikeHtml) {
      err =
        'No hay API en este sitio. Cerrá la app, actualizá desde el navegador o usá la versión en Vercel.';
    } else if (res.status === 401 || res.status === 403) {
      err = body.error || 'Credenciales inválidas o cuenta sin aprobar.';
    }
    return { error: err, status: res.status };
  }
  return { data: body as T, status: res.status };
}
