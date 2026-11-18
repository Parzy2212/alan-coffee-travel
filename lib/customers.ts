import { supabase } from './supabase'
import { authClient } from './supabase-auth'

export type VipTier = 'regular' | 'silver' | 'gold' | 'platinum'

export type Customer = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  birthday: string | null
  notes: string | null
  nationality: string | null
  language_pref: string
  allergies: string[]
  loyalty_points: number
  visit_count: number
  lifetime_spend_lak: number
  last_visit: string | null
  vip_tier: VipTier
  tags: string[] | null
  shop_id: string | null
  created_at: string
  updated_at: string
}

// What the POS gets back from a phone lookup (pos_find_customer, owner decision 2026-11-18)
export type PosCustomer = Pick<Customer, 'id' | 'name' | 'vip_tier' | 'loyalty_points'>

export type LoyaltyTransaction = {
  id: string
  shop_id: string
  customer_id: string
  order_id: string | null
  type: 'earn' | 'redeem' | 'adjust' | 'expire'
  points: number
  description: string | null
  created_at: string
}

export type LoyaltySettings = {
  shop_id: string
  enabled: boolean
  points_per_lak: number
  vip_silver_threshold: number
  vip_gold_threshold: number
  vip_platinum_threshold: number
  silver_discount_percent: number
  gold_discount_percent: number
  platinum_discount_percent: number
  birthday_discount_percent: number
}

// ── Queries ────────────────────────────────────────────────────────────────────

function customerError(e: { code?: string; message: string }): Error {
  if (e.code === '42501') return new Error('ต้องล็อกอินเป็นเจ้าของหรือผู้จัดการร้าน ลองออกจากระบบแล้วเข้าใหม่')
  if (e.message.includes('CUSTOMER_EXISTS')) return new Error('เบอร์นี้เป็นลูกค้าอยู่แล้ว ค้นหาด้วยเบอร์แทนการเพิ่มใหม่')
  if (e.message.includes('PHONE_TOO_SHORT')) return new Error('พิมพ์เบอร์โทรให้ครบ')
  if (e.message.includes('LOOKUP_PAUSED')) {
    const s = e.message.match(/wait (\d+)/)?.[1]
    return new Error(`ค้นเบอร์ที่ไม่มีในระบบบ่อยเกินไป รออีก ${s ?? '60'} วินาทีแล้วลองใหม่`)
  }
  if (e.message.includes('POINTS_NOT_ENOUGH')) return new Error('คะแนนไม่เพียงพอ')
  if (e.message.includes('POINTS_INVALID')) return new Error('คะแนนต้องเป็นทวีคูณของ 100')
  return new Error(e.message)
}

// Back office (/cafe): owner/manager of the shop only.
export async function listCustomers(q: string, limit = 100): Promise<Customer[]> {
  const { data, error } = await authClient.rpc('crm_list_customers', { p_q: q.trim(), p_limit: limit })
  if (error) throw customerError(error)
  return (data ?? []) as Customer[]
}

// POS: full phone number only, one customer or null.
export async function findCustomerByPhone(phone: string): Promise<PosCustomer | null> {
  const { data, error } = await supabase.rpc('pos_find_customer', { p_phone: phone })
  if (error) throw customerError(error)
  return (data ?? null) as PosCustomer | null
}

export async function getCustomerOrders(customerId: string, limit = 10) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, queue_number, status, total_lak, created_at')
    .eq('customer_id', customerId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getLoyaltyTransactions(customerId: string, limit = 20): Promise<LoyaltyTransaction[]> {
  const { data, error } = await supabase
    .from('loyalty_transactions')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as LoyaltyTransaction[]
}

export async function getLoyaltySettings(shopId: string): Promise<LoyaltySettings | null> {
  const { data } = await supabase
    .from('loyalty_settings')
    .select('*')
    .eq('shop_id', shopId)
    .maybeSingle()
  return data as LoyaltySettings | null
}

export async function upsaveLoyaltySettings(settings: Partial<LoyaltySettings> & { shop_id: string }): Promise<void> {
  await supabase.from('loyalty_settings').upsert(settings, { onConflict: 'shop_id' })
}

export async function createCustomer(fields: {
  phone: string
  name: string
  email?: string
  birthday?: string
  notes?: string
  tags?: string[]
  nationality?: string
  shop_id?: string
}): Promise<Customer | null> {
  // authClient: the owner (signed in) may update an existing phone; at the POS it runs as anon
  const { data, error } = await authClient.rpc('crm_upsert_customer', {
    p_phone:       fields.phone,
    p_name:        fields.name,
    p_email:       fields.email       ?? null,
    p_birthday:    fields.birthday    ?? null,
    p_notes:       fields.notes       ?? null,
    p_tags:        fields.tags        ?? [],
    p_nationality: fields.nationality ?? null,
    p_shop_id:     fields.shop_id     ?? null,
  })
  if (error) throw customerError(error)
  return data as Customer | null
}

export async function updateCustomer(
  id: string,
  fields: Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'birthday' | 'notes'>>,
): Promise<Customer> {
  const { data, error } = await authClient.rpc('crm_update_customer', { p_id: id, p_fields: fields })
  if (error) throw customerError(error)
  return data as Customer
}

// One step in the database: checks the balance, lowers it and records it together. Returns the new balance.
export async function redeemPoints(customerId: string, points: number, description?: string): Promise<number> {
  const { data, error } = await authClient.rpc('crm_redeem_points', {
    p_customer: customerId, p_points: points, p_description: description ?? null,
  })
  if (error) throw customerError(error)
  return data as number
}
