import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Holds the end time of the test window THIS device opened. The window itself lives in the
// database (060, per shop), so another tablet never turns test mode on just because one is open.
const LS_KEY = 'pos_test_mode'

function readUntil(): number {
  try { return Date.parse(localStorage.getItem(LS_KEY) ?? '') || 0 } catch { return 0 }
}
function writeUntil(iso: string | null) {
  try {
    if (iso) localStorage.setItem(LS_KEY, iso)
    else localStorage.removeItem(LS_KEY)
  } catch { /* private mode: test mode then lasts only until the page reloads */ }
}

export function testModeLocallyOn(): boolean {
  return typeof window !== 'undefined' && readUntil() > Date.now()
}

export type TestModeStartResult = { ok: true } | { ok: false; error: string }

export function useTestMode(shopId: string | null) {
  const [until, setUntil] = useState(0)

  const off = useCallback(() => { writeUntil(null); setUntil(0) }, [])

  useEffect(() => {
    if (!shopId) return
    const mine = readUntil()
    if (mine <= Date.now()) { off(); return }
    let alive = true
    supabase.rpc('pos_test_mode_state', { p_shop_id: shopId }).then(({ data, error }) => {
      if (!alive) return
      // can't confirm the window (offline or refused) -> sell as real; a test bill would be refused anyway
      const on = !error && (data as { on?: boolean } | null)?.on === true
      if (on) setUntil(mine); else off()
    })
    return () => { alive = false }
  }, [shopId, off])

  useEffect(() => {
    if (!until) return
    const t = setTimeout(off, Math.max(until - Date.now(), 0))
    return () => clearTimeout(t)
  }, [until, off])

  const start = useCallback(async (managerPin: string): Promise<TestModeStartResult> => {
    if (!shopId) return { ok: false, error: 'ยังไม่รู้ว่าเป็นร้านไหน รอสักครู่' }
    const { data, error } = await supabase.rpc('pos_test_mode_start', { p_shop_id: shopId, p_manager_pin: managerPin })
    if (error) return { ok: false, error: /fetch|network|timeout|abort/i.test(error.message) ? 'ต่ออินเทอร์เน็ตไม่ได้ ลองใหม่' : error.message }
    const r = data as { ok: boolean; until?: string; error?: string; wait?: number }
    if (!r.ok || !r.until) {
      return { ok: false, error: r.error === 'locked' ? `ใส่ PIN ผิดหลายครั้ง รอ ${r.wait ?? 60} วินาที` : 'PIN ผู้จัดการไม่ถูกต้อง' }
    }
    writeUntil(r.until)
    setUntil(Date.parse(r.until))
    return { ok: true }
  }, [shopId])

  const stop = useCallback(async () => {
    off()
    if (!shopId) return
    // Safe to ignore a failure here: this device already stopped sending test bills, and the
    // window only lets a device that asks for a test bill have one; it ends by itself (30 min).
    await supabase.rpc('pos_test_mode_stop', { p_shop_id: shopId })
  }, [shopId, off])

  return { enabled: until > 0, until, start, stop, off }
}
