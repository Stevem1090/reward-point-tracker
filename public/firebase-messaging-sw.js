/* Firebase Cloud Messaging service worker - notifications only, no app caching. */
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Register our click handler BEFORE firebase.messaging() so we can navigate to the right page.
self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  const data = event.notification.data || {};
  const fcm = data.FCM_MSG || {};
  const url =
    data.url ||
    (fcm.data && fcm.data.url) ||
    (fcm.fcmOptions && fcm.fcmOptions.link) ||
    '/';
  const target = new URL(url, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          return client.focus().then((c) => (c && 'navigate' in c ? c.navigate(target) : c));
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
firebase.messaging();
