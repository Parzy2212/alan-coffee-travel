'use client'

import { useEffect, useState } from 'react'

// Ping our own API to determine real connectivity.
// On a POS running on localhost, navigator.onLine may be false (no internet
// gateway) while the Next.js server itself is perfectly reachable.
async function pingServer(): Promise<boolean> {
  try {
    const res = await fetch('/api/ping', { cache: 'no-store', signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

export function useNetworkStatus() {
  // Start optimistic — avoids flashing "offline" on initial mount before the
  // first ping completes. POS is almost always functional even without internet.
  const [online, setOnline] = useState(true)

  useEffect(() => {
    // Always verify on mount via ping. This handles localhost-only setups where
    // navigator.onLine is false (no internet) but the server is responsive.
    void pingServer().then(setOnline)

    let debounce: ReturnType<typeof setTimeout> | null = null

    const handleOnline = () => {
      if (debounce) { clearTimeout(debounce); debounce = null }
      setOnline(true)
    }

    const handleOffline = () => {
      // Wait 1.5 s then verify with a real fetch — avoids false positive from
      // brief handoffs (e.g. laptop waking from sleep on Wi-Fi).
      // Only declare offline if ping also fails (i.e. server is truly unreachable).
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(async () => {
        setOnline(await pingServer())
      }, 1500)
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (debounce) clearTimeout(debounce)
    }
  }, [])

  return online
}
