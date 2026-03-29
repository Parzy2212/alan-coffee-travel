'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderItem = {
  qty: number
  customization: string | null
  recipes: { product_name: string } | null
}

type QueueOrder = {
  id: string
  queue_number: number
  queue_status: string
  customer_name: string | null
  order_items: OrderItem[]
}

type QueueSettings = {
  shop_name: string
  queue_ticker_text: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD  = '#c9a84c'
const GREEN = '#4cba7f'
const BLACK = '#0a0a0a'

const DEFAULT_TICKER =
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
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Vientiane' })
}

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.7)
  } catch { /* Web Audio unavailable */ }
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order, color, isNew,
}: {
  order: QueueOrder
  color: string
  isNew: boolean
}) {
  return (
    <div style={{
      padding: '18px 20px',
      borderRadius: 14,
      border: `2px solid ${color}${isNew ? '99' : '44'}`,
      backgroundColor: `${color}${isNew ? '18' : '0c'}`,
      boxShadow: isNew ? `0 0 28px ${color}33` : 'none',
      transition: 'box-shadow 1.2s ease, background-color 1.2s ease, border-color 1.2s ease',
      animation: 'queueSlideIn 0.35s cubic-bezier(0.22,1,0.36,1)',
      minWidth: 'clamp(180px, 22vw, 280px)',
      flex: '0 0 auto',
    }}>
      {/* Queue number */}
      <div style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'clamp(44px, 5.5vw, 80px)',
        fontWeight: 900,
        color,
        letterSpacing: '-2px',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
        userSelect: 'none',
      }}>
        {fmtQueue(order.queue_number)}
      </div>

      {/* Customer name */}
      {order.customer_name && (
        <div style={{
          fontSize: 'clamp(12px, 1.3vw, 17px)',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.75)',
          marginTop: 8,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {order.customer_name}
        </div>
      )}

      {/* Divider */}
      {order.order_items.length > 0 && (
        <div style={{ height: 1, backgroundColor: `${color}30`, margin: '10px 0' }} />
      )}

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {order.order_items.map((item, i) => (
          <div key={i} style={{ fontSize: 'clamp(10px, 1.1vw, 14px)', color: `${color}cc`, lineHeight: 1.4 }}>
            <span style={{ fontWeight: 700 }}>{item.qty}×</span>{' '}
            {item.recipes?.product_name ?? '—'}
            {item.customization && (
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.9em' }}>
                {' '}· {item.customization}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptySlot() {
  return (
    <div style={{
      width: '100%', flex: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(255,255,255,0.05)',
      fontFamily: 'var(--font-heading)',
      fontSize: 'clamp(60px, 9vw, 120px)',
      fontWeight: 900, letterSpacing: '-4px', userSelect: 'none',
    }}>
      —
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QueueClient() {
  const [orders,   setOrders]   = useState<QueueOrder[]>([])
  const [settings, setSettings] = useState<QueueSettings | null>(null)
  const [now,      setNow]      = useState<Date | null>(null)
  const [newlyReadyIds, setNewlyReadyIds] = useState<Set<string>>(new Set())

  const makingEndRef      = useRef<HTMLDivElement>(null)
  const readyEndRef       = useRef<HTMLDivElement>(null)
  const fetchCountRef     = useRef(0)
  const prevReadyIdsRef   = useRef<Set<string>>(new Set())

  // Live clock
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Load settings
  useEffect(() => {
    supabase.rpc('get_site_settings').then(({ data }) => {
      if (data) {
        setSettings({
          shop_name:          (data.shop_name as string) || 'ALAN COFFEE',
          queue_ticker_text:  (data.queue_ticker_text as string) || '',
        })
      }
    })
  }, [])

  // Fetch orders with nested items
  const fetchQueues = useCallback(async () => {
    const today = todayVientiane()
    const { data, error } = await supabase
      .from('orders')
      .select('id, queue_number, queue_status, customer_name, order_items(qty, customization, recipes(product_name))')
      .eq('status', 'paid')
      .in('queue_status', ['making', 'ready'])
      .gte('created_at', today + 'T00:00:00+07:00')
      .lt('created_at',  today + 'T23:59:59+07:00')
      .order('queue_number', { ascending: true })
    if (error) return
    setOrders((data as unknown as QueueOrder[]) ?? [])
    fetchCountRef.current += 1
  }, [])

  useEffect(() => { fetchQueues() }, [fetchQueues])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('queue-display')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
        () => fetchQueues())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => fetchQueues())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchQueues])

  const making = orders.filter(o => o.queue_status === 'making')
  const ready  = orders.filter(o => o.queue_status === 'ready')

  // Auto-scroll
  useEffect(() => {
    makingEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [making.length])
  useEffect(() => {
    readyEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [ready.length])

  // Beep + mark newly ready
  useEffect(() => {
    const currentIds = new Set(ready.map(o => o.id))
    if (fetchCountRef.current > 1) {
      const newIds: string[] = []
      for (const id of currentIds) {
        if (!prevReadyIdsRef.current.has(id)) { newIds.push(id); playBeep() }
      }
      if (newIds.length > 0) {
        setNewlyReadyIds(prev => {
          const next = new Set(prev)
          newIds.forEach(id => next.add(id))
          return next
        })
        // Remove glow after 3 s
        setTimeout(() => {
          setNewlyReadyIds(prev => {
            const next = new Set(prev)
            newIds.forEach(id => next.delete(id))
            return next
          })
        }, 3000)
      }
    }
    prevReadyIdsRef.current = currentIds
  }, [ready])

  const shopName   = settings?.shop_name ?? 'ALAN COFFEE'
  const tickerText = settings?.queue_ticker_text || DEFAULT_TICKER
  const tickerFull = tickerText + '   •   ' + tickerText + '   •   '

  const timeStr = now
    ? now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Vientiane' })
    : ''
  const dateStr = now
    ? now.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Vientiane' })
    : ''

  const firstLetter = shopName.trim()[0]?.toUpperCase() ?? 'A'

  return (
    <div style={{
      display: 'flex', height: '100vh',
      backgroundColor: BLACK, color: '#fff',
      fontFamily: 'var(--font-body, Inter, sans-serif)',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes queue-ticker {
          0%   { transform: translateX(0) }
          100% { transform: translateX(-50%) }
        }
        @keyframes queueSlideIn {
          from { opacity: 0; transform: translateY(-14px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .queue-ticker-track {
          display: inline-block;
          white-space: nowrap;
          animation: queue-ticker 32s linear infinite;
        }
        .queue-col::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── LEFT PANEL (28%) — Shop identity ─────────────────────────────── */}
      <div style={{
        width: '28%', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        borderRight: `2px solid ${GOLD}22`,
        backgroundColor: '#060606',
      }}>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 28px', gap: 0, textAlign: 'center',
        }}>
          {/* Logo circle */}
          <div style={{
            width: 'clamp(72px, 9vw, 120px)',
            height: 'clamp(72px, 9vw, 120px)',
            borderRadius: '50%',
            border: `3px solid ${GOLD}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 22,
          }}>
            <span style={{
              fontFamily: 'var(--font-heading)', fontWeight: 900,
              fontSize: 'clamp(26px, 4vw, 50px)', color: GOLD, lineHeight: 1,
            }}>
              {firstLetter}
            </span>
          </div>

          {/* Shop name */}
          <div style={{
            fontFamily: 'var(--font-heading)', fontWeight: 900,
            fontSize: 'clamp(20px, 3vw, 42px)', color: '#fff',
            letterSpacing: '-1px', lineHeight: 1.1,
          }}>
            {shopName.toUpperCase()}
          </div>

          {/* Divider */}
          <div style={{ width: 48, height: 2, backgroundColor: `${GOLD}44`, margin: '22px 0' }} />

          {/* Date */}
          <div style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: 'clamp(10px, 1.1vw, 15px)', lineHeight: 1.9,
            marginBottom: 12,
          }}>
            {dateStr}
          </div>

          {/* Time */}
          <div style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(36px, 5.5vw, 76px)',
            fontWeight: 900, color: GOLD,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-2px', lineHeight: 1,
            marginBottom: 24,
          }}>
            {timeStr}
          </div>

          {/* Divider */}
          <div style={{ width: 48, height: 2, backgroundColor: `${GOLD}44`, marginBottom: 16 }} />

          <div style={{
            color: 'rgba(255,255,255,0.15)', fontSize: 'clamp(8px, 0.9vw, 12px)',
            letterSpacing: '4px', textTransform: 'uppercase',
          }}>
            QUEUE DISPLAY
          </div>
        </div>

        {/* Ticker */}
        <div style={{
          height: 50, flexShrink: 0,
          backgroundColor: `${GOLD}10`,
          borderTop: `1px solid ${GOLD}28`,
          display: 'flex', alignItems: 'center',
          overflow: 'hidden',
        }}>
          <span className="queue-ticker-track" style={{
            fontSize: 'clamp(11px, 1.1vw, 14px)',
            color: `${GOLD}aa`,
          }}>
            {tickerFull}
          </span>
        </div>
      </div>

      {/* ── RIGHT PANEL (72%) — Queue columns ─────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Column headers */}
        <div style={{
          display: 'flex', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          backgroundColor: '#0d0d0d',
        }}>
          <div style={{
            flex: 1, padding: '20px 0', textAlign: 'center',
            borderRight: '1px solid rgba(255,255,255,0.07)',
          }}>
            <span style={{
              fontSize: 'clamp(13px, 1.6vw, 22px)',
              letterSpacing: '2px', textTransform: 'uppercase',
              fontWeight: 700, color: GOLD,
            }}>
              🔄&nbsp; กำลังทำ
            </span>
            {making.length > 0 && (
              <span style={{
                marginLeft: 10, fontSize: 'clamp(11px, 1.2vw, 16px)',
                color: `${GOLD}66`, fontVariantNumeric: 'tabular-nums',
              }}>
                ({making.length})
              </span>
            )}
          </div>
          <div style={{ flex: 1, padding: '20px 0', textAlign: 'center' }}>
            <span style={{
              fontSize: 'clamp(13px, 1.6vw, 22px)',
              letterSpacing: '2px', textTransform: 'uppercase',
              fontWeight: 700, color: GREEN,
            }}>
              ✅&nbsp; พร้อมแล้ว
            </span>
            {ready.length > 0 && (
              <span style={{
                marginLeft: 10, fontSize: 'clamp(11px, 1.2vw, 16px)',
                color: `${GREEN}66`, fontVariantNumeric: 'tabular-nums',
              }}>
                ({ready.length})
              </span>
            )}
          </div>
        </div>

        {/* Queue area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Making column */}
          <div
            className="queue-col"
            style={{
              flex: 1,
              borderRight: '1px solid rgba(255,255,255,0.06)',
              padding: '24px 20px',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignContent: 'flex-start',
            } as React.CSSProperties}
          >
            {making.length === 0
              ? <EmptySlot />
              : making.map(o => (
                  <OrderCard key={o.id} order={o} color={GOLD} isNew={false} />
                ))
            }
            <div ref={makingEndRef} />
          </div>

          {/* Ready column */}
          <div
            className="queue-col"
            style={{
              flex: 1,
              padding: '24px 20px',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignContent: 'flex-start',
            } as React.CSSProperties}
          >
            {ready.length === 0
              ? <EmptySlot />
              : ready.map(o => (
                  <OrderCard key={o.id} order={o} color={GREEN} isNew={newlyReadyIds.has(o.id)} />
                ))
            }
            <div ref={readyEndRef} />
          </div>
        </div>

        {/* Status bar */}
        <div style={{
          height: 38, flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.04)',
          backgroundColor: '#080808',
          display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: 20,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#4cba7f', boxShadow: '0 0 6px #4cba7f', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Live
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>กำลังทำ {making.length} คิว</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.12)' }}>·</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>พร้อมแล้ว {ready.length} คิว</span>
        </div>
      </div>
    </div>
  )
}
