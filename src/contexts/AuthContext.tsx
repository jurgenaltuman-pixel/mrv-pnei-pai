import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

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
  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (email: string, password: string, displayName: string, username: string) => Promise<{ ok: boolean; error?: string }>;
  changePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ⚠️ IMPORTANTE: Los roles deben determinarse SOLO desde la tabla user_roles en Supabase
// Nunca hardcodear emails o lógica de roles en el cliente.
// La autorización se valida en el servidor mediante RLS policies.

function normalizeAuthError(message: string): string {
  const m = message.toLowerCase();
  
  // Log para debug (remover en producción si es necesario)
  console.warn('🔴 Auth Error:', message);
  
  if (
    m.includes('invalid api key') ||
    m.includes('apikey is invalid') ||
    m.includes('missing apikey') ||
    m.includes('jwt malformed') ||
    m.includes('project not found')
  ) {
    return 'Error de configuración del sistema (Supabase API key/proyecto). Contacte al administrador.';
  }
  
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('connection refused')) {
    return 'No se pudo conectar al servidor de autenticación. Verifique su conexión e intente nuevamente.';
  }
  
  if (m.includes('invalid login credentials')) return 'Credenciales inválidas. Verifique usuario/correo y contraseña.';
  if (m.includes('user not found') || m.includes('no user found')) return 'Usuario o correo no encontrado.';
  if (m.includes('email not confirmed') || m.includes('email_not_confirmed')) {
    return 'Debe confirmar el correo antes de entrar. Revise su bandeja de entrada (y spam) o pida a un administrador que desactive la confirmación por email en Supabase.';
  }
  if (m.includes('user already registered') || m.includes('already exists') || m.includes('duplicate')) return 'Este correo o usuario ya está registrado.';
  if (m.includes('password')) return 'La contraseña no cumple los requisitos (mínimo 6 caracteres).';
  if (m.includes('invalid email')) return 'El formato del correo electrónico no es válido.';
  if (m.includes('weak password')) return 'La contraseña es muy débil. Use mayúsculas, minúsculas y números.';
  if (m.includes('rate')) return 'Demasiados intentos. Espere unos minutos e intente nuevamente.';
  if (m.includes('unauthorized') || m.includes('forbidden')) return 'No tiene permisos para realizar esta acción.';
  if (m.includes('trigger') || m.includes('constraint')) {
    return 'Error al crear el perfil de usuario. Contacte al administrador.';
  }
  
  return 'Ocurrió un error de autenticación. Intente nuevamente. Si el problema persiste, contacte al soporte.';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvalPending, setApprovalPending] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [authBlockMessage, setAuthBlockMessage] = useState<string | null>(null);

  useEffect(() => {
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
          setAuthBlockMessage('Tu usuario está inactivo. Contactá al administrador.');
          await supabase.auth.signOut();
          setUser(null);
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
      .catch(() => {
        if (!isActive) return;
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

  const login = async (identifier: string, password: string) => {
    setAuthBlockMessage(null);
    const trimmed = identifier.trim().toLowerCase();

    if (!trimmed) {
      return { ok: false, error: 'Ingrese usuario, email o contraseña.' };
    }

    // Supabase auth only supports sign-in by email. If the user types a
    // `username`, try to resolve it to an email via RPC.
    let email = trimmed;
    
    if (!trimmed.includes('@')) {
      // El usuario ingresó un usuario/CI, necesitamos resolver a email
      console.log(`🔍 Resolviendo usuario "${trimmed}" a email...`);
      
      try {
        // Estrategia 1: Usar RPC optimizada
        const { data: resolvedEmail, error: resolveError } = await (supabase as any).rpc('resolve_email_by_username', {
          p_username: trimmed,
        });

        if (resolveError) {
          console.warn('⚠️  RPC error:', resolveError);
          // Continuar sin error
        }

        if (typeof resolvedEmail === 'string' && resolvedEmail) {
          email = resolvedEmail;
          console.log(`✅ Resuelto a email: ${email}`);
        } else {
          console.log('❌ RPC no devolvió email, intentando fallback...');
          
          // Estrategia 2: Fallback - buscar directamente en profiles (como anon)
          // Esta consulta funciona porque profiles tiene política de lectura pública para username
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('email')
              .eq('username', trimmed)
              .maybeSingle();

            if (profileError && !profileError.message.includes('no rows')) {
              console.warn('Profile lookup error:', profileError);
            }

            if (profileData?.email) {
              email = profileData.email;
              console.log(`✅ Encontrado en profiles: ${email}`);
            } else {
              console.error('❌ Usuario no encontrado en profiles');
              return { 
                ok: false, 
                error: `El usuario "${trimmed}" no existe. Verifica que es el usuario correcto o usa tu email para iniciar sesión.` 
              };
            }
          } catch (fallbackErr) {
            console.error('❌ Error en fallback:', fallbackErr);
            return { 
              ok: false, 
              error: 'No se pudo resolver el usuario. Intenta con tu email o verifica el usuario.' 
            };
          }
        }
      } catch (err) {
        console.error('❌ Error inesperado en resolución:', err);
        return { 
          ok: false, 
          error: 'Error al resolver usuario. Intenta con tu email.' 
        };
      }
    }

    email = email.trim().toLowerCase();

    if (!email.includes('@')) {
      return { ok: false, error: 'Usuario o email inválido. Usa tu email para iniciar sesión.' };
    }

    console.log(`🔐 Intentando login con: ${email}`);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('❌ Login error:', error);
      return { ok: false, error: normalizeAuthError(error.message) };
    }
    
    console.log('✅ Login exitoso');
    return { ok: true };
  };

  // Validador de email robusto
  const isValidEmail = (email: string): boolean => {
    // Regex más riguroso para email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const signup = async (email: string, password: string, displayName: string, username: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();
    
    // Validaciones básicas
    if (!normalizedUsername) return { ok: false, error: 'Debe ingresar un nombre de usuario.' };
    if (!normalizedEmail) return { ok: false, error: 'Debe ingresar un correo electrónico.' };
    if (!isValidEmail(normalizedEmail)) return { ok: false, error: 'El correo electrónico no es válido. Use formato: usuario@dominio.com' };
    if (!password) return { ok: false, error: 'Debe ingresar una contraseña.' };
    if (password.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
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
    if (!newPassword || newPassword.length < 6) {
      return { ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
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
    await supabase.auth.signOut();
    setUser(null);
    setApprovalPending(false);
    setInactive(false);
    setMustChangePassword(false);
    setAuthBlockMessage(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, approvalPending, inactive, mustChangePassword, authBlockMessage, login, signup, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
