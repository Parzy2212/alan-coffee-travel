'use client'

import { useCallback, useEffect, useState } from 'react'
import { getPendingOrders, isStuck, removeOrder, retryOrder, type OfflineOrder } from '@/lib/offline-queue'

const RED  = '#e05555'
const GOLD = '#c9a84c'

type Summary = { items?: { name: string; qty: number; price: number; note?: string | null }[]; received?: number | null }
type Args = { p_table_number?: string | null; p_customer_name?: string | null; p_discount_lak?: number; p_discount_reason?: string | null; p_staff_note?: string | null; p_expected_total?: number; p_payment_method?: string; p_queue_number?: number; p_created_at?: string; p_is_test?: boolean; p_cart?: unknown[] }

const PAY: Record<string, string> = { cash: 'เงินสด', qr: 'QR', transfer: 'โอนเงิน', split: 'แยกบิล' }

function reasonText(msg: string): string {
  if (!msg) return 'ยังส่งไม่ถึงระบบ ตรวจอินเทอร์เน็ตของร้าน เครื่องจะส่งให้เองเมื่อเน็ตกลับมา'
  if (msg.includes('PRICE_CHANGED')) return 'ราคาเมนูเปลี่ยนหลังขาย ยอดบิลไม่ตรงกับราคาใหม่'
  if (msg.includes('Insufficient stock')) return 'วัตถุดิบในสต็อกไม่พอสำหรับบิลนี้'
  if (msg.includes('employee is not an active')) return 'พนักงานที่ขายบิลนี้ถูกปิดใช้งานแล้ว'
  if (msg.includes('sale time out of range')) return 'บิลนี้เก่าเกิน 30 วัน ส่งย้อนหลังไม่ได้ ต้องขายใหม่'
  if (msg.includes('menu item not available')) return 'เมนูในบิลนี้ถูกลบหรือปิดขายไปแล้ว ต้องขายใหม่ด้วยเมนูที่ยังมี'
  if (msg.includes('cash received is less')) return 'ราคาเมนูขึ้นหลังขาย เงินที่รับไว้น้อยกว่ายอดใหม่'
  if (msg.includes('discount must be')) return 'ราคาเมนูลดหลังขาย ส่วนลดมากกว่ายอดใหม่'
  if (msg.includes('shop not found')) return 'ระบบไม่ยอมบันทึกบิลนี้ ถ่ายรูปส่งเจ้าของร้าน'
  if (msg.includes('JWT') || msg.includes('permission') || msg.includes('Could not find the function')) return 'ระบบไม่ยอมบันทึกบิลนี้ ถ่ายรูปส่งเจ้าของร้าน'
  return 'ระบบไม่รับบิลนี้ ถ่ายรูปส่งเจ้าของร้าน'
}

// the server reports how long the PIN lock still lasts, in seconds
function waitText(seconds: unknown): string {
  const s = Math.ceil(Number(seconds))
  if (!Number.isFinite(s) || s <= 0) return 'สักครู่'
  return s < 60 ? `${s} วินาที` : `${Math.ceil(s / 60)} นาที`
}

const REMOVED_KEY = 'alan_removed_offline_bills'

// The remove button deletes the only copy of the bill, so keep a note of what was removed and by whom.
function noteRemoved(o: OfflineOrder, by: string) {
  try {
    const list = JSON.parse(localStorage.getItem(REMOVED_KEY) ?? '[]') as unknown[]
    list.push({ removedAt: new Date().toISOString(), removedBy: by, order: o })
    localStorage.setItem(REMOVED_KEY, JSON.stringify(list.slice(-50)))
  } catch { /* storage blocked */ }
}

/**
 * Bills sold offline that the server refused, or that were sent many times without an answer.
 * They stay on this device until someone deals with them.
 */
