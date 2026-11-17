'use client'

// Cash drawer for one shop (migration 059): open with the carried-over cash,
// paid-outs / paid-ins during the shift, blind count, result, two-person close,
// printed summary with two signature lines. Every write needs a PIN; the
// database checks it (same attempt limits as voiding a bill).

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { printHtmlViaBrowser, esc } from '@/lib/receipt-print'
import { getPaperWidth } from '@/lib/thermal-printer'

const GOLD  = '#c9a84c'
const BLACK = '#0f0f0f'
const GREEN = '#4cba7f'
const RED   = '#e05555'
const BLUE  = '#6aa9ff'
const MUTED = 'rgba(255,255,255,0.45)'
const PANEL = '#1a1a1a'
const LINE  = 'rgba(255,255,255,0.08)'
const KEYS  = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', '⌫'] as const

const OUT_CATEGORIES = ['ซื้อน้ำแข็ง', 'ซื้อนม/วัตถุดิบ', 'ค่าส่งของ', 'อื่นๆ']
const IN_CATEGORIES  = ['เติมเงินทอน', 'อื่นๆ']
const METHOD_LABEL: Record<string, string> = { cash: 'เงินสด', transfer: 'โอน', qr: 'QR', card: 'บัตร', split: 'แยกจ่าย (บิลเก่า)' }

type Movement = { id?: string; kind: 'paid_out' | 'paid_in'; amount: number; category: string; note: string | null; at?: string; by?: string | null }
type MethodSum = { bills: number; amount?: number }
type Sales = {
  bills: number; void_bills: number; refund_bills?: number; by_method: Record<string, MethodSum>
  total?: number; cash?: number; cash_sold?: number; refund_cash?: number; void_total?: number
}
type Session = {
  id: string; status: 'open' | 'counted'; opened_at: string; opened_by: string | null
  opening_cash: number; carried_over: number | null; opening_reason: string | null
  counted_at: string | null; counted_by: string | null
}
type Result = { counted: number; expected: number; difference: number; cash_sales: number; paid_out: number; paid_in: number; recounts: number }
type DrawerState = {
  session: Session | null
  carried_over?: number | null
  carried_from?: { counted_at: string; counted_by: string | null } | null
  movements?: Movement[]
  sales?: Sales
  result?: Result | null
}
type Summary = {
  opened_at: string; opened_by: string | null; counted_at: string; closed_at: string
  carried_over: number | null; opening_cash: number; opening_reason: string | null
  sales: Sales; cash_sales: number; paid_out: number; paid_in: number; movements: Movement[]
  expected: number; counted: number; difference: number; diff_reason: string | null; recounts: number
  counted_by: string | null; closed_by: string | null; checked_by: string | null; no_checker: boolean
}
type Field = 'amount' | 'pin' | 'mgr'
type View = 'main' | 'move' | 'count' | 'recount' | 'cancel'

const fmt  = (n: number | null | undefined) => Math.round(Number(n) || 0).toLocaleString('en-US')
const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n))
const time = (iso: string | null | undefined) => iso
  ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane' })
  : ''
const dateTime = (iso: string | null | undefined) => iso
  ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane' }).replace(',', '')
  : ''

function rpcErrorText(msg: string): string {
  if (msg.includes('SESSION_ALREADY_OPEN'))  return 'มีกะเปิดอยู่แล้ว (อาจเปิดจากอีกเครื่อง) — โหลดข้อมูลใหม่แล้ว'
  if (msg.includes('REASON_REQUIRED'))       return 'ต้องใส่เหตุผล'
  if (msg.includes('NO_OPEN_SESSION'))       return 'ยังไม่ได้เปิดกะ หรือกะนี้นับเงินไปแล้ว — โหลดข้อมูลใหม่แล้ว'
  if (msg.includes('ALREADY_COUNTED'))       return 'กะนี้นับเงินไปแล้ว ถ้านับผิดต้องให้ผู้จัดการนับซ้ำ'
  if (msg.includes('NOT_COUNTED'))           return 'ยังไม่ได้นับเงิน — โหลดข้อมูลใหม่แล้ว'
  if (msg.includes('already counted'))       return 'นับเงินไปแล้ว แก้รายการนี้ไม่ได้'
  if (msg.includes('movement not found'))    return 'ไม่พบรายการนี้ (อาจถูกยกเลิกไปแล้ว)'
  if (/fetch|network|timeout|abort/i.test(msg)) return 'ต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง (ลิ้นชักต้องใช้อินเทอร์เน็ต)'
  return msg
}

