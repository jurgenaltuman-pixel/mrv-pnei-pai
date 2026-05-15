import { Component, type ErrorInfo, type ReactNode } from 'react';

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
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0055A4] text-white flex flex-col items-center justify-center p-6 text-center">
          <p className="text-lg font-bold mb-2">No se pudo iniciar la app</p>
          <p className="text-sm opacity-90 mb-6 max-w-md break-words">{this.state.message}</p>
          <button
            type="button"
            className="rounded-xl bg-white text-[#0055A4] px-4 py-2 font-semibold"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
