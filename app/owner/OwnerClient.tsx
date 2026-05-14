'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  fetchTodayStats, fmtLakShort, fmtTimeAgo, pctVsYesterday, parseVTETime,
  type TodayStats,
} from '@/lib/today-stats'

// ─── Design tokens ────────────────────────────────────────────────────────────
const GOLD   = '#c9a84c'
const BLACK  = '#0a0a0a'
const CARD   = '#141414'
const CARD2  = '#1a1a1a'
const BORDER = 'rgba(201,168,76,0.14)'
const GREEN  = '#4cba7f'
const RED    = '#ff6b6b'
const ORANGE = '#f59e0b'

// ─── Types ────────────────────────────────────────────────────────────────────
type FeedItem = {
  id:           string
  queue_number: number
  total_lak:    number
  created_at_vt: string
  items:        { name: string; qty: number }[]
  status:       string
}

type WeekDay = { label: string; revenue: number; isToday: boolean }

type StockAlert = { name: string; qty: number; unit: string; daysLeft: number | null }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtLak(n: number): string {
  return new Intl.NumberFormat('th-TH').format(n) + ' ₭'
}

function timeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function greeting(name: string | undefined): string {
  const first = name?.split(' ')[0] ?? 'Alan'
  switch (timeOfDay()) {
    case 'morning':   return `ສະບາຍດີ ${first}! Ready to brew? ☕`
    case 'afternoon': return `Good afternoon, ${first}!`
    default:          return `Wrapping up, ${first}?`
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeroCard({ stats }: { stats: TodayStats | null }) {
  const ch = stats && stats.yesterdayRevenue > 0
    ? pctVsYesterday(stats.revenueLak, stats.yesterdayRevenue)
    : null

  return (
    <div style={{
      background: `linear-gradient(135deg, #1a1500 0%, #111 60%, ${CARD} 100%)`,
      border: `1px solid ${GOLD}33`,
      borderRadius: 18, padding: '28px 24px', marginBottom: 16,
    }}>
      <div style={{ fontSize: 13, color: `${GOLD}99`, marginBottom: 6 }}>Alan Cafe — Today</div>
      <div style={{ fontSize: 42, fontWeight: 900, color: GOLD, lineHeight: 1, marginBottom: 6, fontFamily: 'var(--font-heading, serif)', fontVariantNumeric: 'tabular-nums' }}>
        {stats ? fmtLakShort(stats.revenueLak) : '—'}
      </div>
      {ch && (
        <div style={{ fontSize: 14, fontWeight: 700, color: ch.up ? GREEN : RED, marginBottom: 10 }}>
          {ch.up ? '▲' : '▼'} {ch.pct}% vs yesterday
        </div>
      )}
      <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{stats?.orderCount ?? '—'}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>orders</div>
        </div>
        {(stats?.cupsServed ?? 0) > 0 && (
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{stats?.cupsServed}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>cups served</div>
          </div>
        )}
        {(stats?.avgOrderValue ?? 0) > 0 && (
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{fmtLakShort(stats!.avgOrderValue)}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>avg order</div>
          </div>
        )}
      </div>
    </div>
  )
}

function QuickActions() {
  const actions = [
    { label: 'Open POS',      href: '/pos',       icon: '🛒', primary: true },
    { label: "Today's Report", href: '/cafe',      icon: '📊', primary: false },
    { label: 'Stock Check',   href: '/cafe',       icon: '📦', primary: false },
    { label: 'Customers',     href: '/cafe',       icon: '👥', primary: false },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
      {actions.map(a => (
        <a
          key={a.label}
          href={a.href}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 16px', borderRadius: 14, textDecoration: 'none',
            backgroundColor: a.primary ? GOLD : CARD2,
            border: `1px solid ${a.primary ? GOLD : BORDER}`,
            color: a.primary ? BLACK : 'rgba(255,255,255,0.8)',
            fontSize: 13, fontWeight: a.primary ? 800 : 600,
            transition: 'opacity 0.15s',
          }}
        >
          <span style={{ fontSize: 18 }}>{a.icon}</span>
          {a.label}
        </a>
      ))}
    </div>
  )
}

function LiveFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) return null
  return (
    <Section title="Live Feed" icon="⚡">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.slice(0, 5).map((order, i) => {
          const preview = (order.items ?? [])
            .slice(0, 2)
            .map(it => `${it.qty > 1 ? `${it.qty}× ` : ''}${it.name}`)
            .join(', ') + ((order.items?.length ?? 0) > 2 ? ` +${(order.items?.length ?? 0) - 2}` : '')

          return (
            <div key={order.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  ☕ {preview || 'Order'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                  {fmtTimeAgo(order.created_at_vt)}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, flexShrink: 0, marginLeft: 12 }}>
                {fmtLakShort(order.total_lak)}
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function Highlights({ stats }: { stats: TodayStats }) {
  const items = [
    stats.topItem        && { label: 'Top seller',    value: stats.topItem, sub: `${stats.topItemQty} sold` },
    stats.peakHour != null && { label: 'Peak hour',    value: `${stats.peakHour}:00`, sub: 'so far today' },
    stats.newCustomers > 0 && { label: 'New customers', value: String(stats.newCustomers), sub: 'today' },
  ].filter(Boolean) as { label: string; value: string; sub: string }[]

  if (items.length === 0) return null

  return (
    <Section title="Today's Highlights" icon="✨">
      {items.map(it => (
        <div key={it.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{it.label}</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{it.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{it.sub}</div>
          </div>
        </div>
      ))}
    </Section>
  )
}

function WeekChart({ days }: { days: WeekDay[] }) {
  const max = Math.max(...days.map(d => d.revenue), 1)
  return (
    <Section title="This Week" icon="📈">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64 }}>
        {days.map(d => {
          const pct = d.revenue / max
          return (
            <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 9, color: d.revenue > 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)' }}>
                {d.revenue > 0 ? fmtLakShort(d.revenue).replace(' ₭','') : ''}
              </div>
              <div style={{
                width: '100%', borderRadius: '4px 4px 2px 2px',
                height: `${Math.max(pct * 44, d.revenue > 0 ? 4 : 0)}px`,
                backgroundColor: d.isToday ? GOLD : (d.revenue > 0 ? `${GOLD}44` : 'rgba(255,255,255,0.06)'),
                minHeight: 2, transition: 'height 0.3s ease',
              }} />
              <div style={{ fontSize: 9, color: d.isToday ? GOLD : 'rgba(255,255,255,0.3)', fontWeight: d.isToday ? 700 : 400 }}>
                {d.label}
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function StockWarnings({ alerts }: { alerts: StockAlert[] }) {
  if (alerts.length === 0) return null
  return (
    <Section title="Stock Warnings" icon="⚠️">
      {alerts.map(a => (
        <div key={a.name} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '9px 12px', borderRadius: 10, marginBottom: 6,
          backgroundColor: a.daysLeft != null && a.daysLeft <= 1 ? `${RED}0f` : `${ORANGE}0a`,
          border: `1px solid ${a.daysLeft != null && a.daysLeft <= 1 ? `${RED}30` : `${ORANGE}25`}`,
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{a.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              {a.qty} {a.unit} remaining
            </div>
          </div>
          {a.daysLeft != null && (
            <div style={{ fontSize: 11, color: a.daysLeft <= 1 ? RED : ORANGE, fontWeight: 700 }}>
              {a.daysLeft === 0 ? 'Today' : `${a.daysLeft}d`}
            </div>
          )}
        </div>
      ))}
    </Section>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '16px 18px', marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: `${GOLD}99`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{icon}</span> {title}
      </div>
      {children}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function OwnerClient() {
  const { user } = useAuth()
  const [stats,      setStats]      = useState<TodayStats | null>(null)
  const [feed,       setFeed]       = useState<FeedItem[]>([])
  const [weekDays,   setWeekDays]   = useState<WeekDay[]>([])
  const [stockAlerts,setStockAlerts]= useState<StockAlert[]>([])
  const [loading,    setLoading]    = useState(true)
  const displayName = user?.user_metadata?.full_name as string | undefined

  const loadStats = useCallback(async () => {
    try {
      const s = await fetchTodayStats()
      setStats(s)
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  const loadFeed = useCallback(async () => {
    try {
      const { data } = await supabase.rpc('get_today_orders')
      if (data) {
        const orders = (data as FeedItem[])
          .filter(o => o.status === 'paid')
          .sort((a, b) =>
            parseVTETime(b.created_at_vt).getTime() - parseVTETime(a.created_at_vt).getTime()
          )
        setFeed(orders)
      }
    } catch { /* silent */ }
  }, [])

  const loadWeek = useCallback(async () => {
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const days: WeekDay[] = []
    const todayDow = new Date().getDay()

    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const vteMs    = d.getTime() + 7 * 3600_000
      const dayStart = Math.floor(vteMs / 86_400_000) * 86_400_000
      const gteStr   = new Date(dayStart - 7 * 3600_000).toISOString()
      const ltStr    = new Date(dayStart + 86_400_000 - 7 * 3600_000).toISOString()

      const { data } = await supabase.from('orders')
        .select('total_lak')
        .eq('status', 'paid').neq('is_test', true)
        .gte('created_at', gteStr).lt('created_at', ltStr)

      const revenue = (data ?? []).reduce((s: number, o: { total_lak: unknown }) => s + Number(o.total_lak ?? 0), 0)
      days.push({ label: DAY_LABELS[d.getDay()], revenue, isToday: i === 0 })
    }
    setWeekDays(days)
  }, [])

  const loadStock = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('inventory')
        .select('name, current_qty, unit, reorder_point, daily_usage')
        .eq('is_active', true)
        .order('current_qty')
        .limit(5)

      if (!data) return
      const alerts = data
        .filter((item: { current_qty: number; reorder_point: number | null }) =>
          item.reorder_point != null && item.current_qty <= item.reorder_point
        )
        .map((item: { name: string; current_qty: number; unit: string; daily_usage: number | null }) => ({
          name:     item.name,
          qty:      Math.round(item.current_qty * 10) / 10,
          unit:     item.unit,
          daysLeft: item.daily_usage && item.daily_usage > 0
            ? Math.floor(item.current_qty / item.daily_usage)
            : null,
        }))
      setStockAlerts(alerts)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    Promise.all([loadStats(), loadFeed(), loadWeek(), loadStock()])
    const channel = supabase
      .channel('owner_orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        loadStats(); loadFeed()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        loadStats(); loadFeed()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadStats, loadFeed, loadWeek, loadStock])

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: BLACK, color: '#fff',
      fontFamily: 'var(--font-body, Inter, sans-serif)',
      maxWidth: 480, margin: '0 auto', padding: '0 0 80px',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        backgroundColor: `${BLACK}ee`, backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${BORDER}`,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 20, color: '#fff', letterSpacing: '-0.5px' }}>ALAN</div>
          <div style={{ fontSize: 10, color: GOLD, letterSpacing: '3px', textTransform: 'uppercase' }}>OWNER</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/cafe" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Dashboard</a>
          <a href="/pos"  style={{ fontSize: 12, color: GOLD, fontWeight: 700, textDecoration: 'none' }}>POS →</a>
        </div>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        {/* Greeting */}
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 18, fontStyle: 'italic' }}>
          {greeting(displayName)}
        </div>

        {/* Hero */}
        {loading
          ? <div style={{ height: 180, borderRadius: 18, backgroundColor: CARD, marginBottom: 16, border: `1px solid ${BORDER}` }} />
          : <HeroCard stats={stats} />
        }

        {/* Quick Actions */}
        <QuickActions />

        {/* Live Feed */}
        {feed.length > 0 && <LiveFeed items={feed} />}

        {/* Highlights */}
        {stats && stats.orderCount > 0 && <Highlights stats={stats} />}

        {/* Week Chart */}
        {weekDays.length > 0 && <WeekChart days={weekDays} />}

        {/* Stock Warnings */}
        {stockAlerts.length > 0 && <StockWarnings alerts={stockAlerts} />}

        {/* Footer links */}
        <div style={{ textAlign: 'center', padding: '20px 0', display: 'flex', justifyContent: 'center', gap: 20 }}>
          <a href="/cafe"  style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', textDecoration: 'none' }}>Full Dashboard</a>
          <a href="/pos"   style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', textDecoration: 'none' }}>POS</a>
          <a href="/queue" style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', textDecoration: 'none' }}>Queue TV</a>
        </div>
      </div>
    </div>
  )
}
