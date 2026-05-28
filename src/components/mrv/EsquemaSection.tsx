import { useEffect } from 'react';
import { Check, Shield, X } from 'lucide-react';
import { esquemaFromDosisMonitoreo } from '@/lib/mrv-esquema';

interface Props {
  estadoVacuna: 'vacunado' | 'no_vacunado' | null;
  dosisMonitoreo: '1' | '2plus' | null;
  edadTotalMeses?: number | null;
  tieneCvs: boolean | null;
  setTieneCvs: (v: boolean) => void;
  esquemaCompleto: boolean | null;
  setEsquemaCompleto: (v: boolean) => void;
}

export default function EsquemaSection({
  estadoVacuna,
  dosisMonitoreo,
  edadTotalMeses = null,
  tieneCvs,
  setTieneCvs,
  esquemaCompleto,
  setEsquemaCompleto,
}: Props) {
  useEffect(() => {
    if (estadoVacuna === 'vacunado') {
      setTieneCvs(true);
      setEsquemaCompleto(esquemaFromDosisMonitoreo(dosisMonitoreo, edadTotalMeses));
    } else if (estadoVacuna === 'no_vacunado') {
      setTieneCvs(false);
      setEsquemaCompleto(false);
    }
  }, [estadoVacuna, dosisMonitoreo, edadTotalMeses, setTieneCvs, setEsquemaCompleto]);

  const vacunadoCvs = tieneCvs === true;
  const noCvs = tieneCvs === false;

  return (
    <div className="section-card border-l-4 border-l-success/50">
      <div className="section-title">
        <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
          5
        </span>
        <Shield className="w-4 h-4 text-primary" />
        CVS — Esquema de vacunación
      </div>

      <div className="space-y-4">
        <div>
          <label className="field-label flex items-center gap-1">
            ¿Tiene la dosis CVS (SPR) aplicada? <span className="text-destructive font-bold">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setTieneCvs(true);
                if (esquemaCompleto === null) {
                  setEsquemaCompleto(esquemaFromDosisMonitoreo(dosisMonitoreo, edadTotalMeses));
                }
              }}
              className={`mrv-choice-btn mrv-choice-success ${vacunadoCvs ? 'mrv-choice-active' : ''}`}
            >
              <Check className="w-6 h-6 shrink-0" />
              <span>Sí (vacunado CVS)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTieneCvs(false);
                setEsquemaCompleto(false);
              }}
              className={`mrv-choice-btn mrv-choice-danger ${noCvs ? 'mrv-choice-active' : ''}`}
            >
              <X className="w-6 h-6 shrink-0" />
              <span>No</span>
            </button>
          </div>
        </div>

        {tieneCvs !== null && (
          <div>
            <label className="field-label flex items-center gap-1">
              Esquema de vacunación <span className="text-destructive font-bold">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEsquemaCompleto(true)}
                disabled={estadoVacuna === 'no_vacunado'}
                className={`mrv-choice-btn mrv-choice-success ${esquemaCompleto === true ? 'mrv-choice-active' : ''} disabled:opacity-40`}
              >
                <Check className="w-6 h-6 shrink-0" />
                <span className="text-left">
                  <span className="block font-bold">Completo</span>
                  <span className="block text-[10px] opacity-90">2+ dosis SPR</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setEsquemaCompleto(false)}
                className={`mrv-choice-btn mrv-choice-danger ${esquemaCompleto === false ? 'mrv-choice-active' : ''}`}
              >
                <X className="w-6 h-6 shrink-0" />
                <span className="text-left">
                  <span className="block font-bold">Incompleto</span>
                  <span className="block text-[10px] opacity-90">Menos de 2 dosis</span>
                </span>
              </button>
            </div>
            {esquemaCompleto !== null && (
              <p
                className={`mt-2 text-xs font-semibold rounded-lg px-3 py-2 border ${
                  esquemaCompleto
                    ? 'bg-success/10 border-success/30 text-success'
                    : 'bg-warning/10 border-warning/30 text-warning'
                }`}
              >
                Esquema registrado: {esquemaCompleto ? 'Completo' : 'Incompleto'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
