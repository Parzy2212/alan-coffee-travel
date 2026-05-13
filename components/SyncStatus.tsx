'use client'

import { useEffect, useState } from 'react'
import { getPendingCount } from '@/lib/offline-queue'
import { useNetworkStatus } from '@/lib/network-status'

export function SyncStatus() {
  const online = useNetworkStatus()
  const [pending, setPending] = useState(0)

  async function refresh() {
    try { setPending(await getPendingCount()) } catch {}
  }

  useEffect(() => {
    void refresh()
    const id = setInterval(refresh, 5000)
    window.addEventListener('alan:queue-changed', refresh)
    return () => { clearInterval(id); window.removeEventListener('alan:queue-changed', refresh) }
  }, [])

  if (pending === 0 && online) return null

  const color  = !online ? '#ff6b6b' : pending > 0 ? '#f59e0b' : '#4cba7f'
  const dot    = !online ? '🔴' : pending > 0 ? '🟡' : '🟢'
  const label  = !online ? 'Offline' : pending > 0 ? `${pending} pending` : 'Synced'

  return (
    <div title={label} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      backgroundColor: `${color}18`, border: `1px solid ${color}44`,
      fontSize: 11, fontWeight: 600, color,
      cursor: 'default',
    }}>
      <span style={{ fontSize: 9 }}>{dot}</span>
      {label}
    </div>
  )
}
