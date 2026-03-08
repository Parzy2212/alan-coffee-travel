'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type QueueOrder = {
  id: string
  queue_number: number
  queue_status: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD  = '#c9a84c'
const GREEN = '#4cba7f'
const BLACK = '#0a0a0a'

const TICKER_TEXT =
  'ยินดีต้อนรับสู่ Alan Coffee & Travel   •   ' +
  'ออเดอร์ที่เสร็จแล้วกรุณารับภายใน 10 นาที   •   ' +
  'Wi-Fi: AlanCoffee   •   ' +
  'ขอบคุณที่ใช้บริการ — Thank you for visiting!   •   '

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtQueue(n: number): string {
  return '#' + String(n).padStart(3, '0')
}

function todayVientiane(): string {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Vientiane' }) // YYYY-MM-DD
}

// ─── Queue Number Card ────────────────────────────────────────────────────────

function QueueCard({ number, color }: { number: number; color: string }) {
  return (
    <div style={{
      padding: '22px 32px',
      borderRadius: 14,
      border: `2px solid ${color}55`,
      backgroundColor: `${color}10`,
      fontFamily: 'var(--font-heading)',
      fontSize: 'clamp(56px, 6vw, 96px)',
      fontWeight: 900,
      color,
      letterSpacing: '-2px',
      fontVariantNumeric: 'tabular-nums',
      lineHeight: 1,
      userSelect: 'none',
    }}>
      {fmtQueue(number)}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptySlot() {
  return (
    <div style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      color: 'rgba(255,255,255,0.08)',
      fontFamily: 'var(--font-heading)',
      fontSize: 'clamp(80px, 10vw, 140px)',
      fontWeight: 900,
      letterSpacing: '-4px',
      userSelect: 'none',
    }}>
      —
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QueueClient() {
  const [orders, setOrders] = useState<QueueOrder[]>([])
  const [now, setNow]       = useState<Date | null>(null)
  const makingEndRef        = useRef<HTMLDivElement>(null)
  const readyEndRef         = useRef<HTMLDivElement>(null)

  // Live clock — starts after mount to avoid hydration mismatch
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Fetch today's active queues directly from orders table.
  // RLS policy (migration 011) allows anon to read paid orders with
  // queue_status IN ('waiting','making','ready') for today.
  const fetchQueues = useCallback(async () => {
    const today = todayVientiane()
    console.log('[Queue TV] fetching — today:', today)
    const { data, error } = await supabase
      .from('orders')
      .select('id, queue_number, queue_status')
      .eq('status', 'paid')
      .in('queue_status', ['making', 'ready'])
      .gte('created_at', today + 'T00:00:00+07:00')
      .lt('created_at',  today + 'T23:59:59+07:00')
      .order('queue_number', { ascending: true })
    console.log('[Queue TV] data:', data, '| error:', error)
    if (error) return
    setOrders((data as QueueOrder[]) ?? [])
  }, [])

  useEffect(() => { fetchQueues() }, [fetchQueues])

  // Realtime: listen to INSERT and UPDATE on orders — no page refresh needed
  useEffect(() => {
    console.log('[Queue] subscribing to realtime orders...')
    const channel = supabase
      .channel('queue-display')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => { console.log('[Queue] INSERT:', payload.new); fetchQueues() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => { console.log('[Queue] UPDATE:', payload.new); fetchQueues() })
      .subscribe((status) => { console.log('[Queue] subscription status:', status) })
    return () => { supabase.removeChannel(channel) }
  }, [fetchQueues])

  const making = orders.filter(o => o.queue_status === 'making')
  const ready  = orders.filter(o => o.queue_status === 'ready')

  // Auto-scroll to latest queue card when list changes
  useEffect(() => {
    makingEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [making.length])

  useEffect(() => {
    readyEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [ready.length])

  const timeStr = now
    ? now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Vientiane' })
    : ''
  const dateStr = now
    ? now.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Vientiane' })
    : ''

  return (
    <div style={{
      display: 'flex', height: '100vh',
      backgroundColor: BLACK, color: '#fff',
      fontFamily: 'var(--font-body, Inter, sans-serif)',
      overflow: 'hidden',
    }}>

      {/* Ticker keyframe + hide scrollbars globally for this page */}
      <style>{`
        @keyframes queue-ticker {
          0%   { transform: translateX(0) }
          100% { transform: translateX(-50%) }
        }
        .queue-ticker-track {
          display: inline-block;
          white-space: nowrap;
          animation: queue-ticker 28s linear infinite;
        }
        .queue-col::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── LEFT PANEL (30%) — Shop info ─────────────────────────────────── */}
      <div style={{
        width: '30%', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        borderRight: `2px solid ${GOLD}28`,
        backgroundColor: '#060606',
      }}>

        {/* Shop identity */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 28px', gap: 0,
        }}>

          {/* Circle logo */}
          <div style={{
            width: 'clamp(80px, 9vw, 130px)',
            height: 'clamp(80px, 9vw, 130px)',
            borderRadius: '50%',
            border: `3px solid ${GOLD}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}>
            <span style={{
              fontFamily: 'var(--font-heading)', fontWeight: 900,
              fontSize: 'clamp(28px, 4vw, 52px)', color: GOLD, lineHeight: 1,
            }}>
              A
            </span>
          </div>

          {/* Name */}
          <div style={{
            fontFamily: 'var(--font-heading)', fontWeight: 900,
            fontSize: 'clamp(28px, 3.5vw, 52px)', color: '#fff',
            letterSpacing: '-1px', lineHeight: 1, textAlign: 'center',
          }}>
            ALAN
          </div>
          <div style={{
            fontSize: 'clamp(10px, 1.1vw, 15px)', color: GOLD,
            letterSpacing: '6px', textTransform: 'uppercase',
            marginTop: 6, marginBottom: 28,
          }}>
            COFFEE
          </div>

          {/* Divider */}
          <div style={{ width: 48, height: 2, backgroundColor: `${GOLD}55`, marginBottom: 28 }} />

          {/* Date */}
          <div style={{
            textAlign: 'center', color: 'rgba(255,255,255,0.45)',
            fontSize: 'clamp(11px, 1.2vw, 16px)', lineHeight: 1.8,
            marginBottom: 16,
          }}>
            {dateStr}
          </div>

          {/* Time */}
          <div style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(40px, 5.5vw, 80px)',
            fontWeight: 900, color: GOLD,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-2px', lineHeight: 1,
            marginBottom: 28,
          }}>
            {timeStr}
          </div>

          {/* Divider */}
          <div style={{ width: 48, height: 2, backgroundColor: `${GOLD}55`, marginBottom: 20 }} />

          <div style={{
            color: 'rgba(255,255,255,0.18)', fontSize: 'clamp(9px, 1vw, 13px)',
            letterSpacing: '3px', textTransform: 'uppercase',
          }}>
            QUEUE DISPLAY
          </div>
        </div>

        {/* Ticker strip */}
        <div style={{
          height: 52, flexShrink: 0,
          backgroundColor: `${GOLD}12`,
          borderTop: `1px solid ${GOLD}30`,
          display: 'flex', alignItems: 'center',
          overflow: 'hidden',
        }}>
          {/* Duplicate text so seamless loop at exactly 50% */}
          <span className="queue-ticker-track" style={{
            fontSize: 'clamp(11px, 1.2vw, 14px)',
            color: `${GOLD}bb`,
          }}>
            {TICKER_TEXT}{TICKER_TEXT}
          </span>
        </div>
      </div>

      {/* ── RIGHT PANEL (70%) — Queue columns ────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Column headers */}
        <div style={{
          display: 'flex', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: '#0d0d0d',
        }}>
          <div style={{
            flex: 1, padding: '22px 0', textAlign: 'center',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{
              fontSize: 'clamp(14px, 1.6vw, 22px)',
              letterSpacing: '2px', textTransform: 'uppercase',
              fontWeight: 700, color: GOLD,
            }}>
              🔄&nbsp; กำลังทำ
            </span>
          </div>
          <div style={{ flex: 1, padding: '22px 0', textAlign: 'center' }}>
            <span style={{
              fontSize: 'clamp(14px, 1.6vw, 22px)',
              letterSpacing: '2px', textTransform: 'uppercase',
              fontWeight: 700, color: GREEN,
            }}>
              ✅&nbsp; รับได้แล้ว
            </span>
          </div>
        </div>

        {/* Queue number area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Making column */}
          <div
            className="queue-col"
            style={{
              flex: 1,
              borderRight: '1px solid rgba(255,255,255,0.06)',
              padding: '28px 20px',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 18,
              alignContent: 'flex-start',
            } as React.CSSProperties}
          >
            {making.length === 0
              ? <EmptySlot />
              : making.map(o => (
                  <QueueCard key={o.id} number={o.queue_number} color={GOLD} />
                ))
            }
            <div ref={makingEndRef} />
          </div>

          {/* Ready column */}
          <div
            className="queue-col"
            style={{
              flex: 1,
              padding: '28px 20px',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 18,
              alignContent: 'flex-start',
            } as React.CSSProperties}
          >
            {ready.length === 0
              ? <EmptySlot />
              : ready.map(o => (
                  <QueueCard key={o.id} number={o.queue_number} color={GREEN} />
                ))
            }
            <div ref={readyEndRef} />
          </div>
        </div>

        {/* Bottom status bar */}
        <div style={{
          height: 38, flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.04)',
          backgroundColor: '#080808',
          display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: 24,
        }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Live
          </span>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            backgroundColor: '#4cba7f',
            boxShadow: '0 0 6px #4cba7f',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
            กำลังทำ {making.length} คิว
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.12)' }}>·</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
            รับได้แล้ว {ready.length} คิว
          </span>
        </div>
      </div>
    </div>
  )
}
