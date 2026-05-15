import { useEffect, useMemo, useRef, useState } from 'react';

interface GeoState {
  lat: number | null;
  lng: number | null;
  status: 'loading' | 'success' | 'error' | 'denied';
  isApproximate: boolean;
}

const CACHE_KEY = 'mrv_last_gps';

function getCachedGeo(): { lat: number; lng: number } | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
}

function setCachedGeo(lat: number, lng: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ lat, lng }));
  } catch {}
}

export function useGeolocation() {
  const cached = getCachedGeo();
  const [geo, setGeo] = useState<GeoState>({
    lat: cached?.lat ?? null,
    lng: cached?.lng ?? null,
    status: cached ? 'success' : 'loading',
    isApproximate: Boolean(cached),
  });
  const [retryToken, setRetryToken] = useState(0);
  const watchIdRef = useRef<number | null>(null);

  const options = useMemo<PositionOptions>(() => ({
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 5000,
  }), []);
  const fallbackOptions = useMemo<PositionOptions>(() => ({
    enableHighAccuracy: false,
    timeout: 20000,
    maximumAge: 60000,
  }), []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeo(prev => ({ ...prev, status: 'error', isApproximate: false }));
      return;
    }

    if (!window.isSecureContext) {
      const fallback = getCachedGeo();
      setGeo(prev => ({
        lat: prev.lat ?? fallback?.lat ?? null,
        lng: prev.lng ?? fallback?.lng ?? null,
        status: prev.lat || fallback ? 'success' : 'error',
        isApproximate: Boolean(prev.lat ?? fallback?.lat) && Boolean(prev.lng ?? fallback?.lng),
      }));
      return;
    }

    let active = true;

    const onSuccess = (pos: GeolocationPosition) => {
      if (!active) return;
      const { latitude, longitude } = pos.coords;
      setCachedGeo(latitude, longitude);
      setGeo({ lat: latitude, lng: longitude, status: 'success', isApproximate: false });
    };

    const onError = (err: GeolocationPositionError) => {
      if (!active) return;
      const fallback = getCachedGeo();
      setGeo(prev => ({
        lat: prev.lat ?? fallback?.lat ?? null,
        lng: prev.lng ?? fallback?.lng ?? null,
        // Si hay coordenadas previas válidas, evitamos falso rojo por timeout/intermitencia.
        status: err.code === 1 ? 'denied' : (prev.lat ?? fallback?.lat) != null && (prev.lng ?? fallback?.lng) != null ? 'success' : 'error',
        isApproximate: err.code !== 1 && (prev.lat ?? fallback?.lat) != null && (prev.lng ?? fallback?.lng) != null,
      }));
    };

    const requestCurrentPosition = (posOptions: PositionOptions) =>
      new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            onSuccess(pos);
            resolve(true);
          },
          (err) => {
            onError(err);
            resolve(false);
          },
          posOptions
        );
      });

    const startWatch = () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, options);
    };

    // Intento inicial: alta precisión y luego fallback de baja precisión.
    void requestCurrentPosition(options).then((ok) => {
      if (!ok && active) {
        void requestCurrentPosition(fallbackOptions);
      }
    });
    startWatch();

    const onVisibility = () => {
      if (!active) return;
      if (document.visibilityState === 'hidden') {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        return;
      }
      setGeo((prev) => ({ ...prev, status: prev.lat && prev.lng ? 'success' : 'loading' }));
      void requestCurrentPosition(options).then((ok) => {
        if (!ok && active) {
          void requestCurrentPosition(fallbackOptions);
        }
      });
      startWatch();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibility);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [retryToken, options, fallbackOptions]);

  const refresh = () => {
    setGeo(prev => ({ ...prev, status: 'loading', isApproximate: false }));
    setRetryToken(prev => prev + 1);
  };

  return { ...geo, refresh };
}
