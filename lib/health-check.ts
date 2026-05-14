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
    loyaltyRes,
    settingsRes,
    recipesMissingPriceRes,
  ] = await Promise.all([
    supabase.from('recipes').select('id, price_lak, requires_customization', { count: 'exact' }).eq('is_active', true),
    supabase.from('inventory').select('id, current_qty', { count: 'exact' }).eq('is_active', true),
    supabase.from('employees').select('id, pin_hash', { count: 'exact' }),
    supabase.from('loyalty_settings').select('enabled').maybeSingle(),
    supabase.rpc('get_site_settings'),
    supabase.from('recipes').select('id').eq('is_active', true).eq('price_lak', 0),
  ])

  const recipeCount     = recipesRes.count ?? 0
  const inventoryCount  = inventoryRes.count ?? 0
  const employeeCount   = employeesRes.count ?? 0
  const loyaltyEnabled  = loyaltyRes.data?.enabled ?? false
  const settings        = (settingsRes.data ?? {}) as Record<string, string>
  const missingPriceCount = (recipesMissingPriceRes.data ?? []).length

  const employeesWithPin = (employeesRes.data ?? []).filter((e: {pin_hash: string | null}) => e.pin_hash).length

  // POS localStorage checks (only works client-side — called from client component)
  let printerName = ''
  let testModeOn  = false
  if (typeof window !== 'undefined') {
    printerName = localStorage.getItem('alan_printer_name') ?? ''
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
      href: '/shop/settings', actionLabel: 'ตั้งค่า',
    },
    {
      id: 'shop_address', section: 'ข้อมูลร้าน',
      label: 'ที่อยู่ร้าน',
      detail: shopAddr ? shopAddr.slice(0, 40) : 'ยังไม่ได้ใส่ที่อยู่',
      status: shopAddr ? 'ok' : 'warn',
      href: '/shop/settings', actionLabel: 'ตั้งค่า',
    },
    {
      id: 'menu_count', section: 'เมนู',
      label: 'จำนวนเมนู',
      detail: recipeCount >= 5 ? `มี ${recipeCount} รายการ` : recipeCount === 0 ? 'ยังไม่มีเมนู — ใช้ Template เพิ่มได้เร็ว!' : `มี ${recipeCount} รายการ (แนะนำ 5+)`,
      status: recipeCount >= 5 ? 'ok' : recipeCount === 0 ? 'error' : 'warn',
      href: recipeCount === 0 ? '/cafe/templates' : '/cafe',
      actionLabel: recipeCount === 0 ? 'ใช้ Template' : 'จัดการเมนู',
    },
    {
      id: 'menu_price', section: 'เมนู',
      label: 'ทุกเมนูมีราคา',
      detail: missingPriceCount === 0 ? 'ครบทุกรายการ' : `${missingPriceCount} รายการยังไม่มีราคา`,
      status: missingPriceCount === 0 ? 'ok' : 'error',
      href: '/cafe', actionLabel: 'แก้ไข',
    },
    {
      id: 'inventory', section: 'สต็อกวัตถุดิบ',
      label: 'สต็อกวัตถุดิบ',
      detail: inventoryCount >= 1 ? `มี ${inventoryCount} รายการ` : 'ยังไม่มีสต็อก',
      status: inventoryCount >= 1 ? 'ok' : 'warn',
      href: '/cafe', actionLabel: 'เพิ่มสต็อก',
    },

    // ── STAFF ──────────────────────────────────────────────────────────────────
    {
      id: 'staff_count', section: 'พนักงาน',
      label: 'มีพนักงาน POS',
      detail: employeeCount >= 1 ? `มี ${employeeCount} คน` : 'ยังไม่มีพนักงาน',
      status: employeeCount >= 1 ? 'ok' : 'error',
      href: '/shop/team/employees', actionLabel: 'เพิ่มพนักงาน',
    },
    {
      id: 'staff_pin', section: 'พนักงาน',
      label: 'พนักงานมี PIN ครบ',
      detail: employeeCount === 0 ? 'ยังไม่มีพนักงาน' : employeesWithPin === employeeCount ? `${employeeCount} คนมี PIN` : `${employeeCount - employeesWithPin} คนยังไม่มี PIN`,
      status: employeeCount === 0 ? 'warn' : employeesWithPin === employeeCount ? 'ok' : 'warn',
      href: '/shop/team/employees', actionLabel: 'ตั้ง PIN',
    },

    // ── POS ────────────────────────────────────────────────────────────────────
    {
      id: 'printer_name', section: 'เครื่องพิมพ์',
      label: 'ชื่อเครื่องพิมพ์',
      detail: printerName ? `"${printerName}"` : 'ยังไม่ได้ตั้งค่า',
      status: printerName ? 'ok' : 'warn',
      href: '/shop/settings/printer', actionLabel: 'ตั้งค่า',
    },
    {
      id: 'print_server', section: 'เครื่องพิมพ์',
      label: 'Print Server',
      detail: 'ตรวจสอบในหน้า POS ว่าสัญญาณเขียว',
      status: 'warn',
      href: '/pos', actionLabel: 'ไป POS',
    },

    // ── PAYMENTS ───────────────────────────────────────────────────────────────
    {
      id: 'tax', section: 'การชำระเงิน',
      label: 'ภาษี / Service Charge',
      detail: hasTax ? 'ตั้งค่าแล้ว' : 'ยังไม่ได้ตั้ง (0% = ไม่มี VAT)',
      status: 'ok', // not mandatory — 0% is valid
    },
    {
      id: 'loyalty', section: 'ลูกค้า',
      label: 'ระบบสะสมแต้ม',
      detail: loyaltyEnabled ? 'เปิดใช้งาน' : 'ปิดอยู่',
      status: loyaltyEnabled ? 'ok' : 'warn',
      href: '/shop/settings/loyalty', actionLabel: 'ตั้งค่า',
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
