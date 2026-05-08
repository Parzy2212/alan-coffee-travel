'use client'

import { EVENT_TYPES } from './ActivityFilters'

export type AccountEvent = {
  id: string
  event_type: string
  description: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

const EVENT_MAP = Object.fromEntries(EVENT_TYPES.map(t => [t.value, t]))

const EVENT_COLORS: Record<string, string> = {
  login:                    '#4cba7f',
  logout:                   'rgba(255,255,255,0.4)',
  password_changed:         '#c9a84c',
  password_reset:           '#c9a84c',
  profile_updated:          '#5b9cf6',
  sessions_revoked:         '#ff9933',
  shop_settings_updated:    '#5b9cf6',
  team_invitation_sent:     '#a78bfa',
  team_invitation_accepted: '#4cba7f',
  account_deleted:          '#ff6b6b',
}

function parseUA(ua: string | null): string {
  if (!ua) return ''
  if (/iPhone|iPad/.test(ua)) return 'iOS'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Linux/.test(ua)) return 'Linux'
  return ''
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane' })
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function dayLabel(key: string): string {
  const d = new Date(key)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.getTime() === today.getTime()) return 'วันนี้'
  if (d.getTime() === yesterday.getTime()) return 'เมื่อวาน'
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Vientiane' })
}

interface Props {
  events: AccountEvent[]
  page: number
  pageSize: number
}

export function ActivityTimeline({ events, page, pageSize }: Props) {
  const pageEvents = events.slice(page * pageSize, (page + 1) * pageSize)

  if (events.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>ไม่พบกิจกรรมในช่วงนี้</div>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>ลองเปลี่ยนช่วงเวลาหรือประเภทกิจกรรม</div>
      </div>
    )
  }

  // Group by day
  const groups: { key: string; events: AccountEvent[] }[] = []
  const seen = new Map<string, number>()
  for (const ev of pageEvents) {
    const k = dayKey(ev.created_at)
    if (!seen.has(k)) { seen.set(k, groups.length); groups.push({ key: k, events: [] }) }
    groups[seen.get(k)!].events.push(ev)
  }

  return (
    <div>
      {groups.map(g => (
        <div key={g.key} style={{ marginBottom: 24 }}>
          {/* Date header */}
          <div style={{
            fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 8,
            paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            {dayLabel(g.key)}
          </div>

          {/* Events */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {g.events.map(ev => {
              const cfg = EVENT_MAP[ev.event_type] ?? { icon: '•', label: ev.event_type }
              const color = EVENT_COLORS[ev.event_type] ?? 'rgba(255,255,255,0.4)'
              const device = parseUA(ev.user_agent)
              return (
                <div key={ev.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '10px 12px', borderRadius: 8,
                  transition: 'background-color 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    backgroundColor: color + '18', border: `1px solid ${color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}>
                    {cfg.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500 }}>{cfg.label}</span>
                      {device && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>{device}</span>}
                    </div>
                    {ev.description && (
                      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.description}
                      </div>
                    )}
                    {ev.ip_address && (
                      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 2, fontFamily: 'monospace' }}>
                        {ev.ip_address}
                      </div>
                    )}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, flexShrink: 0, paddingTop: 1 }}>
                    {formatTime(ev.created_at)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
