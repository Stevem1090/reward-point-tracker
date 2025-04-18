
// Service Worker for Push Notifications

// Cache name for offline content
const CACHE_NAME = 'family-app-cache-v2'; // Incremented version number

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/favicon.ico'
      ]);
    })
  );
});

// Activate event - clean up old caches and take control immediately
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('Deleting outdated cache:', cacheName);
          return caches.delete(cacheName);
        })
      ).then(() => {
        console.log('Service Worker now controls all clients');
        return self.clients.claim();
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
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
  }
});

// Push event - show notification
self.addEventListener('push', function(event) {
  console.log('Push event received');
  
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('Push data:', data);
      
      event.waitUntil(
        self.registration.showNotification(data.title || 'Reminder', {
          body: data.body || 'Time for your reminder!',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [100, 50, 100],
          data: {
            dateOfArrival: Date.now(),
            primaryKey: 1,
            userId: data.userId || null
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
        })
      );
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  } else {
    console.log('Push event has no data');
  }
});

// Notification click event - open app
self.addEventListener('notificationclick', function(event) {
  console.log('Notification click received', event.action);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({type: 'window'}).then(function(clientList) {
      // If we have a client window already open, focus it
      for (const client of clientList) {
        if (client.url.includes('/reminders') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow('/reminders');
      }
    })
  );
});
