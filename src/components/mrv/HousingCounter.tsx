import type { ContadorViviendas } from '@/types/mrv';
import { Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TIPOS_VIVIENDA } from '@/lib/housing-stats';

interface Props {
  contador: ContadorViviendas;
  setContador: (c: ContadorViviendas) => void;
  viviendaTipo: 'efectiva' | 'revisitada' | 'sin_adulto_responsable' | 'renuente';
  setViviendaTipo: (v: 'efectiva' | 'revisitada' | 'sin_adulto_responsable' | 'renuente') => void;
  estadoVacuna?: 'vacunado' | 'no_vacunado' | null;
  setEstadoVacuna?: (v: 'vacunado' | 'no_vacunado') => void;
  esquemaCompleto?: boolean | null;
  setEsquemaCompleto?: (v: boolean) => void;
  libreta?: boolean | null;
  registroRVe?: boolean | null;
  rechazoVacunacion?: boolean;
}

const BOTONES: { tipo: Props['viviendaTipo']; code: 'E' | 'N' | 'F' | 'R' }[] = [
  { tipo: 'efectiva', code: 'E' },
  { tipo: 'revisitada', code: 'N' },
  { tipo: 'sin_adulto_responsable', code: 'F' },
  { tipo: 'renuente', code: 'R' },
];

export default function HousingCounter({
  contador,
  setContador,
  viviendaTipo,
  setViviendaTipo,
  estadoVacuna,
  setEstadoVacuna,
  esquemaCompleto,
  setEsquemaCompleto,
  libreta,
  registroRVe,
  rechazoVacunacion,
}: Props) {
  const { toast } = useToast();
  const total = contador.efectivas + contador.noEfectivas + contador.fallidas + contador.renuentes;
  const tieneRegistro = (libreta === true || registroRVe === true) && !rechazoVacunacion;
  const noTieneRegistro = libreta === false && registroRVe === false && !rechazoVacunacion;

  const keyByTipo: Record<Props['viviendaTipo'], keyof ContadorViviendas> = {
    efectiva: 'efectivas',
    revisitada: 'noEfectivas',
    sin_adulto_responsable: 'fallidas',
    renuente: 'renuentes',
  };

  const update = (key: keyof ContadorViviendas, delta: number) => {
    setContador({ ...contador, [key]: Math.max(0, contador[key] + delta) });
  };

  const addSelected = () => {
    if (noTieneRegistro) {
      const newContador = { efectivas: 0, noEfectivas: 0, fallidas: 0, renuentes: 0 };
      newContador[keyByTipo[viviendaTipo]] = 1;
      setContador(newContador);
    } else if (viviendaTipo === 'efectiva') {
      update(keyByTipo[viviendaTipo], 1);
    } else {
      toast({
        title: 'Solo vivienda Efectiva (E)',
        description: 'Si encuestó al niño, use código E — Abiertas.',
        variant: 'destructive',
      });
    }
  };

  const removeSelected = () => update(keyByTipo[viviendaTipo], -1);

  const handleViviendaTipoChange = (nuevoTipo: Props['viviendaTipo']) => {
    if (tieneRegistro && nuevoTipo !== 'efectiva') {
      toast({
        title: 'Use código E',
        description: 'Con encuesta del niño solo corresponde vivienda Efectiva (abierta).',
        variant: 'destructive',
      });
      return;
    }
    if (noTieneRegistro && nuevoTipo === 'efectiva') {
      toast({
        title: 'Sin encuesta de niño',
        description: 'Use N, F o R (visita sin datos del niño).',
        variant: 'destructive',
      });
      return;
    }
    setViviendaTipo(nuevoTipo);
    if (
      (nuevoTipo === 'renuente' || nuevoTipo === 'sin_adulto_responsable' || nuevoTipo === 'revisitada') &&
      setEstadoVacuna &&
      !estadoVacuna
    ) {
      setEstadoVacuna('no_vacunado');
      if (setEsquemaCompleto) setEsquemaCompleto(false);
    }
  };

  const tipoMeta = TIPOS_VIVIENDA.find(
    (t) =>
      (viviendaTipo === 'efectiva' && t.code === 'E') ||
      (viviendaTipo === 'revisitada' && t.code === 'N') ||
      (viviendaTipo === 'sin_adulto_responsable' && t.code === 'F') ||
      (viviendaTipo === 'renuente' && t.code === 'R')
  );

  return (
    <div className="section-card">
      <div className="section-title">
        <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">6</span>
        Viviendas abordadas <span className="text-destructive font-bold">*</span>
      </div>

      <p className="text-xs text-muted-foreground -mt-1 mb-3 leading-relaxed">
        Por cada casa visitada: elegí el código y pulsá <strong>Añadir casa</strong>.
        {total > 0 && (
          <span className="block mt-1 font-semibold text-foreground">
            Esta visita: {total} casa{total !== 1 ? 's' : ''}
          </span>
        )}
      </p>

      <div className="p-3 rounded-xl border-2 border-primary/20 bg-primary/5 space-y-3">
        <p className="text-[10px] font-bold uppercase text-primary">¿Qué pasó en la última casa?</p>
        <div className="grid grid-cols-2 gap-2">
          {BOTONES.map(({ tipo, code }) => {
            const meta = TIPOS_VIVIENDA.find((t) => t.code === code)!;
            const activo = viviendaTipo === tipo;
            const disabled = (tipo === 'efectiva' && noTieneRegistro) || (tipo !== 'efectiva' && tieneRegistro);
            return (
              <button
                key={code}
                type="button"
                disabled={disabled}
                onClick={() => handleViviendaTipoChange(tipo)}
                className={`text-left p-2.5 rounded-xl border-2 transition-all ${
                  disabled
                    ? 'opacity-35 cursor-not-allowed bg-secondary border-transparent'
                    : activo
                      ? `${meta.borderClass} ${meta.bgSoft} ring-2 ring-primary/30`
                      : 'border-border bg-card'
                }`}
              >
                <span className={`inline-flex w-7 h-7 rounded-md items-center justify-center text-xs font-black mb-1 ${meta.colorClass}`}>
                  {code}
                </span>
                <p className="text-[11px] font-bold leading-tight">{meta.titulo}</p>
                <p className="text-[9px] text-muted-foreground">{meta.grupo === 'cerrada' ? 'Cerrada' : 'Abierta'}</p>
              </button>
            );
          })}
        </div>
        {tipoMeta && (
          <p className="text-[11px] text-center text-muted-foreground px-1">{tipoMeta.descripcion}</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={addSelected}
            className="h-12 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-1"
          >
            <Plus className="w-5 h-5" /> Añadir casa
          </button>
          <button
            type="button"
            onClick={removeSelected}
            disabled={total === 0}
            className="h-12 rounded-xl bg-secondary text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-40"
          >
            <Minus className="w-5 h-5" /> Quitar una
          </button>
        </div>
      </div>
    </div>
  );
}
