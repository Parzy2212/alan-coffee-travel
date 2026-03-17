'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { getFaceApi } from '@/lib/faceapi'
import { MoneyInput } from '@/components/MoneyInput'

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

type Tab = 'dashboard' | 'menu' | 'categories' | 'stock' | 'settings' | 'staff' | 'customers' | 'purchase' | 'finance' | 'ai' | 'audit' | 'recipe-cost'

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

// ─── Menu Tab ─────────────────────────────────────────────────────────────────

function AllergenToggle({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (a: string) => onChange(selected.includes(a) ? selected.filter(x => x !== a) : [...selected, a])
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {ALLERGENS.map(a => {
        const on = selected.includes(a)
        return (
          <button key={a} onClick={() => toggle(a)} type="button" style={{
            padding: '3px 10px', borderRadius: 20, border: `1px solid ${on ? ORANGE : 'rgba(255,255,255,0.12)'}`,
            backgroundColor: on ? ORANGE + '22' : 'transparent',
            color: on ? ORANGE : 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer',
          }}>{a}</button>
        )
      })}
    </div>
  )
}

function RecipeFullForm({ data, onChange, categories, saving, onSave, onCancel, title }: {
  data: RecipeFullEdit; onChange: (d: RecipeFullEdit) => void; categories: Category[]
  saving: boolean; onSave: () => void; onCancel: () => void; title: string
}) {
  const [uploading, setUploading] = useState(false)
  const set = (k: keyof RecipeFullEdit) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [k]: e.target.value })
  const setMoney = (k: keyof RecipeFullEdit) => (v: string) => onChange({ ...data, [k]: v })
  const taStyle: React.CSSProperties = { ...inputStyle, height: 60, resize: 'vertical' as const }
  return (
    <div style={{ padding: 20, backgroundColor: '#0d0d0d', border: `1px solid ${GOLD}33`, borderRadius: 12 }}>
      <div style={{ fontSize: 12, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 16 }}>{title}</div>

      {/* Names */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Field label="ชื่อ EN *"><input value={data.product_name} onChange={set('product_name')} style={inputStyle} placeholder="Espresso" /></Field>
        <Field label="ชื่อ TH"><input value={data.product_name_th} onChange={set('product_name_th')} style={inputStyle} placeholder="เอสเพรสโซ่" /></Field>
        <Field label="ชื่อ LO"><input value={data.product_name_lo} onChange={set('product_name_lo')} style={inputStyle} placeholder="ເອສເປຣັສໂຊ" /></Field>
      </div>

      {/* Descriptions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Field label="คำอธิบาย EN"><textarea value={data.description_en} onChange={set('description_en')} style={taStyle} placeholder="Rich espresso..." /></Field>
        <Field label="คำอธิบาย TH"><textarea value={data.description_th} onChange={set('description_th')} style={taStyle} placeholder="กาแฟเข้มข้น..." /></Field>
        <Field label="คำอธิบาย LO"><textarea value={data.description_lo} onChange={set('description_lo')} style={taStyle} placeholder="ກາເຟ..." /></Field>
      </div>

      {/* Price + Cost + Prep + Cal + Category */}
      <div style={{ display: 'grid', gridTemplateColumns: '110px 110px 100px 100px 1fr', gap: 10, marginBottom: 12 }}>
        <Field label="ราคา ₭ *"><MoneyInput value={data.price_str} onChange={setMoney('price_str')} style={inputStyle} placeholder="0" /></Field>
        <Field label="ต้นทุน/แก้ว ₭"><MoneyInput value={data.cost_str} onChange={setMoney('cost_str')} style={inputStyle} placeholder="0" /></Field>
        <Field label="เวลา (นาที)"><input value={data.prep_str} onChange={set('prep_str')} type="number" min="0" style={inputStyle} /></Field>
        <Field label="แคลอรี่"><input value={data.cal_str} onChange={set('cal_str')} type="number" min="0" style={inputStyle} /></Field>
        <Field label="หมวดหมู่">
          <select value={data.category_id} onChange={set('category_id')} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">— ไม่ระบุ —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}{c.name_th ? ` (${c.name_th})` : ''}</option>)}
          </select>
        </Field>
      </div>

      {/* Allergens */}
      <div style={{ marginBottom: 12 }}>
        <Field label="Allergens">
          <AllergenToggle selected={data.allergens} onChange={v => onChange({ ...data, allergens: v })} />
        </Field>
      </div>

      {/* Image upload */}
      <div style={{ marginBottom: 12 }}>
        <Field label="รูปภาพ">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ padding: '8px 14px', borderRadius: 6, border: `1px solid ${GOLD}44`, color: GOLD, fontSize: 13, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1, userSelect: 'none' }}>
              {uploading ? 'กำลังอัปโหลด...' : '+ เลือกรูป'}
              <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
                onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploading(true)
                  const ext = file.name.split('.').pop() ?? 'jpg'
                  const path = `recipes/${Date.now()}.${ext}`
                  const { data: up, error } = await supabase.storage.from('menu-images').upload(path, file, { upsert: true })
                  if (!error && up) {
                    const { data: url } = supabase.storage.from('menu-images').getPublicUrl(up.path)
                    onChange({ ...data, image_url: url.publicUrl })
                  }
                  setUploading(false)
                  e.target.value = ''
                }} />
            </label>
            {data.image_url && (
              <img src={data.image_url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: `1px solid ${BORDER}` }} />
            )}
            {data.image_url && (
              <button type="button" onClick={() => onChange({ ...data, image_url: '' })} style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
            )}
          </div>
        </Field>
      </div>

      {/* Seasonal toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button type="button" onClick={() => onChange({ ...data, is_seasonal: !data.is_seasonal })} style={{
          width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
          backgroundColor: data.is_seasonal ? GOLD : 'rgba(255,255,255,0.1)', transition: 'background .2s',
        }} />
        <span style={{ fontSize: 13, color: data.is_seasonal ? GOLD : 'rgba(255,255,255,0.4)' }}>Seasonal</span>
        {data.is_seasonal && (
          <input value={data.seasonal_note} onChange={set('seasonal_note')} style={{ ...inputStyle, flex: 1 }} placeholder="หมายเหตุ Seasonal..." />
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onSave} disabled={saving} style={btnStyle(GOLD)}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        <button onClick={onCancel} style={btnStyle('rgba(255,255,255,0.08)')}>ยกเลิก</button>
      </div>
    </div>
  )
}

function RecipeCard({ r, categories, onReload }: { r: RecipeFull; categories: Category[]; onReload: () => void }) {
  const [open,        setOpen]        = useState(false)
  const [editing,     setEditing]     = useState(false)
  const [editData,    setEditData]    = useState<RecipeFullEdit>(toEdit(r))
  const [saving,      setSaving]      = useState(false)
  const [history,     setHistory]     = useState<DaySale[] | null>(null)
  const [histLoading, setHistLoading] = useState(false)
  const [msg,         setMsg]         = useState<string | null>(null)

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000) }

  async function loadHistory() {
    if (history !== null) return
    setHistLoading(true)
    const { data } = await supabase.rpc('get_recipe_sales_history', { p_recipe_id: r.id, p_days: 7 })
    setHistory((data as DaySale[]) ?? [])
    setHistLoading(false)
  }

  function handleExpand() {
    const next = !open
    setOpen(next)
    if (next) loadHistory()
  }

  async function toggleActive(e: React.MouseEvent) {
    e.stopPropagation()
    const { data } = await supabase.rpc('toggle_recipe_active', { p_recipe_id: r.id })
    if (data) onReload()
  }

  async function saveEdit() {
    const price = parseFloat(editData.price_str)
    if (isNaN(price) || price < 0) { showMsg('ราคาไม่ถูกต้อง'); return }
    setSaving(true)
    const { error } = await supabase.rpc('update_recipe_full', {
      p_recipe_id:      r.id,
      p_product_name:   editData.product_name,
      p_name_th:        editData.product_name_th,
      p_name_lo:        editData.product_name_lo,
      p_description_en: editData.description_en,
      p_description_th: editData.description_th,
      p_description_lo: editData.description_lo,
      p_price:          price,
      p_cost_per_cup:   parseFloat(editData.cost_str) || null,
      p_prep_time:      parseInt(editData.prep_str) || null,
      p_calories:       parseInt(editData.cal_str) || null,
      p_allergens:      editData.allergens,
      p_category_id:    editData.category_id || null,
      p_is_seasonal:    editData.is_seasonal,
      p_seasonal_note:  editData.seasonal_note,
      p_image_url:      editData.image_url,
    })
    if (!error) { showMsg('บันทึกสำเร็จ'); setEditing(false); onReload() }
    else showMsg('Error: ' + error.message)
    setSaving(false)
  }

  const marginColor = r.margin_pct >= 60 ? GREEN : r.margin_pct >= 40 ? GOLD : RED
  const histMax = history ? Math.max(...history.map(d => d.sales), 1) : 1

  return (
    <div style={{ backgroundColor: CARD, border: `1px solid ${open ? GOLD + '44' : BORDER}`, borderRadius: 12, overflow: 'hidden', opacity: r.is_active ? 1 : 0.5, transition: 'border-color .2s' }}>
      {/* Card header — always visible, click to expand */}
      <div onClick={handleExpand} style={{ padding: '16px 18px', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {/* Toggle switch */}
          <button onClick={toggleActive} title={r.is_active ? 'ปิด' : 'เปิด'} style={{
            width: 34, height: 19, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2,
            backgroundColor: r.is_active ? GOLD : 'rgba(255,255,255,0.1)', transition: 'background .2s',
          }} />

          {/* Thumbnail */}
          {r.image_url && (
            <img src={r.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: `1px solid ${BORDER}` }} />
          )}

          {/* Names */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{r.product_name}</span>
              {r.is_seasonal && <Badge label="Seasonal" bg={GOLD + '22'} color={GOLD} />}
              {!r.is_active && <Badge label="ปิด" bg="rgba(255,255,255,0.06)" color="rgba(255,255,255,0.3)" />}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
              {r.product_name_th && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>{r.product_name_th}</span>}
              {r.product_name_lo && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>{r.product_name_lo}</span>}
            </div>
          </div>

          {/* Category */}
          {r.category && <Badge label={r.category} bg={GOLD + '18'} color={GOLD} />}

          {/* Price */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: GOLD }}>{fmtLAK(r.price_lak)}</div>
            {r.cost_per_cup_lak && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                ต้นทุน {fmtLAK(r.cost_per_cup_lak)}
              </div>
            )}
          </div>

          {/* Chevron */}
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 3, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
        </div>

        {/* Second row: stats + meta */}
        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Margin */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Margin</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: marginColor }}>{r.margin_pct}%</span>
          </div>
          {/* Prep time */}
          {r.preparation_time && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>⏱ {r.preparation_time} นาที</div>
          )}
          {/* Calories */}
          {r.calories && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{r.calories} kcal</div>
          )}
          {/* 30d stats */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '1px' }}>30 วัน</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{r.total_qty_30d} แก้ว</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '1px' }}>ยอดรวม</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{fmtK(r.total_sales_30d)}</div>
            </div>
          </div>
        </div>

        {/* Allergens row */}
        {r.allergens && r.allergens.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {r.allergens.map(a => <Badge key={a} label={a} bg={ORANGE + '18'} color={ORANGE} />)}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {open && !editing && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px 18px', backgroundColor: '#0d0d0d' }}>
          {/* Descriptions */}
          {(r.description_en || r.description_th || r.description_lo) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>คำอธิบาย</div>
              {r.description_en && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>{r.description_en}</div>}
              {r.description_th && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 3 }}>{r.description_th}</div>}
              {r.description_lo && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{r.description_lo}</div>}
            </div>
          )}

          {/* Seasonal note */}
          {r.seasonal_note && (
            <div style={{ marginBottom: 14, padding: '8px 12px', backgroundColor: GOLD + '12', borderRadius: 6, border: `1px solid ${GOLD}22` }}>
              <span style={{ fontSize: 11, color: GOLD }}>Seasonal: </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{r.seasonal_note}</span>
            </div>
          )}

          {/* Ingredients */}
          {r.ingredients && r.ingredients.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>ส่วนผสม</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {r.ingredients.map(ing => (
                  <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', backgroundColor: CARD2, borderRadius: 6 }}>
                    <div>
                      <span style={{ fontSize: 13, color: '#fff' }}>{ing.name}</span>
                      {ing.name_th && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>{ing.name_th}</span>}
                    </div>
                    <span style={{ fontSize: 12, color: GOLD, fontWeight: 600 }}>{ing.qty_required} {ing.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7-day sales chart */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>ยอดขาย 7 วัน</div>
            {histLoading ? (
              <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${GOLD}33`, borderTopColor: GOLD, animation: 'spin .7s linear infinite' }} />
              </div>
            ) : history && history.length > 0 ? (
              <div style={{ height: 80 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }}
                      tickFormatter={v => { const d = new Date(v + 'T00:00:00'); return (d.getMonth() + 1) + '/' + d.getDate() }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: `1px solid ${GOLD}44`, borderRadius: 6, fontSize: 11 }}
                      labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                      formatter={(v) => [fmtLAK(Number(v ?? 0)), 'ยอดขาย']}
                    />
                    <Bar dataKey="sales" radius={[3, 3, 0, 0]}>
                      {history.map((d, i) => (
                        <Cell key={i} fill={d.sales > 0 ? GOLD : 'rgba(255,255,255,0.06)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>ยังไม่มีข้อมูลการขาย</div>
            )}
          </div>

          {/* Cost detail */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
            {r.calc_cost > 0 && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                ต้นทุนจากสูตร: <span style={{ color: 'rgba(255,255,255,0.55)' }}>{fmtLAK(r.calc_cost)}</span>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              Gross Margin: <span style={{ color: marginColor, fontWeight: 700 }}>{r.margin_pct}%</span>
            </div>
          </div>

          {msg && <Toast msg={msg} />}

          <button onClick={() => { setEditing(true); setEditData(toEdit(r)) }} style={btnStyleSm(GOLD + '22', GOLD)}>
            แก้ไขข้อมูล
          </button>
        </div>
      )}

      {/* Edit form */}
      {open && editing && (
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          {msg && <div style={{ padding: '8px 18px' }}><Toast msg={msg} /></div>}
          <RecipeFullForm
            title={`แก้ไข: ${r.product_name}`}
            data={editData}
            onChange={setEditData}
            categories={categories}
            saving={saving}
            onSave={saveEdit}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  )
}

function MenuTab() {
  const [recipes,    setRecipes]    = useState<RecipeFull[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [newData,    setNewData]    = useState<RecipeFullEdit>(emptyEdit())
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState<string | null>(null)
  const [search,     setSearch]     = useState('')

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const [rRes, cRes] = await Promise.all([
      supabase.rpc('get_menu_with_stats'),
      supabase.from('categories').select('id, name, name_th, name_lo, parent_id').eq('is_active', true).order('sort_order'),
    ])
    setRecipes((rRes.data as RecipeFull[]) ?? [])
    setCategories((cRes.data as Category[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createRecipe() {
    if (!newData.product_name.trim()) { showMsg('กรุณาระบุชื่อเมนู'); return }
    const price = parseFloat(newData.price_str)
    if (isNaN(price) || price < 0) { showMsg('ราคาไม่ถูกต้อง'); return }
    setSaving(true)
    const { error } = await supabase.rpc('create_recipe_full', {
      p_product_name:   newData.product_name.trim(),
      p_name_th:        newData.product_name_th,
      p_name_lo:        newData.product_name_lo,
      p_description_en: newData.description_en,
      p_description_th: newData.description_th,
      p_description_lo: newData.description_lo,
      p_price:          price,
      p_cost_per_cup:   parseFloat(newData.cost_str) || null,
      p_prep_time:      parseInt(newData.prep_str) || null,
      p_calories:       parseInt(newData.cal_str) || null,
      p_allergens:      newData.allergens,
      p_category_id:    newData.category_id || null,
      p_is_seasonal:    newData.is_seasonal,
      p_seasonal_note:  newData.seasonal_note,
      p_image_url:      newData.image_url,
    })
    if (!error) {
      showMsg('เพิ่มเมนูสำเร็จ')
      setShowForm(false)
      setNewData(emptyEdit())
      await load()
    } else {
      showMsg('Error: ' + error.message)
    }
    setSaving(false)
  }

  const filtered = recipes.filter(r =>
    !search || r.product_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.product_name_th ?? '').includes(search) || (r.category ?? '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <LoadingSpinner />

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase' }}>
          เมนูทั้งหมด ({recipes.length})
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหา..." style={{ ...inputStyle, width: 180, padding: '6px 12px' }}
          />
          <button onClick={() => { setShowForm(!showForm); setNewData(emptyEdit()) }} style={btnStyle(GOLD)}>
            {showForm ? '✕ ปิด' : '+ เพิ่มเมนู'}
          </button>
        </div>
      </div>

      <Toast msg={msg} />

      {/* Add form */}
      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <RecipeFullForm
            title="เพิ่มเมนูใหม่"
            data={newData}
            onChange={setNewData}
            categories={categories}
            saving={saving}
            onSave={createRecipe}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {filtered.map(r => (
          <RecipeCard key={r.id} r={r} categories={categories} onReload={load} />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: 40, fontSize: 14 }}>
            ไม่พบเมนู
          </div>
        )}
      </div>
    </div>
  )
}

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

// ─── Stock Tab ────────────────────────────────────────────────────────────────

function InventoryFormFields({ data, onChange, showQty }: {
  data: InventoryForm; onChange: (d: InventoryForm) => void; showQty?: boolean
}) {
  const set = (k: keyof InventoryForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [k]: e.target.value })
  const setMoney = (k: keyof InventoryForm) => (v: string) => onChange({ ...data, [k]: v })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Field label="ชื่อ EN *"><input value={data.name} onChange={set('name')} style={inputStyle} placeholder="Fresh Milk" /></Field>
        <Field label="ชื่อ TH"><input value={data.name_th} onChange={set('name_th')} style={inputStyle} placeholder="นมสด" /></Field>
        <Field label="ชื่อ LO"><input value={data.name_lo} onChange={set('name_lo')} style={inputStyle} placeholder="ນົມສົດ" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 120px 120px 120px 1fr', gap: 10 }}>
        <Field label="หน่วย"><input value={data.unit} onChange={set('unit')} style={inputStyle} placeholder="ml" /></Field>
        {showQty && <Field label="ปริมาณเริ่มต้น"><input value={data.current_qty} onChange={set('current_qty')} type="number" min="0" style={inputStyle} /></Field>}
        <Field label="Reorder Point"><input value={data.reorder_point} onChange={set('reorder_point')} type="number" min="0" style={inputStyle} placeholder="ขั้นต่ำ" /></Field>
        <Field label="ความจุสูงสุด"><input value={data.max_quantity} onChange={set('max_quantity')} type="number" min="0" style={inputStyle} placeholder="Max" /></Field>
        <Field label="ต้นทุน/หน่วย ₭"><MoneyInput value={data.cost_per_unit} onChange={setMoney('cost_per_unit')} style={inputStyle} placeholder="0" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 100px', gap: 10 }}>
        <Field label="ที่เก็บ">
          <select value={data.storage_location} onChange={set('storage_location')} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">— ไม่ระบุ —</option>
            {STORAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="อายุหลังเปิด (วัน)"><input value={data.expiry_days} onChange={set('expiry_days')} type="number" min="0" style={inputStyle} placeholder="3" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
        <Field label="ซัพพลายเออร์หลัก"><input value={data.supplier} onChange={set('supplier')} style={inputStyle} /></Field>
        <Field label="เบอร์โทร"><input value={data.supplier_phone} onChange={set('supplier_phone')} style={inputStyle} placeholder="020-xxx-xxx" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
        <Field label="ซัพพลายเออร์สำรอง"><input value={data.secondary_supplier} onChange={set('secondary_supplier')} style={inputStyle} /></Field>
        <Field label="เบอร์โทรสำรอง"><input value={data.secondary_supplier_phone} onChange={set('secondary_supplier_phone')} style={inputStyle} placeholder="020-xxx-xxx" /></Field>
      </div>
      <Field label="หมายเหตุ">
        <textarea value={data.notes} onChange={set('notes')} style={{ ...inputStyle, height: 52, resize: 'vertical' as const }} placeholder="รายละเอียดเพิ่มเติม..." />
      </Field>
    </div>
  )
}

function StockItemRow({ item, onReload, showMsg }: {
  item: StockDetail; onReload: () => void; showMsg: (m: string) => void
}) {
  const [panel,       setPanel]       = useState<'detail' | 'add' | 'edit' | null>(null)
  const [addForm,     setAddForm]     = useState<AddStockForm>({ qty: '', cost: '', supplier: item.supplier ?? '', date: todayISO() })
  const [editData,    setEditData]    = useState<InventoryForm>({
    name: item.name, name_th: item.name_th ?? '', name_lo: item.name_lo ?? '', unit: item.unit,
    current_qty: String(item.current_qty), reorder_point: String(item.reorder_point ?? ''),
    max_quantity: String(item.max_quantity ?? ''), cost_per_unit: String(item.cost_per_unit ?? ''),
    storage_location: item.storage_location ?? 'shelf', expiry_days: String(item.expiry_days ?? ''),
    supplier: item.supplier ?? '', supplier_phone: item.supplier_phone ?? '',
    secondary_supplier: item.secondary_supplier ?? '', secondary_supplier_phone: item.secondary_supplier_phone ?? '',
    notes: item.notes ?? '',
  })
  const [history,     setHistory]     = useState<PurchaseLog[] | null>(null)
  const [usage,       setUsage]       = useState<UsageStat[] | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving,      setSaving]      = useState(false)

  const isEmpty  = item.current_qty === 0
  const isLow    = !isEmpty && item.reorder_point != null && item.current_qty <= item.reorder_point
  const isExpiring = item.expiry_days_remaining != null && item.expiry_days_remaining >= 0 && item.expiry_days_remaining <= 3
  const pct      = item.max_quantity ? Math.min((item.current_qty / item.max_quantity) * 100, 100) : null
  const barColor = pct == null ? GOLD : pct > 50 ? GREEN : pct > 25 ? ORANGE : RED
  const daysColor = item.days_until_empty != null && item.days_until_empty < 3 ? RED
    : item.days_until_empty != null && item.days_until_empty < 7 ? ORANGE : 'rgba(255,255,255,0.5)'

  function openPanel(p: 'detail' | 'add' | 'edit') {
    const next = panel === p ? null : p
    setPanel(next)
    if (next === 'detail' && history === null) {
      setDetailLoading(true)
      Promise.all([
        supabase.rpc('get_purchase_history', { p_inventory_id: item.id, p_limit: 5 }),
        supabase.rpc('get_stock_analytics',  { p_inventory_id: item.id, p_days: 14 }),
      ]).then(([hRes, uRes]) => {
        setHistory((hRes.data as PurchaseLog[]) ?? [])
        setUsage((uRes.data as UsageStat[]) ?? [])
        setDetailLoading(false)
      })
    }
  }

  async function submitAdd() {
    const qty = parseFloat(addForm.qty)
    if (isNaN(qty) || qty <= 0) { showMsg('กรุณาระบุจำนวน'); return }
    setSaving(true)
    const { error } = await supabase.rpc('add_stock', {
      p_inventory_id: item.id, p_qty: qty, p_cost_lak: parseFloat(addForm.cost) || 0,
      p_supplier: addForm.supplier || null,
      p_purchased_at: addForm.date ? new Date(addForm.date + 'T12:00:00+07:00').toISOString() : new Date().toISOString(),
    })
    if (!error) { showMsg(`เติม ${item.name} +${qty} ${item.unit}`); setPanel(null); onReload() }
    else showMsg('Error: ' + error.message)
    setSaving(false)
  }

  async function saveEdit() {
    if (!editData.name.trim()) { showMsg('กรุณาระบุชื่อ'); return }
    setSaving(true)
    const { error } = await supabase.rpc('update_inventory_item', {
      p_id:                       item.id,
      p_name:                     editData.name,
      p_name_th:                  editData.name_th,
      p_name_lo:                  editData.name_lo,
      p_unit:                     editData.unit,
      p_reorder_point:            parseFloat(editData.reorder_point)  || null,
      p_max_quantity:             parseFloat(editData.max_quantity)   || null,
      p_cost_per_unit:            parseFloat(editData.cost_per_unit)  || null,
      p_storage_location:         editData.storage_location || null,
      p_expiry_days:              parseInt(editData.expiry_days)      || null,
      p_supplier:                 editData.supplier,
      p_supplier_phone:           editData.supplier_phone,
      p_secondary_supplier:       editData.secondary_supplier,
      p_secondary_supplier_phone: editData.secondary_supplier_phone,
      p_notes:                    editData.notes,
    })
    if (!error) { showMsg('บันทึกสำเร็จ'); setPanel(null); onReload() }
    else showMsg('Error: ' + error.message)
    setSaving(false)
  }

  const borderColor = isEmpty ? RED + '44' : isLow ? ORANGE + '33' : isExpiring ? ORANGE + '44' : BORDER
  const usageMax = usage ? Math.max(...usage.map(u => u.used_qty), 0.001) : 0.001

  return (
    <div style={{ marginBottom: 6 }}>
      {/* ── Main row ── */}
      <div style={{
        backgroundColor: isEmpty ? RED + '10' : isLow ? ORANGE + '0a' : CARD,
        border: `1px solid ${borderColor}`,
        borderRadius: panel ? '10px 10px 0 0' : 10, padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* Storage icon + status dot */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 20 }}>{storageIcon(item.storage_location)}</span>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: isEmpty ? RED : isLow ? ORANGE : GREEN, boxShadow: `0 0 5px ${isEmpty ? RED : isLow ? ORANGE : GREEN}88` }} />
          </div>

          {/* Name + progress bar */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{item.name}</span>
              {isEmpty    && <Badge label="หมดแล้ว"  bg={RED    + '18'} color={RED} />}
              {isLow      && <Badge label="ใกล้หมด"  bg={ORANGE + '18'} color={ORANGE} />}
              {isExpiring && <Badge label={`หมดอายุใน ${item.expiry_days_remaining} วัน`} bg={ORANGE + '18'} color={ORANGE} />}
            </div>
            {(item.name_th || item.name_lo) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                {item.name_th && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{item.name_th}</span>}
                {item.name_lo && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{item.name_lo}</span>}
              </div>
            )}

            {/* Progress bar */}
            {pct !== null && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: barColor, borderRadius: 3, transition: 'width .4s' }} />
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{Math.round(pct)}%</span>
              </div>
            )}
          </div>

          {/* Qty / max */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div>
              <span style={{ fontSize: 20, fontWeight: 800, color: isEmpty ? RED : isLow ? ORANGE : '#fff' }}>{item.current_qty}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginLeft: 3 }}>{item.unit}</span>
            </div>
            {item.max_quantity && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>max {item.max_quantity}</div>
            )}
            {item.reorder_point != null && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>min {item.reorder_point}</div>
            )}
          </div>

          {/* Days / cost */}
          <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
            {item.days_until_empty != null && (
              <div style={{ fontSize: 12, fontWeight: 700, color: daysColor }}>
                {item.days_until_empty === 0 ? 'หมดแล้ว' : `หมดใน ${item.days_until_empty} วัน`}
              </div>
            )}
            {item.cost_per_unit && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 3 }}>
                ₭{item.cost_per_unit}/{item.unit}
              </div>
            )}
            {item.stock_value > 0 && (
              <div style={{ fontSize: 11, color: GOLD, marginTop: 2 }}>{fmtLAK(item.stock_value)}</div>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
            <button onClick={() => { openPanel('add'); setAddForm({ qty: '', cost: '', supplier: item.supplier ?? '', date: todayISO() }) }} style={btnStyleSm(panel === 'add' ? GOLD + '33' : GOLD + '22', GOLD)}>+ เติม</button>
            <button onClick={() => openPanel('detail')} style={btnStyleSm('rgba(255,255,255,0.07)', 'rgba(255,255,255,0.55)')}>ประวัติ</button>
            <button onClick={() => openPanel('edit')} style={btnStyleSm('rgba(255,255,255,0.05)', 'rgba(255,255,255,0.4)')}>แก้ไข</button>
          </div>
        </div>

        {/* Supplier row */}
        {item.supplier && (
          <div style={{ marginTop: 8, display: 'flex', gap: 16, paddingLeft: 36, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{item.supplier}</span>
            {item.supplier_phone && (
              <a href={`tel:${item.supplier_phone}`} style={{ fontSize: 11, color: GOLD, textDecoration: 'none' }}>
                {item.supplier_phone}
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Add Stock panel ── */}
      {panel === 'add' && (
        <div style={{ backgroundColor: '#0f0f0f', border: `1px solid ${GOLD}33`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 16 }}>
          <div style={{ fontSize: 12, color: GOLD, marginBottom: 12, letterSpacing: '1px' }}>+ เติมสต็อก — {item.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Field label={`จำนวน (${item.unit})`}><input autoFocus value={addForm.qty} onChange={e => setAddForm(f => ({ ...f, qty: e.target.value }))} type="number" min="0" style={inputStyle} /></Field>
            <Field label="ราคาทุน ₭ (รวม)"><MoneyInput value={addForm.cost} onChange={v => setAddForm(f => ({ ...f, cost: v }))} style={inputStyle} placeholder="0" /></Field>
            <Field label="ซัพพลายเออร์"><input value={addForm.supplier} onChange={e => setAddForm(f => ({ ...f, supplier: e.target.value }))} style={inputStyle} /></Field>
            <Field label="วันที่ซื้อ"><input value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} type="date" style={inputStyle} /></Field>
          </div>
          {addForm.qty && addForm.cost && parseFloat(addForm.qty) > 0 && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
              ราคา/หน่วย: ₭{(parseFloat(addForm.cost) / parseFloat(addForm.qty)).toFixed(0)} / {item.unit}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={submitAdd} disabled={saving} style={btnStyle(GOLD)}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            <button onClick={() => setPanel(null)} style={btnStyle('rgba(255,255,255,0.08)')}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* ── Detail panel ── */}
      {panel === 'detail' && (
        <div style={{ backgroundColor: '#0d0d0d', border: `1px solid ${BORDER}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 16 }}>
          {detailLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${GOLD}33`, borderTopColor: GOLD, animation: 'spin .7s linear infinite' }} />
            </div>
          ) : (
            <>
              {/* Secondary supplier */}
              {item.secondary_supplier && (
                <div style={{ marginBottom: 14, padding: '10px 12px', backgroundColor: CARD2, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>ซัพพลายเออร์สำรอง</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#fff' }}>{item.secondary_supplier}</span>
                    {item.secondary_supplier_phone && (
                      <a href={`tel:${item.secondary_supplier_phone}`} style={{ fontSize: 12, color: GOLD, textDecoration: 'none' }}>{item.secondary_supplier_phone}</a>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {item.notes && (
                <div style={{ marginBottom: 14, padding: '8px 12px', backgroundColor: CARD2, borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 3 }}>หมายเหตุ</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{item.notes}</div>
                </div>
              )}

              {/* Daily usage rate */}
              {item.daily_usage > 0 && (
                <div style={{ marginBottom: 14, display: 'flex', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px' }}>ใช้เฉลี่ย/วัน</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 2 }}>{item.daily_usage.toFixed(2)} <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{item.unit}</span></div>
                  </div>
                  {item.last_price && (
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px' }}>ราคาซื้อล่าสุด</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: GOLD, marginTop: 2 }}>{fmtLAK(item.last_price)}<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>/{item.unit}</span></div>
                    </div>
                  )}
                </div>
              )}

              {/* 14-day usage mini chart */}
              {usage && usage.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>ใช้ 14 วัน ({item.unit})</div>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 48 }}>
                    {usage.map((u, i) => {
                      const h = Math.round((u.used_qty / usageMax) * 48)
                      const d = new Date(u.day + 'T00:00:00')
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`${u.day}: ${u.used_qty.toFixed(2)} ${item.unit}`}>
                          <div style={{ width: '100%', height: Math.max(h, 2), backgroundColor: u.used_qty > 0 ? GOLD : 'rgba(255,255,255,0.05)', borderRadius: '2px 2px 0 0' }} />
                          {i % 3 === 0 && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>{d.getDate()}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Purchase history */}
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>ประวัติการซื้อ (5 ล่าสุด)</div>
                {!history || history.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>ยังไม่มีประวัติ</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {history.map(log => (
                      <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: CARD, borderRadius: 6 }}>
                        <div>
                          <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>+{log.qty_purchased} {item.unit}</span>
                          {log.supplier && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 10 }}>{log.supplier}</span>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: GOLD }}>{fmtLAK(log.unit_price_lak)}/{item.unit}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>{fmtDate(log.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Edit panel ── */}
      {panel === 'edit' && (
        <div style={{ backgroundColor: '#0d0d0d', border: `1px solid ${GOLD}33`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 16 }}>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 14 }}>แก้ไข: {item.name}</div>
          <InventoryFormFields data={editData} onChange={setEditData} showQty={false} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={saveEdit} disabled={saving} style={btnStyle(GOLD)}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            <button onClick={() => setPanel(null)} style={btnStyle('rgba(255,255,255,0.08)')}>ยกเลิก</button>
          </div>
        </div>
      )}
    </div>
  )
}

function StockTab() {
  const [items,    setItems]    = useState<StockDetail[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newData,  setNewData]  = useState<InventoryForm>(emptyInventoryForm())
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<string | null>(null)
  const [search,   setSearch]   = useState('')

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.rpc('get_stock_detail')
    setItems((data as StockDetail[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createItem() {
    if (!newData.name.trim()) { showMsg('กรุณาระบุชื่อวัตถุดิบ'); return }
    setSaving(true)
    const { error } = await supabase.rpc('create_inventory_item', {
      p_name:                     newData.name,
      p_name_th:                  newData.name_th,
      p_name_lo:                  newData.name_lo,
      p_unit:                     newData.unit,
      p_current_qty:              parseFloat(newData.current_qty)  || 0,
      p_reorder_point:            parseFloat(newData.reorder_point) || null,
      p_max_quantity:             parseFloat(newData.max_quantity)  || null,
      p_cost_per_unit:            parseFloat(newData.cost_per_unit) || null,
      p_storage_location:         newData.storage_location || null,
      p_expiry_days:              parseInt(newData.expiry_days)     || null,
      p_supplier:                 newData.supplier,
      p_supplier_phone:           newData.supplier_phone,
      p_secondary_supplier:       newData.secondary_supplier,
      p_secondary_supplier_phone: newData.secondary_supplier_phone,
      p_notes:                    newData.notes,
    })
    if (!error) { showMsg('เพิ่มวัตถุดิบสำเร็จ'); setShowForm(false); setNewData(emptyInventoryForm()); await load() }
    else showMsg('Error: ' + error.message)
    setSaving(false)
  }

  if (loading) return <LoadingSpinner />

  const totalValue   = items.reduce((s, i) => s + i.stock_value, 0)
  const lowCount     = items.filter(i => i.reorder_point != null && i.current_qty <= i.reorder_point).length
  const expiryCount  = items.filter(i => i.expiry_days_remaining != null && i.expiry_days_remaining >= 0 && i.expiry_days_remaining <= 3).length

  const filtered = items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.name_th ?? '').includes(search) || (i.unit ?? '').includes(search)
  )

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'มูลค่าสต็อกรวม', value: fmtLAK(totalValue), color: GOLD },
          { label: 'วัตถุดิบทั้งหมด', value: `${items.length} รายการ`, color: '#fff' },
          { label: 'ใกล้หมด / หมด', value: String(lowCount), color: lowCount > 0 ? RED : GREEN },
          { label: 'ใกล้หมดอายุ', value: String(expiryCount), color: expiryCount > 0 ? ORANGE : GREEN },
        ].map(c => (
          <div key={c.label} style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase' }}>
          วัตถุดิบ ({filtered.length} รายการ)
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา..." style={{ ...inputStyle, width: 160, padding: '6px 12px' }} />
          <button onClick={() => { setShowForm(!showForm); setNewData(emptyInventoryForm()) }} style={btnStyle(GOLD)}>
            {showForm ? '✕ ปิด' : '+ เพิ่มวัตถุดิบ'}
          </button>
        </div>
      </div>

      <Toast msg={msg} />

      {/* Add form */}
      {showForm && (
        <div style={{ marginBottom: 20, padding: 20, backgroundColor: '#0d0d0d', border: `1px solid ${GOLD}33`, borderRadius: 12 }}>
          <div style={{ fontSize: 12, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 16 }}>เพิ่มวัตถุดิบใหม่</div>
          <InventoryFormFields data={newData} onChange={setNewData} showQty={true} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={createItem} disabled={saving} style={btnStyle(GOLD)}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            <button onClick={() => setShowForm(false)} style={btnStyle('rgba(255,255,255,0.08)')}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* Stock list */}
      <div>
        {filtered.map(item => (
          <StockItemRow key={item.id} item={item} onReload={load} showMsg={showMsg} />
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: 48, fontSize: 14 }}>
            ไม่พบวัตถุดิบ
          </div>
        )}
      </div>
    </div>
  )
}

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

// ─── Staff Components ─────────────────────────────────────────────────────────

function StaffAvatar({ name, avatarUrl, size = 40 }: { name: string; avatarUrl: string | null; size?: number }) {
  const [err, setErr] = useState(false)
  const ini = name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      backgroundColor: `${GOLD}22`, border: `2px solid ${BORDER}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {avatarUrl && !err
        ? <img src={avatarUrl} alt={name} width={size} height={size}
            style={{ width: size, height: size, objectFit: 'cover' }}
            onError={() => setErr(true)} />
        : <span style={{ fontSize: size * 0.35, fontWeight: 700, color: GOLD }}>{ini}</span>
      }
    </div>
  )
}

function staffStatusColor(s: string): string {
  if (s === 'present') return GREEN
  if (s === 'late')    return ORANGE
  if (s === 'absent')  return RED
  return 'rgba(255,255,255,0.3)'
}
function staffStatusLabel(s: string): string {
  if (s === 'present') return 'มาแล้ว'
  if (s === 'late')    return 'สาย'
  if (s === 'absent')  return 'ขาด'
  if (s === 'leave')   return 'ลา'
  return 'ยังไม่มา'
}

function StaffTodayView() {
  const [rows,    setRows]    = useState<StaffToday[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('get_staff_today_status').then(({ data }) => {
      setRows((data ?? []) as StaffToday[])
      setLoading(false)
    })
  }, [])

  const present = rows.filter(r => r.status === 'present' || r.status === 'late').length
  const absent  = rows.filter(r => r.status === 'absent').length
  const onTime  = rows.filter(r => r.status === 'present').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'มาทำงาน',  value: present,  color: GREEN },
          { label: 'ตรงเวลา',  value: onTime,   color: GOLD },
          { label: 'ขาดงาน',   value: absent,   color: RED },
        ].map(k => (
          <div key={k.label} style={{ backgroundColor: CARD, borderRadius: 12, padding: '16px 18px', border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Staff list */}
      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>กำลังโหลด...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
              backgroundColor: CARD, borderRadius: 10, border: `1px solid ${BORDER}` }}>
              <StaffAvatar name={r.name} avatarUrl={r.avatar_url} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name_th ?? r.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                  {r.clock_in ? `เข้า ${new Date(r.clock_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : 'ยังไม่ลงชื่อ'}
                  {r.clock_out ? ` · ออก ${new Date(r.clock_out).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99,
                  color: staffStatusColor(r.status), backgroundColor: `${staffStatusColor(r.status)}18` }}>
                  {staffStatusLabel(r.status)}
                </span>
                {r.late_minutes && r.late_minutes > 0
                  ? <span style={{ fontSize: 10, color: ORANGE }}>สาย {r.late_minutes} นาที</span>
                  : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StaffPerfView() {
  const [rows,    setRows]    = useState<StaffAnalytics[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('get_staff_analytics').then(({ data }) => {
      setRows((data ?? []) as StaffAnalytics[])
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>กำลังโหลด...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>ประสิทธิภาพ 30 วันล่าสุด</div>
      {rows.map((r, i) => (
        <div key={r.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
          backgroundColor: CARD, borderRadius: 12, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.2)', width: 28 }}>#{i + 1}</div>
          <StaffAvatar name={r.name} avatarUrl={r.avatar_url} size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name_th ?? r.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              {r.days_present} วัน · {r.total_hours.toFixed(0)} ชม. · {r.orders_served} ออเดอร์
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: r.punctuality_pct >= 90 ? GREEN : r.punctuality_pct >= 70 ? GOLD : RED }}>
              {r.punctuality_pct.toFixed(0)}%
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>ตรงเวลา</div>
          </div>
        </div>
      ))}
      {rows.length === 0 && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>ไม่มีข้อมูล</div>}
    </div>
  )
}

// ─── Photo Enroll Modal ───────────────────────────────────────────────────────

function FaceEnrollModal({ staff, onClose, onSaved }: { staff: StaffMember; onClose: () => void; onSaved: () => void }) {
  const streamRef  = useRef<MediaStream | null>(null)
  const videoRef   = useRef<HTMLVideoElement | null>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)

  const [status,   setStatus]  = useState<'idle' | 'live' | 'captured' | 'saving' | 'saved' | 'error'>('idle')
  const [saveStep, setSaveStep] = useState('')
  const [preview,  setPreview] = useState<string | null>(null)
  const [photoBlob,setPhotoBlob] = useState<Blob | null>(null)
  const [errMsg,   setErrMsg]  = useState('')

  // Callback ref: binds stream as soon as video element mounts
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
    if (node && streamRef.current) {
      node.srcObject = streamRef.current
      node.onloadedmetadata = () => { node.play().catch(() => {}) }
    }
  }, [])

  async function openCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = s
      setStatus('live')
    } catch (e) {
      console.warn('[PhotoEnroll] Camera failed:', e)
      setErrMsg('ไม่สามารถเปิดกล้องได้')
      setStatus('error')
    }
  }

  function shoot() {
    const v = videoRef.current, c = canvasRef.current; if (!v || !c) return
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480
    c.getContext('2d')?.drawImage(v, 0, 0)
    c.toBlob(b => {
      if (!b) return
      setPreview(c.toDataURL())
      setPhotoBlob(b)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setStatus('captured')
    }, 'image/jpeg', 0.88)
  }

  function retake() {
    setPreview(null); setPhotoBlob(null); void openCamera()
  }

  async function save() {
    console.log('Starting save...')
    if (!photoBlob) { setErrMsg('กรุณาถ่ายรูปก่อน'); return }
    if (!preview) { setErrMsg('ไม่มีข้อมูลรูปภาพ'); return }
    setStatus('saving'); setErrMsg('')
    try {
      // 1. Load face-api
      console.log('Loading face-api models...')
      setSaveStep('กำลังโหลด AI...')
      const fa = await getFaceApi()

      // 2. Detect face from preview dataURL (canvas may be unmounted)
      console.log('Detecting face...')
      setSaveStep('กำลังตรวจจับใบหน้า...')
      const img = document.createElement('img')
      img.src = preview
      await new Promise<void>(r => { img.onload = () => r() })
      const det = await fa.detectSingleFace(img, new fa.TinyFaceDetectorOptions())
        .withFaceLandmarks().withFaceDescriptor()
      if (!det) {
        console.warn('No face detected')
        setErrMsg('ไม่พบใบหน้าในรูป กรุณาถ่ายใหม่ให้เห็นหน้าชัดเจน')
        setStatus('captured'); setSaveStep(''); return
      }
      const descriptor = Array.from(det.descriptor as Float32Array)
      console.log('Face detected, descriptor length:', descriptor.length)

      // 3. Upload photo
      console.log('Uploading photo...')
      setSaveStep('กำลังอัปโหลดรูป...')
      const path = `avatars/${staff.id}_${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('staff-photos').upload(path, photoBlob, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) { console.error('Upload error:', upErr.message); setErrMsg(upErr.message); setStatus('captured'); setSaveStep(''); return }
      const url = supabase.storage.from('staff-photos').getPublicUrl(path).data?.publicUrl
      console.log('Uploaded:', url)

      // 4. Save to DB
      console.log('Saving to DB...')
      setSaveStep('กำลังบันทึก...')
      const { error: dbErr } = await supabase.from('staff').update({ avatar_url: url, face_descriptor: descriptor }).eq('id', staff.id)
      if (dbErr) { console.error('DB error:', dbErr.message); setErrMsg(dbErr.message); setStatus('captured'); setSaveStep(''); return }

      console.log('Done!')
      setSaveStep(''); setStatus('saved')
      setTimeout(() => { onSaved(); onClose() }, 1500)
    } catch (e) {
      console.error('Save failed:', e)
      setErrMsg(e instanceof Error ? e.message : String(e))
      setStatus('captured'); setSaveStep('')
    }
  }

  useEffect(() => {
    void openCamera()
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
      <div style={{ backgroundColor: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 24, width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>ถ่ายรูปพนักงาน</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{staff.name_th ?? staff.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {status === 'idle' && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>กำลังเปิดกล้อง...</div>
        )}
        {status === 'saved' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: GREEN }}>บันทึกรูปถ่าย + ใบหน้าแล้ว</div>
          </div>
        )}
        {status === 'error' && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: RED, fontSize: 13 }}>{errMsg || 'เกิดข้อผิดพลาด'}</div>
        )}
        {/* canvas always mounted so canvasRef is valid when save() runs */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {status === 'live' && (
          <>
            <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 14, backgroundColor: '#000' }}>
              <video ref={setVideoRef} autoPlay playsInline muted
                style={{ width: '100%', display: 'block', maxHeight: 260, objectFit: 'cover' }} />
            </div>
            <button onClick={shoot}
              style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', backgroundColor: GOLD, color: BLACK }}>
              📷 ถ่ายรูป
            </button>
          </>
        )}
        {(status === 'captured' || status === 'saving') && (
          <>
            {preview && <img src={preview} style={{ width: '100%', borderRadius: 10, marginBottom: 14, maxHeight: 260, objectFit: 'cover' }} />}
            {saveStep && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, backgroundColor: `${GOLD}12`, marginBottom: 8 }}>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: `2px solid ${GOLD}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: GOLD, fontWeight: 600 }}>{saveStep}</span>
              </div>
            )}
            {errMsg && <div style={{ color: RED, fontSize: 12, textAlign: 'center', marginBottom: 8 }}>{errMsg}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={retake} disabled={status === 'saving'}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${BORDER}`, background: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}>
                ถ่ายใหม่
              </button>
              <button onClick={() => void save()} disabled={status === 'saving'}
                style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 14, cursor: status === 'saving' ? 'not-allowed' : 'pointer', backgroundColor: GOLD, color: BLACK, opacity: status === 'saving' ? 0.7 : 1 }}>
                {status === 'saving' ? '...' : 'บันทึกรูปถ่าย + ใบหน้า'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StaffManageView() {
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editing,   setEditing]   = useState<StaffMember | null>(null)
  const [form,      setForm]      = useState<StaffForm>(emptyStaffForm())
  const [saving,       setSaving]       = useState(false)
  const [errMsg,       setErrMsg]       = useState('')
  const [showPin,      setShowPin]      = useState(false)
  const [enrollTarget, setEnrollTarget] = useState<StaffMember | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_all_staff')
    setStaffList((data ?? []) as StaffMember[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    setForm(emptyStaffForm())
    setErrMsg('')
    setShowPin(false)
    setShowForm(true)
  }

  function openEdit(s: StaffMember) {
    setEditing(s)
    setForm({
      name: s.name, name_th: s.name_th ?? '', name_lo: s.name_lo ?? '',
      phone: s.phone ?? '', salary: String(s.salary ?? ''), salary_type: s.salary_type ?? 'monthly',
      start_date: s.start_date ?? new Date().toISOString().slice(0, 10),
      scheduled_start_time: s.scheduled_start_time ?? '08:00',
      skills: (s.skills ?? []).join(', '), notes: s.notes ?? '', pin: '',
    })
    setErrMsg('')
    setShowPin(false)
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) { setErrMsg('กรุณากรอกชื่อ'); return }
    if (form.pin && (!/^\d{4}$/.test(form.pin))) { setErrMsg('PIN ต้องเป็นตัวเลข 4 หลัก'); return }
    if (!editing && !form.pin) { setErrMsg('กรุณากรอก PIN 4 หลัก'); return }
    setSaving(true); setErrMsg('')
    try {
      const skillsArr = form.skills.split(',').map(s => s.trim()).filter(Boolean)
      if (editing) {
        const payload: Record<string, unknown> = {
          name:                   form.name || null,
          name_th:                form.name_th || null,
          name_lo:                form.name_lo || null,
          phone:                  form.phone || null,
          salary:                 form.salary ? parseFloat(form.salary) : null,
          salary_type:            form.salary_type || null,
          start_date:             form.start_date || null,
          scheduled_start_time:   form.scheduled_start_time || null,
          skills:                 skillsArr.length ? skillsArr : null,
          notes:                  form.notes || null,
        }
        if (form.pin) payload.pin_code = form.pin
        const { error } = await supabase.from('staff').update(payload).eq('id', editing.id)
        if (error) { setErrMsg(error.message); return }
      } else {
        const { error } = await supabase.from('staff').insert({
          name:                 form.name,
          name_th:              form.name_th || null,
          name_lo:              form.name_lo || null,
          phone:                form.phone || null,
          salary:               form.salary ? parseFloat(form.salary) : null,
          salary_type:          form.salary_type || null,
          start_date:           form.start_date || null,
          scheduled_start_time: form.scheduled_start_time || null,
          skills:               skillsArr.length ? skillsArr : null,
          notes:                form.notes || null,
          pin_code:             form.pin,
          role:                 'staff',
          is_active:            true,
        })
        if (error) { setErrMsg(error.message); return }
      }
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function toggle(id: string) {
    await supabase.rpc('toggle_staff_active', { p_id: id })
    load()
  }

  const f = (k: keyof StaffForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))
  const fMoney = (k: keyof StaffForm) => (v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', backgroundColor: '#1a1a1a', border: `1px solid ${BORDER}`,
    borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }

  return (
    <div>
      {enrollTarget && (
        <FaceEnrollModal
          staff={enrollTarget}
          onClose={() => setEnrollTarget(null)}
          onSaved={() => { setEnrollTarget(null); load() }}
        />
      )}

      {showForm && (
        <div style={{ marginBottom: 24, padding: '20px', backgroundColor: CARD, borderRadius: 14, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{editing ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><div style={labelStyle}>ชื่อ (EN) *</div><input value={form.name} onChange={f('name')} style={inputStyle} /></div>
            <div><div style={labelStyle}>ชื่อ (TH)</div><input value={form.name_th} onChange={f('name_th')} style={inputStyle} /></div>
            <div><div style={labelStyle}>ชื่อ (LO)</div><input value={form.name_lo} onChange={f('name_lo')} style={inputStyle} /></div>
            <div><div style={labelStyle}>โทรศัพท์</div><input value={form.phone} onChange={f('phone')} style={inputStyle} /></div>
            <div><div style={labelStyle}>เงินเดือน (LAK)</div><MoneyInput value={form.salary} onChange={fMoney('salary')} style={inputStyle} placeholder="0" /></div>
            <div>
              <div style={labelStyle}>ประเภทเงินเดือน</div>
              <select value={form.salary_type} onChange={f('salary_type')} style={inputStyle}>
                <option value="monthly">รายเดือน</option>
                <option value="daily">รายวัน</option>
                <option value="hourly">รายชั่วโมง</option>
              </select>
            </div>
            <div><div style={labelStyle}>วันเริ่มงาน</div><input type="date" value={form.start_date} onChange={f('start_date')} style={inputStyle} /></div>
            <div><div style={labelStyle}>เวลาเริ่มงาน</div><input type="time" value={form.scheduled_start_time} onChange={f('scheduled_start_time')} style={inputStyle} /></div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={labelStyle}>ทักษะ (คั่นด้วยจุลภาค)</div>
              <input value={form.skills} onChange={f('skills')} placeholder="บาริสต้า, เบเกอรี่, ..." style={inputStyle} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={labelStyle}>หมายเหตุ</div>
              <textarea value={form.notes} onChange={f('notes')} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div>
              <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>PIN {editing ? '(เว้นว่าง = ไม่เปลี่ยน)' : '* (4 หลัก)'}</span>
                {editing && form.pin === '' && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, pin: '' }))}
                    style={{ background: 'none', border: 'none', color: GOLD, fontSize: 11, cursor: 'pointer', padding: 0 }}>
                    Reset PIN
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  value={form.pin}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setForm(p => ({ ...p, pin: v }))
                  }}
                  placeholder={editing ? '••••' : 'กรอก PIN 4 หลัก'}
                  style={{ ...inputStyle, paddingRight: 36, letterSpacing: showPin ? 2 : 6 }}
                />
                <button type="button" onClick={() => setShowPin(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 15,
                    color: 'rgba(255,255,255,0.35)', lineHeight: 1 }}>
                  {showPin ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            {editing && (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="button"
                  onClick={() => { setForm(p => ({ ...p, pin: '' })); setShowPin(true) }}
                  style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${GOLD}44`,
                    cursor: 'pointer', backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 12 }}>
                  Reset PIN
                </button>
              </div>
            )}
          </div>
          {errMsg && <div style={{ color: RED, fontSize: 12, marginTop: 8 }}>{errMsg}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={save} disabled={saving}
              style={{ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                backgroundColor: GOLD, color: BLACK, fontWeight: 700, fontSize: 13 }}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${BORDER}`, cursor: 'pointer',
                backgroundColor: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      <button onClick={openNew}
        style={{ marginBottom: 16, padding: '9px 18px', borderRadius: 8, border: `1px solid ${GOLD}44`,
          cursor: 'pointer', backgroundColor: `${GOLD}14`, color: GOLD, fontSize: 13, fontWeight: 600 }}>
        + เพิ่มพนักงาน
      </button>

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>กำลังโหลด...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {staffList.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
              backgroundColor: CARD, borderRadius: 10, border: `1px solid ${BORDER}`,
              opacity: s.is_active ? 1 : 0.45 }}>
              <StaffAvatar name={s.name} avatarUrl={s.avatar_url} size={42} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name_th ?? s.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                  {s.phone ?? '—'} · {s.salary_type ?? 'monthly'}
                  {s.salary ? ` · ${new Intl.NumberFormat('lo-LA').format(s.salary)} ₭` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEnrollTarget(s)}
                  style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${GOLD}44`, cursor: 'pointer',
                    backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 11 }}>
                  {s.avatar_url ? '🔄 รูปถ่าย' : '📷 รูปถ่าย'}
                </button>
                <button onClick={() => openEdit(s)}
                  style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, cursor: 'pointer',
                    backgroundColor: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                  แก้ไข
                </button>
                <button onClick={() => toggle(s.id)}
                  style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    backgroundColor: s.is_active ? `${RED}18` : `${GREEN}18`,
                    color: s.is_active ? RED : GREEN, fontSize: 11 }}>
                  {s.is_active ? 'ปิดใช้' : 'เปิดใช้'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StaffTab() {
  const [sub, setSub] = useState<'today' | 'perf' | 'manage' | 'leaves'>('today')
  const subs: { id: 'today' | 'perf' | 'manage' | 'leaves'; label: string }[] = [
    { id: 'today',  label: 'วันนี้' },
    { id: 'perf',   label: 'ประสิทธิภาพ' },
    { id: 'manage', label: 'จัดการ' },
    { id: 'leaves', label: 'คำขอลา' },
  ]
  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: `1px solid ${BORDER}` }}>
        {subs.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)}
            style={{ padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
              color: sub === s.id ? GOLD : 'rgba(255,255,255,0.4)',
              fontWeight: sub === s.id ? 600 : 400,
              borderBottom: sub === s.id ? `2px solid ${GOLD}` : '2px solid transparent',
              marginBottom: -1, transition: 'all .15s' }}>
            {s.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <a href="/staff"
            style={{ fontSize: 11, color: GOLD, textDecoration: 'none', padding: '4px 10px',
              border: `1px solid ${GOLD}44`, borderRadius: 6 }}>
            Kiosk →
          </a>
        </div>
      </div>
      {sub === 'today'  && <StaffTodayView />}
      {sub === 'perf'   && <StaffPerfView />}
      {sub === 'manage' && <StaffManageView />}
      {sub === 'leaves' && <LeavesView />}
    </div>
  )
}

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

