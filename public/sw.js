// Alan Cafe OS — Service Worker
const CACHE_VERSION = 'v1'
const STATIC_CACHE  = `alan-static-${CACHE_VERSION}`
const PAGE_CACHE    = `alan-pages-${CACHE_VERSION}`
const ALL_CACHES    = [STATIC_CACHE, PAGE_CACHE]

const STATIC_PATTERNS = [
  /\/_next\/static\//,
  /\/icons\//,
  /\/manifest\.json$/,
]

const SUPABASE_PATTERNS = [
  /supabase\.co/,
]

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      cache.addAll(['/icons/icon-192x192.png', '/icons/icon-512x512.png', '/manifest.json'])
    )
  )
})

// ── Activate ───────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and chrome-extension
  if (request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return

  // Cache-first for static assets
  if (STATIC_PATTERNS.some(p => p.test(request.url))) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Network-first for Supabase API (never cache — auth-sensitive)
  if (SUPABASE_PATTERNS.some(p => p.test(request.url))) {
    event.respondWith(networkOnly(request))
    return
  }

  // Stale-while-revalidate for app pages
  if (url.origin === self.location.origin && request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(request, PAGE_CACHE))
    return
  }
})

// ── Background Sync ────────────────────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'offline-orders') {
    event.waitUntil(replayOfflineOrders())
  }
})

async function replayOfflineOrders() {
  // Signal all clients to replay their offline queue
  const clients = await self.clients.matchAll({ type: 'window' })
  for (const client of clients) {
    client.postMessage({ type: 'REPLAY_OFFLINE_QUEUE' })
  }
}

// ── Strategies ─────────────────────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, response.clone())
  }
  return response
}

async function networkOnly(request) {
  try { return await fetch(request) } catch { return new Response(null, { status: 503 }) }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone())
    return response
  }).catch(() => null)
  return cached ?? await fetchPromise ?? new Response(null, { status: 503 })
}

// ── Update notification ────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
