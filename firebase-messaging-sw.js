/* Biso CRM — Firebase Cloud Messaging service worker
   Handles PUSH notifications when the app is closed or backgrounded.
   Must live at the site ROOT (https://crm.bisobydinushi.com/firebase-messaging-sw.js)
   so its scope covers index.html. Version must match the SDK in index.html (10.13.2).

   NOTE: This file is intentionally messaging-only. It does NOT cache the app shell,
   so a deploy of index.html is always served fresh (no stale-code surprises). */

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// Same project config as _FBCFG in index.html. Safe to expose (client config).
firebase.initializeApp({
  apiKey: "AIzaSyD67tAE_gTUqOsJWCJ07VH2e4drIvYGhvA",
  authDomain: "biso-crm.firebaseapp.com",
  databaseURL: "https://biso-crm-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "biso-crm",
  storageBucket: "biso-crm.firebasestorage.app",
  messagingSenderId: "719449210972",
  appId: "1:719449210972:web:065afbef711c056f94a699"
});

var messaging = firebase.messaging();

// Background message → show a system notification.
// Phase C sends `data`-only messages so we control the display here.
messaging.onBackgroundMessage(function(payload){
  var d = (payload && payload.data) || {};
  var title = d.title || 'Biso CRM';
  var options = {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || undefined,           // collapse duplicates if Phase C sets a tag
    data: { url: d.url || './index.html', brideId: d.brideId || '' }
  };
  return self.registration.showNotification(title, options);
});

// Tap a notification → focus an existing window or open the app.
self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
