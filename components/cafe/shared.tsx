'use client'

import React from 'react'
import { PieChart, Pie, Cell } from 'recharts'

// ─── Constants ────────────────────────────────────────────────────────────────

export const SUPABASE_URL = 'https://fmsdfcsqdpdlppucuptn.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtc2RmY3NxZHBkbHBwdWN1cHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTgxNDksImV4cCI6MjA4NzU5NDE0OX0.LQ8kzdNml5HK4m12Mj4fPm2FL8MXc17vDAfrKl6sRS4'
export const AI_ANALYST_URL = `${SUPABASE_URL}/functions/v1/ai-analyst`

export const GOLD    = '#c9a84c'
export const GOLD_DIM = '#c9a84c88'
export const BLACK   = '#0a0a0a'
export const DARK    = '#111'
export const CARD    = '#161616'
export const CARD2   = '#1a1a1a'
export const BORDER  = 'rgba(201,168,76,0.15)'
export const RED     = '#ff4d4d'
export const GREEN   = '#4cba7f'
export const ORANGE  = '#ff9933'

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type Tab = 'dashboard' | 'menu' | 'categories' | 'stock' | 'settings' | 'staff' | 'customers' | 'purchase' | 'finance' | 'ai' | 'audit' | 'recipe-cost'

export type ExtDashStats = {
  today_sales:     number
  today_orders:    number
  today_items:     number
  today_profit:    number
  yesterday_sales: number
}

export type HourlySale = { hour: number; sales: number; order_count: number }

export type MenuPerf = {
  recipe_id:    string
  product_name: string
  total_qty:    number
  total_sales:  number
  total_cost:   number
  gross_profit: number
  margin_pct:   number
}

export type CustomStat = { category: string; label: string; cnt: number }

export type QueuePerf = { peak_hour: number; orders_per_hour: number; today_orders: number }

export type StockVal = {
  total_value: number
  low_count:   number
  top_used:    { name: string; used_qty: number; unit: string }[]
}

export type Category = {
  id: string; name: string; name_th: string | null; name_lo: string | null; parent_id: string | null
}

export type CategoryJoin = { id: string; name: string; name_th: string | null } | null

export type Recipe = {
  id: string; product_name: string; product_name_th: string | null; product_name_lo: string | null
  price_lak: number; is_active: boolean; category: string | null; category_id: string | null
  categories: CategoryJoin | CategoryJoin[]
}

export type InventoryItem = {
  id: string; name: string; name_th: string | null; name_lo: string | null
  current_qty: number; unit: string; reorder_point: number | null
  supplier: string | null; supplier_phone: string | null
}

export type PurchaseLog = {
  id: string; qty_purchased: number; unit_price_lak: number; total_lak: number
  supplier: string | null; created_at: string
}

export type SiteSettings = {
  shop_name: string; shop_name_th: string; shop_name_lo: string; ticker_text: string
}

export type Customer = {
  id: string; name: string | null; phone: string | null; nationality: string | null
  language_pref: string; allergies: string[]; loyalty_points: number
  visit_count: number; lifetime_spend_lak: number; email: string | null
  created_at: string; updated_at: string
}

export type PurchaseEntry = {
  id: string; inventory_name: string | null; unit: string | null; staff_name: string | null
  qty_purchased: number; unit_price_lak: number; market_price_lak: number | null
  supplier: string | null; status: string; flag_reason: string | null
  receipt_url: string | null; weigh_image_url: string | null; created_at: string
  inventory_id?: string; staff_id?: string
}

export type AuditLog = {
  id: string; created_at: string; action: string; table_name: string
  record_id: string | null; payload: Record<string, unknown>
}

export type LeaveRequest = {
  id: string; staff_id: string; leave_type: string
  start_date: string; end_date: string; reason: string | null
  status: string; created_at: string
  staff?: { name: string | null } | null
}

export type CashflowRow = {
  log_date: string; shift: string; system_sales: number; actual_cash: number
  variance_lak: number; opening_cash?: number; staff_id?: string
}

export type InventorySimple = { id: string; name: string; unit: string }