function pinErrorText(r: { error?: string; wait?: number }): string {
  if (r.error === 'invalid_pin')  return 'PIN ไม่ถูกต้อง'
  if (r.error === 'locked')       return `ใส่ PIN ผิดหลายครั้ง รอ ${r.wait ?? 60} วินาทีแล้วลองใหม่`
  if (r.error === 'same_person')  return 'ผู้ตรวจต้องเป็นคนละคนกับคนนับและคนปิดกะ (ถ้าอยู่คนเดียว กดปิดกะโดยไม่มีคนตรวจ)'
  return r.error ?? 'ทำรายการไม่สำเร็จ'
}

function buildSummaryHtml(s: Summary, shopName: string, paperMm: 58 | 80): string {
  const row = (l: string, r: string, cls = '') => `<div class="r ${cls}"><span>${esc(l)}</span><span>${esc(r)}</span></div>`
  const c   = (t: string, cls = '') => `<div class="c ${cls}">${esc(t)}</div>`
  const out: string[] = [c(shopName, 'b big'), c('ใบสรุปปิดกะ', 'b'), c(`${dateTime(s.opened_at)} - ${time(s.counted_at)}`), '<hr>']
  const bm = s.sales.by_method ?? {}
  for (const k of ['cash', 'transfer', 'qr', 'card', 'split']) {
    if (bm[k]) out.push(row(`${METHOD_LABEL[k]} (${bm[k].bills})`, fmt(bm[k].amount)))
  }
  out.push(row(`รวมขาย (${s.sales.bills})`, fmt(s.sales.total), 'b'))
  if (s.sales.void_bills > 0) out.push(row(`ยกเลิกบิล (${s.sales.void_bills})`, fmt(s.sales.void_total)))
  if ((s.sales.refund_bills ?? 0) > 0) out.push(`<div class="sub">(คืนเงินบิลกะก่อน ${s.sales.refund_bills} บิล ${esc(fmt(s.sales.refund_cash))} หักในขายเงินสดแล้ว)</div>`)
  out.push('<hr>', row('เงินเปิดกะ', fmt(s.opening_cash)))
  if (s.carried_over !== null && s.carried_over !== s.opening_cash) {
    out.push(`<div class="sub">(ยกมา ${esc(fmt(s.carried_over))}${s.opening_reason ? `: ${esc(s.opening_reason)}` : ''})</div>`)
  }
  out.push(row('ขายเงินสด', fmt(s.cash_sales)))
  const outs = s.movements.filter(m => m.kind === 'paid_out')
  const ins  = s.movements.filter(m => m.kind === 'paid_in')
  if (outs.length) {
    out.push(row(`จ่ายออก (${outs.length})`, `-${fmt(s.paid_out)}`))
    for (const m of outs) out.push(`<div class="sub">${esc(m.category)}${m.note ? ' ' + esc(m.note) : ''} ${esc(fmt(m.amount))}</div>`)
  }
  if (ins.length) {
    out.push(row(`ใส่เงินเข้า (${ins.length})`, `+${fmt(s.paid_in)}`))
    for (const m of ins) out.push(`<div class="sub">${esc(m.category)}${m.note ? ' ' + esc(m.note) : ''} ${esc(fmt(m.amount))}</div>`)
  }
  out.push('<hr class="d">', row('ควรมี', fmt(s.expected)), row('นับได้', fmt(s.counted), 'b'))
  out.push(row(s.difference < 0 ? 'ขาด' : s.difference > 0 ? 'เกิน' : 'ตรง', sign(s.difference), 'b big'))
  if (s.diff_reason) out.push(`<div>เหตุผล: ${esc(s.diff_reason)}</div>`)
  if (s.recounts > 0) out.push(`<div class="s">นับซ้ำโดยผู้จัดการ ${s.recounts} ครั้ง</div>`)
  out.push('<hr>', `<div class="s">คนนับ: ${esc(s.counted_by ?? '-')} ${esc(time(s.counted_at))}</div>`)
  if (s.closed_by && s.closed_by !== s.counted_by) out.push(`<div class="s">คนปิดกะ: ${esc(s.closed_by)}</div>`)
  out.push(`<div class="s">${s.no_checker ? 'ไม่มีผู้ตรวจ' : `ผู้ตรวจ: ${esc(s.checked_by ?? '-')} ${esc(time(s.closed_at))}`}</div>`)
  const sig = (label: string) => `<div style="margin-top:10mm;border-top:1px solid #000;padding-top:1mm" class="c s">${esc(label)}</div>`
  out.push(sig('ลงชื่อคนนับ'), sig('ลงชื่อผู้ตรวจ'), '<div style="height:8mm"></div>')
  return `<div class="rcpt w${paperMm}" lang="th">${out.join('')}</div>`
}

