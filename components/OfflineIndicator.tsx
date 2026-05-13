'use client'

import { useEffect, useState } from 'react'
import { useNetworkStatus } from '@/lib/network-status'

export function OfflineIndicator() {
  const online  = useNetworkStatus()
  const [flash, setFlash] = useState(false)
  const [prevOnline, setPrevOnline] = useState(online)

  useEffect(() => {
    if (!prevOnline && online) {
      // Just came back online
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 3000)
      setPrevOnline(online)
      return () => clearTimeout(t)
    }
    setPrevOnline(online)
  }, [online, prevOnline])

  if (online && !flash) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      padding: '10px 16px',
      backgroundColor: online ? '#4cba7f' : '#1a1a1a',
      borderBottom: online ? '1px solid rgba(76,186,127,0.3)' : '1px solid rgba(255,107,107,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      zIndex: 10000,
      transition: 'background-color 0.3s',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        backgroundColor: online ? '#4cba7f' : '#ff6b6b',
        boxShadow: online ? '0 0 8px #4cba7f' : '0 0 8px #ff6b6b',
      }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: online ? '#000' : 'rgba(255,255,255,0.8)' }}>
        {online ? 'Back online — syncing orders...' : 'You\'re offline · Orders will queue'}
      </span>
    </div>
  )
}
