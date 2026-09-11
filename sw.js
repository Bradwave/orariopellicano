/**
 * Service Worker per Orario Pellicano PWA.
 * Strategia di caching offline per shell dell'app, moduli ES6 e fallback orario.
 * Adozione di Stale-While-Revalidate per auto-aggiornamento silenzioso delle risorse.
 */

const CACHE_NAME = 'orario-pellicano-v1.4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './public/default-schedule.xml',
  './public/themes.json',
  './src/config/themes.json',
  './src/config/calendar.json',
  './public/fonts/SpaceMono-Regular.woff2',
  './public/fonts/SpaceMono-Bold.woff2',
  './public/icon-192.png',
  './public/icon-512.png',
  './src/styles/variables.css',
  './src/styles/reset.css',
  './src/styles/components.css',
  './src/styles/print.css',
  './src/styles/main.css',
  './src/app.js',
  './src/modules/api.js',
  './src/modules/calendar.js',
  './src/modules/colors.js',
  './src/modules/exportIcs.js',
  './src/modules/exportManager.js',
  './src/modules/icons.js',
  './src/modules/parser.js',
  './src/modules/radar.js',
  './src/modules/share.js',
  './src/modules/storage.js',
  './src/modules/themeManager.js',
  './src/modules/time.js',
  './src/modules/views/badges.js',
  './src/modules/views/classView.js',
  './src/modules/views/radarView.js',
  './src/modules/views/search.js',
  './src/modules/views/settingsModal.js',
  './src/modules/views/subjectView.js',
  './src/modules/views/subsView.js',
  './src/modules/views/teacherView.js'
];

// Installazione Service Worker e pre-caching asset locali
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 [PWA Service Worker] Pre-caching asset completi shell...');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Avviso: alcuni asset statici non sono stati memorizzati in cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Attivazione e pulizia vecchie versioni della cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME && !key.startsWith('google-fonts-')).map((key) => {
          console.log('🧹 [PWA Service Worker] Eliminazione vecchia cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercettazione richieste di rete
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Non intercettare richieste non GET o schemi non-http
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // 1. Proxy Cloudflare dell'orario scolastico (Network First con timeout locale)
  if (url.hostname.includes('workers.dev')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response('', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // 2. Google Fonts (Cache First con salvataggio runtime)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open('google-fonts-cache').then((cache) => cache.put(event.request, clone));
          }
          return networkRes;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 3. Asset locali dell'applicazione: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Revalidate in background se online
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {});

      // Se già in cache, rispondi subito (istantaneo)
      if (cachedResponse) {
        return cachedResponse;
      }

      // Altrimenti attendi la rete
      return fetchPromise;
    }).catch(() => {
      // Fallback per navigazione offline
      if (event.request.headers.get('accept')?.includes('text/html')) {
        return caches.match('./index.html');
      }
    })
  );
});