export type FullSettings = {
  shop_name: string; shop_name_th: string; shop_name_lo: string
  shop_address: string; shop_phone: string; shop_email: string
  shop_facebook: string; shop_instagram: string; shop_line: string
  open_time: string; close_time: string; open_days: string
  currency_primary: string; currency_secondary: string
  vat_percent: string; service_charge_percent: string; receipt_auto_print: string
  ticker_text: string; queue_ticker_text: string; queue_display_mode: string
  low_stock_alert_line_token: string; daily_report_line_token: string
  low_stock_alert_enabled: string; daily_report_enabled: string
  ai_analyst_enabled: string
  payment_banks: string
  qr_payment_number: string
  qr_payment_name: string
  shop_lat: string
  shop_lng: string
  // ─── Cost Management ──────────────────────────────────────────────────────
  cost_cup_lid: string       // ₭ per cup (default 2500)
  cost_straw: string         // ₭ per straw (default 210)
  cost_bag: string           // ₭ per takeaway bag (default 500)
  cost_bag_pct: string       // % of customers who take a bag (default 30)
  cost_other_pkg: string     // ₭ other packaging per cup (default 0)
  cost_waste_pct: string     // waste & loss factor % (default 15)
  cost_ice_bag_price: string // ₭ per 30 kg bag of ice (default 20000)
  cost_ice_melt_pct: string  // % that melts before use (default 30)
  cost_ice_per_cup_g: string // grams of ice per cold cup (default 175)
  overhead_rent: string              // ₭/month
  overhead_electric: string          // ₭/month
  overhead_water: string             // ₭/month
  overhead_internet: string          // ₭/month
  overhead_salary: string            // ₭/month (sum of staff salaries)
  overhead_consumables_json: string  // JSON: { id, name, amount }[]
  overhead_other_json: string        // JSON: { id, name, amount }[]
  target_cups_month: string          // target cups/month for overhead-per-cup calc (default 500)
}

export type RecipeEdit = {
  product_name: string; product_name_th: string; product_name_lo: string
  price_str: string; category_id: string
}

export type StockDetail = {
  id: string; name: string; name_th: string | null; name_lo: string | null; unit: string
  current_qty: number; reorder_point: number | null; max_quantity: number | null
  cost_per_unit: number | null; stock_value: number
  storage_location: string | null; expiry_days: number | null; expiry_days_remaining: number | null
  supplier: string | null; supplier_phone: string | null
  secondary_supplier: string | null; secondary_supplier_phone: string | null
  notes: string | null; is_active: boolean
  daily_usage: number; days_until_empty: number | null
  last_price: number | null; last_purchased_at: string | null
}

export type InventoryForm = {
  name: string; name_th: string; name_lo: string; unit: string
  current_qty: string; reorder_point: string; max_quantity: string
  cost_per_unit: string; storage_location: string; expiry_days: string
  supplier: string; supplier_phone: string
  secondary_supplier: string; secondary_supplier_phone: string
  notes: string
}

export type UsageStat = { day: string; used_qty: number; sales_lak: number }

export type AddStockForm = { qty: string; cost: string; supplier: string; date: string }

export type RecipeIngredient = {
  id: string; inventory_id: string; name: string; name_th: string | null
  qty_required: number; unit: string
}

export type RecipeFull = {
  id: string; product_name: string; product_name_th: string | null; product_name_lo: string | null
  price_lak: number; is_active: boolean; is_seasonal: boolean; seasonal_note: string | null
  is_archived: boolean
  category: string | null; category_id: string | null
  description_en: string | null; description_th: string | null; description_lo: string | null
  preparation_time: number | null; calories: number | null
  allergens: string[]; cost_per_cup_lak: number | null; image_url: string | null
  total_qty_30d: number; total_sales_30d: number; calc_cost: number; margin_pct: number
  ingredients: RecipeIngredient[]
}

export type RecipeFullEdit = {
  product_name: string; product_name_th: string; product_name_lo: string
  description_en: string; description_th: string; description_lo: string
  price_str: string; cost_str: string; prep_str: string; cal_str: string
  allergens: string[]; category_id: string
  is_seasonal: boolean; seasonal_note: string; image_url: string
}

export type DaySale = { day: string; qty: number; sales: number }

export type CatNode = {
  id: string; name: string; name_th: string | null; name_lo: string | null
  description_en: string | null; description_th: string | null; description_lo: string | null
  icon: string | null; color: string | null
  parent_id: string | null; sort_order: number; is_active: boolean; menu_count: number
  children?: CatNode[]
}

export type CatEdit = {
  name: string; name_th: string; name_lo: string
  icon: string; color: string; parent_id: string; sort_order: string
}

export type PaymentBank = {
  id: string
  name: string
  account_number: string
  account_name: string
  color: string
}

export type StaffMember = {
  id: string; name: string; name_th: string | null; name_lo: string | null
  phone: string | null; avatar_url: string | null
  salary: number | null; salary_type: string | null
  start_date: string | null; is_active: boolean; is_verified: boolean
  scheduled_start_time: string | null; rating: number | null
  skills: string[] | null; notes: string | null
}

export type StaffToday = {
  id: string; name: string; name_th: string | null; avatar_url: string | null
  clock_in: string | null; clock_out: string | null
  status: string; late_minutes: number | null; scheduled_start: string | null
}

export type StaffAnalytics = {
  id: string; name: string; name_th: string | null; avatar_url: string | null
  days_present: number; days_late: number; total_hours: number
  punctuality_pct: number; orders_served: number
}

