import { lazy, Suspense } from 'react';
import { ScanLine } from 'lucide-react';
import type { CedulaOcrFields, CedulaOcrTarget } from '@/lib/cedula-ocr-parse';

const CedulaOcrButtons = lazy(() => import('@/components/mrv/CedulaOcrButtons'));

type Props = {
  disabled?: boolean;
  onResult: (target: CedulaOcrTarget, fields: CedulaOcrFields) => void;
  onError?: (message: string) => void;
};

/** Escáner opcional colapsado: solo si no se encontró al niño en el padrón. */
export default function CedulaOcrMinimized({ disabled, onResult, onError }: Props) {
  return (
    <details className="rounded-lg border border-dashed border-primary/30 bg-muted/20 group">
      <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-primary flex items-center gap-1.5 list-none [&::-webkit-details-marker]:hidden">
        <ScanLine className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1">Escanear cédula (opcional · sin internet)</span>
        <span className="text-[9px] font-normal text-muted-foreground group-open:hidden">Abrir</span>
      </summary>
      <div className="px-2 pb-2 border-t border-primary/10">
        <p className="text-[9px] text-muted-foreground py-1.5 leading-snug">
          Si no está en el padrón, podés leer la CI con la cámara. Si falla, completá los campos manuales de abajo.
        </p>
        <Suspense fallback={<p className="text-[10px] text-muted-foreground py-2">Cargando escáner…</p>}>
          <CedulaOcrButtons disabled={disabled} onResult={onResult} onError={onError} />
        </Suspense>
      </div>
    </details>
  );
}
