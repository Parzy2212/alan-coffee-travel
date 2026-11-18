'use client'

import { useEffect, useRef, useState } from 'react'
import type { PosCustomer } from '@/lib/customers'
import { findCustomerByPhone } from '@/lib/customers'
import { VipBadge } from '@/components/customers/VipBadge'
import { AddCustomerModal } from '@/components/customers/AddCustomerModal'

const GOLD   = '#c9a84c'
const BORDER = 'rgba(255,255,255,0.1)'
const RED    = '#ff6b6b'

export interface CustomerSelectorProps {
  shopId?: string | null
  onSelect: (c: PosCustomer) => void
  onClose: () => void
}

export function CustomerSelector({ shopId, onSelect, onClose }: CustomerSelectorProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const [q,         setQ]         = useState('')
  const [customers, setCustomers] = useState<PosCustomer[]>([])
  const [loading,   setLoading]   = useState(false)
  const [searched,  setSearched]  = useState(false)
  const [err,       setErr]       = useState('')
  const [showAdd,   setShowAdd]   = useState(false)

  // Auto-focus search
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80) }, [])

  // Full phone number only (owner decision 2026-11-18): the POS has no login, so a partial
  // search would let anyone with the public key list every customer.
  async function doSearch() {
    if (q.replace(/\D/g, '').length < 8) { setErr('พิมพ์เบอร์โทรให้ครบ'); return }
    setLoading(true); setErr('')
    try {
      const c = await findCustomerByPhone(q)
      setCustomers(c ? [c] : [])
      setSearched(true)
    } catch (e) {
      setCustomers([]); setSearched(false)
      setErr(e instanceof Error ? e.message : 'ค้นหาลูกค้าไม่สำเร็จ')
    }
    setLoading(false)
  }

  function handleInput(val: string) {
    setQ(val); setSearched(false); setErr(''); setCustomers([])
  }

  return (
    <>
      <div
        ref={overlayRef}
        onClick={e => { if (e.target === overlayRef.current) onClose() }}
        style={{
          position: 'fixed', inset: 0, zIndex: 500,
          backgroundColor: 'rgba(0,0,0,0.82)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '64px 16px 16px',
        }}
      >
        <div style={{
          backgroundColor: '#181818', border: `1px solid ${GOLD}44`,
          borderRadius: 18, width: '100%', maxWidth: 440,
          maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        }}>
          {/* Header */}
          <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>เลือกลูกค้า</div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 22, cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); void doSearch() }} style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                value={q}
                onChange={e => handleInput(e.target.value)}
                inputMode="tel"
                aria-label="เบอร์โทรลูกค้า"
                placeholder="พิมพ์เบอร์โทรลูกค้าให้ครบ"
                style={{
                  flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: 10,
                  border: `1px solid ${BORDER}`, backgroundColor: '#0f0f0f',
                  color: '#fff', fontSize: 14, boxSizing: 'border-box',
                }}
              />
              <button type="submit" disabled={loading} style={{
                padding: '0 16px', borderRadius: 10, border: 'none', backgroundColor: GOLD,
                color: '#000', fontWeight: 700, fontSize: 14, cursor: loading ? 'default' : 'pointer',
              }}>ค้นหา</button>
            </form>
            {err && <div role="alert" style={{ color: RED, fontSize: 12, marginTop: 8 }}>{err}</div>}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: 58, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
              ))
            ) : customers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'rgba(255,255,255,0.4)' }}>
                {searched
                  ? <>ไม่พบลูกค้าเบอร์นี้<div style={{ marginTop: 8, fontSize: 12 }}>กด &quot;+ เพิ่มลูกค้าใหม่&quot; ด้านล่าง</div></>
                  : 'พิมพ์เบอร์ครบแล้วกดค้นหา'}
              </div>
            ) : (
              customers.map(c => (
                <button
                  key={c.id}
                  onClick={() => { onSelect(c); onClose() }}
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.06)',
                    backgroundColor: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5,
                    transition: 'background-color 0.12s', textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    backgroundColor: `${GOLD}22`, border: `1px solid ${GOLD}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: GOLD,
                  }}>
                    {(c.name ?? '?')[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{c.name ?? '—'}</span>
                      <VipBadge tier={c.vip_tier} />
                    </div>
                  </div>

                  {/* Points */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
                      {c.loyalty_points.toLocaleString()}
                      <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 2 }}>pts</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button
              onClick={() => setShowAdd(true)}
              style={{
                width: '100%', height: 46, borderRadius: 12,
                border: `1px solid ${GOLD}44`, backgroundColor: `${GOLD}0f`,
                color: GOLD, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${GOLD}1e` }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = `${GOLD}0f` }}
            >
              + เพิ่มลูกค้าใหม่
            </button>
          </div>
        </div>
      </div>

      {showAdd && (
        <AddCustomerModal
          shopId={shopId}
          initialPhone={q}
          onSave={c => { onSelect(c); onClose() }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  )
}
