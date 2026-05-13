'use client'

import { useEffect, useRef } from 'react'

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const refreshingRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').then(reg => {
      // Listen for a new SW waiting to activate
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available — reload once
            if (!refreshingRef.current) {
              refreshingRef.current = true
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          }
        })
      })
    }).catch(() => {})

    // Reload when SW activates new version
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshingRef.current) window.location.reload()
    })

    // Listen for SW messages (e.g. replay offline queue)
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'REPLAY_OFFLINE_QUEUE') {
        window.dispatchEvent(new Event('alan:replay-offline-queue'))
      }
    })
  }, [])

  return <>{children}</>
}
