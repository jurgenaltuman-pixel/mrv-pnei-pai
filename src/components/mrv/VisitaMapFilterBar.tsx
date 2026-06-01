import { Filter } from 'lucide-react';
import type { VisitaMapFilter } from '@/lib/visita-filter';

const FILTROS: { id: VisitaMapFilter; label: string; title?: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'vacunado', label: 'E vacunado', title: 'Casa efectiva · vacunado' },
  { id: 'no_vacunado', label: 'E no vac.', title: 'Casa efectiva · no vacunado' },
  { id: 'N', label: 'N', title: 'No efectiva' },
  { id: 'F', label: 'F', title: 'Fallida' },
  { id: 'R', label: 'R', title: 'Renuente' },
];

interface Props {
  value: VisitaMapFilter;
  onChange: (value: VisitaMapFilter) => void;
  className?: string;
}

export default function VisitaMapFilterBar({ value, onChange, className = '' }: Props) {
  return (
    <div className={`flex gap-1.5 overflow-x-auto pb-1 ${className}`}>
      {FILTROS.map((f) => (
        <button
          key={f.id}
          type="button"
          title={f.title}
          onClick={() => onChange(f.id)}
          className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold flex items-center gap-1 ${
            value === f.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
          }`}
        >
          <Filter className="w-3 h-3 opacity-70" />
          {f.label}
        </button>
      ))}
    </div>
  );
}
