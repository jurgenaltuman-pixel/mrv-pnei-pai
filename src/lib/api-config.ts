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

/** Base URL vacía = mismo origen (/api vía Firebase Functions) */
export const MRV_API_URL = (import.meta.env.VITE_MRV_API_URL ?? '').replace(/\/$/, '');

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

  const url = `${MRV_API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /ECONNREFUSED|ETIMEDOUT|Failed to fetch|NetworkError/i.test(msg)
        ? 'No hay conexión con la API. Si el administrador migró la base de datos, debe actualizar DATABASE_URL en Vercel/Firebase y volver a desplegar.'
        : msg;
    return { error: hint, status: 0 };
  }
  let body: { error?: string; [k: string]: unknown } = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    return { error: body.error || res.statusText, status: res.status };
  }
  return { data: body as T, status: res.status };
}
