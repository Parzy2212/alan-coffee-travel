export type VerifiedEmployee = {
  id: string
  name: string
  role: string
  photo_url: string | null
}

export async function verifyEmployeePin(shopId: string, pin: string): Promise<VerifiedEmployee | null> {
  const { supabase } = await import('./supabase')
  const { data, error } = await supabase.rpc('verify_employee_pin', { p_shop_id: shopId, p_pin: pin })
  if (error || !data || (data as VerifiedEmployee[]).length === 0) return null
  return (data as VerifiedEmployee[])[0]
}

export async function hashEmployeePin(pin: string): Promise<string | null> {
  const { authClient } = await import('./supabase-auth')
  const { data, error } = await authClient.rpc('hash_employee_pin', { p_pin: pin })
  if (error) return null
  return data as string
}
