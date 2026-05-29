/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

/** Bump para forzar activate y limpiar lógica vieja (clone roto). */
const CACHE_NAME = 'mrv-v35-static';

const URLS_TO_CACHE = [
  '/mrv-boot-ui.js',
  '/manifest.json',
  '/robots.txt',
  '/logo-mrv-oficial.png',
  '/logo-pnei-pai-mspbs.png',
  '/logo-mrv.png',
  '/brand-pai.png',
  '/brand-paraguay-map.png',
  '/brand-paraguay-seal.png',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
];

const PRIVATE_PATHS = ['/auth/', '/profiles/', '/user_roles/', '/admin/', '/registros_vacunacion'];

function isPrivateRequest(url: URL): boolean {
  return PRIVATE_PATHS.some((path) => url.pathname.includes(path));
}

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

/**
 * SW mínima: sin cache.put(Response) ni .clone() en fetch — eso rompía con
 * "Failed to execute 'clone' on 'Response': Response body is already used"
 * y tiraba abajo React (chunks / vendor corruptos).
 */
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r ?? Response.error()))
    );
    return;
  }

  if (isPrivateRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached =
          (await caches.match(request)) ||
          (await caches.match('/index.html')) ||
          (await caches.match('/'));
        return cached ?? new Response('Sin conexión', { status: 503, statusText: 'Sin conexión' });
      })
    );
    return;
  }

  event.respondWith(fetch(request));
});

export {};
