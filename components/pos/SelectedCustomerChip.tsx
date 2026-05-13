'use client'

import type { Customer } from '@/lib/customers'
import { VipBadge } from '@/components/customers/VipBadge'
import { isBirthdayToday } from '@/lib/loyalty'

const GOLD = '#c9a84c'

export function SelectedCustomerChip({
  customer,
  onRemove,
  onClick,
}: {
  customer: Customer
  onRemove: () => void
  onClick?: () => void
}) {
  const birthday = isBirthdayToday(customer.birthday)

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px 8px 12px',
        borderRadius: 12,
        border: birthday ? `1px solid ${GOLD}` : `1px solid ${GOLD}55`,
        backgroundColor: birthday ? `${GOLD}18` : `${GOLD}0c`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.backgroundColor = `${GOLD}20` }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = birthday ? `${GOLD}18` : `${GOLD}0c` }}
    >
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        backgroundColor: `${GOLD}33`, border: `1px solid ${GOLD}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: GOLD,
      }}>
        {(customer.name ?? '?')[0]?.toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {birthday ? '🎂 ' : ''}
            {customer.name ?? customer.phone ?? '—'}
          </span>
          <VipBadge tier={customer.vip_tier} />
        </div>
        <div style={{ fontSize: 10, color: `${GOLD}cc`, fontVariantNumeric: 'tabular-nums' }}>
          {customer.loyalty_points.toLocaleString()} pts
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        aria-label="ลบลูกค้า"
        style={{
          background: 'none', border: 'none', padding: '2px 4px',
          color: 'rgba(255,255,255,0.4)', fontSize: 16, cursor: 'pointer',
          lineHeight: 1, flexShrink: 0,
        }}
      >×</button>
    </div>
  )
}
