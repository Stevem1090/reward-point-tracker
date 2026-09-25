/* Firebase Cloud Messaging service worker - notifications only, no app caching. */
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Register our click handler BEFORE firebase.messaging() so we can navigate to the right page.
self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  const data = event.notification.data || {};
  const fcm = data.FCM_MSG || {};
  const messageData = fcm.data || data;
  if (event.action === 'mark-done' && messageData.actionUrl && messageData.taskId && messageData.actionToken) {
    event.waitUntil(
      fetch(messageData.actionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: messageData.taskId, token: messageData.actionToken }),
      }).then((response) => {
        if (!response.ok) throw new Error('Task completion failed');
      }).catch((error) => console.error('[push] mark done failed', error))
    );
    return;
  }
  const url =
    data.url ||
    messageData.url ||
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
