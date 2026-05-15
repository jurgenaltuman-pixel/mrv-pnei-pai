/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

/** Nueva versión = borra cachés viejas y evita index.html obsoleto (pantalla en blanco tras deploy). */
const CACHE_NAME = 'mrv-v4-static';
const RUNTIME_CACHE = 'mrv-v4-runtime';

/** Solo assets con nombre estable; NUNCA precargar / ni index.html (rompen tras cada build de Vite). */
const URLS_TO_CACHE = ['/manifest.json', '/robots.txt', '/icon-192.png', '/icon-512.png', '/favicon.png'];

const PRIVATE_PATHS = ['/auth/', '/profiles/', '/user_roles/', '/admin/', '/registros_vacunacion'];

function isPrivateRequest(url: URL): boolean {
  return PRIVATE_PATHS.some((path) => url.pathname.includes(path));
}

function shouldCacheResponse(request: Request, response: Response): boolean {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) return false;
  if (response.status !== 200) return false;
  const url = new URL(request.url);
  if (isPrivateRequest(url)) return false;
  return true;
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
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (isPrivateRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Navegación: red primero (evita index obsoleto → JS 404 → pantalla en blanco). Guardar copia para offline.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('/index.html') || caches.match('/'))
            .then((cached) => cached || new Response('Sin conexión', { status: 503 }))
        )
    );
    return;
  }

  if (url.pathname.startsWith('/api') || url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (shouldCacheResponse(request, response)) {
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, response.clone()));
          }
          return response.clone();
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || new Response('No hay conexión', { status: 503 }))
        )
    );
    return;
  }

  // JS/CSS/chunks: red primero (nuevos hashes tras deploy), caché solo como respaldo offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && shouldCacheResponse(request, response)) {
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || fetch(request)))
  );
});

export {};
