import { useState, useRef, useEffect, useMemo } from 'react';
import { MrvAppLogo } from '@/components/branding/MrvAppLogo';
import { useAuth } from '@/contexts/AuthContext';
import { dataService } from '@/services/dataService';
import { useOrgStructure } from '@/hooks/useOrgStructure';
import { APP_TITLE_PRIMARY, APP_CAMPAIGN_TAG } from '@/lib/app-branding';
import { upperText } from '@/lib/text-uppercase';
import { PASSWORD_HINT, validateStrongPassword } from '@/lib/password-policy';
import { isNativeApp } from '@/lib/capacitor-platform';
import {
  clearBiometricCredentials,
  getBiometricCredentialsVerified,
  hasBiometricCredentials,
  isBiometricAvailable,
  saveBiometricCredentials,
} from '@/lib/biometric-auth';
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  Shield,
  AtSign,
  Search,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  EyeOff,
  CreditCard,
  Fingerprint,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  cleanNominaDisplayName,
  cleanNominaUsername,
  isPlaceholderEmail,
  isRealUserEmail,
  normalizeNominaDocumento,
} from '@/lib/nomina-profile';
import { resolveSignupOrgSelection as resolveOrgFromCatalog } from '@/lib/org-name-match';

interface UserSuggestion {
  documento: string;
  nombre: string;
  fecha_nacimiento: string | null;
  username?: string;
  email?: string | null;
  assigned_region?: string | null;
  assigned_distrito?: string | null;
  assigned_servicio?: string | null;
}

