'use client'

import { lazy, Suspense, useEffect, useState, useCallback, useRef } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'

const LazyMenuTab        = lazy(() => import('@/components/cafe/MenuTab'))
const LazyStockTab       = lazy(() => import('@/components/cafe/StockTab'))
const LazyStaffTab       = lazy(() => import('@/components/cafe/StaffTab'))
const LazyFinanceTab     = lazy(() => import('@/components/cafe/FinanceTab'))
const LazyRecipeCostTab  = lazy(() => import('@/components/cafe/RecipeCostTab'))
const LazyScheduleTab    = lazy(() => import('@/components/cafe/ScheduleTab'))

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://fmsdfcsqdpdlppucuptn.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtc2RmY3NxZHBkbHBwdWN1cHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTgxNDksImV4cCI6MjA4NzU5NDE0OX0.LQ8kzdNml5HK4m12Mj4fPm2FL8MXc17vDAfrKl6sRS4'
const AI_ANALYST_URL = `${SUPABASE_URL}/functions/v1/ai-analyst`

const GOLD    = '#c9a84c'
const GOLD_DIM = '#c9a84c88'
const BLACK   = '#0a0a0a'
const DARK    = '#111'
const CARD    = '#161616'
const CARD2   = '#1a1a1a'
const BORDER  = 'rgba(201,168,76,0.15)'
const RED     = '#ff4d4d'
const GREEN   = '#4cba7f'
const ORANGE  = '#ff9933'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'menu' | 'categories' | 'stock' | 'settings' | 'staff' | 'customers' | 'purchase' | 'finance' | 'ai' | 'audit' | 'recipe-cost' | 'schedule'

type ExtDashStats = {
  today_sales:     number
  today_orders:    number
  today_items:     number
  today_profit:    number
  yesterday_sales: number
}

type HourlySale = { hour: number; sales: number; order_count: number }

type MenuPerf = {
  recipe_id:    string
  product_name: string
  total_qty:    number
  total_sales:  number
  total_cost:   number
  gross_profit: number
  margin_pct:   number
}

type CustomStat = { category: string; label: string; cnt: number }

type QueuePerf = { peak_hour: number; orders_per_hour: number; today_orders: number }

type StockVal = {
  total_value: number
  low_count:   number
  top_used:    { name: string; used_qty: number; unit: string }[]
}

type Category = {
  id: string; name: string; name_th: string | null; name_lo: string | null; parent_id: string | null
}

type CategoryJoin = { id: string; name: string; name_th: string | null } | null

type Recipe = {
  id: string; product_name: string; product_name_th: string | null; product_name_lo: string | null
  price_lak: number; is_active: boolean; category: string | null; category_id: string | null
  categories: CategoryJoin | CategoryJoin[]
}

type InventoryItem = {
  id: string; name: string; name_th: string | null; name_lo: string | null
  current_qty: number; unit: string; reorder_point: number | null
  supplier: string | null; supplier_phone: string | null
}

type PurchaseLog = {
  id: string; qty_purchased: number; unit_price_lak: number; total_lak: number
  supplier: string | null; created_at: string
}

type SiteSettings = {
  shop_name: string; shop_name_th: string; shop_name_lo: string; ticker_text: string
}

type Customer = {
  id: string; name: string | null; phone: string | null; nationality: string | null
  language_pref: string; allergies: string[]; loyalty_points: number
  visit_count: number; lifetime_spend_lak: number; email: string | null
  created_at: string; updated_at: string
}

type PurchaseEntry = {
  id: string; inventory_name: string | null; unit: string | null; staff_name: string | null
  qty_purchased: number; unit_price_lak: number; market_price_lak: number | null
  supplier: string | null; status: string; flag_reason: string | null
  receipt_url: string | null; weigh_image_url: string | null; created_at: string
  inventory_id?: string; staff_id?: string
}

type AuditLog = {
  id: string; created_at: string; action: string; table_name: string
  record_id: string | null; payload: Record<string, unknown>
}

type LeaveRequest = {
  id: string; staff_id: string; leave_type: string
  start_date: string; end_date: string; reason: string | null
  status: string; created_at: string
  staff?: { name: string | null } | null
}

type CashflowRow = {
  log_date: string; shift: string; system_sales: number; actual_cash: number
  variance_lak: number; opening_cash?: number; staff_id?: string
}

type InventorySimple = { id: string; name: string; unit: string }

type FullSettings = {
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
  // Cost Management
  cost_cup_lid: string; cost_straw: string; cost_bag: string; cost_bag_pct: string
  cost_other_pkg: string; cost_waste_pct: string
  cost_ice_bag_price: string; cost_ice_melt_pct: string; cost_ice_per_cup_g: string
  overhead_rent: string; overhead_electric: string; overhead_water: string
  overhead_salary: string; overhead_supplies: string; overhead_other: string
  target_cups_month: string
}

const DEFAULT_SETTINGS: FullSettings = {
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
  cost_cup_lid: '2500', cost_straw: '210', cost_bag: '500', cost_bag_pct: '30',
  cost_other_pkg: '0', cost_waste_pct: '15',
  cost_ice_bag_price: '20000', cost_ice_melt_pct: '30', cost_ice_per_cup_g: '175',
  overhead_rent: '0', overhead_electric: '0', overhead_water: '0',
  overhead_salary: '0', overhead_supplies: '0', overhead_other: '0',
  target_cups_month: '500',
}

const DAYS_OF_WEEK = [
  { key: 'mon', label: 'จ' }, { key: 'tue', label: 'อ' }, { key: 'wed', label: 'พ' },
  { key: 'thu', label: 'พฤ' }, { key: 'fri', label: 'ศ' }, { key: 'sat', label: 'ส' },
  { key: 'sun', label: 'อา' },
]

type RecipeEdit = {
  product_name: string; product_name_th: string; product_name_lo: string
  price_str: string; category_id: string
}

type AddStockForm = { qty: string; cost: string; supplier: string; date: string }

type StockDetail = {
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

type InventoryForm = {
  name: string; name_th: string; name_lo: string; unit: string
  current_qty: string; reorder_point: string; max_quantity: string
  cost_per_unit: string; storage_location: string; expiry_days: string
  supplier: string; supplier_phone: string
  secondary_supplier: string; secondary_supplier_phone: string
  notes: string
}

type UsageStat = { day: string; used_qty: number; sales_lak: number }

const STORAGE_OPTIONS = [
  { value: 'fridge',  label: '🧊 ตู้เย็น' },
  { value: 'freezer', label: '❄️ Freezer' },
  { value: 'shelf',   label: '📦 ชั้นวาง' },
  { value: 'counter', label: '🍳 Counter' },
]

function storageIcon(loc: string | null): string {
  if (loc === 'fridge')  return '🧊'
  if (loc === 'freezer') return '❄️'
  if (loc === 'counter') return '🍳'
  return '📦'
}

function emptyInventoryForm(): InventoryForm {
  return {
    name: '', name_th: '', name_lo: '', unit: 'g',
    current_qty: '0', reorder_point: '', max_quantity: '',
    cost_per_unit: '', storage_location: 'shelf', expiry_days: '',
    supplier: '', supplier_phone: '',
    secondary_supplier: '', secondary_supplier_phone: '',
    notes: '',
  }
}

type RecipeIngredient = {
  id: string; inventory_id: string; name: string; name_th: string | null
  qty_required: number; unit: string
}

type RecipeFull = {
  id: string; product_name: string; product_name_th: string | null; product_name_lo: string | null
  price_lak: number; is_active: boolean; is_seasonal: boolean; seasonal_note: string | null
  category: string | null; category_id: string | null
  description_en: string | null; description_th: string | null; description_lo: string | null
  preparation_time: number | null; calories: number | null
  allergens: string[]; cost_per_cup_lak: number | null; image_url: string | null
  total_qty_30d: number; total_sales_30d: number; calc_cost: number; margin_pct: number
  ingredients: RecipeIngredient[]
}

type RecipeFullEdit = {
  product_name: string; product_name_th: string; product_name_lo: string
  description_en: string; description_th: string; description_lo: string
  price_str: string; cost_str: string; prep_str: string; cal_str: string
  allergens: string[]; category_id: string
  is_seasonal: boolean; seasonal_note: string; image_url: string
}

type DaySale = { day: string; qty: number; sales: number }

type CatNode = {
  id: string; name: string; name_th: string | null; name_lo: string | null
  description_en: string | null; description_th: string | null; description_lo: string | null
  icon: string | null; color: string | null
  parent_id: string | null; sort_order: number; is_active: boolean; menu_count: number
  children?: CatNode[]
}

type CatEdit = {
  name: string; name_th: string; name_lo: string
  icon: string; color: string; parent_id: string; sort_order: string
}

type PaymentBank = {
  id: string
  name: string
  account_number: string
  account_name: string
  color: string
}

// ─── Staff Types ──────────────────────────────────────────────────────────────

type StaffMember = {
  id: string; name: string; name_th: string | null; name_lo: string | null
  phone: string | null; avatar_url: string | null
  salary: number | null; salary_type: string | null
  start_date: string | null; is_active: boolean; is_verified: boolean
  scheduled_start_time: string | null; rating: number | null
  skills: string[] | null; notes: string | null
}

type StaffToday = {
  id: string; name: string; name_th: string | null; avatar_url: string | null
  clock_in: string | null; clock_out: string | null
  status: string; late_minutes: number | null; scheduled_start: string | null
}

type StaffAnalytics = {
  id: string; name: string; name_th: string | null; avatar_url: string | null
  days_present: number; days_late: number; total_hours: number
  punctuality_pct: number; orders_served: number
}

type AttendanceRow = {
  staff_id: string; staff_name: string; report_date: string
  clock_in: string | null; clock_out: string | null
  status: string; late_minutes: number | null
}

type StaffForm = {
  name: string; name_th: string; name_lo: string
  phone: string; salary: string; salary_type: string
  start_date: string; scheduled_start_time: string
  skills: string; notes: string; pin: string
}

function emptyStaffForm(): StaffForm {
  return {
    name: '', name_th: '', name_lo: '', phone: '',
    salary: '', salary_type: 'monthly',
    start_date: new Date().toISOString().slice(0, 10),
    scheduled_start_time: '08:00',
    skills: '', notes: '', pin: '',
  }
}

const ICON_OPTIONS = [
  '☕','🍵','🧋','🥤','🍹','🍰','🧁','🍫','🥐','🥪',
  '🌿','🍋','🍓','🫐','🍊','🌸','⭐','🔥','✨','❄️',
  '🎯','💫','🌙','🌺','🍃','🧃','🫖','🥛','🍮','🎂',
]

function emptyEditCat(): CatEdit {
  return { name: '', name_th: '', name_lo: '', icon: '', color: '#c9a84c', parent_id: '', sort_order: '0' }
}

const ALLERGENS = ['นม', 'กลูเตน', 'ถั่ว', 'ไข่', 'ซีฟู้ด']

function toEdit(r: RecipeFull): RecipeFullEdit {
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

function emptyEdit(): RecipeFullEdit {
  return {
    product_name: '', product_name_th: '', product_name_lo: '',
    description_en: '', description_th: '', description_lo: '',
    price_str: '', cost_str: '', prep_str: '', cal_str: '',
    allergens: [], category_id: '', is_seasonal: false, seasonal_note: '', image_url: '',
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtLAK(n: number): string {
  return new Intl.NumberFormat('lo-LA').format(Math.round(n)) + ' ₭'
}

function fmtK(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000)    return (n / 1000).toFixed(0) + 'k'
  return String(Math.round(n))
}

function fmtHour(h: number): string {
  return String(h).padStart(2, '0') + 'h'
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Asia/Vientiane',
  })
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function todayVientiane(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Vientiane' })
}

function getCategoryData(c: CategoryJoin | CategoryJoin[]): CategoryJoin {
  if (Array.isArray(c)) return c[0] ?? null
  return c
}

function currentHourVientiane(): number {
  return parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Vientiane' }), 10)
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  backgroundColor: '#1a1a1a',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 7, color: '#fff', fontSize: 14,
  padding: '8px 12px', outline: 'none', boxSizing: 'border-box', width: '100%',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.38)',
  letterSpacing: '1px', marginBottom: 5, textTransform: 'uppercase',
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    backgroundColor: bg, border: 'none', borderRadius: 8,
    color: bg === GOLD ? BLACK : '#fff',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '8px 16px', flexShrink: 0,
  }
}
function btnStyleSm(bg: string, color?: string): React.CSSProperties {
  return { ...btnStyle(bg), padding: '4px 10px', fontSize: 12, color: color ?? (bg === GOLD ? BLACK : '#fff') }
}

// ─── Small Components ─────────────────────────────────────────────────────────

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, lineHeight: 1,
      padding: '3px 9px', borderRadius: 20,
      backgroundColor: bg, color, whiteSpace: 'nowrap', flexShrink: 0,
    }}>{label}</span>
  )
}

function Toast({ msg }: { msg: string | null }) {
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

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
      กำลังโหลด...
    </div>
  )
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
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

type DonutEntry = { name: string; value: number }

