export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const base = import.meta.env.BASE_URL || '/';
      const root = base.endsWith('/') ? base : `${base}/`;
      const registration = await navigator.serviceWorker.register(`${root}service-worker.js`, {
        scope: root,
        updateViaCache: 'none',
      });
      void registration.update();
      console.log('Service Worker registered successfully:', registration);
      return registration;
    } catch (error) {
      console.warn('Service Worker registration failed (app will work without it):', error);
    }
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    });
  }
}

// Check if app is online/offline
export function onOnlineStatusChange(callback: (isOnline: boolean) => void) {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
}
