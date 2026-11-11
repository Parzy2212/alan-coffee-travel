'use client'

import { usePathname } from 'next/navigation'
import { APP_NAV, cafeTabOf } from '@/lib/app-nav'
import { useSoloMode } from '@/lib/solo-mode'

const GOLD = '#c9a84c'

export function AppNav({ currentTab, onCafeTab }: {
  currentTab?: string
  onCafeTab?: (tab: string) => void
}) {
  const pathname = usePathname()
  const { solo } = useSoloMode()

  const groups = APP_NAV
    .map(g => ({ ...g, items: solo ? g.items.filter(i => !i.soloHidden) : g.items }))
    .filter(g => g.items.length > 0)

  return (
    <nav aria-label="เมนูหลัก" style={{ display: 'flex', flexDirection: 'column', padding: '0 12px' }}>
      {groups.map((group, gi) => (
        <div key={group.label}>
          {gi > 0 && <div style={{ height: 1, backgroundColor: `${GOLD}20`, margin: group.module ? '12px 2px 4px' : '6px 2px 4px' }} />}
          <div style={{ fontSize: 10, color: group.module ? 'rgba(255,255,255,0.35)' : `${GOLD}88`, textTransform: 'uppercase', letterSpacing: '1.5px', padding: '6px 14px 2px', fontWeight: 600, userSelect: 'none' }}>
            {group.label}
          </div>
          {group.items.map(item => {
            const tab = cafeTabOf(item.href)
            const active = tab ? pathname === '/cafe' && (currentTab ?? 'dashboard') === tab : pathname === item.href
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={e => {
                  if (tab && onCafeTab) { e.preventDefault(); onCafeTab(tab) }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', borderRadius: 8, textDecoration: 'none',
                  backgroundColor: active ? `${GOLD}18` : 'transparent',
                  color: active ? GOLD : 'rgba(255,255,255,0.55)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                }}
              >
                <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </a>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
