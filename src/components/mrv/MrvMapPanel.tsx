import { useEffect, useMemo, useState, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RegistroMRV } from '@/services/dataService';
import { MAP_ATTRIBUTION, MAP_CENTER_PY, MAP_DEFAULT_ZOOM, MAP_TILE_URL } from '@/lib/map-config';
import { registroMapLabelHtml } from '@/lib/map-labels';
import { normalizeTipoVivienda } from '@/lib/dashboard-stats';
import { MapPin } from 'lucide-react';

type GeoRegistro = RegistroMRV & { lat: number; lng: number };

interface Props {
  registros: RegistroMRV[];
  height?: string;
  className?: string;
  showLegend?: boolean;
  userLat?: number | null;
  userLng?: number | null;
  maxMarkers?: number;
}

function registroKey(r: GeoRegistro) {
  return r.id || `${r.documento}-${r.lat}-${r.lng}`;
}

function getMarkerFillColor(r: GeoRegistro): string {
  const tipo = normalizeTipoVivienda(r.tipo_vivienda);
  if (tipo === 'revisitada') return '#f59e0b'; // N
  if (tipo === 'sin_adulto_responsable') return '#2563eb'; // F
  if (tipo === 'renuente') return '#7c3aed'; // R
  return r.estado_vacuna === 'vacunado' ? '#16a34a' : '#dc2626'; // E
}

function FitBoundsOnLoad({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) {
      map.setView(MAP_CENTER_PY, MAP_DEFAULT_ZOOM);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 16 });
  }, [map, points]);
  return null;
}

/** Abre el popup de Leaflet al seleccionar (react-leaflet no abre solos los Popup montados por estado). */
function SelectedRegistroPopup({
  registro,
  onClose,
}: {
  registro: GeoRegistro | null;
  onClose: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!registro) return;

    const popup = L.popup({
      maxWidth: 320,
      minWidth: 180,
      className: 'mrv-map-popup',
      closeButton: true,
      autoPan: true,
      autoPanPadding: [48, 48],
    })
      .setLatLng([registro.lat, registro.lng])
      .setContent(registroMapLabelHtml(registro));

    popup.on('remove', onClose);
    popup.openOn(map);

    return () => {
      popup.off('remove', onClose);
      map.closePopup();
    };
  }, [map, registro, onClose]);

  return null;
}

export default function MrvMapPanel({
  registros,
  height = '100%',
  className = '',
  showLegend = true,
  userLat,
  userLng,
  maxMarkers = 400,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const geo = useMemo(() => {
    return registros
      .filter((r) => r.latitud != null && r.longitud != null)
      .slice(0, maxMarkers)
      .map((r) => ({ ...r, lat: r.latitud as number, lng: r.longitud as number }));
  }, [registros, maxMarkers]);

  const points = useMemo<[number, number][]>(
    () => geo.map((g) => [g.lat, g.lng] as [number, number]),
    [geo]
  );

  const center = useMemo<[number, number]>(() => {
    if (userLat != null && userLng != null) return [userLat, userLng];
    if (geo.length) return [geo[0].lat, geo[0].lng];
    return MAP_CENTER_PY;
  }, [userLat, userLng, geo]);

  const selectedRegistro = useMemo(
    () => (selectedKey ? geo.find((r) => registroKey(r) === selectedKey) ?? null : null),
    [geo, selectedKey]
  );

  const handleClosePopup = useCallback(() => setSelectedKey(null), []);

  const handleMarkerClick = useCallback((key: string, e: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(e.originalEvent);
    setSelectedKey((prev) => (prev === key ? null : key));
  }, []);

  return (
    <div
      className={`relative rounded-2xl border shadow-sm mrv-map-shell ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={MAP_DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full rounded-2xl"
        style={{ height: '100%', minHeight: height === '100%' ? 200 : undefined }}
      >
        <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} maxZoom={19} />
        <FitBoundsOnLoad points={points} />
        <SelectedRegistroPopup registro={selectedRegistro} onClose={handleClosePopup} />

        {userLat != null && userLng != null && (
          <CircleMarker
            center={[userLat, userLng]}
            radius={12}
            pathOptions={{ color: '#fff', weight: 3, fillColor: 'hsl(210, 100%, 32%)', fillOpacity: 1 }}
          >
            <Popup>
              <span className="text-xs font-semibold">Tu ubicación</span>
            </Popup>
          </CircleMarker>
        )}

        {geo.map((r) => {
          const key = registroKey(r);
          const isOpen = selectedKey === key;
          return (
            <CircleMarker
              key={key}
              center={[r.lat, r.lng]}
              radius={isOpen ? 12 : 9}
              pathOptions={{
                color: isOpen ? '#0055A4' : '#fff',
                weight: isOpen ? 3 : 2,
                fillColor: getMarkerFillColor(r),
                fillOpacity: 0.92,
              }}
              eventHandlers={{
                click: (e) => handleMarkerClick(key, e),
              }}
            />
          );
        })}
      </MapContainer>

      <div className="absolute top-2 right-2 z-[1000] rounded-lg bg-card/95 backdrop-blur px-2 py-1 text-[9px] font-bold text-muted-foreground border shadow-sm pointer-events-none">
        OpenStreetMap · Gratis
      </div>
      {showLegend && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-[1000] flex flex-col sm:flex-row gap-1.5 sm:items-center sm:gap-2 pointer-events-none">
          <div className="flex gap-2 rounded-xl bg-card/95 backdrop-blur px-3 py-1.5 text-[10px] font-bold shadow border w-fit">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-success" /> E vacunado
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive" /> E no vac.
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} /> N
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#2563eb' }} /> F
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#7c3aed' }} /> R
            </span>
          </div>
          <span className="text-[9px] text-muted-foreground bg-card/90 rounded-lg px-2 py-1 border shadow-sm w-fit">
            Tocá un punto para ver el detalle
          </span>
        </div>
      )}
      {geo.length === 0 && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none p-6 rounded-2xl">
          <p className="text-sm text-center text-muted-foreground bg-card/90 rounded-xl px-4 py-3 border shadow-sm max-w-xs">
            <MapPin className="w-5 h-5 mx-auto mb-1 text-primary" />
            Sin puntos GPS en este filtro. El mapa muestra Paraguay; los registros con ubicación aparecerán aquí.
          </p>
        </div>
      )}
    </div>
  );
}
