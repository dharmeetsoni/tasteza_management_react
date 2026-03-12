/* Tasteza Service Worker v3 */
const SHELL_CACHE = 'tasteza-shell-v3';
const API_CACHE   = 'tasteza-api-v3';

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

// ── Install: pre-cache app shell ─────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => c.addAll(SHELL_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clear old caches ───────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== API_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle same-origin or local network requests
  if (url.hostname !== location.hostname &&
      !url.hostname.match(/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./)) return;

  // Skip non-GET — mutations handled by app-level queue
  if (request.method !== 'GET') return;

  // Navigation requests — serve app shell
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(r => { cache(SHELL_CACHE, request, r.clone()); return r; })
        .catch(() => caches.match('/index.html').then(r => r || caches.match('/offline.html')))
    );
    return;
  }

  // Cacheable API GETs — network first, fall back to cache
  if (url.pathname.startsWith('/api/') &&
      CACHEABLE_API_PREFIXES.some(p => url.pathname.startsWith(p))) {
    e.respondWith(
      fetch(request)
        .then(r => { if (r.ok) cache(API_CACHE, request, r.clone()); return r; })
        .catch(() => caches.match(request, { cacheName: API_CACHE })
          .then(r => r || offlineJson({ success: false, offline: true, data: [] }))
        )
    );
    return;
  }

  // Static assets (JS/CSS/images) — cache first
  if (request.destination === 'script' ||
      request.destination === 'style'  ||
      request.destination === 'image'  ||
      request.destination === 'font') {
    e.respondWith(
      caches.match(request).then(r => r || fetch(request)
        .then(resp => { cache(SHELL_CACHE, request, resp.clone()); return resp; })
        .catch(() => new Response('', { status: 404 }))
      )
    );
    return;
  }
});

// ── Background Sync ──────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'tasteza-sync') e.waitUntil(notifyFlush());
});

// ── Message from app ─────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'FLUSH_QUEUE')  notifyFlush();
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
    headers: { 'Content-Type': 'application/json' }
  });
}