export type AttendanceRow = {
  staff_id: string; staff_name: string; report_date: string
  clock_in: string | null; clock_out: string | null
  status: string; late_minutes: number | null
}

export type StaffForm = {
  name: string; name_th: string; name_lo: string
  phone: string; salary: string; salary_type: string
  role: string
  start_date: string; scheduled_start_time: string
  skills: string; notes: string; pin: string
}

// ─── Constants (non-color) ───────────────────────────────────────────────────

export const STORAGE_OPTIONS = [
  { value: 'fridge',  label: '🧊 ตู้เย็น' },
  { value: 'freezer', label: '❄️ Freezer' },
  { value: 'shelf',   label: '📦 ชั้นวาง' },
  { value: 'counter', label: '🍳 Counter' },
]

export const ALLERGENS = ['นม', 'กลูเตน', 'ถั่ว', 'ไข่', 'ซีฟู้ด']

export const DEFAULT_SETTINGS: FullSettings = {
  shop_name: '', shop_name_th: '', shop_name_lo: '',
  shop_address: '', shop_phone: '', shop_email: '',
  shop_facebook: '', shop_instagram: '', shop_line: '',
  open_time: '07:00', close_time: '22:00', open_days: '["mon","tue","wed","thu","fri","sat","sun"]',
  currency_primary: 'LAK', currency_secondary: 'THB',
  vat_percent: '0', service_charge_percent: '0', receipt_auto_print: 'false',
  ticker_text: '', queue_ticker_text: '', queue_display_mode: 'standard',
  low_stock_alert_line_token: '', daily_report_line_token: '',
  low_stock_alert_enabled: 'false', daily_report_enabled: 'false',
  ai_analyst_enabled: 'false',
  payment_banks: '[]',
  qr_payment_number: '',
  qr_payment_name: '',
  shop_lat: '',
  shop_lng: '',
  // Cost Management defaults
  cost_cup_lid: '2500', cost_straw: '210', cost_bag: '500', cost_bag_pct: '30',
  cost_other_pkg: '0', cost_waste_pct: '15',
  cost_ice_bag_price: '20000', cost_ice_melt_pct: '30', cost_ice_per_cup_g: '175',
  overhead_rent: '0', overhead_electric: '0', overhead_water: '0',
  overhead_internet: '0', overhead_salary: '0',
  overhead_consumables_json: '', overhead_other_json: '',
  target_cups_month: '500',
}

export const DAYS_OF_WEEK = [
  { key: 'mon', label: 'จ' }, { key: 'tue', label: 'อ' }, { key: 'wed', label: 'พ' },
  { key: 'thu', label: 'พฤ' }, { key: 'fri', label: 'ศ' }, { key: 'sat', label: 'ส' },
  { key: 'sun', label: 'อา' },
]

export const ICON_OPTIONS = [
  '☕','🍵','🧋','🥤','🍹','🍰','🧁','🍫','🥐','🥪',
  '🌿','🍋','🍓','🫐','🍊','🌸','⭐','🔥','✨','❄️',
  '🎯','💫','🌙','🌺','🍃','🧃','🫖','🥛','🍮','🎂',
]

// ─── Helper functions ─────────────────────────────────────────────────────────

export function fmtLAK(n: number): string {
  return new Intl.NumberFormat('lo-LA').format(Math.round(n)) + ' ₭'
}

export function fmtK(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return (n / 1000).toFixed(0) + 'k'
  return String(Math.round(n))
}

export function fmtHour(h: number): string {
  return String(h).padStart(2, '0') + 'h'
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Asia/Vientiane',
  })
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function todayVientiane(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Vientiane' })
}

export function getCategoryData(c: CategoryJoin | CategoryJoin[]): CategoryJoin {
  if (Array.isArray(c)) return c[0] ?? null
  return c
}

export function currentHourVientiane(): number {
  return parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Vientiane' }), 10)
}

export function storageIcon(loc: string | null): string {
  if (loc === 'fridge')  return '🧊'
  if (loc === 'freezer') return '❄️'
  if (loc === 'counter') return '🍳'
  return '📦'
}

export function emptyInventoryForm(): InventoryForm {
  return {
    name: '', name_th: '', name_lo: '', unit: 'g',
    current_qty: '0', reorder_point: '', max_quantity: '',
    cost_per_unit: '', storage_location: 'shelf', expiry_days: '',
    supplier: '', supplier_phone: '',
    secondary_supplier: '', secondary_supplier_phone: '',
    notes: '',
  }
}

export function emptyStaffForm(): StaffForm {
  return {
    name: '', name_th: '', name_lo: '', phone: '',
    salary: '', salary_type: 'monthly', role: 'barista',
    start_date: new Date().toISOString().slice(0, 10),
    scheduled_start_time: '08:00',
    skills: '', notes: '', pin: '',
  }
}