function DonutChart({ title, data, colors }: { title: string; data: DonutEntry[]; colors: string[] }) {
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

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab() {
  const [stats,        setStats]        = useState<ExtDashStats | null>(null)
  const [hourly,       setHourly]       = useState<HourlySale[]>([])
  const [menu,         setMenu]         = useState<MenuPerf[]>([])
  const [custom,       setCustom]       = useState<CustomStat[]>([])
  const [qperf,        setQperf]        = useState<QueuePerf | null>(null)
  const [sval,         setSval]         = useState<StockVal | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [rpcErr,       setRpcErr]       = useState(false)
  const [period,       setPeriod]       = useState<'today' | 'week' | 'month'>('today')
  const [periodSales,  setPeriodSales]  = useState(0)
  const [periodOrders, setPeriodOrders] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const today = todayVientiane()
      const pDays = period === 'today' ? 1 : period === 'week' ? 7 : 30

      const [sRes, hRes, mRes, cRes, qRes, svRes] = await Promise.all([
        supabase.rpc('get_dashboard_stats'),
        supabase.rpc('get_hourly_sales', { p_date: today }),
        supabase.rpc('get_menu_performance', { p_days: pDays }),
        supabase.rpc('get_customization_stats', { p_days: pDays }),
        supabase.rpc('get_queue_performance', { p_days: pDays }),
        supabase.rpc('get_stock_value'),
      ])

      const anyError = [sRes, hRes, mRes, cRes, qRes, svRes].some(r => r.error)
      setRpcErr(anyError)

      if (!anyError) {
        setStats(sRes.data as ExtDashStats)
        setHourly((hRes.data as HourlySale[]) ?? [])
        setMenu((mRes.data as MenuPerf[]) ?? [])
        setCustom((cRes.data as CustomStat[]) ?? [])
        setQperf(qRes.data as QueuePerf)
        setSval(svRes.data as StockVal)
      } else {
        // Minimal fallback: direct orders query for today stats
        const { data: rows } = await supabase
          .from('orders').select('total_lak').eq('status', 'paid')
          .gte('created_at', today + 'T00:00:00+07:00')
          .lt('created_at',  today + 'T23:59:59+07:00')
        const todaySales = (rows ?? []).reduce((a, o) => a + Number(o.total_lak ?? 0), 0)
        setStats({ today_sales: todaySales, today_orders: (rows ?? []).length, today_items: 0, today_profit: 0, yesterday_sales: 0 })
      }

      // For week/month: fetch period revenue directly from orders table
      if (period !== 'today') {
        const from = new Date(Date.now() - pDays * 86400000).toISOString()
        const { data: pRows } = await supabase
          .from('orders').select('total_lak').eq('status', 'paid').gte('created_at', from)
        setPeriodSales((pRows ?? []).reduce((a: number, o: { total_lak: unknown }) => a + Number(o.total_lak ?? 0), 0))
        setPeriodOrders((pRows ?? []).length)
      }
      setLoading(false)
    }
    load()
  }, [period])

  // Realtime: refresh today's stats whenever any order changes
  useEffect(() => {
    const ch = supabase
      .channel('dashboard_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        supabase.rpc('get_dashboard_stats').then(({ data }) => { if (data) setStats(data as ExtDashStats) })
        supabase.rpc('get_hourly_sales', { p_date: todayVientiane() }).then(({ data }) => { if (data) setHourly((data as HourlySale[]) ?? []) })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  if (loading) return <LoadingSpinner />

  // ── Derived ──────────────────────────────────────────────────────────────────
  const pctChange = stats && stats.yesterday_sales > 0
    ? ((stats.today_sales - stats.yesterday_sales) / stats.yesterday_sales) * 100
    : undefined

  const curHour = currentHourVientiane()
  const chartData = hourly
    .filter(h => h.hour >= 6 && h.hour <= 22)
    .map(h => ({ ...h, label: fmtHour(h.hour), isCurrent: h.hour === curHour }))

  const sweetData: DonutEntry[] = ['หวานปกติ', 'หวานน้อย', 'ไม่หวาน', 'ไม่ระบุ']
    .map(l => ({ name: l, value: Number(custom.find(c => c.category === 'sweetness' && c.label === l)?.cnt ?? 0) }))
    .filter(d => d.value > 0)

  const tempData: DonutEntry[] = ['ร้อน', 'เย็น', 'อุ่น', 'ไม่ระบุ']
    .map(l => ({ name: l, value: Number(custom.find(c => c.category === 'temperature' && c.label === l)?.cnt ?? 0) }))
    .filter(d => d.value > 0)

  const peakHourData = hourly.length > 0
    ? hourly.reduce((max, h) => h.order_count > max.order_count ? h : max, hourly[0])
    : null

  const periodLabel = period === 'today' ? 'วันนี้' : period === 'week' ? '7 วัน' : '30 วัน'
  const dispSales   = period === 'today' ? (stats?.today_sales  ?? 0) : periodSales
  const dispOrders  = period === 'today' ? (stats?.today_orders ?? 0) : periodOrders

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Migration warning */}
      {rpcErr && (
        <div style={{ padding: '12px 16px', backgroundColor: '#2a1a0a', border: `1px solid ${GOLD}44`, borderRadius: 8, fontSize: 13, color: GOLD }}>
          RPCs ยังไม่ถูกสร้าง — กรุณา run <code style={{ backgroundColor: '#111', padding: '2px 6px', borderRadius: 4 }}>012_cafe_admin.sql</code>, <code style={{ backgroundColor: '#111', padding: '2px 6px', borderRadius: 4 }}>013_cafe_detail.sql</code> และ <code style={{ backgroundColor: '#111', padding: '2px 6px', borderRadius: 4 }}>014_dashboard_stats.sql</code>
        </div>
      )}

      {/* ── Period selector ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['today', 'week', 'month'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: '6px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            border: `1px solid ${period === p ? GOLD : BORDER}`,
            backgroundColor: period === p ? `${GOLD}18` : 'transparent',
            color: period === p ? GOLD : 'rgba(255,255,255,0.4)',
            transition: 'all 0.15s',
          }}>
            {p === 'today' ? 'วันนี้' : p === 'week' ? '7 วัน' : '30 วัน'}
          </button>
        ))}
      </div>

      {/* ── Section 1: KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <KPICard
          label={`ยอดขาย (${periodLabel})`}
          value={fmtLAK(dispSales)}
          change={period === 'today' ? pctChange : undefined}
          accent
        />
        <KPICard
          label="กำไรขั้นต้น (วันนี้)"
          value={fmtLAK(stats?.today_profit ?? 0)}
          sub={stats && stats.today_sales > 0
            ? `${Math.round((stats.today_profit / stats.today_sales) * 100)}% margin`
            : '—'}
        />
        <KPICard
          label={`Orders (${periodLabel})`}
          value={String(dispOrders)}
          sub={`เฉลี่ย ${fmtLAK(dispOrders > 0 ? Math.round(dispSales / dispOrders) : 0)} / order`}
        />
        <KPICard
          label="เฉลี่ยต่อออเดอร์ (วันนี้)"
          value={`${stats?.today_items ?? 0} รายการ`}
          sub="avg items per order"
        />
        <KPICard
          label="วัตถุดิบใกล้หมด"
          value={`${sval?.low_count ?? '—'} รายการ`}
          warn={(sval?.low_count ?? 0) > 0}
          sub={sval?.low_count === 0 ? 'สต็อกปกติ' : 'ต้องเติม'}
        />
      </div>

      {/* ── Section 2: Hourly Sales Chart (today only) ── */}
      {period === 'today' && <SectionCard title="ยอดขายรายชั่วโมง — วันนี้">
        {chartData.length === 0 || chartData.every(d => d.sales === 0) ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.18)', padding: '40px 0', fontSize: 14 }}>ยังไม่มียอดวันนี้</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barSize={22}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'rgba(255,255,255,0.32)', fontSize: 11 }}
                axisLine={false} tickLine={false}
                interval={1}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.28)', fontSize: 10 }}
                axisLine={false} tickLine={false}
                tickFormatter={fmtK}
                width={42}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{ backgroundColor: '#1e1e1e', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: GOLD, fontWeight: 700 }}
                formatter={(v, name) => name === 'sales'
                  ? [fmtLAK(Number(v)), 'ยอดขาย']
                  : [String(v), 'orders']}
              />
              <Bar dataKey="sales" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.isCurrent ? '#fff' : d.sales > 0 ? GOLD : GOLD_DIM}
                    fillOpacity={d.isCurrent ? 0.9 : d.sales > 0 ? 0.85 : 0.2}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: GOLD, display: 'inline-block' }} />
            ยอดขาย (LAK)
          </span>
          {peakHourData && peakHourData.order_count > 0 && (
            <span>ชั่วโมงยอด: <strong style={{ color: GOLD }}>{fmtHour(peakHourData.hour)}</strong> ({peakHourData.order_count} orders)</span>
          )}
        </div>
      </SectionCard>}

      {/* ── Section 3: Menu Performance Table ── */}
      <SectionCard title={`menu performance — ${periodLabel} (${menu.length} รายการ)`}>
        {menu.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.18)', padding: '30px 0' }}>ยังไม่มีข้อมูล</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['#', 'เมนู', 'จำนวน', 'ยอดขาย', 'กำไรขั้นต้น', 'Margin'].map((h, i) => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: i <= 1 ? 'left' : 'right',
                      fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600,
                      letterSpacing: '1px', textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {menu.map((row, i) => {
                  const lowMargin = row.margin_pct < 30
                  const midMargin = row.margin_pct >= 30 && row.margin_pct < 50
                  const marginColor = row.margin_pct >= 50 ? GREEN : midMargin ? GOLD : ORANGE
                  return (
                    <tr key={row.recipe_id} style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)',
                    }}>
                      <td style={{ padding: '10px 12px', color: i < 3 ? GOLD : 'rgba(255,255,255,0.3)', fontWeight: i < 3 ? 800 : 400, width: 32 }}>{i + 1}</td>
                      <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 500 }}>{row.product_name}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums' }}>{row.total_qty}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{fmtLAK(row.total_sales)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: GREEN, fontVariantNumeric: 'tabular-nums' }}>{fmtLAK(row.gross_profit)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <span style={{ color: marginColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {row.margin_pct.toFixed(1)}%
                          </span>
                          {lowMargin && <Badge label="ต่ำ" bg={ORANGE + '22'} color={ORANGE} />}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Section 4: Customization Stats ── */}
      <SectionCard title="customization stats — 7 วัน">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
          <DonutChart
            title="ความหวาน"
            data={sweetData}
            colors={[GOLD, '#e8d5a0', 'rgba(201,168,76,0.3)', 'rgba(255,255,255,0.12)']}
          />
          <DonutChart
            title="อุณหภูมิ"
            data={tempData}
            colors={['#ff7c45', '#5ba8ff', '#ffb347', 'rgba(255,255,255,0.12)']}
          />
        </div>
      </SectionCard>

      {/* ── Section 5: Stock & Queue ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Stock card */}
        <SectionCard title="สต็อก & วัตถุดิบ">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>มูลค่าสต็อกรวม</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: GOLD }}>{fmtLAK(sval?.total_value ?? 0)}</div>
              </div>
              {(sval?.low_count ?? 0) > 0 && (
                <Badge label={`${sval?.low_count} ใกล้หมด`} bg={RED + '22'} color={RED} />
              )}
            </div>

            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>
                วัตถุดิบที่ใช้มากสุดวันนี้
              </div>
              {!sval || sval.top_used.length === 0 ? (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>ยังไม่มีข้อมูล</div>
              ) : (
                sval.top_used.map((item, i) => (
                  <div key={item.name} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 0',
                    borderBottom: i < sval.top_used.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: i === 0 ? GOLD : 'rgba(255,255,255,0.25)', width: 20 }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: '#fff' }}>{item.name}</span>
                    </div>
                    <span style={{ fontSize: 13, color: GOLD, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {item.used_qty} {item.unit}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </SectionCard>

        {/* Queue performance card */}
        <SectionCard title="queue performance — 7 วัน">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Peak hour highlight */}
            <div style={{
              backgroundColor: CARD2, borderRadius: 10, padding: '16px 20px',
              border: `1px solid ${GOLD}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>ชั่วโมงยอด (Peak Hour)</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: GOLD, letterSpacing: '-1px', lineHeight: 1 }}>
                  {qperf ? fmtHour(qperf.peak_hour) : '—'}
                </div>
              </div>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                border: `3px solid ${GOLD}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28,
              }}>
                ⏰
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ backgroundColor: CARD2, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>Orders วันนี้</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{qperf?.today_orders ?? '—'}</div>
              </div>
              <div style={{ backgroundColor: CARD2, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>เฉลี่ย / ชั่วโมง</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{qperf?.orders_per_hour ?? '—'}</div>
              </div>
            </div>

            {/* Mini hourly bar preview */}
            {chartData.length > 0 && (
              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  กระจายตัวตามชั่วโมง
                </div>
                <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 40 }}>
                  {chartData.map(d => {
                    const maxCount = Math.max(...chartData.map(x => x.order_count), 1)
                    const h = Math.round((Number(d.order_count) / maxCount) * 40)
                    return (
                      <div
                        key={d.hour}
                        title={`${d.label}: ${d.order_count} orders`}
                        style={{
                          flex: 1, height: Math.max(h, 3), borderRadius: '2px 2px 0 0',
                          backgroundColor: d.isCurrent ? '#fff'
                            : d.order_count > 0 ? GOLD
                            : 'rgba(255,255,255,0.06)',
                          opacity: d.hour === qperf?.peak_hour ? 1 : 0.65,
                          transition: 'height .3s',
                        }}
                      />
                    )
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>
                  <span>06h</span><span>12h</span><span>18h</span><span>22h</span>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

// ─── Menu Tab → see components/cafe/MenuTab.tsx ───────────────────────────────

// (extracted — AllergenToggle, RecipeFullForm, RecipeCard, MenuTab)

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CatForm({ data, onChange, allCats, onSave, onCancel, saving, title, excludeId }: {
  data: CatEdit; onChange: (d: CatEdit) => void; allCats: CatNode[]
  onSave: () => void; onCancel: () => void; saving: boolean; title: string; excludeId?: string
}) {
  const set = (k: keyof CatEdit) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...data, [k]: e.target.value })

  const parentOptions = allCats.filter(c => c.id !== excludeId && !c.parent_id)

  return (
    <div style={{ padding: 18, backgroundColor: '#0d0d0d', border: `1px solid ${GOLD}33`, borderRadius: 10, marginTop: 8 }}>
      <div style={{ fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 14 }}>{title}</div>

      {/* Names */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Field label="ชื่อ EN *"><input value={data.name} onChange={set('name')} style={inputStyle} placeholder="Coffee" /></Field>
        <Field label="ชื่อ TH"><input value={data.name_th} onChange={set('name_th')} style={inputStyle} placeholder="กาแฟ" /></Field>
        <Field label="ชื่อ LO"><input value={data.name_lo} onChange={set('name_lo')} style={inputStyle} placeholder="ກາເຟ" /></Field>
      </div>

      {/* Icon picker */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, letterSpacing: '1px', textTransform: 'uppercase' }}>Icon</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {ICON_OPTIONS.map(ic => (
            <button key={ic} type="button" onClick={() => onChange({ ...data, icon: ic })} style={{
              width: 34, height: 34, borderRadius: 6, border: `1px solid ${data.icon === ic ? GOLD : 'rgba(255,255,255,0.1)'}`,
              backgroundColor: data.icon === ic ? GOLD + '22' : 'transparent',
              fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{ic}</button>
          ))}
          <button type="button" onClick={() => onChange({ ...data, icon: '' })} style={{
            width: 34, height: 34, borderRadius: 6, border: `1px solid ${!data.icon ? GOLD : 'rgba(255,255,255,0.1)'}`,
            backgroundColor: !data.icon ? GOLD + '22' : 'transparent',
            fontSize: 11, color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
          }}>ไม่มี</button>
        </div>
        {data.icon && <span style={{ fontSize: 22 }}>{data.icon}</span>}
      </div>

      {/* Color + Sort + Parent */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 90px 1fr', gap: 10, marginBottom: 14 }}>
        <Field label="สี Badge">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={data.color || '#c9a84c'} onChange={set('color')} style={{ width: 36, height: 32, padding: 2, border: `1px solid ${BORDER}`, borderRadius: 4, backgroundColor: '#1a1a1a', cursor: 'pointer' }} />
            <input value={data.color} onChange={set('color')} style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 11 }} placeholder="#c9a84c" />
          </div>
        </Field>
        <Field label="ลำดับ (sort)">
          <input value={data.sort_order} onChange={set('sort_order')} type="number" min="0" style={inputStyle} />
        </Field>
        <Field label="หมวดแม่ (Parent)">
          <select value={data.parent_id} onChange={set('parent_id')} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">— ไม่มี (Root) —</option>
            {parentOptions.map(c => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}{c.name_th ? ` (${c.name_th})` : ''}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onSave} disabled={saving} style={btnStyle(GOLD)}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        <button onClick={onCancel} style={btnStyle('rgba(255,255,255,0.08)')}>ยกเลิก</button>
      </div>
    </div>
  )
}

function CatRow({ node, siblings, allFlat, depth, onReload, showMsg }: {
  node: CatNode; siblings: CatNode[]; allFlat: CatNode[]
  depth: number; onReload: () => void; showMsg: (m: string) => void
}) {
  const [editing,    setEditing]    = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [editData,   setEditData]   = useState<CatEdit>({
    name: node.name, name_th: node.name_th ?? '', name_lo: node.name_lo ?? '',
    icon: node.icon ?? '', color: node.color ?? '#c9a84c',
    parent_id: node.parent_id ?? '', sort_order: String(node.sort_order),
  })
  const [newChildData, setNewChildData] = useState<CatEdit>(emptyEditCat())
  const [saving, setSaving] = useState(false)

  const myIdx = siblings.findIndex(s => s.id === node.id)
  const prevSibling = myIdx > 0 ? siblings[myIdx - 1] : null
  const nextSibling = myIdx < siblings.length - 1 ? siblings[myIdx + 1] : null

  const indent = depth * 24

  async function toggleActive(e: React.MouseEvent) {
    e.stopPropagation()
    await supabase.rpc('update_category', { p_id: node.id, p_is_active: !node.is_active })
    onReload()
  }

  async function saveEdit() {
    if (!editData.name.trim()) { showMsg('กรุณาระบุชื่อหมวด'); return }
    setSaving(true)
    const { error } = await supabase.rpc('update_category', {
      p_id:         node.id,
      p_name:       editData.name,
      p_name_th:    editData.name_th,
      p_name_lo:    editData.name_lo,
      p_icon:       editData.icon,
      p_color:      editData.color,
      p_sort_order: parseInt(editData.sort_order) || 0,
      p_is_active:  node.is_active,
    })
    if (!error) { showMsg('บันทึกสำเร็จ'); setEditing(false); onReload() }
    else showMsg('Error: ' + error.message)
    setSaving(false)
  }

  async function addChild() {
    if (!newChildData.name.trim()) { showMsg('กรุณาระบุชื่อหมวด'); return }
    setSaving(true)
    const { error } = await supabase.rpc('create_category', {
      p_name:       newChildData.name,
      p_name_th:    newChildData.name_th,
      p_name_lo:    newChildData.name_lo,
      p_icon:       newChildData.icon,
      p_color:      newChildData.color,
      p_parent_id:  node.id,
      p_sort_order: parseInt(newChildData.sort_order) || 0,
    })
    if (!error) { showMsg('เพิ่มหมวดย่อยสำเร็จ'); setAddingChild(false); setNewChildData(emptyEditCat()); onReload() }
    else showMsg('Error: ' + error.message)
    setSaving(false)
  }

  async function deleteCat() {
    if (!confirm(`ลบหมวด "${node.name}"?`)) return
    const { data } = await supabase.rpc('delete_category', { p_id: node.id })
    if (data?.ok) { showMsg('ลบสำเร็จ'); onReload() }
    else showMsg(data?.reason ?? 'ลบไม่ได้')
  }

  async function swapSort(other: CatNode) {
    await supabase.rpc('swap_category_sort', { p_id_a: node.id, p_id_b: other.id })
    onReload()
  }

  const badgeColor = node.color ?? GOLD
  const canDelete = node.menu_count === 0 && (!node.children || node.children.length === 0)

  return (
    <div>
      {/* Row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingLeft: 12 + indent, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
        backgroundColor: editing ? '#131313' : depth === 0 ? CARD : CARD2,
        border: `1px solid ${editing ? GOLD + '44' : BORDER}`,
        borderRadius: 8, opacity: node.is_active ? 1 : 0.45,
        marginBottom: 4,
      }}>
        {/* Active toggle */}
        <button onClick={toggleActive} title={node.is_active ? 'ปิด' : 'เปิด'} style={{
          width: 30, height: 17, borderRadius: 9, border: 'none', cursor: 'pointer', flexShrink: 0,
          backgroundColor: node.is_active ? GOLD : 'rgba(255,255,255,0.1)', transition: 'background .2s',
        }} />

        {/* Icon */}
        {node.icon && <span style={{ fontSize: 18, flexShrink: 0 }}>{node.icon}</span>}

        {/* Names */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{node.name}</span>
            <span style={{
              fontSize: 11, padding: '1px 8px', borderRadius: 10,
              backgroundColor: badgeColor + '22', color: badgeColor, border: `1px solid ${badgeColor}44`,
            }}>
              {node.menu_count} เมนู
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            {node.name_th && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{node.name_th}</span>}
            {node.name_lo && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{node.name_lo}</span>}
          </div>
        </div>

        {/* Color swatch */}
        {node.color && (
          <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: node.color, flexShrink: 0 }} title={node.color} />
        )}

        {/* Sort buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          <button onClick={() => prevSibling && swapSort(prevSibling)} disabled={!prevSibling} style={{ width: 22, height: 16, border: 'none', borderRadius: 3, backgroundColor: prevSibling ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)', cursor: prevSibling ? 'pointer' : 'default', color: prevSibling ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)', fontSize: 9, lineHeight: 1 }}>▲</button>
          <button onClick={() => nextSibling && swapSort(nextSibling)} disabled={!nextSibling} style={{ width: 22, height: 16, border: 'none', borderRadius: 3, backgroundColor: nextSibling ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)', cursor: nextSibling ? 'pointer' : 'default', color: nextSibling ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)', fontSize: 9, lineHeight: 1 }}>▼</button>
        </div>

        {/* Action buttons */}
        <button onClick={() => { setAddingChild(!addingChild); setEditing(false) }} style={btnStyleSm(GOLD + '18', GOLD)}>+ ย่อย</button>
        <button onClick={() => { setEditing(!editing); setAddingChild(false) }} style={btnStyleSm('rgba(255,255,255,0.08)', 'rgba(255,255,255,0.55)')}>แก้ไข</button>
        {canDelete && (
          <button onClick={deleteCat} style={btnStyleSm(RED + '18', RED)}>ลบ</button>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ marginLeft: indent + 12, marginBottom: 8 }}>
          <CatForm
            title={`แก้ไข: ${node.name}`}
            data={editData} onChange={setEditData}
            allCats={allFlat} excludeId={node.id}
            saving={saving} onSave={saveEdit} onCancel={() => setEditing(false)}
          />
        </div>
      )}

      {/* Add child form */}
      {addingChild && (
        <div style={{ marginLeft: indent + 12, marginBottom: 8 }}>
          <CatForm
            title={`+ เพิ่มหมวดย่อยใน: ${node.name}`}
            data={{ ...newChildData, parent_id: node.id }}
            onChange={d => setNewChildData({ ...d, parent_id: node.id })}
            allCats={allFlat}
            saving={saving} onSave={addChild} onCancel={() => setAddingChild(false)}
          />
        </div>
      )}

      {/* Children */}
      {node.children && node.children.length > 0 && (
        <div style={{ marginLeft: indent + 12 }}>
          {node.children.map(child => (
            <CatRow
              key={child.id} node={child} siblings={node.children!}
              allFlat={allFlat} depth={depth + 1} onReload={onReload} showMsg={showMsg}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoriesTab() {
  const [cats,     setCats]     = useState<CatNode[]>([])
  const [allFlat,  setAllFlat]  = useState<CatNode[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newData,  setNewData]  = useState<CatEdit>(emptyEditCat())
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<string | null>(null)

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.rpc('get_categories_tree')
    const flat = (data as CatNode[]) ?? []
    setAllFlat(flat)

    // Build tree
    const map = new Map<string, CatNode>()
    flat.forEach(c => map.set(c.id, { ...c, children: [] }))
    const roots: CatNode[] = []
    map.forEach(node => {
      if (node.parent_id && map.has(node.parent_id)) {
        map.get(node.parent_id)!.children!.push(node)
      } else {
        roots.push(node)
      }
    })
    // Sort each level by sort_order
    const sortNodes = (nodes: CatNode[]) => {
      nodes.sort((a, b) => a.sort_order - b.sort_order)
      nodes.forEach(n => n.children && sortNodes(n.children))
    }
    sortNodes(roots)
    setCats(roots)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createRoot() {
    if (!newData.name.trim()) { showMsg('กรุณาระบุชื่อหมวด'); return }
    setSaving(true)
    const { error } = await supabase.rpc('create_category', {
      p_name:       newData.name,
      p_name_th:    newData.name_th,
      p_name_lo:    newData.name_lo,
      p_icon:       newData.icon,
      p_color:      newData.color,
      p_parent_id:  newData.parent_id || null,
      p_sort_order: parseInt(newData.sort_order) || 0,
    })
    if (!error) { showMsg('เพิ่มหมวดสำเร็จ'); setShowForm(false); setNewData(emptyEditCat()); await load() }
    else showMsg('Error: ' + error.message)
    setSaving(false)
  }

  if (loading) return <LoadingSpinner />

  const totalMenus = allFlat.reduce((s, c) => s + c.menu_count, 0)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase' }}>
            หมวดหมู่ทั้งหมด ({allFlat.length})
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 3 }}>
            ครอบคลุม {totalMenus} เมนู
          </div>
        </div>
        <button onClick={() => { setShowForm(!showForm); setNewData(emptyEditCat()) }} style={btnStyle(GOLD)}>
          {showForm ? '✕ ปิด' : '+ เพิ่มหมวดหมู่'}
        </button>
      </div>

      <Toast msg={msg} />

      {/* Add root form */}
      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <CatForm
            title="เพิ่มหมวดหมู่ใหม่"
            data={newData} onChange={setNewData}
            allCats={allFlat}
            saving={saving} onSave={createRoot} onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Tree */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {cats.map(root => (
          <CatRow
            key={root.id} node={root} siblings={cats}
            allFlat={allFlat} depth={0} onReload={load} showMsg={showMsg}
          />
        ))}
        {cats.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: 48, fontSize: 14 }}>
            ยังไม่มีหมวดหมู่ — กด "+ เพิ่มหมวดหมู่" เพื่อเริ่ม
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Stock Tab → see components/cafe/StockTab.tsx ─────────────────────────────

// ─── Payment Bank Editor ───────────────────────────────────────────────────────

type BankForm = { name: string; account_number: string; account_name: string; color: string }
const emptyBankForm = (): BankForm => ({ name: '', account_number: '', account_name: '', color: '#1a6cb0' })

function PaymentBankEditor({ banks, onUpdate }: { banks: PaymentBank[]; onUpdate: (b: PaymentBank[]) => void }) {
  const [adding, setAdding] = useState(false)
  const [form,   setForm]   = useState<BankForm>(emptyBankForm())

  function addBank() {
    if (!form.name.trim()) return
    onUpdate([...banks, { ...form, id: Date.now().toString() }])
    setForm(emptyBankForm()); setAdding(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {banks.map(bank => (
        <div key={bank.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', backgroundColor: CARD2, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: bank.color, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{bank.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
              {[bank.account_number, bank.account_name].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button onClick={() => onUpdate(banks.filter(b => b.id !== bank.id))}
            style={{ background: 'none', border: 'none', color: 'rgba(255,80,80,0.6)', fontSize: 18, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>×</button>
        </div>
      ))}

      {adding ? (
        <div style={{ padding: 14, backgroundColor: CARD2, borderRadius: 8, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="ชื่อธนาคาร">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="BCEL, LDB, KBank..." />
            </Field>
            <Field label="สีปุ่ม">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  style={{ width: 36, height: 34, borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'transparent', cursor: 'pointer', padding: 2, flexShrink: 0 }} />
                <input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }} placeholder="#1a6cb0" />
              </div>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="เลขบัญชี">
              <input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} style={inputStyle} placeholder="001-234-5678" />
            </Field>
            <Field label="ชื่อบัญชี">
              <input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} style={inputStyle} placeholder="ร้านอาลัน คอฟฟี่" />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addBank} style={{ ...btnStyle(GOLD), fontSize: 12, padding: '8px 20px' }}>+ เพิ่ม</button>
            <button onClick={() => { setAdding(false); setForm(emptyBankForm()) }}
              style={{ ...btnStyle('rgba(255,255,255,0.07)'), fontSize: 12, padding: '8px 16px', color: 'rgba(255,255,255,0.5)' }}>ยกเลิก</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{
          padding: '9px 0', borderRadius: 8, border: `1px dashed rgba(201,168,76,0.3)`,
          backgroundColor: 'transparent', color: GOLD, fontSize: 13, cursor: 'pointer', fontWeight: 600,
        }}>+ เพิ่มธนาคาร / บัญชีรับโอน</button>
      )}
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${BORDER}` }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div style={{ fontSize: 12, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>{title}</div>
      </div>
      {children}
    </div>
  )
}

function SettingsToggle({ value, onChange, label, sub }: { value: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
      <div>
        <div style={{ fontSize: 13, color: '#fff' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={() => onChange(!value)} style={{
        width: 42, height: 23, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
        backgroundColor: value ? GOLD : 'rgba(255,255,255,0.1)', transition: 'background .2s', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 3, left: value ? 22 : 3, width: 17, height: 17, borderRadius: '50%',
          backgroundColor: '#fff', transition: 'left .2s',
        }} />
      </button>
    </div>
  )
}

// ─── CostManagementSection ────────────────────────────────────────────────────

function CostManagementSection({ settings, onChange }: { settings: FullSettings; onChange: (s: FullSettings) => void }) {
  const [loadingSalary, setLoadingSalary] = useState(false)
  const set = (k: keyof FullSettings) =>
    (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...settings, [k]: e.target.value })
  const n = (k: keyof FullSettings, def = 0) => parseFloat(settings[k] as string) || def

  // ── Derived calculations ──────────────────────────────────────────────────
  const bagContrib    = n('cost_bag') * (n('cost_bag_pct') / 100)
  const basePackaging = n('cost_cup_lid') + n('cost_straw') + bagContrib + n('cost_other_pkg')
  const packagingPerCup = Math.round(basePackaging * (1 + n('cost_waste_pct') / 100))

  const usableKg      = 30 * (1 - n('cost_ice_melt_pct') / 100)
  const costPerGram   = usableKg > 0 ? n('cost_ice_bag_price') / (usableKg * 1000) : 0
  const icePerCup     = Math.round(costPerGram * n('cost_ice_per_cup_g'))

  const totalOverhead = n('overhead_rent') + n('overhead_electric') + n('overhead_water') +
    n('overhead_salary') + n('overhead_supplies') + n('overhead_other')
  const targetCups    = n('target_cups_month', 500) || 500
  const overheadPerCup = Math.round(totalOverhead / targetCups)
  const fixedPerCup   = packagingPerCup + overheadPerCup
  const breakEvenCupsDay = totalOverhead > 0 ? Math.ceil(targetCups / 30) : 0

  async function loadSalaries() {
    setLoadingSalary(true)
    const { data } = await supabase.rpc('get_all_staff')
    if (data) {
      const total = (data as { salary?: number }[]).reduce((s, st) => s + (st.salary ?? 0), 0)
      onChange({ ...settings, overhead_salary: String(total) })
    }
    setLoadingSalary(false)
  }

  const cardS: React.CSSProperties = { backgroundColor: CARD2, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}`, marginBottom: 12 }
  const labelS: React.CSSProperties = { fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 10 }
  const dimS: React.CSSProperties = { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4, lineHeight: 1.5 }
  const calcRow: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px', backgroundColor: `${GOLD}10`, borderRadius: 8,
    border: `1px solid ${GOLD}22`, marginTop: 12,
  }
  function SliderField({ label, fieldKey, min, max, unit, hint }: { label: string; fieldKey: keyof FullSettings; min: number; max: number; unit: string; hint?: string }) {
    const val = n(fieldKey)
    const sliderColor = val <= max * 0.4 ? GREEN : val <= max * 0.7 ? ORANGE : RED
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: sliderColor }}>{val}{unit}</span>
        </div>
        <input type="range" min={min} max={max} value={val}
          onChange={e => onChange({ ...settings, [fieldKey]: e.target.value })}
          style={{ width: '100%', accentColor: sliderColor, cursor: 'pointer' }} />
        {hint && <div style={dimS}>{hint}</div>}
      </div>
    )
  }
  function MoneyRow({ label, fieldKey, placeholder }: { label: string; fieldKey: keyof FullSettings; placeholder?: string }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="number" min="0" value={settings[fieldKey] as string} onChange={set(fieldKey)}
            style={{ ...inputStyle, flex: 1 }} placeholder={placeholder ?? '0'} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>₭</span>
        </div>
      </div>
    )
  }

  return (
    <SettingSection icon="💰" title="ต้นทุนร้าน">

      {/* ── Section 1: Packaging ── */}
      <div style={cardS}>
        <div style={labelS}>1. บรรจุภัณฑ์ต่อแก้ว</div>
        <MoneyRow label="แก้ว + ฝา" fieldKey="cost_cup_lid" placeholder="2500" />
        <MoneyRow label="หลอด" fieldKey="cost_straw" placeholder="210" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>ถุงกลับบ้าน</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="number" min="0" value={settings.cost_bag} onChange={set('cost_bag')}
              style={{ ...inputStyle, flex: 1 }} placeholder="500" />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>₭/ถุง</span>
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>% ลูกค้าที่ขอถุง</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>{n('cost_bag_pct')}%</span>
          </div>
          <input type="range" min={0} max={100} value={n('cost_bag_pct')}
            onChange={e => onChange({ ...settings, cost_bag_pct: e.target.value })}
            style={{ width: '100%', accentColor: GOLD, cursor: 'pointer' }} />
        </div>
        <MoneyRow label="บรรจุภัณฑ์อื่นๆ" fieldKey="cost_other_pkg" placeholder="0" />
        <SliderField label="Waste & Loss Factor" fieldKey="cost_waste_pct" min={0} max={30} unit="%"
          hint="ครอบคลุมของหล่น ลูกค้าหยิบหลอดเพิ่ม ผิดพลาด" />
        <div style={calcRow}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>ต้นทุน packaging จริงต่อแก้ว</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>{packagingPerCup.toLocaleString()} ₭</span>
        </div>
        <div style={dimS}>= (แก้ว+ฝา+หลอด+ถุง×{n('cost_bag_pct')}%) × (1 + {n('cost_waste_pct')}%)</div>
      </div>

      {/* ── Section 2: Ice ── */}
      <div style={cardS}>
        <div style={labelS}>2. ต้นทุนน้ำแข็ง</div>
        <MoneyRow label="ราคาน้ำแข็งต่อกระสอบ (30 kg)" fieldKey="cost_ice_bag_price" placeholder="20000" />
        <SliderField label="น้ำแข็งที่ละลายก่อนใช้" fieldKey="cost_ice_melt_pct" min={0} max={50} unit="%" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>น้ำแข็งต่อแก้วเย็น (g)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="number" min="0" value={settings.cost_ice_per_cup_g} onChange={set('cost_ice_per_cup_g')}
              style={{ ...inputStyle, flex: 1 }} placeholder="175" />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>g</span>
          </div>
        </div>
        <div style={calcRow}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>ต้นทุนน้ำแข็งต่อแก้วเย็น</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#4a9eff' }}>{icePerCup.toLocaleString()} ₭</span>
        </div>
        <div style={dimS}>= {n('cost_ice_per_cup_g')}g × (ราคา/30kg ÷ {Math.round(usableKg*1000).toLocaleString()}g usable)</div>
      </div>

      {/* ── Section 3: Monthly Overhead ── */}
      <div style={cardS}>
        <div style={labelS}>3. ค่าใช้จ่ายประจำเดือน</div>
        {([
          { icon: '🏠', label: 'ค่าเช่า', key: 'overhead_rent' },
          { icon: '⚡', label: 'ค่าไฟ', key: 'overhead_electric' },
          { icon: '💧', label: 'ค่าน้ำ', key: 'overhead_water' },
          { icon: '🧴', label: 'วัสดุสิ้นเปลือง (น้ำยา, ผ้า, ฯลฯ)', key: 'overhead_supplies' },
          { icon: '📦', label: 'อื่นๆ', key: 'overhead_other' },
        ] as { icon: string; label: string; key: keyof FullSettings }[]).map(row => (
          <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{row.icon} {row.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="number" min="0" value={settings[row.key] as string}
                onChange={e => onChange({ ...settings, [row.key]: e.target.value })}
                style={{ ...inputStyle, flex: 1 }} placeholder="0" />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>₭</span>
            </div>
          </div>
        ))}
        {/* Salary row with auto-fill button */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>👥 เงินเดือนรวม</span>
            <button type="button" onClick={loadSalaries} disabled={loadingSalary}
              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: `1px solid ${GOLD}44`, backgroundColor: 'transparent', color: GOLD, cursor: 'pointer', opacity: loadingSalary ? 0.5 : 1 }}>
              {loadingSalary ? '...' : '↓ ดึงอัตโนมัติ'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="number" min="0" value={settings.overhead_salary}
              onChange={set('overhead_salary')}
              style={{ ...inputStyle, flex: 1 }} placeholder="0" />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>₭</span>
          </div>
        </div>
        <div style={{ ...calcRow, marginTop: 14 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>รวม overhead ต่อเดือน</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{totalOverhead.toLocaleString()} ₭</span>
        </div>
      </div>

      {/* ── Section 4: Per-Cup Summary ── */}
      <div style={{ ...cardS, border: `1px solid ${GOLD}44` }}>
        <div style={labelS}>4. ต้นทุนต่อแก้ว (สรุป)</div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>เป้าหมายจำนวนแก้ว/เดือน</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: GOLD }}>{n('target_cups_month').toLocaleString()} แก้ว</span>
          </div>
          <input type="range" min={100} max={3000} step={50} value={n('target_cups_month', 500)}
            onChange={e => onChange({ ...settings, target_cups_month: e.target.value })}
            style={{ width: '100%', accentColor: GOLD, cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
            <span>100</span><span>3,000 แก้ว</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          {[
            { label: 'Overhead ต่อแก้ว', value: overheadPerCup, color: '#ff9f43' },
            { label: 'Packaging ต่อแก้ว', value: packagingPerCup, color: GOLD },
          ].map(item => (
            <div key={item.label} style={{ backgroundColor: CARD, borderRadius: 10, padding: '12px 14px', border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value.toLocaleString()} ₭</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px', backgroundColor: `${GOLD}12`, borderRadius: 12, border: `1px solid ${GOLD}33` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>ต้นทุน fixed ต่อแก้ว</span>
            <span style={{ fontSize: 26, fontWeight: 900, color: GOLD }}>{fixedPerCup.toLocaleString()} ₭</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>packaging {packagingPerCup.toLocaleString()} + overhead {overheadPerCup.toLocaleString()} ₭</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>+ ต้นทุนวัตถุดิบ (คำนวณในแท็บ ต้นทุนสูตร)</div>
          {totalOverhead > 0 && (
            <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: `${GOLD}18`, borderRadius: 8, fontSize: 13, color: GOLD, fontWeight: 600 }}>
              💡 ต้องขายอย่างน้อย {breakEvenCupsDay} แก้ว/วัน เพื่อคุ้มทุน overhead
            </div>
          )}
        </div>
      </div>
    </SettingSection>
  )
}

function SettingsTab() {
  const [settings, setSettings] = useState<FullSettings>({ ...DEFAULT_SETTINGS })
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  useEffect(() => {
    supabase.rpc('get_site_settings').then(({ data }) => {
      if (data) setSettings(s => ({ ...s, ...data }))
      setLoading(false)
    })
  }, [])

  async function saveAll() {
    setSaving(true); setSaved(false)
    await Promise.all(
      Object.entries(settings).map(([k, v]) =>
        supabase.rpc('update_site_setting', { p_key: k, p_value: String(v ?? '') })
      )
    )
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const set = (k: keyof FullSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setSettings(s => ({ ...s, [k]: e.target.value }))

  const toggle = (k: keyof FullSettings) => (v: boolean) =>
    setSettings(s => ({ ...s, [k]: v ? 'true' : 'false' }))

  const isOn = (k: keyof FullSettings) => settings[k] === 'true'

  // open_days as string[]
  let openDays: string[] = []
  try { openDays = JSON.parse(settings.open_days || '[]') } catch { openDays = [] }
  const toggleDay = (d: string) => {
    const next = openDays.includes(d) ? openDays.filter(x => x !== d) : [...openDays, d]
    setSettings(s => ({ ...s, open_days: JSON.stringify(next) }))
  }

  // payment_banks as PaymentBank[]
  let payBanks: PaymentBank[] = []
  try { payBanks = JSON.parse(settings.payment_banks || '[]') } catch { payBanks = [] }
  const updateBanks = (next: PaymentBank[]) =>
    setSettings(s => ({ ...s, payment_banks: JSON.stringify(next) }))

  if (loading) return <LoadingSpinner />

  return (
    <div style={{ maxWidth: 700 }}>

      {/* ── 1. ข้อมูลร้าน ── */}
      <SettingSection icon="🏪" title="ข้อมูลร้าน">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label="ชื่อร้าน EN"><input value={settings.shop_name}    onChange={set('shop_name')}    style={inputStyle} /></Field>
            <Field label="ชื่อร้าน TH"><input value={settings.shop_name_th} onChange={set('shop_name_th')} style={inputStyle} /></Field>
            <Field label="ชื่อร้าน LO"><input value={settings.shop_name_lo} onChange={set('shop_name_lo')} style={inputStyle} /></Field>
          </div>
          <Field label="ที่อยู่">
            <textarea value={settings.shop_address} onChange={set('shop_address')} style={{ ...inputStyle, height: 56, resize: 'vertical' as const }} placeholder="123 ถนน... เวียงจันทน์" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="เบอร์โทรศัพท์"><input value={settings.shop_phone} onChange={set('shop_phone')} style={inputStyle} placeholder="020-xxx-xxx" /></Field>
            <Field label="อีเมล"><input value={settings.shop_email} onChange={set('shop_email')} type="email" style={inputStyle} placeholder="cafe@example.com" /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label="Facebook"><input value={settings.shop_facebook}  onChange={set('shop_facebook')}  style={inputStyle} placeholder="AlanCoffeeTravel" /></Field>
            <Field label="Instagram"><input value={settings.shop_instagram} onChange={set('shop_instagram')} style={inputStyle} placeholder="@alancoffee" /></Field>
            <Field label="Line ID"><input value={settings.shop_line} onChange={set('shop_line')} style={inputStyle} placeholder="@alancoffee" /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 120px 1fr', gap: 10, alignItems: 'end' }}>
            <Field label="เวลาเปิด"><input type="time" value={settings.open_time}  onChange={set('open_time')}  style={inputStyle} /></Field>
            <Field label="เวลาปิด"> <input type="time" value={settings.close_time} onChange={set('close_time')} style={inputStyle} /></Field>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, letterSpacing: '1px', textTransform: 'uppercase' }}>วันที่เปิด</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {DAYS_OF_WEEK.map(d => {
                  const on = openDays.includes(d.key)
                  return (
                    <button key={d.key} type="button" onClick={() => toggleDay(d.key)} style={{
                      width: 36, height: 36, borderRadius: 8, border: `1px solid ${on ? GOLD : 'rgba(255,255,255,0.12)'}`,
                      backgroundColor: on ? GOLD + '22' : 'transparent',
                      color: on ? GOLD : 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: on ? 700 : 400, cursor: 'pointer',
                    }}>{d.label}</button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </SettingSection>

      {/* ── 2. การเงิน ── */}
      <SettingSection icon="💰" title="ตั้งค่าการเงิน">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="สกุลเงินหลัก">
              <select value={settings.currency_primary} onChange={set('currency_primary')} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="LAK">LAK — กีบลาว</option>
                <option value="THB">THB — บาทไทย</option>
                <option value="USD">USD — ดอลลาร์</option>
              </select>
            </Field>
            <Field label="สกุลเงินรอง">
              <select value={settings.currency_secondary} onChange={set('currency_secondary')} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">— ไม่มี —</option>
                <option value="LAK">LAK — กีบลาว</option>
                <option value="THB">THB — บาทไทย</option>
                <option value="USD">USD — ดอลลาร์</option>
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 140px', gap: 10 }}>
            <Field label="VAT (%)">
              <input value={settings.vat_percent} onChange={set('vat_percent')} type="number" min="0" max="100" step="0.1" style={inputStyle} placeholder="0 = ไม่มี VAT" />
            </Field>
            <Field label="Service Charge (%)">
              <input value={settings.service_charge_percent} onChange={set('service_charge_percent')} type="number" min="0" max="100" step="0.1" style={inputStyle} placeholder="0 = ไม่มี" />
            </Field>
          </div>
          <SettingsToggle
            value={isOn('receipt_auto_print')}
            onChange={toggle('receipt_auto_print')}
            label="พิมพ์ใบเสร็จอัตโนมัติ"
            sub="พิมพ์ทันทีหลังชำระเงิน"
          />
        </div>
      </SettingSection>

      {/* ── 3. จอ TV ── */}
      <SettingSection icon="📺" title="ตั้งค่าจอ TV / คิว">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Queue Display Mode">
            <select value={settings.queue_display_mode} onChange={set('queue_display_mode')} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="standard">Standard — แสดงคิวปกติ</option>
              <option value="compact">Compact — แสดงเยอะขึ้น</option>
              <option value="large">Large — ตัวใหญ่</option>
            </select>
          </Field>
          <Field label="Queue Ticker Text">
            <textarea value={settings.queue_ticker_text} onChange={set('queue_ticker_text')} rows={3} style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: 1.6 }} placeholder="ข้อความวิ่งในจอ TV คิว..." />
          </Field>
          <Field label="Main Ticker Text">
            <textarea value={settings.ticker_text} onChange={set('ticker_text')} rows={3} style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: 1.6 }} placeholder="ข้อความวิ่งหลัก..." />
          </Field>
        </div>
      </SettingSection>

      {/* ── 4. แจ้งเตือน ── */}
      <SettingSection icon="🔔" title="ตั้งค่าแจ้งเตือน (Line)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '10px 12px', backgroundColor: CARD2, borderRadius: 8, fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7 }}>
            ใช้ Line Notify Token จาก <span style={{ color: GOLD }}>notify-bot.line.me</span> เพื่อรับแจ้งเตือนใน Line
          </div>
          <div>
            <SettingsToggle
              value={isOn('low_stock_alert_enabled')}
              onChange={toggle('low_stock_alert_enabled')}
              label="แจ้งเตือนสต็อกใกล้หมด"
              sub="ส่ง Line เมื่อวัตถุดิบต่ำกว่า reorder point"
            />
            <div style={{ marginTop: 10 }}>
              <Field label="Line Token — สต็อก">
                <input value={settings.low_stock_alert_line_token} onChange={set('low_stock_alert_line_token')}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }} placeholder="xxxxxxxxxxxxxxxxxxxx" type="password" />
              </Field>
            </div>
          </div>
          <div>
            <SettingsToggle
              value={isOn('daily_report_enabled')}
              onChange={toggle('daily_report_enabled')}
              label="รายงานประจำวัน"
              sub="ส่งสรุปยอดขายทุกคืน 22:00"
            />
            <div style={{ marginTop: 10 }}>
              <Field label="Line Token — รายงาน">
                <input value={settings.daily_report_line_token} onChange={set('daily_report_line_token')}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }} placeholder="xxxxxxxxxxxxxxxxxxxx" type="password" />
              </Field>
            </div>
          </div>
        </div>
      </SettingSection>

      {/* ── 5. AI Analyst ── */}
      <SettingSection icon="🤖" title="AI Analyst">
        <SettingsToggle
          value={isOn('ai_analyst_enabled')}
          onChange={toggle('ai_analyst_enabled')}
          label="เปิดใช้งาน AI Analyst"
          sub="วิเคราะห์ยอดขาย, แนะนำเมนู, คาดการณ์สต็อก"
        />
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'วิเคราะห์ยอดขายรายวัน / รายสัปดาห์ / รายเดือน',
            'แนะนำเมนูที่ควรโปรโมทหรือปรับราคา',
            'คาดการณ์ปริมาณวัตถุดิบที่ต้องสั่ง',
            'ตรวจจับ anomaly ยอดขายผิดปกติ',
            'รายงาน margin ต่ำและแนะนำการปรับต้นทุน',
          ].map(feat => (
            <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: isOn('ai_analyst_enabled') ? 1 : 0.35 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: GOLD, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{feat}</span>
            </div>
          ))}
        </div>
        {isOn('ai_analyst_enabled') && (
          <div style={{ marginTop: 14, padding: '10px 14px', backgroundColor: GOLD + '12', border: `1px solid ${GOLD}22`, borderRadius: 8, fontSize: 11, color: GOLD }}>
            AI Analyst เปิดใช้งานแล้ว — ดูผลวิเคราะห์ได้ใน Tab Dashboard
          </div>
        )}
      </SettingSection>

      {/* ── 6. วิธีชำระเงิน ── */}
      <SettingSection icon="📍" title="ตำแหน่งร้าน (สำหรับตรวจสอบ GPS พนักงาน)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
            <Field label="Latitude">
              <input value={settings.shop_lat} onChange={set('shop_lat')} placeholder="18.7883" style={inputStyle} />
            </Field>
            <Field label="Longitude">
              <input value={settings.shop_lng} onChange={set('shop_lng')} placeholder="102.9979" style={inputStyle} />
            </Field>
            <button
              onClick={() => {
                if (!navigator.geolocation) return
                navigator.geolocation.getCurrentPosition(pos => {
                  setSettings(s => ({
                    ...s,
                    shop_lat: String(pos.coords.latitude),
                    shop_lng: String(pos.coords.longitude),
                  }))
                })
              }}
              style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${GOLD}44`,
                cursor: 'pointer', backgroundColor: `${GOLD}12`, color: GOLD, fontSize: 12,
                fontWeight: 600, whiteSpace: 'nowrap', marginBottom: 0 }}>
              📍 ตำแหน่งปัจจุบัน
            </button>
          </div>
          {settings.shop_lat && settings.shop_lng && (
            <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
              <iframe
                width="100%"
                height="200"
                frameBorder="0"
                style={{ display: 'block' }}
                src={`https://maps.google.com/maps?q=${settings.shop_lat},${settings.shop_lng}&z=16&output=embed`}
                allowFullScreen
              />
            </div>
          )}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
            พิกัดนี้จะใช้คำนวณระยะห่างเมื่อพนักงาน clock-in ถ้าห่างเกิน 200 เมตรจะแจ้งเตือน
          </div>
        </div>
      </SettingSection>

      <SettingSection icon="📱" title="QR Code ชำระเงิน (PromptPay / BCEL OnePay)">
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 12, lineHeight: 1.6 }}>
          เลขที่จะเข้ารหัสเป็น QR Code ให้ลูกค้าสแกนในหน้า POS — ใส่เบอร์โทร PromptPay หรือ BCEL Account Number
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="หมายเลขบัญชี / เบอร์ PromptPay"><input value={settings.qr_payment_number} onChange={set('qr_payment_number')} style={inputStyle} placeholder="0812345678 หรือ 0860123456789" /></Field>
          <Field label="ชื่อบัญชี"><input value={settings.qr_payment_name} onChange={set('qr_payment_name')} style={inputStyle} placeholder="ALAN COFFEE" /></Field>
        </div>
      </SettingSection>

      <SettingSection icon="💳" title="วิธีชำระเงิน / ธนาคารรับโอน">
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 12, lineHeight: 1.6 }}>
          ธนาคารที่เพิ่มจะแสดงเป็นปุ่มให้เลือกในหน้า POS เมื่อลูกค้าโอนเงิน
        </div>
        <PaymentBankEditor banks={payBanks} onUpdate={updateBanks} />
      </SettingSection>

      {/* ── 💰 ต้นทุนร้าน ── */}
      <CostManagementSection settings={settings} onChange={setSettings} />

      {/* ── Save button ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, marginBottom: 24 }}>
        <button onClick={saveAll} disabled={saving} style={{
          ...btnStyle(GOLD), fontSize: 14, padding: '12px 32px',
          boxShadow: `0 0 20px ${GOLD}22`,
        }}>
          {saving ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}
        </button>
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: GREEN, fontSize: 13, fontWeight: 600, animation: 'fadeIn .3s' }}>
            <span style={{ fontSize: 16 }}>✓</span> บันทึกแล้ว
          </div>
        )}
      </div>

      {/* ── Quick links ── */}
      <div style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ fontSize: 12, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>ลิงก์ด่วน</div>
        {[
          { href: '/pos',   label: 'หน้า POS',      sub: 'รับออเดอร์และชำระเงิน' },
          { href: '/queue', label: 'จอ TV คิว',     sub: 'แสดงคิวกำลังทำ / รับได้แล้ว' },
          { href: '/',      label: 'หน้าหลักเว็บ', sub: 'Alan Coffee & Travel' },
        ].map(link => (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: CARD2, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, textDecoration: 'none', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, color: GOLD, fontWeight: 600 }}>{link.label}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{link.sub}</div>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16 }}>→</span>
          </a>
        ))}
      </div>
    </div>
  )
}

