'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = {
  id: string
  name: string
  name_lo: string | null
  parent_id: string | null
  sort_order: number
}

type Recipe = {
  id: string
  product_name: string
  product_name_lo: string | null
  category: string | null
  category_id: string | null
  price_lak: number
}

type CartItem = {
  cartKey: string
  recipe: Recipe
  qty: number
  customization: string
}

type ChargeStatus = 'idle' | 'loading' | 'success' | 'error'

type QueueEntry = {
  order_id: string
  queue_number: number
  queue_status: string | null
  summary: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GOLD = '#c9a84c'
const BLACK = '#0f0f0f'

function fmtLak(n: number): string {
  return n.toLocaleString('en-US') + ' LAK'
}

function fmtQueue(n: number): string {
  return '#' + String(n).padStart(3, '0')
}

function translateError(msg: string): string {
  if (msg.includes('Insufficient stock')) {
    const match = msg.match(/"([^"]+)"/)
    const ingredient = match?.[1] ?? 'วัตถุดิบ'
    return `วัตถุดิบไม่เพียงพอ: ${ingredient}`
  }
  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
    return 'ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่'
  }
  if (msg.includes('JWT') || msg.includes('auth')) {
    return 'หมดเวลา กรุณาเข้าสู่ระบบใหม่'
  }
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่'
}

// ─── QtyButton ────────────────────────────────────────────────────────────────

function QtyButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 28, height: 28, borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.14)',
        backgroundColor: 'transparent', color: '#fff',
        fontWeight: 700, fontSize: 16, lineHeight: 1,
        cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {label}
    </button>
  )
}

// ─── Customization Popup ──────────────────────────────────────────────────────

const SWEETNESS_OPTIONS = ['หวานปกติ', 'หวานน้อย', 'ไม่หวาน']
const TEMP_OPTIONS      = ['ร้อน', 'เย็น', 'อุ่น']

