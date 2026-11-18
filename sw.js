const CACHE_NAME = 'penguin-glacial-empire-v14';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './push-config.json',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        CORE_ASSETS.map((assetUrl) =>
          cache.add(new Request(assetUrl, { cache: 'reload' })).catch(() => cache.add(assetUrl))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first (revalidating HTTP cache) for HTML navigation & push-config.json so Android/iOS PWAs receive updates immediately
  if (
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('push-config.json')
  ) {
    event.respondWith(
      fetch(event.request.url, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static icons and manifest
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});

// Handle incoming Web Push events (Apple iOS 16.4+ Safari PWA & Android Chrome/Edge)
// IMPORTANT: iOS requires every push event to immediately trigger showNotification().
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (_) {
      try {
        payload = { body: event.data.text() };
      } catch (__) {
        payload = {};
      }
    }
  }

  const title = payload.title || '🎯 Daily Goals Ready — Glacial Empire';
  const body =
    payload.body ||
    'Your 8:00 AM colony objectives are waiting! Tap to claim fish & Frost Essence rewards.';
  const targetUrl = payload.url || './?tab=daily';

  const options = {
    body,
    icon: payload.icon || './icons/icon-192.png',
    badge: payload.badge || './icons/icon-192.png',
    tag: payload.tag || 'daily-goals-reminder',
    renotify: true,
    requireInteraction: false,
    data: {
      url: targetUrl,
      tab: 'daily'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus an open PWA window (and switch to Daily tab) or open the Daily tab directly
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './?tab=daily';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.postMessage({ type: 'OPEN_DAILY_TAB' });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return null;
      })
  );
});

// Allow foreground/Settings test notifications via Service Worker registration
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (msg.type === 'SHOW_LOCAL_NOTIFICATION') {
    const title = msg.title || '🎯 Daily Goals Reminder';
    const body = msg.body || 'Tap to check your colony daily tasks and earn Frost Essence!';
    const tag = msg.tag || 'daily-goals-reminder';
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag,
        renotify: true,
        data: {
          url: './?tab=daily',
          tab: 'daily'
        }
      })
    );
  }
});

// Automatically refresh expiring Web Push subscriptions when browsers rotate tokens
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch('./push-config.json', { cache: 'no-store' });
        if (!res.ok) return;
        const cfg = await res.json();
        if (!cfg || !cfg.subscribeApiUrl) return;

        const subOptions =
          (event.oldSubscription && event.oldSubscription.options) || {
            userVisibleOnly: true,
            applicationServerKey: cfg.vapidPublicKey || undefined
          };
        const newSub = await self.registration.pushManager.subscribe(subOptions);
        await fetch(cfg.subscribeApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: newSub.toJSON(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            reminderHour: typeof cfg.defaultReminderHour === 'number' ? cfg.defaultReminderHour : 8,
            reminderMinute: typeof cfg.defaultReminderMinute === 'number' ? cfg.defaultReminderMinute : 0
          })
        });
      } catch (_) {
        // Ignore silent re-subscription errors
      }
    })()
  );
});
