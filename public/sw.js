
// Service Worker for Push Notifications

// Cache name for offline content
const CACHE_NAME = 'family-app-cache-v1';

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

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
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
            primaryKey: 1
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
  console.log('Notification click received');
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({type: 'window'}).then(function(clientList) {
      if (clients.openWindow) {
        return clients.openWindow('/reminders');
      }
    })
  );
});
