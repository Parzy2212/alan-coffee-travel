'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { parseUserAgent } from '@/lib/user-agent-parser'
import { logAccountEvent } from '@/lib/account-events'

const GOLD = '#c9a84c'
const CARD: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: 24,
  marginBottom: 24,
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'เมื่อสักครู่'
  if (m < 60) return `${m} นาทีที่แล้ว`
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`
  return `${d} วันที่แล้ว`
}

export function SessionsSection() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [parsed, setParsed] = useState<{ browser: string; os: string; deviceType: string } | null>(null)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [revoking, setRevoking] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setParsed(parseUserAgent(navigator.userAgent))
    }
    if (user?.last_sign_in_at) setLastSeen(user.last_sign_in_at)
  }, [user])

  const handleRevokeAll = async () => {
    setRevoking(true)
    try {
      await logAccountEvent('sessions_revoked')
      const { authClient } = await import('@/lib/supabase-auth')
      await authClient.auth.signOut({ scope: 'global' })
      router.replace('/login')
    } catch {
      setRevoking(false)
      setShowConfirm(false)
    }
  }

  const deviceIcon = parsed?.deviceType === 'mobile' ? '📱' : '💻'

  return (
    <>
      <div style={CARD}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>เซสชันที่ใช้งานอยู่</div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>อุปกรณ์ที่ลงชื่อเข้าใช้บัญชีของคุณ</div>
        </div>

        {/* Current session row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
          <div style={{ fontSize: 24, flexShrink: 0 }}>{deviceIcon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
              {parsed ? `${parsed.browser} บน ${parsed.os}` : 'อุปกรณ์ปัจจุบัน'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
              {lastSeen ? `ใช้งานล่าสุด ${timeAgo(lastSeen)}` : 'กำลังใช้งาน'}
            </div>
          </div>
          <div style={{ flexShrink: 0, padding: '4px 10px', backgroundColor: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 20, color: GOLD, fontSize: 11, fontWeight: 600 }}>
            เซสชันปัจจุบัน
          </div>
        </div>

        {/* Revoke button */}
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowConfirm(true)}
            style={{
              padding: '9px 18px',
              backgroundColor: 'rgba(255,77,77,0.06)',
              border: '1px solid rgba(255,77,77,0.2)',
              borderRadius: 8, color: 'rgba(255,120,120,0.8)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,77,77,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255,77,77,0.06)')}
          >
            ออกจากระบบทุกอุปกรณ์
          </button>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '28px 28px', maxWidth: 380, width: '100%' }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⚠️</div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>ออกจากระบบทุกอุปกรณ์?</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              คุณจะถูกออกจากระบบจากทุกอุปกรณ์ รวมถึงอุปกรณ์นี้ด้วย
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ flex: 1, padding: '11px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleRevokeAll}
                disabled={revoking}
                style={{ flex: 1, padding: '11px', backgroundColor: revoking ? 'rgba(255,77,77,0.3)' : 'rgba(255,77,77,0.85)', border: 'none', borderRadius: 9, color: 'white', fontSize: 14, fontWeight: 700, cursor: revoking ? 'wait' : 'pointer', fontFamily: 'inherit' }}
              >
                {revoking ? 'กำลังออก...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
