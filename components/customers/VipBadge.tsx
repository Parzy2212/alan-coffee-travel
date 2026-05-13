'use client'

import { TIER_META } from '@/lib/loyalty'
import type { VipTier } from '@/lib/customers'

export function VipBadge({ tier, size = 'sm' }: { tier: VipTier; size?: 'sm' | 'md' }) {
  if (tier === 'regular') return null
  const { label, icon, color } = TIER_META[tier]
  const fs  = size === 'md' ? 12 : 10
  const pad = size === 'md' ? '3px 10px' : '2px 7px'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: pad, borderRadius: 99,
      border: `1px solid ${color}44`,
      backgroundColor: `${color}18`,
      color, fontSize: fs, fontWeight: 700,
      letterSpacing: '0.3px', lineHeight: 1.4,
      whiteSpace: 'nowrap',
    }}>
      {icon} {label}
    </span>
  )
}
