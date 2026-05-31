import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, CloudUpload, Loader2, WifiOff } from 'lucide-react';
import { getOfflineSyncStatus, type OfflineSyncStatus } from '@/services/mrvOfflineSync';

type Props = {
  isOnline: boolean;
  syncing?: boolean;
  onSync: () => void | Promise<void>;
  onStatusChange?: (status: OfflineSyncStatus) => void;
};

export function OfflineSyncBar({ isOnline, syncing = false, onSync, onStatusChange }: Props) {
  const [status, setStatus] = useState<OfflineSyncStatus | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  const refresh = useCallback(async () => {
    const s = await getOfflineSyncStatus();
    setStatus(s);
    onStatusChange?.(s);
    if (s.allSynced) setJustSynced(true);
    return s;
  }, [onStatusChange]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [refresh, isOnline]);

  useEffect(() => {
    if (!justSynced) return;
    const t = window.setTimeout(() => setJustSynced(false), 8000);
    return () => window.clearTimeout(t);
  }, [justSynced]);

  const handleSync = async () => {
    setLastMessage(null);
    await onSync();
    const s = await refresh();
    if (s.allSynced) {
      setLastMessage('Verificado: no quedan registros ni fotos pendientes en este dispositivo.');
    }
  };

  if (!status) return null;

  const hasPending = status.totalPending > 0;
  const showBar = hasPending || !isOnline || justSynced || lastMessage;

  if (!showBar) return null;

  return (
    <div
      className={`border-b px-3 py-2 sm:px-4 ${
        hasPending
          ? 'bg-amber-50 border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-50'
          : justSynced
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
            : 'bg-sky-50 border-sky-200 text-sky-900 dark:bg-slate-900 dark:text-sky-100'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 justify-between max-w-6xl mx-auto">
        <div className="min-w-0 flex-1 text-xs sm:text-sm">
          {!isOnline ? (
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <WifiOff className="w-4 h-4 shrink-0" />
              Modo offline — los datos se guardan en el teléfono
            </span>
          ) : hasPending ? (
            <span>
              <strong>{status.pendingRegistros}</strong> registro(s)
              {status.pendingDriveImages > 0 && (
                <>
                  {' '}
                  y <strong>{status.pendingDriveImages}</strong> foto(s)
                </>
              )}{' '}
              pendientes de subir al servidor
            </span>
          ) : justSynced ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4" /> Todo sincronizado
            </span>
          ) : (
            <span>Sincronización</span>
          )}
          {lastMessage && (
            <p className="text-[11px] mt-0.5 opacity-90 line-clamp-2" role="status">
              {lastMessage}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasPending && status.registros.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="h-9 px-2 rounded-lg border border-current/20 text-[11px] font-semibold inline-flex items-center gap-1"
              aria-expanded={expanded}
            >
              Detalle
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button
            type="button"
            disabled={syncing || !isOnline}
            onClick={() => void handleSync()}
            className="h-9 px-3 rounded-lg bg-[#0055A4] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
            title={!isOnline ? 'Conectate a internet para sincronizar' : 'Subir registros y fotos pendientes'}
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CloudUpload className="w-4 h-4" />
            )}
            {syncing ? 'Subiendo…' : 'Sincronizar todo'}
          </button>
        </div>
      </div>

      {expanded && status.registros.length > 0 && (
        <ul className="mt-2 max-w-6xl mx-auto text-[11px] space-y-1 border-t border-current/10 pt-2">
          {status.registros.slice(0, 12).map((r) => (
            <li key={r.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
              <span className="font-semibold truncate">{r.nombre}</span>
              <span className="font-mono opacity-80">{r.documento}</span>
              {r.lastError && (
                <span className="text-destructive truncate" title={r.lastError}>
                  · {r.lastError}
                </span>
              )}
            </li>
          ))}
          {status.registros.length > 12 && (
            <li className="opacity-70">… y {status.registros.length - 12} más</li>
          )}
        </ul>
      )}
    </div>
  );
}
