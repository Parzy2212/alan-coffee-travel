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

// A page waits this long for the network before the cached copy is shown (shop WiFi that is up but has no internet)
const PAGE_TIMEOUT_MS = 4000
// Static files are refreshed at most once a day while in use; a file not used for 30 days (an old build's
// chunk) is deleted, so the cache does not grow with every deploy
const STATIC_REFRESH_MS = 24 * 3600 * 1000
const STATIC_MAX_AGE_MS = 30 * 24 * 3600 * 1000

const SUPABASE_PATTERNS = [
  /supabase\.co/,
]

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => Promise.all(
      ['/icons/icon-192x192.png', '/icons/icon-512x512.png', '/manifest.json'].map(async path => {
        const response = await fetch(path)
        if (!response.ok) throw new Error(`sw install: ${path} ${response.status}`)
        await cache.put(path, stamped(response))
      })
    ))
  )
})

// ── Activate ───────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k)))
    ).then(() => trimStatic()).then(() => self.clients.claim())
  )
})

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Dev server chunk URLs are not content-hashed, so caching them serves stale code
  if (['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname)) return

  // Skip non-GET and chrome-extension
  if (request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return

  // Cache-first for static assets
  if (STATIC_PATTERNS.some(p => p.test(request.url))) {
    event.respondWith(cacheFirst(event, STATIC_CACHE))
    return
  }

  // Network-first for Supabase API (never cache — auth-sensitive)
  if (SUPABASE_PATTERNS.some(p => p.test(request.url))) {
    event.respondWith(networkOnly(request))
    return
  }

  // Network-first for app pages: a cached page names the chunks of the build it came from, and a
  // deploy deletes those, so a cached page is only used when the network is down or too slow
  if (url.origin === self.location.origin && request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(event, PAGE_CACHE))
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
function stamped(response) {
  const headers = new Headers(response.headers)
  headers.set('x-alan-cached-at', String(Date.now()))
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

const cachedAt = response => Number(response.headers.get('x-alan-cached-at')) || 0
const warn = what => err => console.warn(`sw: ${what}`, err)

async function cacheFirst(event, cacheName) {
  const { request } = event
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) {
    if (Date.now() - cachedAt(cached) > STATIC_REFRESH_MS) {
      // offline or a deleted old-build chunk: keep the cached copy, it ages out by itself
      event.waitUntil(fetch(request).then(r => { if (r.ok) return cache.put(request, stamped(r)) }).catch(() => {}))
    }
    return cached
  }
  const response = await fetch(request)
  if (response.ok) event.waitUntil(cache.put(request, stamped(response.clone())).catch(warn('static cache write failed')))
  return response
}

let lastTrim = 0
async function trimStatic() {
  lastTrim = Date.now()
  const cache = await caches.open(STATIC_CACHE)
  for (const key of await cache.keys()) {
    const response = await cache.match(key)
    if (!response) continue
    // cached by the service worker before stamps existed: start its 30 days now, so the update does not
    // empty the cache that pages not yet reopened online still need offline
    if (!cachedAt(response)) await cache.put(key, stamped(response))
    else if (Date.now() - cachedAt(response) > STATIC_MAX_AGE_MS) await cache.delete(key)
  }
}

async function networkOnly(request) {
  try { return await fetch(request) } catch { return new Response(null, { status: 503 }) }
}

async function networkFirst(event, cacheName) {
  const { request } = event
  const cache = await caches.open(cacheName)
  const network = fetch(request)
  // registered before the page can read the body, so the clone is taken first; kept alive after a timeout
  // so the next open gets the new copy
  event.waitUntil(network.then(async response => {
    if (!response.ok) return
    await cache.put(request, response.clone())
    if (Date.now() - lastTrim > 3600 * 1000) await trimStatic()
  }).catch(warn('page cache write failed')))
  const cached = await cache.match(request)
  if (!cached) return network.catch(() => new Response(null, { status: 503 }))
  // a server error (Cloudflare 5xx) shows the cached page too, not an error page
  const answered = network.then(r => (r.status >= 500 ? cached : r), () => cached)
  const slow = new Promise(resolve => setTimeout(() => resolve(cached), PAGE_TIMEOUT_MS))
  return Promise.race([answered, slow])
}

// ── Update notification ────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
