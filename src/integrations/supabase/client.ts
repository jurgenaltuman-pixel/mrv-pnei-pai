import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { USE_MRV_API, USE_SUPABASE_ORG, USE_SUPABASE_PADRON } from '@/lib/api-config';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || __SUPABASE_URL__;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || __SUPABASE_KEY__;

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

const hasSupabaseCredentials = Boolean(
  SUPABASE_URL?.startsWith('http') && SUPABASE_PUBLISHABLE_KEY?.length >= 20
);

/** Auth vía Supabase (modo legacy) */
export const canUseSupabaseAuth = !USE_MRV_API && hasSupabaseCredentials;

/** Padrón y/o org desde Supabase (modo híbrido con API Aiven) */
export const canUseSupabaseCatalog = (USE_SUPABASE_ORG || USE_SUPABASE_PADRON) && hasSupabaseCredentials;

const canUseSupabase = canUseSupabaseAuth || canUseSupabaseCatalog;

export const supabase = canUseSupabase
  ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: createAuthStorage() as any,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : (null as unknown as ReturnType<typeof createClient<Database>>);

export const isSupabaseEnabled = canUseSupabase;

if (import.meta.env.DEV && canUseSupabase) {
  console.log('Supabase URL (prefix):', SUPABASE_URL?.slice(0, 48));
}
if (USE_MRV_API && import.meta.env.DEV) {
  console.log('MRV: modo API Aiven activo (VITE_MRV_API_URL)');
}
if (USE_MRV_API && canUseSupabaseCatalog && import.meta.env.DEV) {
  const parts = [];
  if (USE_SUPABASE_PADRON) parts.push('padrón');
  if (USE_SUPABASE_ORG) parts.push('org');
  console.log(`MRV: ${parts.join(' + ')} desde Supabase`);
}
