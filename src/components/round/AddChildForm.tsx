import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { filtrarNombres } from '@/lib/nombres-frecuentes';
import type { DosisSprOpcion, NinoCasa } from '@/types/round-monitoring';

interface Props {
  nombresRonda: string[];
  onSave: (nino: Omit<NinoCasa, 'id'>) => void;
  onCancel: () => void;
}

export default function AddChildForm({ nombresRonda, onSave, onCancel }: Props) {
  const [nombre, setNombre] = useState('');
  const [edadValor, setEdadValor] = useState('');
  const [edadUnidad, setEdadUnidad] = useState<'meses' | 'anos'>('anos');
  const [dosisSpr, setDosisSpr] = useState<DosisSprOpcion | null>(null);
  const [showList, setShowList] = useState(false);

  const sugerencias = useMemo(
    () => filtrarNombres(nombre, nombresRonda, 14),
    [nombre, nombresRonda]
  );

  const canSave =
    nombre.trim().length >= 2 &&
    Number(edadValor) > 0 &&
    dosisSpr !== null;

  const handleSave = () => {
    if (!canSave || !dosisSpr) return;
    const vacunado = dosisSpr === '2plus';
    onSave({
      nombre: nombre.trim(),
      edadValor: Number(edadValor),
      edadUnidad,
      dosisSpr,
      vacunado,
    });
  };

  return (
    <div className="section-card">
      <h2 className="section-title">Añadir niño/a</h2>

      <label className="field-label">Nombre del niño/a</label>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          className="w-full rounded-xl border pl-11 pr-10 py-3 min-h-[48px] text-base"
          placeholder="Buscar nombre…"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            setShowList(true);
          }}
          onFocus={() => setShowList(true)}
          autoComplete="off"
        />
        {nombre && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2"
            onClick={() => setNombre('')}
            aria-label="Limpiar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {showList && nombre.trim().length >= 1 && (
          <ul className="absolute z-20 left-0 right-0 mt-1 bg-card border rounded-xl shadow-lg max-h-56 overflow-y-auto">
            {sugerencias.length === 0 ? (
              <li className="px-4 py-3 min-h-[48px] text-sm text-muted-foreground">
                Sin coincidencias — escribí el nombre completo y guardá
              </li>
            ) : (
              sugerencias.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 min-h-[48px] text-base hover:bg-accent active:bg-accent"
                    onClick={() => {
                      setNombre(s);
                      setShowList(false);
                    }}
                  >
                    {s}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <label className="field-label">Edad</label>
      <div className="flex gap-2 mb-4">
        <input
          type="number"
          min={1}
          max={120}
          className="flex-1 rounded-xl border px-4 py-3 min-h-[48px] text-base"
          value={edadValor}
          onChange={(e) => setEdadValor(e.target.value)}
        />
        <select
          className="rounded-xl border px-3 py-3 min-h-[48px] text-base bg-background"
          value={edadUnidad}
          onChange={(e) => setEdadUnidad(e.target.value as 'meses' | 'anos')}
        >
          <option value="meses">meses</option>
          <option value="anos">años</option>
        </select>
      </div>

      <p className="field-label mb-2">¿Cuántas dosis SPR / Triple Viral tiene el niño/a?</p>
      <div className="flex flex-col gap-2 mb-2">
        <button
          type="button"
          onClick={() => setDosisSpr('1')}
          className={`min-h-[56px] rounded-xl border-2 px-4 text-left font-semibold ${
            dosisSpr === '1' ? 'border-primary bg-primary/10' : 'border-border'
          }`}
        >
          Una (1) dosis — no vacunado
        </button>
        <button
          type="button"
          onClick={() => setDosisSpr('2plus')}
          className={`min-h-[56px] rounded-xl border-2 px-4 text-left font-semibold ${
            dosisSpr === '2plus' ? 'border-success bg-success/10' : 'border-border'
          }`}
        >
          Dos (2) o más dosis — vacunado
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Sin fecha de dosis. Un niño con 1 dosis implica casa <strong>Efectiva (E)</strong>.
      </p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className="min-h-[56px] rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-50"
        >
          Guardar niño/a
        </button>
        <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl border font-semibold">
          Cancelar
        </button>
      </div>
    </div>
  );
}
