import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// Usar variables inyectadas por Vite via define
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || __SUPABASE_URL__;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || __SUPABASE_KEY__;

/** Clave secreta (sb_secret_… o JWT service_role) embebida en el cliente: Supabase la rechaza y es riesgo de seguridad. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isEmbeddedSupabaseSecretKey(key: string | undefined): boolean {
  const k = (key ?? '').trim();
  if (!k) return false;
  if (k.startsWith('sb_secret_')) return true;
  if (!k.startsWith('eyJ')) return false;
  return decodeJwtPayload(k)?.role === 'service_role';
}

/** En WebView Android/iOS, localStorage a veces se pierde o queda inconsistente; Preferences persiste bien. */
function createAuthStorage() {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) {
    return localStorage;
  }

  return {
    getItem: async (key: string) => {
      const { value } = await Preferences.get({ key });
      if (value != null) return value;
      try {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          await Preferences.set({ key, value: legacy });
          localStorage.removeItem(key);
        }
        return legacy;
      } catch {
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      await Preferences.set({ key, value });
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
    removeItem: async (key: string) => {
      await Preferences.remove({ key });
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

if (import.meta.env.DEV) {
  console.log('Supabase URL (prefix):', SUPABASE_URL?.slice(0, 48));
}

if (!SUPABASE_URL?.startsWith('http')) {
  console.error('MRV: VITE_SUPABASE_URL no está configurada correctamente en el build.');
}

if (!SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY.length < 20) {
  console.error('MRV: falta la clave publicable de Supabase (VITE_SUPABASE_PUBLISHABLE_KEY / anon).');
}

if (isEmbeddedSupabaseSecretKey(SUPABASE_PUBLISHABLE_KEY)) {
  console.error(
    '[MRV] La clave de Supabase en este build es SECRETA (no permitida en navegador/app). ' +
      'Usá solo la clave «anon» (JWT role anon) o «publishable» (sb_publishable_…) de Project Settings → API. ' +
      'Revisá VITE_SUPABASE_PUBLISHABLE_KEY / .env.production y recompilá el APK o el sitio web.'
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: createAuthStorage() as any,
    persistSession: true,
    autoRefreshToken: true,
  },
});
