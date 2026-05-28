import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  className?: string;
  /** Botón sobre fondo azul Francia (login). */
  variant?: 'default' | 'onPrimary';
};

export function ThemeToggle({ className = '', variant = 'default' }: Props) {
  const { isDark, toggleTheme } = useTheme();
  const onPrimary = variant === 'onPrimary';
  const iconClass = onPrimary
    ? isDark
      ? 'w-5 h-5 text-amber-300'
      : 'w-5 h-5 text-white'
    : isDark
      ? 'w-5 h-5 text-amber-400'
      : 'w-5 h-5 text-slate-700';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center rounded-xl border border-border bg-card/90 backdrop-blur-sm p-2.5 shadow-sm hover:bg-muted transition-colors ${className}`}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
    >
      {isDark ? <Sun className={iconClass} /> : <Moon className={iconClass} />}
    </button>
  );
}
