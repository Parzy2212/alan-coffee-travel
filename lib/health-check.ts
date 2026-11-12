import { supabase } from './supabase'

export type CheckStatus = 'ok' | 'warn' | 'error' | 'loading'

export type HealthCheck = {
  id: string
  section: string
  label: string
  detail: string
  status: CheckStatus
  href?: string
  actionLabel?: string
}

export type HealthReport = {
  checks: HealthCheck[]
  score: number   // 0-100
  ready: boolean
}

export async function runHealthCheck(): Promise<HealthReport> {
  // Parallel queries
  const [
    recipesRes,
    inventoryRes,
    employeesRes,
    settingsRes,
    recipesMissingPriceRes,
  ] = await Promise.all([
    supabase.from('recipes').select('id, price_lak, requires_customization', { count: 'exact' }).eq('is_active', true),
    supabase.from('inventory').select('id, current_qty', { count: 'exact' }).eq('is_active', true),
    supabase.from('employees').select('id', { count: 'exact' }),
    supabase.rpc('get_site_settings'),
    supabase.from('recipes').select('id').eq('is_active', true).eq('price_lak', 0),
  ])

  const recipeCount     = recipesRes.count ?? 0
  const inventoryCount  = inventoryRes.count ?? 0
  const employeeCount   = employeesRes.count ?? 0
  const settings        = (settingsRes.data ?? {}) as Record<string, string>
  const missingPriceCount = (recipesMissingPriceRes.data ?? []).length

  // employees.pin_hash is NOT NULL (005), so every employee has a PIN
  const employeesFailed  = !!employeesRes.error
  const employeesWithPin = employeeCount

  // POS localStorage checks (only works client-side — called from client component)
  let lastPrint: { time?: string; result?: string } | null = null
  let testModeOn  = false
  if (typeof window !== 'undefined') {
    try { lastPrint = JSON.parse(localStorage.getItem('pos_last_print_info') || 'null') } catch { /* corrupt: treat as never printed */ }
    testModeOn  = localStorage.getItem('pos_test_mode') === 'true'
  }

  const shopName = settings.shop_name ?? ''
  const shopAddr = settings.shop_address ?? ''
  const hasTax   = parseFloat(settings.vat_percent ?? '0') > 0 || parseFloat(settings.service_charge_percent ?? '0') > 0

  const checks: HealthCheck[] = [
    // ── DATA ──────────────────────────────────────────────────────────────────
    {
      id: 'shop_name', section: 'ข้อมูลร้าน',
      label: 'ชื่อร้านค้า',
      detail: shopName ? `"${shopName}"` : 'ยังไม่ได้ตั้งชื่อร้าน',
      status: shopName ? 'ok' : 'error',
      href: '/cafe?tab=settings', actionLabel: 'ตั้งค่า',
    },
    {
      id: 'shop_address', section: 'ข้อมูลร้าน',
      label: 'ที่อยู่ร้าน',
      detail: shopAddr ? shopAddr.slice(0, 40) : 'ยังไม่ได้ใส่ที่อยู่',
      status: shopAddr ? 'ok' : 'warn',
      href: '/cafe?tab=settings', actionLabel: 'ตั้งค่า',
    },
    {
      id: 'menu_count', section: 'เมนู',
      label: 'จำนวนเมนู',
      detail: recipeCount >= 5 ? `มี ${recipeCount} รายการ` : recipeCount === 0 ? 'ยังไม่มีเมนู — ใช้ Template เพิ่มได้เร็ว!' : `มี ${recipeCount} รายการ (แนะนำ 5+)`,
      status: recipeCount >= 5 ? 'ok' : recipeCount === 0 ? 'error' : 'warn',
      href: recipeCount === 0 ? '/cafe/templates' : '/cafe?tab=menu',
      actionLabel: recipeCount === 0 ? 'ใช้ Template' : 'จัดการเมนู',
    },
    {
      id: 'menu_price', section: 'เมนู',
      label: 'ทุกเมนูมีราคา',
      detail: missingPriceCount === 0 ? 'ครบทุกรายการ' : `${missingPriceCount} รายการยังไม่มีราคา`,
      status: missingPriceCount === 0 ? 'ok' : 'error',
      href: '/cafe?tab=menu', actionLabel: 'แก้ไข',
    },
    {
      id: 'inventory', section: 'สต็อกวัตถุดิบ',
      label: 'สต็อกวัตถุดิบ',
      detail: inventoryCount >= 1 ? `มี ${inventoryCount} รายการ` : 'ยังไม่มีสต็อก',
      status: inventoryCount >= 1 ? 'ok' : 'warn',
      href: '/cafe?tab=stock', actionLabel: 'เพิ่มสต็อก',
    },

    // ── STAFF ──────────────────────────────────────────────────────────────────
    {
      id: 'staff_count', section: 'พนักงาน',
      label: 'มีพนักงานในรายชื่อ',
      detail: employeesFailed ? 'ตรวจไม่ได้ (โหลดข้อมูลพนักงานไม่สำเร็จ)' : employeeCount >= 1 ? `มี ${employeeCount} คน` : 'ยังไม่มีพนักงาน',
      status: employeesFailed ? 'warn' : employeeCount >= 1 ? 'ok' : 'error',
      href: '/shop/team/employees', actionLabel: 'เพิ่มพนักงาน',
    },
    {
      id: 'staff_pin', section: 'พนักงาน',
      label: 'พนักงานมี PIN ครบ',
      detail: employeesFailed ? 'ตรวจไม่ได้ (โหลดข้อมูลพนักงานไม่สำเร็จ)' : employeeCount === 0 ? 'ยังไม่มีพนักงาน' : employeesWithPin === employeeCount ? `${employeeCount} คนมี PIN` : `${employeeCount - employeesWithPin} คนยังไม่มี PIN`,
      status: employeesFailed ? 'warn' : employeeCount === 0 ? 'warn' : employeesWithPin === employeeCount ? 'ok' : 'warn',
      href: '/shop/team/employees', actionLabel: 'ตั้ง PIN',
    },

    // ── POS ────────────────────────────────────────────────────────────────────
    {
      id: 'printer', section: 'เครื่องพิมพ์',
      label: 'พิมพ์ใบเสร็จได้ (เครื่องนี้)',
      detail: lastPrint?.result === 'success' && lastPrint.time
        ? `พิมพ์ล่าสุด ${new Date(lastPrint.time).toLocaleString('th-TH')}`
        : 'ยังไม่เคยพิมพ์จากเครื่องนี้ — ขายบิลทดสอบ 1 ใบที่หน้าขาย',
      status: lastPrint?.result === 'success' ? 'ok' : 'warn',
      href: '/pos', actionLabel: 'ไปหน้าขาย',
    },

    // ── PAYMENTS ───────────────────────────────────────────────────────────────
    {
      id: 'tax', section: 'การชำระเงิน',
      label: 'ภาษี / Service Charge',
      detail: hasTax ? 'ตั้งค่าแล้ว' : 'ยังไม่ได้ตั้ง (0% = ไม่มี VAT)',
      status: 'ok', // not mandatory — 0% is valid
    },
    // ── SYSTEM ─────────────────────────────────────────────────────────────────
    {
      id: 'test_mode', section: 'ระบบ',
      label: 'โหมดทดสอบ',
      detail: testModeOn ? 'เปิดอยู่ — ปิดก่อนเปิดร้านจริง!' : 'ปิดอยู่ (พร้อม)',
      status: testModeOn ? 'error' : 'ok',
      href: testModeOn ? '/pos' : undefined, actionLabel: testModeOn ? 'ปิดโหมดทดสอบ' : undefined,
    },
  ]

  // Score: each ok = full weight, warn = half, error = 0
  const weights: Record<CheckStatus, number> = { ok: 1, warn: 0.5, error: 0, loading: 0 }
  const mandatory = ['shop_name', 'menu_count', 'menu_price', 'staff_count', 'test_mode']
  const totalWeight = checks.reduce((s, c) => s + (mandatory.includes(c.id) ? 2 : 1), 0)
  const earnedWeight = checks.reduce((s, c) => s + weights[c.status] * (mandatory.includes(c.id) ? 2 : 1), 0)
  const score = Math.round((earnedWeight / totalWeight) * 100)
  const ready = score >= 90

  return { checks, score, ready }
}
