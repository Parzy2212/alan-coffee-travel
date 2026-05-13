'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Customer, LoyaltyTransaction } from '@/lib/customers'
import { getCustomerOrders, getLoyaltyTransactions, updateCustomer } from '@/lib/customers'
import { VipBadge } from './VipBadge'
import { isBirthdayToday, fmtLastVisit, TIER_META, DEFAULT_SETTINGS } from '@/lib/loyalty'

const GOLD   = '#c9a84c'
const GREEN  = '#4cba7f'
const RED    = '#ff6b6b'
const BORDER = 'rgba(255,255,255,0.1)'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: `1px solid ${BORDER}`, backgroundColor: '#0f0f0f',
  color: '#fff', fontSize: 13, boxSizing: 'border-box',
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{children}</div>
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      flex: 1, padding: '12px 14px', borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color ?? '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export interface CustomerDetailModalProps {
  customer: Customer
  shopId?: string | null
  onClose: () => void
  onUpdated: (c: Customer) => void
}

type Order = { id: string; queue_number: number | null; status: string; total_lak: number | null; created_at: string }

export function CustomerDetailModal({ customer: init, shopId, onClose, onUpdated }: CustomerDetailModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [c,       setC]       = useState<Customer>(init)
  const [tab,     setTab]     = useState<'profile' | 'orders' | 'loyalty'>('profile')
  const [editing, setEditing] = useState(false)
  const [form,    setForm]    = useState({
    name:     init.name ?? '',
    email:    init.email ?? '',
    birthday: init.birthday ?? '',
    notes:    init.notes ?? '',
    phone:    init.phone ?? '',
  })
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')
  const [orders,  setOrders]  = useState<Order[]>([])
  const [txns,    setTxns]    = useState<LoyaltyTransaction[]>([])
  const [loading, setLoading] = useState(false)

  const birthday = isBirthdayToday(c.birthday)
  const { color: tierColor } = TIER_META[c.vip_tier]

  const loadTab = useCallback(async (t: typeof tab) => {
    if (t === 'orders' && orders.length === 0) {
      setLoading(true)
      setOrders((await getCustomerOrders(c.id, 10)) as Order[])
      setLoading(false)
    }
    if (t === 'loyalty' && txns.length === 0) {
      setLoading(true)
      setTxns(await getLoyaltyTransactions(c.id, 20))
      setLoading(false)
    }
  }, [c.id, orders.length, txns.length])

  useEffect(() => { void loadTab(tab) }, [tab, loadTab])

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      const updated = await updateCustomer(c.id, {
        name:     form.name || null,
        email:    form.email || null,
        birthday: form.birthday || null,
        notes:    form.notes || null,
        phone:    form.phone || null,
      })
      if (updated) {
        setC(updated)
        onUpdated(updated)
        setEditing(false)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    }
    setSaving(false)
  }

  const pointsToNextTier = (() => {
    const pts = c.loyalty_points
    if (pts < DEFAULT_SETTINGS.vip_silver_threshold)   return { label: 'Silver', need: DEFAULT_SETTINGS.vip_silver_threshold - pts }
    if (pts < DEFAULT_SETTINGS.vip_gold_threshold)     return { label: 'Gold',   need: DEFAULT_SETTINGS.vip_gold_threshold - pts }
    if (pts < DEFAULT_SETTINGS.vip_platinum_threshold) return { label: 'Platinum', need: DEFAULT_SETTINGS.vip_platinum_threshold - pts }
    return null
  })()

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        backgroundColor: '#181818', border: `1px solid ${GOLD}44`,
        borderRadius: 18, width: '100%', maxWidth: 520,
        maxHeight: '92vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: birthday ? `linear-gradient(135deg, ${GOLD}08, transparent)` : undefined,
        }}>
          {birthday && (
            <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, marginBottom: 8, letterSpacing: '0.5px' }}>
              🎂 วันเกิดวันนี้! — ส่วนลดพิเศษ {DEFAULT_SETTINGS.birthday_discount_percent}%
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              backgroundColor: `${tierColor}22`, border: `2px solid ${tierColor}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: tierColor, flexShrink: 0,
            }}>
              {(c.name ?? '?')[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{c.name ?? '—'}</span>
                <VipBadge tier={c.vip_tier} size="md" />
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                {c.phone ?? '—'} {c.email ? `· ${c.email}` : ''} · {fmtLastVisit(c.last_visit)}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 22, cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div style={{ padding: '14px 24px', display: 'flex', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <StatCard label="คะแนน" value={c.loyalty_points.toLocaleString()} sub={pointsToNextTier ? `อีก ${pointsToNextTier.need} pts → ${pointsToNextTier.label}` : '🏆 Platinum'} color={GOLD} />
          <StatCard label="ยอดรวม" value={(c.lifetime_spend_lak ?? 0).toLocaleString()} sub="LAK" />
          <StatCard label="ครั้งที่มา" value={String(c.visit_count ?? 0)} sub="ครั้ง" />
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px' }}>
          {(['profile', 'orders', 'loyalty'] as const).map(t => {
            const labels = { profile: 'โปรไฟล์', orders: 'ออเดอร์', loyalty: 'คะแนน' }
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '12px 16px', background: 'none', border: 'none',
                borderBottom: tab === t ? `2px solid ${GOLD}` : '2px solid transparent',
                color: tab === t ? GOLD : 'rgba(255,255,255,0.4)',
                fontSize: 13, fontWeight: tab === t ? 700 : 400,
                cursor: 'pointer', transition: 'all 0.15s', marginBottom: -1,
              }}>{labels[t]}</button>
            )
          })}
        </div>

        {/* ── Tab content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>

          {tab === 'profile' && (
            editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><Label>ชื่อ</Label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} /></div>
                  <div><Label>เบอร์โทร</Label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} /></div>
                  <div><Label>อีเมล</Label><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} type="email" /></div>
                  <div><Label>วันเกิด</Label><input value={form.birthday} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} style={inputStyle} type="date" /></div>
                </div>
                <div><Label>หมายเหตุ</Label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} /></div>
                {err && <div style={{ fontSize: 12, color: RED }}>{err}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleSave} disabled={saving} style={{ flex: 1, height: 44, borderRadius: 10, border: 'none', backgroundColor: GOLD, color: '#000', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'บันทึก...' : 'บันทึก'}
                  </button>
                  <button onClick={() => setEditing(false)} style={{ flex: 1, height: 44, borderRadius: 10, border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>ยกเลิก</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {([
                    ['ชื่อ', c.name],
                    ['เบอร์โทร', c.phone],
                    ['อีเมล', c.email],
                    ['วันเกิด', c.birthday ? new Date(c.birthday).toLocaleDateString('th-TH', { day: 'numeric', month: 'long' }) : null],
                    ['สัญชาติ', c.nationality],
                    ['ภาษา', c.language_pref],
                  ] as [string, string | null][]).map(([lbl, val]) => (
                    <div key={lbl}>
                      <Label>{lbl}</Label>
                      <div style={{ fontSize: 14, color: val ? '#fff' : 'rgba(255,255,255,0.2)' }}>{val ?? '—'}</div>
                    </div>
                  ))}
                </div>
                {c.tags && c.tags.length > 0 && (
                  <div>
                    <Label>แท็ก</Label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {c.tags.map(t => (
                        <span key={t} style={{ padding: '3px 10px', borderRadius: 99, backgroundColor: `${GOLD}14`, border: `1px solid ${GOLD}44`, color: GOLD, fontSize: 12 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {c.notes && (
                  <div>
                    <Label>หมายเหตุ</Label>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{c.notes}</div>
                  </div>
                )}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                  <button onClick={() => setEditing(true)} style={{
                    padding: '9px 20px', borderRadius: 9, cursor: 'pointer',
                    border: `1px solid ${BORDER}`, backgroundColor: 'transparent',
                    color: 'rgba(255,255,255,0.5)', fontSize: 13,
                  }}>แก้ไขข้อมูล</button>
                </div>
              </div>
            )
          )}

          {tab === 'orders' && (
            loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: 54, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s infinite' }} />)}
              </div>
            ) : orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)' }}>ยังไม่มีออเดอร์</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {orders.map(o => (
                  <div key={o.id} style={{ padding: '11px 14px', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                        #{String(o.queue_number ?? '?').padStart(3, '0')}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                        {new Date(o.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>
                        {(o.total_lak ?? 0).toLocaleString()} ₭
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'loyalty' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: 50, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s infinite' }} />)
              ) : txns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)' }}>ยังไม่มีประวัติคะแนน</div>
              ) : (
                txns.map(t => {
                  const isEarn = t.type === 'earn'
                  return (
                    <div key={t.id} style={{ padding: '11px 14px', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{t.description ?? t.type}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                          {new Date(t.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: isEarn ? GREEN : RED, fontVariantNumeric: 'tabular-nums' }}>
                        {isEarn ? '+' : ''}{t.points.toLocaleString()} pts
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
