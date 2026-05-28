import { useEffect, useMemo, useRef, useState } from 'react';

interface GeoState {
  lat: number | null;
  lng: number | null;
  status: 'loading' | 'success' | 'error' | 'denied';
  isApproximate: boolean;
  /** Precisión en metros (null si desconocida). */
  accuracyM: number | null;
  /** Sin conexión de datos: se usa última posición conocida. */
  offlineCached: boolean;
}

const CACHE_KEY = 'mrv_last_gps_v2';

interface CachedGeo {
  lat: number;
  lng: number;
  accuracy?: number | null;
  at: number;
}

function getCachedGeo(): CachedGeo | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedGeo;
    if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') return parsed;
  } catch {
    try {
      const legacy = localStorage.getItem('mrv_last_gps');
      if (legacy) {
        const p = JSON.parse(legacy) as { lat: number; lng: number };
        return { lat: p.lat, lng: p.lng, accuracy: null, at: Date.now() };
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function setCachedGeo(lat: number, lng: number, accuracy: number | null) {
  try {
    const payload: CachedGeo = { lat, lng, accuracy, at: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    localStorage.setItem('mrv_last_gps', JSON.stringify({ lat, lng }));
  } catch {
    /* ignore */
  }
}

export function useGeolocation() {
  const cached = getCachedGeo();
  const [geo, setGeo] = useState<GeoState>({
    lat: cached?.lat ?? null,
    lng: cached?.lng ?? null,
    status: cached ? 'success' : 'loading',
    isApproximate: Boolean(cached),
    accuracyM: cached?.accuracy ?? null,
    offlineCached: typeof navigator !== 'undefined' && !navigator.onLine && Boolean(cached),
  });
  const [retryToken, setRetryToken] = useState(0);
  const watchIdRef = useRef<number | null>(null);

  const highAccuracy = useMemo<PositionOptions>(
    () => ({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    }),
    []
  );

  const balanced = useMemo<PositionOptions>(
    () => ({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 8000,
    }),
    []
  );

  const lowPower = useMemo<PositionOptions>(
    () => ({
      enableHighAccuracy: false,
      timeout: 25000,
      maximumAge: 120000,
    }),
    []
  );

  useEffect(() => {
    const showCachedWhileLoading = () => {
      const fallback = getCachedGeo();
      if (!fallback) return;
      setGeo((prev) => ({
        lat: fallback.lat,
        lng: fallback.lng,
        status: prev.status === 'loading' ? 'loading' : 'success',
        isApproximate: true,
        accuracyM: fallback.accuracy ?? null,
        offlineCached: !navigator.onLine,
      }));
    };

    showCachedWhileLoading();

    const applyOfflineCacheOnly = () => {
      if (navigator.onLine) return false;
      const fallback = getCachedGeo();
      if (!fallback) return false;
      setGeo((prev) => ({
        lat: fallback.lat,
        lng: fallback.lng,
        status: 'success',
        isApproximate: true,
        accuracyM: fallback.accuracy ?? prev.accuracyM,
        offlineCached: true,
      }));
      return true;
    };

    if (!navigator.geolocation) {
      setGeo((prev) => ({ ...prev, status: 'error', isApproximate: false, offlineCached: false }));
      return;
    }

    if (!window.isSecureContext) {
      const fallback = getCachedGeo();
      setGeo({
        lat: fallback?.lat ?? null,
        lng: fallback?.lng ?? null,
        status: fallback ? 'success' : 'error',
        isApproximate: true,
        accuracyM: fallback?.accuracy ?? null,
        offlineCached: false,
      });
      return;
    }

    let active = true;

    const onSuccess = (pos: GeolocationPosition) => {
      if (!active) return;
      const { latitude, longitude, accuracy } = pos.coords;
      setCachedGeo(latitude, longitude, accuracy ?? null);
      setGeo({
        lat: latitude,
        lng: longitude,
        status: 'success',
        isApproximate: false,
        accuracyM: accuracy ?? null,
        offlineCached: false,
      });
    };

    const onError = (err: GeolocationPositionError) => {
      if (!active) return;
      if (applyOfflineCacheOnly()) return;
      const fallback = getCachedGeo();
      const hasFallback = fallback != null;
      setGeo((prev) => ({
        lat: prev.lat ?? fallback?.lat ?? null,
        lng: prev.lng ?? fallback?.lng ?? null,
        status: err.code === 1 ? 'denied' : hasFallback ? 'success' : 'error',
        isApproximate: err.code !== 1 && hasFallback,
        accuracyM: hasFallback ? (fallback?.accuracy ?? prev.accuracyM) : null,
        offlineCached: false,
      }));
    };

    const requestCurrentPosition = (posOptions: PositionOptions) =>
      new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            onSuccess(pos);
            resolve(true);
          },
          () => resolve(false),
          posOptions
        );
      });

    const startWatch = () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, highAccuracy);
    };

    void (async () => {
      if (!(await requestCurrentPosition(highAccuracy)) && active) {
        if (!(await requestCurrentPosition(balanced)) && active) {
          await requestCurrentPosition(lowPower);
        }
      }
    })();

    startWatch();

    const onOnline = () => {
      if (!active) return;
      setGeo((prev) => ({ ...prev, offlineCached: false, status: 'loading' }));
      void requestCurrentPosition(highAccuracy).then(() => startWatch());
    };
    const onOffline = () => {
      if (!active) return;
      setGeo((prev) => ({
        ...prev,
        offlineCached: prev.lat != null && prev.lng != null,
      }));
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const onVisibility = () => {
      if (!active || document.visibilityState === 'hidden') {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        return;
      }
      if (!navigator.onLine) {
        showCachedWhileLoading();
        startWatch();
        return;
      }
      void requestCurrentPosition(highAccuracy).then(() => startWatch());
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [retryToken, highAccuracy, balanced, lowPower]);

  const refresh = () => {
    setGeo((prev) => ({ ...prev, status: 'loading', isApproximate: false, offlineCached: false }));
    setRetryToken((prev) => prev + 1);
  };

  return { ...geo, refresh };
}
