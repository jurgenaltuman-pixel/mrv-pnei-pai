import { lazy, Suspense, useMemo, useState } from 'react';
import { useRegistrosQuery } from '@/hooks/useRegistrosQuery';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { MapSkeleton } from '@/components/mrv/PageSkeleton';
import VisitaMapFilterBar from '@/components/mrv/VisitaMapFilterBar';
import { filterRegistrosByVisita, type VisitaMapFilter } from '@/lib/visita-filter';
import { MapPin, Navigation, RefreshCw } from 'lucide-react';

const MrvMapPanel = lazy(() => import('@/components/mrv/MrvMapPanel'));

export default function MapView() {
  const { user } = useAuth();
  const geo = useGeolocation();
  const { data: registros = [], isLoading, isFetching, refetch } = useRegistrosQuery(2500, Boolean(user?.id));
  const [filtro, setFiltro] = useState<VisitaMapFilter>('todos');

  const filtrados = useMemo(
    () => filterRegistrosByVisita(registros, filtro),
    [registros, filtro]
  );

  const geoCount = filtrados.filter((r) => r.latitud != null && r.longitud != null).length;
  const sinGps = filtrados.length - geoCount;

  if (isLoading) return <div className="p-3"><MapSkeleton /></div>;

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] p-3 pb-20 gap-3 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Mapa en terreno
          </h2>
          <p className="text-xs text-muted-foreground">
            {geoCount} con GPS · {sinGps} sin ubicación · OpenStreetMap (gratis)
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => void refetch()}
            className="h-9 w-9 rounded-xl border bg-card flex items-center justify-center"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <VisitaMapFilterBar value={filtro} onChange={setFiltro} />

      {geo.status === 'granted' && geo.lat != null && (
        <div className="text-[11px] flex items-center gap-1.5 text-primary font-medium px-1">
          <Navigation className="w-3.5 h-3.5" />
          GPS activo · {geo.lat.toFixed(4)}, {geo.lng?.toFixed(4)}
        </div>
      )}

      <Suspense fallback={<MapSkeleton />}>
        <MrvMapPanel
          registros={filtrados}
          height="100%"
          className="flex-1 min-h-[280px]"
          userLat={geo.lat}
          userLng={geo.lng}
          maxMarkers={500}
        />
      </Suspense>
    </div>
  );
}
