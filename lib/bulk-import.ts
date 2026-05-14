import { authClient } from './supabase-auth'

export type ImportRow = {
  product_name: string
  product_name_lo: string
  price_lak: string
  category: string
  _error?: string
}

export type InventoryRow = {
  name: string
  name_lo: string
  unit: string
  current_qty: string
  cost_per_unit: string
  _error?: string
}

export function parseCSVtoMenuRows(csv: string): ImportRow[] {
  const lines = csv.trim().split('\n').filter(l => l.trim())
  const rows: ImportRow[] = []
  for (const line of lines) {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    if (cols.length < 2) continue
    rows.push({
      product_name:    cols[0] ?? '',
      price_lak:       cols[1] ?? '',
      product_name_lo: cols[2] ?? '',
      category:        cols[3] ?? '',
    })
  }
  return rows
}

export function parseCSVtoInventoryRows(csv: string): InventoryRow[] {
  const lines = csv.trim().split('\n').filter(l => l.trim())
  const rows: InventoryRow[] = []
  for (const line of lines) {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    if (cols.length < 2) continue
    rows.push({
      name:          cols[0] ?? '',
      name_lo:       cols[1] ?? '',
      unit:          cols[2] ?? 'g',
      current_qty:   cols[3] ?? '0',
      cost_per_unit: cols[4] ?? '0',
    })
  }
  return rows
}

export function validateMenuRows(rows: ImportRow[]): ImportRow[] {
  return rows.map(row => {
    const errors: string[] = []
    if (!row.product_name.trim())  errors.push('ต้องมีชื่อ')
    const price = parseInt(row.price_lak, 10)
    if (isNaN(price) || price < 0)  errors.push('ราคาต้องเป็นตัวเลข')
    return { ...row, _error: errors.length ? errors.join(', ') : undefined }
  })
}

export function validateInventoryRows(rows: InventoryRow[]): InventoryRow[] {
  return rows.map(row => {
    const errors: string[] = []
    if (!row.name.trim()) errors.push('ต้องมีชื่อ')
    const qty = parseFloat(row.current_qty)
    if (isNaN(qty)) errors.push('จำนวนต้องเป็นตัวเลข')
    return { ...row, _error: errors.length ? errors.join(', ') : undefined }
  })
}

// ── Resolve shop_id for current user ─────────────────────────────────────────
async function getShopId(): Promise<string> {
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error('ไม่พบผู้ใช้ — กรุณาล็อกอินใหม่')

  const { data: su, error } = await authClient
    .from('shop_users')
    .select('shop_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw new Error(`ดึง shop_id ไม่ได้: ${error.message}`)
  if (!su?.shop_id) throw new Error('ไม่พบร้านค้าที่เชื่อมกับบัญชีนี้')
  return su.shop_id
}

// ── Category lookup cache ──────────────────────────────────────────────────────
let _catCache: { id: string; name: string }[] | null = null
async function getCategories() {
  if (_catCache) return _catCache
  const { data } = await authClient.from('categories').select('id, name').eq('is_active', true)
  _catCache = (data ?? []) as { id: string; name: string }[]
  return _catCache
}

function matchCategory(cats: { id: string; name: string }[], hint: string): string | null {
  if (!hint.trim()) return null
  const lower = hint.toLowerCase()
  const match = cats.find(c => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()))
  return match?.id ?? null
}

export async function bulkInsertMenuItems(rows: ImportRow[]): Promise<{ created: number; errors: string[] }> {
  const valid = rows.filter(r => !r._error && r.product_name.trim())
  if (valid.length === 0) return { created: 0, errors: ['ไม่มีรายการที่ถูกต้อง'] }

  const [shopId, cats] = await Promise.all([getShopId(), getCategories()])
  const errs: string[] = []
  let created = 0

  for (const row of valid) {
    const categoryId = matchCategory(cats, row.category)
    const { error } = await authClient.from('recipes').insert({
      product_name:    row.product_name.trim(),
      product_name_lo: row.product_name_lo.trim() || null,
      price_lak:       parseInt(row.price_lak, 10) || 0,
      category_id:     categoryId,
      is_active:       true,
      shop_id:         shopId,
    })
    if (error) errs.push(`${row.product_name}: ${error.message}`)
    else created++
  }

  return { created, errors: errs }
}

export async function bulkInsertInventory(rows: InventoryRow[]): Promise<{ created: number; errors: string[] }> {
  const valid = rows.filter(r => !r._error && r.name.trim())
  if (valid.length === 0) return { created: 0, errors: ['ไม่มีรายการที่ถูกต้อง'] }

  const shopId = await getShopId()
  const errs: string[] = []
  let created = 0

  for (const row of valid) {
    const { error } = await authClient.from('inventory').insert({
      name:          row.name.trim(),
      name_lo:       row.name_lo.trim() || null,
      unit:          row.unit.trim() || 'g',
      current_qty:   parseFloat(row.current_qty) || 0,
      cost_per_unit: parseFloat(row.cost_per_unit) || 0,
      is_active:     true,
      shop_id:       shopId,
    })
    if (error) errs.push(`${row.name}: ${error.message}`)
    else created++
  }

  return { created, errors: errs }
}
