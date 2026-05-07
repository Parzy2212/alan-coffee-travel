import React from 'react'

type Role = 'owner' | 'manager' | 'cashier' | 'viewer'

const CONFIG: Record<Role, { label: string; icon: string; bg: string; color: string; border: string }> = {
  owner:   { label: 'เจ้าของ',   icon: '👑', bg: 'rgba(201,168,76,0.15)',  color: '#c9a84c',  border: 'rgba(201,168,76,0.35)'  },
  manager: { label: 'ผู้จัดการ', icon: '🔧', bg: 'rgba(99,179,237,0.12)',  color: '#63b3ed',  border: 'rgba(99,179,237,0.3)'   },
  cashier: { label: 'แคชเชียร์', icon: '💼', bg: 'rgba(72,187,120,0.12)',  color: '#48bb78',  border: 'rgba(72,187,120,0.3)'   },
  viewer:  { label: 'ผู้ดู',     icon: '👁️', bg: 'rgba(160,174,192,0.12)', color: '#a0aec0',  border: 'rgba(160,174,192,0.25)' },
}

interface RoleBadgeProps {
  role: string
  size?: 'sm' | 'md'
}

export function RoleBadge({ role, size = 'md' }: RoleBadgeProps) {
  const c = CONFIG[role as Role] ?? CONFIG.viewer
  const fontSize = size === 'sm' ? 11 : 12
  const padding  = size === 'sm' ? '2px 7px' : '3px 9px'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding, borderRadius: 6,
      backgroundColor: c.bg,
      border: `1px solid ${c.border}`,
      color: c.color,
      fontSize, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: fontSize - 1 }}>{c.icon}</span>
      {c.label}
    </span>
  )
}
