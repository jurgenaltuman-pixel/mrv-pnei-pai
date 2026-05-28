import { FUENTES_VERIFICACION, type FuenteVerificacion } from '@/lib/mrv-constants';
import { ClipboardCheck } from 'lucide-react';

interface Props {
  fuenteVerificacion: FuenteVerificacion | '';
  setFuenteVerificacion: (v: FuenteVerificacion) => void;
}

export default function VerificacionSection({ fuenteVerificacion, setFuenteVerificacion }: Props) {
  return (
    <div className="section-card border-l-4 border-l-primary/60">
      <div className="section-title">
        <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
          3
        </span>
        <ClipboardCheck className="w-4 h-4 text-primary" />
        Fuente de verificación
      </div>

      <div>
        <label className="field-label flex items-center gap-1">
          Fuente de verificación <span className="text-destructive font-bold">*</span>
        </label>
        <select
          value={fuenteVerificacion}
          onChange={(e) => setFuenteVerificacion(e.target.value as FuenteVerificacion)}
          className="w-full h-11 px-3 rounded-lg border bg-background text-sm font-medium"
          title="Fuente de verificación"
        >
          <option value="">Seleccionar fuente...</option>
          {FUENTES_VERIFICACION.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
