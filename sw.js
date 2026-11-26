const CACHE_NAME = 'penguin-glacial-empire-v27';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles/core.css',
  './styles/splash-cutscene.css',
  './styles/game.css',
  './js/economy.js',
  './js/game-data.js',
  './js/wardrobe.js',
  './js/milestone-engine.js',
  './js/polar-synergy.js',
  './js/sky-events.js',
  './js/daily-system.js',
  './js/daily-manager.js',
  './js/save-system.js',
  './js/sound-engine.js',
  './js/castle-renderer.js',
  './js/penguin-sprites.js',
  './js/scene-renderer.js',
  './js/parade-event.js',
  './js/prestige-cutscene.js',
  './js/launch-splash.js',
  './manifest.webmanifest',
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
  // Do NOT unconditionally call skipWaiting() mid-session so active players aren't jolted
  // by sudden controllerchange reloads while playing or claiming offline fish.
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

  // Network-first (revalidating HTTP cache) for HTML, styles, and modular JS
  // so browser and installed PWAs receive updates cleanly in lockstep.
  if (
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('index.html') ||
    url.pathname.includes('/js/') ||
    url.pathname.includes('/styles/')
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

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
