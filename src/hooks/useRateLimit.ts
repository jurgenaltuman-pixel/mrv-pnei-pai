import { useCallback, useRef, useEffect } from 'react';

/**
 * Hook para debounce de funciones
 * Previene que una función se ejecute múltiples veces en corto tiempo
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

/**
 * Hook para throttle de funciones
 * Asegura que una función se ejecute máximo una vez cada X ms
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  interval: number = 1000
): (...args: Parameters<T>) => void {
  const lastCallRef = useRef<number>(0);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastCallRef.current >= interval) {
        lastCallRef.current = now;
        callback(...args);
      }
    },
    [callback, interval]
  );
}

/**
 * Hook para rate limiting con máximo número de llamadas
 */
export function useRateLimit<T extends (...args: any[]) => any>(
  callback: T,
  maxCalls: number = 5,
  timeWindow: number = 1000
): { call: (...args: Parameters<T>) => void; isLimited: boolean } {
  const callsRef = useRef<number[]>([]);
  const isLimitedRef = useRef(false);

  const call = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      
      // Limpiar llamadas antiguas fuera del time window
      callsRef.current = callsRef.current.filter(
        (timestamp) => now - timestamp < timeWindow
      );

      // Si no hemos superado el límite, ejecutar
      if (callsRef.current.length < maxCalls) {
        callsRef.current.push(now);
        isLimitedRef.current = false;
        callback(...args);
      } else {
        isLimitedRef.current = true;
        console.warn(
          `Rate limit alcanzado: ${maxCalls} llamadas por ${timeWindow}ms`
        );
      }
    },
    [callback, maxCalls, timeWindow]
  );

  return {
    call,
    isLimited: isLimitedRef.current,
  };
}
