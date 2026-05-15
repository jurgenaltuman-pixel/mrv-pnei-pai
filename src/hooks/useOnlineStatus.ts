import { useState, useEffect } from 'react';
import { isNativeApp } from '@/lib/capacitor-platform';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isConnected, setIsConnected] = useState(false);

  const checkConnection = async () => {
    try {
      if (isNativeApp()) {
        const { Network } = await import('@capacitor/network');
        const status = await Network.getStatus();
        setIsConnected(status.connected);
        setIsOnline(status.connected);
        return;
      }
      await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
      });
      setIsConnected(true);
    } catch {
      setIsConnected(false);
    }
  };

  useEffect(() => {
    let removeNativeListener: (() => void) | undefined;

    const onOnline = () => {
      setIsOnline(true);
      void checkConnection();
    };
    const onOffline = () => {
      setIsOnline(false);
      setIsConnected(false);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    void (async () => {
      if (isNativeApp()) {
        const { Network } = await import('@capacitor/network');
        const status = await Network.getStatus();
        setIsOnline(status.connected);
        setIsConnected(status.connected);
        const handle = await Network.addListener('networkStatusChange', (s) => {
          setIsOnline(s.connected);
          setIsConnected(s.connected);
        });
        removeNativeListener = () => void handle.remove();
        return;
      }
      if (navigator.onLine) void checkConnection();
    })();

    const interval = setInterval(() => {
      if (navigator.onLine) void checkConnection();
    }, 30000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      removeNativeListener?.();
      clearInterval(interval);
    };
  }, []);

  return isOnline && isConnected;
}
