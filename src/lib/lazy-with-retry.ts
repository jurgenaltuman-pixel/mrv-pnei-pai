import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export const CHUNK_RELOAD_SESSION_KEY = 'mrv-chunk-reload-once';

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Loading chunk \d+ failed|Importing a module script failed|error loading dynamically imported module/i;

export function isStaleChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return CHUNK_ERROR_RE.test(msg);
}

/** Tras un deploy, el bundle en memoria puede pedir chunks viejos (404). Recarga una vez. */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  label?: string
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((err: unknown) => {
      if (!isStaleChunkLoadError(err)) throw err;

      try {
        if (!sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, '1');
          console.warn(`[MRV] Chunk desactualizado${label ? ` (${label})` : ''}, recargando…`, err);
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      } catch {
        /* sessionStorage no disponible */
      }

      throw err;
    })
  );
}

export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
