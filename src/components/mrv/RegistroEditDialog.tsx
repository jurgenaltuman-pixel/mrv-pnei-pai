import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';

export interface RegistroEditFields {
  id: string;
  nombre: string;
  documento: string;
  region: string;
  distrito: string;
  servicio: string;
  barrio: string;
  estado_vacunacion: string;
  motivo: string;
  observaciones: string;
  responsable: string;
}

interface Props {
  registro: RegistroEditFields | null;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}

export default function RegistroEditDialog({ registro, saving, onClose, onSave }: Props) {
  const [form, setForm] = useState<RegistroEditFields | null>(null);

  useEffect(() => {
    setForm(registro);
  }, [registro]);

  if (!registro || !form) return null;

  const field = (key: keyof RegistroEditFields, label: string, opts?: { multiline?: boolean }) => (
    <div>
      <label className="text-[10px] font-bold uppercase text-muted-foreground">{label}</label>
      {opts?.multiline ? (
        <textarea
          className="w-full mt-0.5 min-h-[72px] px-3 py-2 rounded-lg border bg-background text-sm"
          value={form[key] as string}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      ) : (
        <input
          className="w-full mt-0.5 h-10 px-3 rounded-lg border bg-background text-sm"
          value={form[key] as string}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/50">
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border bg-background shadow-xl p-4 space-y-3"
        role="dialog"
        aria-labelledby="registro-edit-title"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 id="registro-edit-title" className="text-lg font-black">
            Editar registro
          </h3>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-lg border flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">CI {registro.documento}</p>

        {field('nombre', 'Nombre')}
        {field('documento', 'Documento')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {field('region', 'Región')}
          {field('distrito', 'Distrito')}
        </div>
        {field('servicio', 'Servicio')}
        {field('barrio', 'Barrio')}
        {field('responsable', 'Responsable')}
        <div>
          <label className="text-[10px] font-bold uppercase text-muted-foreground">Estado vacuna</label>
          <select
            className="w-full mt-0.5 h-10 px-3 rounded-lg border bg-background text-sm"
            value={form.estado_vacunacion}
            onChange={(e) => setForm({ ...form, estado_vacunacion: e.target.value })}
          >
            <option value="vacunado">Vacunado</option>
            <option value="no_vacunado">No vacunado</option>
          </select>
        </div>
        {field('motivo', 'Motivo')}
        {field('observaciones', 'Observaciones', { multiline: true })}

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border font-semibold text-sm">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              onSave({
                nombre: form.nombre.trim(),
                documento: form.documento.trim(),
                region: form.region.trim(),
                distrito: form.distrito.trim(),
                servicio: form.servicio.trim() || null,
                barrio: form.barrio.trim() || null,
                responsable: form.responsable.trim() || null,
                estado_vacuna: form.estado_vacunacion,
                motivo: form.motivo.trim() || null,
                observaciones: form.observaciones.trim() || null,
              })
            }
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
