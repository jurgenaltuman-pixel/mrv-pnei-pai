import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase, isSupabaseEnabled } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import {
  USE_MRV_API,
  clearUserSnapshot,
  getApiToken,
  getUserSnapshot,
  isSessionExpired,
  mrvApiFetch,
  parseJwtPayload,
  saveUserSnapshot,
  setApiToken,
} from '@/lib/api-config';
import { validateStrongPassword } from '@/lib/password-policy';

interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  username: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  approvalPending: boolean;
  inactive: boolean;
  mustChangePassword: boolean;
  authBlockMessage: string | null;
  /** Motivo amigable tras cierre de sesión forzado (inactivo, sesión inválida, etc.) */
  signOutNotice: string | null;
  dismissSignOutNotice: () => void;
  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (
    email: string,
    password: string,
    displayName: string,
    username: string,
    scope?: {
      assigned_region?: string;
      assigned_distrito?: string;
      assigned_servicio?: string;
      from_nomina?: boolean;
      nomina_documento?: string;
    }
  ) => Promise<{ ok: boolean; error?: string; autoApproved?: boolean }>;
  changePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ⚠️ IMPORTANTE: Los roles deben determinarse SOLO desde la tabla user_roles en Supabase
// Nunca hardcodear emails o lógica de roles en el cliente.
// La autorización se valida en el servidor mediante RLS policies.

function normalizeAuthError(message: string): string {
  const m = message.toLowerCase();
  console.warn('Auth error (detalle técnico):', message);

  if (
    m.includes('invalid api key') ||
    m.includes('apikey is invalid') ||
    m.includes('missing apikey') ||
    m.includes('jwt malformed') ||
    m.includes('invalid jwt') ||
    m.includes('project not found')
  ) {
    return 'La aplicación no está bien configurada con Supabase (clave o proyecto). Avisá al administrador del MRV; vos no podés corregirlo desde el teléfono.';
  }

  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('connection refused') || m.includes('load failed')) {
    return 'No hay conexión a internet o el servidor no responde. Probá otra red, desactivá VPN y reintentá.';
  }

  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    return 'Contraseña incorrecta o el correo no coincide. Si entrás con usuario (sin @), probá también con tu correo completo.';
  }
  if (m.includes('user not found') || m.includes('no user found')) {
    return 'No existe una cuenta con ese correo. Verificá mayúsculas y que sea el mismo mail con el que se registró.';
  }
  if (m.includes('email not confirmed') || m.includes('email_not_confirmed')) {
    return 'Tenés que confirmar el correo antes de entrar. Revisá bandeja de entrada y spam, o pedí al admin que desactive la confirmación por email en Supabase.';
  }
  if (m.includes('user already registered') || m.includes('already exists') || m.includes('duplicate')) {
    return 'Ese correo o usuario ya está registrado. Usá «Iniciar sesión» o recuperá la cuenta con el administrador.';
  }
  if (m.includes('password') && (m.includes('short') || m.includes('least'))) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (m.includes('invalid email')) {
    return 'El formato del correo no es válido (ejemplo: nombre@correo.com).';
  }
  if (m.includes('weak password')) {
    return 'La contraseña es muy débil. Usá letras y números.';
  }
  if (m.includes('rate') || m.includes('too many')) {
    return 'Demasiados intentos. Esperá unos minutos y volvé a intentar.';
  }
  if (m.includes('secret api key') || m.includes('forbidden use of secret')) {
    return 'La app o el sitio web fue compilado con la clave secreta de Supabase (no permitida en el cliente). Pedí al administrador que recompile usando la clave «anon» o «publishable» del proyecto (Settings → API), nunca la service_role ni sb_secret_.';
  }
  if (m.includes('unauthorized') || m.includes('forbidden') || m.includes('not authorized')) {
    return 'No tenés permiso para esta operación. Si persiste, contactá soporte.';
  }
  if (m.includes('session') && (m.includes('expired') || m.includes('invalid'))) {
    return 'La sesión venció o es inválida. Volvé a iniciar sesión.';
  }
  if (m.includes('refresh token') || m.includes('refresh_token')) {
    return 'Sesión caducada. Cerrá la app por completo y entrá de nuevo con usuario o correo y contraseña.';
  }
  if (m.includes('trigger') || m.includes('constraint')) {
    return 'Error al guardar el perfil de usuario. Contactá al administrador.';
  }

  return `No se pudo completar el acceso (${message.slice(0, 120)}${message.length > 120 ? '…' : ''}). Probá con correo en lugar de usuario o contactá soporte.`;
}

