// Retired worker: removes the old notification/caching worker from returning devices.
function isAppCache(name) {
  return name.startsWith('family-app-cache');
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.allSettled(names.filter(isAppCache).map((n) => caches.delete(n)));
        await self.clients.claim();
      } finally {
        await self.registration.unregister();
      }
    })()
  )
);
