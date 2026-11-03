// Service Worker - 分享本本 PWA (offline-capable)
// - App shell: resilient install + cache-first
// - Navigations: network-first, offline → cached index.html
// - Critical CDN (Tailwind / Alpine / Phosphor): network-first + cache fallback
// - Other cross-origin: pass-through (do not intercept)
const CACHE_VERSION = 'fenxiang-benben-v3';
const CDN_CACHE = 'fenxiang-benben-cdn-v3';

// Only list files that should exist; missing ones are skipped (won't fail install).
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './styles.css',
  './app.js',
  './sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
  './favicon.ico'
];

// Critical third-party scripts required for the UI to render offline.
const CRITICAL_CDN = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/alpinejs@3.14.8/dist/cdn.min.js',
  'https://unpkg.com/@phosphor-icons/web@2.1.2'
];

function isCriticalCdn(url) {
  const s = url.href;
  return (
    s.startsWith('https://cdn.tailwindcss.com') ||
    s.includes('cdn.jsdelivr.net/npm/alpinejs') ||
    s.includes('unpkg.com/@phosphor-icons') ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  );
}

function isNavigation(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' &&
      (request.headers.get('accept') || '').includes('text/html'))
  );
}

// Cache one URL; ignore failures so a missing icon doesn't block install.
async function cacheOne(cache, url) {
  try {
    const res = await fetch(url, { cache: 'reload' });
    if (res && res.ok) {
      await cache.put(url, res);
      return true;
    }
  } catch (_) {}
  return false;
}

// ---------- install ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await Promise.all(APP_SHELL.map((u) => cacheOne(cache, u)));

      const cdnCache = await caches.open(CDN_CACHE);
      await Promise.all(CRITICAL_CDN.map((u) => cacheOne(cdnCache, u)));

      await self.skipWaiting();
    })()
  );
});

// ---------- activate ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([CACHE_VERSION, CDN_CACHE]);
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ---------- fetch ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // --- Critical CDN / Google Fonts: network-first, cache fallback ---
  if (isCriticalCdn(url)) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res && res.ok) {
            const copy = res.clone();
            event.waitUntil(
              caches.open(CDN_CACHE).then((c) => c.put(req, copy))
            );
          }
          return res;
        } catch (_) {
          const cached =
            (await caches.match(req)) ||
            (await caches.match(url.href)) ||
            (await caches.match(req, { cacheName: CDN_CACHE }));
          if (cached) return cached;
          const all = await caches.open(CDN_CACHE);
          const keys = await all.keys();
          const hit = keys.find(
            (k) =>
              k.url === url.href ||
              k.url.startsWith(url.origin + url.pathname)
          );
          if (hit) return all.match(hit);
          throw _;
        }
      })()
    );
    return;
  }

  // --- Other cross-origin: do not intercept ---
  if (url.origin !== self.location.origin) {
    return;
  }

  // --- Navigations: network-first → cached index.html ---
  if (isNavigation(req)) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res && res.ok) {
            const copy = res.clone();
            event.waitUntil(
              caches.open(CACHE_VERSION).then((c) => {
                c.put('./index.html', copy);
                return c.put('./', res.clone()).catch(() => {});
              })
            );
          }
          return res;
        } catch (_) {
          return (
            (await caches.match('./index.html')) ||
            (await caches.match('./')) ||
            (await caches.match('/index.html')) ||
            new Response(
              '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>離線</title></head><body style="font-family:system-ui;padding:2rem;text-align:center;background:#f7f5f0;color:#1c1917"><h1>離線模式</h1><p>請先在有網路時開啟一次本 App，讓資源完成快取後再離線使用。</p></body></html>',
              { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            )
          );
        }
      })()
    );
    return;
  }

  // --- Same-origin assets: cache-first + background refresh ---
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      const networkPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            event.waitUntil(
              caches.open(CACHE_VERSION).then((c) => c.put(req, copy))
            );
          }
          return res;
        })
        .catch(() => cached);

      return cached || networkPromise;
    })()
  );
});
