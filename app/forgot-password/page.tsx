'use client'

import { useState, useEffect, useRef } from 'react'

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

const COOLDOWN_SECS = 60

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECS)
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || loading || cooldown > 0) return
    setLoading(true)

    try {
      const { authClient } = await import('@/lib/supabase-auth')
      await authClient.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/account/reset-password`,
      })
    } catch { /* always show success — never reveal if email exists */ }

    setLoading(false)
    setSubmitted(true)
    startCooldown()
  }

  const handleResend = async () => {
    if (cooldown > 0 || loading) return
    setLoading(true)
    try {
      const { authClient } = await import('@/lib/supabase-auth')
      await authClient.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/account/reset-password`,
      })
    } catch { /* non-fatal */ }
    setLoading(false)
    startCooldown()
  }

  return (
    <main style={{
      minHeight: '100vh', backgroundColor: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '20px',
    }}>
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
        width: '100%', maxWidth: 420,
        backgroundColor: '#111',
        border: '1px solid rgba(201,168,76,0.15)',
        borderRadius: 20, padding: '40px 36px',
      }}>
        {!submitted ? (
          <>
            <h1 style={{ color: 'white', fontWeight: 800, fontSize: 24, marginBottom: 6, fontFamily: 'var(--font-heading)' }}>
              ลืมรหัสผ่าน?
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
              ใส่อีเมลที่ใช้สมัคร เราจะส่งลิงก์รีเซ็ตไปให้
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
                  autoFocus
                  style={inp}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                style={{
                  marginTop: 4,
                  backgroundColor: loading || !email.trim() ? 'rgba(201,168,76,0.4)' : GOLD,
                  color: '#000', border: 'none', borderRadius: 10,
                  padding: '14px', fontSize: 15, fontWeight: 700,
                  cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.15s', fontFamily: 'inherit',
                }}
              >
                {loading ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ต'}
              </button>
            </form>
          </>
        ) : (
          /* Success state */
          <div style={{ textAlign: 'center' }}>
            {/* Animated envelope icon */}
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: 'rgba(201,168,76,0.1)',
              border: '2px solid rgba(201,168,76,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              animation: 'popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>✉</span>
            </div>
            <style>{`@keyframes popIn { from { opacity:0; transform:scale(0.7); } to { opacity:1; transform:scale(1); } }`}</style>

            <h2 style={{ color: 'white', fontWeight: 800, fontSize: 20, fontFamily: 'var(--font-heading)', marginBottom: 12 }}>
              ตรวจสอบอีเมลของคุณ
            </h2>

            <div style={{
              backgroundColor: 'rgba(76,186,127,0.06)',
              border: '1px solid rgba(76,186,127,0.2)',
              borderRadius: 12, padding: '16px 18px',
              marginBottom: 20, textAlign: 'left',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                ถ้าอีเมลนี้มีในระบบ เราได้ส่งลิงก์รีเซ็ตให้แล้ว
                <br />
                กรุณาตรวจสอบ <strong style={{ color: 'rgba(255,255,255,0.9)' }}>inbox</strong> และ <strong style={{ color: 'rgba(255,255,255,0.9)' }}>spam folder</strong>
                <br />
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>ลิงก์จะหมดอายุใน 1 ชั่วโมง</span>
              </p>
            </div>

            {/* Resend button with cooldown */}
            <button
              onClick={handleResend}
              disabled={cooldown > 0 || loading}
              style={{
                width: '100%', padding: '13px',
                backgroundColor: cooldown > 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${cooldown > 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 10,
                color: cooldown > 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)',
                fontSize: 14, fontWeight: 600,
                cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'all 0.15s',
                marginBottom: 16,
              }}
            >
              {cooldown > 0
                ? `ส่งใหม่ได้ในอีก ${cooldown} วินาที`
                : loading ? 'กำลังส่ง...' : 'ส่งใหม่อีกครั้ง'}
            </button>
          </div>
        )}

        {/* Back link */}
        <div style={{ marginTop: submitted ? 0 : 24, textAlign: 'center' }}>
          <a
            href="/login"
            style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textDecoration: 'none', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
          >
            &larr; กลับไปเข้าสู่ระบบ
          </a>
        </div>
      </div>
    </main>
  )
}
