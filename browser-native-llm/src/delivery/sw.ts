/**
 * Service Worker for model file caching and offline support.
 *
 * Intercepts fetch requests for model files and serves them from
 * cache when available. Handles versioned cache updates, prefetching
 * of critical files, and cache-first with network-fallback strategy.
 */

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME_PREFIX = "smart-llm-";
const MODEL_PATH_PATTERN = /\/models\//;
const RETRIEVAL_PATH_PATTERN = /\/retrieval-packs\//;

/**
 * Install event: prefetch critical assets (tokenizer, config).
 */
self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Skip waiting to activate immediately
      await self.skipWaiting();
    })()
  );
});

/**
 * Activate event: clean up old caches.
 */
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Claim all clients immediately
      await self.clients.claim();

      // Clean up old cache versions
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(
        (name) =>
          name.startsWith(CACHE_NAME_PREFIX) &&
          !name.includes("@latest")
      );

      // Keep the 2 most recent versions per model
      const modelVersions = new Map<string, string[]>();
      for (const name of oldCaches) {
        const modelId = name.split("@")[0];
        const versions = modelVersions.get(modelId) ?? [];
        versions.push(name);
        modelVersions.set(modelId, versions);
      }

      const deletions: Promise<boolean>[] = [];
      for (const versions of modelVersions.values()) {
        const sorted = versions.sort().reverse();
        for (const old of sorted.slice(2)) {
          deletions.push(caches.delete(old));
        }
      }

      await Promise.all(deletions);
    })()
  );
});

/**
 * Fetch event: cache-first strategy for model and retrieval files.
 */
self.addEventListener("fetch", (event: FetchEvent) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests to prevent SSRF
  if (url.origin !== self.location.origin) {
    return;
  }

  // Only intercept model and retrieval pack requests
  if (
    !MODEL_PATH_PATTERN.test(url.pathname) &&
    !RETRIEVAL_PATH_PATTERN.test(url.pathname)
  ) {
    return;
  }

  event.respondWith(handleModelFetch(event.request));
});

/**
 * Cache-first fetch with network fallback.
 */
async function handleModelFetch(request: Request): Promise<Response> {
  // Check all smart-llm caches
  const cacheNames = await caches.keys();
  const smartCaches = cacheNames.filter((name) =>
    name.startsWith(CACHE_NAME_PREFIX)
  );

  for (const cacheName of smartCaches) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
  }

  // Cache miss: fetch from network
  try {
    const response = await fetch(request);

    if (response.ok) {
      // Cache the response for future use
      const cacheName = getCacheNameForUrl(request.url);
      const cache = await caches.open(cacheName);

      // Clone response since it can only be consumed once
      await cache.put(request, response.clone());

      return response;
    }

    return response;
  } catch (error) {
    // Network failure: return a 503 with helpful message
    return new Response(
      JSON.stringify({
        error: "Model file unavailable offline and not cached",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Determine which cache to use based on the URL.
 */
function getCacheNameForUrl(url: string): string {
  // Extract model ID and version from URL path if possible
  const match = url.match(/models\/([^/]+)-v([^/]+)\//);
  if (match && match[1].length <= 100 && match[2].length <= 50) {
    return `${CACHE_NAME_PREFIX}${match[1]}@${match[2]}`;
  }

  // Default cache for unversioned resources
  return `${CACHE_NAME_PREFIX}default@latest`;
}

/**
 * Handle messages from the main thread (e.g., cache management commands).
 */
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  const { type, payload } = event.data ?? {};

  switch (type) {
    case "prefetch":
      event.waitUntil(handlePrefetch(payload));
      break;

    case "clear-cache":
      event.waitUntil(handleClearCache(payload));
      break;

    case "get-cache-status":
      event.waitUntil(handleGetCacheStatus(event));
      break;
  }
});

async function handlePrefetch(payload: {
  urls: string[];
  cacheName: string;
}): Promise<void> {
  if (!payload.cacheName || payload.cacheName.length > 200 || !payload.cacheName.startsWith(CACHE_NAME_PREFIX)) {
    return;
  }
  const cache = await caches.open(payload.cacheName);

  for (const url of payload.urls) {
    try {
      // Validate URL before fetching to prevent SSRF
      const parsed = new URL(url, self.location.origin);
      if (parsed.origin !== self.location.origin) continue;
      const response = await fetch(parsed.href);
      if (response.ok) {
        await cache.put(url, response);
      }
    } catch {
      // Prefetch failure is non-critical
    }
  }
}

async function handleClearCache(payload?: {
  modelId?: string;
  version?: string;
}): Promise<void> {
  const cacheNames = await caches.keys();

  for (const name of cacheNames) {
    if (!name.startsWith(CACHE_NAME_PREFIX)) continue;

    if (payload?.modelId) {
      if (name.includes(payload.modelId)) {
        if (payload.version) {
          if (name.includes(payload.version)) {
            await caches.delete(name);
          }
        } else {
          await caches.delete(name);
        }
      }
    } else {
      await caches.delete(name);
    }
  }
}

async function handleGetCacheStatus(
  event: ExtendableMessageEvent
): Promise<void> {
  const cacheNames = await caches.keys();
  const status: Array<{ name: string; entries: number }> = [];

  for (const name of cacheNames) {
    if (!name.startsWith(CACHE_NAME_PREFIX)) continue;
    const cache = await caches.open(name);
    const keys = await cache.keys();
    status.push({ name, entries: keys.length });
  }

  event.source?.postMessage({ type: "cache-status", status });
}
