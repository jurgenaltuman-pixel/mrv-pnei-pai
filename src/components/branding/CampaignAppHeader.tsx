import { LogOut, WifiOff, User } from 'lucide-react';
import { APP_TITLE_PRIMARY } from '@/lib/app-branding';

export interface CampaignAppHeaderProps {
  user: { nombre: string; email: string } | null;
  isOnline: boolean;
  pendingCount: number;
  onLogout: () => void;
}

const LOGO_SRC = `${import.meta.env.BASE_URL}logo-pnei-pai-mspbs.png`.replace(/\/{2,}/g, '/');

/** Banner superior institucional: logo PNEI/PAI, título MSPBS y usuario. */
export function CampaignAppHeader({ user, isOnline, pendingCount, onLogout }: CampaignAppHeaderProps) {
  return (
    <header className="relative border-b border-sky-200/70 bg-gradient-to-b from-white via-sky-50/40 to-sky-100/30 text-slate-900 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.12)] backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-4">
        <div className="shrink-0">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-white ring-2 ring-sky-200/90 shadow-md overflow-hidden flex items-center justify-center p-0.5">
            <img
              src={LOGO_SRC}
              alt={APP_TITLE_PRIMARY}
              className="h-full w-full object-contain scale-[1.02]"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <h1 className="text-[13px] sm:text-base md:text-lg font-extrabold tracking-tight text-[#0c4a6e] leading-snug">
            {APP_TITLE_PRIMARY}
          </h1>
          {user ? (
            <div className="flex items-start sm:items-center gap-1.5 min-w-0 text-slate-600">
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 mt-0.5 sm:mt-0 text-sky-700/80" aria-hidden />
              <div className="min-w-0 flex flex-col sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2 gap-0">
                {user.email && user.nombre.trim().toLowerCase() === user.email.trim().toLowerCase() ? (
                  <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{user.email}</span>
                ) : (
                  <>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{user.nombre}</span>
                    {user.email ? (
                      <span className="text-[11px] sm:text-sm text-slate-500 truncate">{user.email}</span>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {pendingCount > 0 && (
            <span
              className="inline-flex max-w-[4.5rem] sm:max-w-none truncate rounded-lg bg-amber-100 text-amber-950 px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs font-bold border border-amber-200/80"
              title="Registros pendientes de sincronizar"
            >
              {pendingCount} pend.
            </span>
          )}
          {!isOnline && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 text-amber-950 px-2 py-1 text-[10px] sm:text-xs font-semibold border border-amber-200/80">
              <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Sin conexión</span>
            </span>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white bg-[#0c4a6e] hover:bg-[#0a3d5c] px-2.5 sm:px-3 py-2 rounded-xl shadow-sm border border-sky-900/20 active:scale-[0.98] transition-colors"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