export default function LoginPage() {
  const { login, signup, signOutNotice, dismissSignOutNotice } = useAuth();
  const { regiones, getDistritosByRegion, getServiciosByDistrito, loading: orgLoading } =
    useOrgStructure();
  const [isSignup, setIsSignup] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [ci, setCi] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [ciFound, setCiFound] = useState<UserSuggestion | null>(null);
  const [nominaMatched, setNominaMatched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');
  const [signupRegion, setSignupRegion] = useState('');
  const [signupDistrito, setSignupDistrito] = useState('');
  const [signupServicio, setSignupServicio] = useState('');
  const [manualSignupOpen, setManualSignupOpen] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [rememberBiometric, setRememberBiometric] = useState(true);
  const isNative = isNativeApp();
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isNative || isSignup) return;
    let cancelled = false;
    void (async () => {
      const available = await isBiometricAvailable();
      const ready = available ? await hasBiometricCredentials() : false;
      if (!cancelled) {
        setBiometricAvailable(available);
        setBiometricReady(ready);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNative, isSignup]);

  const minCharsForSignupSearch = (raw: string) => {
    const t = raw.trim();
    const digits = t.replace(/\D/g, '');
    const hasLetter = /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(t);
    const words = t.split(/\s+/).filter((w) => w.length >= 3);
    if (!hasLetter && digits.length > 0) return 4;
    if (words.length >= 2) return 3;
    return 4;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (isSignup) {
      const doc = normalizeNominaDocumento(ci);
      if (doc.length < 5) {
        setError('Ingresá tu documento / CI completo (mínimo 5 dígitos).');
        setLoading(false);
        return;
      }
      const nombre = displayName.trim();
      if (!nombre || nombre.includes('@') || isPlaceholderEmail(nombre)) {
        setError('Ingresá su nombre y apellido (no use un correo en este campo).');
        setLoading(false);
        return;
      }
      if (!username.trim()) {
        setError('Ingrese un nombre de usuario.');
        setLoading(false);
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier.trim()) || isPlaceholderEmail(identifier)) {
        setError('Ingresá un correo electrónico válido (ej. nombre@mspbs.gov.py).');
        setLoading(false);
        return;
      }
      if (!signupRegion.trim() || !signupDistrito.trim()) {
        setError('Seleccioná región y distrito de tu asignación.');
        setLoading(false);
        return;
      }
      const pwErr = validateStrongPassword(password);
      if (pwErr) {
        setError(pwErr);
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        setLoading(false);
        return;
      }

      const result = await signup(identifier, password, nombre, username.trim().toLowerCase(), {
        assigned_region: signupRegion,
        assigned_distrito: signupDistrito,
        assigned_servicio: signupServicio || undefined,
        from_nomina: nominaMatched,
        nomina_documento: doc,
      });
      if (!result.ok) setError(result.error || 'Error al registrarse');
      else {
        setSuccess('✅ Registro completado. Ya podés ingresar con tu usuario y contraseña.');
      }
    } else {
      const result = await login(identifier, password);
      if (!result.ok) {
        setError(result.error || 'Credenciales incorrectas');
      } else if (isNative && rememberBiometric && biometricAvailable) {
        try {
          await saveBiometricCredentials(identifier.trim(), password);
          setBiometricReady(true);
        } catch {
          // Si el guardado biométrico falla, no bloquea el ingreso normal
        }
      } else if (isNative && !rememberBiometric) {
        await clearBiometricCredentials();
        setBiometricReady(false);
      }
    }
    setLoading(false);
  };

  const handleBiometricLogin = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const creds = await getBiometricCredentialsVerified();
      if (!creds) {
        setError('No hay credenciales biométricas configuradas en este dispositivo.');
        return;
      }
      const result = await login(creds.username, creds.password);
      if (!result.ok) {
        setError(result.error || 'No se pudo iniciar con biometría.');
        await clearBiometricCredentials();
        setBiometricReady(false);
        return;
      }
      setIdentifier(creds.username);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/cancel|canceled|cancelled|user dismissed/i.test(msg)) {
        setError('Autenticación biométrica cancelada.');
      } else {
        setError('No se pudo validar biometría. Probá de nuevo o ingresá con contraseña.');
      }
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    const trimmedQuery = query.trim();
    setSearchError('');

    const minLen = minCharsForSignupSearch(trimmedQuery);
    if (trimmedQuery.length < minLen) {
      setSuggestions([]);
      setLastSearchedQuery('');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setSearchingUsers(true);
    try {
      const rows = await dataService.buscarNominaBrigadista(trimmedQuery, {
        limit: 15,
        signal: abortControllerRef.current.signal,
      });

      if (abortControllerRef.current.signal.aborted) return;

      const mapped: UserSuggestion[] = rows.map((p) => ({
        documento: p.documento,
        nombre: p.nombre,
        fecha_nacimiento: p.fecha_nacimiento,
        username: p.username,
        email: p.email,
        assigned_region: p.assigned_region,
        assigned_distrito: p.assigned_distrito,
        assigned_servicio: p.assigned_servicio,
      }));

      setSuggestions(mapped);
      setLastSearchedQuery(trimmedQuery);

      const qDigits = normalizeNominaDocumento(trimmedQuery);
      if (qDigits.length >= 5) {
        const exact = mapped.filter((u) => normalizeNominaDocumento(u.documento) === qDigits);
        if (exact.length === 1) {
          applyNominaSelection(exact[0]);
          return;
        }
      }
    } catch (err: unknown) {
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: string }).name) : '';
      if (name !== 'AbortError') {
        console.error('❌ Error en búsqueda:', err);
        const msg = err instanceof Error ? err.message : 'Error al buscar usuarios. Intenta de nuevo.';
        setSearchError(msg);
        setSuggestions([]);
        setLastSearchedQuery(trimmedQuery);
      }
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const trimmed = value.trim();
    const minLen = minCharsForSignupSearch(trimmed);
    if (trimmed.length < minLen) {
      setSuggestions([]);
      setLastSearchedQuery('');
      return;
    }

    setLastSearchedQuery('');
    const debounceDelay =
      minCharsForSignupSearch(trimmed) === 4 && /^\d[\d\s.]*$/.test(trimmed) ? 120 : 250;

    debounceTimer.current = setTimeout(() => {
      void searchUsers(value);
    }, debounceDelay);
  };

  const allDistritos = useMemo(
    () => regiones.flatMap((r) => getDistritosByRegion(r.id)),
    [regiones, getDistritosByRegion]
  );
  const allServicios = useMemo(
    () => allDistritos.flatMap((d) => getServiciosByDistrito(d.id)),
    [allDistritos, getServiciosByDistrito]
  );

  const applyNominaSelection = (user: UserSuggestion) => {
    const doc = normalizeNominaDocumento(user.documento) || user.documento;
    setCi(doc);
    const nombre = cleanNominaDisplayName(user.nombre, user.username, doc);
    setDisplayName(nombre ? upperText(nombre) : '');
    setUsername(cleanNominaUsername(user.username, doc));
    if (user.email && isRealUserEmail(user.email)) {
      setIdentifier(user.email);
    } else if (isPlaceholderEmail(identifier)) {
      setIdentifier('');
    }
    const org = resolveOrgFromCatalog(
      { regiones, distritos: allDistritos, servicios: allServicios },
      user
    );
    if (org.region) setSignupRegion(org.region);
    if (org.distrito) setSignupDistrito(org.distrito);
    if (org.servicio) setSignupServicio(org.servicio);
    setCiFound(user);
    setNominaMatched(true);
    setManualSignupOpen(true);
    setSearchError('');
    setSuggestions([]);
    setSearchQuery('');
  };

  const selectUser = (user: UserSuggestion) => {
    applyNominaSelection(user);
  };

  const signupRegionId = useMemo(
    () => regiones.find((r) => r.nombre === signupRegion)?.id ?? null,
    [regiones, signupRegion]
  );
  const signupDistritos = signupRegionId ? getDistritosByRegion(signupRegionId) : [];
  const signupDistritoId = useMemo(
    () => signupDistritos.find((d) => d.nombre === signupDistrito)?.id ?? null,
    [signupDistritos, signupDistrito]
  );
  const signupServicios = signupDistritoId ? getServiciosByDistrito(signupDistritoId) : [];

  const clearSelection = () => {
    setCi('');
    setSearchQuery('');
    setSuggestions([]);
    setDisplayName('');
    setUsername('');
    setCiFound(null);
    setNominaMatched(false);
    setManualSignupOpen(false);
    setSearchError('');
    setLastSearchedQuery('');
    setSignupRegion('');
    setSignupDistrito('');
    setSignupServicio('');
  };

  // Cerrar sugerencias si hace clic afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="auth-shell auth-login-bg relative min-h-dvh w-full flex flex-col items-center justify-center p-4 sm:p-8 safe-area-top safe-area-bottom overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-[#0077cc]/25 blur-3xl" />
        <div className="absolute top-1/3 left-1/4 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
      </div>

      <div className="absolute top-4 right-4 safe-area-top z-20">
        <ThemeToggle variant="onPrimary" className="!border-white/25 !bg-white/10 hover:!bg-white/20" />
      </div>

      <div className="w-full max-w-[420px] relative z-[1]">
        <div className="text-center mb-7 sm:mb-8">
          <div className="mx-auto mb-5 w-[7.5rem] h-[7.5rem] sm:w-[8.5rem] sm:h-[8.5rem] rounded-[1.75rem] bg-white p-3 sm:p-3.5 shadow-[0_24px_56px_-14px_rgba(0,0,0,0.5)] ring-1 ring-white/50">
            <div className="h-full w-full rounded-2xl bg-gradient-to-b from-sky-50 to-white flex items-center justify-center overflow-hidden">
              <MrvAppLogo
                className="h-[88%] w-[88%] object-contain drop-shadow-sm"
                loading="eager"
              />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug drop-shadow-sm px-2">
            {APP_TITLE_PRIMARY}
          </h1>
          <div className="mt-3 inline-flex items-center gap-1.5 bg-white/12 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-semibold border border-white/25 shadow-sm">
            <Shield className="w-3.5 h-3.5 shrink-0" />
            {APP_CAMPAIGN_TAG}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-2xl shadow-[0_24px_60px_-16px_rgba(0,0,0,0.35)] p-5 sm:p-7 space-y-4 border border-white/40 w-full"
        >
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted/80">
            <button
              type="button"
              onClick={() => {
                setIsSignup(false);
                setError('');
                setSuccess('');
                setConfirmPassword('');
              }}
              className={`h-10 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                !isSignup ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'
              }`}
            >
              <LogIn className="w-4 h-4 shrink-0" /> Ingresar
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignup(true);
                setError('');
                setSuccess('');
                setConfirmPassword('');
              }}
              className={`h-10 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                isSignup ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'
              }`}
            >
              <UserPlus className="w-4 h-4 shrink-0" /> Registro
            </button>
          </div>

          {!isSignup && biometricAvailable && biometricReady && (
            <button
              type="button"
              onClick={() => void handleBiometricLogin()}
              disabled={loading}
              className="w-full h-11 rounded-xl border border-primary/30 bg-primary/5 text-primary font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/10 disabled:opacity-50"
            >
              <Fingerprint className="w-4 h-4" /> Ingresar con biometría
            </button>
          )}

          {signOutNotice && (
            <div
              role="status"
              className="rounded-xl border border-amber-400/80 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 p-3 text-sm flex gap-2 items-start"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
              <p className="flex-1 leading-snug">{signOutNotice}</p>
              <button
                type="button"
                onClick={() => dismissSignOutNotice()}
                className="shrink-0 text-amber-900/70 hover:text-amber-950 font-bold px-1"
                aria-label="Cerrar aviso"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {isSignup && (
            <>
              <div>
                <label className="field-label flex items-center gap-1">
                  <Search className="w-3 h-3" /> Buscar en nómina MRV (CI o nombre)
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={e => handleSearchChange(e.target.value)}
                    className="auth-input pr-24"
                    placeholder="CI (mín. 5 dígitos) o nombre y apellido (mín. 4 letras)…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void searchUsers(searchQuery);
                      }
                    }}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    {searchQuery && (
                      <button 
                        type="button" 
                        onClick={() => void searchUsers(searchQuery)}
                        className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-primary font-semibold text-sm"
                        title="Buscar"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    )}
                    {(searchQuery || nominaMatched) && (
                      <button 
                        type="button" 
                        onClick={clearSelection}
                        className="p-2 hover:bg-secondary rounded-lg transition-colors"
                        title="Limpiar búsqueda"
                      >
                        <X className="w-5 h-5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  
                  {/* Dropdown de sugerencias */}
                  {suggestions.length > 0 && (
                    <div 
                      ref={suggestionsRef}
                      className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto"
                    >
                      {suggestions.map((user) => (
                        <button
                          key={`${user.documento}-${user.nombre}`}
                          type="button"
                          onClick={() => selectUser(user)}
                          className="w-full px-4 py-3 hover:bg-primary/10 text-left border-b last:border-b-0 transition-colors"
                        >
                          <div className="font-semibold text-sm text-foreground">
                            CI {user.documento || '—'}
                            {user.nombre
                              ? ` · ${upperText(user.nombre)}`
                              : ' · (completá nombre abajo)'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {user.username && `Usuario: ${user.username}`}
                            {user.email && ` · ${user.email}`}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {searchingUsers && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <div className="text-xs text-primary font-semibold">Buscando...</div>
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {nominaMatched && ciFound && (
                  <div className="mt-2 p-3 bg-success/10 rounded-lg border border-success/30 flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-foreground">
                      <p className="font-semibold">Encontrado en nómina — podés editar los datos abajo</p>
                      <p className="text-muted-foreground">
                        CI: {ciFound.documento}
                        {ciFound.nombre ? ` · ${upperText(ciFound.nombre)}` : ' · Ingresá nombre y apellido'}
                      </p>
                    </div>
                  </div>
                )}

                {searchError && (
                  <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-200 flex gap-2 text-xs">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-red-800">⚠️ Error en búsqueda</p>
                      <p className="text-red-700 text-xs">{searchError}</p>
                      <p className="text-red-600 mt-1">
                        🔧 <a 
                          href="javascript:void(0)" 
                          onClick={() => setSearchError('')}
                          className="underline hover:text-red-700 font-semibold"
                        >
                          Reintentar
                        </a>
                      </p>
                    </div>
                  </div>
                )}

                {searchQuery.trim().length >= minCharsForSignupSearch(searchQuery) && lastSearchedQuery === searchQuery.trim() && suggestions.length === 0 && !searchingUsers && !searchError && (
                  <div className="mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200 flex flex-col gap-2 text-xs">
                    <div className="flex gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-amber-800">No encontrado en nómina</p>
                        <p className="text-amber-700">
                          No hay coincidencias para «{searchQuery.trim()}». Podés registrarte manualmente; requerirá
                          aprobación del administrador.
                        </p>
                      </div>
                    </div>
                    {!manualSignupOpen && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualSignupOpen(true);
                          setNominaMatched(false);
                        }}
                        className="w-full h-9 rounded-lg bg-primary text-primary-foreground font-bold text-sm"
                      >
                        Agregar manualmente y completar formulario
                      </button>
                    )}
                  </div>
                )}

                {searchQuery.trim().length > 0 && searchQuery.trim().length < minCharsForSignupSearch(searchQuery) && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200 flex gap-2 text-xs">
                    <Search className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-blue-800">
                      {/^\d[\d\s.]*$/.test(searchQuery.trim())
                        ? 'Para CI: escribí al menos 5 dígitos (sin puntos ni letras).'
                        : 'Para nombre: al menos 4 letras, o apellido y nombre (ej. Pérez Juan).'}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setManualSignupOpen(true);
                      setNominaMatched(false);
                    }}
                    className="text-xs font-semibold text-primary underline"
                  >
                    No estoy en la nómina — registro manual
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-primary/30 p-3 space-y-2 bg-primary/5">
                <p className="text-xs font-bold text-primary">Región, distrito y servicio de salud</p>
                <p className="text-[10px] text-muted-foreground">
                  Obligatorio para el registro. Si buscaste en nómina, se completan solos al elegir tu nombre.
                </p>
                {orgLoading && regiones.length === 0 ? (
                  <p className="text-xs text-muted-foreground animate-pulse">Cargando catálogo…</p>
                ) : regiones.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    No se cargó el catálogo. Revisá conexión o probá recargar la página.
                  </p>
                ) : null}
                <div className="grid grid-cols-1 gap-2">
                  <select
                    value={signupRegion}
                    onChange={(e) => {
                      setSignupRegion(e.target.value);
                      setSignupDistrito('');
                      setSignupServicio('');
                    }}
                    className="auth-input h-10 text-sm"
                    title="Región sanitaria"
                    aria-label="Región sanitaria"
                    required
                  >
                    <option value="">Región sanitaria…</option>
                    {regiones.map((r) => (
                      <option key={r.id} value={r.nombre}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                  <select
                    value={signupDistrito}
                    onChange={(e) => {
                      setSignupDistrito(e.target.value);
                      setSignupServicio('');
                    }}
                    disabled={!signupRegion}
                    className="auth-input h-10 text-sm disabled:opacity-50"
                    title="Distrito"
                    aria-label="Distrito"
                    required
                  >
                    <option value="">Distrito…</option>
                    {signupDistritos.map((d) => (
                      <option key={d.id} value={d.nombre}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                  <select
                    value={signupServicio}
                    onChange={(e) => setSignupServicio(e.target.value)}
                    disabled={!signupDistrito}
                    className="auth-input h-10 text-sm disabled:opacity-50"
                    title="Servicio"
                    aria-label="Servicio"
                  >
                    <option value="">Servicio (opcional)…</option>
                    {signupServicios.map((s) => (
                      <option key={s.id} value={s.nombre}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(manualSignupOpen || nominaMatched || ci.trim().length >= 5) && (
              <>
              <div>
                <label className="field-label flex items-center gap-1">
                  <CreditCard className="w-3 h-3" /> Documento / CI <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={ci}
                  onChange={(e) => {
                    setCi(normalizeNominaDocumento(e.target.value));
                    setNominaMatched(false);
                  }}
                  className="auth-input"
                  placeholder="Ej: 1234567"
                  required
                />
                <p className="text-[10px] text-muted-foreground mt-1">Obligatorio. Solo números, mínimo 5 dígitos.</p>
              </div>

              <div>
                <label className="field-label flex items-center gap-1">
                  <User className="w-3 h-3" /> Nombre completo <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) =>
                    setDisplayName(nominaMatched ? e.target.value : upperText(e.target.value))
                  }
                  className="auth-input uppercase"
                  placeholder="EJ: JUAN PÉREZ GÓMEZ"
                  style={nominaMatched ? undefined : { textTransform: 'uppercase' }}
                  required
                />
              </div>

              <div>
                <label className="field-label flex items-center gap-1">
                  <AtSign className="w-3 h-3" /> Usuario <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  className="auth-input"
                  placeholder="Ej: jperez o tu CI"
                  required
                />
                <p className="text-[10px] text-muted-foreground mt-1">Para iniciar sesión. Podés cambiarlo si hace falta.</p>
              </div>
              </>
              )}
            </>
          )}

          <div>
            <label className="field-label normal-case flex items-center gap-1">
              <Mail className="w-3 h-3" /> {isSignup ? 'Correo electrónico' : 'Usuario o correo'}
              {isSignup && <span className="text-destructive">*</span>}
            </label>
            <input
              type={isSignup ? 'email' : 'text'}
              value={identifier}
              onChange={(e) => {
                const v = e.target.value;
                setIdentifier(isSignup ? v.trim().toLowerCase() : v.trim().toLowerCase());
              }}
              className="auth-input"
              placeholder={isSignup ? 'tu.nombre@mspbs.gov.py' : 'usuario (ci) o correo'}
              title={isSignup ? 'Formato: usuario@dominio.com' : 'Puedes usar tu usuario/CI o correo electrónico'}
              required={isSignup}
            />
            {isSignup && (
              <p className="text-xs text-muted-foreground mt-1">
                Correo real de trabajo. Si la nómina trae un correo técnico, escribí el tuyo aquí.
              </p>
            )}
          </div>

          {!isSignup && isNative && biometricAvailable && (
            <label className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={rememberBiometric}
                onChange={(e) => setRememberBiometric(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Recordar este dispositivo y habilitar ingreso por biometría (huella/rostro) después del primer ingreso
                correcto.
              </span>
            </label>
          )}

          <div>
            <label className="field-label flex items-center gap-1">
              <Lock className="w-3 h-3" /> Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input pr-12"
                placeholder={isSignup ? 'Contraseña segura' : 'Tu contraseña'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {isSignup && (
              <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{PASSWORD_HINT}</p>
            )}
          </div>

          {isSignup && (
            <div>
              <label className="field-label flex items-center gap-1">
                <Lock className="w-3 h-3" /> Confirmar contraseña <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="auth-input pr-12"
                  placeholder="Repetí la contraseña"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-label={showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-[10px] text-destructive mt-1">Las contraseñas no coinciden.</p>
              )}
            </div>
          )}

          {error && (
            <div className="text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-3 space-y-2">
              <p className="text-destructive font-medium">{error}</p>
              {error.includes('Credenciales inválidas') && (
                <p className="text-xs text-muted-foreground">
                  <strong>Consejo:</strong> Asegúrate de usar el usuario/email y contraseña correctos. 
                  Si no tienes cuenta, haz click en "Registrarse" abajo.
                </p>
              )}
              {error.includes('usuario') && error.includes('no existe') && (
                <p className="text-xs text-muted-foreground">
                  <strong>Solución:</strong> Usa tu email para iniciar sesión, o crea una nueva cuenta con el botón de "Registrarse".
                </p>
              )}
              {(error.includes('Error') || error.includes('No se pudo')) && (
                <p className="text-xs text-muted-foreground">
                  <strong>Contacta al admin:</strong> Si el problema persiste, solicita crear tu usuario manualmente. 
                  Ver <a href="https://github.com/mrvai/docs" className="underline text-primary hover:brightness-110">CREAR_USUARIOS.md</a>
                </p>
              )}
            </div>
          )}
          {success && <p className="text-sm text-success font-medium bg-success/10 rounded-lg px-3 py-2">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-[#0055A4] hover:bg-[#003d7a] text-white font-bold text-base active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#0055A4]/30"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : isSignup ? (
              <><UserPlus className="w-5 h-5" /> Registrarse</>
            ) : (
              <><LogIn className="w-5 h-5" /> Ingresar</>
            )}
          </button>

        </form>

        {import.meta.env.VITE_BUILD_ID && (
          <p
            className="text-center text-[10px] text-white/60 font-mono mt-4 tracking-tight px-2"
            title="Si este código no coincide con el último commit en GitHub, el deploy de Firebase no se actualizó."
          >
            Web publicada · commit {import.meta.env.VITE_BUILD_ID.slice(0, 7)}
          </p>
        )}
      </div>
    </div>
  );
}