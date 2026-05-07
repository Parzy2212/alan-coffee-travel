'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getInvitationDetails } from '@/lib/invitations'

const GOLD = '#c9a84c'

const inp: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '14px 16px',
  color: 'white',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
}

export default function LoginPage() {
  const { signIn, session, loading: authLoading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [inviteToken, setInviteToken] = useState('')
  const [inviteShopName, setInviteShopName] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reset') === 'success') {
      setResetSuccess(true)
      toastTimer.current = setTimeout(() => setResetSuccess(false), 5000)
    }
    const t = params.get('invite') ?? ''
    if (!t) return
    setInviteToken(t)
    getInvitationDetails(t).then(details => {
      if (details.found && details.shop_name) setInviteShopName(details.shop_name)
    })
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

  useEffect(() => {
    if (!authLoading && session) {
      router.replace(inviteToken ? `/accept-invite?token=${encodeURIComponent(inviteToken)}` : '/cafe')
    }
  }, [session, authLoading, router, inviteToken])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.includes('Invalid') ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error)
      setLoading(false)
    } else {
      router.replace(inviteToken ? `/accept-invite?token=${encodeURIComponent(inviteToken)}` : '/cafe')
    }
  }

  const signupHref = inviteToken ? `/signup?invite=${encodeURIComponent(inviteToken)}` : '/signup'

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: GOLD, fontFamily: 'var(--font-heading)', letterSpacing: '-0.5px' }}>
            ALAN
            <span style={{ color: 'rgba(201,168,76,0.5)', fontSize: 13, letterSpacing: '3px', fontWeight: 600, marginLeft: 10 }}>CafeOS</span>
          </div>
        </a>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6 }}>ระบบจัดการร้านกาแฟ</p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#111',
        border: '1px solid rgba(201,168,76,0.15)',
        borderRadius: 20,
        padding: '40px 36px',
      }}>
        {resetSuccess && (
          <div style={{
            backgroundColor: 'rgba(76,186,127,0.08)',
            border: '1px solid rgba(76,186,127,0.25)',
            borderRadius: 10, padding: '12px 16px',
            marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ color: '#4cba7f', fontSize: 16, flexShrink: 0 }}>✓</span>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.4 }}>
              รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่
            </span>
          </div>
        )}

        {/* Invite banner */}
        {inviteShopName && (
          <div style={{ backgroundColor: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>✉️</span>
            <div>
              <div style={{ color: GOLD, fontSize: 13, fontWeight: 600 }}>คุณได้รับคำเชิญ</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
                เข้าสู่ระบบเพื่อเข้าร่วมทีมที่ <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{inviteShopName}</span>
              </div>
            </div>
          </div>
        )}

        <h1 style={{ color: 'white', fontWeight: 800, fontSize: 24, marginBottom: 6, fontFamily: 'var(--font-heading)' }}>
          เข้าสู่ระบบ
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 28 }}>
          {inviteShopName ? `เข้าสู่ระบบเพื่อตอบรับคำเชิญ` : 'เข้าสู่แดชบอร์ดร้านค้าของคุณ'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
              อีเมล
            </label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={inp}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px' }}>
                รหัสผ่าน
              </label>
              <a
                href="/forgot-password"
                style={{ color: 'rgba(201,168,76,0.45)', fontSize: 12, textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(201,168,76,0.75)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(201,168,76,0.45)')}
              >
                ลืมรหัสผ่าน?
              </a>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={inp}
            />
          </div>

          {error && (
            <div style={{ backgroundColor: 'rgba(255,77,77,0.1)', border: '1px solid rgba(255,77,77,0.25)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              marginTop: 4,
              backgroundColor: loading ? 'rgba(201,168,76,0.5)' : GOLD,
              color: '#000',
              border: 'none',
              borderRadius: 10,
              padding: '14px',
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.15s',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          ยังไม่มีบัญชี?{' '}
          <a href={signupHref} style={{ color: GOLD, textDecoration: 'none', fontWeight: 600 }}>
            สมัครสมาชิก
          </a>
        </div>
      </div>

      {/* Back to site */}
      <a href="/" style={{ marginTop: 24, color: 'rgba(255,255,255,0.2)', fontSize: 12, textDecoration: 'none' }}>
        ← กลับหน้าหลัก
      </a>
    </main>
  )
}
