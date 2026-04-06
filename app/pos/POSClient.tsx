'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { MoneyInput } from '@/components/MoneyInput'

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
  received: number
  cartSnapshot: CartItem[]
  subtotal: number
  finalTotal: number
}

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

type PaymentMethod = 'cash' | 'qr' | 'transfer'

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
  { value: 'cash',     label: 'เงินสด',  icon: '💵' },
  { value: 'qr',       label: 'QR Code', icon: '📱' },
  { value: 'transfer', label: 'โอนเงิน', icon: '🏦' },
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

const QUICK_AMTS = [10000, 20000, 50000, 100000, 200000]
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

// ─── CustomPopup ─────────────────────────────────────────────────────────────

const SWEETNESS_OPTIONS = ['หวานปกติ', 'หวานน้อย', 'ไม่หวาน']
const TEMP_OPTIONS      = ['ร้อน', 'เย็น', 'อุ่น']

function CustomPopup({ recipe, onConfirm, onClose, initialCustomization }: {
  recipe: Recipe
  onConfirm: (customization: string) => void
  onClose: () => void
  initialCustomization?: string
}) {
  const initParts = initialCustomization?.split(' · ') ?? []
  const [sweetness, setSweetness] = useState(() => SWEETNESS_OPTIONS.find(s => initParts.includes(s)) ?? sweetnessFromDefault(recipe.default_sweetness))
  const [temp, setTemp]           = useState(() => TEMP_OPTIONS.find(t => initParts.includes(t)) ?? 'ร้อน')
  const [note, setNote]           = useState(() => initParts.filter(p => !SWEETNESS_OPTIONS.includes(p) && !TEMP_OPTIONS.includes(p)).join(' · '))
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
    <div ref={overlayRef} onClick={handleOverlayClick} style={{
      position: 'fixed', inset: 0, zIndex: 100,
      backgroundColor: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        backgroundColor: '#1a1a1a', border: `1px solid ${GOLD}44`,
        borderRadius: 12, padding: 28, width: 340,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{recipe.product_name}</div>
            {recipe.product_name_lo && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{recipe.product_name_lo}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px', marginLeft: 12, flexShrink: 0 }}>×</button>
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>ความหวาน</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {SWEETNESS_OPTIONS.map(opt => (
              <button key={opt} onClick={() => setSweetness(opt)} style={{
                flex: 1, padding: '7px 4px', borderRadius: 6, border: 'none',
                backgroundColor: sweetness === opt ? GOLD : 'rgba(255,255,255,0.07)',
                color: sweetness === opt ? BLACK : 'rgba(255,255,255,0.55)',
                fontWeight: sweetness === opt ? 700 : 500, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              }}>{opt}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>อุณหภูมิ</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {TEMP_OPTIONS.map(opt => (
              <button key={opt} onClick={() => setTemp(opt)} style={{
                flex: 1, padding: '7px 4px', borderRadius: 6, border: 'none',
                backgroundColor: temp === opt ? GOLD : 'rgba(255,255,255,0.07)',
                color: temp === opt ? BLACK : 'rgba(255,255,255,0.55)',
                fontWeight: temp === opt ? 700 : 500, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              }}>{opt}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>หมายเหตุ</div>
          <input type="text" placeholder="เช่น ไม่ใส่น้ำแข็ง, extra shot..." value={note}
            onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
            style={popupInput} />
        </div>

        <button onClick={handleConfirm} style={{
          width: '100%', padding: '13px 0', borderRadius: 6, border: 'none',
          backgroundColor: GOLD, color: BLACK, fontWeight: 800, fontSize: 14,
          letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer',
          fontFamily: 'var(--font-heading)',
        }}>
          Confirm
        </button>
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

  function handlePrint() { window.print() }

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
            <button onClick={handlePrint} style={{
              padding: '5px 14px', borderRadius: 6,
              border: `1px solid ${GOLD}55`, backgroundColor: `${GOLD}14`,
              color: GOLD, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              🖨️ พิมพ์
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

function ChargePopup({ subtotal, cartPayload, discount, discountReason, onSuccess, onClose }: {
  subtotal: number
  cartPayload: { recipe_id: string; qty: number; unit_price_lak: number; customization: string | null }[]
  discount: string
  discountReason: string
  onSuccess: (queueNum: number, receipt: string, change: number, method: PaymentMethod, customer: string, table: string, discountAmt: number, received: number) => void
  onClose: () => void
}) {
  const isSmall = useIsSmall()
  const [method,         setMethod]         = useState<PaymentMethod>('cash')
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
  const overlayRef = useRef<HTMLDivElement>(null)

  const discountAmt = parseFloat(discount) || 0
  const finalTotal  = Math.max(subtotal - discountAmt, 0)
  const receivedNum = received ? (parseInt(received, 10) || 0) : 0
  const changeAmt   = method === 'cash' ? receivedNum - finalTotal : 0
  const cashOk =
    (method === 'cash' && received !== '' && receivedNum >= finalTotal) ||
    (method === 'qr') ||
    (method === 'transfer' && selectedBank !== null)

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

    // Link order to customer record if phone is provided
    let customerId: string | null = null
    if (customer.trim() && phone.trim()) {
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
    const { data: receipt, error: err2 } = await supabase.rpc('finalize_order_payment', {
      p_order_id:        result.order_id,
      p_payment_method:  method,
      p_amount_received: method === 'cash' ? receivedNum : null,
      p_change_amount:   method === 'cash' ? Math.max(changeAmt, 0) : null,
      p_table_number:    table    || null,
      p_customer_name:   customer || null,
      p_discount_amount: discountAmt,
      p_discount_reason: discountReason || null,
      p_staff_note:      staffNote || null,
    })

    const finalReceipt = err2 ? '—' : ((receipt as string) ?? '—')
    onSuccess(result.queue_number, finalReceipt, Math.max(changeAmt, 0), method, customer, table, discountAmt, method === 'cash' ? receivedNum : 0)
    setLoading(false)
  }

  const boxStyle: React.CSSProperties = isSmall
    ? { position: 'fixed', inset: 0, borderRadius: 0, backgroundColor: '#181818', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
    : { backgroundColor: '#181818', border: `1px solid ${GOLD}44`, borderRadius: 16, width: 440, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }

  const btnBg = loading ? `${GOLD}55`
    : method === 'cash' && received !== '' && receivedNum < finalTotal ? `${RED}22`
    : method === 'cash' && received === '' ? 'rgba(255,255,255,0.06)'
    : method === 'transfer' && !selectedBank ? 'rgba(255,255,255,0.06)'
    : GOLD
  const btnColor = method === 'cash' && received !== '' && receivedNum < finalTotal ? RED
    : method === 'cash' && received === '' ? 'rgba(255,255,255,0.2)'
    : method === 'transfer' && !selectedBank ? 'rgba(255,255,255,0.2)'
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
              : `ยืนยันชำระ ${fmtLak(finalTotal)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SettingsPopup ────────────────────────────────────────────────────────────

function SettingsPopup({ onClose }: { onClose: () => void }) {
  const [printerIp,   setPrinterIp]   = useState(() => typeof window !== 'undefined' ? localStorage.getItem('pos_printer_ip')   ?? '' : '')
  const [printerPort, setPrinterPort] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('pos_printer_port') ?? '9100' : '9100')
  const [currency,    setCurrency]    = useState(() => typeof window !== 'undefined' ? localStorage.getItem('pos_currency')     ?? 'LAK' : 'LAK')
  const [testDone,    setTestDone]    = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  function save() {
    try {
      localStorage.setItem('pos_printer_ip',   printerIp)
      localStorage.setItem('pos_printer_port', printerPort)
      localStorage.setItem('pos_currency',     currency)
    } catch { /* ignore */ }
    onClose()
  }

  function testPrint() {
    setTestDone(true)
    setTimeout(() => setTestDone(false), 2500)
  }

  return (
    <div ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose() }} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      backgroundColor: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        backgroundColor: '#181818', border: `1px solid ${GOLD}44`,
        borderRadius: 14, padding: '28px', width: 380,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>⚙️ POS Settings</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {/* Printer */}
        <div>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>เครื่องพิมพ์ใบเสร็จ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>IP Address</div>
              <input value={printerIp} onChange={e => setPrinterIp(e.target.value)} style={{ ...popupInput, fontFamily: 'monospace' }} placeholder="192.168.1.100" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>Port</div>
              <input value={printerPort} onChange={e => setPrinterPort(e.target.value)} style={{ ...popupInput, fontFamily: 'monospace' }} />
            </div>
          </div>
          <button onClick={testPrint} style={{
            padding: '7px 16px', borderRadius: 6, border: `1px solid ${GOLD}44`,
            backgroundColor: 'transparent', color: testDone ? GREEN : GOLD,
            fontSize: 12, cursor: 'pointer',
          }}>
            {testDone ? '✓ ส่งสัญญาณแล้ว' : '🖨️ ทดสอบพิมพ์'}
          </button>
        </div>

        {/* Currency */}
        <div>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>สกุลเงินที่แสดง</div>
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

        {/* Quick links */}
        <div>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>ลิงก์ด่วน</div>
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

        <button onClick={save} style={{
          width: '100%', padding: '12px 0', borderRadius: 8, border: 'none',
          backgroundColor: GOLD, color: BLACK, fontWeight: 800, fontSize: 14,
          cursor: 'pointer', fontFamily: 'var(--font-heading)',
        }}>
          บันทึก
        </button>
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
  const [mounted,      setMounted]      = useState(false)
  const [recipes,      setRecipes]      = useState<Recipe[]>([])
  const [categories,   setCategories]   = useState<Category[]>([])
  const [loading,      setLoading]      = useState(true)
  const [cart,         setCart]         = useState<CartItem[]>([])
  const [confirmClear,  setConfirmClear]  = useState(false)
  const [activeL1,     setActiveL1]     = useState<string>('All')
  const [activeL2,     setActiveL2]     = useState<string | null>(null)
  const [now,          setNow]          = useState(new Date())
  const [chargeStatus, setChargeStatus] = useState<ChargeStatus>('idle')
  const [successData,  setSuccessData]  = useState<SuccessData | null>(null)
  const [posSettings,  setPosSettings]  = useState<PosSettings>({ shop_name: '', vat_percent: 0, qr_payment_number: '', shop_line: '', shop_facebook: '' })
  const [pendingRecipe, setPendingRecipe] = useState<Recipe | null>(null)
  const [editingCartKey, setEditingCartKey] = useState<string | null>(null)
  const [discount,       setDiscount]       = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [searchQuery,    setSearchQuery]    = useState('')
  const [queueEntries,  setQueueEntries] = useState<QueueEntry[]>([])
  const [todayOrders,   setTodayOrders]  = useState<TodayOrder[]>([])
  const [showCharge,     setShowCharge]    = useState(false)
  const [showSettings,   setShowSettings]  = useState(false)
  const [showShiftClose, setShowShiftClose] = useState(false)
  const [heldOrders,     setHeldOrders]    = useState<HeldOrder[]>([])
  const [showHoldModal,  setShowHoldModal]  = useState(false)

  // Load cart from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
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

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Fetch categories
  useEffect(() => {
    supabase.from('categories').select('id, name, name_lo, parent_id, sort_order')
      .eq('is_active', true).order('sort_order')
      .then(({ data }) => setCategories((data as Category[]) ?? []))
  }, [])

  // Fetch menu
  useEffect(() => {
    supabase.from('recipes').select('id, product_name, product_name_lo, category, category_id, price_lak, image_url, requires_customization, default_sweetness')
      .eq('is_active', true).order('category')
      .then(({ data }) => { setRecipes((data as Recipe[]) ?? []); setLoading(false) })

    const channel = supabase.channel('recipes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes' }, () => {
        supabase.from('recipes')
          .select('id, product_name, product_name_lo, category, category_id, price_lak, image_url, requires_customization, default_sweetness')
          .eq('is_active', true)
          .order('category')
          .then(({ data }) => {
            if (data) setRecipes(data.map(r => ({
              id: r.id as string,
              product_name: r.product_name as string,
              product_name_lo: r.product_name_lo as string | null,
              category: r.category as string | null,
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
    if (!searchQuery.trim()) return filtered
    const q = searchQuery.trim().toLowerCase()
    return filtered.filter(r =>
      r.product_name.toLowerCase().includes(q) ||
      (r.product_name_lo ?? '').toLowerCase().includes(q)
    )
  }, [filtered, searchQuery])

  const subtotal    = cart.reduce((s, i) => s + i.recipe.price_lak * i.qty, 0)
  const totalItems  = cart.reduce((s, i) => s + i.qty, 0)
  const discountAmt = parseInt(discount, 10) || 0
  const finalTotal  = Math.max(subtotal - discountAmt, 0)

  // Cart actions
  function editCartItem(oldKey: string, newCustomization: string) {
    setCart(prev => {
      const item = prev.find(i => i.cartKey === oldKey)
      if (!item) return prev
      const newKey = `${item.recipe.id}::${newCustomization}`
      if (newKey === oldKey) return prev
      const existing = prev.find(i => i.cartKey === newKey)
      if (existing) {
        return prev
          .filter(i => i.cartKey !== oldKey)
          .map(i => i.cartKey === newKey ? { ...i, qty: i.qty + item.qty } : i)
      }
      return prev.map(i => i.cartKey === oldKey ? { ...i, cartKey: newKey, customization: newCustomization } : i)
    })
  }

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

  function dismissSuccess() {
    setChargeStatus('idle')
    setSuccessData(null)
  }

  // Charge success handler (called from ChargePopup)
  function handleChargeSuccess(
    queueNum: number, receipt: string, change: number, method: PaymentMethod,
    customer: string, table: string, discAmt: number, received: number,
  ) {
    const cartSnapshot = [...cart]
    setSuccessData({
      queue: queueNum, receipt, change, method,
      customer, table,
      discountAmt: discAmt,
      received,
      cartSnapshot,
      subtotal,
      finalTotal,
    })
    setCart([])
    setDiscount('')
    setDiscountReason('')
    try { localStorage.removeItem('pos_cart') } catch { /* ignore */ }
    setChargeStatus('success')
    setShowCharge(false)
    loadTodayOrders()
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
    const { data } = await supabase.rpc('get_today_orders')
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
    setDiscount('')
    setDiscountReason('')
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

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

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
          onConfirm={customization => addToCartWithCustomization(pendingRecipe, customization)}
          onClose={() => setPendingRecipe(null)} />
      )}

      {editingCartKey && (() => {
        const editItem = cart.find(i => i.cartKey === editingCartKey)
        if (!editItem) return null
        return (
          <CustomPopup recipe={editItem.recipe}
            initialCustomization={editItem.customization}
            onConfirm={newCustomization => { editCartItem(editingCartKey, newCustomization); setEditingCartKey(null) }}
            onClose={() => setEditingCartKey(null)} />
        )
      })()}

      {showCharge && (
        <ChargePopup subtotal={subtotal} cartPayload={cartPayload}
          discount={discount} discountReason={discountReason}
          onSuccess={handleChargeSuccess} onClose={() => setShowCharge(false)} />
      )}

      {showSettings && <SettingsPopup onClose={() => setShowSettings(false)} />}
      {showHoldModal && (
        <HoldModal
          onConfirm={(t, c) => holdCart(t, c)}
          onClose={() => setShowHoldModal(false)}
        />
      )}
      {showShiftClose && <ShiftClosePopup todayTotal={todayTotal} todayCount={todayCount} onClose={() => setShowShiftClose(false)} />}
      {chargeStatus === 'success' && successData && (
        <DigitalReceiptPopup data={successData} settings={posSettings} onClose={dismissSuccess} />
      )}

      {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52,
        backgroundColor: '#111', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.5px' }}>ALAN</span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: GOLD }} />
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase' }}>Cafe OS · POS</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Today summary mini */}
          {todayCount > 0 && (
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              <span>{todayCount} ออเดอร์</span>
              <span style={{ color: GOLD }}>{fmtLak(todayTotal)}</span>
            </div>
          )}
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{dateStr}</span>
          <span style={{ color: GOLD, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
          <button onClick={() => setShowShiftClose(true)} style={{
            padding: '0 14px', height: 32, borderRadius: 8, border: `1px solid ${GOLD}44`,
            backgroundColor: `${GOLD}10`, color: GOLD,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>🔒 ปิดกะ</button>
          <button onClick={() => setShowSettings(true)} style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
            fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>⚙️</button>
        </div>
      </header>

      {/* ── MAIN SPLIT ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT: MENU ───────────────────────────────────────────────────── */}
        <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>

          {/* Search bar */}
          <div style={{ padding: '8px 14px', backgroundColor: '#111', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 26, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }}>🔍</span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเมนู..."
              style={{
                width: '100%', padding: '7px 32px 7px 32px', borderRadius: 8,
                border: `1px solid ${searchQuery ? GOLD + '44' : 'rgba(255,255,255,0.08)'}`,
                backgroundColor: 'rgba(255,255,255,0.04)', color: '#fff',
                fontSize: 13, outline: 'none', boxSizing: 'border-box' as const,
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{
                position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
                fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 0,
              }}>×</button>
            )}
          </div>

          {/* L1 filter */}
          <div style={{
            display: 'flex', gap: 6, padding: '10px 16px', backgroundColor: '#111',
            borderBottom: l2Categories.length > 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0, overflowX: 'auto',
          }}>
            <button onClick={() => selectL1('All')} style={{
              padding: '5px 15px', borderRadius: 999, border: 'none', flexShrink: 0,
              backgroundColor: activeL1 === 'All' ? GOLD : 'rgba(255,255,255,0.07)',
              color: activeL1 === 'All' ? BLACK : 'rgba(255,255,255,0.5)',
              fontWeight: activeL1 === 'All' ? 700 : 500, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>All</button>
            {l1Categories.map(cat => (
              <button key={cat.id} onClick={() => selectL1(cat.id)} style={{
                padding: '5px 15px', borderRadius: 999, border: 'none', flexShrink: 0,
                backgroundColor: activeL1 === cat.id ? GOLD : 'rgba(255,255,255,0.07)',
                color: activeL1 === cat.id ? BLACK : 'rgba(255,255,255,0.5)',
                fontWeight: activeL1 === cat.id ? 700 : 500, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>{cat.name}</button>
            ))}
          </div>

          {/* L2 filter */}
          {l2Categories.length > 0 && (
            <div style={{
              display: 'flex', gap: 6, padding: '6px 16px 8px', backgroundColor: '#111',
              borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, overflowX: 'auto',
            }}>
              {l2Categories.map(cat => (
                <button key={cat.id} onClick={() => setActiveL2(activeL2 === cat.id ? null : cat.id)} style={{
                  padding: '4px 13px', borderRadius: 999, flexShrink: 0,
                  border: `1px solid ${activeL2 === cat.id ? GOLD : 'rgba(255,255,255,0.12)'}`,
                  backgroundColor: activeL2 === cat.id ? `${GOLD}22` : 'transparent',
                  color: activeL2 === cat.id ? GOLD : 'rgba(255,255,255,0.45)',
                  fontWeight: activeL2 === cat.id ? 700 : 500, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>{cat.name}</button>
              ))}
            </div>
          )}

          {/* Recipe grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12 }}>
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 108, borderRadius: 8 }} />)}
              </div>
            ) : displayRecipes.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 80, color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
                {searchQuery ? `ไม่พบ "${searchQuery}"` : 'No items in this category'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12 }}>
                {displayRecipes.map(recipe => (
                  <MenuCard key={recipe.id} recipe={recipe} onAdd={() => {
                    if (recipe.requires_customization === false) {
                      addToCartWithCustomization(recipe, '')
                    } else {
                      setPendingRecipe(recipe)
                    }
                  }} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── MIDDLE: CART + HELD ORDERS ──────────────────────────────────── */}
        <div style={{ width: '30%', flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#111', borderRight: '1px solid rgba(255,255,255,0.08)' }}>

          {/* ── Section A: Cart ── */}

          {/* Cart header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
              🛒 ออเดอร์{mounted && totalItems > 0 && <span style={{ color: GOLD, marginLeft: 6 }}>({totalItems})</span>}
            </span>
            {mounted && cart.length > 0 && chargeStatus === 'idle' && (
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

          {/* Cart items */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {!mounted || cart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'rgba(255,255,255,0.15)' }}>
                <span style={{ fontSize: 32 }}>☕</span>
                <span style={{ fontSize: 12 }}>แตะเมนูเพื่อเพิ่ม</span>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.cartKey} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', backgroundColor: '#1a1a1a', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.recipe.product_name}
                    </div>
                    {item.customization && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                        {item.customization}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: GOLD, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                      {fmtLak(item.recipe.price_lak * item.qty)}
                    </div>
                  </div>
                  {/* +/- controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <QtyButton label="−" onClick={() => decrement(item.cartKey)} />
                    <span style={{ fontSize: 15, fontWeight: 700, minWidth: 22, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{item.qty}</span>
                    <QtyButton label="+" onClick={() => addToCartWithCustomization(item.recipe, item.customization)} />
                  </div>
                  {/* edit / remove */}
                  <button onClick={() => setEditingCartKey(item.cartKey)}
                    style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✏️</button>
                  <button onClick={() => setCart(prev => prev.filter(i => i.cartKey !== item.cartKey))}
                    style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(220,80,80,0.2)', backgroundColor: 'rgba(220,80,80,0.06)', color: '#e07070', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🗑️</button>
                </div>
              ))
            )}
          </div>

          {/* Cart footer */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            {/* Total row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase' }}>รวม</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: mounted && discountAmt > 0 ? 'rgba(255,255,255,0.3)' : '#fff', fontVariantNumeric: 'tabular-nums', textDecoration: mounted && discountAmt > 0 ? 'line-through' : 'none' }}>
                {mounted ? fmtLak(subtotal) : '0 LAK'}
              </span>
            </div>
            {/* Discount row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase', flexShrink: 0 }}>ส่วนลด</span>
              <MoneyInput value={discount} onChange={v => setDiscount(v)}
                style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: `1px solid ${discountAmt > 0 ? GOLD + '55' : 'rgba(255,255,255,0.1)'}`, backgroundColor: 'rgba(255,255,255,0.04)', color: discountAmt > 0 ? GOLD : '#fff', fontSize: 12, outline: 'none', boxSizing: 'border-box' as const }}
                placeholder="0" />
              <input value={discountReason} onChange={e => setDiscountReason(e.target.value)}
                style={{ flex: 2, padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: 11, outline: 'none', boxSizing: 'border-box' as const }}
                placeholder="เหตุผล..." />
            </div>
            {mounted && discountAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: GOLD, letterSpacing: '1px', textTransform: 'uppercase' }}>ยอดสุทธิ</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{fmtLak(finalTotal)}</span>
              </div>
            )}
            {/* พักออเดอร์ */}
            <button
              onClick={() => mounted && cart.length > 0 && setShowHoldModal(true)}
              disabled={!mounted || cart.length === 0}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 8, marginBottom: 6,
                border: `1px solid ${mounted && cart.length > 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}`,
                backgroundColor: 'transparent',
                color: mounted && cart.length > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)',
                fontWeight: 600, fontSize: 13, cursor: mounted && cart.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              📋 พักออเดอร์
            </button>
            {/* ชำระเงิน */}
            <button
              onClick={() => mounted && cart.length > 0 && setShowCharge(true)}
              disabled={!mounted || cart.length === 0}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 8, border: 'none',
                backgroundColor: mounted && cart.length > 0 ? GOLD : 'rgba(255,255,255,0.06)',
                color: mounted && cart.length > 0 ? BLACK : 'rgba(255,255,255,0.18)',
                fontWeight: 800, fontSize: 15, letterSpacing: '1px',
                cursor: mounted && cart.length > 0 ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-heading)', transition: 'all 0.2s',
              }}
            >
              {mounted && cart.length > 0 ? `ชำระเงิน ${fmtLak(finalTotal)}` : 'ยังไม่มีรายการ'}
            </button>
          </div>

          {/* ── Section B: Held Orders ── */}
          <div style={{ flexShrink: 0, borderTop: '2px solid rgba(255,255,255,0.07)', backgroundColor: '#0e0e0e', maxHeight: '38%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: heldOrders.length > 0 ? '#f0c040' : 'rgba(255,255,255,0.25)' }}>
                📋 ออเดอร์พัก
                {heldOrders.length > 0 && (
                  <span style={{ marginLeft: 6, backgroundColor: '#f0c04022', color: '#f0c040', padding: '1px 7px', borderRadius: 999, fontSize: 10 }}>{heldOrders.length}</span>
                )}
              </span>
              <button onClick={loadHeldOrders} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 12, cursor: 'pointer' }}>↻</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {heldOrders.length === 0 ? (
                <div style={{ padding: '10px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.13)', fontSize: 12 }}>ไม่มีออเดอร์พัก</div>
              ) : (
                heldOrders.map(held => {
                  const label = held.table_number
                    ? `โต๊ะ ${held.table_number}${held.customer_name ? ' · ' + held.customer_name : ''}`
                    : held.customer_name ?? '—'
                  const itemCount = held.cart_items.reduce((s, i) => s + i.qty, 0)
                  return (
                    <div key={held.id} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', backgroundColor: 'rgba(240,192,64,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                            {itemCount} รายการ · {fmtLak(held.total_lak)} · {fmtTimeAgo(held.created_at)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => resumeHeld(held)} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: `1px solid ${GOLD}44`, backgroundColor: `${GOLD}12`, color: GOLD, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          📂 เปิด
                        </button>
                        <button onClick={() => deleteHeld(held.id)} style={{ width: 36, height: 30, borderRadius: 6, border: '1px solid rgba(220,80,80,0.25)', backgroundColor: 'rgba(220,80,80,0.08)', color: '#e07070', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          🗑️
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: QUEUE + TODAY'S ORDERS ───────────────────────────────── */}
        <div style={{ width: '35%', flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#0e0e0e' }}>

          {/* ── Section A: Queue ── */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderBottom: '2px solid rgba(255,255,255,0.07)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: queueEntries.length > 0 ? GOLD : 'rgba(255,255,255,0.25)' }}>
                🔄 คิวปัจจุบัน
                {queueEntries.length > 0 && (
                  <span style={{ marginLeft: 6, backgroundColor: `${GOLD}22`, color: GOLD, padding: '1px 7px', borderRadius: 999, fontSize: 10 }}>{queueEntries.length}</span>
                )}
              </span>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {queueEntries.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.13)', fontSize: 12 }}>ยังไม่มีคิว</div>
              ) : (
                queueEntries.map(entry => {
                  const isMaking = entry.queue_status === 'making'
                  const statusColor = isMaking ? GOLD : 'rgba(255,255,255,0.4)'
                  return (
                    <div key={entry.order_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', backgroundColor: isMaking ? `${GOLD}08` : 'transparent' }}>
                      <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 46 }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 15, fontVariantNumeric: 'tabular-nums', color: statusColor }}>
                          {fmtQueue(entry.queue_number)}
                        </div>
                        <div style={{ fontSize: 9, color: isMaking ? `${GOLD}99` : 'rgba(255,255,255,0.2)', marginTop: 1 }}>
                          {isMaking ? 'กำลังทำ' : 'รอคิว'}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.summary || '—'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => updateQueueStatus(entry.order_id, 'making')} disabled={isMaking}
                          style={{ height: 34, padding: '0 10px', borderRadius: 7, border: 'none', backgroundColor: isMaking ? 'rgba(255,255,255,0.03)' : `${GOLD}20`, color: isMaking ? 'rgba(255,255,255,0.12)' : GOLD, fontSize: 12, fontWeight: 700, cursor: isMaking ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                          {isMaking ? 'กำลังทำ' : 'เริ่มทำ'}
                        </button>
                        <button onClick={() => updateQueueStatus(entry.order_id, 'ready')}
                          style={{ height: 34, padding: '0 10px', borderRadius: 7, border: 'none', backgroundColor: 'rgba(76,186,127,0.12)', color: GREEN, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          พร้อม ✓
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ── Section B: Today's Orders ── */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
                📊 ออเดอร์วันนี้
                {todayCount > 0 && <span style={{ marginLeft: 6, color: GREEN, fontSize: 12, fontWeight: 800 }}>{fmtLak(todayTotal)}</span>}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{todayCount} รายการ</span>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {todayOrders.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.13)', fontSize: 12 }}>ยังไม่มีออเดอร์วันนี้</div>
              ) : (
                todayOrders.map(order => {
                  const isVoid = order.status === 'void'
                  const payIcon = PAY_METHODS.find(m => m.value === order.payment_method)?.icon ?? '—'
                  const summary = order.items.slice(0, 2).map(i => `${i.qty}× ${i.name}`).join(', ') + (order.items.length > 2 ? ` +${order.items.length - 2}` : '')
                  return (
                    <div key={order.id} style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: isVoid ? 0.4 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 13, color: isVoid ? 'rgba(255,255,255,0.25)' : GOLD, minWidth: 38, fontVariantNumeric: 'tabular-nums' }}>
                          {fmtQueue(order.queue_number)}
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', minWidth: 36 }}>{fmtTime(order.created_at_vt)}</span>
                        <span style={{ flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.38)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isVoid ? 'rgba(255,255,255,0.2)' : '#fff', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {fmtLak(order.total_lak)}
                        </span>
                        <span title={order.payment_method ?? ''} style={{ fontSize: 13, flexShrink: 0 }}>{payIcon}</span>
                        {isVoid ? (
                          <span style={{ fontSize: 10, color: RED, flexShrink: 0, fontWeight: 700 }}>VOID</span>
                        ) : (
                          <VoidRow order={order} onVoided={() => { fetchTodayQueue(); loadTodayOrders() }} />
                        )}
                      </div>
                      {isVoid && order.void_reason && (
                        <div style={{ fontSize: 10, color: 'rgba(255,80,80,0.45)', marginTop: 2, paddingLeft: 44 }}>{order.void_reason}</div>
                      )}
                    </div>
                  )
                })
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
    <button onClick={onAdd} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      backgroundColor: hovered ? '#1e1b13' : '#1a1a1a',
      border: `1px solid ${hovered ? GOLD : 'rgba(255,255,255,0.08)'}`,
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
      <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.3, fontFamily: 'var(--font-heading)' }}>{recipe.product_name}</span>
      {recipe.product_name_lo && (
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.2 }}>{recipe.product_name_lo}</span>
      )}
      <span style={{ fontSize: 15, fontWeight: 800, color: GOLD, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        {recipe.price_lak.toLocaleString('en-US')}
        <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 3, opacity: 0.75 }}>LAK</span>
      </span>
      </div>
    </button>
  )
}
