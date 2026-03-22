/* Tasteza Service Worker v4 */

// ── Cache names include build timestamp so they auto-bust on deploy ──
// This value is replaced by the build process or incremented manually on deploy
const BUILD_ID = Date.now(); // fallback; ideally inject via build
const SHELL_CACHE = 'tasteza-shell-v4';
const API_CACHE = 'tasteza-api-v4';

const SHELL_URLS = ['/', '/index.html', '/offline.html'];

// API routes safe to cache for offline reads
const CACHEABLE_API_PREFIXES = [
  '/api/menuitems',
  '/api/tables',
  '/api/categories',
  '/api/units',
  '/api/courses',
  '/api/settings',
  '/api/coupons',
  '/api/staff',
];

// ── Install: pre-cache app shell only (NO JS/CSS chunks) ─────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => c.addAll(SHELL_URLS).catch(() => { }))
      .then(() => self.skipWaiting())  // activate immediately
  );
});

// ── Activate: wipe ALL old caches aggressively ────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== API_CACHE)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // Tell all open tabs to reload so they pick up new assets
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
        });
      })
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle same-origin or local network requests
  if (
    url.hostname !== location.hostname &&
    !url.hostname.match(/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./)
  ) return;

  // Skip non-GET — mutations handled by app-level queue
  if (request.method !== 'GET') return;

  // ── hot-update files: NEVER cache, always network ────────────────
  // These are webpack HMR files (*.hot-update.json, *.hot-update.js)
  // They are only valid during development and should never be cached
  if (url.pathname.includes('.hot-update.')) {
    e.respondWith(fetch(request).catch(() => new Response('', { status: 404 })));
    return;
  }

  // ── Hashed static assets (JS/CSS chunks): network-first, short cache ─
  // Webpack generates unique hashes per build (main.abc123.js)
  // We use network-first so new deploys always get fresh files.
  // Only fall back to cache if network fails (offline scenario).
  const isHashedAsset =
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font';

  if (isHashedAsset) {
    e.respondWith(
      fetch(request)
        .then(resp => {
          if (resp.ok) {
            // Cache a copy for offline fallback only
            const respClone = resp.clone();
            caches.open(SHELL_CACHE).then(c => c.put(request, respClone));
          }
          return resp;
        })
        .catch(() =>
          // Offline: try cache as last resort
          caches.match(request).then(r => r || new Response('', { status: 404 }))
        )
    );
    return;
  }

  // ── Images: cache-first (images don't change often) ──────────────
  if (request.destination === 'image') {
    e.respondWith(
      caches.match(request).then(r => r || fetch(request)
        .then(resp => {
          if (resp.ok) {
            caches.open(SHELL_CACHE).then(c => c.put(request, resp.clone()));
          }
          return resp;
        })
        .catch(() => new Response('', { status: 404 }))
      )
    );
    return;
  }

  // ── Navigation requests: network-first, fallback to index.html ───
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(r => {
          if (r.ok) caches.open(SHELL_CACHE).then(c => c.put(request, r.clone()));
          return r;
        })
        .catch(() =>
          caches.match('/index.html').then(r => r || caches.match('/offline.html'))
        )
    );
    return;
  }

  // ── Cacheable API GETs: network-first, fall back to cache ────────
  if (
    url.pathname.startsWith('/api/') &&
    CACHEABLE_API_PREFIXES.some(p => url.pathname.startsWith(p))
  ) {
    e.respondWith(
      fetch(request)
        .then(r => {
          if (r.ok) cache(API_CACHE, request, r.clone());
          return r;
        })
        .catch(() =>
          caches.match(request, { cacheName: API_CACHE })
            .then(r => r || offlineJson({ success: false, offline: true, data: [] }))
        )
    );
    return;
  }
});

// ── Background Sync ───────────────────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'tasteza-sync') e.waitUntil(notifyFlush());
});

// ── Message from app ──────────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'FLUSH_QUEUE') notifyFlush();
});

function notifyFlush() {
  return self.clients.matchAll().then(clients =>
    clients.forEach(c => c.postMessage({ type: 'DO_FLUSH' }))
  );
}

function cache(name, request, response) {
  if (!response || !response.ok) return;
  caches.open(name).then(c => c.put(request, response));
}

function offlineJson(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}