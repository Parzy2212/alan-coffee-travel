'use client'

const DB_NAME    = 'alan-cafe-offline'
const DB_VERSION = 1
const STORE      = 'menu-cache'
const CACHE_TTL  = 60 * 60 * 1000 // 1 hour

type CacheEntry<T> = { key: string; data: T; cachedAt: number }

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('pending-orders')) db.createObjectStore('pending-orders', { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB()
    const entry: CacheEntry<T> | undefined = await new Promise((res, rej) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      req.onsuccess = () => res(req.result)
      req.onerror   = () => rej(req.error)
    })
    if (!entry) return null
    if (Date.now() - entry.cachedAt > CACHE_TTL) return null
    return entry.data
  } catch { return null }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((res, rej) => {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put({ key, data, cachedAt: Date.now() })
      req.onsuccess = () => res()
      req.onerror   = () => rej(req.error)
    })
  } catch {}
}

export async function clearCache(key?: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((res, rej) => {
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
      const req = key ? store.delete(key) : store.clear()
      req.onsuccess = () => res()
      req.onerror   = () => rej(req.error)
    })
  } catch {}
}

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  forceRefresh = false
): Promise<{ data: T; fromCache: boolean }> {
  if (!forceRefresh) {
    const cached = await getCached<T>(key)
    if (cached !== null) return { data: cached, fromCache: true }
  }
  const data = await fetcher()
  await setCache(key, data)
  return { data, fromCache: false }
}
