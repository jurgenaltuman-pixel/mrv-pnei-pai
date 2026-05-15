import { useAuth } from '@/contexts/AuthContext';
import { useOrgStructure } from '@/hooks/useOrgStructure';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useMemo, useState } from 'react';
import { MapPin, Loader2, XCircle } from 'lucide-react';

interface Props {
  geo: {
    lat: number | null;
    lng: number | null;
    status: 'loading' | 'success' | 'error' | 'denied';
    isApproximate?: boolean;
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
  regionNombre: string;
  distritoNombre: string;
  servicioNombre: string;
  scopeLocked?: boolean;
}

export default function HeaderSection(props: Props) {
  const { user } = useAuth();
  const { regiones, getDistritosByRegion, getServiciosByDistrito, getBarriosByDistrito } = useOrgStructure();
  const now = new Date();

  const GpsIcon = props.geo.status === 'success' ? MapPin : props.geo.status === 'loading' ? Loader2 : XCircle;
  const gpsColor = props.geo.status === 'success' ? 'text-success' : props.geo.status === 'loading' ? 'text-warning' : 'text-destructive';
  const gpsLabel = props.geo.lat !== null && props.geo.lng !== null
    ? `${props.geo.lat.toFixed(5)}, ${props.geo.lng.toFixed(5)}${props.geo.isApproximate ? ' (GPS aproximado)' : ''}`
    : props.geo.status === 'loading'
      ? 'Obteniendo GPS...'
      : props.geo.status === 'denied'
        ? 'Sin GPS'
        : 'Sin señal GPS';

  const filteredDistritos = props.regionId ? getDistritosByRegion(props.regionId) : [];
  const filteredServicios = props.distritoId ? getServiciosByDistrito(props.distritoId) : [];
  const filteredBarrios = props.distritoId ? getBarriosByDistrito(props.distritoId) : [];
  const [serviciosFallback, setServiciosFallback] = useState<string[]>([]);
  const [barriosFallback, setBarriosFallback] = useState<string[]>([]);

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

      const uniques = Array.from(new Set((data || [])
        .map((row) => row.servicio_salud?.trim())
        .filter((value): value is string => Boolean(value))))
        .sort((a, b) => a.localeCompare(b));
      setServiciosFallback(uniques);
    }
    void cargarFallback();
    return () => { active = false; };
  }, [props.distritoNombre, filteredServicios.length]);

  useEffect(() => {
    let active = true;
    async function cargarBarriosFallback() {
      if (!props.distritoNombre || filteredBarrios.length > 0) {
        setBarriosFallback([]);
        return;
      }
      const { data, error } = await supabase
        .from('registros_vacunacion')
        .select('barrio')
        .eq('distrito', props.distritoNombre)
        .not('barrio', 'is', null)
        .limit(1000);
      if (error || !active) return;

      const uniques = Array.from(new Set((data || [])
        .map((row) => row.barrio?.trim())
        .filter((value): value is string => Boolean(value))))
        .sort((a, b) => a.localeCompare(b));
      setBarriosFallback(uniques);
    }
    void cargarBarriosFallback();
    return () => { active = false; };
  }, [props.distritoNombre, filteredBarrios.length]);

  const inputServiciosFallback = useMemo(
    () => `servicios-fallback-${props.distritoId ?? 'none'}`,
    [props.distritoId]
  );
  const inputBarriosFallback = useMemo(
    () => `barrios-fallback-${props.distritoId ?? 'none'}`,
    [props.distritoId]
  );

  return (
    <div className="section-card">
      <div className="section-title">
        <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">2</span>
        Ubicación y Fecha
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <span className="text-muted-foreground text-xs">Fecha:</span>
          <span className="font-semibold ml-1">{now.toLocaleDateString('es-PY')}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Hora:</span>
          <span className="font-semibold ml-1">{now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Usuario:</span>
          <span className="font-semibold ml-1">{user?.nombre}</span>
        </div>
        <div className="flex items-center gap-1">
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

      <div className="space-y-2">
        {props.scopeLocked && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs font-medium">
            Alcance fijo asignado por super admin.
          </div>
        )}
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
              <p className="text-[11px] text-muted-foreground">
                {props.mapsResolving
                  ? 'Resolviendo enlace de mapa...'
                  : props.coordsFromLink
                  ? `Coordenadas detectadas: ${props.coordsFromLink.lat.toFixed(5)}, ${props.coordsFromLink.lng.toFixed(5)}`
                  : props.mapsLink
                    ? 'No se pudieron detectar coordenadas. Abra el link y copie la URL final o pegue lat,lng.'
                    : 'Ejemplo: https://maps.google.com/... o -25.294,-57.608'}
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="field-label">Región Sanitaria</label>
          <select
            value={props.regionId ?? ''}
            onChange={e => {
              const val = e.target.value ? Number(e.target.value) : null;
              props.setRegionId(val);
              props.setDistritoId(null);
              props.setServicioId(null);
            }}
            className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
            title="Seleccionar región sanitaria"
            disabled={props.scopeLocked}
          >
            <option value="">Seleccionar...</option>
            {regiones.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="field-label">Distrito</label>
            <select
              value={props.distritoId ?? ''}
              onChange={e => {
                const val = e.target.value ? Number(e.target.value) : null;
                props.setDistritoId(val);
                props.setServicioId(null);
                props.setServicioManual('');
              }}
              className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
              disabled={!props.regionId || props.scopeLocked}
              title="Seleccionar distrito"
            >
              <option value="">Seleccionar...</option>
              {filteredDistritos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Servicio de Salud</label>
            {filteredServicios.length > 0 ? (
              <select
                value={props.servicioId ?? ''}
                onChange={e => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  props.setServicioId(val);
                  props.setServicioManual('');
                }}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                disabled={!props.distritoId || props.scopeLocked}
                title="Seleccionar servicio de salud"
              >
                <option value="">Seleccionar...</option>
                {filteredServicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            ) : (
              <>
                <input
                  value={props.servicioManual}
                  onChange={(e) => {
                    props.setServicioId(null);
                    props.setServicioManual(e.target.value);
                  }}
                  className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                  placeholder={props.distritoId ? 'Escriba o seleccione servicio' : 'Seleccione distrito primero'}
                  disabled={!props.distritoId || props.scopeLocked}
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="field-label flex items-center gap-1">
              Barrio / Localidad <span className="text-destructive font-bold">*</span>
            </label>
            {filteredBarrios.length > 0 ? (
              <select
                value={props.barrio}
                onChange={(e) => props.setBarrio(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                disabled={!props.distritoId || props.scopeLocked}
                title="Seleccionar barrio/localidad"
              >
                <option value="">Seleccionar...</option>
                {filteredBarrios.map((b) => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}
              </select>
            ) : (
              <>
                <input
                  value={props.barrio}
                  onChange={e => props.setBarrio(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
                  placeholder={props.distritoId ? 'Escriba o seleccione barrio' : 'Seleccione distrito primero'}
                  disabled={!props.distritoId || props.scopeLocked}
                  list={inputBarriosFallback}
                />
                {barriosFallback.length > 0 && (
                  <datalist id={inputBarriosFallback}>
                    {barriosFallback.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                )}
              </>
            )}
          </div>
          <div>
            <label className="field-label">Responsable</label>
            <input value={props.responsable} onChange={e => props.setResponsable(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border bg-background text-sm" placeholder="Nombre y Apellido" />
          </div>
        </div>
      </div>
    </div>
  );
}
