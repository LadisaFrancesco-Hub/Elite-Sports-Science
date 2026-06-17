const CACHE_NAME = 'coachos-elite-v5.7';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icona.png' // Se hai chiamato la tua icona in modo diverso, correggi questo nome
];

// FASE 1: Installazione (Salva i file essenziali)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache aperta, salvataggio asset...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// FASE 2: Attivazione (Pulisce le vecchie cache spazzatura)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Rimozione vecchia cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// FASE 3: Intercettazione (Network First, Fallback to Cache)
self.addEventListener('fetch', (event) => {
  // 1. FIX CRITICO: Ignora le estensioni di Chrome (Risolve l'errore rosso in console)
  if (!event.request.url.startsWith('http')) {
      return;
  }

  // 2. Lasciamo che le chiamate al database Supabase viaggino libere
  if (event.request.url.includes('supabase.co')) {
     return; 
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('/index.html');
        });
      })
  );
});