import { supabase } from './supabase'

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

export async function searchCustomers(q: string, limit = 40): Promise<Customer[]> {
  let query = supabase
    .from('customers')
    .select('*')
    .order('visit_count', { ascending: false })
    .limit(limit)

  if (q.trim()) {
    query = query.or(`phone.ilike.%${q.trim()}%,name.ilike.%${q.trim()}%`)
  }

  const { data } = await query
  return (data ?? []) as Customer[]
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
  return data as Customer | null
}

export async function getCustomerOrders(customerId: string, limit = 10) {
  const { data } = await supabase
    .from('orders')
    .select('id, queue_number, status, total_lak, created_at')
    .eq('customer_id', customerId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getLoyaltyTransactions(customerId: string, limit = 20): Promise<LoyaltyTransaction[]> {
  const { data } = await supabase
    .from('loyalty_transactions')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit)
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
  const { data, error } = await supabase.rpc('crm_upsert_customer', {
    p_phone:       fields.phone,
    p_name:        fields.name,
    p_email:       fields.email       ?? null,
    p_birthday:    fields.birthday    ?? null,
    p_notes:       fields.notes       ?? null,
    p_tags:        fields.tags        ?? [],
    p_nationality: fields.nationality ?? null,
    p_shop_id:     fields.shop_id     ?? null,
  })
  if (error) throw error
  return data as Customer | null
}

export async function updateCustomer(id: string, fields: Partial<Omit<Customer, 'id' | 'created_at'>>): Promise<Customer | null> {
  const { data } = await supabase
    .from('customers')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle()
  return data as Customer | null
}

export async function adjustPoints(
  shopId: string,
  customerId: string,
  points: number,
  type: 'redeem' | 'adjust',
  description?: string,
): Promise<void> {
  const delta = type === 'redeem' ? -Math.abs(points) : points
  const { data: current } = await supabase.from('customers').select('loyalty_points').eq('id', customerId).maybeSingle()
  const newPts = Math.max(0, ((current as Customer | null)?.loyalty_points ?? 0) + delta)
  await supabase.from('customers').update({ loyalty_points: newPts, updated_at: new Date().toISOString() }).eq('id', customerId)
  await supabase.from('loyalty_transactions').insert({
    shop_id: shopId,
    customer_id: customerId,
    order_id: null,
    type,
    points: delta,
    description: description ?? null,
  })
}

export async function redeemPoints(
  shopId: string,
  customer: Customer,
  points: number,
  description?: string,
): Promise<void> {
  const newPts = Math.max(0, customer.loyalty_points - points)
  await supabase.from('customers')
    .update({ loyalty_points: newPts, updated_at: new Date().toISOString() })
    .eq('id', customer.id)
  await supabase.from('loyalty_transactions').insert({
    shop_id: shopId,
    customer_id: customer.id,
    order_id: null,
    type: 'redeem',
    points: -points,
    description: description ?? 'Points redeemed',
  })
}