export function CashDrawer({ shopId, onClose }: { shopId: string | null; onClose: () => void }) {
  const [st,       setSt]       = useState<DrawerState | null>(null)
  const [loadErr,  setLoadErr]  = useState('')
  const [view,     setView]     = useState<View>('main')
  const [amount,   setAmount]   = useState('')
  const [pin,      setPin]      = useState('')
  const [mgrPin,   setMgrPin]   = useState('')
  const [reason,   setReason]   = useState('')
  const [note,     setNote]     = useState('')
  const [category, setCategory] = useState('')
  const [kind,     setKind]     = useState<'paid_out' | 'paid_in'>('paid_out')
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [field,    setField]    = useState<Field>('amount')
  const [busy,     setBusy]     = useState(false)
  const [err,      setErr]      = useState('')
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [printMsg, setPrintMsg] = useState('')
  // the counter's PIN, kept only while this window is open, so the close step does not ask again
  const counterPin = useRef('')
  // blocks taps that land before `busy` re-renders the buttons as disabled
  const inFlight = useRef(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!shopId) { setLoadErr('ยังไม่รู้ว่าเป็นร้านไหน — รอสักครู่แล้วเปิดใหม่'); return }
    setLoadErr('')
    const { data, error } = await supabase.rpc('cash_session_state', { p_shop_id: shopId })
    if (error) { setLoadErr(rpcErrorText(error.message)); return }
    const s = data as DrawerState
    setSt(s)
    if (!s.session) setAmount(s.carried_over != null ? String(Math.round(s.carried_over)) : '')
    if (s.session?.status === 'counted') setField(f => (f === 'amount' ? (counterPin.current ? 'mgr' : 'pin') : f))
  }, [shopId])

  useEffect(() => { void load() }, [load])

  function resetInputs(next: View, nextField: Field = 'amount') {
    setView(next); setAmount(''); setPin(''); setMgrPin(''); setReason(''); setNote(''); setCategory('')
    setCancelId(null); setErr(''); setField(nextField)
  }

  function press(k: string) {
    const max = field === 'amount' ? 12 : 4
    const set = field === 'amount' ? setAmount : field === 'pin' ? setPin : setMgrPin
    set(prev => {
      if (k === '⌫') return prev.slice(0, -1)
      if (field !== 'amount') return (prev + k).slice(0, max)
      const next = (prev + k).replace(/^0+(?=\d)/, '')
      return next === '00' ? '0' : next.slice(0, max)
    })
  }

  // runs one drawer function; returns its jsonb on success, null after showing the error
  async function call(fn: string, args: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (inFlight.current) return null
    inFlight.current = true
    setBusy(true); setErr('')
    try {
      const { data, error } = await supabase.rpc(fn, args)
      if (error) {
        setErr(rpcErrorText(error.message))
        if (/SESSION_ALREADY_OPEN|NO_OPEN_SESSION|NOT_COUNTED|ALREADY_COUNTED|already counted/.test(error.message)) void load()
        return null
      }
      const r = data as Record<string, unknown> & { ok?: boolean; error?: string; wait?: number }
      if (r && r.ok === false) {
        setErr(pinErrorText(r))
        // the remembered counter PIN may be the one refused: ask for it on screen
        setPin(''); setMgrPin(''); counterPin.current = ''
        if (fn === 'cash_session_close') setField('pin')
        return null
      }
      return r
    } catch (e) {
      setErr(rpcErrorText(e instanceof Error ? e.message : String(e)))
      return null
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  async function openDrawer() {
    if (amount === '') { setErr('ใส่จำนวนเงินในลิ้นชัก'); return }
    if (differs && !reason.trim()) { setErr('เงินไม่ตรงยอดยกมา ต้องใส่เหตุผล'); return }
    if (pin.length !== 4) { setErr('ใส่ PIN 4 หลัก'); setField('pin'); return }
    const r = await call('cash_session_open', { p_shop_id: shopId, p_pin: pin, p_opening_cash: Number(amount), p_reason: reason.trim() || null })
    if (r) { resetInputs('main'); await load() }
  }

  async function saveMovement() {
    if (!amount || Number(amount) <= 0) { setErr('ใส่จำนวนเงิน'); setField('amount'); return }
    if (!category) { setErr('เลือกว่าเป็นค่าอะไร'); return }
    if (category === 'อื่นๆ' && !note.trim()) { setErr('เลือก "อื่นๆ" ต้องพิมพ์รายละเอียด'); return }
    if (pin.length !== 4) { setErr('ใส่ PIN 4 หลัก'); setField('pin'); return }
    const r = await call('cash_movement_add', { p_shop_id: shopId, p_pin: pin, p_kind: kind, p_amount: Number(amount), p_category: category, p_note: note.trim() || null })
    if (r) { resetInputs('main'); await load() }
  }

  async function cancelMovement() {
    if (!reason.trim()) { setErr('ใส่เหตุผลที่ยกเลิก'); return }
    if (mgrPin.length !== 4) { setErr('ใส่ PIN ผู้จัดการ 4 หลัก'); setField('mgr'); return }
    const r = await call('cash_movement_void', { p_shop_id: shopId, p_movement_id: cancelId, p_manager_pin: mgrPin, p_reason: reason.trim() })
    if (r) { resetInputs('main'); await load() }
  }

  async function countCash() {
    if (amount === '') { setErr('ใส่ยอดเงินที่นับได้'); setField('amount'); return }
    if (pin.length !== 4) { setErr('ใส่ PIN ของคนนับ 4 หลัก'); setField('pin'); return }
    const usedPin = pin
    const r = await call('cash_session_count', { p_shop_id: shopId, p_pin: usedPin, p_counted: Number(amount) })
    if (r) { counterPin.current = usedPin; resetInputs('main', 'mgr'); await load() }
  }

  async function recount() {
    if (amount === '') { setErr('ใส่ยอดที่นับใหม่'); setField('amount'); return }
    if (mgrPin.length !== 4) { setErr('ใส่ PIN ผู้จัดการ 4 หลัก'); setField('mgr'); return }
    const r = await call('cash_session_recount', { p_shop_id: shopId, p_manager_pin: mgrPin, p_counted: Number(amount) })
    if (r) { resetInputs('main', 'mgr'); await load() }
  }

  async function closeDrawer(alone: boolean) {
    const diff = st?.result?.difference ?? 0
    if (diff !== 0 && !reason.trim()) { setErr('เงินขาดหรือเกิน ต้องใส่เหตุผล'); return }
    const staffPin = counterPin.current || pin
    if (staffPin.length !== 4) { setErr('ใส่ PIN ของคุณ 4 หลัก'); setField('pin'); return }
    if (!alone && mgrPin.length !== 4) { setErr('ใส่ PIN ผู้จัดการ 4 หลัก (หรือกดปิดกะโดยไม่มีคนตรวจ)'); setField('mgr'); return }
    const r = await call('cash_session_close', {
      p_shop_id: shopId, p_pin: staffPin, p_diff_reason: reason.trim() || null, p_manager_pin: alone ? null : mgrPin,
    })
    if (!r) return
    const s = r as unknown as Summary
    setSummary(s)
    void printSummary(s)
  }

  async function printSummary(s: Summary) {
    setPrintMsg('กำลังพิมพ์...')
    try {
      let shopName = 'ALAN COFFEE & TRAVEL'
      try {
        const { data } = await supabase.rpc('get_site_settings')
        shopName = ((data as Record<string, string> | null)?.shop_name) || shopName
      } catch { /* print with the default name */ }
      await printHtmlViaBrowser(buildSummaryHtml(s, shopName, getPaperWidth()))
      setPrintMsg('ส่งไปพิมพ์แล้ว')
    } catch (e) {
      setPrintMsg(`พิมพ์ไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)} — กดพิมพ์อีกครั้งได้`)
    }
  }

  const session  = st?.session ?? null
  const carried  = st?.carried_over ?? null
  const differs  = !session && carried !== null && amount !== '' && Number(amount) !== Math.round(carried)
  const result   = st?.result ?? null
  const sales    = st?.sales
  const moves    = st?.movements ?? []

  // ── small building blocks ──────────────────────────────────────────────
  const label = (t: string) => <div style={{ fontSize: 11, color: MUTED, marginBottom: 5 }}>{t}</div>
  const box = (f: Field, value: string, placeholder: string, masked = false) => (
    <div onClick={() => setField(f)} role="button" aria-label={placeholder}
      style={{ padding: '10px 12px', borderRadius: 8, border: `2px solid ${field === f ? GOLD : 'rgba(255,255,255,0.12)'}`, backgroundColor: field === f ? `${GOLD}0d` : PANEL, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: masked ? 'center' : 'flex-end', letterSpacing: masked ? 8 : 0 }}>
      <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: value ? '#fff' : 'rgba(255,255,255,0.25)' }}>
        {value ? (masked ? '•'.repeat(value.length) : fmt(Number(value))) : placeholder}
      </span>
    </div>
  )
  const numpad = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {KEYS.map(k => (
        <button key={k} onClick={() => press(k)} style={{ padding: '12px 0', borderRadius: 8, border: 'none', backgroundColor: k === '⌫' ? 'rgba(220,80,80,0.14)' : 'rgba(255,255,255,0.07)', color: k === '⌫' ? '#e07070' : '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>{k}</button>
      ))}
    </div>
  )
  const textInput = (value: string, set: (v: string) => void, placeholder: string) => (
    <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder} maxLength={200}
      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', backgroundColor: PANEL, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
  )
  const primary = (text: string, onClick: () => void, disabled = false) => (
    <button onClick={onClick} disabled={busy || disabled}
      style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', backgroundColor: GOLD, color: BLACK, fontWeight: 800, fontSize: 15, cursor: busy ? 'wait' : 'pointer', opacity: busy || disabled ? 0.55 : 1 }}>
      {busy ? 'กำลังบันทึก...' : text}
    </button>
  )
  const secondary = (text: string, onClick: () => void, color = 'rgba(255,255,255,0.75)') => (
    <button onClick={onClick} disabled={busy}
      style={{ width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${LINE}`, backgroundColor: 'rgba(255,255,255,0.04)', color, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: busy ? 0.55 : 1 }}>
      {text}
    </button>
  )
  const line = (l: string, r: string, color = '#fff', bold = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: bold ? 15 : 13, fontWeight: bold ? 800 : 500, padding: '3px 0' }}>
      <span style={{ color: bold ? '#fff' : 'rgba(255,255,255,0.7)' }}>{l}</span>
      <span style={{ color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r}</span>
    </div>
  )
  const card = (children: React.ReactNode, accent?: string) => (
    <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: PANEL, border: `1px solid ${accent ?? LINE}` }}>{children}</div>
  )
  const errBox = err && <div role="alert" style={{ color: RED, fontSize: 13, padding: '8px 10px', borderRadius: 8, backgroundColor: `${RED}14` }}>{err}</div>

  // ── views ──────────────────────────────────────────────────────────────
  let title = 'เงินสดในลิ้นชัก'
  let body: React.ReactNode

  if (summary) {
    const d = summary.difference
    title = 'ปิดกะแล้ว'
    body = (
      <>
        {card(<>
          {line('เงินสดที่ควรมี', `${fmt(summary.expected)} ₭`)}
          {line('นับได้', `${fmt(summary.counted)} ₭`)}
          {line(d < 0 ? 'ขาด' : d > 0 ? 'เกิน' : 'ยอดตรง', `${sign(d)} ₭`, d === 0 ? GREEN : RED, true)}
          <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
            {summary.no_checker ? 'ไม่มีผู้ตรวจ (แจ้งเจ้าของร้านแล้ว)' : `ผู้ตรวจ: ${summary.checked_by}`} · ยอดที่นับได้ยกไปเป็นเงินเปิดกะถัดไป
          </div>
        </>, d === 0 ? `${GREEN}55` : `${RED}55`)}
        {printMsg && <div style={{ fontSize: 13, color: printMsg.startsWith('พิมพ์ไม่สำเร็จ') ? RED : MUTED }}>{printMsg}</div>}
        {secondary('พิมพ์ใบสรุปอีกครั้ง', () => void printSummary(summary))}
        {primary('เสร็จ', onClose)}
      </>
    )
  } else if (loadErr) {
    body = <>{<div style={{ color: RED, fontSize: 14 }}>{loadErr}</div>}{primary('ลองใหม่', () => void load())}</>
  } else if (!st) {
    body = <div style={{ color: MUTED, fontSize: 14, padding: '30px 0', textAlign: 'center' }}>กำลังโหลด...</div>
  } else if (!session) {
    title = 'เปิดกะ: เงินเปิดลิ้นชัก'
    body = (
      <>
        {carried !== null ? card(<>
          <div style={{ fontSize: 11, color: MUTED }}>ยกยอดจากกะก่อน</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: GOLD, marginTop: 2 }}>{fmt(carried)} ₭</div>
          {st.carried_from && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{st.carried_from.counted_by ?? '-'} นับได้ตอนปิดกะ {dateTime(st.carried_from.counted_at)}</div>}
        </>) : card(<div style={{ fontSize: 13, color: MUTED }}>กะแรกของร้าน: นับเงินในลิ้นชักตอนนี้แล้วใส่ยอด</div>)}
        <div>{label(carried !== null ? 'เงินในลิ้นชักตอนนี้ (แก้ได้ถ้าไม่ตรง)' : 'เงินในลิ้นชักตอนนี้')}{box('amount', amount, '0')}</div>
        {differs && (
          <div>
            <div style={{ fontSize: 12, color: RED, marginBottom: 5 }}>ไม่ตรงกับยอดยกมา {sign(Number(amount) - Math.round(carried ?? 0))} ₭ ต้องใส่เหตุผล</div>
            {textInput(reason, setReason, 'เช่น เจ้าของร้านเอาไปฝากธนาคาร')}
          </div>
        )}
        <div>{label('PIN ของคุณ')}{box('pin', pin, 'PIN', true)}</div>
        {numpad}
        {errBox}
        {primary('เริ่มกะ', () => void openDrawer())}
      </>
    )
  } else if (view === 'move') {
    title = kind === 'paid_out' ? 'จ่ายเงินออกจากลิ้นชัก' : 'ใส่เงินเข้าลิ้นชัก'
    const cats = kind === 'paid_out' ? OUT_CATEGORIES : IN_CATEGORIES
    body = (
      <>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['paid_out', 'paid_in'] as const).map(k => (
            <button key={k} onClick={() => { setKind(k); setCategory('') }}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: kind === k ? 800 : 500, cursor: 'pointer', border: `1px solid ${kind === k ? GOLD : LINE}`, backgroundColor: kind === k ? `${GOLD}18` : 'transparent', color: kind === k ? GOLD : MUTED }}>
              {k === 'paid_out' ? 'จ่ายออก' : 'ใส่เงินเข้า'}
            </button>
          ))}
        </div>
        <div>{label('จำนวนเงิน')}{box('amount', amount, '0')}</div>
        <div>
          {label(kind === 'paid_out' ? 'จ่ายค่าอะไร (ต้องเลือก)' : 'ใส่เงินเพราะอะไร (ต้องเลือก)')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cats.map(cName => (
              <button key={cName} onClick={() => setCategory(cName)}
                style={{ padding: '8px 12px', borderRadius: 999, fontSize: 13, cursor: 'pointer', border: `1px solid ${category === cName ? GOLD : 'rgba(255,255,255,0.14)'}`, backgroundColor: category === cName ? `${GOLD}22` : 'transparent', color: category === cName ? GOLD : '#fff', fontWeight: category === cName ? 700 : 400 }}>
                {cName}
              </button>
            ))}
          </div>
        </div>
        {textInput(note, setNote, category === 'อื่นๆ' ? 'รายละเอียด (ต้องใส่)' : 'รายละเอียด เช่น น้ำแข็ง 3 ถุง ร้านป้าแดง')}
        <div>{label(kind === 'paid_out' ? 'PIN ของคนที่จ่าย' : 'PIN ของคนที่ใส่เงิน')}{box('pin', pin, 'PIN', true)}</div>
        {numpad}
        {errBox}
        {primary(kind === 'paid_out' ? 'บันทึกจ่ายออก' : 'บันทึกใส่เงินเข้า', () => void saveMovement())}
        {secondary('ย้อนกลับ', () => resetInputs('main'))}
        <div style={{ fontSize: 11, color: MUTED }}>บันทึกทันที ลบเองไม่ได้ ถ้าผิดต้องใช้ PIN ผู้จัดการยกเลิก</div>
      </>
    )
  } else if (view === 'cancel') {
    const m = moves.find(x => x.id === cancelId)
    title = 'ยกเลิกรายการ (PIN ผู้จัดการ)'
    body = (
      <>
        {m && card(line(`${time(m.at)} ${m.category}${m.note ? ' · ' + m.note : ''}`, `${m.kind === 'paid_out' ? '−' : '+'}${fmt(m.amount)}`))}
        {textInput(reason, setReason, 'เหตุผลที่ยกเลิก (ต้องใส่)')}
        <div>{label('PIN ผู้จัดการ')}{box('mgr', mgrPin, 'PIN', true)}</div>
        {numpad}
        {errBox}
        {primary('ยกเลิกรายการนี้', () => void cancelMovement())}
        {secondary('ย้อนกลับ', () => resetInputs('main'))}
      </>
    )
  } else if (view === 'count') {
    title = 'นับเงินสด (ไม่เห็นยอดก่อน)'
    body = (
      <>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>นับเงินในลิ้นชักให้ครบ แล้วใส่ยอดที่นับได้</div>
        <div>{label('ยอดที่นับได้')}{box('amount', amount, '0')}</div>
        {card(<>
          <div style={{ fontSize: 12, color: MUTED }}>เงินสดที่ควรมี</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>ซ่อนไว้ จะแสดงหลังกด &quot;ยืนยันยอดที่นับ&quot;</div>
        </>)}
        <div>{label('PIN ของคนนับ')}{box('pin', pin, 'PIN', true)}</div>
        {numpad}
        {errBox}
        {primary('ยืนยันยอดที่นับ', () => void countCash())}
        {secondary('ย้อนกลับ', () => resetInputs('main'))}
        <div style={{ fontSize: 11, color: MUTED }}>กดแล้วแก้ยอดเองไม่ได้ ถ้านับผิดจริงต้องให้ผู้จัดการนับซ้ำ</div>
      </>
    )
  } else if (view === 'recount') {
    title = 'นับซ้ำ (PIN ผู้จัดการ)'
    body = (
      <>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>ผู้จัดการนับเงินในลิ้นชักใหม่ แล้วใส่ยอด (แจ้งเจ้าของร้านทุกครั้ง)</div>
        <div>{label('ยอดที่นับใหม่')}{box('amount', amount, '0')}</div>
        <div>{label('PIN ผู้จัดการ')}{box('mgr', mgrPin, 'PIN', true)}</div>
        {numpad}
        {errBox}
        {primary('บันทึกยอดนับใหม่', () => void recount())}
        {secondary('ย้อนกลับ', () => resetInputs('main', 'mgr'))}
      </>
    )
  } else if (session.status === 'counted' && result) {
    const d = result.difference
    title = 'ผลการนับ และยืนยัน 2 คน'
    body = (
      <>
        {card(<>
          {line('เงินเปิดกะ', fmt(session.opening_cash))}
          {line('ขายเงินสด (หักเงินทอนแล้ว)', `${result.cash_sales < 0 ? '−' : '+'}${fmt(Math.abs(result.cash_sales))}`)}
          {(sales?.refund_bills ?? 0) > 0 && <div style={{ fontSize: 11, color: MUTED }}>หักคืนเงินบิลกะก่อน {sales?.refund_bills} บิลแล้ว ({fmt(sales?.refund_cash)})</div>}
          {result.paid_out > 0 && line(`− จ่ายออก ${moves.filter(m => m.kind === 'paid_out').length} รายการ`, fmt(result.paid_out))}
          {result.paid_in > 0 && line(`+ ใส่เงินเข้า ${moves.filter(m => m.kind === 'paid_in').length} รายการ`, fmt(result.paid_in))}
          <div style={{ borderTop: `1px solid ${LINE}`, margin: '6px 0' }} />
          {line('เงินสดที่ควรมี', `${fmt(result.expected)} ₭`, '#fff', true)}
          {line('นับได้', `${fmt(result.counted)} ₭`, '#fff', true)}
          {line(d < 0 ? 'ขาด' : d > 0 ? 'เกิน' : 'ยอดตรง', `${sign(d)} ₭`, d === 0 ? GREEN : RED, true)}
          <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>คนนับ {session.counted_by ?? '-'} · {time(session.counted_at)}{result.recounts > 0 ? ` · นับซ้ำ ${result.recounts} ครั้ง` : ''}</div>
        </>, d === 0 ? `${GREEN}55` : `${RED}55`)}
        {d !== 0 && <div>{label('เหตุผล (ต้องใส่เมื่อขาดหรือเกิน)')}{textInput(reason, setReason, 'เช่น ลูกค้าไม่รับเงินทอน 1 บิล')}</div>}
        {!counterPin.current && <div>{label('PIN ของคุณ (คนปิดกะ)')}{box('pin', pin, 'PIN', true)}</div>}
        <div>{label('ผู้จัดการตรวจ (PIN ผู้จัดการ)')}{box('mgr', mgrPin, 'PIN', true)}</div>
        {numpad}
        <div style={{ fontSize: 11, color: MUTED }}>ระบบ PIN เดียวกับการยกเลิกบิล ใส่ผิด 5 ครั้งถูกล็อกชั่วคราว</div>
        {errBox}
        {primary('ยืนยันปิดกะ และพิมพ์ใบสรุป', () => void closeDrawer(false))}
        {secondary('อยู่คนเดียว: ปิดกะโดยไม่มีคนตรวจ', () => void closeDrawer(true), GOLD)}
        {secondary('ผู้จัดการนับซ้ำ', () => resetInputs('recount'))}
        <div style={{ fontSize: 11, color: MUTED }}>ไม่มีคนตรวจ = จดว่า &quot;ไม่มีผู้ตรวจ&quot; และแจ้งเจ้าของร้าน · ยอดที่นับได้ยกไปเป็นเงินเปิดกะถัดไป</div>
      </>
    )
  } else {
    const bm = sales?.by_method ?? {}
    title = 'กะเปิดอยู่'
    body = (
      <>
        <div style={{ fontSize: 12, color: MUTED }}>
          เปิดโดย {session.opened_by ?? '-'} · {dateTime(session.opened_at)} · เงินเปิดกะ {fmt(session.opening_cash)} ₭
        </div>
        {card(<>
          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, marginBottom: 4 }}>ยอดขายกะนี้</div>
          {line(`เงินสด · ${bm.cash?.bills ?? 0} บิล`, 'แสดงหลังนับเงิน', MUTED)}
          {(['transfer', 'qr', 'card', 'split'] as const).filter(k => bm[k]).map(k => (
            <div key={k}>{line(`${METHOD_LABEL[k]} · ${bm[k].bills} บิล`, k === 'split' ? '' : fmt(bm[k].amount))}</div>
          ))}
          {line(`รวมขาย · ${sales?.bills ?? 0} บิล`, 'แสดงหลังนับเงิน', MUTED)}
          {(sales?.void_bills ?? 0) > 0 && line(`ยกเลิกบิล · ${sales?.void_bills} บิล (ไม่นับในยอดขาย)`, '')}
          {(sales?.refund_bills ?? 0) > 0 && line(`คืนเงินบิลกะก่อน · ${sales?.refund_bills} บิล (หักจากลิ้นชักนี้)`, '')}
          <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>ไม่นับบิลทดสอบ · โอนและ QR ไม่ต้องนับเงิน ใช้ยอดนี้เทียบกับแอปธนาคาร</div>
        </>)}
        {card(<>
          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, marginBottom: 4 }}>จ่ายออก / ใส่เงินเข้า กะนี้</div>
          {moves.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>ยังไม่มี</div>}
          {moves.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
              <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{time(m.at)}</span>
              <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{m.category}{m.note ? ` · ${m.note}` : ''}{m.by ? <span style={{ color: MUTED }}> ({m.by})</span> : null}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: m.kind === 'paid_out' ? RED : BLUE, whiteSpace: 'nowrap' }}>{m.kind === 'paid_out' ? '−' : '+'}{fmt(m.amount)}</span>
              <button onClick={() => { resetInputs('cancel', 'mgr'); setCancelId(m.id ?? null) }} aria-label="ยกเลิกรายการ"
                style={{ background: 'none', border: `1px solid ${LINE}`, borderRadius: 6, color: MUTED, fontSize: 12, padding: '2px 8px', cursor: 'pointer' }}>ยกเลิก</button>
            </div>
          ))}
        </>)}
        {errBox}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {secondary('จ่ายเงินออก', () => { resetInputs('move'); setKind('paid_out') })}
          {secondary('ใส่เงินเข้า', () => { resetInputs('move'); setKind('paid_in') })}
        </div>
        {primary('นับเงินปิดกะ', () => resetInputs('count'))}
      </>
    )
  }

  return (
    <div ref={overlayRef} onClick={e => { if (e.target === overlayRef.current && !busy) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div role="dialog" aria-label={title}
        style={{ backgroundColor: '#111', border: `1px solid ${GOLD}44`, borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: 'calc(100dvh - 24px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>{title}</div>
          <button onClick={onClose} disabled={busy} aria-label="ปิด" style={{ background: 'none', border: 'none', color: MUTED, fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          {body}
        </div>
      </div>
    </div>
  )
}
