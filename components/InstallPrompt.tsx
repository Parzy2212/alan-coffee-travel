'use client'

import { useEffect, useState } from 'react'

const THROTTLE_KEY = 'alan_install_prompt_dismissed'
const THROTTLE_MS  = 7 * 24 * 60 * 60 * 1000 // 1 week

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(THROTTLE_KEY)
    if (dismissed && Date.now() - parseInt(dismissed) < THROTTLE_MS) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!visible || !deferredPrompt) return null

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') localStorage.removeItem(THROTTLE_KEY)
    setVisible(false)
  }

  function handleDismiss() {
    localStorage.setItem(THROTTLE_KEY, String(Date.now()))
    setVisible(false)
  }

  return (
    <div style={{
      position: 'fixed', top: 84, left: '50%', transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)', maxWidth: 420,
      padding: '16px 20px', borderRadius: 16,
      backgroundColor: '#1a1a1a', border: '1px solid rgba(201,168,76,0.4)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', gap: 14,
      zIndex: 45, animation: 'slideDown 0.3s ease',
    }}>
      <img src="/icons/icon-72x72.png" alt="" width={44} height={44} style={{ borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Install Alan Cafe OS</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Add to home screen for offline access</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={handleDismiss} style={{
          padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
          backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer',
        }}>Later</button>
        <button onClick={() => void handleInstall()} style={{
          padding: '6px 14px', borderRadius: 8, border: 'none',
          backgroundColor: '#c9a84c', color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>Install</button>
      </div>
    </div>
  )
}