export function emptyEditCat(): CatEdit {
  return { name: '', name_th: '', name_lo: '', icon: '', color: '#c9a84c', parent_id: '', sort_order: '0' }
}

export function toEdit(r: RecipeFull): RecipeFullEdit {
  return {
    product_name: r.product_name, product_name_th: r.product_name_th ?? '',
    product_name_lo: r.product_name_lo ?? '',
    description_en: r.description_en ?? '', description_th: r.description_th ?? '',
    description_lo: r.description_lo ?? '',
    price_str: String(r.price_lak), cost_str: String(r.cost_per_cup_lak ?? ''),
    prep_str: String(r.preparation_time ?? ''), cal_str: String(r.calories ?? ''),
    allergens: r.allergens ?? [], category_id: r.category_id ?? '',
    is_seasonal: r.is_seasonal, seasonal_note: r.seasonal_note ?? '', image_url: r.image_url ?? '',
  }
}

export function emptyEdit(): RecipeFullEdit {
  return {
    product_name: '', product_name_th: '', product_name_lo: '',
    description_en: '', description_th: '', description_lo: '',
    price_str: '', cost_str: '', prep_str: '', cal_str: '',
    allergens: [], category_id: '', is_seasonal: false, seasonal_note: '', image_url: '',
  }
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

export const inputStyle: React.CSSProperties = {
  backgroundColor: '#1a1a1a',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 7, color: '#fff', fontSize: 14,
  padding: '8px 12px', outline: 'none', boxSizing: 'border-box', width: '100%',
}

export const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.38)',
  letterSpacing: '1px', marginBottom: 5, textTransform: 'uppercase',
}

export function btnStyle(bg: string): React.CSSProperties {
  return {
    backgroundColor: bg, border: 'none', borderRadius: 8,
    color: bg === GOLD ? BLACK : '#fff',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '8px 16px', flexShrink: 0,
  }
}

export function btnStyleSm(bg: string, color?: string): React.CSSProperties {
  return { ...btnStyle(bg), padding: '4px 10px', fontSize: 12, color: color ?? (bg === GOLD ? BLACK : '#fff') }
}

// ─── Small Components ─────────────────────────────────────────────────────────

export function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, lineHeight: 1,
      padding: '3px 9px', borderRadius: 20,
      backgroundColor: bg, color, whiteSpace: 'nowrap', flexShrink: 0,
    }}>{label}</span>
  )
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null
  const isErr = msg.startsWith('เกิดข้อผิดพลาด')
  return (
    <div style={{
      marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13,
      backgroundColor: isErr ? '#2a0a0a' : '#0d1f17',
      border: `1px solid ${isErr ? RED + '44' : GREEN + '44'}`,
      color: isErr ? RED : GREEN,
    }}>{msg}</div>
  )
}

export function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
      กำลังโหลด...
    </div>
  )
}

export function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 22px', borderBottom: `1px solid ${BORDER}`,
      }}>
        <span style={{ fontSize: 12, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: '20px 22px' }}>{children}</div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>
}

export function KPICard({
  label, value, change, sub, accent, warn,
}: {
  label: string; value: string; change?: number; sub?: string; accent?: boolean; warn?: boolean
}) {
  const hasPct    = change !== undefined
  const pctColor  = hasPct ? (change >= 0 ? GREEN : RED) : undefined
  const pctLabel  = hasPct
    ? `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}% จากเมื่อวาน`
    : undefined

  return (
    <div style={{
      backgroundColor: accent ? `${GOLD}0e` : CARD,
      border: `1px solid ${warn ? RED + '55' : accent ? GOLD + '44' : BORDER}`,
      borderRadius: 12, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', letterSpacing: '2px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ? GOLD : warn ? RED : '#fff', lineHeight: 1.1, letterSpacing: '-0.5px' }}>{value}</div>
      {pctLabel && <div style={{ fontSize: 12, fontWeight: 600, color: pctColor }}>{pctLabel}</div>}
      {sub && !pctLabel && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>{sub}</div>}
    </div>
  )
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

export type DonutEntry = { name: string; value: number }

export function DonutChart({ title, data, colors }: { title: string; data: DonutEntry[]; colors: string[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', padding: '32px 0' }}>ยังไม่มีข้อมูล</div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 12, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ position: 'relative' }}>
        <PieChart width={160} height={160}>
          <Pie data={data} cx={80} cy={80} innerRadius={48} outerRadius={72}
            paddingAngle={3} startAngle={90} endAngle={450} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
        </PieChart>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{total}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '1px' }}>รายการ</div>
        </div>
      </div>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((d, i) => (
          <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors[i % colors.length], flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{d.name}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{d.value}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', minWidth: 34, textAlign: 'right' }}>
                {Math.round(d.value / total * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
