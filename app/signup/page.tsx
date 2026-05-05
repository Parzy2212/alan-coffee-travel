'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

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
}

const label: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.5px',
  display: 'block',
  marginBottom: 6,
}

export default function SignupPage() {
  const { signUp, session, loading: authLoading } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && session) router.replace('/cafe')
  }, [session, authLoading, router])

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('รหัสผ่านไม่ตรงกัน'); return }
    if (form.password.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return }
    setLoading(true)
    setError('')
    const { error } = await signUp(form.email, form.password, form.name || undefined)
    if (error) {
      const msg = error.includes('already registered')
        ? 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ'
        : error
      setError(msg)
      setLoading(false)
    } else {
      router.replace('/onboarding')
    }
  }

  const valid = form.email && form.password && form.confirm

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
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6 }}>ทดลองใช้ฟรี · ไม่ต้องใช้บัตรเครดิต</p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 440,
        backgroundColor: '#111',
        border: '1px solid rgba(201,168,76,0.15)',
        borderRadius: 20,
        padding: '40px 36px',
      }}>
        <h1 style={{ color: 'white', fontWeight: 800, fontSize: 24, marginBottom: 6, fontFamily: 'var(--font-heading)' }}>
          สมัครสมาชิก
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 28 }}>
          สร้างบัญชีและเริ่มจัดการร้านของคุณ
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={label}>ชื่อ (ไม่บังคับ)</label>
            <input
              type="text"
              placeholder="ชื่อของคุณ"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              autoComplete="name"
              style={inp}
            />
          </div>

          <div>
            <label style={label}>อีเมล *</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              required
              autoComplete="email"
              style={inp}
            />
          </div>

          <div>
            <label style={label}>รหัสผ่าน * (อย่างน้อย 8 ตัว)</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              required
              autoComplete="new-password"
              style={inp}
            />
          </div>

          <div>
            <label style={label}>ยืนยันรหัสผ่าน *</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.confirm}
              onChange={e => set('confirm', e.target.value)}
              required
              autoComplete="new-password"
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
            disabled={loading || !valid}
            style={{
              marginTop: 4,
              backgroundColor: (loading || !valid) ? 'rgba(201,168,76,0.4)' : GOLD,
              color: '#000',
              border: 'none',
              borderRadius: 10,
              padding: '14px',
              fontSize: 15,
              fontWeight: 700,
              cursor: (loading || !valid) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชีฟรี'}
          </button>

          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
            เมื่อสมัครสมาชิก แสดงว่าคุณยอมรับ{' '}
            <a href="/pos-product" style={{ color: 'rgba(201,168,76,0.6)' }}>เงื่อนไขการใช้งาน</a>
          </p>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          มีบัญชีอยู่แล้ว?{' '}
          <a href="/login" style={{ color: GOLD, textDecoration: 'none', fontWeight: 600 }}>
            เข้าสู่ระบบ
          </a>
        </div>
      </div>

      <a href="/" style={{ marginTop: 24, color: 'rgba(255,255,255,0.2)', fontSize: 12, textDecoration: 'none' }}>
        ← กลับหน้าหลัก
      </a>
    </main>
  )
}
