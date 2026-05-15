import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { dataService } from '@/services/dataService';
import { LogIn, UserPlus, Mail, Lock, User, Shield, Activity, AtSign, Search, AlertCircle, CheckCircle2, X, Eye, EyeOff } from 'lucide-react';

interface UserSuggestion {
  documento: string;
  nombre: string;
  fecha_nacimiento: string | null;
}

export default function LoginPage() {
  const { login, signup } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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
  const [isUserSelected, setIsUserSelected] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (isSignup) {
      if (!displayName.trim()) { setError('Ingrese su nombre completo'); setLoading(false); return; }
      if (!username.trim()) { setError('Ingrese un nombre de usuario'); setLoading(false); return; }
      
      // Validar email robusto
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier.trim())) {
        setError('El correo electrónico no es válido. Use formato: usuario@dominio.com');
        setLoading(false);
        return;
      }
      
      const result = await signup(identifier, password, displayName, username);
      if (!result.ok) setError(result.error || 'Error al registrarse');
      else setSuccess('✅ Cuenta creada exitosamente. Puede iniciar sesión ahora.');
    } else {
      const result = await login(identifier, password);
      if (!result.ok) setError(result.error || 'Credenciales incorrectas');
    }
    setLoading(false);
  };

  const searchUsers = async (query: string) => {
    const trimmedQuery = query.trim();
    setSearchError('');
    
    if (trimmedQuery.length < 2) {
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
      const rows = await dataService.getBasePersonas(trimmedQuery, {
        limit: 12,
        signal: abortControllerRef.current.signal,
      });

      if (abortControllerRef.current.signal.aborted) return;

      const mapped: UserSuggestion[] = rows.map((p) => ({
        documento: p.documento,
        nombre: p.nombre,
        fecha_nacimiento: p.fecha_nacimiento,
      }));

      setSuggestions(mapped);
      setLastSearchedQuery(trimmedQuery);
    } catch (err: unknown) {
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: string }).name) : '';
      if (name !== 'AbortError') {
        console.error('❌ Error en búsqueda:', err);
        setSearchError('Error al buscar usuarios. Intenta de nuevo.');
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
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLastSearchedQuery('');
      return;
    }

    setLastSearchedQuery('');
    const debounceDelay = /^\d+$/.test(trimmed) ? 180 : 280;
    
    debounceTimer.current = setTimeout(() => {
      searchUsers(value);
    }, debounceDelay);
  };

  const selectUser = (user: UserSuggestion) => {
    setCi(user.documento);
    setDisplayName(user.nombre);
    setUsername(user.documento.toLowerCase());
    setCiFound(user);
    setIsUserSelected(true);
    setSuggestions([]);
    setSearchQuery('');
  };

  const clearSelection = () => {
    setCi('');
    setSearchQuery('');
    setSuggestions([]);
    setDisplayName('');
    setUsername('');
    setCiFound(null);
    setIsUserSelected(false);
    setSearchError('');
    setLastSearchedQuery('');
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
    <div className="auth-shell bg-gradient-to-b from-primary via-primary/95 to-primary/80 flex flex-col items-center justify-center p-4 sm:p-6 safe-area-top safe-area-bottom">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-5">
            <div className="w-24 h-24 rounded-2xl bg-white shadow-2xl flex items-center justify-center mx-auto ring-4 ring-white/20">
              <img src="/icon-512.png" alt="Logo MRV" className="h-14 w-14 sm:h-16 sm:w-16 object-contain" />
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-white shadow-lg flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-primary" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight drop-shadow-sm px-2">
            Monitoreo Rápido de Vacunados
          </h1>
          <div className="mt-3 inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white/90 px-3.5 py-1.5 rounded-full text-xs font-bold">
            <Shield className="w-3.5 h-3.5" />
            CVS Sarampión / Rubéola 2026
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 border border-white/20 w-full">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted">
            <button
              type="button"
              onClick={() => { setIsSignup(false); setError(''); setSuccess(''); }}
              className={`h-10 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                !isSignup ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'
              }`}
            >
              <LogIn className="w-4 h-4 shrink-0" /> Ingresar
            </button>
            <button
              type="button"
              onClick={() => { setIsSignup(true); setError(''); setSuccess(''); }}
              className={`h-10 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                isSignup ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'
              }`}
            >
              <UserPlus className="w-4 h-4 shrink-0" /> Registro
            </button>
          </div>

          {isSignup && (
            <>
              <div>
                <label className="field-label flex items-center gap-1">
                  <Search className="w-3 h-3" /> Búsqueda de Usuario (CI o Nombres)
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={e => handleSearchChange(e.target.value)}
                    disabled={isUserSelected}
                    className={`auth-input pr-24 ${isUserSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="Escriba CI o nombre (mínimo 2 caracteres)..." 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        searchUsers(searchQuery);
                      }
                    }}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    {!isUserSelected && searchQuery && (
                      <button 
                        type="button" 
                        onClick={() => searchUsers(searchQuery)}
                        className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-primary font-semibold text-sm"
                        title="Buscar"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    )}
                    {(searchQuery || isUserSelected) && (
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
                  {suggestions.length > 0 && !isUserSelected && (
                    <div 
                      ref={suggestionsRef}
                      className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto"
                    >
                      {suggestions.map((user) => (
                        <button
                          key={user.documento}
                          type="button"
                          onClick={() => selectUser(user)}
                          className="w-full px-4 py-3 hover:bg-primary/10 text-left border-b last:border-b-0 transition-colors"
                        >
                          <div className="font-semibold text-sm text-foreground">{user.documento} - {user.nombre}</div>
                          <div className="text-xs text-muted-foreground">
                            {user.fecha_nacimiento && `Nac: ${user.fecha_nacimiento}`}
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

                {isUserSelected && ciFound && (
                  <div className="mt-2 p-3 bg-success/10 rounded-lg border border-success/30 flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-foreground">
                      <p className="font-semibold">✅ {ciFound.nombre}</p>
                      <p className="text-muted-foreground">CI: {ciFound.documento}</p>
                      {ciFound.fecha_nacimiento && <p className="text-muted-foreground">Nac: {ciFound.fecha_nacimiento}</p>}
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

                {searchQuery.trim().length >= 2 && lastSearchedQuery === searchQuery.trim() && suggestions.length === 0 && !searchingUsers && !isUserSelected && !searchError && (
                  <div className="mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200 flex gap-2 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-amber-800">⚠️ No encontrado</p>
                      <p className="text-amber-700">El valor "{searchQuery.trim()}" no existe. Prueba CI completo o parte del nombre y apellido (ej. "pérez juan").</p>
                      <p className="text-amber-600 mt-1 font-semibold">💡 Tip: Presiona Enter o haz click en 🔍 para buscar manualmente</p>
                    </div>
                  </div>
                )}
                
                {searchQuery.length > 0 && searchQuery.length < 1 && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200 flex gap-2 text-xs">
                    <Search className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-blue-800">Escribe para buscar usuarios</p>
                  </div>
                )}
              </div>

              <div>
                <label className="field-label flex items-center gap-1">
                  <User className="w-3 h-3" /> Nombre completo
                </label>
                <input 
                  type="text" 
                  value={displayName} 
                  onChange={e => !isUserSelected && setDisplayName(e.target.value)}
                  className={`auth-input ${isUserSelected ? 'opacity-50 cursor-not-allowed bg-muted' : ''}`}
                  placeholder="Ej: Lic. Juan Pérez" 
                  readOnly={isUserSelected}
                />
                {isUserSelected && <p className="text-xs text-success mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Verificado de la base de datos</p>}
              </div>

              <div>
                <label className="field-label flex items-center gap-1">
                  <AtSign className="w-3 h-3" /> Usuario
                </label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={e => !isUserSelected && setUsername(e.target.value.toLowerCase())}
                  className={`auth-input ${isUserSelected ? 'opacity-50 cursor-not-allowed bg-muted' : ''}`}
                  placeholder="Ej: jperez" 
                  readOnly={isUserSelected}
                />
                {isUserSelected && <p className="text-xs text-success mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Verificado de la base de datos</p>}
              </div>
            </>
          )}

          <div>
            <label className="field-label flex items-center gap-1">
              <Mail className="w-3 h-3" /> {isSignup ? 'Correo electrónico' : 'Usuario o correo'}
            </label>
            <input 
              type={isSignup ? 'email' : 'text'} 
              value={identifier} 
              onChange={e => setIdentifier(e.target.value)}
              className="auth-input"
              placeholder={isSignup ? 'usuario@mspbs.gov.py' : 'Usuario (CI) o correo'}
              title={isSignup ? 'Formato: usuario@dominio.com' : 'Puedes usar tu usuario/CI o correo electrónico'}
            />
            {isSignup && <p className="text-xs text-muted-foreground mt-1">Ej: tunombre@mspbs.gov.py</p>}
          </div>

          <div>
            <label className="field-label flex items-center gap-1">
              <Lock className="w-3 h-3" /> Contraseña
            </label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                className="auth-input pr-12"
                placeholder="Mínimo 6 caracteres" 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

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

          <button type="submit" disabled={loading}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-base active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:brightness-110">
            {loading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : isSignup ? (
              <><UserPlus className="w-5 h-5" /> Registrarse</>
            ) : (
              <><LogIn className="w-5 h-5" /> Ingresar</>
            )}
          </button>

        </form>
      </div>
    </div>
  );
}