function CustomPopup({
  recipe,
  onConfirm,
  onClose,
}: {
  recipe: Recipe
  onConfirm: (customization: string) => void
  onClose: () => void
}) {
  const [sweetness, setSweetness] = useState('หวานปกติ')
  const [temp, setTemp]           = useState('ร้อน')
  const [note, setNote]           = useState('')
  const overlayRef                = useRef<HTMLDivElement>(null)

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleConfirm() {
    const parts = [sweetness, temp]
    if (note.trim()) parts.push(note.trim())
    onConfirm(parts.join(' · '))
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        backgroundColor: '#1a1a1a',
        border: `1px solid ${GOLD}44`,
        borderRadius: 12, padding: 28, width: 340,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>
              {recipe.product_name}
            </div>
            {recipe.product_name_lo && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                {recipe.product_name_lo}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
              fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px',
              marginLeft: 12, flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Sweetness */}
        <div>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.4)',
            letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8,
          }}>
            ความหวาน
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {SWEETNESS_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setSweetness(opt)}
                style={{
                  flex: 1, padding: '7px 4px', borderRadius: 6, border: 'none',
                  backgroundColor: sweetness === opt ? GOLD : 'rgba(255,255,255,0.07)',
                  color: sweetness === opt ? BLACK : 'rgba(255,255,255,0.55)',
                  fontWeight: sweetness === opt ? 700 : 500,
                  fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Temperature */}
        <div>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.4)',
            letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8,
          }}>
            อุณหภูมิ
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {TEMP_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setTemp(opt)}
                style={{
                  flex: 1, padding: '7px 4px', borderRadius: 6, border: 'none',
                  backgroundColor: temp === opt ? GOLD : 'rgba(255,255,255,0.07)',
                  color: temp === opt ? BLACK : 'rgba(255,255,255,0.55)',
                  fontWeight: temp === opt ? 700 : 500,
                  fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.4)',
            letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8,
          }}>
            หมายเหตุ
          </div>
          <input
            type="text"
            placeholder="เช่น ไม่ใส่น้ำแข็ง, extra shot..."
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)',
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: '#fff', fontSize: 13, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Confirm */}
        <button
          onClick={handleConfirm}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 6, border: 'none',
            backgroundColor: GOLD, color: BLACK,
            fontWeight: 800, fontSize: 14, letterSpacing: '1.5px',
            textTransform: 'uppercase', cursor: 'pointer',
            fontFamily: 'var(--font-heading)',
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function POSClient() {
  const [recipes, setRecipes]             = useState<Recipe[]>([])
  const [categories, setCategories]       = useState<Category[]>([])
  const [loading, setLoading]             = useState(true)
  const [cart, setCart]                   = useState<CartItem[]>([])
  const [activeL1, setActiveL1]           = useState<string>('All')
  const [activeL2, setActiveL2]           = useState<string | null>(null)
  const [now, setNow]                     = useState(new Date())
  const [chargeStatus, setChargeStatus]   = useState<ChargeStatus>('idle')
  const [queueNumber, setQueueNumber]     = useState<number | null>(null)
  const [errorMessage, setErrorMessage]   = useState<string>('')
  const [pendingRecipe, setPendingRecipe] = useState<Recipe | null>(null)
  const [queueEntries, setQueueEntries]   = useState<QueueEntry[]>([])

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Fetch categories
  useEffect(() => {
    supabase
      .from('categories')
      .select('id, name, name_lo, parent_id, sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setCategories((data as Category[]) ?? []))
  }, [])

  // Fetch menu
  useEffect(() => {
    supabase
      .from('recipes')
      .select('id, product_name, product_name_lo, category, category_id, price_lak')
      .eq('is_active', true)
      .order('category')
      .then(({ data }) => {
        setRecipes((data as Recipe[]) ?? [])
        setLoading(false)
      })
  }, [])

  // L1 categories (no parent)
  const l1Categories = useMemo(
    () => categories.filter(c => c.parent_id === null),
    [categories]
  )

  // Children of active L1
  const l2Categories = useMemo(() => {
    if (activeL1 === 'All') return []
    return categories.filter(c => c.parent_id === activeL1)
  }, [categories, activeL1])

  function selectL1(id: string) {
    setActiveL1(id)
    setActiveL2(null)
  }

  // All category IDs under a parent (recursive — supports future L3+)
  function getFamilyIds(parentId: string): string[] {
    const children = categories.filter(c => c.parent_id === parentId)
    return [parentId, ...children.flatMap(c => getFamilyIds(c.id))]
  }

  // Filtered recipes
  const filtered = useMemo(() => {
    if (activeL1 === 'All') return recipes
    if (activeL2) return recipes.filter(r => r.category_id === activeL2)
    const familyIds = getFamilyIds(activeL1)
    return recipes.filter(r => r.category_id && familyIds.includes(r.category_id))
  }, [recipes, activeL1, activeL2, categories])

  const subtotal   = cart.reduce((s, i) => s + i.recipe.price_lak * i.qty, 0)
  const totalItems = cart.reduce((s, i) => s + i.qty, 0)

  // Cart actions
  function addToCartWithCustomization(recipe: Recipe, customization: string) {
    const cartKey = `${recipe.id}::${customization}`
    setCart(prev => {
      const existing = prev.find(i => i.cartKey === cartKey)
      if (existing) return prev.map(i => i.cartKey === cartKey ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { cartKey, recipe, qty: 1, customization }]
    })
    setPendingRecipe(null)
  }

  function decrement(cartKey: string) {
    setCart(prev => {
      const item = prev.find(i => i.cartKey === cartKey)
      if (!item) return prev
      if (item.qty <= 1) return prev.filter(i => i.cartKey !== cartKey)
      return prev.map(i => i.cartKey === cartKey ? { ...i, qty: i.qty - 1 } : i)
    })
  }

  // ── Charge ──────────────────────────────────────────────────────────────────
  async function handleCharge() {
    if (cart.length === 0) return
    setChargeStatus('loading')
    setErrorMessage('')

    const cartPayload = cart.map(item => ({
      recipe_id:       item.recipe.id,
      qty:             item.qty,
      unit_price_lak:  item.recipe.price_lak,
      customization:   item.customization || null,
    }))

    const { data, error } = await supabase.rpc('create_order_with_deduction', {
      p_cart: cartPayload,
    })

    if (error) {
      setChargeStatus('error')
      setErrorMessage(translateError(error.message))
      setTimeout(() => setChargeStatus('idle'), 4000)
      return
    }

    const result = data as { order_id: string; queue_number: number }
    setQueueNumber(result.queue_number)
    setCart([])
    setChargeStatus('success')
    setTimeout(() => {
      setChargeStatus('idle')
      setQueueNumber(null)
    }, 3000)
  }

  // ── Today's Queue ────────────────────────────────────────────────────────────
  const fetchTodayQueue = useCallback(async () => {
    console.log('[POS Queue] calling rpc get_today_pos_queue ...')
    const { data, error } = await supabase.rpc('get_today_pos_queue')
    console.log('[POS Queue] data:', data, '| error:', error)
    if (error) return
    // Keep only waiting/making — guard against stale realtime payload arriving after status changed
    const active = ((data as QueueEntry[]) ?? []).filter(
      e => e.queue_status === null || e.queue_status === 'waiting' || e.queue_status === 'making'
    )
    console.log('[POS Queue] active entries:', active)
    setQueueEntries(active)
  }, [])

  useEffect(() => { fetchTodayQueue() }, [fetchTodayQueue])

  // Realtime: re-fetch queue on any orders change
  useEffect(() => {
    const ch = supabase
      .channel('pos-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchTodayQueue)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchTodayQueue])

  async function updateQueueStatus(orderId: string, status: string) {
    await supabase.rpc('update_queue_status', { p_order_id: orderId, p_status: status })
    fetchTodayQueue() // instant local refresh (realtime also fires shortly after)
  }

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      backgroundColor: BLACK, color: '#fff',
      fontFamily: 'var(--font-body, Inter, sans-serif)',
      overflow: 'hidden',
    }}>

      {/* Customization popup */}
      {pendingRecipe && (
        <CustomPopup
          recipe={pendingRecipe}
          onConfirm={customization => addToCartWithCustomization(pendingRecipe, customization)}
          onClose={() => setPendingRecipe(null)}
        />
      )}

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 52,
        backgroundColor: '#111', borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'var(--font-heading)', fontWeight: 800,
            fontSize: 17, color: '#fff', letterSpacing: '-0.5px',
          }}>
            ALAN
          </span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: GOLD }} />
          <span style={{
            color: 'rgba(255,255,255,0.35)', fontSize: 11,
            letterSpacing: '2.5px', textTransform: 'uppercase',
          }}>
            Cafe OS · POS
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{dateStr}</span>
          <span style={{ color: GOLD, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
            {timeStr}
          </span>
        </div>
      </header>

      {/* ── MAIN SPLIT ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT: MENU ───────────────────────────────────────────────── */}
        <div style={{
          flex: '1 1 0', display: 'flex', flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
        }}>

          {/* L1 Category filter */}
          <div style={{
            display: 'flex', gap: 6, padding: '10px 16px',
            backgroundColor: '#111',
            borderBottom: l2Categories.length > 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0, overflowX: 'auto',
          }}>
            <button
              onClick={() => selectL1('All')}
              style={{
                padding: '5px 15px', borderRadius: 999, border: 'none', flexShrink: 0,
                backgroundColor: activeL1 === 'All' ? GOLD : 'rgba(255,255,255,0.07)',
                color: activeL1 === 'All' ? BLACK : 'rgba(255,255,255,0.5)',
                fontWeight: activeL1 === 'All' ? 700 : 500,
                fontSize: 12, letterSpacing: '0.5px', cursor: 'pointer',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              All
            </button>
            {l1Categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => selectL1(cat.id)}
                style={{
                  padding: '5px 15px', borderRadius: 999, border: 'none', flexShrink: 0,
                  backgroundColor: activeL1 === cat.id ? GOLD : 'rgba(255,255,255,0.07)',
                  color: activeL1 === cat.id ? BLACK : 'rgba(255,255,255,0.5)',
                  fontWeight: activeL1 === cat.id ? 700 : 500,
                  fontSize: 12, letterSpacing: '0.5px', cursor: 'pointer',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* L2 Category filter */}
          {l2Categories.length > 0 && (
            <div style={{
              display: 'flex', gap: 6, padding: '6px 16px 8px',
              backgroundColor: '#111', borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0, overflowX: 'auto',
            }}>
              {l2Categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveL2(activeL2 === cat.id ? null : cat.id)}
                  style={{
                    padding: '4px 13px', borderRadius: 999, flexShrink: 0,
                    border: `1px solid ${activeL2 === cat.id ? GOLD : 'rgba(255,255,255,0.12)'}`,
                    backgroundColor: activeL2 === cat.id ? `${GOLD}22` : 'transparent',
                    color: activeL2 === cat.id ? GOLD : 'rgba(255,255,255,0.45)',
                    fontWeight: activeL2 === cat.id ? 700 : 500,
                    fontSize: 11, letterSpacing: '0.5px', cursor: 'pointer',
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Recipe grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 108, borderRadius: 8 }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 80, color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
                No items in this category
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12 }}>
                {filtered.map(recipe => (
                  <MenuCard key={recipe.id} recipe={recipe} onAdd={() => setPendingRecipe(recipe)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: CART ──────────────────────────────────────────────── */}
        <div style={{
          width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column',
          backgroundColor: '#111', position: 'relative',
        }}>

          {/* Queue success overlay */}
          {chargeStatus === 'success' && queueNumber !== null && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              backgroundColor: 'rgba(10,10,10,0.94)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 14,
            }}>
              <div style={{
                fontSize: 13, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '3px', textTransform: 'uppercase',
              }}>
                คิวของคุณ
              </div>
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 80, fontWeight: 900,
                color: GOLD, letterSpacing: '-2px',
                lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtQueue(queueNumber)}
              </div>
              <div style={{ fontSize: 28 }}>✅</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                บันทึกออเดอร์เรียบร้อย
              </div>
            </div>
          )}

          {/* Cart header */}
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
              Order{totalItems > 0 && (
                <span style={{ color: GOLD, marginLeft: 6 }}>({totalItems})</span>
              )}
            </span>
            {cart.length > 0 && chargeStatus === 'idle' && (
              <button
                onClick={() => setCart([])}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 12, cursor: 'pointer', padding: '2px 6px' }}
              >
                Clear all
              </button>
            )}
          </div>

          {/* Cart items */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'rgba(255,255,255,0.18)' }}>
                <span style={{ fontSize: 36 }}>☕</span>
                <span style={{ fontSize: 13 }}>Tap an item to add</span>
              </div>
            ) : (
              cart.map(item => (
                <div
                  key={item.cartKey}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', backgroundColor: '#1a1a1a',
                    borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.recipe.product_name}
                    </div>
                    <div style={{
                      fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.customization}
                    </div>
                    <div style={{ fontSize: 12, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtLak(item.recipe.price_lak * item.qty)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <QtyButton label="−" onClick={() => decrement(item.cartKey)} />
                    <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                      {item.qty}
                    </span>
                    <QtyButton label="+" onClick={() => addToCartWithCustomization(item.recipe, item.customization)} />
                  </div>

                  <button
                    onClick={() => setCart(prev => prev.filter(i => i.cartKey !== item.cartKey))}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.22)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Cart footer */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>

            {/* Error message */}
            {chargeStatus === 'error' && errorMessage && (
              <div style={{
                marginBottom: 10, padding: '10px 14px',
                backgroundColor: 'rgba(220,50,50,0.12)',
                border: '1px solid rgba(220,50,50,0.3)',
                borderRadius: 6, fontSize: 13, color: '#ff7a7a',
                lineHeight: 1.4,
              }}>
                {errorMessage}
              </div>
            )}

            {/* Total row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase' }}>
                Total
              </span>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                {fmtLak(subtotal)}
              </span>
            </div>

            {/* Charge button */}
            <button
              onClick={handleCharge}
              disabled={cart.length === 0 || chargeStatus === 'loading'}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 6, border: 'none',
                backgroundColor:
                  chargeStatus === 'loading' ? 'rgba(201,168,76,0.4)'
                  : chargeStatus === 'error'   ? 'rgba(255,255,255,0.06)'
                  : cart.length > 0            ? GOLD
                  :                              'rgba(255,255,255,0.06)',
                color:
                  chargeStatus === 'loading' ? GOLD
                  : chargeStatus === 'error'   ? 'rgba(255,255,255,0.25)'
                  : cart.length > 0            ? BLACK
                  :                              'rgba(255,255,255,0.18)',
                fontWeight: 800, fontSize: 14, letterSpacing: '1.5px',
                textTransform: 'uppercase',
                cursor: (cart.length > 0 && chargeStatus !== 'loading') ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-heading)', transition: 'all 0.2s',
              }}
            >
              {chargeStatus === 'loading'
                ? 'กำลังบันทึก...'
                : chargeStatus === 'error'
                  ? 'ลองใหม่'
                  : cart.length > 0
                    ? `Charge ${fmtLak(subtotal)}`
                    : 'No Items'}
            </button>
          </div>

          {/* ── QUEUE SECTION ────────────────────────────────────────────── */}
          <div style={{
            flexShrink: 0, display: 'flex', flexDirection: 'column',
            borderTop: '2px solid rgba(255,255,255,0.07)',
            maxHeight: 230, backgroundColor: '#0e0e0e',
          }}>

            {/* Queue header */}
            <div style={{
              padding: '7px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '2px',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
              }}>
                คิววันนี้
              </span>
              {queueEntries.length > 0 && (
                <span style={{
                  fontSize: 11, color: GOLD, fontWeight: 700,
                  backgroundColor: `${GOLD}18`, padding: '1px 8px', borderRadius: 999,
                }}>
                  {queueEntries.length}
                </span>
              )}
            </div>

            {/* Queue list */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {queueEntries.length === 0 ? (
                <div style={{
                  padding: '12px 14px', textAlign: 'center',
                  color: 'rgba(255,255,255,0.15)', fontSize: 12,
                }}>
                  ยังไม่มีคิว
                </div>
              ) : (
                queueEntries.map(entry => (
                  <div
                    key={entry.order_id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    {/* Queue number + status label */}
                    <div style={{ flexShrink: 0, minWidth: 44 }}>
                      <div style={{
                        fontFamily: 'var(--font-heading)', fontWeight: 800,
                        fontSize: 13, fontVariantNumeric: 'tabular-nums',
                        color: entry.queue_status === 'making' ? GOLD : 'rgba(255,255,255,0.45)',
                      }}>
                        {fmtQueue(entry.queue_number)}
                      </div>
                      <div style={{
                        fontSize: 9, letterSpacing: '0.5px', marginTop: 1,
                        color: entry.queue_status === 'making' ? `${GOLD}99` : 'rgba(255,255,255,0.2)',
                      }}>
                        {entry.queue_status === 'making' ? 'กำลังทำ' : 'รอคิว'}
                      </div>
                    </div>

                    {/* Summary */}
                    <div style={{
                      flex: 1, minWidth: 0, fontSize: 11,
                      color: 'rgba(255,255,255,0.38)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {entry.summary || '—'}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      <button
                        onClick={() => updateQueueStatus(entry.order_id, 'making')}
                        disabled={entry.queue_status === 'making'}
                        title="เริ่มทำ"
                        style={{
                          width: 28, height: 28, borderRadius: 6, border: 'none',
                          backgroundColor: entry.queue_status === 'making'
                            ? 'rgba(255,255,255,0.03)'
                            : `${GOLD}20`,
                          color: entry.queue_status === 'making'
                            ? 'rgba(255,255,255,0.12)'
                            : GOLD,
                          fontSize: 13, cursor: entry.queue_status === 'making' ? 'default' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                      >
                        🔄
                      </button>
                      <button
                        onClick={() => updateQueueStatus(entry.order_id, 'ready')}
                        title="พร้อมแล้ว"
                        style={{
                          width: 28, height: 28, borderRadius: 6, border: 'none',
                          backgroundColor: 'rgba(76,186,127,0.1)',
                          color: '#4cba7f',
                          fontSize: 13, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                      >
                        ✅
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Menu Card ────────────────────────────────────────────────────────────────

function MenuCard({ recipe, onAdd }: { recipe: Recipe; onAdd: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onAdd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered ? '#1e1b13' : '#1a1a1a',
        border: `1px solid ${hovered ? GOLD : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 8, padding: '14px 12px', textAlign: 'left',
        cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 7,
        transition: 'all 0.15s', width: '100%',
      }}
    >
      {recipe.category && (
        <span style={{
          fontSize: 10, color: GOLD, letterSpacing: '1.5px',
          textTransform: 'uppercase', fontWeight: 600,
        }}>
          {recipe.category}
        </span>
      )}

      <span style={{
        fontSize: 14, fontWeight: 700, color: '#fff',
        lineHeight: 1.3, fontFamily: 'var(--font-heading)',
      }}>
        {recipe.product_name}
      </span>

      {recipe.product_name_lo && (
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.2 }}>
          {recipe.product_name_lo}
        </span>
      )}

      <span style={{
        fontSize: 15, fontWeight: 800, color: GOLD,
        marginTop: 4, fontVariantNumeric: 'tabular-nums',
      }}>
        {recipe.price_lak.toLocaleString('en-US')}
        <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 3, opacity: 0.75 }}>LAK</span>
      </span>
    </button>
  )
}
