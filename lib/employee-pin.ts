export type VerifiedEmployee = {
  id: string
  name: string
  role: string
  photo_url: string | null
}

// the server reports how long the PIN lock still lasts, in seconds
export function pinWaitText(seconds: unknown): string {
  const s = Math.ceil(Number(seconds))
  if (!Number.isFinite(s) || s <= 0) return 'สักครู่'
  return s < 60 ? `${s} วินาที` : `${Math.ceil(s / 60)} นาที`
}

// A wrong PIN is not an error (empty result). An error is a lock, a server refusal or no network,
// and must not read "wrong PIN": the cashier would retry and make the lock longer.
export function pinErrorText(e: { message: string; code?: string; details?: string }): string {
  if (e.message.includes('PIN_LOCKED')) return `ใส่ PIN ผิดหลายครั้ง รอ ${pinWaitText(e.details)} แล้วลองใหม่`
  if (e.code) return `ตรวจ PIN ไม่ได้ ถ่ายรูปหน้านี้ส่งเจ้าของร้าน (${e.message})`
  return 'ตรวจ PIN ไม่ได้เพราะเน็ตหลุด ต่อเน็ตแล้วลองใหม่'
}

// employee null + problem null = wrong PIN
export type PinCheck = { employee: VerifiedEmployee; problem: null } | { employee: null; problem: string | null }

export async function verifyEmployeePin(shopId: string, pin: string): Promise<PinCheck> {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.rpc('verify_employee_pin', { p_shop_id: shopId, p_pin: pin })
    .abortSignal(AbortSignal.timeout(10000))
  if (error) return { employee: null, problem: pinErrorText(error) }
  const rows = (data ?? []) as VerifiedEmployee[]
  return rows.length ? { employee: rows[0], problem: null } : { employee: null, problem: null }
}

export async function hashEmployeePin(pin: string): Promise<string | null> {
  const { authClient } = await import('./supabase-auth')
  const { data, error } = await authClient.rpc('hash_employee_pin', { p_pin: pin })
  if (error) return null
  return data as string
}