async function resolveDisplayName(supaUser: User): Promise<string> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', supaUser.id)
      .maybeSingle();
    return data?.display_name || supaUser.user_metadata?.display_name || supaUser.email || '';
  } catch {
    return supaUser.user_metadata?.display_name || supaUser.email || '';
  }
}

async function resolveUsername(supaUser: User): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', supaUser.id)
      .maybeSingle();
    return data?.username || (supaUser.user_metadata?.username as string | undefined) || null;
  } catch {
    return (supaUser.user_metadata?.username as string | undefined) || null;
  }
}

/**
 * El panel de admin lista `public.profiles`, no Auth. Si solo existe auth.users, hay que tener fila de perfil.
 * Se ejecuta cuando hay sesión válida para alinear signup + usuarios cargados sólo desde el dashboard Auth.
 */
async function ensureProfileRowForAuthUser(supaUser: User): Promise<void> {
  const exists = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', supaUser.id)
      .maybeSingle();
    return Boolean(data?.user_id);
  };

  if (await exists()) return;

  const email = (supaUser.email || '').trim().toLowerCase();
  const rawDisplay =
    typeof supaUser.user_metadata?.display_name === 'string'
      ? supaUser.user_metadata.display_name.trim()
      : '';
  const rawUser =
    typeof supaUser.user_metadata?.username === 'string'
      ? supaUser.user_metadata.username.trim().toLowerCase()
      : '';
  const fromEmailLocal = email
    ? email.split('@')[0].replace(/[^a-z0-9._-]/gi, '').slice(0, 48)
    : '';
  let username =
    rawUser ||
    fromEmailLocal ||
    `u_${supaUser.id.replace(/-/g, '').slice(0, 10)}`;

  const now = new Date().toISOString();
  const baseRowNoId = {
    user_id: supaUser.id,
    email: email || null,
    display_name: rawDisplay || fromEmailLocal || email || supaUser.id,
    username,
    is_active: true as const,
    is_approved: false as const,
    must_change_password: false as const,
    scope_locked: false as const,
    created_at: now,
    updated_at: now,
  };

  // Algunos esquemas antiguos no tienen columna `id` (solo `user_id`).
  let { error } = await supabase.from('profiles').insert(baseRowNoId as any);

  const msgErr = () => ((error?.message || '') + '').toLowerCase();

  // Usuario nombre de usuario ocupado → reintentar con sufijo estable
  if (error?.code === '23505' && msgErr().includes('username')) {
    username = `${fromEmailLocal || 'u'}_${supaUser.id.slice(0, 8)}`;
    ({ error } = await supabase.from('profiles').insert({ ...(baseRowNoId as any), username }));
  }

  // Carrera/concurrencia u otra causa: perfil apareció igual
  if ((error?.code === '23505' && !msgErr().includes('username')) || (await exists())) {
    if (await exists()) void insertDefaultUserRole(supaUser.id);
    return;
  }

  if (error) {
    console.warn('ensureProfileRowForAuthUser:', error.message);
    return;
  }

  await insertDefaultUserRole(supaUser.id);
  await assignScopeFromPadron(supaUser.id, username);
}

