import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { KeyRound, ShieldAlert, Loader2, Eye, EyeOff } from 'lucide-react';
import { PASSWORD_HINT, validateStrongPassword } from '@/lib/password-policy';

export default function ForcePasswordChangePage() {
  const { user, changePassword, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const pwErr = validateStrongPassword(password);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    const result = await changePassword(password);
    setLoading(false);
    if (!result.ok) setError(result.error || 'No se pudo cambiar la contraseña.');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card rounded-2xl border shadow-sm p-6">
        <div className="text-center mb-5">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-extrabold tracking-tight">Cambio obligatorio de contraseña</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {user?.email || 'Tu cuenta'} debe actualizar su contraseña antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="field-label">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-3 pr-10 rounded-lg border bg-background text-sm"
                placeholder="Contraseña segura"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{PASSWORD_HINT}</p>
          </div>
          <div>
            <label className="field-label">Confirmar contraseña</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full h-11 px-3 pr-10 rounded-lg border bg-background text-sm"
                placeholder="Repetir contraseña"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                title={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showConfirm ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {loading ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>

        <button
          type="button"
          onClick={logout}
          className="w-full h-10 mt-3 rounded-xl bg-secondary text-secondary-foreground font-semibold text-sm"
        >
          Salir
        </button>
      </div>
    </div>
  );
}

