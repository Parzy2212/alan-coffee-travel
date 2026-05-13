'use client'

import type { Customer } from '@/lib/customers'
import { isBirthdayToday, fmtLastVisit, TIER_META } from '@/lib/loyalty'
import { VipBadge } from './VipBadge'

const GOLD  = '#c9a84c'
const GREEN = '#4cba7f'

function Avatar({ name, tier }: { name: string | null; tier: Customer['vip_tier'] }) {
  const { color } = TIER_META[tier]
  const bg = tier === 'regular' ? `${GOLD}22` : `${color}22`
  const fg = tier === 'regular' ? GOLD : color
  const letter = (name ?? '?')[0]?.toUpperCase() ?? '?'
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
      backgroundColor: bg, border: `1px solid ${fg}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, fontWeight: 700, color: fg,
    }}>
      {letter}
    </div>
  )
}

export interface CustomerCardProps {
  customer: Customer
  onClick?: () => void
}

export function CustomerCard({ customer: c, onClick }: CustomerCardProps) {
  const birthday = isBirthdayToday(c.birthday)

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter') onClick() } : undefined}
      style={{
        padding: '14px 16px', borderRadius: 14,
        backgroundColor: '#1a1a1a',
        border: birthday ? `1px solid ${GOLD}55` : '1px solid rgba(255,255,255,0.07)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = `${GOLD}44` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = birthday ? `${GOLD}55` : 'rgba(255,255,255,0.07)' }}
    >
      {birthday && (
        <div style={{
          fontSize: 10, fontWeight: 700, color: GOLD,
          letterSpacing: '1px', textTransform: 'uppercase',
          marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          🎂 วันเกิดวันนี้!
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={c.name} tier={c.vip_tier} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{c.name ?? '—'}</span>
            <VipBadge tier={c.vip_tier} />
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {c.phone ?? '—'} · ครั้งล่าสุด: {fmtLastVisit(c.last_visit)}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
            {c.loyalty_points.toLocaleString()}
            <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 3 }}>pts</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>
            {(c.lifetime_spend_lak ?? 0).toLocaleString()} ₭ · {c.visit_count ?? 0} ครั้ง
          </div>
          {c.loyalty_points > 0 && (
            <div style={{ fontSize: 10, color: GREEN, marginTop: 2 }}>
              ≈ {Math.floor(c.loyalty_points / 10).toLocaleString()} ₭ ส่วนลด
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
