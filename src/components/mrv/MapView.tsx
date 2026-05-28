import { lazy, Suspense, useMemo, useState } from 'react';
import { useRegistrosQuery } from '@/hooks/useRegistrosQuery';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { MapSkeleton } from '@/components/mrv/PageSkeleton';
import { MapPin, Navigation, RefreshCw, Filter } from 'lucide-react';

const MrvMapPanel = lazy(() => import('@/components/mrv/MrvMapPanel'));

export default function MapView() {
  const { user } = useAuth();
  const geo = useGeolocation();
  const { data: registros = [], isLoading, isFetching, refetch } = useRegistrosQuery(2500, Boolean(user?.id));
  const [filtro, setFiltro] = useState<'todos' | 'vacunado' | 'no_vacunado'>('todos');

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return registros;
    if (filtro === 'vacunado') return registros.filter((r) => r.estado_vacuna === 'vacunado');
    return registros.filter((r) => r.estado_vacuna === 'no_vacunado');
  }, [registros, filtro]);

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

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {([
          { id: 'todos', label: 'Todos' },
          { id: 'vacunado', label: 'Vacunados' },
          { id: 'no_vacunado', label: 'No vacunados' },
        ] as const).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold flex items-center gap-1 ${
              filtro === f.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            <Filter className="w-3 h-3" />
            {f.label}
          </button>
        ))}
      </div>

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
