import { useCallback, useEffect, useState } from 'react'

const LS_KEY = 'pos_test_mode'

export function useTestMode() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(localStorage.getItem(LS_KEY) === 'true')
  }, [])

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev
      if (next) localStorage.setItem(LS_KEY, 'true')
      else localStorage.removeItem(LS_KEY)
      return next
    })
  }, [])

  const disable = useCallback(() => {
    localStorage.removeItem(LS_KEY)
    setEnabled(false)
  }, [])

  return { enabled, toggle, disable }
}

export function isTestMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(LS_KEY) === 'true'
}
