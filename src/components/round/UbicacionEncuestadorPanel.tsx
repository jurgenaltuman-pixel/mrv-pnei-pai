import { MapPinned } from 'lucide-react';

interface Props {
  region: string;
  distrito: string;
  servicio: string | null;
  barrio: string;
  responsable: string | null;
}

/** Ubicación fija del encuestador (perfil / asignación) — usada en visitas N, F y R. */
export default function UbicacionEncuestadorPanel({
  region,
  distrito,
  servicio,
  barrio,
  responsable,
}: Props) {
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 text-sm space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-primary flex items-center gap-1.5">
        <MapPinned className="w-3.5 h-3.5" />
        Ubicación del encuestador (asignación)
      </p>
      <dl className="grid grid-cols-1 gap-1.5 text-xs">
        <div>
          <dt className="text-muted-foreground">Región</dt>
          <dd className="font-semibold">{region || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Distrito</dt>
          <dd className="font-semibold">{distrito || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Servicio</dt>
          <dd className="font-semibold">{servicio || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Barrio / localidad</dt>
          <dd className="font-semibold">{barrio || '—'}</dd>
        </div>
        {responsable ? (
          <div>
            <dt className="text-muted-foreground">Responsable</dt>
            <dd className="font-semibold">{responsable}</dd>
          </div>
        ) : null}
      </dl>
      <p className="text-[10px] text-muted-foreground leading-snug pt-1 border-t border-border/60">
        Zona administrativa de la visita (perfil / asignación). Además, abajo debés registrar el GPS o enlace de mapa en el punto de la casa (obligatorio).
      </p>
    </div>
  );
}
