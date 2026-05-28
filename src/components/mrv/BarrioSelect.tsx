import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchBarriosForDistrito } from '@/lib/fetch-barrios';
import { useOrgStructure } from '@/hooks/useOrgStructure';
import { upperText } from '@/lib/text-uppercase';
import { Loader2, ChevronDown } from 'lucide-react';

interface Props {
  distritoId: number | null;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export default function BarrioSelect({ distritoId, value, onChange, disabled }: Props) {
  const { getBarriosByDistrito } = useOrgStructure();
  const [barrios, setBarrios] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const prevDistritoRef = useRef<number | null>(null);

  useEffect(() => {
    if (!distritoId) {
      setBarrios([]);
      setFilter('');
      if (prevDistritoRef.current != null) onChange('');
      prevDistritoRef.current = null;
      return;
    }
    if (prevDistritoRef.current != null && prevDistritoRef.current !== distritoId) {
      onChange('');
      setFilter('');
    }
    prevDistritoRef.current = distritoId;

    const fromCache = getBarriosByDistrito(distritoId).map((b) => ({
      id: Number(b.id),
      nombre: String(b.nombre),
    }));
    if (fromCache.length) setBarrios(fromCache);

    let cancelled = false;
    setLoading(true);
    void fetchBarriosForDistrito(distritoId).then((rows) => {
      if (!cancelled) {
        if (rows.length) setBarrios(rows);
        else if (!fromCache.length) setBarrios([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- limpiar barrio solo al cambiar distrito
  }, [distritoId]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return barrios.slice(0, 120);
    return barrios.filter((b) => b.nombre.toLowerCase().includes(q)).slice(0, 120);
  }, [barrios, filter]);

  const valueEnCatalogo = useMemo(() => {
    if (!value.trim() || !barrios.length) return true;
    const q = value.trim().toLowerCase();
    return barrios.some((b) => b.nombre.toLowerCase() === q);
  }, [barrios, value]);

  const displayValue = open ? filter : value;

  const pickBarrio = (nombre: string) => {
    onChange(upperText(nombre));
    setFilter('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          onChange={(e) => {
            const v = upperText(e.target.value);
            setFilter(v);
            onChange(v);
            setOpen(true);
          }}
          onFocus={() => {
            setFilter(value);
            setOpen(true);
          }}
          disabled={disabled || !distritoId || loading}
          placeholder={
            loading
              ? 'Cargando barrios…'
              : distritoId
                ? barrios.length
                  ? `Elegir barrio de este distrito (${barrios.length.toLocaleString('es-PY')})`
                  : 'Sin barrios en catálogo — escriba el nombre'
                : 'Seleccioná distrito primero'
          }
          className="w-full h-10 pl-3 pr-9 rounded-lg border bg-background text-sm mrv-field-text"
          autoComplete="off"
          list={undefined}
        />
        {loading ? (
          <Loader2 className="absolute right-2.5 top-2.5 w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown className="absolute right-2.5 top-2.5 w-5 h-5 text-muted-foreground pointer-events-none" />
        )}
      </div>

      {open && distritoId && !loading && barrios.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border bg-popover shadow-lg text-sm"
          role="listbox"
        >
          {filtered.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent truncate"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickBarrio(b.nombre)}
              >
                {b.nombre}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground text-xs">Sin coincidencias en este distrito</li>
          )}
          {barrios.length > filtered.length && filter.trim() === '' && (
            <li className="px-3 py-1.5 text-[10px] text-muted-foreground border-t">
              Escribí para filtrar · solo barrios de este distrito
            </li>
          )}
        </ul>
      )}

      {distritoId && !loading && barrios.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-1">
          {barrios.length.toLocaleString('es-PY')} barrios en este distrito
        </p>
      )}

      {distritoId && !loading && value.trim() && !valueEnCatalogo && barrios.length > 0 && (
        <p className="text-[10px] text-warning font-semibold mt-1">
          Elegí un barrio de la lista de este distrito o corregí el nombre.
        </p>
      )}
    </div>
  );
}
