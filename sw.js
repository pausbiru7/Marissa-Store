// ==================== SERVICE WORKER - MARISSA STORE ====================
const CACHE_VERSION = 'marissa-store-v2';
const APP_CACHE = CACHE_VERSION;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

const CDN_TO_CACHE = [
  'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

// INSTALL
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll(APP_SHELL);

    await Promise.all(
      CDN_TO_CACHE.map(async url => {
        try {
          const res = await fetch(url, { mode: 'cors' });
          if (res && res.ok) {
            await cache.put(url, res.clone());
          }
        } catch (err) {
          console.log('[SW] CDN cache failed:', url, err);
        }
      })
    );

    await self.skipWaiting();
  })());
});

// ACTIVATE
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key !== APP_CACHE)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

// MESSAGE
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// FETCH
self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  // 1. HTML / navigasi => NETWORK FIRST
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(APP_CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (err) {
        const cachedPage = await caches.match(req);
        return cachedPage || caches.match('./index.html');
      }
    })());
    return;
  }

  // 2. CDN / static assets => CACHE FIRST + update cache
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      return cached;
    }

    try {
      const fresh = await fetch(req);

      if (fresh && fresh.status === 200) {
        const cache = await caches.open(APP_CACHE);
        cache.put(req, fresh.clone());
      }

      return fresh;
    } catch (err) {
      const fallback = await caches.match(req);
      if (fallback) return fallback;

      return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    }
  })());
});

console.log('[SW] Service Worker loaded:', APP_CACHE);