// ─── Staff Tab → see components/cafe/StaffTab.tsx ─────────────────────────────

// ─── CustomersTab ─────────────────────────────────────────────────────────────

const ALLERGY_MAP: Record<string, string> = {
  นม: '🥛', กลูเตน: '🌾', ถั่ว: '🥜', ไข่: '🥚', ซีฟู้ด: '🦐',
}

const POINTS_RATE = 100  // points per redeem unit
const POINTS_VALUE = 5000 // LAK per redeem unit

function CustomersTab() {
  const [customers, setCustomers]   = useState<Customer[]>([])
  const [search,    setSearch]      = useState('')
  const [loading,   setLoading]     = useState(false)
  const [editId,    setEditId]      = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', nationality: '', language_pref: 'lo', allergies: [] as string[] })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [redeemCustomer, setRedeemCustomer] = useState<Customer | null>(null)
  const [redeemPts,      setRedeemPts]      = useState('')
  const [redeemMsg,      setRedeemMsg]      = useState('')
  const [redeeming,      setRedeeming]      = useState(false)
  const [redeemHistory,  setRedeemHistory]  = useState<{ name: string; pts: number; lak: number; time: string }[]>([])

  const load = useCallback(async (q = '') => {
    setLoading(true)
    try {
      const { data } = await supabase.rpc('get_customers', { p_search: q })
      setCustomers((data as Customer[]) ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load('') }, [load])

  async function doSearch() { await load(search) }

  function openNew() {
    setEditId('new')
    setForm({ name: '', phone: '', nationality: '', language_pref: 'lo', allergies: [] })
    setMsg('')
  }

  function openEdit(c: Customer) {
    setEditId(c.id)
    setForm({ name: c.name ?? '', phone: c.phone ?? '', nationality: c.nationality ?? '', language_pref: c.language_pref, allergies: c.allergies ?? [] })
    setMsg('')
  }

  async function save() {
    if (!form.phone) { setMsg('กรุณากรอกเบอร์โทร'); return }
    setSaving(true); setMsg('')
    try {
      const { error } = await supabase.rpc('upsert_customer', {
        p_phone: form.phone, p_name: form.name,
        p_nationality: form.nationality || null,
        p_language_pref: form.language_pref,
        p_allergies: form.allergies,
      })
      if (error) { setMsg(error.message); return }
      setEditId(null); await load(search)
    } finally { setSaving(false) }
  }

  function toggleAllergy(a: string) {
    setForm(f => ({
      ...f,
      allergies: f.allergies.includes(a) ? f.allergies.filter(x => x !== a) : [...f.allergies, a],
    }))
  }

  async function redeemSubmit() {
    if (!redeemCustomer) return
    const pts = parseInt(redeemPts)
    if (isNaN(pts) || pts <= 0) { setRedeemMsg('กรอกจำนวนคะแนนที่ถูกต้อง'); return }
    if (pts % POINTS_RATE !== 0) { setRedeemMsg(`คะแนนต้องเป็นทวีคูณของ ${POINTS_RATE}`); return }
    if (pts > redeemCustomer.loyalty_points) { setRedeemMsg('คะแนนไม่เพียงพอ'); return }
    setRedeeming(true); setRedeemMsg('')
    const newPts = redeemCustomer.loyalty_points - pts
    const lak    = (pts / POINTS_RATE) * POINTS_VALUE
    const { error } = await supabase.from('customers').update({ loyalty_points: newPts }).eq('id', redeemCustomer.id)
    if (error) { setRedeemMsg(error.message); setRedeeming(false); return }
    setRedeemHistory(h => [{ name: redeemCustomer.name ?? redeemCustomer.phone ?? '?', pts, lak, time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }, ...h])
    setRedeemCustomer(null); setRedeemPts('')
    await load(search)
    setRedeeming(false)
  }

  return (
    <div>
      {/* Search + Add */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && void doSearch()}
          placeholder="ค้นหาชื่อ / เบอร์โทร..." style={{ flex: 1, padding: '10px 14px', borderRadius: 9, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: '#fff', fontSize: 14 }} />
        <button onClick={() => void doSearch()} style={{ padding: '10px 20px', borderRadius: 9, border: `1px solid ${GOLD}44`, backgroundColor: `${GOLD}10`, color: GOLD, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>ค้นหา</button>
        <button onClick={openNew} style={{ padding: '10px 20px', borderRadius: 9, border: 'none', backgroundColor: GOLD, color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+ เพิ่มลูกค้า</button>
      </div>

      {/* Add / Edit Form */}
      {editId && (
        <div style={{ padding: 24, borderRadius: 14, border: `1px solid ${GOLD}44`, backgroundColor: CARD, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: GOLD }}>{editId === 'new' ? 'เพิ่มลูกค้าใหม่' : 'แก้ไขข้อมูลลูกค้า'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['name', 'ชื่อ'], ['phone', 'เบอร์โทร *'], ['nationality', 'สัญชาติ']].map(([key, lbl]) => (
              <div key={key}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{lbl}</div>
                <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}  // eslint-disable-line @typescript-eslint/no-explicit-any
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: '#0f0f0f', color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>ภาษา</div>
              <select value={form.language_pref} onChange={e => setForm(f => ({ ...f, language_pref: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: '#0f0f0f', color: '#fff', fontSize: 14 }}>
                <option value="lo">ลาว</option>
                <option value="th">ไทย</option>
                <option value="en">English</option>
                <option value="zh">中文</option>
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>แพ้อาหาร</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(ALLERGY_MAP).map(([k, emoji]) => {
                const on = form.allergies.includes(k)
                return (
                  <button key={k} onClick={() => toggleAllergy(k)}
                    style={{ padding: '5px 12px', borderRadius: 99, border: `1px solid ${on ? ORANGE : BORDER}`, backgroundColor: on ? `${ORANGE}18` : 'transparent', color: on ? ORANGE : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}>
                    {emoji} {k}
                  </button>
                )
              })}
            </div>
          </div>
          {msg && <div style={{ color: RED, fontSize: 13 }}>{msg}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => void save()} disabled={saving} style={{ padding: '10px 24px', borderRadius: 9, border: 'none', backgroundColor: GOLD, color: '#000', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button onClick={() => setEditId(null)} style={{ padding: '10px 20px', borderRadius: 9, border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* Redemption Modal */}
      {redeemCustomer && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}
          onClick={e => { if (e.target === e.currentTarget) { setRedeemCustomer(null); setRedeemPts('') } }}>
          <div style={{ width: 380, padding: 28, borderRadius: 18, backgroundColor: '#141414', border: `1px solid ${GOLD}44`, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: GOLD }}>แลกคะแนน</div>
            <div style={{ padding: '14px 16px', borderRadius: 12, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{redeemCustomer.name ?? redeemCustomer.phone}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{redeemCustomer.loyalty_points} <span style={{ fontSize: 14, fontWeight: 500 }}>pts</span></div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                อัตราแลก: {POINTS_RATE} pts = {POINTS_VALUE.toLocaleString()} ₭
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>จำนวนคะแนนที่ต้องการแลก (ทวีคูณของ {POINTS_RATE})</div>
              <input type="number" value={redeemPts} onChange={e => setRedeemPts(e.target.value)}
                step={POINTS_RATE} min={POINTS_RATE} max={redeemCustomer.loyalty_points}
                placeholder={String(POINTS_RATE)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 9, border: `1px solid ${GOLD}44`, backgroundColor: '#0f0f0f', color: '#fff', fontSize: 16, fontWeight: 700, boxSizing: 'border-box' }} />
              {redeemPts && parseInt(redeemPts) > 0 && parseInt(redeemPts) % POINTS_RATE === 0 && (
                <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, backgroundColor: `${GREEN}10`, border: `1px solid ${GREEN}33`, fontSize: 13, color: GREEN, fontWeight: 600 }}>
                  ส่วนลด: {((parseInt(redeemPts) / POINTS_RATE) * POINTS_VALUE).toLocaleString()} ₭
                  · คงเหลือ: {redeemCustomer.loyalty_points - parseInt(redeemPts)} pts
                </div>
              )}
            </div>
            {redeemMsg && <div style={{ color: RED, fontSize: 13 }}>{redeemMsg}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => void redeemSubmit()} disabled={redeeming} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', backgroundColor: GREEN, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: redeeming ? 0.6 : 1 }}>
                {redeeming ? 'กำลังดำเนินการ...' : 'ยืนยันการแลก'}
              </button>
              <button onClick={() => { setRedeemCustomer(null); setRedeemPts('') }} style={{ padding: '11px 20px', borderRadius: 9, border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 13 }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Session redemption history */}
      {redeemHistory.length > 0 && (
        <div style={{ padding: '14px 18px', borderRadius: 12, backgroundColor: `${GREEN}08`, border: `1px solid ${GREEN}22`, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: GREEN, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>ประวัติแลกคะแนน (session นี้)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {redeemHistory.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                <span>{r.time} · {r.name}</span>
                <span style={{ color: GREEN, fontWeight: 600 }}>-{r.pts} pts → +{r.lak.toLocaleString()} ₭</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: 70, borderRadius: 12, backgroundColor: CARD, animation: 'pulse 1.5s infinite' }} />)}
        </div>
      ) : customers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.25)' }}>ไม่พบลูกค้า</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {customers.map(c => (
            <div key={c.id} style={{ padding: '14px 18px', borderRadius: 12, backgroundColor: CARD, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: `${GOLD}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: GOLD, flexShrink: 0 }}>
                {(c.name ?? '?')[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name ?? '—'} <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{c.phone}</span></div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {(c.allergies ?? []).map(a => (
                    <span key={a} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 99, border: `1px solid ${ORANGE}44`, color: ORANGE, backgroundColor: `${ORANGE}10` }}>
                      {ALLERGY_MAP[a] ?? ''} {a}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: GOLD }}>{c.loyalty_points} pts</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{c.visit_count} ครั้ง · {(c.lifetime_spend_lak ?? 0).toLocaleString()} ₭</div>
              </div>
              <button onClick={() => { setRedeemCustomer(c); setRedeemPts(''); setRedeemMsg('') }}
                disabled={c.loyalty_points < POINTS_RATE}
                style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${c.loyalty_points >= POINTS_RATE ? GREEN + '66' : BORDER}`, backgroundColor: c.loyalty_points >= POINTS_RATE ? `${GREEN}12` : 'transparent', color: c.loyalty_points >= POINTS_RATE ? GREEN : 'rgba(255,255,255,0.2)', cursor: c.loyalty_points >= POINTS_RATE ? 'pointer' : 'default', fontSize: 11, fontWeight: 600 }}>แลกคะแนน</button>
              <button onClick={() => openEdit(c)} style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}>แก้ไข</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── PurchaseTab ──────────────────────────────────────────────────────────────

function PurchaseTab() {
  const [sub,      setSub]      = useState<'pending' | 'history'>('pending')
  const [pending,  setPending]  = useState<PurchaseEntry[]>([])
  const [history,  setHistory]  = useState<PurchaseEntry[]>([])
  const [loading,  setLoading]  = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)

  const loadPending = useCallback(async () => {
    const { data } = await supabase.rpc('get_pending_purchases')
    setPending((data as PurchaseEntry[]) ?? [])
  }, [])
  const loadHistory = useCallback(async () => {
    const { data } = await supabase.rpc('get_all_purchases', { p_limit: 60 })
    setHistory((data as PurchaseEntry[]) ?? [])
  }, [])

  useEffect(() => {
    setLoading(true)
    void Promise.all([loadPending(), loadHistory()]).finally(() => setLoading(false))
  }, [loadPending, loadHistory])

  async function act(id: string, approve: boolean) {
    setActingId(id)
    await supabase.rpc('approve_purchase', { p_purchase_id: id, p_approve: approve })
    await Promise.all([loadPending(), loadHistory()])
    setActingId(null)
  }

  function StatusBadge({ status, flag }: { status: string; flag: string | null }) {
    const map: Record<string, [string, string]> = {
      pending:  [GOLD,   'รออนุมัติ'],
      flagged:  [ORANGE, '⚠ ตั้งข้อสังเกต'],
      approved: [GREEN,  '✓ อนุมัติ'],
      rejected: [RED,    '✗ ปฏิเสธ'],
    }
    const [color, label] = map[status] ?? ['#888', status]
    return (
      <div>
        <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 99, border: `1px solid ${color}44`, color, backgroundColor: `${color}10` }}>{label}</span>
        {flag && <div style={{ fontSize: 11, color: ORANGE, marginTop: 4 }}>{flag}</div>}
      </div>
    )
  }

  const subs = [{ id: 'pending' as const, label: 'รออนุมัติ' }, { id: 'history' as const, label: 'ประวัติ' }]
  const rows = sub === 'pending' ? pending : history

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: `1px solid ${BORDER}` }}>
        {subs.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)}
            style={{ padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
              color: sub === s.id ? GOLD : 'rgba(255,255,255,0.4)', fontWeight: sub === s.id ? 600 : 400,
              borderBottom: sub === s.id ? `2px solid ${GOLD}` : '2px solid transparent', marginBottom: -1 }}>
            {s.label} {s.id === 'pending' && pending.length > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, backgroundColor: ORANGE, color: '#000', marginLeft: 4 }}>{pending.length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 80, borderRadius: 12, backgroundColor: CARD, animation: 'pulse 1.5s infinite' }} />)}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.25)' }}>ไม่มีรายการ</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(p => (
            <div key={p.id} style={{ padding: '16px 18px', borderRadius: 12, backgroundColor: CARD, border: `1px solid ${p.status === 'flagged' ? ORANGE + '66' : BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.inventory_name ?? '—'} <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>({p.unit})</span></div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    {p.qty_purchased} {p.unit} × {p.unit_price_lak?.toLocaleString()} LAK
                    {p.market_price_lak ? ` | ราคาตลาด ${p.market_price_lak?.toLocaleString()}` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                    โดย {p.staff_name ?? '—'} — {new Date(p.created_at).toLocaleDateString('th-TH')}
                    {p.supplier && ` | ${p.supplier}`}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <StatusBadge status={p.status} flag={p.flag_reason} />
                  {(p.status === 'pending' || p.status === 'flagged') && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => void act(p.id, true)} disabled={actingId === p.id}
                        style={{ padding: '5px 14px', borderRadius: 7, border: 'none', backgroundColor: GREEN, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: actingId === p.id ? 0.5 : 1 }}>อนุมัติ</button>
                      <button onClick={() => void act(p.id, false)} disabled={actingId === p.id}
                        style={{ padding: '5px 14px', borderRadius: 7, border: `1px solid ${RED}44`, backgroundColor: `${RED}10`, color: RED, cursor: 'pointer', fontSize: 12 }}>ปฏิเสธ</button>
                    </div>
                  )}
                  {(p.receipt_url || p.weigh_image_url) && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {p.receipt_url && <a href={p.receipt_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: GOLD }}>ใบเสร็จ ↗</a>}
                      {p.weigh_image_url && <a href={p.weigh_image_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: GOLD }}>รูปชั่ง ↗</a>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Finance Tab → see components/cafe/FinanceTab.tsx ──────────────────────────

// ─── Main Layout ──────────────────────────────────────────────────────────────

// ─── AI Tab ───────────────────────────────────────────────────────────────────

// Markdown inline renderer — bold (**text**) support
function renderInlineMd(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} style={{ fontWeight: 700, color: '#fff' }}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

// Block-level markdown renderer — headers, bullets, numbered lists
function renderMdContent(text: string) {
  return text.split('\n').map((line, i) => {
    const num = line.match(/^(\d+)\.\s(.+)$/)
    if (num) return (
      <div key={i} style={{ display: 'flex', gap: 8, marginLeft: 4, marginBottom: 2 }}>
        <span style={{ color: GOLD, minWidth: 22, flexShrink: 0 }}>{num[1]}.</span>
        <span>{renderInlineMd(num[2])}</span>
      </div>
    )
    if (line.startsWith('- ') || line.startsWith('* ')) return (
      <div key={i} style={{ display: 'flex', gap: 8, marginLeft: 4, marginBottom: 2 }}>
        <span style={{ color: GOLD, flexShrink: 0 }}>•</span>
        <span>{renderInlineMd(line.slice(2))}</span>
      </div>
    )
    if (line.startsWith('### ')) return (
      <div key={i} style={{ fontWeight: 700, color: GOLD, marginTop: 10, marginBottom: 4, fontSize: 13 }}>
        {renderInlineMd(line.slice(4))}
      </div>
    )
    if (line.startsWith('## ')) return (
      <div key={i} style={{ fontWeight: 700, color: GOLD, marginTop: 12, marginBottom: 5, fontSize: 14 }}>
        {renderInlineMd(line.slice(3))}
      </div>
    )
    if (line.trim() === '') return <div key={i} style={{ height: 5 }} />
    return <div key={i} style={{ marginBottom: 1 }}>{renderInlineMd(line)}</div>
  })
}

function AITab() {
  type Msg = { role: 'user' | 'assistant'; content: string; ts: number }
  const [messages,   setMessages]   = useState<Msg[]>([])
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [context,    setContext]    = useState('')
  const [ctxLoading, setCtxLoading] = useState(true)
  const [copied,     setCopied]     = useState<number | null>(null)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const briefingSent = useRef(false)

  const PRESETS = [
    '🔥 วิเคราะห์ภาพรวมวันนี้',
    '📉 อะไรที่ต้องแก้ไขด่วน?',
    '💰 จะเพิ่มรายได้ยังไง?',
    '🛒 สั่งซื้อวัตถุดิบอะไรดี?',
    '👥 ทีมงานเป็นยังไงบ้าง?',
    '📅 วางแผนสัปดาห์หน้า',
  ]

  useEffect(() => {
    async function loadCtx() {
      const now     = new Date()
      const today   = now.toLocaleDateString('en-CA',  { timeZone: 'Asia/Vientiane' })
      const timeStr = now.toLocaleTimeString('th-TH',  { timeZone: 'Asia/Vientiane', hour: '2-digit', minute: '2-digit' })
      const dayName = now.toLocaleDateString('th-TH',  { timeZone: 'Asia/Vientiane', weekday: 'long' })
      const dow     = now.toLocaleDateString('en-US',  { timeZone: 'Asia/Vientiane', weekday: 'short' })
      const isWeekend = dow === 'Sat' || dow === 'Sun'

      const [sRes, mRes, sdRes, stRes, saRes, cfRes, qRes] = await Promise.all([
        supabase.rpc('get_dashboard_stats'),
        supabase.rpc('get_menu_performance', { p_days: 30 }),
        supabase.rpc('get_stock_detail'),
        supabase.rpc('get_staff_today_status'),
        supabase.rpc('get_staff_analytics'),
        supabase.rpc('get_cashflow_summary', { p_days: 30 }),
        supabase.rpc('get_queue_performance', { p_days: 1 }),
      ])

      const stats      = sRes.data  as ExtDashStats   | null
      const menu       = (mRes.data as MenuPerf[]    ) ?? []
      const stock      = (sdRes.data as StockDetail[] ) ?? []
      const staffToday = (stRes.data as StaffToday[]  ) ?? []
      const staffAna   = (saRes.data as StaffAnalytics[]) ?? []
      const cashflow   = (cfRes.data as CashflowRow[] ) ?? []
      const queue      = qRes.data  as QueuePerf      | null

      const todaySales     = stats?.today_sales     ?? 0
      const yesterdaySales = stats?.yesterday_sales ?? 0
      const vsYesterday    = yesterdaySales > 0
        ? ((todaySales - yesterdaySales) / yesterdaySales * 100).toFixed(1)
        : 'N/A'
      const profitPct = todaySales > 0
        ? ((stats?.today_profit ?? 0) / todaySales * 100).toFixed(1)
        : '0'

      const top10      = menu.slice(0, 10)
      const bottom5    = [...menu].reverse().slice(0, 5)
      const lowStock   = stock.filter(s => s.reorder_point != null && s.current_qty <= s.reorder_point)
      const presentStaff = staffToday.filter(s => s.clock_in)
      const lateStaff    = staffToday.filter(s => s.late_minutes && s.late_minutes > 0)
      const topPerformer = [...staffAna].sort((a, b) => b.orders_served - a.orders_served)[0]
      const revenue30    = cashflow.reduce((sum, r) => sum + (r.system_sales ?? 0), 0)

      const lines = [
        `=== ALAN CAFE — BUSINESS INTELLIGENCE REPORT ===`,
        `วันที่: ${today} (${dayName})${isWeekend ? ' [วันหยุดสุดสัปดาห์]' : ' [วันธรรมดา]'}`,
        `เวลา: ${timeStr} ICT (Vientiane)`,
        ``,
        `=== ยอดขายวันนี้ ===`,
        `ยอดขาย: ${todaySales.toLocaleString()} LAK`,
        `เมื่อวาน: ${yesterdaySales.toLocaleString()} LAK (เปลี่ยนแปลง: ${vsYesterday}%)`,
        `Orders: ${stats?.today_orders ?? 0} รายการ | Items: ${stats?.today_items ?? 0}`,
        `กำไรขั้นต้น: ${(stats?.today_profit ?? 0).toLocaleString()} LAK (${profitPct}%)`,
        ``,
        `=== เมนูขายดีสุด 30 วัน — Top 10 ===`,
        ...top10.map((m, i) =>
          `${i + 1}. ${m.product_name}: ${m.total_qty}แก้ว | ${m.total_sales.toLocaleString()}LAK | Margin ${m.margin_pct?.toFixed(1) ?? 'N/A'}%`
        ),
        ``,
        `=== เมนูขายน้อย — Bottom 5 (ผู้สมัครถูกตัดออก) ===`,
        ...bottom5.map((m, i) =>
          `${i + 1}. ${m.product_name}: ${m.total_qty}แก้ว | ${m.total_sales.toLocaleString()}LAK | Margin ${m.margin_pct?.toFixed(1) ?? 'N/A'}%`
        ),
        ``,
        `=== สต็อกวิกฤต (ต่ำกว่า Reorder Point) ===`,
        lowStock.length > 0
          ? lowStock.map(s =>
              `- ${s.name}: ${s.current_qty}${s.unit} / reorder:${s.reorder_point} | หมดใน ~${s.days_until_empty ?? '?'} วัน | ซัพพลายเออร์: ${s.supplier ?? 'ไม่มี'}`
            ).join('\n')
          : 'สต็อกทุกรายการอยู่ในระดับปกติ',
        ``,
        `=== พนักงานวันนี้ ===`,
        `เข้างาน: ${presentStaff.length} / ${staffToday.length} คน`,
        lateStaff.length > 0
          ? `มาสาย: ${lateStaff.map(s => `${s.name_th ?? s.name} (${s.late_minutes}นาที)`).join(', ')}`
          : 'ไม่มีพนักงานมาสาย',
        topPerformer
          ? `Top performer 30วัน: ${topPerformer.name_th ?? topPerformer.name} — ${topPerformer.orders_served} orders, ${topPerformer.punctuality_pct?.toFixed(0)}% punctuality`
          : '',
        ``,
        `=== คิว ===`,
        queue
          ? `Peak hour: ${queue.peak_hour}:00 | Orders/ชั่วโมง: ${queue.orders_per_hour?.toFixed(1)}`
          : 'ไม่มีข้อมูลคิววันนี้',
        ``,
        `=== Finance 30 วัน ===`,
        `รายได้รวม 30วัน: ${revenue30.toLocaleString()} LAK`,
        `รายได้เฉลี่ย/วัน: ${Math.round(revenue30 / 30).toLocaleString()} LAK`,
      ]

      setContext(lines.filter(l => l !== undefined).join('\n'))
      setCtxLoading(false)
    }
    void loadCtx()
  }, [])

  // Proactive morning briefing — fires once after context loads
  useEffect(() => {
    if (!ctxLoading && !briefingSent.current) {
      briefingSent.current = true
      void ask('สวัสดีครับ! ช่วยสรุปสถานการณ์ Alan Cafe วันนี้แบบครบถ้วน — ยอดขาย สต็อกวิกฤต และ 3 สิ่งที่ต้องทำด่วนวันนี้')
    }
  }, [ctxLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function ask(question: string) {
    if (!question.trim() || loading) return
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(m => [...m, { role: 'user', content: question, ts: Date.now() }])
    setInput('')
    setLoading(true)

    const systemInstruction = `You are "Alan" — a world-class F&B business consultant with 20 years of hands-on experience in Southeast Asian café markets. You are the embedded AI intelligence inside Alan Cafe's proprietary Cafe OS in Vientiane, Laos.

About Alan Cafe:
- Specialty coffee shop in Vientiane, Laos serving coffee, drinks, and food
- Runs a custom Cafe OS with POS, inventory, staff, CRM, and finance modules
- Customers are a mix of local Lao people and expats

Your communication style:
- Always structure responses as: 📊 สรุปข้อมูล → 💡 ข้อค้นพบสำคัญ → ✅ แผนปฏิบัติ (numbered, prioritized by urgency)
- Speak Thai by default. Switch to Lao if user writes Lao. Switch to English if user writes English.
- ALWAYS reference specific menu item names, real staff names, and actual numbers — never give generic advice
- Benchmark against F&B industry standards: food cost 20-28%, beverage margin 65-75%, labor 25-30%, net profit 10-15%
- Think proactively: identify declining trends BEFORE they become problems
- For low stock: state urgency level (🔴 Critical / 🟡 Warning) and days until stockout
- Keep responses concise but complete. Use **bold** for key numbers and bullet points for lists.

Current real-time business data:
${context}`

    try {
      const contents = [
        ...history
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        { role: 'user', parts: [{ text: question }] },
      ]
      const res = await fetch(AI_ANALYST_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ messages: contents, context: systemInstruction }),
      })
      const json = await res.json()
      const answer = json?.text ?? JSON.stringify(json?.error ?? json)
      setMessages(m => [...m, { role: 'assistant', content: answer, ts: Date.now() }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'ไม่สามารถเชื่อมต่อ Alan AI ได้ กรุณาลองใหม่', ts: Date.now() }])
    }
    setLoading(false)
  }

  function copyMsg(content: string, idx: number) {
    navigator.clipboard.writeText(content).catch(() => null)
    setCopied(idx)
    setTimeout(() => setCopied(null), 1500)
  }

  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', gap: 14 }}>

      {/* Status + clear bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderRadius: 9, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: ctxLoading ? ORANGE : GREEN, flexShrink: 0, boxShadow: `0 0 5px ${ctxLoading ? ORANGE : GREEN}` }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {ctxLoading ? 'กำลังโหลดข้อมูลธุรกิจ...' : 'Alan AI พร้อม — ข้อมูล real-time 7 แหล่งโหลดแล้ว'}
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); briefingSent.current = false }}
            style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px' }}
          >
            ล้างประวัติ ✕
          </button>
        )}
      </div>

      {/* Preset smart questions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PRESETS.map(p => (
          <button
            key={p}
            onClick={() => void ask(p)}
            disabled={loading || ctxLoading}
            style={{
              padding: '7px 13px', borderRadius: 99, border: `1px solid ${GOLD}44`,
              backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 12, fontWeight: 600,
              cursor: loading || ctxLoading ? 'not-allowed' : 'pointer',
              opacity: ctxLoading ? 0.5 : 1, transition: 'opacity .15s',
            }}
          >{p}</button>
        ))}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            {/* Avatar */}
            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, backgroundColor: m.role === 'user' ? `${GOLD}22` : '#1a1a1a', border: `1px solid ${m.role === 'user' ? GOLD + '66' : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
              {m.role === 'user' ? '👤' : '🤖'}
            </div>
            {/* Bubble column */}
            <div style={{ maxWidth: '78%' }}>
              {/* Name + timestamp */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: m.role === 'user' ? GOLD : 'rgba(255,255,255,0.5)' }}>
                  {m.role === 'user' ? 'คุณ' : 'Alan AI'}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>{fmtTime(m.ts)}</span>
              </div>
              {/* Bubble */}
              <div style={{ padding: '11px 15px', borderRadius: m.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px', backgroundColor: m.role === 'user' ? `${GOLD}14` : CARD, border: `1px solid ${m.role === 'user' ? GOLD + '33' : BORDER}`, fontSize: 13, lineHeight: 1.8, color: m.role === 'user' ? GOLD : 'rgba(255,255,255,0.85)' }}>
                {m.role === 'assistant' ? renderMdContent(m.content) : m.content}
              </div>
              {/* Copy button — assistant only */}
              {m.role === 'assistant' && (
                <button
                  onClick={() => copyMsg(m.content, i)}
                  style={{ marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                >
                  {copied === i ? '✓ คัดลอกแล้ว' : '📋 คัดลอก'}
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: '#1a1a1a', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🤖</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Alan AI</div>
              <div style={{ padding: '12px 16px', borderRadius: '4px 14px 14px 14px', backgroundColor: CARD, border: `1px solid ${BORDER}`, display: 'flex', gap: 6, alignItems: 'center' }}>
                {[0, 1, 2].map(j => (
                  <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: GOLD, animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite` }} />
                ))}
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>Alan กำลังคิด...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(input) } }}
          placeholder={ctxLoading ? 'กำลังโหลดข้อมูลธุรกิจ...' : 'ถาม Alan เกี่ยวกับธุรกิจร้านคุณ...'}
          disabled={loading || ctxLoading}
          style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: `1px solid ${GOLD}44`, backgroundColor: CARD, color: '#fff', fontSize: 14, outline: 'none' }}
        />
        <button
          onClick={() => void ask(input)}
          disabled={loading || !input.trim() || ctxLoading}
          style={{ padding: '12px 22px', borderRadius: 10, border: 'none', backgroundColor: GOLD, color: '#000', fontWeight: 700, fontSize: 14, cursor: loading || !input.trim() || ctxLoading ? 'not-allowed' : 'pointer', opacity: loading || !input.trim() || ctxLoading ? 0.6 : 1 }}
        >
          ถาม
        </button>
      </div>
    </div>
  )
}
// ─── Audit Tab ─────────────────────────────────────────────────────────────────

function AuditTab() {
  const [logs,         setLogs]         = useState<AuditLog[]>([])
  const [loading,      setLoading]      = useState(true)
  const [dateFilter,   setDateFilter]   = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [noTable,      setNoTable]      = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300)
      if ((error as { code?: string } | null)?.code === '42P01') { setNoTable(true); setLoading(false); return }
      setLogs((data as AuditLog[]) ?? [])
      setLoading(false)
    }
    void load()
  }, [])

  const filtered = logs.filter(l => {
    if (actionFilter !== 'all' && l.action !== actionFilter) return false
    if (dateFilter && !l.created_at.startsWith(dateFilter)) return false
    return true
  })

  const actionColor = (a: string) =>
    a === 'insert' || a === 'insert_many' ? GREEN
    : a === 'update' || a === 'upsert'    ? GOLD
    : a === 'delete' || a === 'delete_match' ? RED
    : 'rgba(255,255,255,0.4)'

  if (noTable) return (
    <div style={{ padding: '60px 0', textAlign: 'center', color: 'rgba(255,255,255,0.35)' }}>
      <div style={{ fontSize: 36, marginBottom: 14 }}>🔍</div>
      <div style={{ fontSize: 15, marginBottom: 8 }}>ยังไม่มีตาราง audit_logs</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
        CREATE TABLE audit_logs (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, created_at timestamptz DEFAULT now(), action text, table_name text, record_id text, payload jsonb);
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: '#fff', fontSize: 13 }} />
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: CARD, color: '#fff', fontSize: 13, cursor: 'pointer' }}>
          <option value="all">ทุก Action</option>
          {['insert', 'update', 'delete', 'upsert', 'insert_many', 'delete_match'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {(dateFilter || actionFilter !== 'all') && (
          <button onClick={() => { setDateFilter(''); setActionFilter('all') }}
            style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}>
            ล้าง
          </button>
        )}
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>{filtered.length} รายการ</span>
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)' }}>ไม่พบรายการ</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['เวลา', 'Action', 'ตาราง', 'Record ID', 'Payload'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.4)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Vientiane', dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: actionColor(log.action), backgroundColor: actionColor(log.action) + '18' }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.65)' }}>{log.table_name}</td>
                  <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: 11 }}>{log.record_id ? log.record_id.slice(0, 8) + '…' : '—'}</td>
                  <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.28)', fontFamily: 'monospace', fontSize: 11, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(log.payload)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// (LeavesView extracted to components/cafe/StaffTab.tsx)

// ─── Recipe Cost Tab → see components/cafe/RecipeCostTab.tsx ───────────────────

// ─── Nav + Main Layout ─────────────────────────────────────────────────────────

type NavGroup = { label: string; items: { id: Tab; label: string; icon: string }[] }

const NAV_GROUPS: NavGroup[] = [
  { label: 'ภาพรวม', items: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  ]},
  { label: 'เมนูและสูตร', items: [
    { id: 'menu',        label: 'เมนู',        icon: '🍽️' },
    { id: 'categories',  label: 'หมวดหมู่',    icon: '🗂️' },
    { id: 'recipe-cost', label: 'ต้นทุนสูตร',  icon: '🧮' },
  ]},
  { label: 'คลังสินค้า', items: [
    { id: 'stock',    label: 'สต็อก',  icon: '📦' },
    { id: 'purchase', label: 'การซื้อ', icon: '🧾' },
  ]},
  { label: 'ทีมงาน', items: [
    { id: 'staff',    label: 'พนักงาน',  icon: '👥' },
    { id: 'schedule', label: 'ตารางงาน', icon: '📅' },
  ]},
  { label: 'ลูกค้าและการเงิน', items: [
    { id: 'customers', label: 'ลูกค้า',  icon: '🧑‍🤝‍🧑' },
    { id: 'finance',   label: 'การเงิน', icon: '💰' },
  ]},
  { label: 'ระบบ', items: [
    { id: 'settings', label: 'ตั้งค่า',    icon: '⚙️' },
    { id: 'ai',       label: 'AI Analyst', icon: '✨' },
    { id: 'audit',    label: 'Audit Log',  icon: '🔍' },
  ]},
]

// Flat list for lookup
const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items)

export default function CafeClient() {
  const [tab,     setTab]     = useState<Tab>('dashboard')
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>(['dashboard']))

  function switchTab(t: Tab) {
    setTab(t)
    setVisited(prev => { const next = new Set(prev); next.add(t); return next })
  }

  function tabWrap(id: Tab, node: React.ReactNode) {
    if (!visited.has(id)) return null
    return <div style={{ display: tab === id ? undefined : 'none' }}>{node}</div>
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: BLACK, color: '#fff', fontFamily: 'var(--font-body, Inter, sans-serif)' }}>
      {/* ── Sidebar ── */}
      <div style={{ width: 220, flexShrink: 0, backgroundColor: DARK, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', padding: '32px 0' }}>
        <div style={{ padding: '0 24px 32px' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: '-0.5px' }}>ALAN</div>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: '4px', textTransform: 'uppercase' }}>CAFE OS</div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '0 12px', overflowY: 'auto' }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div style={{ height: 1, backgroundColor: `${GOLD}20`, margin: '6px 2px 4px' }} />}
              <div style={{ fontSize: 9, color: `${GOLD}66`, textTransform: 'uppercase', letterSpacing: '1.5px', padding: '6px 14px 2px', fontWeight: 600, userSelect: 'none' }}>
                {group.label}
              </div>
              {group.items.map(item => (
                <button key={item.id} onClick={() => switchTab(item.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  backgroundColor: tab === item.id ? `${GOLD}18` : 'transparent',
                  color: tab === item.id ? GOLD : 'rgba(255,255,255,0.42)',
                  fontSize: 13, fontWeight: tab === item.id ? 600 : 400,
                  textAlign: 'left', transition: 'all .15s', width: '100%',
                }}>
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href="/pos"   style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', textDecoration: 'none' }}>→ POS</a>
          <a href="/queue" style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', textDecoration: 'none' }}>→ จอ TV</a>
          <a href="/"      style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', textDecoration: 'none' }}>→ หน้าหลัก</a>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 40px' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{NAV_ITEMS.find(n => n.id === tab)?.label}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', marginTop: 6 }}>Alan Cafe OS — Admin</div>
        </div>
        {tabWrap('dashboard',   <DashboardTab />)}
        {tabWrap('menu',        <Suspense fallback={<LoadingSpinner />}><LazyMenuTab /></Suspense>)}
        {tabWrap('categories',  <CategoriesTab />)}
        {tabWrap('stock',       <Suspense fallback={<LoadingSpinner />}><LazyStockTab /></Suspense>)}
        {tabWrap('settings',    <SettingsTab />)}
        {tabWrap('staff',       <Suspense fallback={<LoadingSpinner />}><LazyStaffTab /></Suspense>)}
        {tabWrap('schedule',    <Suspense fallback={<LoadingSpinner />}><LazyScheduleTab /></Suspense>)}
        {tabWrap('customers',   <CustomersTab />)}
        {tabWrap('purchase',    <PurchaseTab />)}
        {tabWrap('finance',     <Suspense fallback={<LoadingSpinner />}><LazyFinanceTab /></Suspense>)}
        {tabWrap('ai',          <AITab />)}
        {tabWrap('audit',       <AuditTab />)}
        {tabWrap('recipe-cost', <Suspense fallback={<LoadingSpinner />}><LazyRecipeCostTab /></Suspense>)}
      </div>
    </div>
  )
}
