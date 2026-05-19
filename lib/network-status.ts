'use client'

import { useEffect, useState } from 'react'

// navigator.onLine can incorrectly return false on LAN-only setups (no
// internet but the Next.js server is reachable locally). Verify by pinging
// our own API before declaring offline, with a 1.5 s debounce so transient
// Wi-Fi handoffs don't flash the banner unnecessarily.
async function pingServer(): Promise<boolean> {
  try {
    const res = await fetch('/api/ping', { cache: 'no-store', signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

export function useNetworkStatus() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null

    const handleOnline = () => {
      if (debounce) { clearTimeout(debounce); debounce = null }
      setOnline(true)
    }

    const handleOffline = () => {
      // Wait 1.5 s then verify with a real fetch — avoids false positive from
      // brief handoffs (e.g. laptop waking from sleep on Wi-Fi).
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(async () => {
        setOnline(await pingServer())
      }, 1500)
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial check: if browser already says offline, verify immediately.
    if (!navigator.onLine) void pingServer().then(setOnline)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (debounce) clearTimeout(debounce)
    }
  }, [])

  return online
}
