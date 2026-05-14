'use client'

import { supabase } from '@/lib/supabase'

const SHOW_ADVANCED_KEY = 'alan_show_advanced_features'

export function isShowAdvancedFeatures(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(SHOW_ADVANCED_KEY) === 'true' } catch { return false }
}

export function setShowAdvancedFeatures(v: boolean): void {
  try { localStorage.setItem(SHOW_ADVANCED_KEY, String(v)) } catch {}
}

// Returns true when the operator has no staff → solo mode
export async function detectSoloMode(): Promise<boolean> {
  if (isShowAdvancedFeatures()) return false
  try {
    const { data, error } = await supabase.rpc('get_all_staff')
    if (error) return true
    return !data || (data as unknown[]).length === 0
  } catch {
    return true
  }
}

// Hook-friendly: call once on mount, returns stable boolean
import { useEffect, useState } from 'react'

export function useSoloMode(): { solo: boolean; loading: boolean; override: () => void } {
  const [solo,    setSolo]    = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isShowAdvancedFeatures()) {
      setSolo(false)
      setLoading(false)
      return
    }
    detectSoloMode().then(s => { setSolo(s); setLoading(false) })
  }, [])

  function override() {
    setShowAdvancedFeatures(true)
    setSolo(false)
  }

  return { solo, loading, override }
}
