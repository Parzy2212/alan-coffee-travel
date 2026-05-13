'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Customer } from '@/lib/customers'
import { searchCustomers, redeemPoints } from '@/lib/customers'
import { isBirthdayToday } from '@/lib/loyalty'
import { CustomerCard } from '@/components/customers/CustomerCard'
import { CustomerDetailModal } from '@/components/customers/CustomerDetailModal'
import { AddCustomerModal } from '@/components/customers/AddCustomerModal'
import { SearchAndFilter } from '@/components/customers/SearchAndFilter'
import type { CustomerFilter, CustomerSort } from '@/components/customers/SearchAndFilter'
import { useShop } from '@/lib/use-shop'

const GOLD       = '#c9a84c'
const GREEN      = '#4cba7f'
const RED        = '#ff6b6b'
const BORDER     = 'rgba(255,255,255,0.1)'
const POINTS_RATE  = 100
const POINTS_VALUE = 5000

export function CustomersTab() {
  const { shopId } = useShop()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState<CustomerFilter>('all')
  const [sort,      setSort]      = useState<CustomerSort>('recent')
  const [loading,   setLoading]   = useState(false)
  const [detail,    setDetail]    = useState<Customer | null>(null)
  const [showAdd,   setShowAdd]   = useState(false)

  const [redeemCustomer, setRedeemCustomer] = useState<Customer | null>(null)
  const [redeemPts,      setRedeemPts]      = useState('')
  const [redeemMsg,      setRedeemMsg]      = useState('')
  const [redeeming,      setRedeeming]      = useState(false)
  const [redeemHistory,  setRedeemHistory]  = useState<{ name: string; pts: number; lak: number; time: string }[]>([])

  const load = useCallback(async (q = '') => {
    setLoading(true)
    const data = await searchCustomers(q, 100)
    setCustomers(data)
    setLoading(false)
  }, [])

  useEffect(() => { void load('') }, [load])

  const displayed = useMemo(() => {
    let list = [...customers]

    // filter
    if (filter === 'vip')      list = list.filter(c => c.vip_tier !== 'regular')
    if (filter === 'regular')  list = list.filter(c => c.vip_tier === 'regular')
    if (filter === 'birthday') list = list.filter(c => isBirthdayToday(c.birthday))

    // sort
    if (sort === 'spend')  list.sort((a, b) => (b.lifetime_spend_lak ?? 0) - (a.lifetime_spend_lak ?? 0))
    if (sort === 'points') list.sort((a, b) => (b.loyalty_points ?? 0) - (a.loyalty_points ?? 0))
    if (sort === 'recent') list.sort((a, b) => (b.last_visit ?? b.created_at ?? '').localeCompare(a.last_visit ?? a.created_at ?? ''))

    return list
  }, [customers, filter, sort])

  async function redeemSubmit() {
    if (!redeemCustomer || !shopId) return
    const pts = parseInt(redeemPts)
    if (isNaN(pts) || pts <= 0)          { setRedeemMsg('กรอกจำนวนคะแนนที่ถูกต้อง'); return }
    if (pts % POINTS_RATE !== 0)          { setRedeemMsg(`คะแนนต้องเป็นทวีคูณของ ${POINTS_RATE}`); return }
    if (pts > redeemCustomer.loyalty_points) { setRedeemMsg('คะแนนไม่เพียงพอ'); return }
    setRedeeming(true); setRedeemMsg('')
    const lak = Math.floor(pts / POINTS_RATE) * POINTS_VALUE
    await redeemPoints(shopId, redeemCustomer, pts, `Redeemed ${pts} pts for ${lak.toLocaleString()} LAK discount`)
    setRedeemHistory(h => [{ name: redeemCustomer.name ?? redeemCustomer.phone ?? '?', pts, lak, time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }, ...h])
    setRedeemCustomer(null); setRedeemPts('')
    await load(search)
    setRedeeming(false)
  }

  const totalPts   = customers.reduce((s, c) => s + c.loyalty_points, 0)
  const vipCount   = customers.filter(c => c.vip_tier !== 'regular').length
  const bdayCount  = customers.filter(c => isBirthdayToday(c.birthday)).length

  return (
    <div>
      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'ลูกค้าทั้งหมด', value: customers.length },
          { label: 'VIP',           value: vipCount },
          { label: 'แต้มรวม',       value: totalPts.toLocaleString() },
          { label: 'วันเกิดวันนี้', value: bdayCount },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1, padding: '10px 14px', borderRadius: 12, backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
        <button onClick={() => setShowAdd(true)} style={{
          padding: '0 20px', borderRadius: 12, border: 'none',
          backgroundColor: GOLD, color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}>+ เพิ่มลูกค้า</button>
      </div>

      <SearchAndFilter
        search={search} filter={filter} sort={sort}
        onSearch={setSearch}
        onFilter={setFilter}
        onSort={setSort}
        onSubmit={() => void load(search)}
      />

      {/* Redemption history */}
      {redeemHistory.length > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 12, backgroundColor: `${GREEN}08`, border: `1px solid ${GREEN}22`, marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: GREEN, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>แลกคะแนน (session นี้)</div>
          {redeemHistory.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              <span>{r.time} · {r.name}</span>
              <span style={{ color: GREEN, fontWeight: 600 }}>-{r.pts} pts → +{r.lak.toLocaleString()} ₭</span>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ height: 76, borderRadius: 14, backgroundColor: '#1a1a1a', animation: 'pulse 1.5s infinite' }} />)}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.2)' }}>
          {filter === 'birthday' ? 'ไม่มีลูกค้าวันเกิดวันนี้' : 'ไม่พบลูกค้า'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayed.map(c => (
            <div key={c.id} style={{ position: 'relative' }}>
              <CustomerCard
                customer={c}
                onClick={() => setDetail(c)}
              />
              {/* Redeem button overlay */}
              <button
                onClick={e => { e.stopPropagation(); setRedeemCustomer(c); setRedeemPts(''); setRedeemMsg('') }}
                disabled={c.loyalty_points < POINTS_RATE}
                style={{
                  position: 'absolute', right: 14, bottom: 14,
                  padding: '4px 12px', borderRadius: 7,
                  border: `1px solid ${c.loyalty_points >= POINTS_RATE ? GREEN + '66' : BORDER}`,
                  backgroundColor: c.loyalty_points >= POINTS_RATE ? `${GREEN}12` : 'transparent',
                  color: c.loyalty_points >= POINTS_RATE ? GREEN : 'rgba(255,255,255,0.2)',
                  cursor: c.loyalty_points >= POINTS_RATE ? 'pointer' : 'default',
                  fontSize: 11, fontWeight: 600,
                }}>แลกคะแนน</button>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <CustomerDetailModal
          customer={detail}
          shopId={shopId}
          onClose={() => setDetail(null)}
          onUpdated={updated => {
            setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c))
            setDetail(updated)
          }}
        />
      )}

      {/* Add modal */}
      {showAdd && (
        <AddCustomerModal
          shopId={shopId}
          onSave={c => { setCustomers(prev => [c, ...prev]); setShowAdd(false) }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Redeem modal */}
      {redeemCustomer && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) { setRedeemCustomer(null); setRedeemPts('') } }}
        >
          <div style={{ width: '100%', maxWidth: 380, padding: 28, borderRadius: 18, backgroundColor: '#141414', border: `1px solid ${GOLD}44`, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: GOLD }}>แลกคะแนน</div>
            <div style={{ padding: '14px 16px', borderRadius: 12, backgroundColor: '#1a1a1a', border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{redeemCustomer.name ?? redeemCustomer.phone}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{redeemCustomer.loyalty_points.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 500 }}>pts</span></div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>อัตราแลก: {POINTS_RATE} pts = {POINTS_VALUE.toLocaleString()} ₭</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>จำนวนคะแนน (ทวีคูณของ {POINTS_RATE})</div>
              <input
                type="number" value={redeemPts} onChange={e => setRedeemPts(e.target.value)}
                step={POINTS_RATE} min={POINTS_RATE} max={redeemCustomer.loyalty_points}
                placeholder={String(POINTS_RATE)}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 9, border: `1px solid ${GOLD}44`, backgroundColor: '#0f0f0f', color: '#fff', fontSize: 16, fontWeight: 700, boxSizing: 'border-box' }}
              />
              {redeemPts && parseInt(redeemPts) > 0 && parseInt(redeemPts) % POINTS_RATE === 0 && (
                <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, backgroundColor: `${GREEN}10`, border: `1px solid ${GREEN}33`, fontSize: 13, color: GREEN, fontWeight: 600 }}>
                  ส่วนลด: {(Math.floor(parseInt(redeemPts) / POINTS_RATE) * POINTS_VALUE).toLocaleString()} ₭ · คงเหลือ: {redeemCustomer.loyalty_points - parseInt(redeemPts)} pts
                </div>
              )}
            </div>
            {redeemMsg && <div style={{ color: RED, fontSize: 13 }}>{redeemMsg}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => void redeemSubmit()} disabled={redeeming} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', backgroundColor: GREEN, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: redeeming ? 0.6 : 1 }}>
                {redeeming ? 'กำลังดำเนินการ...' : 'ยืนยันการแลก'}
              </button>
              <button onClick={() => { setRedeemCustomer(null); setRedeemPts('') }} style={{ padding: '11px 20px', borderRadius: 9, border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 13 }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
