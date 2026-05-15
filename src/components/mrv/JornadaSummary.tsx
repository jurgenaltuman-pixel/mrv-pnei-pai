import { Home, FileCheck } from 'lucide-react';
import { casasAbiertasCerradas, type JornadaStats } from '@/lib/jornada-storage';

interface Props {
  stats: JornadaStats;
}

export default function JornadaSummary({ stats }: Props) {
  const contador = {
    efectivas: stats.efectivas,
    noEfectivas: stats.noEfectivas,
    fallidas: stats.fallidas,
    renuentes: stats.renuentes,
  };
  const { abiertas, cerradas, total } = casasAbiertasCerradas(contador);

  if (total === 0 && stats.registrosGuardados === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-primary/5 px-3 py-2 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <Home className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-bold text-foreground truncate">
          Jornada: {total} casas · {stats.registrosGuardados} encuestas
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-semibold">
        <span className="text-success">{abiertas} abiertas</span>
        <span className="text-warning">{cerradas} cerradas</span>
        <span className="text-muted-foreground flex items-center gap-1">
          <FileCheck className="w-3 h-3" />
          E{stats.efectivas} N{stats.noEfectivas} F{stats.fallidas} R{stats.renuentes}
        </span>
      </div>
    </div>
  );
}
