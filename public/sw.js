const CACHE_NAME = 'moonpaw-offline-v3';

function scoped(path = '') {
  return new URL(path, self.registration.scope).href;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([
        scoped(),
        scoped('index.html'),
        scoped('manifest.webmanifest'),
        scoped('icons/moonpaw.svg'),
        scoped('icons/moonpaw-180.png'),
        scoped('icons/moonpaw-192.png'),
        scoped('icons/moonpaw-512.png')
      ]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('moonpaw-offline-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_GAME_ASSETS' || !Array.isArray(event.data.urls)) return;
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => Promise.allSettled(
    event.data.urls
      .filter((url) => new URL(url).origin === self.location.origin)
      .map((url) => cache.add(url))
  )));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    const networkUpdate = fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    }).catch(() => null);

    event.waitUntil(networkUpdate.then(() => undefined));
    event.respondWith(
      caches.match(request, { ignoreSearch: true, ignoreVary: true }).then(async (cachedPage) => {
        const cachedShell = cachedPage || await caches.match(scoped('index.html'));
        return cachedShell || networkUpdate;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
