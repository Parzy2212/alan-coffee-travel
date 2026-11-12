'use client'

export type OfflineOrder = {
  id: string           // local UUID
  payload: Record<string, unknown>
  createdAt: number
  attempts: number
  lastAttempt: number | null
  rejected?: string    // the server's refusal; set = no more automatic sending
}

/** After this many sends without an answer the bill is shown to the cashier (sending still goes on). */
export const STALLED_AFTER = 10

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

export async function enqueueOrder(payload: Record<string, unknown>, id: string = crypto.randomUUID()): Promise<string> {
  const db  = await openDB()
  const row: OfflineOrder = { id, payload, createdAt: Date.now(), attempts: 0, lastAttempt: null }
  await new Promise<void>((res, rej) => {
    // put, not add: saving the same checkout again (same id) must not fail
    const req = tx(db, 'readwrite').put(row)
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

async function patchOrder(id: string, patch: (o: OfflineOrder) => OfflineOrder): Promise<void> {
  const db = await openDB()
  const existing: OfflineOrder | undefined = await new Promise((res, rej) => {
    const req = tx(db, 'readonly').get(id)
    req.onsuccess = () => res(req.result)
    req.onerror   = () => rej(req.error)
  })
  if (!existing) return
  await new Promise<void>((res, rej) => {
    const req = tx(db, 'readwrite').put(patch(existing))
    req.onsuccess = () => res()
    req.onerror   = () => rej(req.error)
  })
}

/**
 * Puts a bill back in line for sending now (the cashier pressed "send again"). attempts stays
 * at the "shown" level so the bill keeps showing on the selling screen until it really gets in.
 */
export async function retryOrder(id: string): Promise<void> {
  await patchOrder(id, ({ rejected: _dropped, ...o }) => ({ ...o, attempts: Math.max(o.attempts, STALLED_AFTER), lastAttempt: null }))
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

export function isStuck(o: OfflineOrder): boolean {
  return !!o.rejected || o.attempts >= STALLED_AFTER
}

export type ReplayResult = 'ok' | 'retry' | { rejected: string }

/**
 * Sends the waiting bills. 'retry' = no answer from the server (try again later, with a
 * growing pause). { rejected } = the server answered and refused the bill: sending it
 * again cannot work, so it is kept, marked, and shown to the cashier instead.
 */
export async function replayQueue(
  submitFn: (payload: Record<string, unknown>, order: OfflineOrder) => Promise<ReplayResult>
): Promise<{ replayed: number; failed: number }> {
  const orders = await getPendingOrders()
  let replayed = 0; let failed = 0
  for (const order of orders) {
    if (order.rejected) { failed++; continue }
    const delay = Math.min(1000 * 2 ** order.attempts, 30000)
    if (order.lastAttempt && Date.now() - order.lastAttempt < delay) { failed++; continue }
    let result: ReplayResult = 'retry'
    try { result = await submitFn(order.payload, order) } catch { /* no answer: retry */ }
    if (result === 'ok') { await removeOrder(order.id); replayed++; continue }
    failed++
    const reason = result === 'retry' ? undefined : result.rejected
    try {
      await patchOrder(order.id, o => ({ ...o, attempts: o.attempts + 1, lastAttempt: Date.now(), ...(reason ? { rejected: reason } : {}) }))
    } catch { /* storage hiccup: the bill is still in the queue, go on with the next one */ }
  }
  return { replayed, failed }
}
