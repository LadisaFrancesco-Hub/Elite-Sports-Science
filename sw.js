const APP_VERSION = 'v6.1';
const SHELL_CACHE   = `coachos-shell-${APP_VERSION}`;
const RUNTIME_CACHE = `coachos-runtime-${APP_VERSION}`;

// App shell: sempre offline-ready
const SHELL_ASSETS = ['/', '/index.html', '/manifest.json', '/icona.png'];

// Asset statici: stale-while-revalidate (serve veloce, aggiorna in background)
const STATIC_EXT = /\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf|webp)(\?.*)?$/;

// ── Install ───────────────────────────────────────────────────────────────────
// Non si chiama skipWaiting: l'UI mostra un banner e aspetta il consenso utente.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_ASSETS))
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, RUNTIME_CACHE]);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.has(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Message ───────────────────────────────────────────────────────────────────
// Il banner nell'UI invia SKIP_WAITING quando l'utente clicca "Ricarica"
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass: schemi non-http e chiamate Supabase
  if (!request.url.startsWith('http')) return;
  if (url.hostname.includes('supabase.co')) return;

  // 1. Navigazione → shell cache-first (SPA: serve sempre /index.html)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html')
        .then(cached => cached || fetch('/index.html'))
        .catch(() => new Response('Offline — riconnettiti e ricarica.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        }))
    );
    return;
  }

  // 2. Shell assets (manifest, icone) → cache-first
  if (url.origin === self.location.origin && SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // 3. Asset statici (JS, CSS, immagini, font) → stale-while-revalidate
  if (url.origin === self.location.origin && STATIC_EXT.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // 4. Tutto il resto → network-first con fallback cache
  event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

// ── Strategie ─────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  // Aggiornamento in background: non blocca la risposta all'utente
  const revalidate = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached ?? (await revalidate);
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (await caches.match('/index.html'));
  }
}
