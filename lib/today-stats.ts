'use client'

import { supabase } from '@/lib/supabase'

export type TodayStats = {
  orderCount:      number
  revenueLak:      number
  cupsServed:      number
  lastOrderAt:     string | null  // raw created_at_vt string from RPC
  avgOrderValue:   number
  topItem:         string | null
  topItemQty:      number
  peakHour:        number | null
  newCustomers:    number
  yesterdayRevenue: number
  weekAgoRevenue:  number
}

type RawOrder = {
  id:            string
  queue_number:  number
  status:        string
  total_lak:     number
  customer_name: string | null
  created_at_vt: string
  items:         { name: string; qty: number }[]
}

// Returns a UTC-offset ISO date string for N days ago in VTE timezone
function vteDateBounds(daysAgo: number): { gte: string; lt: string } {
  const d = new Date()
  // Shift to VTE (UTC+7), truncate to day, then shift back
  const vteMs = d.getTime() + 7 * 3600_000
  const dayMs = 86_400_000
  const startVteMs = Math.floor(vteMs / dayMs - daysAgo) * dayMs
  const endVteMs   = startVteMs + dayMs
  return {
    gte: new Date(startVteMs - 7 * 3600_000).toISOString(),
    lt:  new Date(endVteMs   - 7 * 3600_000).toISOString(),
  }
}

// Format LAK compactly: 456000 → "456K ₭"
export function fmtLakShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₭`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K ₭`
  return `${n} ₭`
}

// Parse the created_at_vt string returned by get_today_orders RPC.
// It may be an ISO string, a "HH:MM" time string, or a locale-formatted time.
export function parseVTETime(vt: string): Date {
  // Try ISO first (most likely)
  const d = new Date(vt)
  if (!isNaN(d.getTime())) return d

  // Try "HH:MM" or "H:MM" — assume today in VTE
  const m = vt.match(/^(\d{1,2}):(\d{2})/)
  if (m) {
    const now = new Date()
    const vteBase = now.getTime() + 7 * 3600_000
    const midnight = Math.floor(vteBase / 86_400_000) * 86_400_000
    return new Date(midnight + Number(m[1]) * 3600_000 + Number(m[2]) * 60_000 - 7 * 3600_000)
  }

  return new Date()
}

export function fmtTimeAgo(vt: string | null): string {
  if (!vt) return '—'
  const diff = (Date.now() - parseVTETime(vt).getTime()) / 60_000
  if (diff < 1)  return 'Just now'
  if (diff < 60) return `${Math.round(diff)} min ago`
  return `${Math.round(diff / 60)}h ago`
}

export function pctVsYesterday(today: number, yesterday: number): { pct: number; up: boolean } | null {
  if (yesterday === 0) return null
  const pct = Math.round(((today - yesterday) / yesterday) * 100)
  return { pct: Math.abs(pct), up: pct >= 0 }
}

export async function fetchTodayStats(): Promise<TodayStats> {
  // Primary: use the existing get_today_orders RPC (returns items + time)
  const { data: rawData, error: rpcErr } = await supabase.rpc('get_today_orders')
  const orders = ((rpcErr ? [] : rawData) ?? []) as RawOrder[]
  const paid   = orders.filter(o => o.status === 'paid')

  const revenueLak = paid.reduce((s, o) => s + Number(o.total_lak ?? 0), 0)

  // Sort paid by time descending to find last order
  const sorted = [...paid].sort((a, b) =>
    parseVTETime(b.created_at_vt).getTime() - parseVTETime(a.created_at_vt).getTime()
  )
  const lastOrderAt = sorted[0]?.created_at_vt ?? null

  // Cups + top item + peak hour
  let cupsServed = 0
  const itemCounts: Record<string, number> = {}
  const hourCounts: Record<number, number> = {}

  for (const order of paid) {
    for (const item of (order.items ?? [])) {
      const qty = Number(item.qty ?? 1)
      cupsServed += qty
      const name = item.name ?? 'Unknown'
      itemCounts[name] = (itemCounts[name] ?? 0) + qty
    }
    const h = parseVTETime(order.created_at_vt).getHours()
    hourCounts[h] = (hourCounts[h] ?? 0) + 1
  }

  const topEntry   = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0]
  const topItem    = topEntry?.[0] ?? null
  const topItemQty = topEntry?.[1] ?? 0
  const peakHourEntry = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0]
  const peakHour   = peakHourEntry ? Number(peakHourEntry[0]) : null

  // Yesterday and 7-days-ago comparisons
  const { gte: yGte, lt: yLt } = vteDateBounds(1)
  const { gte: wGte, lt: wLt } = vteDateBounds(7)

  const [yRes, wRes] = await Promise.all([
    supabase.from('orders').select('total_lak')
      .eq('status', 'paid').neq('is_test', true)
      .gte('created_at', yGte).lt('created_at', yLt),
    supabase.from('orders').select('total_lak')
      .eq('status', 'paid').neq('is_test', true)
      .gte('created_at', wGte).lt('created_at', wLt),
  ])

  const yesterdayRevenue = (yRes.data ?? []).reduce((s, o) => s + Number(o.total_lak ?? 0), 0)
  const weekAgoRevenue   = (wRes.data ?? []).reduce((s, o) => s + Number(o.total_lak ?? 0), 0)

  return {
    orderCount:       paid.length,
    revenueLak,
    cupsServed,
    lastOrderAt,
    avgOrderValue:    paid.length > 0 ? Math.round(revenueLak / paid.length) : 0,
    topItem,
    topItemQty,
    peakHour,
    newCustomers:     0,
    yesterdayRevenue,
    weekAgoRevenue,
  }
}
