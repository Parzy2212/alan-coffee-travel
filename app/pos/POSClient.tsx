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

function CustomPopup({ recipe, onConfirm, onClose }: {
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

// ─── ChargePopup ─────────────────────────────────────────────────────────────

function ChargePopup({ subtotal, cartPayload, onSuccess, onClose }: {
  subtotal: number
  cartPayload: { recipe_id: string; qty: number; unit_price_lak: number; customization: string | null }[]
  onSuccess: (queueNum: number, receipt: string, change: number, method: PaymentMethod) => void
  onClose: () => void
}) {
  const isSmall = useIsSmall()
  const [method,         setMethod]         = useState<PaymentMethod>('cash')
  const [received,       setReceived]       = useState('')
  const [selectedBank,   setSelectedBank]   = useState<string | null>(null)
  const [banks,          setBanks]          = useState<PaymentBank[]>([])
  const [banksLoaded,    setBanksLoaded]    = useState(false)
  const [showExtra,      setShowExtra]      = useState(false)
  const [customer,       setCustomer]       = useState('')
  const [table,          setTable]          = useState('')
  const [discount,       setDiscount]       = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [staffNote,      setStaffNote]      = useState('')
  const [loading,        setLoading]        = useState(false)
  const [errMsg,         setErrMsg]         = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  const discountAmt = parseFloat(discount) || 0
  const finalTotal  = Math.max(subtotal - discountAmt, 0)
  const receivedNum = received ? (parseInt(received, 10) || 0) : 0
  const changeAmt   = method === 'cash' ? receivedNum - finalTotal : 0
  const cashOk      = method !== 'cash' || (received !== '' && receivedNum >= finalTotal)

  // Load banks when transfer tab is first opened
  useEffect(() => {
    if (method !== 'transfer' || banksLoaded) return
    supabase.rpc('get_site_settings').then(({ data }) => {
      if (data?.payment_banks) {
        try { setBanks(JSON.parse(data.payment_banks)) } catch { setBanks([]) }
      }
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

    const { data, error } = await supabase.rpc('create_order_with_deduction', { p_cart: cartPayload })
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
    onSuccess(result.queue_number, finalReceipt, Math.max(changeAmt, 0), method)
    setLoading(false)
  }

  const boxStyle: React.CSSProperties = isSmall
    ? { position: 'fixed', inset: 0, borderRadius: 0, backgroundColor: '#181818', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
    : { backgroundColor: '#181818', border: `1px solid ${GOLD}44`, borderRadius: 16, width: 440, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }

  const btnBg = loading ? `${GOLD}55`
    : method === 'cash' && received !== '' && receivedNum < finalTotal ? `${RED}22`
    : method === 'cash' && received === '' ? 'rgba(255,255,255,0.06)'
    : GOLD
  const btnColor = method === 'cash' && received !== '' && receivedNum < finalTotal ? RED
    : method === 'cash' && received === '' ? 'rgba(255,255,255,0.2)' : BLACK

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
            <div style={{ padding: '28px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 56 }}>📱</div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>แสดง QR Code ให้ลูกค้าสแกน</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{fmtLak(finalTotal)}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>กดยืนยันเมื่อรับเงินแล้ว</div>
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
              {showExtra ? '▲ ซ่อน' : '⋯ เพิ่มเติม'} · ชื่อลูกค้า · โต๊ะ · ส่วนลด · หมายเหตุ
            </button>
            {showExtra && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>ชื่อลูกค้า</div>
                    <input value={customer} onChange={e => setCustomer(e.target.value)} style={popupInput} placeholder="(ไม่บังคับ)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>โต๊ะ</div>
                    <input value={table} onChange={e => setTable(e.target.value)} style={popupInput} placeholder="A1" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>ส่วนลด ₭</div>
                    <MoneyInput value={discount} onChange={v => setDiscount(v)} style={popupInput} placeholder="0" />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>เหตุผลส่วนลด</div>
                    <input value={discountReason} onChange={e => setDiscountReason(e.target.value)} style={popupInput} placeholder="VIP / โปรโมชัน..." />
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
  const [shift,       setShift]       = useState('morning')
  const [openingCash, setOpeningCash] = useState('')
  const [actualCash,  setActualCash]  = useState('')
  const [activeField, setActiveField] = useState<'opening' | 'actual'>('actual')
  const [saving,      setSaving]      = useState(false)
  const [done,        setDone]        = useState(false)
  const [errMsg,      setErrMsg]      = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

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
    setSaving(true); setErrMsg('')
    const { error } = await supabase.rpc('close_shift', {
      p_staff_id:     null,
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function POSClient() {
  const [recipes,      setRecipes]      = useState<Recipe[]>([])
  const [categories,   setCategories]   = useState<Category[]>([])
  const [loading,      setLoading]      = useState(true)
  const [cart,         setCart]         = useState<CartItem[]>([])
  const [activeL1,     setActiveL1]     = useState<string>('All')
  const [activeL2,     setActiveL2]     = useState<string | null>(null)
  const [now,          setNow]          = useState(new Date())
  const [chargeStatus, setChargeStatus] = useState<ChargeStatus>('idle')
  const [successData,  setSuccessData]  = useState<{ queue: number; receipt: string; change: number; method: PaymentMethod } | null>(null)
  const [pendingRecipe, setPendingRecipe] = useState<Recipe | null>(null)
  const [queueEntries,  setQueueEntries] = useState<QueueEntry[]>([])
  const [todayOrders,   setTodayOrders]  = useState<TodayOrder[]>([])
  const [showCharge,     setShowCharge]    = useState(false)
  const [showSettings,   setShowSettings]  = useState(false)
  const [showShiftClose, setShowShiftClose] = useState(false)
  const [bottomTab,      setBottomTab]     = useState<'queue' | 'orders'>('queue')

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
    supabase.from('recipes').select('id, product_name, product_name_lo, category, category_id, price_lak, image_url')
      .eq('is_active', true).order('category')
      .then(({ data }) => { setRecipes((data as Recipe[]) ?? []); setLoading(false) })
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

  // Charge success handler (called from ChargePopup)
  function handleChargeSuccess(queueNum: number, receipt: string, change: number, method: PaymentMethod) {
    setSuccessData({ queue: queueNum, receipt, change, method })
    setCart([])
    setChargeStatus('success')
    setShowCharge(false)
    loadTodayOrders()
    setTimeout(() => {
      setChargeStatus('idle')
      setSuccessData(null)
    }, 5000)
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

  useEffect(() => { fetchTodayQueue(); loadTodayOrders() }, [fetchTodayQueue, loadTodayOrders])

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

      {showCharge && (
        <ChargePopup subtotal={subtotal} cartPayload={cartPayload}
          onSuccess={handleChargeSuccess} onClose={() => setShowCharge(false)} />
      )}

      {showSettings && <SettingsPopup onClose={() => setShowSettings(false)} />}
      {showShiftClose && <ShiftClosePopup todayTotal={todayTotal} todayCount={todayCount} onClose={() => setShowShiftClose(false)} />}

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
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 80, color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>No items in this category</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12 }}>
                {filtered.map(recipe => <MenuCard key={recipe.id} recipe={recipe} onAdd={() => setPendingRecipe(recipe)} />)}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: CART ──────────────────────────────────────────────────── */}
        <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#111', position: 'relative' }}>

          {/* Success overlay */}
          {chargeStatus === 'success' && successData && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              backgroundColor: 'rgba(10,10,10,0.96)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '3px', textTransform: 'uppercase' }}>คิวของคุณ</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 80, fontWeight: 900, color: GOLD, letterSpacing: '-2px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {fmtQueue(successData.queue)}
              </div>
              <div style={{ fontSize: 24 }}>✅</div>
              {successData.receipt !== '—' && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                  ใบเสร็จ <span style={{ color: GOLD, fontFamily: 'monospace' }}>{successData.receipt}</span>
                </div>
              )}
              {successData.method === 'cash' && successData.change > 0 && (
                <div style={{ marginTop: 8, padding: '10px 24px', backgroundColor: `${GREEN}18`, border: `1px solid ${GREEN}33`, borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>เงินทอน</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>{fmtLak(successData.change)}</div>
                </div>
              )}
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 6 }}>
                {PAY_METHODS.find(m => m.value === successData.method)?.icon} {PAY_METHODS.find(m => m.value === successData.method)?.label}
              </div>
            </div>
          )}

          {/* Cart header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
              Order{totalItems > 0 && <span style={{ color: GOLD, marginLeft: 6 }}>({totalItems})</span>}
            </span>
            {cart.length > 0 && chargeStatus === 'idle' && (
              <button onClick={() => setCart([])} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 12, cursor: 'pointer', padding: '2px 6px' }}>Clear all</button>
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
                <div key={item.cartKey} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', backgroundColor: '#1a1a1a', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.recipe.product_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.customization}
                    </div>
                    <div style={{ fontSize: 12, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtLak(item.recipe.price_lak * item.qty)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <QtyButton label="−" onClick={() => decrement(item.cartKey)} />
                    <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{item.qty}</span>
                    <QtyButton label="+" onClick={() => addToCartWithCustomization(item.recipe, item.customization)} />
                  </div>
                  <button onClick={() => setCart(prev => prev.filter(i => i.cartKey !== item.cartKey))}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.22)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
                </div>
              ))
            )}
          </div>

          {/* Cart footer */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase' }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{fmtLak(subtotal)}</span>
            </div>
            <button
              onClick={() => cart.length > 0 && setShowCharge(true)}
              disabled={cart.length === 0}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 6, border: 'none',
                backgroundColor: cart.length > 0 ? GOLD : 'rgba(255,255,255,0.06)',
                color: cart.length > 0 ? BLACK : 'rgba(255,255,255,0.18)',
                fontWeight: 800, fontSize: 14, letterSpacing: '1.5px', textTransform: 'uppercase',
                cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-heading)', transition: 'all 0.2s',
              }}
            >
              {cart.length > 0 ? `Charge ${fmtLak(subtotal)}` : 'No Items'}
            </button>
          </div>

          {/* ── BOTTOM TABS ─────────────────────────────────────────────── */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', borderTop: '2px solid rgba(255,255,255,0.07)', maxHeight: 260, backgroundColor: '#0e0e0e' }}>

            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
              {([
                { key: 'queue',  label: 'คิวปัจจุบัน', badge: queueEntries.length },
                { key: 'orders', label: 'ออเดอร์วันนี้', badge: todayCount },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setBottomTab(tab.key)} style={{
                  flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer',
                  backgroundColor: 'transparent',
                  borderBottom: `2px solid ${bottomTab === tab.key ? GOLD : 'transparent'}`,
                  color: bottomTab === tab.key ? GOLD : 'rgba(255,255,255,0.3)',
                  fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .15s',
                }}>
                  {tab.label}
                  {tab.badge > 0 && (
                    <span style={{ fontSize: 10, backgroundColor: bottomTab === tab.key ? GOLD : 'rgba(255,255,255,0.1)', color: bottomTab === tab.key ? BLACK : 'rgba(255,255,255,0.5)', padding: '1px 6px', borderRadius: 999, fontWeight: 700 }}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ overflowY: 'auto', flex: 1 }}>

              {/* Queue tab */}
              {bottomTab === 'queue' && (
                queueEntries.length === 0 ? (
                  <div style={{ padding: '12px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>ยังไม่มีคิว</div>
                ) : (
                  queueEntries.map(entry => (
                    <div key={entry.order_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ flexShrink: 0, minWidth: 44 }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: entry.queue_status === 'making' ? GOLD : 'rgba(255,255,255,0.45)' }}>
                          {fmtQueue(entry.queue_number)}
                        </div>
                        <div style={{ fontSize: 9, letterSpacing: '0.5px', marginTop: 1, color: entry.queue_status === 'making' ? `${GOLD}99` : 'rgba(255,255,255,0.2)' }}>
                          {entry.queue_status === 'making' ? 'กำลังทำ' : 'รอคิว'}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: 'rgba(255,255,255,0.38)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.summary || '—'}
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button onClick={() => updateQueueStatus(entry.order_id, 'making')} disabled={entry.queue_status === 'making'} title="เริ่มทำ" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', backgroundColor: entry.queue_status === 'making' ? 'rgba(255,255,255,0.03)' : `${GOLD}20`, color: entry.queue_status === 'making' ? 'rgba(255,255,255,0.12)' : GOLD, fontSize: 13, cursor: entry.queue_status === 'making' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔄</button>
                        <button onClick={() => updateQueueStatus(entry.order_id, 'ready')} title="พร้อมแล้ว" style={{ width: 28, height: 28, borderRadius: 6, border: 'none', backgroundColor: 'rgba(76,186,127,0.1)', color: GREEN, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✅</button>
                      </div>
                    </div>
                  ))
                )
              )}

              {/* Orders tab */}
              {bottomTab === 'orders' && (
                todayOrders.length === 0 ? (
                  <div style={{ padding: '12px 14px', textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>ยังไม่มีออเดอร์วันนี้</div>
                ) : (
                  todayOrders.map(order => {
                    const isVoid = order.status === 'void'
                    const payIcon = PAY_METHODS.find(m => m.value === order.payment_method)?.icon ?? '—'
                    const summary = order.items.slice(0, 2).map(i => `${i.qty}x ${i.name}`).join(', ') + (order.items.length > 2 ? ` +${order.items.length - 2}` : '')
                    return (
                      <div key={order.id} style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: isVoid ? 0.45 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 12, color: isVoid ? 'rgba(255,255,255,0.3)' : GOLD, minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtQueue(order.queue_number)}
                          </span>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', minWidth: 36 }}>{fmtTime(order.created_at_vt)}</span>
                          <span style={{ flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: isVoid ? 'rgba(255,255,255,0.2)' : '#fff', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {fmtLak(order.total_lak)}
                          </span>
                          <span title={order.payment_method ?? ''} style={{ fontSize: 13, flexShrink: 0 }}>{payIcon}</span>
                          {isVoid ? (
                            <span style={{ fontSize: 10, color: RED, flexShrink: 0 }}>VOID</span>
                          ) : (
                            <VoidRow order={order} onVoided={() => { fetchTodayQueue(); loadTodayOrders() }} />
                          )}
                        </div>
                        {isVoid && order.void_reason && (
                          <div style={{ fontSize: 10, color: 'rgba(255,80,80,0.5)', marginTop: 2, paddingLeft: 44 }}>{order.void_reason}</div>
                        )}
                      </div>
                    )
                  })
                )
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
