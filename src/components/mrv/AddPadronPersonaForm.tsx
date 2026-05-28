import { useState } from 'react';
import { dataService, type PersonaBase } from '@/services/dataService';
import { generarCodigoTemporalDesdePersona, validarFormatoCodigoTemporal } from '@/lib/temp-code-rve';
import { upperText } from '@/lib/text-uppercase';
import FechaInputPy from '@/components/mrv/FechaInputPy';
import { UserPlus, Loader2 } from 'lucide-react';

const BTN_MRV = 'bg-[#0055A4] hover:bg-[#003d7a] text-white shadow-md';

export type AddPadronPersonaFormProps = {
  documentoSugerido?: string;
  regionSanitaria?: string;
  distrito?: string;
  servicioSalud?: string;
  onGuardada: (persona: PersonaBase) => void;
  onCancelar?: () => void;
};

export default function AddPadronPersonaForm({
  documentoSugerido = '',
  regionSanitaria = '',
  distrito = '',
  servicioSalud = '',
  onGuardada,
  onCancelar,
}: AddPadronPersonaFormProps) {
  const [nombre, setNombre] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [sexo, setSexo] = useState<'M' | 'F' | ''>('');
  const [documento, setDocumento] = useState(documentoSugerido.replace(/\D/g, ''));
  const [sinCi, setSinCi] = useState(!documentoSugerido.replace(/\D/g, ''));
  const [documentoMadre, setDocumentoMadre] = useState('');
  const [nombreMadre, setNombreMadre] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codigoAuto = generarCodigoTemporalDesdePersona(nombre, fechaNacimiento);
  const documentoFinal = sinCi ? codigoAuto || '' : documento.trim();
  const docValido = sinCi ? Boolean(codigoAuto && validarFormatoCodigoTemporal(codigoAuto)) : documento.length >= 6;

  const guardar = async () => {
    setError(null);
    if (!nombre.trim() || nombre.trim().length < 3) {
      setError('Ingresá el nombre completo del niño/a.');
      return;
    }
    if (!fechaNacimiento) {
      setError('La fecha de nacimiento es obligatoria.');
      return;
    }
    if (!sexo) {
      setError('Seleccioná el sexo.');
      return;
    }
    if (!docValido || !documentoFinal) {
      setError(
        sinCi
          ? 'Complete nombre y fecha para generar el código (iniciales + DDMMAAAA).'
          : 'Ingresá un número de CI válido (6 dígitos o más).'
      );
      return;
    }
    const ciMadre = documentoMadre.replace(/\D/g, '');
    if (ciMadre.length < 6) {
      setError('La CI de la madre es obligatoria (mínimo 6 dígitos).');
      return;
    }
    if (nombreMadre.trim().length < 3) {
      setError('El nombre de la madre es obligatorio.');
      return;
    }

    setSaving(true);
    const { persona, error: err } = await dataService.crearPersonaEnPadron({
      nombre: upperText(nombre.trim()),
      documento: sinCi ? documentoFinal : documento.replace(/\D/g, ''),
      tipo_documento: sinCi ? 'DEX' : 'CI',
      fecha_nacimiento: fechaNacimiento,
      sexo,
      region_sanitaria: regionSanitaria || null,
      distrito: distrito || null,
      servicio_salud: servicioSalud || null,
      documento_madre: documentoMadre.replace(/\D/g, '') || null,
      nombre_madre: nombreMadre.trim() || null,
    });
    setSaving(false);
    if (err || !persona) {
      setError(err || 'No se pudo guardar en el padrón.');
      return;
    }
    onGuardada(persona);
  };

  return (
    <div className="rounded-xl border-2 border-amber-400/80 bg-amber-50/90 dark:bg-amber-950/40 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <UserPlus className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100">Añadir persona al padrón</p>
          <p className="text-xs text-amber-800/90 dark:text-amber-200/90 mt-0.5">
            No se encontró al niño/a en el padrón. Completá los datos para registrarlo y continuar la visita.
          </p>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
          Nombre completo *
        </label>
        <input
          value={nombre}
          onChange={(e) => setNombre(upperText(e.target.value))}
          className="w-full h-10 px-3 rounded-lg border bg-background text-sm mrv-field-text"
          placeholder="Apellidos y nombres"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
            Fecha de nacimiento *
          </label>
          <FechaInputPy value={fechaNacimiento} onChange={setFechaNacimiento} />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
            Sexo *
          </label>
          <div className="flex gap-2">
            {(['M', 'F'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSexo(s)}
                className={`flex-1 h-10 rounded-lg font-semibold text-sm border ${
                  sexo === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
                }`}
              >
                {s === 'M' ? 'Masculino' : 'Femenino'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-xs cursor-pointer mb-2">
          <input type="checkbox" checked={sinCi} onChange={(e) => setSinCi(e.target.checked)} />
          Sin CI — usar código temporal (iniciales + DDMMAAAA)
        </label>
        {!sinCi ? (
          <input
            value={documento}
            onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ''))}
            className="w-full h-10 px-3 rounded-lg border bg-background text-sm font-mono"
            placeholder="Número de CI"
            inputMode="numeric"
          />
        ) : (
          <div className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm">
            {codigoAuto || 'Complete nombre y fecha para generar el código'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
            CI madre *
          </label>
          <input
            value={documentoMadre}
            onChange={(e) => setDocumentoMadre(e.target.value.replace(/\D/g, ''))}
            className="h-10 px-3 rounded-lg border bg-background text-sm w-full"
            placeholder="6–8 dígitos"
            inputMode="numeric"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
            Nombre madre *
          </label>
          <input
            value={nombreMadre}
            onChange={(e) => setNombreMadre(e.target.value)}
            className="h-10 px-3 rounded-lg border bg-background text-sm w-full"
            placeholder="Apellidos y nombres"
          />
        </div>
      </div>

      {error && <p className="text-xs text-destructive font-medium">{error}</p>}

      <div className="flex flex-wrap gap-2 justify-end">
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="h-10 px-4 rounded-lg border text-sm font-semibold">
            Cancelar
          </button>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={() => void guardar()}
          className={`h-10 px-4 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 ${BTN_MRV}`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Guardar en padrón
        </button>
      </div>
    </div>
  );
}
