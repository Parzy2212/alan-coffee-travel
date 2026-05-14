'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchTodayStats, fmtLakShort, fmtTimeAgo, pctVsYesterday, type TodayStats } from '@/lib/today-stats'

const GOLD   = '#c9a84c'
const GREEN  = '#4cba7f'
const RED    = '#ff6b6b'
const DARK   = '#111'
const BORDER = 'rgba(201,168,76,0.14)'

function fmtHour(h: number): string {
  if (h === 0)  return '12 AM'
  if (h < 12)   return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

// Compact change badge: ▲ +18% or ▼ -5%
function ChangeBadge({ today, yesterday }: { today: number; yesterday: number }) {
  const ch = pctVsYesterday(today, yesterday)
  if (!ch) return null
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, marginLeft: 6,
      color: ch.up ? GREEN : RED,
    }}>
      {ch.up ? '▲' : '▼'} {ch.pct}%
    </span>
  )
}

// Expanded popover panel
function StatsPopover({ stats, onClose }: { stats: TodayStats; onClose: () => void }) {
  const rows: { label: string; value: string | number; sub?: string }[] = [
    { label: 'Revenue today',     value: fmtLakShort(stats.revenueLak),
      sub: stats.yesterdayRevenue > 0 ? `vs ${fmtLakShort(stats.yesterdayRevenue)} yesterday` : undefined },
    { label: 'Orders',            value: stats.orderCount },
    { label: 'Cups served',       value: stats.cupsServed },
    { label: 'Avg order value',   value: fmtLakShort(stats.avgOrderValue) },
    { label: 'Top item',          value: stats.topItem ?? '—',
      sub: stats.topItemQty > 0 ? `${stats.topItemQty} sold` : undefined },
    { label: 'Peak hour so far',  value: stats.peakHour != null ? fmtHour(stats.peakHour) : '—' },
    { label: 'Last sale',         value: fmtTimeAgo(stats.lastOrderAt) },
  ]
  if (stats.weekAgoRevenue > 0) {
    rows.push({ label: 'Same day last week', value: fmtLakShort(stats.weekAgoRevenue) })
  }

  return (
    <div
      style={{
        position: 'absolute', top: 'calc(100% + 6px)', left: 0,
        backgroundColor: '#1a1a1a',
        border: '1px solid rgba(201,168,76,0.22)',
        borderRadius: 12, padding: '14px 18px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 200, minWidth: 280,
        animation: 'statsPop 0.16s cubic-bezier(0.25,0.46,0.45,0.94) both',
      }}
      onClick={e => e.stopPropagation()}
    >
      <style>{`
        @keyframes statsPop {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div style={{ fontSize: 11, color: `${GOLD}88`, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 10, fontWeight: 600 }}>
        Today&apos;s Snapshot
      </div>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{r.label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', textAlign: 'right' }}>
            {r.value}
            {r.sub && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'block', fontWeight: 400 }}>{r.sub}</span>}
          </span>
        </div>
      ))}
      <button
        onClick={onClose}
        style={{
          marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.25)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        Close ×
      </button>
    </div>
  )
}

export function TodayStatsBar() {
  const [stats,   setStats]   = useState<TodayStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [open,    setOpen]    = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const s = await fetchTodayStats()
      setStats(s)
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Refresh every 30s
    const interval = setInterval(load, 30_000)

    // Live refresh when a new order arrives
    const channel = supabase
      .channel('stats_bar_orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => { load() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => { load() })
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [load])

  // Close popover on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (loading) {
    return (
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        backgroundColor: '#0e0e0e',
        borderBottom: `1px solid ${BORDER}`,
        padding: '8px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        opacity: 0.4, height: 38,
      }}>
        <div style={{ width: 180, height: 12, borderRadius: 6, backgroundColor: 'rgba(201,168,76,0.1)' }} />
      </div>
    )
  }

  // Show "เริ่มขายวันนี้" when no orders yet
  if (!stats || stats.orderCount === 0) {
    return (
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        backgroundColor: '#0e0e0e',
        borderBottom: `1px solid ${BORDER}`,
        padding: '8px 24px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 13 }}>🏪</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', fontStyle: 'italic' }}>
          เริ่มขายวันนี้ — no orders yet
        </span>
      </div>
    )
  }

  const ch = stats.yesterdayRevenue > 0 ? pctVsYesterday(stats.revenueLak, stats.yesterdayRevenue) : null

  return (
    <div ref={wrapRef} style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          backgroundColor: '#0e0e0e',
          borderBottom: `1px solid ${open ? 'rgba(201,168,76,0.3)' : BORDER}`,
          borderTop: 'none', borderLeft: 'none', borderRight: 'none',
          padding: '7px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
          cursor: 'pointer', fontFamily: 'inherit',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#131313')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0e0e0e')}
      >
        {/* Left: branding */}
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
          🏪 Alan Cafe
        </span>
        <div style={{ width: 1, height: 16, backgroundColor: BORDER, flexShrink: 0 }} />

        {/* Center: key stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
            📊 <strong style={{ color: '#fff' }}>{stats.orderCount}</strong> orders
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
            <strong style={{ color: GOLD }}>{fmtLakShort(stats.revenueLak)}</strong>
            {ch && (
              <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 5, color: ch.up ? GREEN : RED }}>
                {ch.up ? '▲' : '▼'}{ch.pct}%
              </span>
            )}
          </span>
          {stats.cupsServed > 0 && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
              ☕ <strong style={{ color: '#fff' }}>{stats.cupsServed}</strong> cups
            </span>
          )}
        </div>

        {/* Right: last sale */}
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          ⏰ {fmtTimeAgo(stats.lastOrderAt)}
        </span>
        <span style={{ fontSize: 10, color: `${GOLD}55`, flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && <StatsPopover stats={stats} onClose={() => setOpen(false)} />}
    </div>
  )
}
