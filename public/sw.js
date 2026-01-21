// Service Worker v8 - Non-blocking, subfolder-compatible
// Increment this version when deploying new builds
const CACHE_VERSION = 'v8';
const CACHE_NAME = `smart-tool-${CACHE_VERSION}`;

// Get the base path from the service worker's location (supports subfolders)
const SW_SCOPE = self.registration?.scope || self.location.href.replace(/sw\.js$/, '');

// Helper to resolve relative URLs to the SW scope
const resolveUrl = (path) => new URL(path, SW_SCOPE).href;

// Track if app has loaded - SW should NOT interfere until app signals ready
let appLoaded = false;

const OFFLINE_URL = 'offline.html';

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
      // Resolve relative paths to absolute URLs based on SW scope
      const urlsToCache = PRECACHE_ASSETS.map(path => resolveUrl(path));
      return cache.addAll(urlsToCache).catch(err => {
        // Don't fail install if some assets are missing
        console.warn('[SW] Some precache assets failed:', err);
      });
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
          .filter((name) => name.startsWith('smart-tool-') && name !== CACHE_NAME)
          .map((name) => {
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event - CRITICAL: Never block initial page load
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) return;
  
  // CRITICAL: During first load, avoid intercepting navigation/HTML requests
  // (prevents SW from interfering with initial page load).
  // BUT we DO allow caching of non-navigation assets (including cross-origin
  // LLM model files) even before the app signals ready. This prevents the
  // "AI module disappears after refresh" symptom on some browsers.
  if (!appLoaded) {
    const url = new URL(event.request.url);
    const isNavigationRequest = event.request.mode === 'navigate';
    const isHTMLFile = url.pathname.endsWith('.html') || url.pathname === '/' || !url.pathname.includes('.');
    if (isNavigationRequest || isHTMLFile) {
      return; // Let browser handle initial HTML/navigation normally
    }
    // Otherwise fall through to caching logic below.
  }

  const url = new URL(event.request.url);
  const isNavigationRequest = event.request.mode === 'navigate';
  const isJSFile = url.pathname.endsWith('.js');
  const isHTMLFile = url.pathname.endsWith('.html') || url.pathname === '/' || !url.pathname.includes('.');
  
  // Hashed assets (e.g., index-abc123.js) are immutable - use cache-first
  const isHashedAsset = /\.[a-f0-9]{8,}\.(js|css)$/.test(url.pathname);
  
  // For HTML and non-hashed JS files, use network-first
  if (isNavigationRequest || isHTMLFile || (isJSFile && !isHashedAsset)) {
    event.respondWith(
      fetch(event.request)
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
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            if (isNavigationRequest) {
              return caches.match(resolveUrl(OFFLINE_URL));
            }
            return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          });
        })
    );
    return;
  }

  // For static assets (images, fonts, css, hashed JS), use cache-first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Update cache in background for non-hashed assets
        if (!isHashedAsset) {
          event.waitUntil(
            fetch(event.request).then((response) => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, response.clone());
                });
              }
            }).catch(() => {})
          );
        }
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

// Single message listener for all message types
self.addEventListener('message', (event) => {
  if (!event.data) return;
  
  switch (event.data.type) {
    case 'APP_LOADED':
      appLoaded = true;
      break;
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME);
      break;
  }
});
