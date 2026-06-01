import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, CloudUpload, Loader2, WifiOff } from 'lucide-react';
import { getOfflineSyncStatus, type OfflineSyncStatus } from '@/services/mrvOfflineSync';

type Props = {
  isOnline: boolean;
  syncing?: boolean;
  onSync: () => void | Promise<void>;
  onStatusChange?: (status: OfflineSyncStatus) => void;
};

/** Barra mínima: solo offline o pendientes (sin mensajes de éxito repetidos). */
export function OfflineSyncBar({ isOnline, syncing = false, onSync, onStatusChange }: Props) {
  const [status, setStatus] = useState<OfflineSyncStatus | null>(null);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    const s = await getOfflineSyncStatus();
    setStatus(s);
    onStatusChange?.(s);
    return s;
  }, [onStatusChange]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 45_000);
    return () => window.clearInterval(id);
  }, [refresh, isOnline]);

  if (!status) return null;

  const hasPending = status.totalPending > 0;
  if (isOnline && !hasPending) return null;

  return (
    <div
      className={`border-b px-3 py-1.5 sm:px-4 ${
        hasPending
          ? 'bg-amber-50/90 border-amber-200/80 text-amber-950 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-50'
          : 'bg-sky-50/80 border-sky-200/70 text-sky-900 dark:bg-slate-900/80 dark:text-sky-100'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 justify-between max-w-6xl mx-auto">
        <div className="min-w-0 flex-1 text-[11px] sm:text-xs">
          {!isOnline ? (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              Sin conexión — los datos se guardan en el dispositivo
            </span>
          ) : (
            <span>
              <strong>{status.pendingRegistros}</strong> reg.
              {status.pendingDriveImages > 0 && (
                <>
                  {' '}
                  · <strong>{status.pendingDriveImages}</strong> foto(s)
                </>
              )}{' '}
              pendientes
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {hasPending && status.registros.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="h-7 px-2 rounded-md border border-current/15 text-[10px] font-semibold inline-flex items-center gap-0.5"
              aria-expanded={expanded}
            >
              Detalle
              <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          {hasPending && (
            <button
              type="button"
              disabled={syncing || !isOnline}
              onClick={() => void onSync()}
              className="h-7 px-2.5 rounded-md bg-[#0055A4] text-white text-[10px] font-bold inline-flex items-center gap-1 disabled:opacity-50"
              title="Subir pendientes"
            >
              {syncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5" />
              )}
              Sync
            </button>
          )}
        </div>
      </div>

      {expanded && status.registros.length > 0 && (
        <ul className="mt-1.5 max-w-6xl mx-auto text-[10px] space-y-0.5 border-t border-current/10 pt-1.5">
          {status.registros.slice(0, 8).map((r) => (
            <li key={r.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
              <span className="font-semibold truncate">{r.nombre}</span>
              <span className="font-mono opacity-80">{r.documento}</span>
            </li>
          ))}
          {status.registros.length > 8 && (
            <li className="opacity-70">… y {status.registros.length - 8} más</li>
          )}
        </ul>
      )}
    </div>
  );
}
