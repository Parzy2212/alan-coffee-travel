'use client'

import { useEffect, useState } from 'react'
import { useNetworkStatus } from '@/lib/network-status'

const DISMISS_KEY = 'pos_offline_banner_dismissed'

export function OfflineIndicator() {
  const online  = useNetworkStatus()
  const [flash,      setFlash]      = useState(false)
  const [prevOnline, setPrevOnline] = useState(online)
  const [dismissed,  setDismissed]  = useState(false)

  // Read sessionStorage dismiss flag on mount (client-only)
  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1') } catch {}
  }, [])

  useEffect(() => {
    if (!prevOnline && online) {
      setFlash(true)
      // Do NOT reset dismissed — user's explicit dismiss stays in effect
      const t = setTimeout(() => setFlash(false), 3000)
      setPrevOnline(online)
      return () => clearTimeout(t)
    }
    setPrevOnline(online)
  }, [online, prevOnline])

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch {}
    setDismissed(true)
  }

  if ((online && !flash) || dismissed) return null

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
      <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: online ? '#000' : 'rgba(255,255,255,0.8)' }}>
        {online ? 'Back online — syncing orders...' : 'You\'re offline · Orders will queue'}
      </span>
      {!online && (
        <button
          onClick={dismiss}
          title="Dismiss for this session"
          style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.6)', fontSize: 20, cursor: 'pointer',
            lineHeight: 1, padding: 0, flexShrink: 0,
            width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6,
          }}
        >×</button>
      )}
    </div>
  )
}
