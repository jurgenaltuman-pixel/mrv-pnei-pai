import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CHUNK_RELOAD_SESSION_KEY, isStaleChunkLoadError } from '@/lib/lazy-with-retry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Error desconocido' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AppErrorBoundary:', error, info.componentStack);
    if (isStaleChunkLoadError(error)) {
      try {
        if (!sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, '1');
          window.location.reload();
          return;
        }
      } catch {
        /* ignore */
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const staleChunk = isStaleChunkLoadError(new Error(this.state.message));
      return (
        <div className="min-h-screen bg-[#0055A4] text-white flex flex-col items-center justify-center p-6 text-center">
          <p className="text-lg font-bold mb-2">
            {staleChunk ? 'Hay una versión nueva de la app' : 'No se pudo iniciar la app'}
          </p>
          <p className="text-sm opacity-90 mb-6 max-w-md break-words">
            {staleChunk
              ? 'Recargá la página para descargar los archivos actualizados (suele pasar tras un despliegue).'
              : this.state.message}
          </p>
          <button
            type="button"
            className="rounded-xl bg-white text-[#0055A4] px-4 py-2 font-semibold"
            onClick={() => {
              try {
                sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
              } catch {
                /* ignore */
              }
              window.location.reload();
            }}
          >
            {staleChunk ? 'Actualizar ahora' : 'Reintentar'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
