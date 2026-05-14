'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { MoneyInput } from '@/components/MoneyInput'
import { PinPad } from '@/components/pos/PinPad'
import { ActiveEmployeeBadge } from '@/components/pos/ActiveEmployeeBadge'
import { OrderSuccess } from '@/components/pos/OrderSuccess'
import { ReceiptPreview } from '@/components/pos/ReceiptPreview'
import { KeyboardShortcuts } from '@/components/pos/KeyboardShortcuts'
import { CustomerSelector } from '@/components/pos/CustomerSelector'
import { SelectedCustomerChip } from '@/components/pos/SelectedCustomerChip'
import { SyncStatus } from '@/components/SyncStatus'
import { TestModeBanner } from '@/components/pos/TestModeBanner'
import { HttpBanner } from '@/components/pos/HttpBanner'
import type { Customer } from '@/lib/customers'
import { computeVipDiscount, isBirthdayToday, TIER_META } from '@/lib/loyalty'
import { enqueueOrder, replayQueue } from '@/lib/offline-queue'
import { useNetworkStatus } from '@/lib/network-status'
import { useTestMode } from '@/lib/test-mode'
import { getPinnedRecipes, togglePinnedRecipe } from '@/lib/user-preferences'
import { useActiveEmployee } from '@/lib/use-active-employee'
import { useLang, type Lang } from '@/contexts/LanguageContext'
import { LanguageSwitcher } from '@/components/pos/LanguageSwitcher'
import { getMenuName } from '@/lib/menu-i18n'
import { formatSecondary } from '@/lib/currency'
import {
  connectPrinter, disconnectPrinter, getStatus as getPrinterStatus,
  printReceipt as thermalPrint, testPrint as thermalTestPrint,
  isSupported as printerIsSupported, debugDevices, setPrinterName as saveServerPrinterName,
  buildReceiptText, getReceiptDesign, type ReceiptDesign,
  effectivePrintLang, hasDismissedFallbackWarning, dismissFallbackWarning,
} from '@/lib/thermal-printer'

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
  product_name_th: string | null
  product_name_lo: string | null
  category: string | null
  category_id: string | null
  price_lak: number
  image_url: string | null
  requires_customization: boolean | null
  default_sweetness: string | null
}

type CartItem = {
  cartKey: string
  recipe: Recipe
  qty: number
  customization: string
}

type HeldOrder = {
  id: string
  table_number: string | null
  customer_name: string | null
  note: string | null
  cart_items: CartItem[]
  total_lak: number
  created_at: string
  expires_at: string
}

type ChargeStatus = 'idle' | 'loading' | 'success' | 'error'

type PosSettings = {
  shop_name: string
  vat_percent: number
  qr_payment_number: string
  shop_line: string
  shop_facebook: string
}

type SuccessData = {
  queue: number
  receipt: string
  change: number
  method: PaymentMethod
  customer: string
  table: string
  discountAmt: number
  discountReason: string
  received: number
  cartSnapshot: CartItem[]
  subtotal: number
  finalTotal: number
  receiptLang: Lang
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

type QueueEntry = {
  order_id: string
  queue_number: number
  queue_status: string | null
  summary: string
}

type TodayOrder = {
  id: string
  queue_number: number
  status: string
  total_lak: number
  payment_method: string | null
  customer_name: string | null
  table_number: string | null
  receipt_number: string | null
  discount_amount: number
  void_reason: string | null
  created_at_vt: string
  items: { name: string; qty: number; note: string | null }[]
}

type PaymentMethod = 'cash' | 'qr' | 'transfer' | 'split'

type PaymentBank = {
  id: string
  name: string
  account_number: string
  account_name: string
  color: string
}

type PayDetails = {
  method: PaymentMethod
  received: number
  change: number
  customer: string
  table: string
  discount: number
  discountReason: string
  staffNote: string
  finalTotal: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GOLD  = '#c9a84c'
const BLACK = '#0f0f0f'
const GREEN = '#4cba7f'
const RED   = '#e05555'

function fmtLak(n: number): string {
  return n.toLocaleString('en-US') + ' LAK'
}

function fmtQueue(n: number): string {
  return '#' + String(n).padStart(3, '0')
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtTimeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function sweetnessFromDefault(ds: string | null): string {
  if (ds === 'less') return 'หวานน้อย'
  if (ds === 'none') return 'ไม่หวาน'
  return 'หวานปกติ'
}

function translateError(msg: string): string {
  if (msg.includes('Insufficient stock')) {
    const match = msg.match(/"([^"]+)"/)
    const ingredient = match?.[1] ?? 'วัตถุดิบ'
    return `วัตถุดิบไม่เพียงพอ: ${ingredient}`
  }
  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch'))
    return 'ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่'
  if (msg.includes('JWT') || msg.includes('auth'))
    return 'หมดเวลา กรุณาเข้าสู่ระบบใหม่'
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่'
}

const PAY_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash',     label: 'เงินสด',   icon: '💵' },
  { value: 'qr',       label: 'QR Code',  icon: '📱' },
  { value: 'transfer', label: 'โอนเงิน',  icon: '🏦' },
  { value: 'split',    label: 'แยกบิล',   icon: '✂️' },
]

const popupInput: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.1)',
  backgroundColor: 'rgba(255,255,255,0.05)',
  color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

function useIsSmall() {
  const [small, setSmall] = useState(false)
  useEffect(() => {
    const fn = () => setSmall(window.innerWidth < 768)
    fn()
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return small
}

const QUICK_AMTS = [20000, 50000, 100000, 200000]

const DISCOUNT_PRESETS = [
  { key: 'employee', label: 'บัตรพนักงาน', pct: 15 },
  { key: 'promo',    label: 'โปรโมชัน',    pct: 10 },
  { key: 'regular',  label: 'ลูกค้าประจำ', pct: 5  },
  { key: 'other',    label: 'อื่นๆ',        pct: 0  },
] as const
type DiscountKey = 'employee' | 'promo' | 'regular' | 'other'
const NUMPAD_KEYS = ['7','8','9','4','5','6','1','2','3','00','0','⌫'] as const

// ─── QtyButton ────────────────────────────────────────────────────────────────

function QtyButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: 28, height: 28, borderRadius: 4,
      border: '1px solid rgba(255,255,255,0.14)',
      backgroundColor: 'transparent', color: '#fff',
      fontWeight: 700, fontSize: 16, lineHeight: 1, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {label}
    </button>
  )
}

// ─── CartItemCard ─────────────────────────────────────────────────────────────

const CART_BOUNCE_CSS = `
@keyframes cart-icon-bounce {
  0%, 100% { transform: translateY(0); }
  45% { transform: translateY(-14px); }
  65% { transform: translateY(-8px); }
}
@media (prefers-reduced-motion: reduce) {
  .cart-icon-bounce { animation: none !important; }
}
`

function EmptyCartState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: 16,
      userSelect: 'none',
    }}>
      <style>{CART_BOUNCE_CSS}</style>
      <div className="cart-icon-bounce" style={{
        fontSize: 60,
        animation: 'cart-icon-bounce 2.4s cubic-bezier(0.4,0,0.2,1) infinite',
        lineHeight: 1,
      }}>🛒</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
          ยังไม่มีรายการในตะกร้า
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.18)' }}>
          เลือกเมนูจากด้านซ้ายเพื่อเริ่ม
        </div>
      </div>
    </div>
  )
}

function CartItemCard({
  item, onDecrement, onIncrement, onEdit, onDelete,
}: {
  item: CartItem
  onDecrement: () => void
  onIncrement: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.07)',
      overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      {/* ── Top row: image + name + customization ── */}
      <div style={{ display: 'flex', gap: 12, padding: '14px 14px 0' }}>
        {/* Image circle */}
        {item.recipe.image_url ? (
          <img
            src={item.recipe.image_url}
            alt=""
            style={{
              width: 40, height: 40, borderRadius: '50%',
              objectFit: 'cover', flexShrink: 0,
              border: '1.5px solid rgba(201,168,76,0.2)',
            }}
          />
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            backgroundColor: 'rgba(201,168,76,0.1)',
            border: '1px solid rgba(201,168,76,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>☕</div>
        )}
        {/* Text */}
        <div style={{ flex: 1, minWidth: 0, paddingBottom: 10 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', gap: 6,
          }}>
            <div style={{
              fontSize: 15, fontWeight: 600, color: '#fff',
              lineHeight: 1.3, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              {item.recipe.product_name}
            </div>
            <div style={{
              fontSize: 12, color: 'rgba(255,255,255,0.35)',
              flexShrink: 0, fontWeight: 600, marginTop: 1,
            }}>× {item.qty}</div>
          </div>
          {item.customization && (
            <div style={{
              fontSize: 12, color: 'rgba(255,255,255,0.38)',
              marginTop: 4, lineHeight: 1.4,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
            }}>
              {item.customization}
            </div>
          )}
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '0 14px' }} />

      {/* ── Bottom row: qty controls + price + actions ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 12px',
      }}>
        {/* − qty + */}
        <button
          onClick={onDecrement}
          aria-label="ลดจำนวน"
          style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(255,255,255,0.04)',
            color: item.qty <= 1 ? 'rgba(255,255,255,0.2)' : '#fff',
            fontSize: 20, fontWeight: 300, cursor: item.qty <= 1 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s',
          }}
        >−</button>
        <span style={{
          width: 30, textAlign: 'center', fontSize: 15,
          fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}>{item.qty}</span>
        <button
          onClick={onIncrement}
          aria-label="เพิ่มจำนวน"
          style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            border: `1px solid rgba(201,168,76,0.35)`,
            backgroundColor: 'rgba(201,168,76,0.08)',
            color: GOLD, fontSize: 20, fontWeight: 300, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s',
          }}
        >+</button>

        {/* Total */}
        <div style={{
          flex: 1, textAlign: 'right',
          fontSize: 14, fontWeight: 700, color: GOLD,
          fontVariantNumeric: 'tabular-nums', paddingRight: 4,
        }}>
          {(item.recipe.price_lak * item.qty).toLocaleString('en-US')} ₭
        </div>

        {/* Edit */}
        <button
          onClick={onEdit}
          aria-label="แก้ไข"
          style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.45)', fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
        >✏️</button>

        {/* Delete */}
        <button
          onClick={onDelete}
          aria-label="ลบ"
          style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            border: '1px solid rgba(220,80,80,0.2)',
            backgroundColor: 'rgba(220,80,80,0.05)',
            color: '#e07070', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(220,80,80,0.12)' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(220,80,80,0.05)' }}
        >🗑️</button>
      </div>
    </div>
  )
}

// ─── CustomPopup ─────────────────────────────────────────────────────────────

const SWEETNESS_OPTIONS = [
  { value: 'หวานปกติ', icon: '🍯' },
  { value: 'หวานน้อย', icon: '💧' },
  { value: 'ไม่หวาน',  icon: '🚫' },
]
const TEMP_OPTIONS = [
  { value: 'ร้อน', icon: '🔥' },
  { value: 'เย็น', icon: '❄️' },
  { value: 'อุ่น', icon: '☕' },
]
const NOTE_CHIPS = ['ไม่ใส่น้ำแข็ง', 'extra shot', 'ห่อแยก']

const POPUP_ANIM = `
@keyframes cpopup-overlay { from{opacity:0} to{opacity:1} }
@keyframes cpopup-sheet   { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
@media (prefers-reduced-motion:reduce) {
  .cpopup-sheet,.cpopup-overlay{animation:none!important}
}
div:hover > .menu-pin-btn { opacity: 1 !important; }
`

