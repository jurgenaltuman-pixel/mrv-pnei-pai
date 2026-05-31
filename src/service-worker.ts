/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

/** Bump para forzar activate y limpiar caches viejas. */
const CACHE_NAME = 'mrv-v37-web-offline';

const URLS_TO_CACHE = [
  '/',
  '/index.html',
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

async function cachePutSafe(cache: Cache, request: Request, response: Response): Promise<void> {
  if (request.method !== 'GET' || !response.ok) return;
  try {
    await cache.put(request, response.clone());
  } catch {
    /* quota / opaque response */
  }
}

async function matchShell(): Promise<Response | undefined> {
  const cache = await caches.open(CACHE_NAME);
  return (
    (await cache.match('/index.html')) ||
    (await cache.match('/')) ||
    (await cache.match(new Request('/index.html')))
  );
}

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          URLS_TO_CACHE.map((url) =>
            cache.add(url).catch(() => fetch(url).then((r) => (r.ok ? cachePutSafe(cache, new Request(url), r) : undefined)))
          )
        )
      )
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.map((cacheName) => (cacheName !== CACHE_NAME ? caches.delete(cacheName) : undefined)))
      )
      .then(() => self.clients.claim())
  );
});

/** Web offline: shell + assets en cache; API siempre red. */
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/') || isPrivateRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then(async (response) => {
            await cachePutSafe(cache, request, response);
            return response;
          })
          .catch(() => cached);
        if (cached) {
          void network;
          return cached;
        }
        return network.then((r) => r ?? Response.error());
      })
    );
    return;
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cachePutSafe(cache, new Request('/index.html'), response);
          }
          return response;
        })
        .catch(async () => {
          const cached = (await caches.match(request)) || (await matchShell());
          return cached ?? new Response('Sin conexión', { status: 503, statusText: 'Sin conexión' });
        })
    );
    return;
  }

  if (request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        return fetch(request)
          .then(async (response) => {
            await cachePutSafe(cache, request, response);
            return response;
          })
          .catch(() => Response.error());
      })
    );
    return;
  }

  event.respondWith(fetch(request));
});

export {};
