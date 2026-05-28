import { useOrgStructure } from '@/hooks/useOrgStructure';
import BarrioSelect from '@/components/mrv/BarrioSelect';
import { supabase } from '@/integrations/supabase/client';
import { formatFechaHoraPy } from '@/lib/format-fecha';
import { useEffect, useMemo, useState } from 'react';
import { MapPin, Loader2, XCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { upperText } from '@/lib/text-uppercase';

function normalizeNombre(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

interface Props {
  geo: {
    lat: number | null;
    lng: number | null;
    status: 'loading' | 'success' | 'error' | 'denied';
    isApproximate?: boolean;
    accuracyM?: number | null;
    offlineCached?: boolean;
    refresh: () => void;
  };
  mapsLink: string;
  setMapsLink: (v: string) => void;
  coordsFromLink: { lat: number; lng: number } | null;
  mapsResolving: boolean;
  regionId: number | null;
  setRegionId: (v: number | null) => void;
  distritoId: number | null;
  setDistritoId: (v: number | null) => void;
  servicioId: number | null;
  setServicioId: (v: number | null) => void;
  servicioManual: string;
  setServicioManual: (v: string) => void;
  barrio: string;
  setBarrio: (v: string) => void;
  responsable: string;
  setResponsable: (v: string) => void;
  distritoNombre: string;
  regionNombre?: string;
  servicioNombre?: string;
  /** Usuario asignado: solo lectura región/distrito/servicio. */
  ubicacionAsignacionFija?: boolean;
  /** Formulario de niño en ronda (casa E): ubicación editable. */
  modoMonitoreoRonda?: boolean;
  cambioResidencia?: boolean;
  setCambioResidencia?: (v: boolean) => void;
  /** Tras editar región/distrito/servicio (solo acción del usuario). */
  onUbicacionSanitariaEdited?: (next: {
    regionId: number | null;
    distritoId: number | null;
    servicioId: number | null;
    servicioManual: string;
  }) => void;
}

/** Ubicación del registro: región/distrito/servicio de salud editables + barrio/GPS de la visita. */
export default function HeaderSection(props: Props) {
  const { regiones, distritos, getDistritosByRegion, getServiciosByDistrito } = useOrgStructure();
  const now = new Date();

  const GpsIcon = props.geo.status === 'success' ? MapPin : props.geo.status === 'loading' ? Loader2 : XCircle;
  const gpsColor =
    props.geo.status === 'success' ? 'text-success' : props.geo.status === 'loading' ? 'text-warning' : 'text-destructive';
  const precisionTxt =
    props.geo.accuracyM != null && !props.geo.isApproximate
      ? ` ±${Math.round(props.geo.accuracyM)} m`
      : '';
  const gpsLabel =
    props.geo.lat !== null && props.geo.lng !== null
      ? `${props.geo.lat.toFixed(5)}, ${props.geo.lng.toFixed(5)}${precisionTxt}${
          props.geo.offlineCached
            ? ' (última posición, sin internet)'
            : props.geo.isApproximate
              ? ' (aproximado)'
              : ''
        }`
      : props.geo.status === 'loading'
        ? 'Obteniendo GPS...'
        : props.geo.status === 'denied'
          ? 'Sin GPS'
          : 'Sin señal GPS';

  const distritoIdEfectivo = useMemo(() => {
    if (props.distritoId) return props.distritoId;
    const nombre = props.distritoNombre?.trim();
    if (!nombre) return null;
    const q = normalizeNombre(nombre);
    return distritos.find((d) => normalizeNombre(d.nombre) === q)?.id ?? null;
  }, [props.distritoId, props.distritoNombre, distritos]);

  const filteredDistritos = props.regionId ? getDistritosByRegion(props.regionId) : [];
  const filteredServicios = distritoIdEfectivo ? getServiciosByDistrito(distritoIdEfectivo) : [];
  const barrioEditable = Boolean(distritoIdEfectivo) || Boolean(props.distritoNombre?.trim());
  const [serviciosFallback, setServiciosFallback] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    async function cargarFallback() {
      if (!props.distritoNombre || filteredServicios.length > 0) {
        setServiciosFallback([]);
        return;
      }
      const { data, error } = await supabase
        .from('base_personas')
        .select('servicio_salud')
        .eq('distrito', props.distritoNombre)
        .not('servicio_salud', 'is', null)
        .limit(500);
      if (error || !active) return;

      const uniques = Array.from(
        new Set((data || []).map((row) => row.servicio_salud?.trim()).filter((value): value is string => Boolean(value)))
      ).sort((a, b) => a.localeCompare(b));
      setServiciosFallback(uniques);
    }
    void cargarFallback();
    return () => {
      active = false;
    };
  }, [props.distritoNombre, filteredServicios.length]);

  const inputServiciosFallback = useMemo(
    () => `servicios-fallback-${props.distritoId ?? 'none'}`,
    [props.distritoId]
  );

  return (
    <div className="section-card">
      <div className="section-title">
        <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
          2
        </span>
        Ubicación del registro y visita
      </div>

      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 text-sm mb-3">
        <div className="col-span-2 min-[360px]:col-span-1">
          <span className="text-muted-foreground text-xs">Fecha y hora:</span>
          <span className="font-semibold ml-1">{formatFechaHoraPy(now)}</span>
        </div>
        <div className="col-span-2 flex items-center gap-1">
          <div className={`${gpsColor} text-xs font-bold flex items-center gap-1`}>
            <GpsIcon className={`w-3.5 h-3.5 ${props.geo.status === 'loading' ? 'animate-spin' : ''}`} />
            <span className="truncate">{gpsLabel}</span>
          </div>
          {(props.geo.status === 'error' || props.geo.status === 'denied') && (
            <button
              type="button"
              onClick={props.geo.refresh}
              className="text-[10px] h-6 px-2 rounded bg-secondary text-secondary-foreground font-semibold"
              title="Reintentar GPS"
            >
              Reintentar
            </button>
          )}
        </div>
      </div>

      {props.ubicacionAsignacionFija && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 mb-3 text-sm space-y-1">
          <p className="text-[10px] font-bold uppercase text-primary">Tu asignación (solo lectura)</p>
          <p>
            <span className="text-muted-foreground">Región:</span>{' '}
            <span className="font-semibold">{props.regionNombre || '—'}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Distrito:</span>{' '}
            <span className="font-semibold">{props.distritoNombre || '—'}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Servicio:</span>{' '}
            <span className="font-semibold">{props.servicioNombre || '—'}</span>
          </p>
          <p className="text-[10px] text-muted-foreground pt-1">
            En casa <span className="font-bold text-foreground">Efectiva (E)</span> elegí abajo el{' '}
            <span className="font-bold text-foreground">barrio de la visita</span> y el{' '}
            <span className="font-bold text-foreground">GPS</span> (editables en cada casa).
          </p>
        </div>
      )}

      {props.modoMonitoreoRonda && (
        <p className="text-[10px] text-muted-foreground mb-2">
          Región, distrito, servicio y barrio de esta visita — editables. El GPS se toma del dispositivo o enlace de mapa.
        </p>
      )}
      {!props.ubicacionAsignacionFija && !props.modoMonitoreoRonda && (
        <p className="text-[10px] text-muted-foreground mb-2">
          Precarga del padrón al buscar al niño/a — editable si la nómina está desactualizada.
        </p>
      )}

      <div className="space-y-2.5">
        {(props.geo.status === 'error' || props.geo.status === 'denied') && (
          <div className="rounded-lg border border-warning/40 bg-warning/5 p-2">
            <p className="text-xs font-semibold text-warning-foreground mb-2">
              GPS no disponible: pegue enlace de mapa o coordenadas (lat,lng).
            </p>
            <div className="space-y-1">
              <input
                value={props.mapsLink}
                onChange={(e) => props.setMapsLink(e.target.value)}
                placeholder="Pegue link de Maps o lat,lng"
                className="h-9 px-3 rounded-lg border bg-background text-xs"
                title="Enlace de mapa o coordenadas"
              />
            </div>
          </div>
        )}

        {!props.ubicacionAsignacionFija && (
          <>
            <div>
              <label className="field-label">Región Sanitaria</label>
              <select
                value={props.regionId ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  props.setRegionId(val);
                  props.setDistritoId(null);
                  props.setServicioId(null);
                  props.setServicioManual('');
                  props.onUbicacionSanitariaEdited?.({
                    regionId: val,
                    distritoId: null,
                    servicioId: null,
                    servicioManual: '',
                  });
                }}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                title="Seleccionar región sanitaria"
              >
                <option value="">Seleccionar...</option>
                {regiones.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
              <div>
                <label className="field-label">Distrito</label>
                <select
                  value={props.distritoId ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    props.setDistritoId(val);
                    props.setServicioId(null);
                    props.setServicioManual('');
                    props.setBarrio('');
                    props.onUbicacionSanitariaEdited?.({
                      regionId: props.regionId,
                      distritoId: val,
                      servicioId: null,
                      servicioManual: '',
                    });
                  }}
                  className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                  disabled={!props.regionId}
                  title="Seleccionar distrito"
                >
                  <option value="">Seleccionar...</option>
                  {filteredDistritos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Servicio</label>
                {filteredServicios.length > 0 ? (
                  <select
                    value={props.servicioId ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      props.setServicioId(val);
                      props.setServicioManual('');
                      props.onUbicacionSanitariaEdited?.({
                        regionId: props.regionId,
                        distritoId: props.distritoId,
                        servicioId: val,
                        servicioManual: '',
                      });
                    }}
                    className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                    disabled={!props.distritoId}
                    title="Seleccionar servicio de salud"
                  >
                    <option value="">Seleccionar...</option>
                    {filteredServicios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      value={props.servicioManual}
                      onChange={(e) => {
                        const manual = upperText(e.target.value);
                        props.setServicioId(null);
                        props.setServicioManual(manual);
                        props.onUbicacionSanitariaEdited?.({
                          regionId: props.regionId,
                          distritoId: props.distritoId,
                          servicioId: null,
                          servicioManual: manual,
                        });
                      }}
                      className="w-full h-10 px-3 rounded-lg border bg-background text-sm mrv-field-text"
                      placeholder={props.distritoId ? 'Escriba o seleccione servicio' : 'Seleccione distrito primero'}
                      disabled={!props.distritoId}
                      list={inputServiciosFallback}
                    />
                    {serviciosFallback.length > 0 && (
                      <datalist id={inputServiciosFallback}>
                        {serviciosFallback.map((servicio) => (
                          <option key={servicio} value={servicio} />
                        ))}
                      </datalist>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        <div>
          <label className="field-label flex items-center gap-1">
            Barrio / Localidad de la visita <span className="text-destructive font-bold">*</span>
          </label>
          <BarrioSelect
            distritoId={distritoIdEfectivo}
            value={props.barrio}
            onChange={props.setBarrio}
            disabled={!barrioEditable}
          />
        </div>
        <div>
          <label className="field-label">Responsable</label>
          <input
            value={props.responsable}
            onChange={(e) => props.setResponsable(upperText(e.target.value))}
            className="w-full h-10 px-3 rounded-lg border bg-background text-sm mrv-field-text"
            placeholder="Nombre y Apellido"
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 bg-muted/20">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Cambio de residencia</p>
            <p className="text-[10px] text-muted-foreground">
              Se activa solo si cambiás región, distrito o servicio respecto al padrón
            </p>
          </div>
          <Switch
            checked={props.cambioResidencia ?? false}
            onCheckedChange={(v) => props.setCambioResidencia?.(v)}
            aria-label="Cambio de residencia"
          />
        </div>
      </div>
    </div>
  );
}