function CustomPopup({ recipe, onConfirm, onClose, initialCustomization, initialQty }: {
  recipe: Recipe
  onConfirm: (customization: string, qty: number) => void
  onClose: () => void
  initialCustomization?: string
  initialQty?: number
}) {
  const initParts    = initialCustomization?.split(' · ') ?? []
  const defaultSweet = sweetnessFromDefault(recipe.default_sweetness)

  const [sweetness, setSweetness] = useState(() => SWEETNESS_OPTIONS.find(s => initParts.includes(s.value))?.value ?? defaultSweet)
  const [temp,      setTemp]      = useState(() => TEMP_OPTIONS.find(t => initParts.includes(t.value))?.value ?? 'ร้อน')
  const [note,      setNote]      = useState(() => initParts.filter(p => !SWEETNESS_OPTIONS.some(s => s.value === p) && !TEMP_OPTIONS.some(t => t.value === p)).join(' · '))
  const [qty,       setQty]       = useState(initialQty ?? 1)
  const [noteOpen,  setNoteOpen]  = useState(() => initParts.some(p => !SWEETNESS_OPTIONS.some(s => s.value === p) && !TEMP_OPTIONS.some(t => t.value === p) && p.length > 0))
  const overlayRef                = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleConfirm() {
    const parts = [sweetness, temp]
    if (note.trim()) parts.push(note.trim())
    onConfirm(parts.join(' · '), qty)
  }

  const total = recipe.price_lak * qty

  const optCard = (selected: boolean): React.CSSProperties => ({
    padding: '16px 12px', borderRadius: 12, cursor: 'pointer', border: 'none',
    boxSizing: 'border-box',
    outline: selected ? `2px solid ${GOLD}` : '1px solid rgba(255,255,255,0.08)',
    outlineOffset: selected ? '0px' : '0px',
    backgroundColor: selected ? `rgba(201,168,76,0.12)` : 'rgba(255,255,255,0.04)',
    boxShadow: selected ? `0 0 0 4px rgba(201,168,76,0.1)` : 'none',
    color: selected ? GOLD : 'rgba(255,255,255,0.85)',
    transition: 'all 0.18s cubic-bezier(0.2,0,0,1)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    minHeight: 80,
  })

  return (
    <div ref={overlayRef} onClick={handleOverlayClick} className="cpopup-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 200,
      backgroundColor: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      animation: 'cpopup-overlay 0.2s ease',
    }}>
      <style>{POPUP_ANIM}</style>
      <div className="cpopup-sheet" style={{
        backgroundColor: '#161616',
        borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: 480, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        animation: 'cpopup-sheet 0.22s cubic-bezier(0.2,0,0,1)',
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '20px 24px 16px', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {recipe.image_url ? (
            <img src={recipe.image_url} alt="" style={{
              width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
              border: '2px solid rgba(201,168,76,0.25)',
            }} />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              backgroundColor: 'rgba(201,168,76,0.1)',
              border: '1px solid rgba(201,168,76,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26,
            }}>☕</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#fff', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {recipe.product_name}
            </div>
            {recipe.product_name_lo && (
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {recipe.product_name_lo}
              </div>
            )}
            <div style={{ fontSize: 15, color: GOLD, fontWeight: 700, marginTop: 5 }}>
              {recipe.price_lak.toLocaleString()} ₭
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none', flexShrink: 0,
            backgroundColor: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background-color 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
          >×</button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Quantity */}
          <section>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 14 }}>จำนวน</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                style={{
                  width: 60, height: 60, borderRadius: 14, border: 'none',
                  outline: '1.5px solid rgba(255,255,255,0.12)',
                  backgroundColor: qty <= 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
                  color: qty <= 1 ? 'rgba(255,255,255,0.2)' : '#fff',
                  fontSize: 30, fontWeight: 300, cursor: qty <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >−</button>
              <div style={{ width: 64, textAlign: 'center', fontSize: 36, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{qty}</div>
              <button
                onClick={() => setQty(q => Math.min(99, q + 1))}
                style={{
                  width: 60, height: 60, borderRadius: 14, border: 'none',
                  outline: `1.5px solid ${GOLD}`,
                  backgroundColor: `rgba(201,168,76,0.12)`,
                  color: GOLD, fontSize: 30, fontWeight: 300, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >+</button>
            </div>
          </section>

          {/* Sweetness */}
          <section>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 14 }}>ความหวาน</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {SWEETNESS_OPTIONS.map(opt => {
                const sel = sweetness === opt.value
                const isDefault = opt.value === defaultSweet
                return (
                  <button key={opt.value} onClick={() => setSweetness(opt.value)} style={optCard(sel)}
                    onMouseEnter={e => { if (!sel) { e.currentTarget.style.outlineColor = `rgba(201,168,76,0.4)`; e.currentTarget.style.backgroundColor = `rgba(201,168,76,0.04)` }}}
                    onMouseLeave={e => { if (!sel) { e.currentTarget.style.outlineColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}}
                  >
                    <span style={{ fontSize: 24, lineHeight: 1 }}>{opt.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.2, textAlign: 'center' }}>{opt.value}</span>
                    {isDefault && <span style={{ fontSize: 10, color: sel ? `rgba(201,168,76,0.6)` : 'rgba(255,255,255,0.3)', lineHeight: 1 }}>ค่าเริ่มต้น</span>}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Temperature */}
          <section>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 14 }}>อุณหภูมิ</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {TEMP_OPTIONS.map(opt => {
                const sel = temp === opt.value
                return (
                  <button key={opt.value} onClick={() => setTemp(opt.value)} style={optCard(sel)}
                    onMouseEnter={e => { if (!sel) { e.currentTarget.style.outlineColor = `rgba(201,168,76,0.4)`; e.currentTarget.style.backgroundColor = `rgba(201,168,76,0.04)` }}}
                    onMouseLeave={e => { if (!sel) { e.currentTarget.style.outlineColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}}
                  >
                    <span style={{ fontSize: 24, lineHeight: 1 }}>{opt.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.2 }}>{opt.value}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Note (collapsible) */}
          <section>
            <button onClick={() => setNoteOpen(v => !v)} style={{
              width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              marginBottom: noteOpen ? 14 : 0,
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                หมายเหตุพิเศษ
                <span style={{ marginLeft: 6, fontSize: 11, textTransform: 'none', letterSpacing: 0, opacity: 0.6, fontWeight: 400 }}>(ไม่บังคับ)</span>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, transition: 'transform 0.18s', display: 'inline-block', transform: noteOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
            </button>
            {noteOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <textarea value={note} maxLength={50} rows={2} onChange={e => setNote(e.target.value)}
                    placeholder="ใส่หมายเหตุ..."
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '10px 44px 10px 12px', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.1)',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      color: '#fff', fontSize: 14, outline: 'none',
                      resize: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                    }} />
                  <span style={{
                    position: 'absolute', right: 10, bottom: 8, fontSize: 11,
                    color: note.length >= 45 ? '#f87171' : 'rgba(255,255,255,0.25)', pointerEvents: 'none',
                  }}>{note.length}/50</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {NOTE_CHIPS.map(chip => (
                    <button key={chip} onClick={() => setNote(prev => {
                      const sep = prev.trim() ? ', ' : ''
                      return (prev.trim() + sep + chip).slice(0, 50)
                    })} style={{
                      padding: '5px 12px', borderRadius: 20,
                      border: '1px solid rgba(255,255,255,0.12)',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = `rgba(201,168,76,0.4)`)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                    >{chip}</button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div style={{ height: 4 }} />
        </div>

        {/* ── Sticky footer ── */}
        <div style={{
          padding: '14px 24px 24px', flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: '#161616',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>ยอดรวม</span>
            <div style={{ textAlign: 'right' }}>
              {qty > 1 && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                  {recipe.price_lak.toLocaleString()} ₭ × {qty}
                </div>
              )}
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>
                {total.toLocaleString()} ₭
              </div>
            </div>
          </div>
          <button onClick={handleConfirm} style={{
            width: '100%', height: 60, borderRadius: 14, border: 'none',
            backgroundColor: GOLD, color: BLACK,
            fontSize: 17, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            ✓ เพิ่มลงตะกร้า
            <span style={{ opacity: 0.7, fontSize: 15, fontWeight: 600 }}>{total.toLocaleString()} ₭</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DigitalReceiptPopup ──────────────────────────────────────────────────────

function DigitalReceiptPopup({
  data, settings, onClose,
}: {
  data: SuccessData
  settings: PosSettings
  onClose: () => void
}) {
  const now     = new Date()
  const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  const vatPct    = settings.vat_percent
  const vatAmount = vatPct > 0 ? Math.round(data.finalTotal * vatPct / (100 + vatPct)) : 0

  const qrContent = settings.qr_payment_number || settings.shop_line || settings.shop_facebook || ''

  const payLabel = data.method === 'cash' ? 'เงินสด' : data.method === 'qr' ? 'QR Code' : 'โอนเงิน'

  const [printState, setPrintState] = useState<'idle' | 'printing' | 'done' | 'error'>('idle')

  async function handleThermalPrint() {
    setPrintState('printing')
    try {
      const footerText = localStorage.getItem('receipt_footer_text') || 'Thank you for visiting'
      const phone      = localStorage.getItem('receipt_phone') || ''
      const address    = localStorage.getItem('receipt_address') || ''
      const shopName   = localStorage.getItem('receipt_shop_name') || settings.shop_name || 'ALAN COFFEE & TRAVEL'
      await thermalPrint({
        shopName,
        queue:          data.queue,
        receipt:        data.receipt,
        table:          data.table,
        customer:       data.customer,
        cartSnapshot:   data.cartSnapshot,
        subtotal:       data.subtotal,
        discountAmt:    data.discountAmt,
        discountReason: data.discountReason || '',
        finalTotal:     data.finalTotal,
        method:         data.method,
        received:       data.received,
        change:         data.change,
        vatPct:         settings.vat_percent,
        footerText,
        phone,
        address,
      })
      setPrintState('done')
      setTimeout(() => setPrintState('idle'), 3000)
    } catch (e) {
      console.error('[POS] Print failed:', e)
      setPrintState('error')
      // Only open browser print dialog when no hardware printer is configured.
      // If pos_printer_name or printer_ip is set, the user has a real printer —
      // opening the browser dialog would be confusing.
      const hasHardware = localStorage.getItem('pos_printer_name') || localStorage.getItem('printer_ip')
      if (!hasHardware) {
        setTimeout(() => { setPrintState('idle'); window.print() }, 1500)
      } else {
        setTimeout(() => setPrintState('idle'), 3000)
      }
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      backgroundColor: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <style>{`
        @media print {
          body > * { display: none !important; }
          #pos-receipt-print { display: block !important; }
          #pos-receipt-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        #pos-receipt-print { display: none; }
      `}</style>

      {/* Screen receipt card */}
      <div style={{
        backgroundColor: '#121212', border: `1px solid ${GOLD}44`,
        borderRadius: 16, width: '100%', maxWidth: 420,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header bar */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: '2.5px', textTransform: 'uppercase', fontWeight: 700 }}>
            ใบเสร็จ / Receipt
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleThermalPrint}
              disabled={printState === 'printing'}
              style={{
                padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: printState === 'printing' ? 'wait' : 'pointer',
                border: `1px solid ${printState === 'done' ? GREEN + '88' : printState === 'error' ? RED + '88' : GOLD + '55'}`,
                backgroundColor: printState === 'done' ? `${GREEN}18` : printState === 'error' ? `${RED}14` : `${GOLD}14`,
                color: printState === 'done' ? GREEN : printState === 'error' ? '#e07070' : GOLD,
                minWidth: 120,
              }}
            >
              {printState === 'printing' ? 'กำลังพิมพ์...'
               : printState === 'done'    ? 'พิมพ์เรียบร้อย ✓'
               : printState === 'error'   ? 'ไม่พบเครื่องพิมพ์'
               : '🖨️ พิมพ์ใบเสร็จ'}
            </button>
            <button onClick={onClose} style={{
              padding: '5px 14px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.12)',
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer',
            }}>
              ปิด
            </button>
          </div>
        </div>

        {/* Receipt body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Shop info */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                fontFamily: 'var(--font-heading)', fontWeight: 900,
                fontSize: 24, color: '#fff', letterSpacing: '-0.5px',
              }}>
                {settings.shop_name || 'ALAN COFFEE'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                {dateStr} · {timeStr}
              </div>
            </div>

            {/* Receipt / Queue numbers */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '10px 12px', borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              marginBottom: 16,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>ใบเสร็จ</div>
                <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: GOLD, marginTop: 2 }}>{data.receipt || '—'}</div>
              </div>
              <div style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>คิว</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 900, color: '#fff', marginTop: 2, letterSpacing: '-1px' }}>
                  {fmtQueue(data.queue)}
                </div>
              </div>
              {data.customer && (
                <>
                  <div style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>ลูกค้า</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginTop: 2 }}>{data.customer}</div>
                  </div>
                </>
              )}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px dashed rgba(255,255,255,0.12)', marginBottom: 14 }} />

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {data.cartSnapshot.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 20, textAlign: 'right', fontSize: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
                    {item.qty}×
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{item.recipe.product_name}</div>
                    {item.customization && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{item.customization}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#fff', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {(item.recipe.price_lak * item.qty).toLocaleString('en-US')}
                  </div>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px dashed rgba(255,255,255,0.12)', marginBottom: 12 }} />

            {/* Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                <span>ยอดรวม</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{data.subtotal.toLocaleString('en-US')}</span>
              </div>
              {data.discountAmt > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: GREEN }}>
                  <span>ส่วนลด</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>−{data.discountAmt.toLocaleString('en-US')}</span>
                </div>
              )}
              {vatPct > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                  <span>VAT {vatPct}% (รวมอยู่แล้ว)</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{vatAmount.toLocaleString('en-US')}</span>
                </div>
              )}
            </div>

            {/* Grand total */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginTop: 10, paddingTop: 10, borderTop: `1px solid ${GOLD}33`,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>ยอดสุทธิ</span>
              <span style={{ fontSize: 26, fontWeight: 900, color: GOLD, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>
                {data.finalTotal.toLocaleString('en-US')} <span style={{ fontSize: 14 }}>LAK</span>
              </span>
            </div>

            {/* Payment info */}
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                <span>ชำระด้วย</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{payLabel}</span>
              </div>
              {data.method === 'cash' && data.received > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                    <span>รับมา</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{data.received.toLocaleString('en-US')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: GREEN, fontWeight: 700 }}>
                    <span>เงินทอน</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{data.change.toLocaleString('en-US')}</span>
                  </div>
                </>
              )}
            </div>

            {/* Shop QR */}
            {qrContent && (
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrContent)}&bgcolor=121212&color=c9a84c&margin=6`}
                  alt="QR"
                  width={120} height={120}
                  style={{ borderRadius: 8, border: `1px solid ${GOLD}33` }}
                />
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '1px' }}>
                  ขอบคุณที่ใช้บริการ
                </div>
              </div>
            )}

            {!qrContent && (
              <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                ขอบคุณที่ใช้บริการ — Thank you
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print-only version */}
      <div id="pos-receipt-print" style={{
        fontFamily: 'monospace', fontSize: 12, color: '#000',
        backgroundColor: '#fff', padding: '20px', width: '280px',
        margin: '0 auto',
      }}>
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>
          {settings.shop_name || 'ALAN COFFEE'}
        </div>
        <div style={{ textAlign: 'center', fontSize: 10, marginBottom: 12 }}>
          {dateStr} {timeStr} | {data.receipt}
        </div>
        <div style={{ borderTop: '1px dashed #000', marginBottom: 8 }} />
        {data.cartSnapshot.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>{item.qty}× {item.recipe.product_name}{item.customization ? ` (${item.customization})` : ''}</span>
            <span>{(item.recipe.price_lak * item.qty).toLocaleString('en-US')}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
        {data.discountAmt > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>ส่วนลด</span><span>-{data.discountAmt.toLocaleString('en-US')}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: 4 }}>
          <span>รวม</span><span>{data.finalTotal.toLocaleString('en-US')} LAK</span>
        </div>
        {data.method === 'cash' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>รับมา</span><span>{data.received.toLocaleString('en-US')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>เงินทอน</span><span>{data.change.toLocaleString('en-US')}</span>
            </div>
          </>
        )}
        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
        <div style={{ textAlign: 'center', fontSize: 10 }}>ขอบคุณที่ใช้บริการ</div>
      </div>
    </div>
  )
}

// ─── ChargePopup ─────────────────────────────────────────────────────────────

function ChargePopup({ subtotal, cartPayload, discount, discountReason, activeEmployeeId, selectedCustomer, isTestMode, defaultLang, onSuccess, onClose }: {
  subtotal: number
  cartPayload: { recipe_id: string; qty: number; unit_price_lak: number; customization: string | null }[]
  discount: string
  discountReason: string
  activeEmployeeId?: string | null
  selectedCustomer?: Customer | null
  isTestMode?: boolean
  defaultLang?: Lang
  onSuccess: (queueNum: number, receipt: string, change: number, method: PaymentMethod, customer: string, table: string, discountAmt: number, received: number, discountReason: string, receiptLang: Lang) => void
  onClose: () => void
}) {
  const isSmall = useIsSmall()
  const [method,         setMethod]         = useState<PaymentMethod>('cash')
  const [receiptLang,    setReceiptLang]    = useState<Lang>(defaultLang ?? 'en')
  const [received,       setReceived]       = useState('')
  const [selectedBank,   setSelectedBank]   = useState<string | null>(null)
  const [banks,          setBanks]          = useState<PaymentBank[]>([])
  const [banksLoaded,    setBanksLoaded]    = useState(false)
  const [qrNumber,       setQrNumber]       = useState('')
  const [qrName,         setQrName]         = useState('')
  const [showExtra,      setShowExtra]      = useState(false)
  const [customer,       setCustomer]       = useState('')
  const [phone,          setPhone]          = useState('')
  const [table,          setTable]          = useState('')
  const [staffNote,      setStaffNote]      = useState('')
  const [loading,        setLoading]        = useState(false)
  const [errMsg,         setErrMsg]         = useState('')
  const [splitCash,      setSplitCash]      = useState('')
  const [splitTransfer,  setSplitTransfer]  = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  const discountAmt   = parseFloat(discount) || 0
  const finalTotal    = Math.max(subtotal - discountAmt, 0)
  const receivedNum   = received ? (parseInt(received, 10) || 0) : 0
  const changeAmt     = method === 'cash' ? receivedNum - finalTotal : 0
  const splitCashNum  = parseInt(splitCash, 10)  || 0
  const splitXferNum  = parseInt(splitTransfer, 10) || 0
  const splitTotal    = splitCashNum + splitXferNum
  const cashOk =
    (method === 'cash' && received !== '' && receivedNum >= finalTotal) ||
    (method === 'qr') ||
    (method === 'transfer' && selectedBank !== null) ||
    (method === 'split' && splitTotal >= finalTotal)

  // Keyboard shortcuts inside ChargePopup
  useEffect(() => {
    function h(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.ctrlKey || e.metaKey || e.altKey) return

      // Enter → confirm if ready
      if (e.key === 'Enter' && !isInput && !loading && cashOk) {
        e.preventDefault()
        confirm()
        return
      }
      // Number keys on cash tab: 1=exact, 2-5=presets
      if (!isInput && method === 'cash') {
        if (e.key === '1') { e.preventDefault(); setReceived(String(finalTotal)); return }
        if (e.key === '2') { e.preventDefault(); setReceived('20000'); return }
        if (e.key === '3') { e.preventDefault(); setReceived('50000'); return }
        if (e.key === '4') { e.preventDefault(); setReceived('100000'); return }
        if (e.key === '5') { e.preventDefault(); setReceived('200000'); return }
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashOk, loading, method, finalTotal])

  // Load settings when QR or transfer tab is first opened
  useEffect(() => {
    if ((method !== 'transfer' && method !== 'qr') || banksLoaded) return
    supabase.rpc('get_site_settings').then(({ data }) => {
      if (data?.payment_banks) {
        try { setBanks(JSON.parse(data.payment_banks)) } catch { setBanks([]) }
      }
      setQrNumber((data?.qr_payment_number as string) ?? '')
      setQrName((data?.qr_payment_name as string) ?? '')
      setBanksLoaded(true)
    })
  }, [method, banksLoaded])

  function pressKey(key: string) {
    if (key === '⌫') { setReceived(p => p.slice(0, -1)); return }
    if (key === '00' && received === '') return
    if (received.length >= 9) return
    setReceived(p => p + key)
  }

  async function confirm() {
    if (!cashOk) { setErrMsg('เงินที่รับมาไม่เพียงพอ'); return }
    setLoading(true); setErrMsg('')

    // Link order to customer: prefer pre-selected customer, fallback to name+phone entry
    let customerId: string | null = selectedCustomer?.id ?? null
    const customerName = selectedCustomer?.name ?? customer.trim()

    // ── Offline path: enqueue locally and succeed immediately ──────────────────
    if (!navigator.onLine) {
      const offlineQueue = Math.floor(Math.random() * 900) + 100  // temp queue # until sync
      await enqueueOrder({
        p_cart:        cartPayload,
        p_customer_id: customerId,
        _meta: { method, receivedNum, changeAmt: Math.max(changeAmt, 0), table, customerName, discountAmt, discountReason, staffNote, activeEmployeeId },
      })
      window.dispatchEvent(new Event('alan:queue-changed'))
      const finalReceipt = String(offlineQueue).padStart(3, '0')
      onSuccess(offlineQueue, finalReceipt, Math.max(changeAmt, 0), method, customerName, table, discountAmt, method === 'cash' ? receivedNum : 0, discountReason, receiptLang)
      setLoading(false)
      return
    }

    if (!customerId && customer.trim() && phone.trim()) {
      const { data: custData } = await supabase.rpc('upsert_customer', {
        p_phone: phone.trim(),
        p_name:  customer.trim(),
      })
      if (custData?.id) customerId = custData.id as string
    }

    const { data, error } = await supabase.rpc('create_order_with_deduction', {
      p_cart:        cartPayload,
      p_customer_id: customerId,
    })
    if (error) { setErrMsg(translateError(error.message)); setLoading(false); return }

    const result = data as { order_id: string; queue_number: number }

    // Fire finalize in the background — order is already committed and paid.
    // This records payment metadata (received, change, table, note) without blocking the UI.
    supabase.rpc('finalize_order_payment', {
      p_order_id:        result.order_id,
      p_payment_method:  method,
      p_amount_received: method === 'cash' ? receivedNum : null,
      p_change_amount:   method === 'cash' ? Math.max(changeAmt, 0) : null,
      p_table_number:    table         || null,
      p_customer_name:   customerName  || null,
      p_discount_amount: discountAmt,
      p_discount_reason: discountReason || null,
      p_staff_note:      staffNote || null,
    }).then(null, () => { /* background — non-critical */ })

    if (activeEmployeeId) {
      supabase.from('orders').update({ employee_id: activeEmployeeId }).eq('id', result.order_id)
        .then(null, () => { /* background — non-critical */ })
    }

    if (isTestMode) {
      supabase.from('orders').update({ is_test: true }).eq('id', result.order_id)
        .then(null, () => { /* background — non-critical */ })
    }

    // Use queue number as receipt ID so we can show success immediately
    const finalReceipt = String(result.queue_number).padStart(3, '0')
    onSuccess(result.queue_number, finalReceipt, Math.max(changeAmt, 0), method, customerName, table, discountAmt, method === 'cash' ? receivedNum : 0, discountReason, receiptLang)
    setLoading(false)
  }

  const boxStyle: React.CSSProperties = isSmall
    ? { position: 'fixed', inset: 0, borderRadius: 0, backgroundColor: '#181818', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
    : { backgroundColor: '#181818', border: `1px solid ${GOLD}44`, borderRadius: 16, width: 440, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }

  const btnBg = loading ? `${GOLD}55`
    : method === 'cash' && received !== '' && receivedNum < finalTotal ? `${RED}22`
    : method === 'cash' && received === '' ? 'rgba(255,255,255,0.06)'
    : method === 'transfer' && !selectedBank ? 'rgba(255,255,255,0.06)'
    : method === 'split' && splitTotal < finalTotal ? `${RED}22`
    : GOLD
  const btnColor = method === 'cash' && received !== '' && receivedNum < finalTotal ? RED
    : method === 'cash' && received === '' ? 'rgba(255,255,255,0.2)'
    : method === 'transfer' && !selectedBank ? 'rgba(255,255,255,0.2)'
    : method === 'split' && splitTotal < finalTotal ? RED
    : BLACK

  return (
    <div ref={overlayRef}
      onClick={e => { if (!isSmall && e.target === overlayRef.current && !loading) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: isSmall ? '#181818' : 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: isSmall ? 'stretch' : 'center', justifyContent: 'center',
      }}>
      <div style={boxStyle}>

        {/* ── Header ── */}
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 3 }}>ชำระเงิน</div>
              <div style={{ fontSize: 34, fontWeight: 900, color: GOLD, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {fmtLak(finalTotal)}
              </div>
              {discountAmt > 0 && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                  ก่อนลด {fmtLak(subtotal)} · ส่วนลด {fmtLak(discountAmt)}
                </div>
              )}
            </div>
            <button onClick={onClose} disabled={loading}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 28, cursor: 'pointer', lineHeight: 1, padding: '4px 8px', marginTop: -4 }}>×</button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Selected customer banner */}
          {selectedCustomer && (() => {
            const { color, icon, label } = TIER_META[selectedCustomer.vip_tier]
            const birthday = isBirthdayToday(selectedCustomer.birthday)
            const vipPct   = selectedCustomer.vip_tier === 'platinum' ? 10 : selectedCustomer.vip_tier === 'gold' ? 5 : 0
            return (
              <div style={{
                padding: '10px 14px', borderRadius: 12,
                border: `1px solid ${color}44`,
                backgroundColor: `${color}0e`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                    {birthday ? '🎂 ' : ''}
                    {selectedCustomer.name ?? selectedCustomer.phone}
                  </div>
                  {selectedCustomer.vip_tier !== 'regular' && (
                    <span style={{ fontSize: 11, fontWeight: 700, color, padding: '1px 7px', borderRadius: 99, border: `1px solid ${color}44`, backgroundColor: `${color}14` }}>
                      {icon} {label}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3, display: 'flex', gap: 12 }}>
                  <span>{selectedCustomer.loyalty_points.toLocaleString()} pts</span>
                  {vipPct > 0 && <span style={{ color: '#4cba7f' }}>ส่วนลด VIP {vipPct}% ถูกใช้แล้ว</span>}
                  {birthday && <span style={{ color: GOLD }}>วันเกิดวันนี้!</span>}
                </div>
              </div>
            )
          })()}

          {/* Method selector — 3 big buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {PAY_METHODS.map(m => (
              <button key={m.value} onClick={() => { setMethod(m.value); setErrMsg('') }} style={{
                padding: isSmall ? '15px 8px' : '12px 8px', borderRadius: 10,
                border: `2px solid ${method === m.value ? GOLD : 'rgba(255,255,255,0.08)'}`,
                backgroundColor: method === m.value ? `${GOLD}16` : 'rgba(255,255,255,0.03)',
                color: method === m.value ? GOLD : 'rgba(255,255,255,0.45)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                cursor: 'pointer', transition: 'all .15s',
              }}>
                <span style={{ fontSize: 26 }}>{m.icon}</span>
                <span style={{ fontSize: 13, fontWeight: method === m.value ? 700 : 500 }}>{m.label}</span>
              </button>
            ))}
          </div>

          {/* ── CASH ── */}
          {method === 'cash' && (<>
            {/* Received display */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>รับมา</span>
              <span style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', color: received ? '#fff' : 'rgba(255,255,255,0.15)' }}>
                {received ? parseInt(received, 10).toLocaleString('en-US') + ' ₭' : '— ₭'}
              </span>
            </div>

            {/* Quick presets */}
            <div style={{ display: 'flex', gap: 6 }}>
              {QUICK_AMTS.map(amt => (
                <button key={amt} onClick={() => setReceived(String(amt))} style={{
                  flex: 1, padding: '8px 0', borderRadius: 7,
                  border: `1px solid ${received === String(amt) ? GOLD : 'rgba(255,255,255,0.1)'}`,
                  backgroundColor: received === String(amt) ? `${GOLD}18` : 'rgba(255,255,255,0.04)',
                  color: received === String(amt) ? GOLD : 'rgba(255,255,255,0.5)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  {amt / 1000}K
                </button>
              ))}
              <button onClick={() => setReceived(String(Math.ceil(finalTotal)))} style={{
                flex: 1, padding: '8px 0', borderRadius: 7,
                border: `1px solid ${received === String(Math.ceil(finalTotal)) && received !== '' ? GOLD : 'rgba(255,255,255,0.1)'}`,
                backgroundColor: received === String(Math.ceil(finalTotal)) && received !== '' ? `${GOLD}18` : 'rgba(255,255,255,0.04)',
                color: received === String(Math.ceil(finalTotal)) && received !== '' ? GOLD : 'rgba(255,255,255,0.5)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>พอดี</button>
            </div>

            {/* Numpad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {NUMPAD_KEYS.map(key => (
                <button key={key} onClick={() => pressKey(key)} style={{
                  padding: isSmall ? '18px 0' : '14px 0', borderRadius: 9, border: 'none',
                  backgroundColor: key === '⌫' ? 'rgba(220,80,80,0.14)' : 'rgba(255,255,255,0.07)',
                  color: key === '⌫' ? '#e07070' : '#fff',
                  fontSize: key === '⌫' ? 18 : 20, fontWeight: 700, cursor: 'pointer',
                  transition: 'background .1s', userSelect: 'none' as const,
                }}>{key}</button>
              ))}
            </div>

            {/* Change display */}
            {received !== '' && (
              <div style={{
                padding: '12px 16px', borderRadius: 10,
                backgroundColor: changeAmt >= 0 ? `${GREEN}15` : `${RED}15`,
                border: `1px solid ${changeAmt >= 0 ? GREEN : RED}33`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>เงินทอน</span>
                <span style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: changeAmt >= 0 ? GREEN : RED }}>
                  {changeAmt >= 0 ? changeAmt.toLocaleString('en-US') + ' ₭' : '⚠ ไม่พอ'}
                </span>
              </div>
            )}
          </>)}

          {/* ── QR ── */}
          {method === 'qr' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '16px 0' }}>
              {!banksLoaded ? (
                <div style={{ padding: 28, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>กำลังโหลด...</div>
              ) : qrNumber ? (
                <>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrNumber)}&bgcolor=181818&color=c9a84c&margin=8`}
                    alt="QR Code"
                    width={220} height={220}
                    style={{ borderRadius: 12, border: `1px solid rgba(201,168,76,0.25)` }}
                  />
                  {qrName && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{qrName}</div>}
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{qrNumber}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{fmtLak(finalTotal)}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>กดยืนยันเมื่อรับเงินแล้ว</div>
                </>
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 36 }}>📱</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>ยังไม่ได้ตั้งค่า QR Payment</div>
                  <a href="/cafe" target="_blank" rel="noopener noreferrer" style={{ color: GOLD, fontSize: 12, textDecoration: 'none', fontWeight: 600, marginTop: 4 }}>⚙️ ไปตั้งค่า →</a>
                </div>
              )}
            </div>
          )}

          {/* ── TRANSFER ── */}
          {method === 'transfer' && (
            !banksLoaded ? (
              <div style={{ padding: '28px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>กำลังโหลด...</div>
            ) : banks.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 40 }}>🏦</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>กรุณาเพิ่มธนาคารในตั้งค่า</div>
                <a href="/cafe" target="_blank" rel="noopener noreferrer" style={{ color: GOLD, fontSize: 12, textDecoration: 'none', fontWeight: 600, marginTop: 4 }}>⚙️ ไปหน้าตั้งค่า →</a>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {banks.map(bank => (
                  <button key={bank.id} onClick={() => setSelectedBank(selectedBank === bank.id ? null : bank.id)} style={{
                    padding: '12px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    border: `2px solid ${selectedBank === bank.id ? (bank.color || GOLD) : 'rgba(255,255,255,0.08)'}`,
                    backgroundColor: selectedBank === bank.id ? (bank.color || GOLD) + '18' : 'rgba(255,255,255,0.03)',
                    display: 'flex', alignItems: 'center', gap: 12, transition: 'all .15s',
                  }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: bank.color || GOLD, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏦</div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{bank.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        {bank.account_number}{bank.account_name ? ' · ' + bank.account_name : ''}
                      </div>
                    </div>
                    {selectedBank === bank.id && (
                      <span style={{ fontSize: 18, color: bank.color || GOLD }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )
          )}

          {/* ── SPLIT ── */}
          {method === 'split' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                ยอดรวม <span style={{ color: GOLD, fontWeight: 700 }}>{fmtLak(finalTotal)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>💵 เงินสด</div>
                  <input
                    type="number" inputMode="numeric" value={splitCash}
                    onChange={e => setSplitCash(e.target.value.replace(/\D/g, ''))}
                    placeholder="0"
                    style={{ ...popupInput, fontSize: 20, fontWeight: 700, textAlign: 'right', padding: '10px 12px' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>🏦 โอนเงิน</div>
                  <input
                    type="number" inputMode="numeric" value={splitTransfer}
                    onChange={e => setSplitTransfer(e.target.value.replace(/\D/g, ''))}
                    placeholder="0"
                    style={{ ...popupInput, fontSize: 20, fontWeight: 700, textAlign: 'right', padding: '10px 12px' }}
                  />
                </div>
              </div>
              {(splitCash !== '' || splitTransfer !== '') && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  backgroundColor: splitTotal >= finalTotal ? `${GREEN}15` : `${RED}15`,
                  border: `1px solid ${splitTotal >= finalTotal ? GREEN : RED}33`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    {splitTotal >= finalTotal ? 'รับรวม' : 'ขาดอีก'}
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: splitTotal >= finalTotal ? GREEN : RED, fontVariantNumeric: 'tabular-nums' }}>
                    {splitTotal >= finalTotal ? splitTotal.toLocaleString('en-US') + ' ₭' : `${(finalTotal - splitTotal).toLocaleString('en-US')} ₭`}
                  </span>
                </div>
              )}
              <button onClick={() => { setSplitCash(String(Math.round(finalTotal / 2))); setSplitTransfer(String(Math.round(finalTotal / 2))) }} style={{
                padding: '8px 0', borderRadius: 8, border: `1px solid ${GOLD}44`,
                backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>แบ่งครึ่ง</button>
            </div>
          )}

          {/* ── Optional extra fields ── */}
          <div>
            <button onClick={() => setShowExtra(x => !x)} style={{
              background: 'none', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 7,
              padding: '7px 14px', color: 'rgba(255,255,255,0.35)', fontSize: 12,
              cursor: 'pointer', width: '100%', textAlign: 'left',
            }}>
              {showExtra ? '▲ ซ่อน' : '⋯ เพิ่มเติม'} · ชื่อลูกค้า · เบอร์โทร · โต๊ะ · หมายเหตุ
            </button>
            {showExtra && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>ชื่อลูกค้า</div>
                    <input value={customer} onChange={e => setCustomer(e.target.value)} style={popupInput} placeholder="(ไม่บังคับ)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>เบอร์โทร</div>
                    <input value={phone} onChange={e => setPhone(e.target.value)} style={popupInput} placeholder="020xxxxxxx" />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>โต๊ะ</div>
                    <input value={table} onChange={e => setTable(e.target.value)} style={popupInput} placeholder="A1" />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>Staff Note</div>
                  <input value={staffNote} onChange={e => setStaffNote(e.target.value)} style={popupInput} placeholder="หมายเหตุสำหรับร้าน..." />
                </div>
              </div>
            )}
          </div>

          {/* Receipt language selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '1px', textTransform: 'uppercase' }}>ภาษาใบเสร็จ / Receipt</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['en', 'th', 'lo'] as Lang[]).map(l => (
                <button key={l} onClick={() => setReceiptLang(l)} style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none',
                  backgroundColor: receiptLang === l ? `${GOLD}22` : 'transparent',
                  color: receiptLang === l ? GOLD : 'rgba(255,255,255,0.3)',
                  fontSize: 11, fontWeight: receiptLang === l ? 800 : 500, cursor: 'pointer',
                }}>
                  {l === 'en' ? 'EN' : l === 'th' ? 'ไทย' : 'ລາວ'}
                </button>
              ))}
            </div>
          </div>

          {errMsg && (
            <div style={{ padding: '8px 12px', backgroundColor: `${RED}18`, border: `1px solid ${RED}33`, borderRadius: 6, fontSize: 13, color: '#ff8080' }}>
              {errMsg}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <button onClick={confirm}
            disabled={loading || !cashOk}
            style={{
              width: '100%', padding: isSmall ? '18px 0' : '14px 0', borderRadius: 10, border: 'none',
              backgroundColor: btnBg, color: btnColor,
              fontWeight: 800, fontSize: isSmall ? 16 : 15, letterSpacing: '1.5px', textTransform: 'uppercase',
              cursor: loading ? 'wait' : !cashOk ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-heading)', transition: 'all .2s',
            }}>
            {loading ? 'กำลังบันทึก...'
              : method === 'cash' && received === '' ? 'กรอกจำนวนเงิน'
              : method === 'transfer' && !selectedBank ? 'เลือกธนาคารก่อน'
              : method === 'split' && splitTotal < finalTotal ? `ขาดอีก ${(finalTotal - splitTotal).toLocaleString('en-US')} ₭`
              : `ยืนยันชำระ ${fmtLak(finalTotal)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SettingsPopup ────────────────────────────────────────────────────────────

function SettingsPopup({ onClose }: { onClose: () => void }) {
  const ls = (k: string, fallback = '') => typeof window !== 'undefined' ? localStorage.getItem(k) ?? fallback : fallback

  const [currency,    setCurrency]    = useState(() => ls('pos_currency', 'LAK'))
  const [printerIp,   setPrinterIpState] = useState(() => ls('printer_ip'))
  const [paperWidth,  setPaperWidth]  = useState<'58' | '80'>(() => ls('pos_paper_width', '80') === '80' ? '80' : '58')
  const [shopName,   setShopName]   = useState(() => ls('receipt_shop_name'))
  const [footerText, setFooterText] = useState(() => ls('receipt_footer_text', 'Thank you for visiting'))
  const [phone,      setPhone]      = useState(() => ls('receipt_phone'))
  const [address,    setAddress]    = useState(() => ls('receipt_address'))
  const [showQr,     setShowQr]     = useState(() => ls('receipt_show_qr',  'true') === 'true')
  const [showVat,    setShowVat]    = useState(() => ls('receipt_show_vat', 'true') === 'true')

  // Receipt designer
  const [showLogo,       setShowLogo]       = useState(() => ls('receipt_show_logo',       'true')  === 'true')
  const [showReceiptNum, setShowReceiptNum] = useState(() => ls('receipt_show_receipt_num','true')  === 'true')
  const [showStaff,      setShowStaff]      = useState(() => ls('receipt_show_staff',      'false') === 'true')
  const [staffName,      setStaffName]      = useState(() => ls('receipt_staff_name'))
  const [showQueueLarge, setShowQueueLarge] = useState(() => ls('receipt_show_queue_large','true')  === 'true')
  const [showItemPrice,  setShowItemPrice]  = useState(() => ls('receipt_show_item_price', 'true')  === 'true')
  const [extraLine1,     setExtraLine1]     = useState(() => ls('receipt_extra_line_1'))
  const [extraLine2,     setExtraLine2]     = useState(() => ls('receipt_extra_line_2'))
  const [blankLines,     setBlankLines]     = useState(() => parseInt(ls('receipt_blank_lines', '4'), 10) || 4)
  const [showPreview,       setShowPreview]       = useState(false)
  const [skipReceiptPreview, setSkipReceiptPreview] = useState(() => ls('pos_skip_receipt_preview', 'false') === 'true')

  const [serverPrinterName, setServerPrinterName] = useState(() => ls('pos_printer_name'))
  const [serverPrinters,    setServerPrinters]    = useState<string[]>([])
  const [printersLoading,   setPrintersLoading]   = useState(false)

  const [printerName,      setPrinterName]      = useState<string | null>(null)
  const [printerConnected, setPrinterConnected] = useState(false)
  const [printerBusy,      setPrinterBusy]      = useState(false)
  const [webUsbSupported,  setWebUsbSupported]  = useState(true)
  const [serverOk,         setServerOk]         = useState<boolean | null>(null)
  const [testPrintMsg,     setTestPrintMsg]     = useState<{ text: string; ok: boolean } | null>(null)
  const [lastPrintInfo,    setLastPrintInfo]    = useState<{ time: string; result: 'success' | 'error'; error?: string } | null>(() => {
    try { const s = ls('pos_last_print_info'); return s ? JSON.parse(s) : null } catch { return null }
  })
  const [isHttpsCtx,       setIsHttpsCtx]       = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  async function checkServer(): Promise<boolean> {
    try {
      const res = await fetch('http://127.0.0.1:12345/status', { signal: AbortSignal.timeout(2000) })
      const ok = res.ok
      setServerOk(ok)
      return ok
    } catch {
      setServerOk(false)
      return false
    }
  }

  async function fetchPrinters() {
    setPrintersLoading(true)
    try {
      const res = await fetch('http://127.0.0.1:12345/printers', { signal: AbortSignal.timeout(3000) })
      const json = await res.json()
      if (json.ok && Array.isArray(json.printers)) setServerPrinters(json.printers)
    } catch { /* server not running */ }
    finally { setPrintersLoading(false) }
  }

  useEffect(() => {
    setIsHttpsCtx(window.location.protocol === 'https:')
    checkServer().then(ok => { if (ok) fetchPrinters() })
    if (!printerIsSupported()) { setWebUsbSupported(false); return }
    getPrinterStatus().then(s => {
      setPrinterConnected(s.connected)
      setPrinterName(s.deviceName)
    })
  }, [])

  function detectPaperWidth(name: string | null): 58 | 80 | null {
    if (!name) return null
    const n = name.toLowerCase()
    if (/58/.test(n)) return 58
    if (/80/.test(n)) return 80
    return null
  }

  async function handleConnect() {
    setPrinterBusy(true)
    try {
      const name = await connectPrinter()
      setPrinterConnected(true)
      setPrinterName(name)
      const detected = detectPaperWidth(name)
      if (detected) setPaperWidth(String(detected) as '58' | '80')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('No device selected') && !msg.includes('cancelled')) setPrinterConnected(false)
    } finally { setPrinterBusy(false) }
  }

  async function handleDisconnect() {
    await disconnectPrinter()
    setPrinterConnected(false)
    setPrinterName(null)
  }

  async function handleTestPrint() {
    setPrinterBusy(true)
    setTestPrintMsg(null)
    const ok   = await checkServer()
    const name = serverPrinterName.trim()
    try {
      if (name) {
        if (!ok) {
          setTestPrintMsg({ text: 'Print Server ไม่ได้รัน — เปิด AlanPOS-PrintServer.exe ก่อน', ok: false })
        } else {
          const res = await fetch(
            `http://127.0.0.1:12345/test-ascii?printer=${encodeURIComponent(name)}&width=${paperWidth}`,
            { signal: AbortSignal.timeout(10000) }
          )
          const json = await res.json().catch(() => ({}))
          if (res.ok) {
            setTestPrintMsg({ text: 'ส่งงานพิมพ์สำเร็จ ✓', ok: true })
          } else {
            setTestPrintMsg({ text: `ล้มเหลว: ${(json as { error?: string }).error ?? `HTTP ${res.status}`}`, ok: false })
          }
        }
      } else {
        await thermalTestPrint(shopName || 'ALAN COFFEE & TRAVEL')
        setTestPrintMsg({ text: 'ส่งงานพิมพ์สำเร็จ ✓', ok: true })
      }
    } catch (e) {
      console.error('[POS] Test print failed:', e)
      setTestPrintMsg({ text: `ล้มเหลว: ${e instanceof Error ? e.message : String(e)}`, ok: false })
    }
    setPrinterBusy(false)
    setTimeout(() => setTestPrintMsg(null), 6000)
  }

  async function handleDebugUsb() {
    const info = await debugDevices()
    setTestPrintMsg({ text: `USB: ${info}`, ok: true })
    setTimeout(() => setTestPrintMsg(null), 8000)
  }

  function save() {
    try {
      localStorage.setItem('pos_currency',        currency)
      localStorage.setItem('pos_paper_width',     paperWidth)
      if (printerIp.trim()) localStorage.setItem('printer_ip', printerIp.trim())
      else                  localStorage.removeItem('printer_ip')
      saveServerPrinterName(serverPrinterName)
      localStorage.setItem('receipt_shop_name',   shopName)
      localStorage.setItem('receipt_footer_text', footerText)
      localStorage.setItem('receipt_phone',       phone)
      localStorage.setItem('receipt_address',     address)
      localStorage.setItem('receipt_show_qr',          String(showQr))
      localStorage.setItem('receipt_show_vat',         String(showVat))
      localStorage.setItem('receipt_show_logo',        String(showLogo))
      localStorage.setItem('receipt_show_receipt_num', String(showReceiptNum))
      localStorage.setItem('receipt_show_staff',       String(showStaff))
      localStorage.setItem('receipt_staff_name',       staffName)
      localStorage.setItem('receipt_show_queue_large', String(showQueueLarge))
      localStorage.setItem('receipt_show_item_price',  String(showItemPrice))
      localStorage.setItem('receipt_extra_line_1',     extraLine1)
      localStorage.setItem('receipt_extra_line_2',     extraLine2)
      localStorage.setItem('receipt_blank_lines',      String(blankLines))
      localStorage.setItem('pos_skip_receipt_preview', String(skipReceiptPreview))
    } catch { /* ignore */ }
    onClose()
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 11, color: GOLD, letterSpacing: '1.5px', textTransform: 'uppercase',
    marginBottom: 10, fontWeight: 600,
  }

  return (
    <div ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose() }} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      backgroundColor: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        backgroundColor: '#181818', border: `1px solid ${GOLD}44`,
        borderRadius: 14, width: 420, maxHeight: '88vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>⚙️ POS Settings</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Printer */}
          <div>
            <div style={sectionLabel}>เครื่องพิมพ์ใบเสร็จ</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>IP เครื่องพิมพ์ WiFi (ถ้ามี)</div>
              <input
                value={printerIp}
                onChange={e => setPrinterIpState(e.target.value)}
                style={popupInput}
                placeholder="192.168.1.100  (ว่างไว้ = ใช้ USB)"
              />
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
                ระบบจะลองพิมพ์ตามลำดับ: WiFi → Print Server → WebUSB → หน้าจอ
              </div>
            </div>

            {/* Windows printer name selector */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>เลือกเครื่องพิมพ์ (Print Server)</div>
              {serverOk && serverPrinters.length > 0 ? (
                <select
                  value={serverPrinterName}
                  onChange={e => setServerPrinterName(e.target.value)}
                  style={{ ...popupInput, cursor: 'pointer' }}
                >
                  <option value="">— ไม่ระบุ (ใช้ USB auto) —</option>
                  {serverPrinters.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={serverPrinterName}
                  onChange={e => setServerPrinterName(e.target.value)}
                  style={popupInput}
                  placeholder={
                    serverOk === null ? 'กำลังโหลด...'
                    : printersLoading ? 'กำลังโหลดรายการ...'
                    : serverOk === false ? 'Print Server ไม่พร้อม — พิมพ์ชื่อเองได้'
                    : 'ชื่อเครื่องพิมพ์ Windows'
                  }
                />
              )}
            </div>

            {/* Paper size */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>ขนาดกระดาษ</div>
              {(() => {
                const detected = detectPaperWidth(printerName)
                if (detected) {
                  return (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                      📄 {detected}mm (ตรวจพบอัตโนมัติ)
                    </div>
                  )
                }
                return (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['58', '80'] as const).map(w => (
                      <button key={w} onClick={() => setPaperWidth(w)} style={{
                        flex: 1, padding: '7px 0', borderRadius: 7, cursor: 'pointer',
                        fontSize: 12, fontWeight: paperWidth === w ? 700 : 400,
                        border: `1px solid ${paperWidth === w ? GOLD : 'rgba(255,255,255,0.1)'}`,
                        backgroundColor: paperWidth === w ? `${GOLD}18` : 'transparent',
                        color: paperWidth === w ? GOLD : 'rgba(255,255,255,0.45)',
                      }}>
                        📄 {w}mm
                      </button>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Status indicator */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: (serverOk || printerConnected) ? GREEN : 'rgba(255,255,255,0.35)' }}>
                {serverOk === null
                  ? '⏳ กำลังตรวจสอบ...'
                  : serverOk
                  ? '🟢 Print Server พร้อม'
                  : printerConnected
                  ? `🟢 WebUSB เชื่อมต่อแล้ว${printerName ? ` — ${printerName}` : ''}`
                  : '🔴 ยังไม่เชื่อมต่อ'}
              </div>
            </div>

            {/* Test print — always enabled */}
            <button onClick={handleTestPrint} disabled={printerBusy} style={{
              width: '100%', padding: '8px 0', borderRadius: 7, marginBottom: 8,
              border: `1px solid ${GOLD}55`, backgroundColor: `${GOLD}14`, color: GOLD,
              fontSize: 12, fontWeight: 700, cursor: printerBusy ? 'wait' : 'pointer',
            }}>
              {printerBusy ? 'กำลังพิมพ์...' : '📄 ทดสอบพิมพ์'}
            </button>

            {/* Test print result */}
            {testPrintMsg && (
              <div style={{
                marginBottom: 8, padding: '7px 10px', borderRadius: 7,
                backgroundColor: testPrintMsg.ok ? 'rgba(76,186,127,0.1)' : 'rgba(255,107,107,0.1)',
                border: `1px solid ${testPrintMsg.ok ? 'rgba(76,186,127,0.3)' : 'rgba(255,107,107,0.3)'}`,
                fontSize: 12, fontWeight: 600,
                color: testPrintMsg.ok ? GREEN : '#ff6b6b',
                lineHeight: 1.4,
              }}>
                {testPrintMsg.ok ? '✓ ' : '✗ '}{testPrintMsg.text}
              </div>
            )}

            {/* Last print attempt */}
            {lastPrintInfo && (
              <div style={{
                marginBottom: 8, padding: '6px 10px', borderRadius: 7,
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5,
              }}>
                <span style={{ marginRight: 6 }}>
                  ครั้งล่าสุด:{' '}
                  {(() => { try { return new Date(lastPrintInfo.time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return lastPrintInfo.time } })()}
                </span>
                <span style={{ fontWeight: 700, color: lastPrintInfo.result === 'success' ? GREEN : '#ff6b6b' }}>
                  {lastPrintInfo.result === 'success' ? '✓ สำเร็จ' : `✗ ${lastPrintInfo.error ?? 'ล้มเหลว'}`}
                </span>
              </div>
            )}

            {/* HTTPS warning */}
            {isHttpsCtx && (
              <div style={{
                marginBottom: 8, padding: '8px 10px', borderRadius: 7,
                backgroundColor: 'rgba(201,168,76,0.08)',
                border: '1px solid rgba(201,168,76,0.25)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, marginBottom: 3 }}>
                  ⚠ URL เป็น HTTPS — Print Server ต้องการ HTTP
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: 5 }}>
                  เบราว์เซอร์บล็อก HTTP request จาก HTTPS
                </div>
                <button
                  onClick={() => { window.location.href = window.location.href.replace('https://', 'http://') }}
                  style={{
                    padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${GOLD}55`, backgroundColor: `${GOLD}18`,
                    color: GOLD, fontSize: 11, fontWeight: 700,
                  }}
                >🔗 เปลี่ยนไปใช้ HTTP</button>
              </div>
            )}

            {/* WebUSB section */}
            {webUsbSupported ? (
              <div style={{ display: 'flex', gap: 8 }}>
                {!printerConnected ? (
                  <button onClick={handleConnect} disabled={printerBusy} style={{
                    flex: 1, padding: '7px 0', borderRadius: 7,
                    border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'transparent',
                    color: 'rgba(255,255,255,0.45)', fontSize: 11, cursor: printerBusy ? 'wait' : 'pointer',
                  }}>
                    {printerBusy ? '...' : '🔌 เชื่อมต่อ WebUSB'}
                  </button>
                ) : (
                  <button onClick={handleDisconnect} style={{
                    flex: 1, padding: '7px 0', borderRadius: 7,
                    border: '1px solid rgba(220,80,80,0.3)', backgroundColor: 'rgba(220,80,80,0.08)',
                    color: '#e07070', fontSize: 11, cursor: 'pointer',
                  }}>ยกเลิก WebUSB</button>
                )}
                <button onClick={handleDebugUsb} style={{
                  flex: 1, padding: '7px 0', borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent',
                  color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer',
                }}>🔍 Debug USB</button>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>
                WebUSB ไม่รองรับ (ใช้ Chrome/Edge) — Print Server ยังใช้งานได้
              </div>
            )}
          </div>

          {/* Receipt customization */}
          <div>
            <div style={sectionLabel}>ปรับแต่งใบเสร็จ</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
              ใบเสร็จแสดงภาษาอังกฤษเท่านั้น (รองรับหลายภาษาในเวอร์ชั่นถัดไป)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>ชื่อร้านบนใบเสร็จ</div>
                <input value={shopName} onChange={e => setShopName(e.target.value)} style={popupInput} placeholder="ALAN COFFEE & TRAVEL" />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>ข้อความท้ายใบเสร็จ</div>
                <input value={footerText} onChange={e => setFooterText(e.target.value)} style={popupInput} placeholder="Thank you for visiting" />
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                  ข้อความนี้แสดงเป็นภาษาอังกฤษบนใบเสร็จเท่านั้น
                </div>
                {/[^\x00-\x7F]/.test(footerText) && (
                  <div style={{ fontSize: 10, color: '#e07070', marginTop: 3 }}>
                    ⚠ ตัวอักษรที่ไม่ใช่ภาษาอังกฤษจะแสดงเป็น ?
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>เบอร์โทร</div>
                  <input value={phone} onChange={e => setPhone(e.target.value)} style={popupInput} placeholder="020 xxx xxxx" />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>ที่อยู่ / สาขา</div>
                  <input value={address} onChange={e => setAddress(e.target.value)} style={popupInput} placeholder="Vientiane, Laos" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['qr', 'vat'] as const).map(key => {
                  const val    = key === 'qr' ? showQr : showVat
                  const setter = key === 'qr' ? setShowQr : setShowVat
                  const label  = key === 'qr' ? 'แสดง QR Code' : 'แสดง VAT'
                  return (
                    <button key={key} onClick={() => setter(!val)} style={{
                      flex: 1, padding: '7px 0', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                      fontWeight: val ? 700 : 400,
                      border: `1px solid ${val ? GOLD : 'rgba(255,255,255,0.1)'}`,
                      backgroundColor: val ? `${GOLD}18` : 'transparent',
                      color: val ? GOLD : 'rgba(255,255,255,0.4)',
                    }}>{val ? '✓ ' : ''}{label}</button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Receipt Designer */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={sectionLabel}>ออกแบบใบเสร็จ</div>
              <button onClick={() => setShowPreview(true)} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${GOLD}55`, backgroundColor: `${GOLD}14`, color: GOLD,
              }}>ดูตัวอย่าง</button>
            </div>

            {/* Toggle grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              {([
                ['showLogo',       showLogo,       setShowLogo,       'ชื่อร้าน'],
                ['showReceiptNum', showReceiptNum, setShowReceiptNum, 'เลขใบเสร็จ'],
                ['showStaff',      showStaff,      setShowStaff,      'ชื่อพนักงาน'],
                ['showQueueLarge', showQueueLarge, setShowQueueLarge, 'เลขคิวใหญ่'],
                ['showItemPrice',  showItemPrice,  setShowItemPrice,  'ราคาต่อชิ้น'],
                ['showVat',        showVat,        setShowVat,        'VAT breakdown'],
              ] as [string, boolean, (v: boolean) => void, string][]).map(([key, val, setter, label]) => (
                <button key={key} onClick={() => setter(!val)} style={{
                  padding: '7px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                  fontWeight: val ? 700 : 400, textAlign: 'left',
                  border: `1px solid ${val ? GOLD : 'rgba(255,255,255,0.1)'}`,
                  backgroundColor: val ? `${GOLD}18` : 'transparent',
                  color: val ? GOLD : 'rgba(255,255,255,0.4)',
                }}>{val ? '✓ ' : '○ '}{label}</button>
              ))}
            </div>

            {/* Staff name (shown when toggle is on) */}
            {showStaff && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>ชื่อพนักงาน</div>
                <input value={staffName} onChange={e => setStaffName(e.target.value)}
                  style={popupInput} placeholder="เช่น Alan" />
              </div>
            )}

            {/* Extra text lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              <div>
                <input value={extraLine1} onChange={e => setExtraLine1(e.target.value)}
                  style={popupInput} placeholder="ข้อความพิเศษบรรทัดที่ 1 (เว้นว่างเพื่อซ่อน)" />
                {/[^\x00-\x7F]/.test(extraLine1) && (
                  <div style={{ fontSize: 10, color: '#e07070', marginTop: 3 }}>⚠ ตัวอักษรที่ไม่ใช่ภาษาอังกฤษจะแสดงเป็น ?</div>
                )}
              </div>
              <div>
                <input value={extraLine2} onChange={e => setExtraLine2(e.target.value)}
                  style={popupInput} placeholder="ข้อความพิเศษบรรทัดที่ 2" />
                {/[^\x00-\x7F]/.test(extraLine2) && (
                  <div style={{ fontSize: 10, color: '#e07070', marginTop: 3 }}>⚠ ตัวอักษรที่ไม่ใช่ภาษาอังกฤษจะแสดงเป็น ?</div>
                )}
              </div>
            </div>

            {/* Blank feed lines */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>บรรทัดว่างท้ายบิล</div>
              <input type="range" min={1} max={10} value={blankLines}
                onChange={e => setBlankLines(parseInt(e.target.value, 10))}
                style={{ flex: 1, accentColor: GOLD }} />
              <div style={{ fontSize: 12, color: GOLD, minWidth: 20, textAlign: 'right' }}>{blankLines}</div>
            </div>
          </div>

          {/* Preview modal (rendered inside the settings overlay) */}
          {showPreview && (() => {
            const design: ReceiptDesign = {
              showLogo, showReceiptNum, showStaff, staffName,
              showQueueLarge, showItemPrice,
              extraLine1, extraLine2, blankLines,
            }
            const sample = buildReceiptText({
              shopName: shopName || 'ALAN COFFEE & TRAVEL',
              queue: 42, receipt: '042',
              table: 'A1', customer: 'ลูกค้าทดสอบ',
              cartSnapshot: [
                { qty: 2, recipe: { product_name: 'Lao Coffee', price_lak: 25000 }, customization: 'ไม่ใส่น้ำตาล' },
                { qty: 1, recipe: { product_name: 'Matcha Latte', price_lak: 35000 }, customization: '' },
              ],
              subtotal: 85000, discountAmt: 0, discountReason: '', finalTotal: 85000,
              method: 'cash', received: 100000, change: 15000, vatPct: 0,
              footerText: footerText || 'Thank you for visiting',
              phone: phone || '', address: address || '',
            }, design)
            return (
              <div onClick={() => setShowPreview(false)} style={{
                position: 'fixed', inset: 0, zIndex: 300,
                backgroundColor: 'rgba(0,0,0,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              }}>
                <div onClick={e => e.stopPropagation()} style={{
                  backgroundColor: '#fff', borderRadius: 8, padding: '16px',
                  maxHeight: '80vh', overflowY: 'auto', maxWidth: 360, width: '100%',
                }}>
                  <div style={{ fontSize: 10, color: '#999', marginBottom: 8, fontFamily: 'monospace' }}>
                    ตัวอย่างใบเสร็จ (80mm) — กดพื้นหลังเพื่อปิด
                  </div>
                  <pre style={{
                    fontFamily: 'Courier New, monospace', fontSize: 8, lineHeight: 1.4,
                    margin: 0, whiteSpace: 'pre', color: '#111', overflowX: 'auto',
                  }}>{sample}</pre>
                </div>
              </div>
            )
          })()}

          {/* Currency */}
          <div>
            <div style={sectionLabel}>สกุลเงินที่แสดง</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['LAK', 'THB', 'USD'].map(c => (
                <button key={c} onClick={() => setCurrency(c)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 6,
                  border: `1px solid ${currency === c ? GOLD : 'rgba(255,255,255,0.1)'}`,
                  backgroundColor: currency === c ? `${GOLD}18` : 'transparent',
                  color: currency === c ? GOLD : 'rgba(255,255,255,0.4)',
                  fontWeight: currency === c ? 700 : 400, fontSize: 13, cursor: 'pointer',
                }}>{c}</button>
              ))}
            </div>
          </div>

          {/* Receipt preview setting */}
          <div>
            <div style={sectionLabel}>การพิมพ์</div>
            <button onClick={() => setSkipReceiptPreview(v => !v)} style={{
              width: '100%', padding: '10px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
              border: `1px solid ${!skipReceiptPreview ? GOLD : 'rgba(255,255,255,0.1)'}`,
              backgroundColor: !skipReceiptPreview ? `${GOLD}14` : 'transparent',
              color: !skipReceiptPreview ? GOLD : 'rgba(255,255,255,0.45)',
              fontSize: 13, fontWeight: !skipReceiptPreview ? 700 : 400, display: 'flex', justifyContent: 'space-between',
            }}>
              <span>{!skipReceiptPreview ? '✓ ' : '○ '}แสดงตัวอย่างก่อนพิมพ์</span>
              <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>
                {!skipReceiptPreview ? 'เปิดอยู่' : 'ปิดอยู่'}
              </span>
            </button>
          </div>

          {/* Quick links */}
          <div>
            <div style={sectionLabel}>ลิงก์ด่วน</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ href: '/cafe', label: '⚙️ Admin' }, { href: '/queue', label: '📺 คิว TV' }, { href: '/', label: '🌐 เว็บ' }].map(l => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" style={{
                  flex: 1, padding: '8px 0', borderRadius: 6, textAlign: 'center',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.5)', fontSize: 12, textDecoration: 'none',
                }}>{l.label}</a>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <button onClick={save} style={{
            width: '100%', padding: '12px 0', borderRadius: 8, border: 'none',
            backgroundColor: GOLD, color: BLACK, fontWeight: 800, fontSize: 14,
            cursor: 'pointer', fontFamily: 'var(--font-heading)',
          }}>บันทึก</button>
        </div>
      </div>
    </div>
  )
}

// ─── ShiftClosePopup ─────────────────────────────────────────────────────────

function ShiftClosePopup({ todayTotal, todayCount, onClose }: { todayTotal: number; todayCount: number; onClose: () => void }) {
  type StaffBasic = { id: string; name: string }
  const [shift,        setShift]       = useState(() => {
    const h = new Date().getHours()
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  })
  const [openingCash, setOpeningCash] = useState('')
  const [actualCash,  setActualCash]  = useState('')
  const [activeField, setActiveField] = useState<'opening' | 'actual'>('actual')
  const [saving,      setSaving]      = useState(false)
  const [done,        setDone]        = useState(false)
  const [errMsg,      setErrMsg]      = useState('')
  const [staffList,   setStaffList]   = useState<StaffBasic[]>([])
  const [staffId,     setStaffId]     = useState(() => typeof window !== 'undefined' ? localStorage.getItem('pos_staff_id') ?? '' : '')
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('staff').select('id, name').eq('status', 'active').order('name')
      .then(({ data }) => setStaffList((data ?? []) as StaffBasic[]))
  }, [])

  const variance = actualCash !== '' && openingCash !== ''
    ? parseFloat(actualCash) - (parseFloat(openingCash) + todayTotal)
    : null

  function pressKey(k: string) {
    const setter = activeField === 'opening' ? setOpeningCash : setActualCash
    setter(prev => {
      if (k === '⌫') return prev.slice(0, -1)
      if (k === '00') return prev === '' ? '' : prev + '00'
      return prev + k
    })
  }

  async function confirm() {
    if (!openingCash || !actualCash) { setErrMsg('กรอกยอดเงินให้ครบ'); return }
    if (staffId) localStorage.setItem('pos_staff_id', staffId)
    setSaving(true); setErrMsg('')
    const { error } = await supabase.rpc('close_shift', {
      p_staff_id:     staffId || null,
      p_shift:        shift,
      p_opening_cash: parseFloat(openingCash),
      p_actual_cash:  parseFloat(actualCash),
      p_system_sales: todayTotal,
    })
    setSaving(false)
    if (error) { setErrMsg(error.message); return }
    setDone(true)
    setTimeout(onClose, 2000)
  }

  return (
    <div ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ backgroundColor: '#111', border: `1px solid ${GOLD}44`, borderRadius: 16, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>🔒 ปิดกะ</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>สรุปรายได้และนับเงินสด</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {done ? (
          <div style={{ padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>บันทึกปิดกะสำเร็จ!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>กำลังปิดหน้าต่าง...</div>
          </div>
        ) : (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* System summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px' }}>ยอดขายระบบ</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: GOLD, marginTop: 4 }}>{todayTotal.toLocaleString('en-US')}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>LAK</div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px' }}>จำนวนออเดอร์</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 4 }}>{todayCount}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>รายการ</div>
              </div>
            </div>

            {/* Staff selector */}
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px' }}>พนักงาน</div>
              <select value={staffId} onChange={e => setStaffId(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid rgba(255,255,255,0.12)`, backgroundColor: '#1a1a1a', color: staffId ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }}>
                <option value="">— ไม่ระบุ —</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Shift selector */}
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px' }}>กะ</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['morning', 'เช้า'], ['afternoon', 'บ่าย'], ['evening', 'เย็น']].map(([v, l]) => (
                  <button key={v} onClick={() => setShift(v)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 13, fontWeight: shift === v ? 700 : 400, cursor: 'pointer', border: `1px solid ${shift === v ? GOLD : 'rgba(255,255,255,0.1)'}`, backgroundColor: shift === v ? `${GOLD}18` : 'rgba(255,255,255,0.04)', color: shift === v ? GOLD : 'rgba(255,255,255,0.45)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {([['opening', 'เงินเปิดกะ', openingCash], ['actual', 'เงินที่นับได้', actualCash]] as const).map(([field, label, val]) => (
                <div key={field}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
                  <div onClick={() => setActiveField(field)}
                    style={{ padding: '10px 12px', borderRadius: 8, border: `2px solid ${activeField === field ? GOLD : 'rgba(255,255,255,0.1)'}`, backgroundColor: activeField === field ? `${GOLD}08` : '#1a1a1a', cursor: 'text', minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: val ? '#fff' : 'rgba(255,255,255,0.2)' }}>
                      {val ? parseInt(val).toLocaleString('en-US') : '0'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Numpad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
              {NUMPAD_KEYS.map(key => (
                <button key={key} onClick={() => pressKey(key)} style={{
                  padding: '14px 0', borderRadius: 8, border: 'none',
                  backgroundColor: key === '⌫' ? 'rgba(220,80,80,0.14)' : 'rgba(255,255,255,0.07)',
                  color: key === '⌫' ? '#e07070' : '#fff',
                  fontSize: key === '⌫' ? 16 : 18, fontWeight: 700, cursor: 'pointer',
                }}>{key}</button>
              ))}
            </div>

            {/* Variance */}
            {variance !== null && (
              <div style={{ padding: '10px 14px', borderRadius: 9, backgroundColor: Math.abs(variance) <= 5000 ? `${GREEN}12` : `${RED}12`, border: `1px solid ${Math.abs(variance) <= 5000 ? GREEN : RED}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>ผลต่าง (เงินจริง − ยอดขาย − เปิดกะ)</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: Math.abs(variance) <= 5000 ? GREEN : RED }}>
                  {variance >= 0 ? '+' : ''}{variance.toLocaleString('en-US')}
                </span>
              </div>
            )}

            {errMsg && <div style={{ color: RED, fontSize: 13 }}>{errMsg}</div>}

            <button onClick={() => void confirm()} disabled={saving}
              style={{ padding: '14px', borderRadius: 10, border: 'none', backgroundColor: GOLD, color: BLACK, fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'กำลังบันทึก...' : '✓ ยืนยันปิดกะ'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── VoidRow ─────────────────────────────────────────────────────────────────

function VoidRow({ order, onVoided }: { order: TodayOrder; onVoided: () => void }) {
  const [open,    setOpen]    = useState(false)
  const [reason,  setReason]  = useState('')
  const [loading, setLoading] = useState(false)

  async function doVoid() {
    setLoading(true)
    await supabase.rpc('void_order', { p_order_id: order.id, p_reason: reason || 'ยกเลิก' })
    setLoading(false); setOpen(false)
    onVoided()
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{
      padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(220,80,80,0.3)',
      backgroundColor: 'rgba(220,80,80,0.08)', color: '#e07070', fontSize: 11, cursor: 'pointer',
    }}>Void</button>
  )

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="เหตุผล..."
        style={{ ...popupInput, padding: '3px 8px', fontSize: 11, width: 100 }} />
      <button onClick={doVoid} disabled={loading} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', backgroundColor: RED, color: '#fff', fontSize: 11, cursor: 'pointer' }}>
        {loading ? '...' : 'ยืนยัน'}
      </button>
      <button onClick={() => setOpen(false)} style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer' }}>✕</button>
    </div>
  )
}

// ─── OrdersDrawer ─────────────────────────────────────────────────────────────

function OrdersDrawer({ open, onClose, queueEntries, todayOrders, todayTotal, todayCount, onUpdateQueue, onVoided }: {
  open: boolean
  onClose: () => void
  queueEntries: QueueEntry[]
  todayOrders: TodayOrder[]
  todayTotal: number
  todayCount: number
  onUpdateQueue: (orderId: string, status: string) => void
  onVoided: () => void
}) {
  return (
    <>
      {open && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      )}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 420, zIndex: 201,
        backgroundColor: '#111', borderLeft: '1px solid rgba(255,255,255,0.08)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.24s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>คิว &amp; ออเดอร์วันนี้</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Queue section */}
        <div style={{ flex: '0 0 auto', borderBottom: '2px solid rgba(255,255,255,0.07)' }}>
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: queueEntries.length > 0 ? GOLD : 'rgba(255,255,255,0.3)' }}>
              คิวปัจจุบัน {queueEntries.length > 0 && <span style={{ backgroundColor: `${GOLD}22`, color: GOLD, padding: '1px 8px', borderRadius: 999, fontSize: 11, marginLeft: 4 }}>{queueEntries.length}</span>}
            </span>
          </div>
          {queueEntries.length === 0 ? (
            <div style={{ padding: '12px 16px 16px', fontSize: 13, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>ยังไม่มีคิว</div>
          ) : (
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {queueEntries.map(entry => {
                const isMaking = entry.queue_status === 'making'
                return (
                  <div key={entry.order_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', backgroundColor: isMaking ? `${GOLD}08` : 'transparent' }}>
                    <div style={{ minWidth: 48, textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 15, fontVariantNumeric: 'tabular-nums', color: isMaking ? GOLD : 'rgba(255,255,255,0.4)' }}>{fmtQueue(entry.queue_number)}</div>
                      <div style={{ fontSize: 9, color: isMaking ? `${GOLD}aa` : 'rgba(255,255,255,0.2)' }}>{isMaking ? 'กำลังทำ' : 'รอคิว'}</div>
                    </div>
                    <div style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.summary || '—'}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => onUpdateQueue(entry.order_id, 'making')} disabled={isMaking}
                        style={{ height: 36, padding: '0 12px', borderRadius: 8, border: 'none', backgroundColor: isMaking ? 'rgba(255,255,255,0.03)' : `${GOLD}20`, color: isMaking ? 'rgba(255,255,255,0.12)' : GOLD, fontSize: 12, fontWeight: 700, cursor: isMaking ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                        {isMaking ? 'กำลังทำ' : 'เริ่มทำ'}
                      </button>
                      <button onClick={() => onUpdateQueue(entry.order_id, 'ready')}
                        style={{ height: 36, padding: '0 12px', borderRadius: 8, border: 'none', backgroundColor: 'rgba(76,186,127,0.12)', color: GREEN, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        พร้อม ✓
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Today's orders section */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>ออเดอร์วันนี้</span>
            {todayCount > 0 && <span style={{ fontSize: 12, color: GREEN, fontWeight: 700 }}>{todayCount} รายการ · {fmtLak(todayTotal)}</span>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {todayOrders.length === 0 ? (
              <div style={{ padding: '16px', fontSize: 13, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>ยังไม่มีออเดอร์วันนี้</div>
            ) : (
              todayOrders.map(order => {
                const isVoid = order.status === 'void'
                const payIcon = PAY_METHODS.find(m => m.value === order.payment_method)?.icon ?? '—'
                const summary = order.items.slice(0, 2).map(i => `${i.qty}× ${i.name}`).join(', ') + (order.items.length > 2 ? ` +${order.items.length - 2}` : '')
                return (
                  <div key={order.id} style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: isVoid ? 0.4 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 13, color: isVoid ? 'rgba(255,255,255,0.2)' : GOLD, minWidth: 40, fontVariantNumeric: 'tabular-nums' }}>{fmtQueue(order.queue_number)}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', minWidth: 36 }}>{fmtTime(order.created_at_vt)}</span>
                      <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isVoid ? 'rgba(255,255,255,0.2)' : '#fff', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmtLak(order.total_lak)}</span>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{payIcon}</span>
                      {isVoid ? (
                        <span style={{ fontSize: 10, color: RED, fontWeight: 700 }}>VOID</span>
                      ) : (
                        <VoidRow order={order} onVoided={onVoided} />
                      )}
                    </div>
                    {isVoid && order.void_reason && (
                      <div style={{ fontSize: 10, color: 'rgba(255,80,80,0.45)', marginTop: 2, paddingLeft: 46 }}>{order.void_reason}</div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── HeldOrdersModal ──────────────────────────────────────────────────────────

type HeldSort = 'recent' | 'oldest' | 'name'

function timeUntilExpiry(expiresAt: string): { label: string; soon: boolean } {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return { label: 'หมดอายุ', soon: true }
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(mins / 60)
  const soon = ms < 30 * 60 * 1000
  if (hours > 0) return { label: `หมดใน ${hours}ชม. ${mins % 60}น.`, soon }
  return { label: `หมดใน ${mins} นาที`, soon }
}

function HeldOrdersModal({ heldOrders, onResume, onDelete, onClose }: {
  heldOrders: HeldOrder[]
  onResume: (held: HeldOrder) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [sort,   setSort]   = useState<HeldSort>('recent')

  const filtered = useMemo(() => {
    let list = [...heldOrders]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(h =>
        (h.customer_name ?? '').toLowerCase().includes(q) ||
        (h.table_number  ?? '').toLowerCase().includes(q) ||
        h.cart_items.some(i => i.recipe.product_name.toLowerCase().includes(q))
      )
    }
    if (sort === 'recent')  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (sort === 'oldest')  list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    if (sort === 'name') {
      list.sort((a, b) => {
        const na = a.customer_name ?? a.table_number ?? ''
        const nb = b.customer_name ?? b.table_number ?? ''
        return na.localeCompare(nb, 'th')
      })
    }
    return list
  }, [heldOrders, search, sort])

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 210, backgroundColor: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ backgroundColor: '#131313', border: `1px solid ${GOLD}44`, borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '84vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
              ออเดอร์พัก
              {heldOrders.length > 0 && (
                <span style={{ marginLeft: 8, backgroundColor: `${GOLD}22`, color: GOLD, borderRadius: 999, padding: '1px 9px', fontSize: 12, fontWeight: 800 }}>
                  {heldOrders.length}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>แตะ "เรียกคืน" เพื่อดึงกลับมาในตะกร้า</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {/* Search + Sort bar */}
        {heldOrders.length > 0 && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'rgba(255,255,255,0.2)', pointerEvents: 'none' }}>🔍</span>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ / โต๊ะ / เมนู"
                style={{ width: '100%', padding: '7px 8px 7px 30px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
              )}
            </div>
            <select value={sort} onChange={e => setSort(e.target.value as HeldSort)}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
              <option value="recent">ล่าสุด</option>
              <option value="oldest">เก่าสุด</option>
              <option value="name">ชื่อ</option>
            </select>
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📋</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)' }}>
                {search ? `ไม่พบ "${search}"` : 'ยังไม่มีออเดอร์ที่พักไว้'}
              </div>
            </div>
          ) : filtered.map(held => {
            const label = held.table_number
              ? `โต๊ะ ${held.table_number}${held.customer_name ? ' · ' + held.customer_name : ''}`
              : (held.customer_name ?? 'ไม่ระบุ')
            const itemCount = held.cart_items.reduce((s, i) => s + i.qty, 0)
            const expiry    = timeUntilExpiry(held.expires_at)
            const preview   = held.cart_items.slice(0, 3).map(i => `${i.qty}× ${i.recipe.product_name}`).join(', ') + (held.cart_items.length > 3 ? ` +${held.cart_items.length - 3}` : '')
            return (
              <div key={held.id} style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                      {expiry.soon && (
                        <span style={{ flexShrink: 0, fontSize: 10, color: '#e07070', backgroundColor: 'rgba(220,80,80,0.12)', border: '1px solid rgba(220,80,80,0.2)', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                          {expiry.label}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>
                      {itemCount} รายการ · {fmtLak(held.total_lak)} · พัก {fmtTimeAgo(held.created_at)}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</div>
                    {!expiry.soon && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', marginTop: 2 }}>{expiry.label}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => { onResume(held); onClose() }}
                      style={{ height: 48, padding: '0 18px', borderRadius: 10, border: `1px solid ${GOLD}55`, backgroundColor: `${GOLD}14`, color: GOLD, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${GOLD}24` }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = `${GOLD}14` }}
                    >
                      ↩️ เรียกคืน
                    </button>
                    <button
                      onClick={() => onDelete(held.id)}
                      style={{ width: 48, height: 48, borderRadius: 10, border: '1px solid rgba(220,80,80,0.25)', backgroundColor: 'rgba(220,80,80,0.08)', color: '#e07070', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(220,80,80,0.15)' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(220,80,80,0.08)' }}
                      title="ลบออเดอร์"
                    >🗑️</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── HoldModal ────────────────────────────────────────────────────────────────

function HoldModal({ onConfirm, onClose }: {
  onConfirm: (tableName: string, customerName: string) => void
  onClose: () => void
}) {
  const [tableName,    setTableName]    = useState('')
  const [customerName, setCustomerName] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 150, backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#1a1a1a', border: `1px solid ${GOLD}44`, borderRadius: 14,
        padding: 28, width: 340, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>พักออเดอร์</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>ออเดอร์จะถูกบันทึกไว้ 4 ชั่วโมง</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>หมายเลขโต๊ะ</div>
            <input value={tableName} onChange={e => setTableName(e.target.value)}
              placeholder="เช่น A1, B2" style={popupInput} autoFocus />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>ชื่อลูกค้า</div>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)}
              placeholder="(ไม่บังคับ)" style={popupInput} />
          </div>
        </div>
        {!tableName.trim() && !customerName.trim() && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
            กรอกโต๊ะหรือชื่อลูกค้าอย่างน้อย 1 อย่าง
          </div>
        )}
        <button
          onClick={() => { if (tableName.trim() || customerName.trim()) onConfirm(tableName.trim(), customerName.trim()) }}
          disabled={!tableName.trim() && !customerName.trim()}
          style={{ padding: '13px 0', borderRadius: 10, border: 'none',
            backgroundColor: (tableName.trim() || customerName.trim()) ? GOLD : 'rgba(255,255,255,0.08)',
            color: (tableName.trim() || customerName.trim()) ? BLACK : 'rgba(255,255,255,0.2)',
            fontWeight: 800, fontSize: 15, cursor: (tableName.trim() || customerName.trim()) ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-heading)' }}>
          พักออเดอร์
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function POSClient() {
  const { employee: activeEmployee, ready: employeeReady, clockIn, clockOut } = useActiveEmployee()
  const [shopId,       setShopId]       = useState<string | null>(null)
  const [mounted,      setMounted]      = useState(false)
  const [recipes,      setRecipes]      = useState<Recipe[]>([])
  const [categories,   setCategories]   = useState<Category[]>([])
  const [loading,      setLoading]      = useState(true)
  const [cart,         setCart]         = useState<CartItem[]>([])
  const [pinnedIds,    setPinnedIds]    = useState<string[]>(() => getPinnedRecipes())
  const [confirmClear,  setConfirmClear]  = useState(false)
  const [activeL1,     setActiveL1]     = useState<string>('All')
  const [activeL2,     setActiveL2]     = useState<string | null>(null)
  const [now,          setNow]          = useState<Date | null>(null)
  // chargeStatus removed — flow now uses showReceiptPreview + showOrderSuccess
  const [successData,  setSuccessData]  = useState<SuccessData | null>(null)
  const [posSettings,  setPosSettings]  = useState<PosSettings>({ shop_name: '', vat_percent: 0, qr_payment_number: '', shop_line: '', shop_facebook: '' })
  const [pendingRecipe, setPendingRecipe] = useState<Recipe | null>(null)
  const [editingCartKey, setEditingCartKey] = useState<string | null>(null)
  const [discountPreset,      setDiscountPreset]      = useState<DiscountKey | ''>('')
  const [discountOtherAmt,    setDiscountOtherAmt]    = useState('')
  const [discountOtherReason, setDiscountOtherReason] = useState('')
  const [searchQuery,    setSearchQuery]    = useState('')
  const [queueEntries,  setQueueEntries] = useState<QueueEntry[]>([])
  const [todayOrders,   setTodayOrders]  = useState<TodayOrder[]>([])
  const [showCharge,     setShowCharge]    = useState(false)
  const [showSettings,   setShowSettings]  = useState(false)
  const [showShiftClose, setShowShiftClose] = useState(false)
  const [heldOrders,          setHeldOrders]          = useState<HeldOrder[]>([])
  const [showHoldModal,       setShowHoldModal]        = useState(false)
  const [showDrawer,          setShowDrawer]           = useState(false)
  const [showHeldModal,       setShowHeldModal]        = useState(false)
  const [showShortcuts,       setShowShortcuts]        = useState(false)
  const [showReceiptPreview,  setShowReceiptPreview]   = useState(false)
  const [showOrderSuccess,    setShowOrderSuccess]     = useState(false)
  const [previewReceiptText,  setPreviewReceiptText]   = useState('')
  const [selectedCustomer,    setSelectedCustomer]     = useState<Customer | null>(null)
  const [showCustomerSelector, setShowCustomerSelector] = useState(false)
  const printFnRef = useRef<(() => Promise<void>) | null>(null)
  const online = useNetworkStatus()
  const { enabled: testMode, toggle: toggleTestMode, disable: disableTestMode } = useTestMode()
  const { lang } = useLang()
  const [pwaPrompt,         setPwaPrompt]         = useState<BeforeInstallPromptEvent | null>(null)
  const [printFallbackLang, setPrintFallbackLang] = useState<'lo' | 'th' | null>(null)

  useEffect(() => {
    function onPrompt(e: Event) { e.preventDefault(); setPwaPrompt(e as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load shopId via auth client (needed for PIN verification)
  useEffect(() => {
    import('@/lib/supabase-auth').then(({ authClient }) => {
      authClient.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        authClient.from('shop_users').select('shop_id').eq('user_id', user.id).maybeSingle()
          .then(({ data }) => { if (data?.shop_id) setShopId(data.shop_id as string) })
      })
    })
  }, [])

  // Load cart from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    setNow(new Date())
    try {
      const saved = localStorage.getItem('pos_cart')
      if (saved) setCart(JSON.parse(saved) as CartItem[])
    } catch { /* ignore */ }
    setMounted(true)
    // Load shop settings for receipt
    supabase.rpc('get_site_settings').then(({ data }) => {
      if (data) {
        setPosSettings({
          shop_name:         (data.shop_name as string)         || '',
          vat_percent:       parseFloat((data.vat_percent as string) || '0') || 0,
          qr_payment_number: (data.qr_payment_number as string) || '',
          shop_line:         (data.shop_line as string)         || '',
          shop_facebook:     (data.shop_facebook as string)     || '',
        })
      }
    })
  }, [])

  // Persist cart to localStorage
  useEffect(() => {
    if (!mounted) return
    try { localStorage.setItem('pos_cart', JSON.stringify(cart)) } catch { /* ignore */ }
  }, [cart, mounted])

  // Live clock — only runs on client, no SSR mismatch
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Replay offline queue when back online or SW triggers it
  useEffect(() => {
    if (!online) return
    const replay = () => {
      replayQueue(async (payload) => {
        const { error } = await supabase.rpc('create_order_with_deduction', payload)
        if (!error) { window.dispatchEvent(new Event('alan:queue-changed')); return true }
        return false
      }).catch(() => {})
    }
    replay()
    window.addEventListener('alan:replay-offline-queue', replay)
    return () => window.removeEventListener('alan:replay-offline-queue', replay)
  }, [online])

  // Fetch categories
  useEffect(() => {
    supabase.from('categories').select('id, name, name_lo, parent_id, sort_order')
      .eq('is_active', true).order('sort_order')
      .then(({ data }) => setCategories((data as Category[]) ?? []))
  }, [])

  // Fetch menu (cache-first when offline)
  useEffect(() => {
    import('@/lib/menu-cache').then(({ fetchWithCache }) => {
      fetchWithCache<Recipe[]>(
        'pos-menu',
        async () => {
          const { data } = await supabase
            .from('recipes')
            .select('id, product_name, product_name_th, product_name_lo, category_id, price_lak, image_url, requires_customization, default_sweetness')
            .eq('is_active', true)
            .order('product_name')
          return (data as Recipe[]) ?? []
        }
      ).then(({ data }) => { setRecipes(data); setLoading(false) })
        .catch(() => setLoading(false))
    })

    const channel = supabase.channel('recipes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes' }, () => {
        supabase.from('recipes')
          .select('id, product_name, product_name_th, product_name_lo, category_id, price_lak, image_url, requires_customization, default_sweetness')
          .eq('is_active', true)
          .order('product_name')
          .then(({ data }) => {
            if (data) setRecipes(data.map(r => ({
              id: r.id as string,
              product_name: r.product_name as string,
              product_name_th: r.product_name_th as string | null,
              product_name_lo: r.product_name_lo as string | null,
              category: null,
              category_id: r.category_id as string | null,
              price_lak: r.price_lak as number,
              image_url: r.image_url as string | null,
              requires_customization: r.requires_customization as boolean,
              default_sweetness: r.default_sweetness as string | null,
            })))
          })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // L1 / L2 categories
  const l1Categories = useMemo(() => categories.filter(c => c.parent_id === null), [categories])
  const l2Categories = useMemo(() => {
    if (activeL1 === 'All') return []
    return categories.filter(c => c.parent_id === activeL1)
  }, [categories, activeL1])

  function selectL1(id: string) { setActiveL1(id); setActiveL2(null) }

  function getFamilyIds(parentId: string): string[] {
    const children = categories.filter(c => c.parent_id === parentId)
    return [parentId, ...children.flatMap(c => getFamilyIds(c.id))]
  }

  const filtered = useMemo(() => {
    if (activeL1 === 'All') return recipes
    if (activeL2) return recipes.filter(r => r.category_id === activeL2)
    const familyIds = getFamilyIds(activeL1)
    return recipes.filter(r => r.category_id && familyIds.includes(r.category_id))
  }, [recipes, activeL1, activeL2, categories])

  const displayRecipes = useMemo(() => {
    const base = searchQuery.trim()
      ? (() => {
          const q = searchQuery.trim().toLowerCase()
          return filtered.filter(r =>
            r.product_name.toLowerCase().includes(q) ||
            (r.product_name_th ?? '').toLowerCase().includes(q) ||
            (r.product_name_lo ?? '').toLowerCase().includes(q)
          )
        })()
      : filtered
    // Pinned items float to the top (stable sort)
    if (pinnedIds.length === 0 || searchQuery.trim()) return base
    return [...base].sort((a, b) => {
      const aPin = pinnedIds.includes(a.id) ? 0 : 1
      const bPin = pinnedIds.includes(b.id) ? 0 : 1
      return aPin - bPin
    })
  }, [filtered, searchQuery, pinnedIds])

  const subtotal   = cart.reduce((s, i) => s + i.recipe.price_lak * i.qty, 0)
  const totalItems = cart.reduce((s, i) => s + i.qty, 0)

  const baseDiscountAmt = discountPreset === 'employee' ? Math.round(subtotal * 0.15)
    : discountPreset === 'promo'   ? Math.round(subtotal * 0.10)
    : discountPreset === 'regular' ? Math.round(subtotal * 0.05)
    : discountPreset === 'other'   ? (parseInt(discountOtherAmt, 10) || 0)
    : 0
  const vipDiscountAmt = selectedCustomer ? computeVipDiscount(subtotal, selectedCustomer.vip_tier) : 0
  const discountAmt = baseDiscountAmt + vipDiscountAmt
  const discountLabel = discountPreset === 'employee' ? 'บัตรพนักงาน'
    : discountPreset === 'promo'   ? 'โปรโมชัน'
    : discountPreset === 'regular' ? 'ลูกค้าประจำ'
    : discountPreset === 'other'   ? (discountOtherReason || 'อื่นๆ')
    : vipDiscountAmt > 0 ? `VIP ${TIER_META[selectedCustomer!.vip_tier].label}`
    : ''
  const finalTotal = Math.max(subtotal - discountAmt, 0)

  // Cart actions
  function editCartItem(oldKey: string, newCustomization: string, newQty?: number) {
    setCart(prev => {
      const item = prev.find(i => i.cartKey === oldKey)
      if (!item) return prev
      const updatedQty = newQty ?? item.qty
      const newKey = `${item.recipe.id}::${newCustomization}`
      const existing = prev.find(i => i.cartKey === newKey && i.cartKey !== oldKey)
      if (existing) {
        return prev
          .filter(i => i.cartKey !== oldKey)
          .map(i => i.cartKey === newKey ? { ...i, qty: i.qty + updatedQty } : i)
      }
      return prev.map(i => i.cartKey === oldKey ? { ...i, cartKey: newKey, customization: newCustomization, qty: updatedQty } : i)
    })
  }

  function addToCartWithCustomization(recipe: Recipe, customization: string, qty = 1) {
    const cartKey = `${recipe.id}::${customization}`
    setCart(prev => {
      const existing = prev.find(i => i.cartKey === cartKey)
      if (existing) return prev.map(i => i.cartKey === cartKey ? { ...i, qty: i.qty + qty } : i)
      return [...prev, { cartKey, recipe, qty, customization }]
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


  // Charge success handler (called from ChargePopup)
  function handleChargeSuccess(
    queueNum: number, receipt: string, change: number, method: PaymentMethod,
    customer: string, table: string, discAmt: number, received: number, discReason: string,
    receiptLang: Lang = 'en',
  ) {
    const cartSnapshot = [...cart]
    const data: SuccessData = {
      queue: queueNum, receipt, change, method,
      customer, table,
      discountAmt: discAmt,
      discountReason: discReason,
      received,
      cartSnapshot,
      subtotal,
      finalTotal,
      receiptLang,
    }
    setSuccessData(data)
    setCart([])
    setDiscountPreset('')
    setDiscountOtherAmt('')
    setDiscountOtherReason('')
    setSelectedCustomer(null)
    try { localStorage.removeItem('pos_cart') } catch { /* ignore */ }
    setShowCharge(false)
    loadTodayOrders()

    // Build print function (captured in ref so ReceiptPreview can call it)
    printFnRef.current = async () => {
      const footerText = localStorage.getItem('receipt_footer_text') || 'Thank you for visiting'
      const phone      = localStorage.getItem('receipt_phone') || ''
      const address    = localStorage.getItem('receipt_address') || ''
      const shopName   = localStorage.getItem('receipt_shop_name') || posSettings.shop_name || 'ALAN COFFEE & TRAVEL'
      try {
        await thermalPrint({
          shopName, queue: queueNum, receipt, table, customer,
          cartSnapshot, subtotal, discountAmt: discAmt,
          discountReason: discReason, finalTotal, method,
          received, change, vatPct: posSettings.vat_percent,
          footerText, phone, address,
        })
        try { localStorage.setItem('pos_last_print_info', JSON.stringify({ time: new Date().toISOString(), result: 'success' })) } catch { /* ignore */ }
      } catch (e) {
        try { localStorage.setItem('pos_last_print_info', JSON.stringify({ time: new Date().toISOString(), result: 'error', error: e instanceof Error ? e.message : String(e) })) } catch { /* ignore */ }
        throw e
      }
    }

    // Build receipt text for preview
    const shopName = localStorage.getItem('receipt_shop_name') || posSettings.shop_name || 'ALAN COFFEE & TRAVEL'
    const footerText = localStorage.getItem('receipt_footer_text') || 'Thank you for visiting'
    const phone = localStorage.getItem('receipt_phone') || ''
    const address = localStorage.getItem('receipt_address') || ''
    const { lang: printLang, didFallback } = effectivePrintLang(receiptLang)
    if (didFallback && !hasDismissedFallbackWarning()) {
      setPrintFallbackLang(receiptLang as 'lo' | 'th')
    }

    const receiptText = buildReceiptText({
      shopName: testMode ? `*** TEST ORDER ***\n${shopName}` : shopName,
      queue: queueNum, receipt, table, customer,
      cartSnapshot, subtotal, discountAmt: discAmt,
      discountReason: discReason, finalTotal, method,
      received, change, vatPct: posSettings.vat_percent,
      footerText: testMode ? '*** THIS IS A TEST — NOT A REAL ORDER ***' : footerText,
      phone, address,
    }, getReceiptDesign(), printLang)
    setPreviewReceiptText(receiptText)

    const skipPreview = localStorage.getItem('pos_skip_receipt_preview') === 'true'
    if (skipPreview) {
      setShowOrderSuccess(true)
    } else {
      setShowReceiptPreview(true)
    }
  }

  function dismissOrderSuccess() {
    setShowOrderSuccess(false)
    setSuccessData(null)
    printFnRef.current = null
  }

  // ── Queue ─────────────────────────────────────────────────────────────────
  const fetchTodayQueue = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_today_pos_queue')
    if (error) return
    const active = ((data as QueueEntry[]) ?? []).filter(
      e => e.queue_status === null || e.queue_status === 'waiting' || e.queue_status === 'making'
    )
    setQueueEntries(active)
  }, [])

  const loadTodayOrders = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_today_orders')
    if (error) { console.warn('[POS] get_today_orders:', error.message); return }
    setTodayOrders((data as TodayOrder[]) ?? [])
  }, [])

  const loadHeldOrders = useCallback(async () => {
    const { data } = await supabase
      .from('held_orders')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    setHeldOrders((data as HeldOrder[]) ?? [])
  }, [])

  async function holdCart(tableName: string, customerName: string) {
    if (cart.length === 0) return
    await supabase.from('held_orders').insert({
      table_number:  tableName  || null,
      customer_name: customerName || null,
      cart_items:    cart,
      total_lak:     finalTotal,
      expires_at:    new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    })
    setCart([])
    setDiscountPreset('')
    setDiscountOtherAmt('')
    setDiscountOtherReason('')
    setShowHoldModal(false)
    loadHeldOrders()
  }

  async function resumeHeld(held: HeldOrder) {
    setCart(held.cart_items)
    await supabase.from('held_orders').delete().eq('id', held.id)
    loadHeldOrders()
  }

  async function deleteHeld(id: string) {
    await supabase.from('held_orders').delete().eq('id', id)
    loadHeldOrders()
  }

  useEffect(() => { fetchTodayQueue(); loadTodayOrders(); loadHeldOrders() }, [fetchTodayQueue, loadTodayOrders, loadHeldOrders])

  useEffect(() => {
    const ch = supabase
      .channel('pos-queue')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => { fetchTodayQueue(); loadTodayOrders() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => { fetchTodayQueue(); loadTodayOrders() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchTodayQueue, loadTodayOrders])

  async function updateQueueStatus(orderId: string, status: string) {
    await supabase.rpc('update_queue_status', { p_order_id: orderId, p_status: status })
    fetchTodayQueue()
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault()
        if (cart.length > 0 && !showCharge && !showReceiptPreview && !showOrderSuccess)
          setShowCharge(true)
        return
      }
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault()
        if (cart.length > 0 && !showHoldModal) setShowHoldModal(true)
        return
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        setShowHeldModal(true)
        return
      }
      if (e.key === 'Escape') {
        if (showShortcuts)        { setShowShortcuts(false);        return }
        if (showCustomerSelector) { setShowCustomerSelector(false); return }
        if (showCharge)           { setShowCharge(false);           return }
        if (showHeldModal)        { setShowHeldModal(false);        return }
        if (showHoldModal)        { setShowHoldModal(false);        return }
        if (showSettings)         { setShowSettings(false);         return }
        if (showDrawer)           { setShowDrawer(false);           return }
        return
      }
      if ((e.key === 'F1') || (e.key === '?' && !isInput)) {
        e.preventDefault()
        setShowShortcuts(v => !v)
        return
      }
      if (e.key === '/' && !isInput) {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      // Solo-operator shortcuts (no modifier, no input focus, no popup open)
      const noPopup = !showCharge && !showReceiptPreview && !showOrderSuccess
        && !showHeldModal && !showHoldModal && !showSettings && !showCustomerSelector
      if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey && noPopup) {
        // Space → open payment
        if (e.key === ' ' && cart.length > 0) {
          e.preventDefault()
          setShowCharge(true)
          return
        }
        // @ → open customer selector
        if (e.key === '@') {
          e.preventDefault()
          setShowCustomerSelector(true)
          return
        }
        // 1-9 → add Nth visible recipe to cart
        if (/^[1-9]$/.test(e.key)) {
          e.preventDefault()
          const idx = Number(e.key) - 1
          const recipe = displayRecipes[idx]
          if (recipe) {
            if (recipe.requires_customization === false) {
              addToCartWithCustomization(recipe, '')
            } else {
              setPendingRecipe(recipe)
            }
          }
          return
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.length, showCharge, showHeldModal, showHoldModal, showSettings, showDrawer, showShortcuts, showReceiptPreview, showOrderSuccess, showCustomerSelector, displayRecipes])

  const timeStr = now ? now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'
  const dateStr = now ? now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''

  const cartPayload = cart.map(item => ({
    recipe_id:      item.recipe.id,
    qty:            item.qty,
    unit_price_lak: item.recipe.price_lak,
    customization:  item.customization || null,
  }))

  const todayTotal  = todayOrders.filter(o => o.status === 'paid').reduce((s, o) => s + o.total_lak, 0)
  const todayCount  = todayOrders.filter(o => o.status === 'paid').length

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      backgroundColor: BLACK, color: '#fff',
      fontFamily: 'var(--font-body, Inter, sans-serif)', overflow: 'hidden',
    }}>

      {/* Popups */}
      {pendingRecipe && (
        <CustomPopup recipe={pendingRecipe}
          onConfirm={(customization, qty) => addToCartWithCustomization(pendingRecipe, customization, qty)}
          onClose={() => setPendingRecipe(null)} />
      )}

      {editingCartKey && (() => {
        const editItem = cart.find(i => i.cartKey === editingCartKey)
        if (!editItem) return null
        return (
          <CustomPopup recipe={editItem.recipe}
            initialCustomization={editItem.customization}
            initialQty={editItem.qty}
            onConfirm={(newCustomization, newQty) => { editCartItem(editingCartKey, newCustomization, newQty); setEditingCartKey(null) }}
            onClose={() => setEditingCartKey(null)} />
        )
      })()}

      {showCharge && (
        <ChargePopup subtotal={subtotal} cartPayload={cartPayload}
          discount={String(discountAmt)} discountReason={discountLabel}
          activeEmployeeId={activeEmployee?.id ?? null}
          selectedCustomer={selectedCustomer}
          isTestMode={testMode}
          defaultLang={lang}
          onSuccess={handleChargeSuccess} onClose={() => setShowCharge(false)} />
      )}

      {showSettings && <SettingsPopup onClose={() => setShowSettings(false)} />}
      {showCustomerSelector && (
        <CustomerSelector
          shopId={shopId}
          onSelect={c => { setSelectedCustomer(c); setShowCustomerSelector(false) }}
          onClose={() => setShowCustomerSelector(false)}
        />
      )}
      {showHoldModal && (
        <HoldModal onConfirm={(t, c) => holdCart(t, c)} onClose={() => setShowHoldModal(false)} />
      )}
      {showHeldModal && (
        <HeldOrdersModal
          heldOrders={heldOrders}
          onResume={resumeHeld}
          onDelete={deleteHeld}
          onClose={() => setShowHeldModal(false)}
        />
      )}
      <OrdersDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        queueEntries={queueEntries}
        todayOrders={todayOrders}
        todayTotal={todayTotal}
        todayCount={todayCount}
        onUpdateQueue={updateQueueStatus}
        onVoided={() => { fetchTodayQueue(); loadTodayOrders() }}
      />
      {showShiftClose && <ShiftClosePopup todayTotal={todayTotal} todayCount={todayCount} onClose={() => setShowShiftClose(false)} />}
      {showShortcuts && <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />}

      {/* ── Receipt preview (after payment, before celebration) ── */}
      {showReceiptPreview && (
        <ReceiptPreview
          receiptText={previewReceiptText}
          onPrint={async () => { if (printFnRef.current) await printFnRef.current() }}
          onSkip={() => { setShowReceiptPreview(false); setShowOrderSuccess(true) }}
          onOpenSettings={() => { setShowReceiptPreview(false); setShowOrderSuccess(false); setShowSettings(true) }}
          autoSkipSecs={5}
        />
      )}

      {/* ── Order success celebration ── */}
      {showOrderSuccess && successData && (
        <OrderSuccess
          queue={successData.queue}
          total={successData.finalTotal}
          onDismiss={dismissOrderSuccess}
        />
      )}

      {/* ── PIN PAD OVERLAY — shown when no employee is clocked in */}
      {mounted && employeeReady && !activeEmployee && shopId && (
        <PinPad shopId={shopId} onClockIn={clockIn} />
      )}

      {/* ── TOP BAR */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 56,
        backgroundColor: '#111', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.5px' }}>ALAN</span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: GOLD }} />
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase' }}>Cafe OS</span>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{dateStr}</span>
          <span style={{ color: GOLD, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SyncStatus />
          <button onClick={() => setShowHeldModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 14px', height: 36, borderRadius: 8,
            border: `1px solid ${heldOrders.length > 0 ? GOLD + '55' : 'rgba(255,255,255,0.1)'}`,
            backgroundColor: heldOrders.length > 0 ? `${GOLD}15` : 'rgba(255,255,255,0.04)',
            color: heldOrders.length > 0 ? GOLD : 'rgba(255,255,255,0.35)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            📋 พัก
            {heldOrders.length > 0 && (
              <span style={{ backgroundColor: GOLD, color: BLACK, borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>
                {heldOrders.length}
              </span>
            )}
          </button>
          <button onClick={() => setShowDrawer(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 14px', height: 36, borderRadius: 8,
            border: `1px solid ${queueEntries.length > 0 ? GOLD + '44' : 'rgba(255,255,255,0.1)'}`,
            backgroundColor: 'rgba(255,255,255,0.04)',
            color: queueEntries.length > 0 ? GOLD : 'rgba(255,255,255,0.4)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            คิว & ออเดอร์
            {(queueEntries.length > 0 || todayCount > 0) && (
              <span style={{ backgroundColor: `${GOLD}22`, color: GOLD, borderRadius: 999, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>
                {queueEntries.length > 0 ? queueEntries.length : todayCount}
              </span>
            )}
          </button>
          {activeEmployee && (
            <ActiveEmployeeBadge employee={activeEmployee} onClockOut={clockOut} />
          )}
          <button onClick={() => setShowShiftClose(true)} style={{
            padding: '0 14px', height: 36, borderRadius: 8, border: `1px solid ${GOLD}44`,
            backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>ปิดกะ</button>
          <button
            onClick={toggleTestMode}
            title={testMode ? 'ปิดโหมดทดสอบ' : 'เปิดโหมดทดสอบ'}
            style={{
              padding: '0 12px', height: 36, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: testMode ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.1)',
              backgroundColor: testMode ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
              color: testMode ? '#f59e0b' : 'rgba(255,255,255,0.35)',
            }}
          >🧪 TEST</button>
          <LanguageSwitcher />
          {pwaPrompt && (
            <button
              onClick={async () => {
                await pwaPrompt.prompt()
                const { outcome } = await pwaPrompt.userChoice
                if (outcome === 'accepted') setPwaPrompt(null)
              }}
              title="Install as app — pin to taskbar and start faster"
              style={{
                padding: '0 12px', height: 36, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${GOLD}44`,
                backgroundColor: `${GOLD}10`, color: GOLD,
              }}
            >📌 Install App</button>
          )}
          <button onClick={() => setShowSettings(true)} style={{
            width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
            fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>⚙️</button>
        </div>
      </header>

      {/* ── TEST MODE BANNER */}
      {testMode && <TestModeBanner onDisable={disableTestMode} />}

      {/* ── HTTPS WARNING BANNER (print server blocked by mixed-content) */}
      <HttpBanner />

      {/* ── PRINT LANGUAGE FALLBACK TOAST */}
      {printFallbackLang && (
        <PrintFallbackToast
          lang={printFallbackLang}
          onDismiss={() => setPrintFallbackLang(null)}
          onDismissAlways={() => { dismissFallbackWarning(); setPrintFallbackLang(null) }}
        />
      )}

      {/* ── MAIN SPLIT 60/40 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT 60%: MENU */}
        <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>

          {/* Search */}
          <div style={{ padding: '10px 16px', backgroundColor: '#111', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }}>🔍</span>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเมนู... (กด /)"
              aria-label="ค้นหาเมนู"
              style={{
                width: '100%', padding: '9px 36px', borderRadius: 10,
                border: `1px solid ${searchQuery ? GOLD + '44' : 'rgba(255,255,255,0.08)'}`,
                backgroundColor: 'rgba(255,255,255,0.04)', color: '#fff',
                fontSize: 14, outline: 'none', boxSizing: 'border-box' as const,
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{
                position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
                fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0,
              }}>×</button>
            )}
          </div>

          {/* L1 pills */}
          <div style={{
            display: 'flex', gap: 8, padding: '10px 16px', backgroundColor: '#111',
            borderBottom: l2Categories.length > 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0, overflowX: 'auto',
          }}>
            <button onClick={() => selectL1('All')} style={{
              padding: '0 18px', height: 44, borderRadius: 999, border: 'none', flexShrink: 0,
              backgroundColor: activeL1 === 'All' ? GOLD : 'rgba(255,255,255,0.07)',
              color: activeL1 === 'All' ? BLACK : 'rgba(255,255,255,0.5)',
              fontWeight: activeL1 === 'All' ? 700 : 500, fontSize: 13, cursor: 'pointer',
            }}>All</button>
            {l1Categories.map(cat => (
              <button key={cat.id} onClick={() => selectL1(cat.id)} style={{
                padding: '0 18px', height: 44, borderRadius: 999, border: 'none', flexShrink: 0,
                backgroundColor: activeL1 === cat.id ? GOLD : 'rgba(255,255,255,0.07)',
                color: activeL1 === cat.id ? BLACK : 'rgba(255,255,255,0.5)',
                fontWeight: activeL1 === cat.id ? 700 : 500, fontSize: 13, cursor: 'pointer',
              }}>{cat.name}</button>
            ))}
          </div>

          {/* L2 pills */}
          {l2Categories.length > 0 && (
            <div style={{
              display: 'flex', gap: 6, padding: '6px 16px 8px', backgroundColor: '#111',
              borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, overflowX: 'auto',
            }}>
              {l2Categories.map(cat => (
                <button key={cat.id} onClick={() => setActiveL2(activeL2 === cat.id ? null : cat.id)} style={{
                  padding: '0 14px', height: 36, borderRadius: 999, flexShrink: 0,
                  border: `1px solid ${activeL2 === cat.id ? GOLD : 'rgba(255,255,255,0.12)'}`,
                  backgroundColor: activeL2 === cat.id ? `${GOLD}22` : 'transparent',
                  color: activeL2 === cat.id ? GOLD : 'rgba(255,255,255,0.45)',
                  fontWeight: activeL2 === cat.id ? 700 : 500, fontSize: 12, cursor: 'pointer',
                }}>{cat.name}</button>
              ))}
            </div>
          )}

          {/* Recipe grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 108, borderRadius: 8 }} />)}
              </div>
            ) : displayRecipes.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 80, color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
                {searchQuery ? `ไม่พบ "${searchQuery}"` : 'No items in this category'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {displayRecipes.map((recipe, idx) => (
                  <MenuCard
                    key={recipe.id}
                    recipe={recipe}
                    lang={lang}
                    pinned={pinnedIds.includes(recipe.id)}
                    shortcutKey={idx < 9 ? idx + 1 : null}
                    onPin={() => {
                      const next = togglePinnedRecipe(recipe.id)
                      setPinnedIds(next)
                    }}
                    onAdd={() => {
                      if (recipe.requires_customization === false) {
                        addToCartWithCustomization(recipe, '')
                      } else {
                        setPendingRecipe(recipe)
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: CART + PAYMENT (40% tablet, 50% desktop) */}
        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', backgroundColor: '#111' }}>

          {/* Cart header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>ออเดอร์</span>
              {mounted && totalItems > 0 && (
                <span style={{
                  backgroundColor: `${GOLD}22`, color: GOLD,
                  borderRadius: 999, padding: '1px 9px', fontSize: 12, fontWeight: 800,
                }}>{totalItems}</span>
              )}
            </div>
            {mounted && cart.length > 0 && !showOrderSuccess && !showReceiptPreview && (
              confirmClear ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>ล้างทั้งหมด?</span>
                  <button onClick={() => { setCart([]); setConfirmClear(false) }}
                    style={{ padding: '2px 8px', borderRadius: 4, border: 'none', backgroundColor: RED, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>ยืนยัน</button>
                  <button onClick={() => setConfirmClear(false)}
                    style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer' }}>ยกเลิก</button>
                </div>
              ) : (
                <button onClick={() => setConfirmClear(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 11, cursor: 'pointer' }}>ล้าง</button>
              )
            )}
          </div>

          {/* Customer selector */}
          <div style={{ padding: '0 12px 8px' }}>
            {selectedCustomer ? (
              <SelectedCustomerChip
                customer={selectedCustomer}
                onRemove={() => setSelectedCustomer(null)}
                onClick={() => setShowCustomerSelector(true)}
              />
            ) : (
              <button
                onClick={() => setShowCustomerSelector(true)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 10,
                  border: '1px dashed rgba(255,255,255,0.15)',
                  backgroundColor: 'transparent', color: 'rgba(255,255,255,0.35)',
                  fontSize: 12, cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'; e.currentTarget.style.color = '#c9a84c' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
              >
                👤 เลือกลูกค้า
              </button>
            )}
          </div>

          {/* Cart items — card-based design */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!mounted || cart.length === 0 ? (
              <EmptyCartState />
            ) : (
              cart.map(item => (
                <CartItemCard
                  key={item.cartKey}
                  item={item}
                  onDecrement={() => decrement(item.cartKey)}
                  onIncrement={() => addToCartWithCustomization(item.recipe, item.customization)}
                  onEdit={() => setEditingCartKey(item.cartKey)}
                  onDelete={() => setCart(prev => prev.filter(i => i.cartKey !== item.cartKey))}
                />
              ))
            )}
          </div>

          {/* Cart footer */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase' }}>รวม</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: mounted && discountAmt > 0 ? 'rgba(255,255,255,0.3)' : '#fff', fontVariantNumeric: 'tabular-nums', textDecoration: mounted && discountAmt > 0 ? 'line-through' : 'none' }}>
                {mounted ? fmtLak(subtotal) : '0 LAK'}
              </span>
            </div>
            {/* Discount preset pills */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>ส่วนลด</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DISCOUNT_PRESETS.map(p => (
                  <button key={p.key} onClick={() => setDiscountPreset(discountPreset === p.key ? '' : p.key as DiscountKey)} style={{
                    padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${discountPreset === p.key ? GOLD : 'rgba(255,255,255,0.12)'}`,
                    backgroundColor: discountPreset === p.key ? `${GOLD}22` : 'transparent',
                    color: discountPreset === p.key ? GOLD : 'rgba(255,255,255,0.4)',
                  }}>
                    {p.label}{p.pct > 0 ? ` ${p.pct}%` : ''}
                  </button>
                ))}
              </div>
              {discountPreset === 'other' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <MoneyInput value={discountOtherAmt} onChange={v => setDiscountOtherAmt(v)}
                    style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: `1px solid ${GOLD}44`, backgroundColor: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }}
                    placeholder="จำนวนเงิน" />
                  <input value={discountOtherReason} onChange={e => setDiscountOtherReason(e.target.value)}
                    style={{ flex: 2, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: 12, outline: 'none', boxSizing: 'border-box' as const }}
                    placeholder="เหตุผล..." />
                </div>
              )}
            </div>
            {mounted && discountAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: GOLD, letterSpacing: '1px', textTransform: 'uppercase' }}>ยอดสุทธิ</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{fmtLak(finalTotal)}</span>
              </div>
            )}
            {mounted && cart.length > 0 && (() => {
              const sec = formatSecondary(finalTotal)
              return sec ? (
                <div style={{ textAlign: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.5px' }}>{sec}</span>
                </div>
              ) : null
            })()}
            <button
              onClick={() => mounted && cart.length > 0 && setShowHoldModal(true)}
              disabled={!mounted || cart.length === 0}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 10, marginBottom: 8,
                border: `1px solid ${mounted && cart.length > 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}`,
                backgroundColor: 'transparent',
                color: mounted && cart.length > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)',
                fontWeight: 600, fontSize: 14, cursor: mounted && cart.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >📋 พักออเดอร์</button>
            <button
              onClick={() => mounted && cart.length > 0 && setShowCharge(true)}
              disabled={!mounted || cart.length === 0}
              style={{
                width: '100%', height: 56, borderRadius: 12, border: 'none',
                backgroundColor: mounted && cart.length > 0 ? GOLD : 'rgba(255,255,255,0.06)',
                color: mounted && cart.length > 0 ? BLACK : 'rgba(255,255,255,0.18)',
                fontWeight: 800, fontSize: 16, letterSpacing: '0.5px',
                cursor: mounted && cart.length > 0 ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-heading)', transition: 'all 0.2s',
                boxShadow: mounted && cart.length > 0 ? `0 0 24px ${GOLD}40` : 'none',
              }}
            >
              {mounted && cart.length > 0 ? `ชำระเงิน ${fmtLak(finalTotal)}` : 'ยังไม่มีรายการ'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Keyboard shortcuts help button ── */}
      <button
        onClick={() => setShowShortcuts(true)}
        title="Keyboard shortcuts (F1)"
        aria-label="Keyboard shortcuts"
        style={{
          position: 'fixed', bottom: 16, left: 16, zIndex: 100,
          width: 36, height: 36, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.1)',
          backgroundColor: 'rgba(255,255,255,0.04)',
          color: 'rgba(255,255,255,0.3)', fontSize: 16, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s', fontFamily: 'monospace',
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(201,168,76,0.12)'; e.currentTarget.style.color = GOLD; e.currentTarget.style.borderColor = `rgba(201,168,76,0.3)` }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
      >?</button>
    </div>
  )
}

// ─── Menu Card ────────────────────────────────────────────────────────────────

function MenuCard({ recipe, lang, pinned, shortcutKey, onAdd, onPin }: {
  recipe: Recipe; lang: Lang; pinned?: boolean; shortcutKey?: number | null
  onAdd: () => void; onPin?: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const displayName = getMenuName(recipe, lang)
  const altName = lang !== 'en' ? recipe.product_name : (recipe.product_name_lo ?? null)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={onAdd} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
        backgroundColor: hovered ? '#1e1b13' : (pinned ? '#1b1800' : '#1a1a1a'),
        border: `1px solid ${hovered ? GOLD : pinned ? `${GOLD}55` : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 8, padding: recipe.image_url ? '0' : '14px 12px', textAlign: 'left',
        cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 0,
        transition: 'all 0.15s', width: '100%', overflow: 'hidden',
      }}>
        {recipe.image_url && (
          <div style={{ width: '100%', height: 80, overflow: 'hidden', flexShrink: 0 }}>
            <img src={recipe.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {recipe.category && (
            <span style={{ fontSize: 10, color: GOLD, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>{recipe.category}</span>
          )}
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.3, fontFamily: 'var(--font-heading)' }}>{displayName}</span>
          {altName && altName !== displayName && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.2 }}>{altName}</span>
          )}
          <span style={{ fontSize: 15, fontWeight: 800, color: GOLD, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {recipe.price_lak.toLocaleString('en-US')}
            <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 3, opacity: 0.75 }}>LAK</span>
          </span>
        </div>
      </button>

      {/* Keyboard shortcut badge */}
      {shortcutKey && (
        <span style={{
          position: 'absolute', top: 5, left: 5,
          backgroundColor: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.5)',
          fontSize: 9, fontWeight: 700, fontFamily: 'monospace',
          padding: '1px 5px', borderRadius: 4, pointerEvents: 'none',
          border: '1px solid rgba(255,255,255,0.12)',
        }}>{shortcutKey}</span>
      )}

      {/* Pin toggle */}
      {onPin && (
        <button
          onClick={e => { e.stopPropagation(); onPin() }}
          title={pinned ? 'Unpin' : 'Pin to top'}
          style={{
            position: 'absolute', top: 4, right: 4,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, lineHeight: 1, padding: 3,
            opacity: pinned ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = pinned ? '1' : '0')}
          className="menu-pin-btn"
        >
          {pinned ? '⭐' : '☆'}
        </button>
      )}
    </div>
  )
}

// ─── Print Language Fallback Toast ────────────────────────────────────────────

const FALLBACK_MSG: Record<'lo' | 'th', string> = {
  lo: 'เครื่องพิมพ์ไม่รองรับภาษาลาว — พิมพ์เป็นอังกฤษแทน',
  th: 'เครื่องพิมพ์ไม่รองรับภาษาไทย (ต้องใช้ PC874) — พิมพ์เป็นอังกฤษแทน',
}

function PrintFallbackToast({ lang, onDismiss, onDismissAlways }: {
  lang: 'lo' | 'th'
  onDismiss: () => void
  onDismissAlways: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      zIndex: 400, display: 'flex', alignItems: 'center', gap: 12,
      backgroundColor: '#1e1a10', border: '1px solid rgba(245,158,11,0.45)',
      borderRadius: 12, padding: '12px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      maxWidth: 520, width: 'calc(100vw - 40px)',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>🖨️</span>
      <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
        {FALLBACK_MSG[lang]}
      </span>
      <button
        onClick={onDismissAlways}
        title="ไม่ต้องแสดงคำเตือนนี้อีก"
        style={{
          padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
          backgroundColor: 'transparent', color: 'rgba(255,255,255,0.35)',
          fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        ไม่ต้องแสดงอีก
      </button>
      <button
        onClick={onDismiss}
        style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)',
          fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 2px', flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}
