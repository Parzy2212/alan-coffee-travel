'use client'

// One opener for the device database shared by the offline sale queue and the saved menu.
// Version 2: at version 1 each file created only its own store, so whichever opened the
// database first left the other store missing (the saved menu never worked after a sale queue
// opened first). Upgrading creates any missing store and keeps the existing ones and their rows.
const DB_NAME    = 'alan-cafe-offline'
const DB_VERSION = 2

export const PENDING_ORDERS = 'pending-orders'
export const MENU_CACHE     = 'menu-cache'

// One connection per page, reused: a connection left open by every call would block the next
// version upgrade. When another tab needs to upgrade, this one closes and reopens on next use.
let conn: Promise<IDBDatabase> | null = null
// An older POS tab holds the old version open. The browser keeps the first open request waiting
// and queues later ones silently behind it, so while blocked every call fails at once instead.
let blocked: Error | null = null

export function openOfflineDB(): Promise<IDBDatabase> {
  if (blocked) return Promise.reject(blocked)
  if (conn) return conn
  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(PENDING_ORDERS)) db.createObjectStore(PENDING_ORDERS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(MENU_CACHE))     db.createObjectStore(MENU_CACHE, { keyPath: 'key' })
    }
    req.onblocked = () => {
      blocked = new Error('มีแท็บ POS อื่นเปิดค้างอยู่ ปิดแท็บนั้นแล้วโหลดหน้านี้ใหม่')
      reject(blocked)
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => { db.close(); conn = null }
      db.onclose = () => { conn = null }
      // the old tab closed after we were blocked: the waiting request finished, use it from now on
      if (blocked) { blocked = null; conn = Promise.resolve(db) }
      resolve(db)
    }
    req.onerror = () => { conn = null; reject(req.error) }
  })
  conn = pending
  pending.then(undefined, (e: unknown) => { if (conn === pending) conn = null; console.warn('[offline-db] open failed:', e) })
  return pending
}