export function StuckBillsBanner({ shopId }: { shopId: string | null }) {
  const [stuck, setStuck] = useState<OfflineOrder[]>([])
  const [open, setOpen] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try { setStuck((await getPendingOrders()).filter(isStuck).sort((a, b) => a.createdAt - b.createdAt)) } catch { /* storage blocked */ }
  }, [])

  useEffect(() => {
    void refresh()
    const id = setInterval(refresh, 15000)
    window.addEventListener('alan:queue-changed', refresh)
    return () => { clearInterval(id); window.removeEventListener('alan:queue-changed', refresh) }
  }, [refresh])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setRemoving(null); setPin('') } }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open])

  if (stuck.length === 0) return null

  async function sendAgain(id: string) {
    setMsg('กำลังส่ง... ถ้าเข้าระบบแล้ว บิลจะหายจากรายการนี้')
    try {
      await retryOrder(id)
      await refresh()
      window.dispatchEvent(new Event('alan:replay-offline-queue'))
    } catch { setMsg('ส่งไม่ได้ ลองใหม่อีกครั้ง') }
  }

  async function confirmRemove(id: string) {
    if (busy) return
    if (!shopId || !/^\d{4}$/.test(pin)) { setMsg('ใส่ PIN ผู้จัดการ 4 หลัก'); return }
    setBusy(true); setMsg('')
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data, error } = await supabase.rpc('verify_employee_pin', { p_shop_id: shopId, p_pin: pin })
      if (error) {
        setMsg(error.message.includes('PIN_LOCKED') ? `ใส่ PIN ผิดหลายครั้ง รอ ${waitText(error.details)} แล้วลองใหม่`
          : error.code ? `ตรวจ PIN ไม่ได้ ถ่ายรูปหน้านี้ส่งเจ้าของร้าน (${error.message})`   // the server answered: not a network fault
          : 'ตรวจ PIN ไม่ได้เพราะเน็ตหลุด ต่อเน็ตแล้วลองใหม่')
        return
      }
      const manager = ((data ?? []) as { name: string; role: string }[]).find(e => e.role === 'manager' || e.role === 'owner')
      if (!manager) { setMsg('PIN ไม่ถูก ต้องใช้ PIN ของผู้จัดการ'); return }
      const target = stuck.find(o => o.id === id)
      if (target) noteRemoved(target, manager.name)
      await removeOrder(id)
      setRemoving(null)
      await refresh()
      window.dispatchEvent(new Event('alan:queue-changed'))
    } catch {
      setMsg('ตรวจ PIN ไม่ได้เพราะเน็ตหลุด ต่อเน็ตแล้วลองใหม่')
    } finally { setBusy(false); setPin('') }
  }

  const btn: React.CSSProperties = { padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }

  return (
    <>
      <button onClick={() => { setOpen(true); setMsg('') }} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', flexShrink: 0,
        padding: '10px 16px', border: 'none', borderBottom: `1px solid ${RED}`, backgroundColor: '#3a1414',
        color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      }}>
        มีบิล {stuck.length} ใบยังไม่เข้าระบบ (ขายตอนเน็ตหลุด) — กดที่นี่เพื่อจัดการ
      </button>

      {open && (
        <div data-stuck-bills-dialog role="dialog" aria-modal="true" aria-label="บิลที่ยังไม่เข้าระบบ" style={{ position: 'fixed', inset: 0, zIndex: 1200, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>บิลที่ยังไม่เข้าระบบ ({stuck.length})</div>
              <button onClick={() => { setOpen(false); setRemoving(null); setPin('') }} aria-label="ปิด" style={{ ...btn, border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)' }}>ปิด</button>
            </div>
            <div style={{ padding: '14px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px' }}>
                บิลเหล่านี้เก็บเงินลูกค้าแล้ว แต่ยอดยังไม่ขึ้นในรายงาน ทำตามนี้:<br />
                1. กด &ldquo;ส่งอีกครั้ง&rdquo; แล้วรอสักครู่ ถ้าบิลหายจากรายการ แปลว่าเข้าระบบแล้ว จบ<br />
                2. ถ้าบิลยังอยู่ ถ่ายรูปหน้านี้ส่งเจ้าของร้าน<br />
                3. ขายบิลนี้ใหม่ในหน้าขายตามรายการด้านล่าง ไม่ต้องเก็บเงินลูกค้าอีก<br />
                4. ให้ผู้จัดการกด &ldquo;ขายใหม่แล้ว ลบบิลค้างนี้&rdquo; ทันที อย่ากด &ldquo;ส่งอีกครั้ง&rdquo; กับบิลนี้อีก ยอดจะซ้ำ
              </div>
              {msg && <div role="alert" style={{ color: '#ffd28a', fontSize: 13 }}>{msg}</div>}

              {stuck.map(o => {
                const args = ((o.payload.args ?? o.payload) as Args) || {}
                const sum = (o.payload.summary ?? {}) as Summary
                const oldFormat = o.payload.fn !== 'checkout_order'
                const extra = [
                  args.p_table_number && `โต๊ะ ${args.p_table_number}`,
                  args.p_customer_name && `ลูกค้า ${args.p_customer_name}`,
                  args.p_discount_lak ? `ส่วนลด ${args.p_discount_lak.toLocaleString('en-US')}${args.p_discount_reason ? ` (${args.p_discount_reason})` : ''}` : '',
                  args.p_staff_note && `โน้ต: ${args.p_staff_note}`,
                ].filter(Boolean).join(' · ')
                const when = new Date(args.p_created_at ?? o.createdAt).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={o.id} style={{ border: `1px solid ${RED}66`, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                      <span>{args.p_queue_number ? `คิว #${args.p_queue_number} · ` : ''}{when}{args.p_is_test || oldFormat ? ' · TEST' : ''}</span>
                      <span>{typeof args.p_expected_total === 'number' ? `${args.p_expected_total.toLocaleString('en-US')} LAK` : ''} {PAY[args.p_payment_method ?? ''] ?? ''}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6, lineHeight: 1.6 }}>
                      {sum.items?.length
                        ? sum.items.map((i, n) => <div key={n}>{i.qty} x {i.name || '(ไม่มีชื่อ)'} @ {i.price.toLocaleString('en-US')}{i.note ? ` (${i.note})` : ''}</div>)
                        : <div>{args.p_cart?.length ?? 0} รายการ ({oldFormat ? 'บิลทดสอบเก่า ไม่ใช่ยอดขายจริง ผู้จัดการลบได้เลย' : 'ไม่มีรายละเอียดเมนูเก็บไว้'})</div>}
                      {extra && <div>{extra}</div>}
                      {typeof sum.received === 'number' && <div>รับเงินมา {sum.received.toLocaleString('en-US')} LAK</div>}
                    </div>
                    <div style={{ fontSize: 12, color: '#ff9a9a', marginTop: 6 }}>สาเหตุ: {reasonText(o.rejected ?? '')} {o.rejected ? <span style={{ color: 'rgba(255,255,255,0.4)' }}>({o.rejected})</span> : null}</div>

                    {removing === o.id ? (
                      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input type="password" inputMode="numeric" maxLength={4} autoFocus value={pin} aria-label="PIN ผู้จัดการ" placeholder="PIN ผู้จัดการ"
                          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          onKeyDown={e => { if (e.key === 'Enter') void confirmRemove(o.id) }}
                          style={{ width: 150, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', backgroundColor: '#0c0c0c', color: '#fff', fontSize: 15, minHeight: 44 }} />
                        <button onClick={() => void confirmRemove(o.id)} disabled={busy} style={{ ...btn, border: 'none', backgroundColor: RED, color: '#fff', opacity: busy ? 0.6 : 1 }}>{busy ? 'กำลังตรวจ...' : 'ลบบิลค้างนี้'}</button>
                        <button onClick={() => { setRemoving(null); setPin(''); setMsg('') }} style={{ ...btn, border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)' }}>ยกเลิก</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => void sendAgain(o.id)} style={{ ...btn, border: `1px solid ${GOLD}`, backgroundColor: `${GOLD}1a`, color: GOLD }}>ส่งอีกครั้ง</button>
                        <button onClick={() => { setRemoving(o.id); setPin(''); setMsg('') }} style={{ ...btn, border: `1px solid ${RED}88`, backgroundColor: 'transparent', color: '#ff9a9a' }}>ขายใหม่แล้ว ลบบิลค้างนี้</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
