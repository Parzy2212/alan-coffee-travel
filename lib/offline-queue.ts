'use client'

export type OfflineOrder = {
  id: string           // local UUID
  payload: Record<string, unknown>
  createdAt: number
  attempts: number
  lastAttempt: number | null
}

const DB_NAME    = 'alan-cafe-offline'
const DB_VERSION = 1
const STORE      = 'pending-orders'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE)
}

export async function enqueueOrder(payload: Record<string, unknown>): Promise<string> {
  const db  = await openDB()
  const id  = crypto.randomUUID()
  const row: OfflineOrder = { id, payload, createdAt: Date.now(), attempts: 0, lastAttempt: null }
  await new Promise<void>((res, rej) => {
    const req = tx(db, 'readwrite').add(row)
    req.onsuccess = () => res()
    req.onerror   = () => rej(req.error)
  })
  tryRegisterSync()
  return id
}

export async function getPendingOrders(): Promise<OfflineOrder[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').getAll()
    req.onsuccess = () => resolve(req.result as OfflineOrder[])
    req.onerror   = () => reject(req.error)
  })
}

export async function removeOrder(id: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((res, rej) => {
    const req = tx(db, 'readwrite').delete(id)
    req.onsuccess = () => res()
    req.onerror   = () => rej(req.error)
  })
}

export async function updateAttempt(id: string): Promise<void> {
  const db = await openDB()
  const existing: OfflineOrder | undefined = await new Promise((res, rej) => {
    const req = tx(db, 'readonly').get(id)
    req.onsuccess = () => res(req.result)
    req.onerror   = () => rej(req.error)
  })
  if (!existing) return
  await new Promise<void>((res, rej) => {
    const req = tx(db, 'readwrite').put({ ...existing, attempts: existing.attempts + 1, lastAttempt: Date.now() })
    req.onsuccess = () => res()
    req.onerror   = () => rej(req.error)
  })
}

export async function getPendingCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').count()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function tryRegisterSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(reg => {
      // @ts-expect-error — SyncManager not in all TS lib versions
      reg.sync.register('offline-orders').catch(() => {})
    })
  }
}

export async function replayQueue(
  submitFn: (payload: Record<string, unknown>) => Promise<boolean>
): Promise<{ replayed: number; failed: number }> {
  const orders = await getPendingOrders()
  let replayed = 0; let failed = 0
  for (const order of orders) {
    await updateAttempt(order.id)
    const delay = Math.min(1000 * 2 ** order.attempts, 30000)
    if (order.lastAttempt && Date.now() - order.lastAttempt < delay) { failed++; continue }
    try {
      const ok = await submitFn(order.payload)
      if (ok) { await removeOrder(order.id); replayed++ } else { failed++ }
    } catch { failed++ }
  }
  return { replayed, failed }
}
