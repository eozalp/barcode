const CACHE_NAME = 'qr-calc-app-v5'; // Incremented for this full code version
const urlsToCache = [
  './', // Represents the root of your application, often resolves to index.html
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/zxing-library.min.js', // ZXing for 2D barcodes
  'https://cdn.jsdelivr.net/npm/expr-eval@2.0.2/dist/bundle.min.js', // Formula evaluation
  'https://fonts.googleapis.com/icon?family=Material+Icons', // Material Icons
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
  // Add other assets like fonts or images if you have them
];

// Install event: Cache core assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Install event - Caching app shell');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Failed to cache app shell during install:', error);
        // If addAll fails, the SW install fails. This is important.
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate event - Cleaning old caches');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim(); // Ensure new SW takes control immediately
    })
  );
});

// Fetch event: Serve cached content when offline, or fetch from network
self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Cache hit - return response
        if (cachedResponse) {
          // console.log('[Service Worker] Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // Not in cache, fetch from network
        // console.log('[Service Worker] Fetching from network:', event.request.url);
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
              return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = networkResponse.clone();

            // Only cache responses from our predefined list or same-origin resources for safety,
            // or specifically whitelisted CDNs.
            // This is a simple check; you might want more sophisticated logic.
            const isCachable = urlsToCache.includes(event.request.url) ||
                               new URL(event.request.url).origin === self.location.origin ||
                               event.request.url.startsWith('https://fonts.gstatic.com'); // For Material Icons fonts

            if (isCachable) {
              caches.open(CACHE_NAME)
                .then(cache => {
                  // console.log('[Service Worker] Caching new resource:', event.request.url);
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          }
        ).catch(error => {
          console.error('[Service Worker] Fetch failed; network error or offline:', event.request.url, error);
          // Optionally, return a custom offline fallback page for navigation requests
          // if (event.request.mode === 'navigate') {
          //   return caches.match('./offline.html'); // You would need to create and cache an offline.html
          // }
          // For other requests, the browser's default error handling will take over.
        });
      })
  );
});
