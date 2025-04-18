// Service Worker for Push Notifications

// Cache name for offline content
const CACHE_NAME = 'family-app-cache-v3'; // Incremented version number

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll([
        '/',
        '/index.html',
        '/favicon.ico'
      ]);
    }).catch(error => {
      console.error('[Service Worker] Cache install error:', error);
    })
  );
});

// Activate event - clean up old caches and take control immediately
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('[Service Worker] Deleting outdated cache:', cacheName);
          return caches.delete(cacheName);
        })
      ).then(() => {
        console.log('[Service Worker] Now controls all clients');
        return self.clients.claim();
      }).catch(error => {
        console.error('[Service Worker] Activation error:', error);
      });
    })
  );
});

// Fetch event - network-first strategy for HTML and JavaScript files
self.addEventListener('fetch', event => {
  // Don't handle non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;
  
  // For HTML and JS files, try network first, then fallback to cache
  const isHtmlOrJs = event.request.url.endsWith('.html') || 
                     event.request.url.endsWith('.js') ||
                     event.request.url.endsWith('/');
  
  if (isHtmlOrJs) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          }).catch(err => {
            console.error('[Service Worker] Error caching response:', err);
          });
          return response;
        })
        .catch(() => {
          console.log('[Service Worker] Falling back to cache for:', event.request.url);
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            console.warn('[Service Worker] No cache found for:', event.request.url);
            // If we don't have a cache, return a simple offline page
            return new Response('You are offline and this resource is not cached.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
        })
    );
  }
});

// Push event - show notification
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push event received');
  
  let notificationData = {
    title: 'Reminder',
    body: 'Time for your reminder!',
    userId: null
  };
  
  try {
    if (event.data) {
      notificationData = event.data.json();
      console.log('[Service Worker] Push data:', notificationData);
    } else {
      console.log('[Service Worker] Push event has no data');
    }
    
    event.waitUntil(
      self.registration.showNotification(notificationData.title || 'Reminder', {
        body: notificationData.body || 'Time for your reminder!',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: 1,
          userId: notificationData.userId || null
        },
        actions: [
          {
            action: 'open',
            title: 'Open App'
          },
          {
            action: 'close',
            title: 'Dismiss'
          }
        ]
      }).then(() => {
        console.log('[Service Worker] Notification shown successfully');
      }).catch(error => {
        console.error('[Service Worker] Error showing notification:', error);
      })
    );
  } catch (error) {
    console.error('[Service Worker] Error processing push notification:', error);
    // Still try to show a basic notification even if there was an error
    event.waitUntil(
      self.registration.showNotification('Reminder', {
        body: 'You have an incoming notification (details unavailable)',
        icon: '/favicon.ico'
      })
    );
  }
});

// Notification click event - open app
self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click received', event.action);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({type: 'window'}).then(function(clientList) {
      // If we have a client window already open, focus it
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      // Otherwise open a new window/tab to reminders page
      if (clients.openWindow) {
        return clients.openWindow('/reminders');
      }
    }).catch(error => {
      console.error('[Service Worker] Error handling notification click:', error);
    })
  );
});

// Handle errors
self.addEventListener('error', function(event) {
  console.error('[Service Worker] Unhandled error:', event.message, event.filename, event.lineno);
});
