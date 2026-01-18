// BUG FIX #6: Use relative paths for subfolder deployments
// Increment this version when deploying new builds
const CACHE_VERSION = 'v5';
const CACHE_NAME = `smart-tool-${CACHE_VERSION}`;

// Get the base path from the service worker's location (supports subfolders)
const SW_SCOPE = self.registration?.scope || self.location.href.replace(/sw\.js$/, '');

// Helper to resolve relative URLs to the SW scope
const resolveUrl = (path) => new URL(path, SW_SCOPE).href;

const OFFLINE_URL = 'offline.html'; // Relative path

// Assets to cache immediately on install (relative paths for subfolder support)
const PRECACHE_ASSETS = [
  '', // Root index
  'index.html',
  'offline.html',
  'manifest.json',
  'favicon.ico',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png'
];

// Install event - cache core assets with resolved URLs
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching core assets for scope:', SW_SCOPE);
      // Resolve relative paths to absolute URLs based on SW scope
      const urlsToCache = PRECACHE_ASSETS.map(path => resolveUrl(path));
      return cache.addAll(urlsToCache);
    })
  );
  // Force immediate activation
  self.skipWaiting();
});

// Activate event - clean up old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event - NETWORK FIRST for HTML and JS, cache fallback for assets
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);
  const isNavigationRequest = event.request.mode === 'navigate';
  const isJSFile = url.pathname.endsWith('.js');
  const isHTMLFile = url.pathname.endsWith('.html') || url.pathname === '/' || !url.pathname.includes('.');
  
  // Hashed assets (e.g., index-abc123.js) are immutable - use cache-first
  const isHashedAsset = /\.[a-f0-9]{8,}\.(js|css)$/.test(url.pathname);
  
  // CRITICAL: For HTML and non-hashed JS files, ALWAYS use network-first
  // This prevents stale JavaScript from being served after deployments
  // Hashed assets are immutable and safe to cache-first
  if (isNavigationRequest || isHTMLFile || (isJSFile && !isHashedAsset)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Only cache successful responses
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache only if network fails
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // Return offline page for navigation requests
            if (isNavigationRequest) {
              return caches.match(resolveUrl(OFFLINE_URL));
            }
            return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          });
        })
    );
    return;
  }

  // For static assets (images, fonts, css), use cache-first strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Update cache in background
        event.waitUntil(
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response.clone());
              });
            }
          }).catch(() => {})
        );
        return cachedResponse;
      }

      // Fetch from network and cache
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
    })
  );
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
