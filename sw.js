/**
 * Service Worker per Orario Pellicano PWA.
 * Strategia di caching offline per shell dell'app e fallback orario.
 */

const CACHE_NAME = 'orario-pellicano-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './public/favicon.svg',
  './default-schedule.xml',
  './public/default-schedule.xml',
  './src/styles/variables.css',
  './src/styles/reset.css',
  './src/styles/components.css',
  './src/styles/print.css',
  './src/styles/main.css',
  './src/app.js',
  './src/modules/parser.js',
  './src/modules/storage.js',
  './src/modules/api.js',
  './src/modules/time.js',
  './src/modules/radar.js',
  './src/modules/share.js',
  './src/modules/exportIcs.js',
  './src/modules/views/badges.js',
  './src/modules/views/search.js',
  './src/modules/views/classView.js',
  './src/modules/views/teacherView.js',
  './src/modules/views/subjectView.js',
  './src/modules/views/subsView.js',
  './src/modules/views/radarView.js',
  './src/modules/views/settingsModal.js'
];

// Installazione Service Worker e pre-caching asset
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 [PWA Service Worker] Pre-caching app shell...');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Alcuni asset statici non sono stati memorizzati in cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Attivazione e pulizia vecchie versioni della cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('🧹 [PWA Service Worker] Eliminazione vecchia cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercettazione richieste di rete (Cache First per asset locali, Network First per proxy)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Non intercettare richieste diverse da GET o schemi non-http
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Se è una richiesta di proxy orario remoto, prova prima la rete
  if (url.hostname.includes('workers.dev')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Se offline, l'app usa il localStorage nativamente
        return new Response('', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // Per gli asset statici dell'applicazione: Cache-First con fallback alla rete
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Ritorna subito dalla cache e aggiorna silenziosamente in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    }).catch(() => {
      // Fallback offline se la richiesta fallisce completamente
      if (event.request.headers.get('accept')?.includes('text/html')) {
        return caches.match('./index.html');
      }
    })
  );
});
