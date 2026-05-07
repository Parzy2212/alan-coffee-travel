'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const CARD: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: 24,
  marginBottom: 24,
}

interface AccountEvent {
  id: string
  event_type: string
  description: string | null
  created_at: string
}

const EVENT_CONFIG: Record<string, { icon: string; label: string }> = {
  login:            { icon: '🔓', label: 'เข้าสู่ระบบ'       },
  logout:           { icon: '🔒', label: 'ออกจากระบบ'         },
  password_changed: { icon: '🔑', label: 'เปลี่ยนรหัสผ่าน'   },
  password_reset:   { icon: '🔓', label: 'รีเซ็ตรหัสผ่าน'    },
  profile_updated:  { icon: '👤', label: 'อัปเดตโปรไฟล์'     },
  sessions_revoked: { icon: '🔒', label: 'ออกจากทุกอุปกรณ์'  },
  account_deleted:  { icon: '⚠️', label: 'ลบบัญชี'           },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'เมื่อสักครู่'
  if (m < 60) return `${m} นาทีที่แล้ว`
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`
  if (d < 30) return `${d} วันที่แล้ว`
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

export function ActivitySection() {
  const { user } = useAuth()
  const [events, setEvents] = useState<AccountEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { authClient } = await import('@/lib/supabase-auth')
      const { data } = await authClient
        .from('account_events')
        .select('id, event_type, description, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10)
      setEvents(data ?? [])
      setLoading(false)
    }
    load()
  }, [user])

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>กิจกรรมล่าสุด</div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>10 รายการล่าสุด</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 48, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }`}</style>
        </div>
      ) : events.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
          ยังไม่มีกิจกรรม
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {events.map((ev, i) => {
            const cfg = EVENT_CONFIG[ev.event_type] ?? { icon: '•', label: ev.event_type }
            return (
              <div
                key={ev.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 8,
                  backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
              >
                <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{cfg.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 500 }}>{cfg.label}</div>
                  {ev.description && (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.description}
                    </div>
                  )}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, flexShrink: 0 }}>{timeAgo(ev.created_at)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