async function assignScopeFromPadron(userId: string, username: string) {
  if (!isSupabaseEnabled) return;
  const doc = username.replace(/\D/g, '');
  if (doc.length < 4) return;
  try {
    const { data: row, error } = await supabase
      .from('base_personas')
      .select('region_sanitaria, distrito, servicio_salud')
      .eq('documento', doc)
      .maybeSingle();
    if (error || !row) return;
    const region = row.region_sanitaria?.trim();
    const distrito = row.distrito?.trim();
    const servicio = row.servicio_salud?.trim();
    if (!region || !distrito) return;
    await supabase
      .from('profiles')
      .update({
        assigned_region: region,
        assigned_distrito: distrito,
        assigned_servicio: servicio || null,
        scope_locked: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  } catch (e) {
    console.warn('assignScopeFromPadron:', e);
  }
}

async function insertDefaultUserRole(userId: string) {
  const { error } = await supabase.from('user_roles').insert({
    user_id: userId,
    role: 'user',
  });
  if (error && !/duplicate|23505/i.test(error.message)) {
    console.warn('ensureProfileRowForAuthUser rol user:', error.message);
  }
}

function coerceRpcEmail(data: unknown): string | null {
  if (typeof data === 'string') {
    const t = data.trim().toLowerCase();
    return t.includes('@') ? t : null;
  }
  if (Array.isArray(data) && data.length > 0) {
    return coerceRpcEmail(data[0]);
  }
  return null;
}

function mapProfileLookupError(err: { message?: string; code?: string } | null): string | null {
  if (!err?.message) return null;
  const m = err.message.toLowerCase();
  if (m.includes('secret api key') || m.includes('forbidden use of secret')) {
    return 'La app fue compilada con la clave secreta de Supabase (no permitida en el móvil). Pedí al administrador que recompile el APK con la clave «anon» o «publishable» (Settings → API). Mientras tanto probá iniciar sesión escribiendo el correo completo.';
  }
  if (m.includes('permission denied') || m.includes('policy') || m.includes('rls') || err.code === '42501') {
    return 'No se puede buscar el usuario desde la app (permisos de base de datos). Iniciá sesión con el correo electrónico completo o pedí al administrador que revise las políticas RLS de la tabla profiles.';
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvalPending, setApprovalPending] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [authBlockMessage, setAuthBlockMessage] = useState<string | null>(null);
  const [signOutNotice, setSignOutNotice] = useState<string | null>(null);

  useEffect(() => {
    if (USE_MRV_API) {
      let isActive = true;
      const loadingTimeout = window.setTimeout(() => {
        if (isActive) setLoading(false);
      }, 10000);

      const applyApiUser = async () => {
        const token = getApiToken();
        if (!token) {
          if (!isActive) return;
          setUser(null);
          setLoading(false);
          return;
        }
        if (isSessionExpired()) {
          setApiToken(null);
          clearUserSnapshot();
          setSignOutNotice('Tu sesión venció por seguridad (7 días). Volvé a ingresar.');
          setUser(null);
          setLoading(false);
          return;
        }
        const { data, error, status } = await mrvApiFetch<{
          user: {
            id: string;
            email: string;
            nombre: string;
            username: string | null;
            is_active: boolean;
            is_approved: boolean;
            must_change_password: boolean;
            roles: string[];
          };
        }>('/api/auth/me');
        if (!isActive) return;

        if (status === 401 || status === 403) {
          setApiToken(null);
          clearUserSnapshot();
          setUser(null);
          setLoading(false);
          return;
        }

        if (data?.user) {
          const u = data.user;
          const privileged = u.roles?.includes('super_admin') || u.roles?.includes('admin');
          const authUser = { id: u.id, email: u.email, nombre: u.nombre, username: u.username };
          saveUserSnapshot(authUser);
          setUser(authUser);
          setApprovalPending(!privileged && !u.is_approved);
          setInactive(!u.is_active);
          setMustChangePassword(u.must_change_password);
          setAuthBlockMessage(
            !u.is_active ? 'Cuenta inactiva' : !u.is_approved && !privileged ? 'Cuenta pendiente de aprobación' : null
          );
          setLoading(false);
          return;
        }

        const cached = getUserSnapshot();
        const jwt = parseJwtPayload(token);
        const fallback =
          cached ||
          (jwt?.sub && jwt?.email
            ? { id: jwt.sub, email: jwt.email, nombre: jwt.email, username: null }
            : null);

        if (fallback) {
          setUser(fallback);
          setApprovalPending(false);
          setInactive(false);
          setMustChangePassword(false);
          setAuthBlockMessage(
            error ? 'Sin conexión con el servidor; sesión restaurada en el dispositivo.' : null
          );
          setLoading(false);
          return;
        }

        if (status === 404) {
          setApiToken(null);
          clearUserSnapshot();
        }
        setUser(null);
        setLoading(false);
      };

      void applyApiUser();
      return () => {
        isActive = false;
        window.clearTimeout(loadingTimeout);
      };
    }

    if (!isSupabaseEnabled) {
      setLoading(false);
      return;
    }

    let isActive = true;
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;
    let channelUserId: string | null = null;
    // Failsafe para evitar que la UI quede trabada en "Cargando..."
    // si el SDK de auth no responde por red o storage.
    const loadingTimeout = window.setTimeout(() => {
      if (!isActive) return;
      setLoading(false);
    }, 10000);

    const applyUser = async (supaUser: User | null) => {
      if (!isActive) return;

      if (!supaUser) {
        if (profileChannel) {
          supabase.removeChannel(profileChannel);
          profileChannel = null;
          channelUserId = null;
        }
        setUser(null);
        setApprovalPending(false);
        setInactive(false);
        setMustChangePassword(false);
        setAuthBlockMessage(null);
        setLoading(false);
        return;
      }

      const fallbackName = supaUser.user_metadata?.display_name || supaUser.email || '';

      setUser({
        id: supaUser.id,
        email: supaUser.email || '',
        nombre: fallbackName,
        username: (supaUser.user_metadata?.username as string | undefined) || null,
      });
      setLoading(false);

      try {
        await ensureProfileRowForAuthUser(supaUser);

        const [{ data: profile }, { data: roles }, nombre, username] = await Promise.all([
          supabase
            .from('profiles')
            .select('is_active, is_approved, must_change_password')
            .eq('user_id', supaUser.id)
            .maybeSingle(),
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', supaUser.id),
          resolveDisplayName(supaUser),
          resolveUsername(supaUser),
        ]);
        if (!isActive) return;

        const roleList = (roles || []).map((r: any) => String(r.role));
        const isPrivilegedRole = roleList.includes('super_admin') || roleList.includes('admin');
        
        // ✅ SEGURO: Los roles se validan ÚNICAMENTE desde la tabla user_roles
        // No usar emails hardcodeados para determinar permisos
        const isPrivileged = isPrivilegedRole;

        // Si no existe fila en profiles o aún no están los flags cargados,
        // no bloqueamos el acceso por aprobación por defecto.
        const isApproved = isPrivileged
          ? true
          : (profile as any)?.is_approved === undefined
            ? true
            : Boolean((profile as any)?.is_approved);
        const isActiveUser = (profile as any)?.is_active === undefined ? true : Boolean((profile as any)?.is_active);
        const mustChange = Boolean((profile as any)?.must_change_password);

        setApprovalPending(!isApproved);
        setInactive(!isActiveUser);
        setMustChangePassword(mustChange);

        if (!isActiveUser) {
          setSignOutNotice(
            'Tu cuenta está inactiva. Pedí a un administrador del MRV que la reactive en el panel de usuarios antes de volver a intentar.'
          );
          setAuthBlockMessage(null);
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return;
        }

        if (!isApproved) {
          setAuthBlockMessage('Cuenta pendiente de aprobación por un administrador.');
          setUser({ id: supaUser.id, email: supaUser.email || '', nombre, username });
          return;
        }

        setAuthBlockMessage(null);
        setUser({ id: supaUser.id, email: supaUser.email || '', nombre, username });

        if (channelUserId !== supaUser.id) {
          if (profileChannel) supabase.removeChannel(profileChannel);
          profileChannel = supabase
            .channel(`auth-profile-${supaUser.id}`)
            .on(
              'postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${supaUser.id}` },
              async () => {
                const { data } = await supabase.auth.getUser();
                await applyUser(data.user ?? null);
              }
            )
            .subscribe();
          channelUserId = supaUser.id;
        }
      } catch (e) {
        console.error('applyUser (perfil / roles):', e);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void applyUser(session?.user ?? null);
      }
    );

    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => applyUser(session?.user ?? null))
      .catch((err: unknown) => {
        if (!isActive) return;
        console.error('getSession:', err);
        setSignOutNotice(
          'No se pudo recuperar la sesión (red o almacenamiento). Cerrá la app por completo y volvé a iniciar sesión con correo o usuario y contraseña.'
        );
        setUser(null);
        setLoading(false);
      });

    return () => {
      isActive = false;
      window.clearTimeout(loadingTimeout);
      subscription.unsubscribe();
      if (profileChannel) supabase.removeChannel(profileChannel);
    };
  }, []);

  useEffect(() => {
    if (!USE_MRV_API || !user) return;
    const checkExpiry = () => {
      if (isSessionExpired()) {
        setSignOutNotice('Tu sesión venció por seguridad (7 días). Volvé a ingresar.');
        setApiToken(null);
        clearUserSnapshot();
        setUser(null);
        setApprovalPending(false);
        setInactive(false);
        setMustChangePassword(false);
        setAuthBlockMessage(null);
      }
    };
    checkExpiry();
    const id = window.setInterval(checkExpiry, 60_000);
    return () => window.clearInterval(id);
  }, [user]);

  const login = async (identifier: string, password: string) => {
    setAuthBlockMessage(null);
    setSignOutNotice(null);

    if (USE_MRV_API) {
      const raw = identifier.trim();
      if (!raw || !password) {
        return { ok: false, error: 'Ingresá usuario/correo y contraseña.' };
      }
      const normalized = raw.toLowerCase();
      // Intento directo: el backend ya soporta email o username.
      let { data, error } = await mrvApiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: normalized, password }),
      });
      // Fallback para instalaciones antiguas: resolver email por username y reintentar.
      if ((!data?.token || error) && !normalized.includes('@')) {
        const resolved = await mrvApiFetch<{ email: string | null }>(
          `/api/auth/resolve-email?username=${encodeURIComponent(normalized)}`
        );
        const resolvedEmail = resolved.data?.email?.trim().toLowerCase() || '';
        if (resolvedEmail.includes('@')) {
          const retry = await mrvApiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: resolvedEmail, password }),
          });
          data = retry.data;
          error = retry.error;
        }
      }
      if (error || !data?.token) {
        return { ok: false, error: error || 'Credenciales inválidas' };
      }
      setApiToken(data.token);
      saveUserSnapshot(data.user);
      setUser(data.user);
      setLoading(false);
      return { ok: true };
    }

    const raw = identifier.trim();
    if (!raw) {
      return { ok: false, error: 'Ingresá tu usuario, correo o CI y la contraseña.' };
    }
    if (!password) {
      return { ok: false, error: 'Ingresá la contraseña.' };
    }

    let email = '';

    if (raw.includes('@')) {
      email = raw.trim().toLowerCase();
    } else {
      const usernameKey = raw.trim().toLowerCase();

      try {
        const { data: rpcData, error: resolveError } = await supabase.rpc('resolve_email_by_username', {
          p_username: usernameKey,
        });

        const fromRpc = coerceRpcEmail(rpcData);
        if (fromRpc) {
          email = fromRpc;
        } else {
          if (resolveError) {
            const re = (resolveError.message || '').toLowerCase();
            if (re.includes('function') && re.includes('does not exist')) {
              return {
                ok: false,
                error:
                  'Ingresar solo con «usuario» no está habilitado en el servidor (falta la función de resolución). Usá tu correo electrónico completo o pedí al administrador que ejecute la migración en Supabase.',
              };
            }
            console.warn('resolve_email_by_username:', resolveError);
          }

          const { data: profileRow, error: profileError } = await supabase
            .from('profiles')
            .select('email')
            .ilike('username', usernameKey)
            .limit(1)
            .maybeSingle();

          const rlsMsg = mapProfileLookupError(profileError);
          if (rlsMsg) return { ok: false, error: rlsMsg };

          if (profileError && !/PGRST116|0 rows|no rows/i.test(profileError.message)) {
            console.warn('profiles lookup:', profileError);
            return {
              ok: false,
              error: `No se pudo buscar el usuario en el servidor (${profileError.message}). Probá con tu correo electrónico.`,
            };
          }

          const rowEmail = profileRow?.email?.trim().toLowerCase();
          if (rowEmail?.includes('@')) {
            email = rowEmail;
          } else {
            return {
              ok: false,
              error: `No encontramos el usuario «${usernameKey}». Revisá la escritura o iniciá sesión con el correo con el que te registraron en el MRV.`,
            };
          }
        }
      } catch (err) {
        console.error(err);
        return {
          ok: false,
          error: 'No se pudo buscar tu usuario (fallo de red o servidor). Probá con el correo electrónico o revisá la conexión.',
        };
      }
    }

    email = email.trim().toLowerCase();
    if (!email.includes('@')) {
      return { ok: false, error: 'No pudimos obtener un correo válido. Iniciá sesión escribiendo el correo completo (con @).' };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, error: normalizeAuthError(error.message) };
    }

    return { ok: true };
  };

  // Validador de email robusto
  const isValidEmail = (email: string): boolean => {
    // Regex más riguroso para email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const signup = async (
    email: string,
    password: string,
    displayName: string,
    username: string,
    scope?: {
      assigned_region?: string;
      assigned_distrito?: string;
      assigned_servicio?: string;
      from_nomina?: boolean;
      nomina_documento?: string;
    }
  ) => {
    if (USE_MRV_API) {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedUsername = username.trim().toLowerCase();
      if (!normalizedUsername) return { ok: false, error: 'Debe ingresar un nombre de usuario.' };
      if (!isValidEmail(normalizedEmail)) return { ok: false, error: 'Correo inválido.' };
      const pwErr = validateStrongPassword(password);
      if (pwErr) return { ok: false, error: pwErr };
      const { data, error } = await mrvApiFetch<{
        token: string;
        user: AuthUser & { is_approved?: boolean };
        auto_approved?: boolean;
      }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          displayName: displayName.trim(),
          username: normalizedUsername,
          assigned_region: scope?.assigned_region?.trim() || null,
          assigned_distrito: scope?.assigned_distrito?.trim() || null,
          assigned_servicio: scope?.assigned_servicio?.trim() || null,
          from_nomina: Boolean(scope?.from_nomina),
          nomina_documento: scope?.nomina_documento?.trim() || null,
        }),
      });
      if (error) return { ok: false, error };
      if (data?.token) {
        setApiToken(data.token);
        if (data.user) saveUserSnapshot(data.user);
        setApprovalPending(false);
      }
      return { ok: true, autoApproved: true };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();
    
    // Validaciones básicas
    if (!normalizedUsername) return { ok: false, error: 'Debe ingresar un nombre de usuario.' };
    if (!normalizedEmail) return { ok: false, error: 'Debe ingresar un correo electrónico.' };
    if (!isValidEmail(normalizedEmail)) return { ok: false, error: 'El correo electrónico no es válido. Use formato: usuario@dominio.com' };
    if (!password) return { ok: false, error: 'Debe ingresar una contraseña.' };
    const pwErr = validateStrongPassword(password);
    if (pwErr) return { ok: false, error: pwErr };
    if (!displayName.trim()) return { ok: false, error: 'Debe ingresar su nombre completo.' };

    console.log(`📝 Intentando signup con: ${normalizedEmail}`);

    // Solo auth desde el cliente; la fila en `profiles` se crea en applyUser tras sesión válida.
    const { data: signupData, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { 
        data: { 
          display_name: displayName, 
          username: normalizedUsername 
        } 
      },
    });
    
    if (error) {
      console.error('❌ Signup error:', error);
      return { ok: false, error: normalizeAuthError(error.message) };
    }
    
    if (!signupData.user?.id) {
      return { ok: false, error: 'La cuenta se creó pero no se pudo confirmar. Intente iniciar sesión.' };
    }

    console.log('✅ Auth user creado exitosamente. El perfil se creará al primer login.');
    return { ok: true };
  };

  const changePassword = async (newPassword: string) => {
    const pwErr = validateStrongPassword(newPassword);
    if (pwErr) return { ok: false, error: pwErr };

    if (USE_MRV_API) {
      const { error } = await mrvApiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ password: newPassword }),
      });
      if (error) return { ok: false, error };
      setMustChangePassword(false);
      return { ok: true };
    }

    const { data: authData, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: normalizeAuthError(error.message) };

    const userId = authData.user?.id || user?.id;
    if (!userId) {
      setMustChangePassword(false);
      return { ok: true };
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('user_id', userId);

    if (profileError) {
      return { ok: false, error: `Contraseña actualizada, pero no se pudo limpiar el flag de cambio obligatorio: ${profileError.message}` };
    }

    setMustChangePassword(false);
    return { ok: true };
  };

  const logout = async () => {
    if (USE_MRV_API) {
      setApiToken(null);
      clearUserSnapshot();
    } else if (isSupabaseEnabled) {
      await supabase.auth.signOut();
    }
    setSignOutNotice(null);
    setUser(null);
    setApprovalPending(false);
    setInactive(false);
    setMustChangePassword(false);
    setAuthBlockMessage(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        approvalPending,
        inactive,
        mustChangePassword,
        authBlockMessage,
        signOutNotice,
        dismissSignOutNotice: () => setSignOutNotice(null),
        login,
        signup,
        changePassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
