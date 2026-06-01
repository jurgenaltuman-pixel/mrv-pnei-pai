import { Building2, CloudUpload, Download, LogOut, MapPinned, RefreshCw, Stethoscope, User, WifiOff } from 'lucide-react';
import { APP_TITLE_PRIMARY } from '@/lib/app-branding';
import { APP_BUILD_ID, forceAppUpdate } from '@/lib/force-app-update';
import { ThemeToggle } from '@/components/ThemeToggle';

export interface CampaignAppHeaderProps {
  user: { nombre: string; email: string } | null;
  isOnline: boolean;
  pendingCount: number;
  pendingDriveCount?: number;
  syncing?: boolean;
  onSyncAll?: () => void;
  onLogout: () => void;
  /** Asignación territorial del brigadista (perfil). */
  asignacion?: {
    region: string;
    distrito: string;
    servicio: string;
  };
  pwaInstall?: { canInstall: boolean; onInstall: () => void | Promise<void> };
}

const LOGO_SRC = `${import.meta.env.BASE_URL}logo-mrv-oficial.png`.replace(/\/{2,}/g, '/');

function AssignmentChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPinned;
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 min-w-0 max-w-full rounded-lg bg-white/70 dark:bg-slate-800/80 border border-sky-200/80 dark:border-slate-600 px-2.5 py-1.5 max-lg:px-3 max-lg:py-2 shadow-sm"
      title={`${label}: ${value}`}
    >
      <Icon className="w-3.5 h-3.5 max-lg:w-4 max-lg:h-4 shrink-0 text-sky-800" aria-hidden />
      <span className="text-[9px] max-lg:text-[11px] uppercase font-bold text-sky-900/70 dark:text-sky-300/80 leading-none">
        {label}
      </span>
      <span className="text-[11px] max-lg:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
        {value}
      </span>
    </span>
  );
}

/** Banner superior: logo, asignación centrada, acciones. */
export function CampaignAppHeader({
  user,
  isOnline,
  pendingCount,
  pendingDriveCount = 0,
  syncing = false,
  onSyncAll,
  onLogout,
  asignacion,
  pwaInstall,
}: CampaignAppHeaderProps) {
  const tieneAsignacion = Boolean(
    asignacion?.region?.trim() || asignacion?.distrito?.trim() || asignacion?.servicio?.trim()
  );

  return (
    <header className="sticky top-0 z-40 border-b border-sky-200/70 dark:border-slate-700 bg-gradient-to-b from-white via-sky-50/50 to-sky-100/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.12)] backdrop-blur-md safe-area-top">
      <div className="w-full px-3 sm:px-4 lg:px-6 py-2.5 sm:py-2.5 max-lg:py-3">
        <div className="grid grid-cols-[auto_1fr_auto] items-start gap-2.5 sm:gap-3 max-lg:gap-3">
          <div className="shrink-0 row-span-2 sm:row-span-1 self-center">
            <div className="h-12 w-12 sm:h-14 sm:w-14 max-lg:h-14 max-lg:w-14 rounded-full bg-white dark:bg-slate-800 ring-2 ring-sky-200/90 dark:ring-slate-600 shadow-md overflow-hidden flex items-center justify-center p-0.5">
              <img
                src={LOGO_SRC}
                alt={APP_TITLE_PRIMARY}
                className="h-full w-full object-contain"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>

          <div className="min-w-0 flex flex-col items-center justify-center text-center gap-1 py-0.5">
            <h1 className="text-xs sm:text-sm max-lg:text-[0.95rem] font-extrabold tracking-tight text-[#0c4a6e] dark:text-sky-100 leading-snug line-clamp-2">
              {APP_TITLE_PRIMARY}
            </h1>

            {tieneAsignacion && asignacion ? (
              <div className="w-full max-w-md flex flex-wrap justify-center gap-1 sm:gap-1.5">
                <AssignmentChip icon={MapPinned} label="Región" value={asignacion.region} />
                <AssignmentChip icon={Building2} label="Distrito" value={asignacion.distrito} />
                <AssignmentChip icon={Stethoscope} label="Servicio" value={asignacion.servicio} />
              </div>
            ) : null}

            {user ? (
              <div className="flex items-center justify-center gap-1 min-w-0 text-slate-600 max-w-full">
                <User className="w-3.5 h-3.5 max-lg:w-4 max-lg:h-4 shrink-0 text-sky-700/80" aria-hidden />
                <span className="text-[11px] sm:text-xs max-lg:text-sm font-medium truncate">
                  {user.nombre.trim().toLowerCase() === user.email.trim().toLowerCase()
                    ? user.email
                    : user.nombre}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0 row-span-2 sm:row-span-1 self-center">
            {(pendingCount > 0 || pendingDriveCount > 0 || !isOnline) && (
              <span
                className="inline-flex rounded-lg px-1.5 py-0.5 text-[10px] font-bold border bg-amber-100 text-amber-950 border-amber-200/80"
                title={
                  !isOnline
                    ? 'Sin conexión'
                    : `${pendingCount} registro(s)${pendingDriveCount ? ` · ${pendingDriveCount} foto(s)` : ''} pendientes`
                }
              >
                {!isOnline ? (
                  <WifiOff className="w-3 h-3" aria-hidden />
                ) : (
                  pendingCount + pendingDriveCount
                )}
              </span>
            )}
            <div className="flex flex-col items-stretch gap-1.5">
              {onSyncAll && (
                <button
                  type="button"
                  disabled={syncing || !isOnline}
                  onClick={onSyncAll}
                  className={`h-10 w-10 rounded-xl border inline-flex items-center justify-center active:scale-[0.98] disabled:opacity-50 ${
                    pendingCount > 0 || pendingDriveCount > 0
                      ? 'text-white bg-[#0055A4] hover:bg-[#003d7a] border-sky-900/20'
                      : 'text-[#0c4a6e] bg-white/90 hover:bg-white border-sky-200/80'
                  }`}
                  title={
                    pendingCount > 0 || pendingDriveCount > 0
                      ? 'Sincronizar registros y fotos pendientes'
                      : 'Sincronizar'
                  }
                  aria-label="Sincronizar"
                >
                  <CloudUpload className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
                </button>
              )}
              <ThemeToggle className="!h-10 !w-10 !p-0 !rounded-xl border-sky-200/80 dark:border-slate-600" />
              <button
                type="button"
                onClick={() => void forceAppUpdate()}
                className="h-10 w-10 rounded-xl text-[#0c4a6e] bg-white/90 hover:bg-white border border-sky-200/80 inline-flex items-center justify-center active:scale-[0.98]"
                title={`Actualizar app (v${APP_BUILD_ID})`}
                aria-label="Actualizar aplicación"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {pwaInstall?.canInstall && (
                <button
                  type="button"
                  onClick={() => void pwaInstall.onInstall()}
                  className="h-10 w-10 rounded-xl text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-900/20 inline-flex items-center justify-center active:scale-[0.98]"
                  title="Instalar aplicación"
                  aria-label="Instalar aplicación"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onLogout}
                className="h-10 w-10 rounded-xl text-white bg-[#0c4a6e] hover:bg-[#0a3d5c] inline-flex items-center justify-center shadow-sm border border-sky-900/20 active:scale-[0.98]"
                aria-label="Cerrar sesión"
                title="Salir"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
