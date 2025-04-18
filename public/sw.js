// Service Worker for Push Notifications

// Cache name for offline content - incremented version
const CACHE_NAME = 'family-app-cache-v5'; // Version updated to force cache refresh

// Install event - cache essential files and force activation
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing new version...');
  
  // Force this service worker to become active immediately
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
  console.log('[Service Worker] Activating new version...');
  
  // Use waitUntil to ensure activation completes before fetch events
  event.waitUntil(
    // Delete old cache versions
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('[Service Worker] Deleting outdated cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
    .then(() => {
      // Take control of all clients immediately
      console.log('[Service Worker] Now controlling all clients');
      return self.clients.claim();
    })
    .catch(error => {
      console.error('[Service Worker] Activation error:', error);
    })
  );
});

// Fetch event - network-first strategy with improved reliability
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;
  
  // Always network-first for HTML and JS files, which ensures fresh content
  const isHtmlOrJs = event.request.url.endsWith('.html') || 
                     event.request.url.endsWith('.js') ||
                     event.request.url.endsWith('/') ||
                     event.request.url.includes('/assets/');
  
  if (isHtmlOrJs) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh network response
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
          // Attempt to serve from cache if network request fails
          return caches.match(event.request).then(cachedResponse => {
            // If we have a cached version, return it
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Otherwise return a simple offline message
            console.warn('[Service Worker] No cache found for:', event.request.url);
            if (event.request.url.includes('.html') || event.request.url.endsWith('/')) {
              return new Response(
                `<!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>Offline</title>
                  <style>
                    body { font-family: sans-serif; padding: 20px; text-align: center; }
                    .offline-message { max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #ccc; border-radius: 5px; }
                    button { padding: 10px 20px; background: #4a76a8; color: white; border: none; border-radius: 4px; cursor: pointer; }
                  </style>
                </head>
                <body>
                  <div class="offline-message">
                    <h2>You're offline</h2>
                    <p>The app is currently unavailable. Please check your internet connection.</p>
                    <button onclick="window.location.reload()">Try Again</button>
                  </div>
                </body>
                </html>`, 
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({
                    'Content-Type': 'text/html'
                  })
                }
              );
            } else {
              return new Response('You are offline and this resource is not cached.', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain'
                })
              });
            }
          });
        })
    );
  } else {
    // For non-HTML/JS assets, try cache first, then network
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then(response => {
            // Cache the response for next time
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
            return response;
          });
      })
    );
  }
});

// Push event - show notification with improved error handling
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
        
        // Check if this is a permission error or expired subscription
        if (error.name === 'NotAllowedError') {
          console.error('[Service Worker] Notification permission denied');
        }
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

// Notification click event - open app with improved error handling
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

// Listen for message events from the main page
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    console.log('[Service Worker] Skip waiting and activate immediately');
  } else if (event.data && event.data.type === 'CLEAR_CACHES') {
    // Handle explicit cache clearing request
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log('[Service Worker] Clearing cache by request:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Return confirmation if possible
      if (event.source && event.source.postMessage) {
        event.source.postMessage({ type: 'CACHES_CLEARED' });
      }
      console.log('[Service Worker] All caches cleared by request');
    });
  }
});
