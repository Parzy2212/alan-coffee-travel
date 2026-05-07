'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'

const GOLD = '#c9a84c'

const inp: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '14px 44px 14px 16px',
  color: 'white',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
}

type Strength = 'weak' | 'medium' | 'strong'
type Status = 'loading' | 'ready' | 'invalid' | 'success'

function getStrength(pw: string): Strength {
  if (pw.length < 8) return 'weak'
  const hasLetter = /[a-zA-Z]/.test(pw)
  const hasNumber = /[0-9]/.test(pw)
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw)
  if (pw.length >= 12 && hasLetter && hasNumber && hasSymbol) return 'strong'
  if (hasLetter && hasNumber) return 'medium'
  return 'weak'
}

const STRENGTH_CONFIG = {
  weak:   { bars: 1, color: '#ff4d4d', label: 'ไม่ปลอดภัย' },
  medium: { bars: 2, color: '#f0b429', label: 'พอใช้'       },
  strong: { bars: 3, color: '#4cba7f', label: 'แข็งแกร่ง'  },
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('loading')
  const [recoverySession, setRecoverySession] = useState<Session | null>(null)

  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [showCf, setShowCf]         = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const strength = password ? getStrength(password) : null
  const mismatch = confirm.length > 0 && confirm !== password
  const canSubmit = password.length >= 8 && password === confirm && !saving

  // Supabase fires PASSWORD_RECOVERY event when the reset link is valid
  useEffect(() => {
    let cleanup: (() => void) | null = null
    const timeout = setTimeout(() => {
      setStatus(prev => prev === 'loading' ? 'invalid' : prev)
    }, 6000)

    import('@/lib/supabase-auth').then(({ authClient }) => {
      const { data: { subscription } } = authClient.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setRecoverySession(session)
          setStatus('ready')
          clearTimeout(timeout)
        }
      })
      cleanup = () => subscription.unsubscribe()
    })

    return () => {
      clearTimeout(timeout)
      cleanup?.()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')

    try {
      const { authClient } = await import('@/lib/supabase-auth')
      const { error: updateError } = await authClient.auth.updateUser({ password })

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      // Log event (non-fatal)
      if (recoverySession?.user) {
        try {
          await authClient.from('account_events').insert({
            user_id: recoverySession.user.id,
            event_type: 'password_reset',
          })
        } catch { /* non-fatal */ }
      }

      setStatus('success')
      setTimeout(() => router.replace('/login?reset=success'), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      setSaving(false)
    }
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

      <div style={{
        width: '100%', maxWidth: 420,
        backgroundColor: '#111',
        border: '1px solid rgba(201,168,76,0.15)',
        borderRadius: 20, padding: '40px 36px',
      }}>

        {/* Loading */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>กำลังตรวจสอบลิงก์...</div>
          </div>
        )}

        {/* Invalid link */}
        {status === 'invalid' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              backgroundColor: 'rgba(255,77,77,0.1)',
              border: '2px solid rgba(255,77,77,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 24,
            }}>✗</div>
            <h2 style={{ color: 'white', fontWeight: 800, fontSize: 20, fontFamily: 'var(--font-heading)', marginBottom: 10 }}>
              ลิงก์หมดอายุแล้ว
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              ลิงก์รีเซ็ตรหัสผ่านนี้ใช้ไม่ได้หรือหมดอายุแล้ว
              <br />กรุณาขอลิงก์ใหม่
            </p>
            <a
              href="/forgot-password"
              style={{
                display: 'block', padding: '13px',
                backgroundColor: GOLD, color: '#000',
                borderRadius: 10, textDecoration: 'none',
                fontSize: 15, fontWeight: 700, textAlign: 'center',
              }}
            >
              ขอลิงก์ใหม่
            </a>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <style>{`@keyframes popIn { from { opacity:0; transform:scale(0.7); } to { opacity:1; transform:scale(1); } }`}</style>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: 'rgba(76,186,127,0.1)',
              border: '2px solid rgba(76,186,127,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              animation: 'popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            }}>
              <span style={{ color: '#4cba7f', fontSize: 28, fontWeight: 800 }}>✓</span>
            </div>
            <h2 style={{ color: 'white', fontWeight: 800, fontSize: 20, fontFamily: 'var(--font-heading)', marginBottom: 8 }}>
              รีเซ็ตรหัสผ่านสำเร็จ
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>กำลังพาคุณไปหน้าเข้าสู่ระบบ...</p>
          </div>
        )}

        {/* Form */}
        {status === 'ready' && (
          <>
            <h1 style={{ color: 'white', fontWeight: 800, fontSize: 24, marginBottom: 6, fontFamily: 'var(--font-heading)' }}>
              ตั้งรหัสผ่านใหม่
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 28 }}>
              เลือกรหัสผ่านที่แข็งแกร่งและจำง่าย
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* New password */}
              <div>
                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                  รหัสผ่านใหม่
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                    style={inp}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{
                      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: 'inherit',
                      padding: '2px 4px',
                    }}
                  >
                    {showPw ? 'ซ่อน' : 'แสดง'}
                  </button>
                </div>

                {/* Strength meter */}
                {password.length > 0 && strength && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1, 2, 3].map(bar => (
                        <div
                          key={bar}
                          style={{
                            flex: 1, height: 3, borderRadius: 99,
                            backgroundColor: bar <= STRENGTH_CONFIG[strength].bars
                              ? STRENGTH_CONFIG[strength].color
                              : 'rgba(255,255,255,0.08)',
                            transition: 'background-color 0.2s',
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: STRENGTH_CONFIG[strength].color }}>
                      {STRENGTH_CONFIG[strength].label}
                      {strength === 'weak' && password.length > 0 && (
                        <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 6 }}>— ต้องอย่างน้อย 8 ตัวอักษร</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                  ยืนยันรหัสผ่าน
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCf ? 'text' : 'password'}
                    placeholder="ใส่รหัสผ่านอีกครั้ง"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    style={{
                      ...inp,
                      borderColor: mismatch ? 'rgba(255,77,77,0.5)' : 'rgba(255,255,255,0.1)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCf(v => !v)}
                    style={{
                      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: 'inherit',
                      padding: '2px 4px',
                    }}
                  >
                    {showCf ? 'ซ่อน' : 'แสดง'}
                  </button>
                </div>
                {mismatch && (
                  <div style={{ color: '#ff6b6b', fontSize: 12, marginTop: 5 }}>รหัสผ่านไม่ตรงกัน</div>
                )}
              </div>

              {/* API error */}
              {error && (
                <div style={{ backgroundColor: 'rgba(255,77,77,0.1)', border: '1px solid rgba(255,77,77,0.25)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  marginTop: 4,
                  backgroundColor: canSubmit ? GOLD : 'rgba(201,168,76,0.3)',
                  color: canSubmit ? '#000' : 'rgba(255,255,255,0.2)',
                  border: 'none', borderRadius: 10, padding: '14px',
                  fontSize: 15, fontWeight: 700,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.15s', fontFamily: 'inherit',
                }}
              >
                {saving ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