// ─── FinanceTab ───────────────────────────────────────────────────────────────

const BUDGET_CATS = [
  { key: 'cogs',      label: 'ต้นทุนสินค้า (COGS)',     color: ORANGE },
  { key: 'labor',     label: 'ค่าแรงพนักงาน',            color: '#7fa8e8' },
  { key: 'fixed',     label: 'ค่าใช้จ่ายคงที่',          color: '#b07fe8' },
  { key: 'marketing', label: 'การตลาด',                  color: '#e87f9c' },
  { key: 'growth',    label: 'การเติบโต / อื่นๆ',       color: '#7fe8b0' },
] as const
type BudgetKey = (typeof BUDGET_CATS)[number]['key']

function loadBudgets(): Record<BudgetKey, number> {
  try {
    const raw = localStorage.getItem('alan_budgets')
    if (raw) return JSON.parse(raw) as Record<BudgetKey, number>
  } catch { /* ignore */ }
  return { cogs: 0, labor: 0, fixed: 0, marketing: 0, growth: 0 }
}
function saveBudgets(b: Record<BudgetKey, number>) {
  try { localStorage.setItem('alan_budgets', JSON.stringify(b)) } catch { /* ignore */ }
}

function FinanceTab() {
  const [cashflow7,  setCashflow7]  = useState<CashflowRow[]>([])
  const [cashflow30, setCashflow30] = useState<CashflowRow[]>([])
  const [purchases,  setPurchases]  = useState<{ created_at: string; unit_price_lak: number; qty_purchased: number }[]>([])
  const [loading,    setLoading]    = useState(false)
  const [form,       setForm]       = useState({ shift: 'morning', opening_cash: '', actual_cash: '' })
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState('')
  const [budgets,    setBudgets]    = useState<Record<BudgetKey, number>>(loadBudgets)
  const [editBudget, setEditBudget] = useState(false)
  const [budgetDraft,setBudgetDraft]= useState<Record<BudgetKey, string>>({ cogs: '', labor: '', fixed: '', marketing: '', growth: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: d7 }, { data: d30 }, { data: dpurch }] = await Promise.all([
      supabase.rpc('get_cashflow_summary', { p_days: 7 }),
      supabase.rpc('get_cashflow_summary', { p_days: 30 }),
      supabase.from('purchase_logs').select('created_at,unit_price_lak,qty_purchased').eq('status', 'approved')
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    ])
    setCashflow7((d7 as CashflowRow[]) ?? [])
    setCashflow30((d30 as CashflowRow[]) ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPurchases((dpurch as any[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function closeShift() {
    const opening = parseFloat(form.opening_cash), actual = parseFloat(form.actual_cash)
    if (isNaN(opening) || isNaN(actual)) { setMsg('กรุณากรอกยอดเงินให้ถูกต้อง'); return }
    setSaving(true); setMsg('')
    const { error } = await supabase.rpc('close_shift', {
      p_staff_id: null, p_shift: form.shift,
      p_opening_cash: opening, p_actual_cash: actual, p_system_sales: 0,
    })
    if (error) { setMsg(error.message) } else {
      setForm(f => ({ ...f, opening_cash: '', actual_cash: '' }))
      await load()
    }
    setSaving(false)
  }

  // ── Computed summary ──
  const today = new Date().toISOString().slice(0, 10)
  const todayRows   = cashflow30.filter(r => r.log_date === today)
  const todaySales  = todayRows.reduce((s, r) => s + r.system_sales, 0)
  const todayCash   = todayRows.reduce((s, r) => s + r.actual_cash, 0)
  const todayVar    = todayRows.reduce((s, r) => s + r.variance_lak, 0)
  const weekSales   = cashflow7.reduce((s, r) => s + r.system_sales, 0)
  const weekCash    = cashflow7.reduce((s, r) => s + r.actual_cash, 0)
  const totalCogs   = purchases.reduce((s, p) => s + p.unit_price_lak * p.qty_purchased, 0)
  const grossProfit = weekSales - totalCogs
  const grossPct    = weekSales > 0 ? Math.round((grossProfit / weekSales) * 100) : 0

  // ── Weekly chart: group by date, sum sales+cash ──
  const weekMap: Record<string, { ยอดขาย: number; เงินจริง: number; กำไรขั้นต้น: number }> = {}
  for (const r of cashflow7) {
    if (!weekMap[r.log_date]) weekMap[r.log_date] = { ยอดขาย: 0, เงินจริง: 0, กำไรขั้นต้น: 0 }
    weekMap[r.log_date].ยอดขาย  += r.system_sales
    weekMap[r.log_date].เงินจริง += r.actual_cash
  }
  const chartData = Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, vals]) => ({
    name: date.slice(5),
    ยอดขาย:     vals.ยอดขาย,
    เงินจริง:    vals.เงินจริง,
    กำไรขั้นต้น: Math.max(0, vals.ยอดขาย - totalCogs / 7),
  }))

  // ── Budget actual: cogs from purchase_logs ──
  const budgetActual: Record<BudgetKey, number> = {
    cogs:      totalCogs,
    labor:     0,
    fixed:     0,
    marketing: 0,
    growth:    0,
  }

  function openBudgetEdit() {
    setBudgetDraft(Object.fromEntries(BUDGET_CATS.map(c => [c.key, budgets[c.key] ? String(budgets[c.key]) : ''])) as Record<BudgetKey, string>)
    setEditBudget(true)
  }
  function saveBudgetEdit() {
    const next = Object.fromEntries(BUDGET_CATS.map(c => [c.key, parseFloat(budgetDraft[c.key]) || 0])) as Record<BudgetKey, number>
    setBudgets(next); saveBudgets(next); setEditBudget(false)
  }

  const shiftName = (s: string) => s === 'morning' ? 'เช้า' : s === 'afternoon' ? 'บ่าย' : 'เย็น'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Daily KPI summary ── */}
      <div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 14 }}>
          สรุปวันนี้ · {today}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: 'ยอดขาย', val: todaySales, color: GOLD, fmt: (n: number) => n.toLocaleString() + ' ₭' },
            { label: 'เงินสดจริง', val: todayCash, color: '#fff', fmt: (n: number) => n.toLocaleString() + ' ₭' },
            { label: 'ผลต่างเงินสด', val: todayVar, color: todayVar >= 0 ? GREEN : RED, fmt: (n: number) => (n >= 0 ? '+' : '') + n.toLocaleString() + ' ₭' },
            { label: 'กำไรขั้นต้น (7วัน)', val: grossProfit, color: grossProfit >= 0 ? GREEN : RED, fmt: (n: number) => n.toLocaleString() + ' ₭' },
            { label: 'Gross Margin', val: grossPct, color: GOLD, fmt: (n: number) => n + '%' },
          ].map(item => (
            <div key={item.label} style={{ padding: '16px 18px', borderRadius: 12, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.fmt(item.val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Close shift form ── */}
      <div style={{ padding: 22, borderRadius: 14, border: `1px solid ${GOLD}33`, backgroundColor: CARD }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: GOLD, marginBottom: 14 }}>🔒 ปิดกะ</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>กะ</div>
            <select value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: '#0f0f0f', color: '#fff', fontSize: 14 }}>
              <option value="morning">เช้า</option>
              <option value="afternoon">บ่าย</option>
              <option value="evening">เย็น</option>
            </select>
          </div>
          {[['opening_cash', 'เงินเปิดกะ'], ['actual_cash', 'เงินที่นับได้']].map(([key, lbl]) => (
            <div key={key}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>{lbl} (LAK)</div>
              <MoneyInput value={(form as Record<string, string>)[key]} onChange={v => setForm(f => ({ ...f, [key]: v }))}
                placeholder="0" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: '#0f0f0f', color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
        {form.opening_cash && form.actual_cash && (() => {
          const v = parseFloat(form.actual_cash) - parseFloat(form.opening_cash)
          return (
            <div style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, backgroundColor: `${Math.abs(v) <= 5000 ? GREEN : RED}10`, border: `1px solid ${Math.abs(v) <= 5000 ? GREEN : RED}33` }}>
              <span style={{ fontSize: 13, color: Math.abs(v) <= 5000 ? GREEN : RED, fontWeight: 600 }}>
                ผลต่าง: {v >= 0 ? '+' : ''}{v.toLocaleString()} LAK
              </span>
            </div>
          )
        })()}
        {msg && <div style={{ color: RED, fontSize: 13, marginTop: 8 }}>{msg}</div>}
        <button onClick={() => void closeShift()} disabled={saving}
          style={{ marginTop: 12, padding: '10px 26px', borderRadius: 8, border: 'none', backgroundColor: GOLD, color: '#000', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'กำลังบันทึก...' : 'บันทึกปิดกะ'}
        </button>
      </div>

      {/* ── Weekly chart ── */}
      <div style={{ padding: 22, borderRadius: 14, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'rgba(255,255,255,0.8)' }}>
          แนวโน้ม 7 วัน
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 400, marginLeft: 10 }}>ยอดขาย / เงินจริง / กำไรขั้นต้น (ประมาณ)</span>
        </div>
        {loading ? (
          <div style={{ height: 200, borderRadius: 10, backgroundColor: '#0f0f0f', animation: 'pulse 1.5s infinite' }} />
        ) : chartData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)' }}>ยังไม่มีข้อมูล</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: `1px solid ${GOLD}44`, borderRadius: 8 }} labelStyle={{ color: GOLD }} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }} />
              <Line type="monotone" dataKey="ยอดขาย"     stroke={GOLD}  strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="เงินจริง"    stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="กำไรขั้นต้น" stroke="#7fa8e8" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Budget section ── */}
      <div style={{ padding: 22, borderRadius: 14, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>งบประมาณรายสัปดาห์</div>
          <button onClick={openBudgetEdit} style={{ padding: '5px 14px', borderRadius: 7, border: `1px solid ${GOLD}44`, backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>ตั้งงบ</button>
        </div>

        {editBudget ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {BUDGET_CATS.map(c => (
              <div key={c.key} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: c.color }}>{c.label}</div>
                <MoneyInput value={budgetDraft[c.key]} onChange={v => setBudgetDraft(d => ({ ...d, [c.key]: v }))}
                  placeholder="0 LAK" style={{ padding: '8px 10px', borderRadius: 7, border: `1px solid ${BORDER}`, backgroundColor: '#0f0f0f', color: '#fff', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={saveBudgetEdit} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', backgroundColor: GOLD, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>บันทึก</button>
              <button onClick={() => setEditBudget(false)} style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}>ยกเลิก</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {BUDGET_CATS.map(c => {
              const budget = budgets[c.key]
              const actual = budgetActual[c.key]
              const pct = budget > 0 ? Math.min(100, Math.round((actual / budget) * 100)) : 0
              return (
                <div key={c.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: c.color }}>{c.label}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                      {actual.toLocaleString()} / {budget > 0 ? budget.toLocaleString() : '—'} LAK
                    </span>
                  </div>
                  <div style={{ height: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    {budget > 0 && (
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, backgroundColor: pct >= 90 ? RED : pct >= 70 ? ORANGE : c.color, transition: 'width .4s' }} />
                    )}
                  </div>
                  {budget > 0 && <div style={{ fontSize: 10, color: pct >= 90 ? RED : 'rgba(255,255,255,0.3)', marginTop: 3 }}>{pct}% ใช้ไปแล้ว</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── P&L Statement (30 days) ── */}
      {(() => {
        const rev30      = cashflow30.reduce((s, r) => s + r.system_sales, 0)
        const cogs30     = totalCogs
        const grossP     = rev30 - cogs30
        const grossM     = rev30 > 0 ? Math.round((grossP / rev30) * 100) : 0
        const laborCost  = budgets.labor
        const fixedCost  = budgets.fixed
        const netProfit  = grossP - laborCost - fixedCost
        const netMargin  = rev30 > 0 ? Math.round((netProfit / rev30) * 100) : 0

        const rows: { label: string; value: number; indent?: boolean; highlight?: boolean; separator?: boolean; dimLabel?: string }[] = [
          { label: 'รายได้รวม (Revenue)',            value: rev30,     highlight: false },
          { label: 'ต้นทุนขาย (COGS)',               value: -cogs30,   indent: true, dimLabel: 'จากการซื้อวัตถุดิบ 30 วัน' },
          { label: 'กำไรขั้นต้น (Gross Profit)',     value: grossP,    highlight: true },
          { label: `  Gross Margin`,                  value: grossM,    highlight: false, dimLabel: '%', separator: false },
          { label: 'ค่าแรงพนักงาน (Labor)',           value: -laborCost, indent: true, dimLabel: 'จากงบประมาณ' },
          { label: 'ต้นทุนคงที่ (Fixed)',             value: -fixedCost, indent: true, dimLabel: 'จากงบประมาณ' },
          { label: 'กำไรสุทธิ (Net Profit est.)',    value: netProfit, highlight: true },
          { label: `  Net Margin`,                    value: netMargin, highlight: false, dimLabel: '%' },
        ]

        return (
          <div style={{ padding: 22, borderRadius: 14, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>งบกำไรขาดทุน (P&L) — 30 วัน</div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>ESTIMATED</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {rows.map((row, i) => {
                  const isMargin = row.dimLabel === '%'
                  const displayVal = isMargin
                    ? `${row.value}%`
                    : (row.value < 0 ? `(${Math.abs(row.value).toLocaleString()})` : row.value.toLocaleString()) + ' ₭'
                  const valueColor = isMargin
                    ? (row.value >= 50 ? GREEN : row.value >= 30 ? GOLD : ORANGE)
                    : row.highlight
                      ? (row.value >= 0 ? GREEN : RED)
                      : row.value < 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.8)'
                  return (
                    <tr key={i} style={{
                      borderTop: row.highlight ? `1px solid ${BORDER}` : 'none',
                      borderBottom: row.highlight ? `1px solid ${BORDER}` : 'none',
                      backgroundColor: row.highlight ? `${GOLD}06` : 'transparent',
                    }}>
                      <td style={{ padding: row.highlight ? '10px 12px' : '7px 12px', color: row.indent ? 'rgba(255,255,255,0.45)' : row.highlight ? GOLD : 'rgba(255,255,255,0.75)', paddingLeft: row.indent ? 28 : 12, fontWeight: row.highlight ? 700 : 400 }}>
                        {row.label}
                        {row.dimLabel && row.dimLabel !== '%' && (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginLeft: 8 }}>{row.dimLabel}</span>
                        )}
                      </td>
                      <td style={{ padding: row.highlight ? '10px 12px' : '7px 12px', textAlign: 'right', color: valueColor, fontWeight: row.highlight ? 800 : 500, fontVariantNumeric: 'tabular-nums' }}>
                        {displayVal}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* ── 30-day cashflow table ── */}
      <div style={{ padding: 22, borderRadius: 14, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>ประวัติ Cashflow 30 วัน</div>
        {loading ? (
          <div style={{ height: 120, borderRadius: 10, backgroundColor: '#0f0f0f', animation: 'pulse 1.5s infinite' }} />
        ) : cashflow30.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)' }}>ยังไม่มีข้อมูล</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
              <thead>
                <tr style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {['วันที่', 'กะ', 'ยอดขาย (LAK)', 'เงินจริง (LAK)', 'ผลต่าง (LAK)'].map((h, i) => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: i < 2 ? 'left' : 'right', fontWeight: 500, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cashflow30.map((r, i) => {
                  const bigVar = Math.abs(r.variance_lak) > 10000
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${BORDER}22`, backgroundColor: bigVar ? `${RED}08` : 'transparent' }}>
                      <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.7)' }}>{r.log_date}</td>
                      <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.45)' }}>{shiftName(r.shift)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{r.system_sales.toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.actual_cash.toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: r.variance_lak >= 0 ? GREEN : RED, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {bigVar && <span style={{ fontSize: 10, marginRight: 4 }}>⚠</span>}
                        {r.variance_lak >= 0 ? '+' : ''}{r.variance_lak.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td colSpan={2} style={{ padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>รวม</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: GOLD, fontWeight: 700 }}>{cashflow30.reduce((s, r) => s + r.system_sales, 0).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{cashflow30.reduce((s, r) => s + r.actual_cash, 0).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: cashflow30.reduce((s, r) => s + r.variance_lak, 0) >= 0 ? GREEN : RED }}>
                    {(() => { const t = cashflow30.reduce((s, r) => s + r.variance_lak, 0); return (t >= 0 ? '+' : '') + t.toLocaleString() })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

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

// ─── Leaves View (inside Staff tab) ───────────────────────────────────────────

function LeavesView() {
  const [leaves,   setLeaves]   = useState<LeaveRequest[]>([])
  const [loading,  setLoading]  = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [noTable,  setNoTable]  = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, staff:staff_id(name)')
      .order('created_at', { ascending: false })
      .limit(100)
    if ((error as { code?: string } | null)?.code === '42P01') { setNoTable(true); setLoading(false); return }
    setLeaves((data as LeaveRequest[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    setActingId(id)
    await supabase.from('leave_requests').update({ status }).eq('id', id)
    await load()
    setActingId(null)
  }

  const leaveLabel = (t: string) => t === 'sick' ? 'ลาป่วย' : t === 'personal' ? 'ลากิจ' : t === 'vacation' ? 'ลาพักร้อน' : t
  const statusColor = (s: string) => s === 'approved' ? GREEN : s === 'rejected' ? RED : GOLD
  const statusLabel = (s: string) => s === 'approved' ? 'อนุมัติแล้ว' : s === 'rejected' ? 'ปฏิเสธแล้ว' : 'รอดำเนินการ'

  if (noTable) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
      ยังไม่มีตาราง leave_requests — กรุณา run SQL migration ก่อน
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>คำขอลาทั้งหมด {leaves.length} รายการ · รอดำเนินการ {leaves.filter(l => l.status === 'pending').length} รายการ</span>
      </div>
      {loading ? <LoadingSpinner /> : leaves.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)' }}>ไม่มีคำขอลา</div>
      ) : (
        leaves.map(lv => (
          <div key={lv.id} style={{ padding: '16px 18px', borderRadius: 12, backgroundColor: CARD, border: `1px solid ${lv.status === 'pending' ? GOLD + '33' : BORDER}`, display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{lv.staff?.name ?? lv.staff_id.slice(0, 8)}</span>
                <Badge label={leaveLabel(lv.leave_type)} bg={GOLD + '18'} color={GOLD} />
                <Badge label={statusLabel(lv.status)} bg={statusColor(lv.status) + '18'} color={statusColor(lv.status)} />
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                {lv.start_date} → {lv.end_date}
                {lv.reason && <span style={{ marginLeft: 10, color: 'rgba(255,255,255,0.3)' }}>· {lv.reason}</span>}
                <span style={{ marginLeft: 10, color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>{new Date(lv.created_at).toLocaleDateString('th-TH')}</span>
              </div>
            </div>
            {lv.status === 'pending' && (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => void updateStatus(lv.id, 'approved')} disabled={actingId === lv.id}
                  style={{ padding: '7px 16px', borderRadius: 7, border: 'none', backgroundColor: GREEN, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: actingId === lv.id ? 0.6 : 1 }}>อนุมัติ</button>
                <button onClick={() => void updateStatus(lv.id, 'rejected')} disabled={actingId === lv.id}
                  style={{ padding: '7px 14px', borderRadius: 7, border: `1px solid ${RED}44`, backgroundColor: `${RED}10`, color: RED, fontWeight: 600, fontSize: 12, cursor: 'pointer', opacity: actingId === lv.id ? 0.6 : 1 }}>ปฏิเสธ</button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ─── Recipe Cost Tab ──────────────────────────────────────────────────────────

function RecipeCostTab() {
  type SubTab = 'ingredients' | 'bases' | 'recipes' | 'pricing'
  type Ingredient  = { id: string; name: string; unit: string; pkg_size: number; pkg_cost: number }
  type BaseIngItem = { ingredient_id: string; qty: number }
  type BaseRecipe  = { id: string; name: string; unit: string; yield_qty: number; items: BaseIngItem[] }
  type FormulaItem = { ingredient_id?: string; base_id?: string; qty_normal: number; qty_less: number; qty_more: number }
  type RecipeFormula = { id: string; recipe_id: string; recipe_name: string; price_lak: number; items: FormulaItem[]; target_margin: number }

  const [sub, setSub]                 = useState<SubTab>('ingredients')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [baseRecipes, setBaseRecipes] = useState<BaseRecipe[]>([])
  const [formulas, setFormulas]       = useState<RecipeFormula[]>([])
  const [menuItems, setMenuItems]     = useState<{ id: string; product_name: string; price_lak: number }[]>([])
  const [msg, setMsg]                 = useState<string | null>(null)

  useEffect(() => {
    supabase.from('recipe_ingredients').select('*').order('name')
      .then(({ data }) => { if (data) setIngredients(data.map(r => ({ id: r.id as string, name: r.name as string, unit: r.unit as string, pkg_size: r.package_size as number, pkg_cost: r.package_cost as number }))) })
    supabase.from('recipe_base').select('*').order('name')
      .then(({ data }) => { if (data) setBaseRecipes(data.map(r => ({ id: r.id as string, name: r.name as string, unit: r.unit as string, yield_qty: r.total_yield as number, items: (r.ingredients ?? []) as BaseIngItem[] }))) })
    supabase.from('recipe_menus').select('*').order('recipe_name')
      .then(({ data }) => { if (data) setFormulas(data.map(r => ({ id: r.id as string, recipe_id: r.menu_item_id as string, recipe_name: r.recipe_name as string, price_lak: r.price_lak as number, target_margin: r.target_margin as number, items: (r.components ?? []) as FormulaItem[] }))) })
    supabase.from('recipes').select('id, product_name, price_lak').eq('is_active', true).order('product_name')
      .then(({ data }) => setMenuItems((data ?? []) as { id: string; product_name: string; price_lak: number }[]))
  }, [])

  async function upsertIngredient(ing: Ingredient): Promise<Ingredient> {
    const row = { name: ing.name, unit: ing.unit, package_size: ing.pkg_size, package_cost: ing.pkg_cost }
    if (ing.id) { await supabase.from('recipe_ingredients').upsert({ id: ing.id, ...row }); return ing }
    const { data } = await supabase.from('recipe_ingredients').insert(row).select('id').single()
    return { ...ing, id: (data as { id: string }).id }
  }
  async function removeIngredient(id: string) { await supabase.from('recipe_ingredients').delete().eq('id', id) }

  async function upsertBaseRecipe(b: BaseRecipe): Promise<BaseRecipe> {
    const yield_qty = b.items.reduce((s, i) => s + i.qty, 0)
    const row = { name: b.name, unit: b.unit, ingredients: b.items, total_yield: yield_qty }
    if (b.id) { await supabase.from('recipe_base').upsert({ id: b.id, ...row }); return { ...b, yield_qty } }
    const { data } = await supabase.from('recipe_base').insert(row).select('id').single()
    return { ...b, id: (data as { id: string }).id, yield_qty }
  }
  async function removeBaseRecipe(id: string) { await supabase.from('recipe_base').delete().eq('id', id) }

  async function upsertFormula(f: RecipeFormula): Promise<RecipeFormula> {
    const row = { menu_item_id: f.recipe_id, recipe_name: f.recipe_name, price_lak: f.price_lak, target_margin: f.target_margin, components: f.items }
    if (f.id) { await supabase.from('recipe_menus').upsert({ id: f.id, ...row }); return f }
    const { data } = await supabase.from('recipe_menus').insert(row).select('id').single()
    return { ...f, id: (data as { id: string }).id }
  }
  async function removeFormula(id: string) { await supabase.from('recipe_menus').delete().eq('id', id) }

  function calcBaseCost(base: BaseRecipe, ings: Ingredient[]): number {
    return base.items.reduce((s, item) => {
      const ing = ings.find(i => i.id === item.ingredient_id)
      return s + (ing ? item.qty * ing.pkg_cost / ing.pkg_size : 0)
    }, 0)
  }

  function calcCost(items: FormulaItem[], field: 'qty_normal' | 'qty_less' | 'qty_more', ings: Ingredient[], bases: BaseRecipe[]) {
    return items.reduce((s, item) => {
      if (item.base_id) {
        const base      = bases.find(b => b.id === item.base_id)
        if (!base) return s
        const baseYield = base.items.reduce((s2, i) => s2 + i.qty, 0)
        if (baseYield <= 0) return s
        return s + item[field] * calcBaseCost(base, ings) / baseYield
      }
      const ing = ings.find(i => i.id === item.ingredient_id)
      return s + (ing ? item[field] * ing.pkg_cost / ing.pkg_size : 0)
    }, 0)
  }

  // ── Ingredients Panel ─────────────────────────────────────────────────────
  function IngredientsPanel() {
    const [editing, setEditing] = useState<Ingredient | null>(null)
    const [form, setForm]       = useState({ name: '', unit: 'g', pkg_size: '', pkg_cost: '' })

    function startNew() { setEditing({ id: '', name: '', unit: 'g', pkg_size: 0, pkg_cost: 0 }); setForm({ name: '', unit: 'g', pkg_size: '', pkg_cost: '' }) }
    function startEdit(ing: Ingredient) { setEditing(ing); setForm({ name: ing.name, unit: ing.unit, pkg_size: String(ing.pkg_size), pkg_cost: String(ing.pkg_cost) }) }

    async function save() {
      const pkg_size = parseFloat(form.pkg_size) || 0
      const pkg_cost = parseFloat(form.pkg_cost) || 0
      if (!form.name || pkg_size <= 0 || pkg_cost <= 0) { setMsg('เกิดข้อผิดพลาด: กรอกข้อมูลให้ครบ'); return }
      const draft: Ingredient = { id: editing?.id ?? '', name: form.name, unit: form.unit, pkg_size, pkg_cost }
      const saved = await upsertIngredient(draft)
      setIngredients(prev => editing?.id ? prev.map(i => i.id === editing!.id ? saved : i) : [...prev, saved])
      setEditing(null); setMsg('บันทึกแล้ว')
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionCard title="เพิ่ม / แก้ไข วัตถุดิบ" action={<button style={btnStyle(GOLD)} onClick={startNew}>+ เพิ่มใหม่</button>}>
          {editing !== null ? (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
              <Field label="ชื่อวัตถุดิบ">
                <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น นมสด" />
              </Field>
              <Field label="หน่วย">
                <select style={inputStyle} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  <option value="g">กรัม (g)</option>
                  <option value="ml">มิลลิลิตร (ml)</option>
                  <option value="piece">ชิ้น</option>
                </select>
              </Field>
              <Field label={`ขนาดแพ็กเกจ (${form.unit})`}>
                <input style={inputStyle} type="number" min={0} value={form.pkg_size} onChange={e => setForm(f => ({ ...f, pkg_size: e.target.value }))} placeholder="เช่น 1000" />
              </Field>
              <Field label="ราคาแพ็กเกจ (₭)">
                <MoneyInput style={inputStyle} value={form.pkg_cost} onChange={v => setForm(f => ({ ...f, pkg_cost: v }))} placeholder="25,000" />
              </Field>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnStyle(GOLD)} onClick={save}>บันทึก</button>
                <button style={btnStyle('#333')} onClick={() => setEditing(null)}>ยกเลิก</button>
              </div>
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>คลิก &ldquo;+ เพิ่มใหม่&rdquo; เพื่อเพิ่มวัตถุดิบ</div>
          )}
        </SectionCard>

        <SectionCard title={`วัตถุดิบทั้งหมด (${ingredients.length})`}>
          {ingredients.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>ยังไม่มีวัตถุดิบ</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 12, padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                <span>ชื่อ</span><span>หน่วย</span><span>ขนาดแพ็ก</span><span>ราคาแพ็ก</span><span>ราคา/หน่วย</span><span></span>
              </div>
              {ingredients.map(ing => (
                <div key={ing.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 12, padding: '12px', borderRadius: 8, backgroundColor: CARD2, alignItems: 'center', fontSize: 14 }}>
                  <span style={{ fontWeight: 600 }}>{ing.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{ing.unit}</span>
                  <span>{ing.pkg_size.toLocaleString()}</span>
                  <span>{ing.pkg_cost.toLocaleString()} ₭</span>
                  <span style={{ color: GOLD, fontWeight: 700 }}>{(ing.pkg_cost / ing.pkg_size).toFixed(2)} ₭/{ing.unit}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={btnStyleSm(GOLD)} onClick={() => startEdit(ing)}>แก้ไข</button>
                    <button style={btnStyleSm(RED + '22', RED)} onClick={async () => { await removeIngredient(ing.id); setIngredients(prev => prev.filter(i => i.id !== ing.id)); setMsg('ลบแล้ว') }}>ลบ</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    )
  }

  // ── Base Recipes Panel ────────────────────────────────────────────────────
  function BaseRecipesPanel() {
    type BaseForm = { name: string; unit: string; items: BaseIngItem[] }
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm]     = useState<BaseForm>({ name: '', unit: 'ml', items: [] })

    function startNew() { setEditId('new'); setForm({ name: '', unit: 'ml', items: [] }) }
    function startEdit(b: BaseRecipe) {
      setEditId(b.id)
      setForm({ name: b.name, unit: b.unit, items: b.items.map(i => ({ ...i })) })
    }
    function addItem() {
      if (!ingredients.length) return
      setForm(f => ({ ...f, items: [...f.items, { ingredient_id: ingredients[0].id, qty: 0 }] }))
    }
    function updateItem(idx: number, patch: Partial<BaseIngItem>) {
      setForm(f => { const items = [...f.items]; items[idx] = { ...items[idx], ...patch }; return { ...f, items } })
    }
    function removeItem(idx: number) { setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) })) }

    async function save() {
      if (!form.name) { setMsg('กรอกชื่อสูตรพื้นฐาน'); return }
      const draft: BaseRecipe = { id: editId === 'new' ? '' : editId!, name: form.name, unit: form.unit, yield_qty: 0, items: form.items }
      const saved = await upsertBaseRecipe(draft)
      setBaseRecipes(prev => editId === 'new' ? [...prev, saved] : prev.map(b => b.id === editId ? saved : b))
      setEditId(null); setMsg('บันทึกแล้ว')
    }

    const previewCost  = form.items.reduce((s, item) => {
      const ing = ingredients.find(i => i.id === item.ingredient_id)
      return s + (ing ? item.qty * ing.pkg_cost / ing.pkg_size : 0)
    }, 0)
    const autoYield    = form.items.reduce((s, item) => s + item.qty, 0)
    const costPerUnit  = autoYield > 0 ? previewCost / autoYield : 0

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionCard title="สร้าง / แก้ไข สูตรพื้นฐาน" action={<button style={btnStyle(GOLD)} onClick={startNew}>+ สร้างสูตรพื้นฐาน</button>}>
          {editId !== null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, alignItems: 'end' }}>
                <Field label="ชื่อสูตรพื้นฐาน">
                  <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น นมมิกซ์, ไซรัปวนิลา" />
                </Field>
                <Field label="หน่วย">
                  <select style={inputStyle} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    <option value="ml">ml</option>
                    <option value="g">g</option>
                  </select>
                </Field>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase' }}>ส่วนผสม</span>
                  <button style={btnStyleSm('#333')} onClick={addItem} disabled={ingredients.length === 0}>+ เพิ่มวัตถุดิบ</button>
                </div>
                {form.items.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                    {ingredients.length === 0 ? 'เพิ่มวัตถุดิบในแท็บ "วัตถุดิบ" ก่อน' : 'กด "+ เพิ่มวัตถุดิบ" เพื่อใส่ส่วนผสม'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', padding: '0 4px' }}>
                      <span>วัตถุดิบ</span><span>ปริมาณ</span><span>ต้นทุน</span><span></span>
                    </div>
                    {form.items.map((item, idx) => {
                      const ing      = ingredients.find(i => i.id === item.ingredient_id)
                      const itemCost = ing ? item.qty * ing.pkg_cost / ing.pkg_size : 0
                      return (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'center' }}>
                          <select style={inputStyle} value={item.ingredient_id} onChange={e => updateItem(idx, { ingredient_id: e.target.value })}>
                            {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                          </select>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input style={{ ...inputStyle, flex: 1 }} type="number" min={0} value={item.qty} onChange={e => updateItem(idx, { qty: parseFloat(e.target.value) || 0 })} />
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{ing?.unit ?? ''}</span>
                          </div>
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{itemCost.toFixed(0)} ₭</span>
                          <button style={btnStyleSm(RED + '22', RED)} onClick={() => removeItem(idx)}>✕</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {form.items.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div style={{ backgroundColor: CARD2, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>ปริมาณรวม (อัตโนมัติ)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{autoYield.toLocaleString()} {form.unit}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>= ผลรวมส่วนผสมทั้งหมด</div>
                  </div>
                  <div style={{ backgroundColor: CARD2, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>ต้นทุนรวมต่อชุด</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>{previewCost.toFixed(0)} ₭</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>ต้นทุน ÷ {autoYield.toLocaleString()} {form.unit}</div>
                  </div>
                  <div style={{ backgroundColor: CARD2, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>ราคาต่อ{form.unit}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>{costPerUnit.toFixed(3)} ₭/{form.unit}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>คำนวณอัตโนมัติ</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnStyle(GOLD)} onClick={save}>บันทึกสูตร</button>
                <button style={btnStyle('#333')} onClick={() => setEditId(null)}>ยกเลิก</button>
              </div>
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>เช่น &ldquo;นมมิกซ์&rdquo; (นมสด + นมข้น), &ldquo;ไซรัปวนิลา&rdquo; — ใช้ซ้ำในหลายสูตรได้</div>
          )}
        </SectionCard>

        {baseRecipes.length > 0 && (
          <SectionCard title={`สูตรพื้นฐานทั้งหมด (${baseRecipes.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                <span>ชื่อ</span><span>ปริมาณที่ได้</span><span>ส่วนผสม</span><span>ราคา/หน่วย</span><span></span>
              </div>
              {baseRecipes.map(b => {
                const totalCost = calcBaseCost(b, ingredients)
                const autoQty   = b.items.reduce((s, i) => s + i.qty, 0)
                const cpUnit    = autoQty > 0 ? totalCost / autoQty : 0
                return (
                  <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, padding: '12px', borderRadius: 8, backgroundColor: CARD2, alignItems: 'center', fontSize: 14 }}>
                    <span style={{ fontWeight: 600 }}>{b.name}</span>
                    <span>{autoQty.toLocaleString()} {b.unit}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{b.items.length} รายการ</span>
                    <span style={{ color: GOLD, fontWeight: 700 }}>{cpUnit.toFixed(3)} ₭/{b.unit}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={btnStyleSm(GOLD)} onClick={() => startEdit(b)}>แก้ไข</button>
                      <button style={btnStyleSm(RED + '22', RED)} onClick={async () => { await removeBaseRecipe(b.id); setBaseRecipes(prev => prev.filter(x => x.id !== b.id)); setMsg('ลบแล้ว') }}>ลบ</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}
      </div>
    )
  }

  // ── Recipe Builder Panel ──────────────────────────────────────────────────
  function RecipesPanel() {
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm]     = useState<{ recipe_id: string; target_margin: number; items: FormulaItem[] }>({ recipe_id: '', target_margin: 60, items: [] })

    function startNew() { setEditId('new'); setForm({ recipe_id: menuItems[0]?.id ?? '', target_margin: 60, items: [] }) }
    function startEdit(f: RecipeFormula) { setEditId(f.id); setForm({ recipe_id: f.recipe_id, target_margin: f.target_margin, items: f.items.map(i => ({ ...i })) }) }
    function addRawItem() {
      if (!ingredients.length) return
      setForm(f => ({ ...f, items: [...f.items, { ingredient_id: ingredients[0].id, qty_normal: 0, qty_less: 0, qty_more: 0 }] }))
    }
    function addBaseItem() {
      if (!baseRecipes.length) return
      setForm(f => ({ ...f, items: [...f.items, { base_id: baseRecipes[0].id, qty_normal: 0, qty_less: 0, qty_more: 0 }] }))
    }
    function updateItem(idx: number, patch: Partial<FormulaItem>) {
      setForm(f => { const items = [...f.items]; items[idx] = { ...items[idx], ...patch }; return { ...f, items } })
    }
    function removeItem(idx: number) { setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) })) }

    async function save() {
      const menu = menuItems.find(m => m.id === form.recipe_id)
      if (!menu) { setMsg('เกิดข้อผิดพลาด: เลือกเมนูก่อน'); return }
      const draft: RecipeFormula = { id: editId === 'new' ? '' : editId!, recipe_id: form.recipe_id, recipe_name: menu.product_name, price_lak: menu.price_lak, items: form.items, target_margin: form.target_margin }
      const saved = await upsertFormula(draft)
      setFormulas(prev => editId === 'new' ? [...prev, saved] : prev.map(f => f.id === editId ? saved : f))
      setEditId(null); setMsg('บันทึกแล้ว')
    }

    const sweetnessFields: { field: 'qty_less' | 'qty_normal' | 'qty_more'; label: string }[] = [
      { field: 'qty_less',   label: 'หวานน้อย' },
      { field: 'qty_normal', label: 'หวานกลาง' },
      { field: 'qty_more',   label: 'หวานมาก'  },
    ]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionCard title="สร้าง / แก้ไข สูตร" action={<button style={btnStyle(GOLD)} onClick={startNew}>+ สร้างสูตรใหม่</button>}>
          {editId !== null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="เมนู">
                  <select style={inputStyle} value={form.recipe_id} onChange={e => setForm(f => ({ ...f, recipe_id: e.target.value }))}>
                    {menuItems.length === 0 && <option value="">— ยังไม่มีเมนู —</option>}
                    {menuItems.map(m => <option key={m.id} value={m.id}>{m.product_name}</option>)}
                  </select>
                </Field>
                <Field label="เป้าหมาย Gross Margin (%)">
                  <input style={inputStyle} type="number" min={0} max={99} value={form.target_margin} onChange={e => setForm(f => ({ ...f, target_margin: parseFloat(e.target.value) || 0 }))} />
                </Field>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase' }}>ส่วนผสมในสูตร</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={btnStyleSm('#333')} onClick={addRawItem} disabled={ingredients.length === 0}>+ วัตถุดิบ</button>
                    <button style={btnStyleSm(GOLD + '22', GOLD)} onClick={addBaseItem} disabled={baseRecipes.length === 0}
                      title={baseRecipes.length === 0 ? 'สร้างสูตรพื้นฐานก่อน' : ''}>+ สูตรพื้นฐาน</button>
                  </div>
                </div>
                {form.items.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                    {ingredients.length === 0 ? 'เพิ่มวัตถุดิบในแท็บ "วัตถุดิบ" ก่อน' : 'กด "+ วัตถุดิบ" หรือ "+ สูตรพื้นฐาน" เพื่อใส่ส่วนผสม'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', padding: '0 4px' }}>
                      <span>ส่วนผสม</span><span>หวานน้อย</span><span>หวานกลาง</span><span>หวานมาก</span><span></span>
                    </div>
                    {form.items.map((item, idx) => {
                      const isBase   = !!item.base_id
                      const unitLabel = isBase
                        ? (baseRecipes.find(b => b.id === item.base_id)?.unit ?? '')
                        : (ingredients.find(i => i.id === item.ingredient_id)?.unit ?? '')
                      return (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isBase && (
                              <span style={{ fontSize: 10, backgroundColor: GOLD + '22', color: GOLD, padding: '2px 6px', borderRadius: 4, flexShrink: 0, fontWeight: 600 }}>สูตร</span>
                            )}
                            <select style={{ ...inputStyle, flex: 1 }}
                              value={isBase ? item.base_id : item.ingredient_id}
                              onChange={e => updateItem(idx, isBase ? { base_id: e.target.value } : { ingredient_id: e.target.value })}>
                              {isBase
                                ? baseRecipes.map(b => <option key={b.id} value={b.id}>{b.name} ({b.unit})</option>)
                                : ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)
                              }
                            </select>
                          </div>
                          {(['qty_less', 'qty_normal', 'qty_more'] as const).map(field => (
                            <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <input style={{ ...inputStyle, flex: 1 }} type="number" min={0} value={item[field]}
                                onChange={e => updateItem(idx, { [field]: parseFloat(e.target.value) || 0 })} />
                              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{unitLabel}</span>
                            </div>
                          ))}
                          <button style={btnStyleSm(RED + '22', RED)} onClick={() => removeItem(idx)}>✕</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {form.items.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {sweetnessFields.map(({ field, label }) => {
                    const cost = calcCost(form.items, field, ingredients, baseRecipes)
                    return (
                      <div key={field} style={{ backgroundColor: CARD2, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>{cost.toFixed(0)} ₭</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>ต้นทุน/แก้ว</div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnStyle(GOLD)} onClick={save}>บันทึกสูตร</button>
                <button style={btnStyle('#333')} onClick={() => setEditId(null)}>ยกเลิก</button>
              </div>
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>คลิก &ldquo;+ สร้างสูตรใหม่&rdquo; หรือกดแก้ไขสูตรที่มีอยู่</div>
          )}
        </SectionCard>

        {formulas.length > 0 && (
          <SectionCard title={`สูตรทั้งหมด (${formulas.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {formulas.map(f => {
                const cost    = calcCost(f.items, 'qty_normal', ingredients, baseRecipes)
                const hasBase = f.items.some(i => i.base_id)
                return (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: CARD2, borderRadius: 10, padding: '14px 16px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{f.recipe_name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                        {f.items.length} ส่วนผสม · ต้นทุนหวานกลาง: <span style={{ color: GOLD }}>{cost.toFixed(0)} ₭</span>
                        {hasBase && <span style={{ color: GOLD + 'aa', marginLeft: 8 }}>· มีสูตรพื้นฐาน</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={btnStyleSm(GOLD)} onClick={() => startEdit(f)}>แก้ไข</button>
                      <button style={btnStyleSm(RED + '22', RED)} onClick={async () => { await removeFormula(f.id); setFormulas(prev => prev.filter(x => x.id !== f.id)); setMsg('ลบแล้ว') }}>ลบ</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}
      </div>
    )
  }

  // ── Pricing Advisor Panel ─────────────────────────────────────────────────
  function PricingPanel() {
    const [globalMargin, setGlobalMargin] = useState(60)
    const [vatEnabled,   setVatEnabled]   = useState(false)
    const [vatRate,      setVatRate]      = useState(10)
    const [expanded,     setExpanded]     = useState<string | null>(null)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionCard title="ตั้งค่า Margin และ VAT">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, alignItems: 'end' }}>
            <Field label="Gross Margin เป้าหมาย (%)">
              <input style={inputStyle} type="number" min={0} max={99} value={globalMargin}
                onChange={e => setGlobalMargin(parseFloat(e.target.value) || 0)} />
            </Field>
            <Field label="คิด VAT หรือไม่">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 38 }}>
                <button onClick={() => setVatEnabled(v => !v)} style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative',
                  backgroundColor: vatEnabled ? GOLD : 'rgba(255,255,255,0.12)', transition: 'background .2s',
                }}>
                  <span style={{
                    position: 'absolute', top: 3, left: vatEnabled ? 25 : 3,
                    width: 20, height: 20, borderRadius: '50%',
                    backgroundColor: vatEnabled ? BLACK : 'rgba(255,255,255,0.5)',
                    transition: 'left .2s',
                  }} />
                </button>
                <span style={{ fontSize: 13, color: vatEnabled ? GOLD : 'rgba(255,255,255,0.4)' }}>
                  {vatEnabled ? 'มี VAT' : 'ไม่มี VAT'}
                </span>
              </div>
            </Field>
            <Field label="อัตรา VAT (%)">
              <input style={{ ...inputStyle, opacity: vatEnabled ? 1 : 0.35 }} type="number"
                min={0} max={50} value={vatRate} disabled={!vatEnabled}
                onChange={e => setVatRate(parseFloat(e.target.value) || 0)} />
            </Field>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            แถวที่ Margin ต่ำกว่าเป้าจะแสดงเป็นสีแดง · คลิกแถวเพื่อดูรายละเอียดราคา
          </div>
        </SectionCard>

        {formulas.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', padding: '60px 0', fontSize: 14 }}>
            ยังไม่มีสูตร — ไปสร้างสูตรในแท็บ &ldquo;สร้างสูตร&rdquo; ก่อน
          </div>
        ) : (
          <SectionCard title="ราคาแนะนำ vs ราคาจริง">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: vatEnabled ? '2fr 1fr 1fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                <span>เมนู</span>
                <span>ต้นทุน/แก้ว</span>
                <span>แนะนำ (ไม่รวม VAT)</span>
                {vatEnabled && <span>แนะนำ (รวม VAT)</span>}
                <span>ราคาจริง</span>
                <span>Margin จริง</span>
              </div>
              {formulas.map(f => {
                const cost         = calcCost(f.items, 'qty_normal', ingredients, baseRecipes)
                const target       = f.target_margin > 0 ? f.target_margin : globalMargin
                const suggestedEx  = target < 100 ? cost / (1 - target / 100) : 0
                const suggestedInc = suggestedEx * (1 + vatRate / 100)
                const actualMargin = f.price_lak > 0 ? ((f.price_lak - cost) / f.price_lak) * 100 : 0
                const isBad        = actualMargin < target
                const isOpen       = expanded === f.id
                const profit       = suggestedEx - cost
                const vatAmt       = suggestedEx * (vatRate / 100)

                return (
                  <div key={f.id} style={{ marginBottom: 2 }}>
                    <div
                      onClick={() => setExpanded(isOpen ? null : f.id)}
                      style={{ display: 'grid', gridTemplateColumns: vatEnabled ? '2fr 1fr 1fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '14px 12px', borderRadius: isOpen ? '8px 8px 0 0' : 8, backgroundColor: isBad ? `${RED}0d` : CARD2, border: `1px solid ${isBad ? RED + '33' : isOpen ? BORDER : 'transparent'}`, borderBottom: isOpen ? 'none' : undefined, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{f.recipe_name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>เป้า {target}%{vatEnabled ? ` · VAT ${vatRate}%` : ''}</div>
                      </div>
                      <span style={{ color: GOLD }}>{cost.toFixed(0)} ₭</span>
                      <span style={{ color: GREEN }}>{suggestedEx.toFixed(0)} ₭</span>
                      {vatEnabled && <span style={{ color: GREEN, fontWeight: 700 }}>{suggestedInc.toFixed(0)} ₭</span>}
                      <span>{f.price_lak.toLocaleString()} ₭</span>
                      <span style={{ color: isBad ? RED : GREEN, fontWeight: 700 }}>{actualMargin.toFixed(1)}%</span>
                    </div>

                    {isOpen && (
                      <div style={{ backgroundColor: isBad ? `${RED}08` : '#1e1e1e', border: `1px solid ${isBad ? RED + '22' : BORDER}`, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '16px 18px' }}>
                        <div style={{ fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>รายละเอียดราคา (หวานกลาง)</div>

                        {/* Per-component breakdown */}
                        <div style={{ marginBottom: 12, padding: '10px 12px', backgroundColor: `${GOLD}08`, borderRadius: 6, border: `1px solid ${GOLD}22` }}>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>ส่วนผสม</div>
                          {f.items.map((item, idx) => {
                            if (item.base_id) {
                              const base = baseRecipes.find(b => b.id === item.base_id)
                              if (!base) return null
                              const baseYield = base.items.reduce((s, i) => s + i.qty, 0)
                              const cpUnit    = baseYield > 0 ? calcBaseCost(base, ingredients) / baseYield : 0
                              const itemCost = cpUnit * item.qty_normal
                              return (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 3 }}>
                                  <span style={{ color: GOLD }}>🧪 {base.name} × {item.qty_normal}{base.unit} <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>({cpUnit.toFixed(3)}₭/{base.unit})</span></span>
                                  <span style={{ color: GOLD }}>{itemCost.toFixed(0)} ₭</span>
                                </div>
                              )
                            }
                            const ing      = ingredients.find(i => i.id === item.ingredient_id)
                            if (!ing) return null
                            const itemCost = (ing.pkg_cost / ing.pkg_size) * item.qty_normal
                            return (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 3 }}>
                                <span>{ing.name} × {item.qty_normal}{ing.unit}</span>
                                <span>{itemCost.toFixed(0)} ₭</span>
                              </div>
                            )
                          })}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[
                            { label: 'ต้นทุน',           value: cost,         color: RED   },
                            { label: 'กำไร (Margin)',     value: profit,       color: GREEN },
                            { label: 'ราคาก่อน VAT',     value: suggestedEx,  color: '#fff' },
                            ...(vatEnabled ? [
                              { label: `VAT ${vatRate}%`, value: vatAmt,       color: ORANGE },
                              { label: 'ราคาสุดท้าย',    value: suggestedInc, color: GOLD   },
                            ] : []),
                          ].map((row, i, arr) => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 6, backgroundColor: i === arr.length - 1 ? `${GOLD}12` : 'transparent', borderTop: i === arr.length - 1 && vatEnabled ? `1px solid ${BORDER}` : 'none' }}>
                              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{row.label}</span>
                              <span style={{ fontSize: 14, fontWeight: i === arr.length - 1 ? 700 : 500, color: row.color }}>{row.value.toFixed(0)} ₭</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}
      </div>
    )
  }

  const subs: { id: SubTab; label: string }[] = [
    { id: 'ingredients', label: 'วัตถุดิบ'     },
    { id: 'bases',       label: 'สูตรพื้นฐาน' },
    { id: 'recipes',     label: 'สร้างสูตร'    },
    { id: 'pricing',     label: 'แนะนำราคา'   },
  ]

  return (
    <div>
      <Toast msg={msg} />
      <div style={{ display: 'flex', marginBottom: 28, borderBottom: `1px solid ${BORDER}` }}>
        {subs.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)} style={{
            padding: '8px 22px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            backgroundColor: 'transparent',
            color: sub === s.id ? GOLD : 'rgba(255,255,255,0.4)',
            borderBottom: sub === s.id ? `2px solid ${GOLD}` : '2px solid transparent',
            marginBottom: -1,
          }}>{s.label}</button>
        ))}
      </div>
      {sub === 'ingredients' && <IngredientsPanel />}
      {sub === 'bases'       && <BaseRecipesPanel />}
      {sub === 'recipes'     && <RecipesPanel />}
      {sub === 'pricing'     && <PricingPanel />}
    </div>
  )
}

// ─── Nav + Main Layout ─────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard',  label: 'Dashboard',   icon: '📊' },
  { id: 'menu',       label: 'เมนู',         icon: '🍽️' },
  { id: 'categories', label: 'หมวดหมู่',    icon: '🗂️' },
  { id: 'stock',      label: 'สต็อก',       icon: '📦' },
  { id: 'settings',   label: 'ตั้งค่า',     icon: '⚙️' },
  { id: 'staff',      label: 'พนักงาน',     icon: '👥' },
  { id: 'customers',  label: 'ลูกค้า',      icon: '🧑‍🤝‍🧑' },
  { id: 'purchase',   label: 'การซื้อ',     icon: '🧾' },
  { id: 'finance',    label: 'การเงิน',     icon: '💰' },
  { id: 'ai',          label: 'AI Analyst',  icon: '✨' },
  { id: 'audit',       label: 'Audit Log',   icon: '🔍' },
  { id: 'recipe-cost', label: 'ต้นทุนสูตร',  icon: '🧮' },
]

export default function CafeClient() {
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: BLACK, color: '#fff', fontFamily: 'var(--font-body, Inter, sans-serif)' }}>
      {/* ── Sidebar ── */}
      <div style={{ width: 220, flexShrink: 0, backgroundColor: DARK, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', padding: '32px 0' }}>
        <div style={{ padding: '0 24px 32px' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: '-0.5px' }}>ALAN</div>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: '4px', textTransform: 'uppercase' }}>CAFE OS</div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', backgroundColor: tab === item.id ? `${GOLD}18` : 'transparent', color: tab === item.id ? GOLD : 'rgba(255,255,255,0.42)', fontSize: 14, fontWeight: tab === item.id ? 600 : 400, textAlign: 'left', transition: 'all .15s' }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
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
        {tab === 'dashboard'  && <DashboardTab />}
        {tab === 'menu'       && <MenuTab />}
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'stock'      && <StockTab />}
        {tab === 'settings'   && <SettingsTab />}
        {tab === 'staff'      && <StaffTab />}
        {tab === 'customers'  && <CustomersTab />}
        {tab === 'purchase'   && <PurchaseTab />}
        {tab === 'finance'    && <FinanceTab />}
        {tab === 'ai'          && <AITab />}
        {tab === 'audit'       && <AuditTab />}
        {tab === 'recipe-cost' && <RecipeCostTab />}
      </div>
    </div>
  )
}
