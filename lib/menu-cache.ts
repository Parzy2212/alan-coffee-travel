'use client'

import { MENU_CACHE as STORE, openOfflineDB as openDB } from './offline-db'

type CacheEntry<T> = { key: string; data: T; cachedAt: number }

// The saved copy is only used when the server can't be reached, so it never expires:
// yesterday's menu is better than an empty one when the shop opens without internet.
export async function getCached<T>(key: string): Promise<{ data: T; cachedAt: number } | null> {
  try {
    const db = await openDB()
    const entry: CacheEntry<T> | undefined = await new Promise((res, rej) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      req.onsuccess = () => res(req.result)
      req.onerror   = () => rej(req.error)
    })
    return entry ? { data: entry.data, cachedAt: entry.cachedAt } : null
  } catch (e) {
    console.warn('[menu-cache] read failed:', e)
    return null
  }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((res, rej) => {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put({ key, data, cachedAt: Date.now() })
      req.onsuccess = () => res()
      req.onerror   = () => rej(req.error)
    })
  } catch (e) {
    console.warn('[menu-cache] save failed:', e)
  }
}
