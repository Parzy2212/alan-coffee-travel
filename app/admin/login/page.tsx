'use client'
import { useState, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const configError = searchParams.get('error') === 'config'

  const [password, setPassword] = useState('')
  const [error, setError] = useState(configError ? 'Server configuration error — ADMIN_PASSWORD not set.' : '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!password || loading) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        router.push('/admin')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Incorrect password.')
        setPassword('')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-black)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>

      {/* Logo */}
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '48px' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '22px', color: 'var(--color-white)' }}>ALAN</span>
        <span style={{ width: '5px', height: '5px', borderRadius: '999px', backgroundColor: 'var(--color-gold)' }}></span>
        <span style={{ color: 'var(--color-gray-400)', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Coffee & Travel</span>
      </a>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: '#111',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '40px 36px',
      }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ height: '1px', width: '28px', backgroundColor: 'var(--color-gold)' }}></div>
            <span style={{ color: 'var(--color-gold)', fontSize: '10px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' as const }}>Admin Access</span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            color: 'var(--color-white)',
            fontSize: '28px',
            fontWeight: 800,
            letterSpacing: '-0.5px',
            lineHeight: 1.2,
            margin: 0,
          }}>
            Sign in to<br />
            <span style={{ color: 'var(--color-gold)' }}>Admin Panel</span>
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>

          <div>
            <label style={{
              display: 'block',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '1.5px',
              textTransform: 'uppercase' as const,
              marginBottom: '8px',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter admin password"
              autoComplete="current-password"
              autoFocus
              style={{
                width: '100%',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                padding: '14px 16px',
                color: 'var(--color-white)',
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box' as const,
                fontFamily: 'var(--font-body)',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(201,168,76,0.5)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
            />
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              backgroundColor: 'rgba(220,53,69,0.1)',
              border: '1px solid rgba(220,53,69,0.25)',
              borderRadius: '6px',
              padding: '10px 14px',
            }}>
              <p style={{ color: '#ff6b6b', fontSize: '13px', margin: 0 }}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              backgroundColor: loading || !password ? 'rgba(201,168,76,0.4)' : 'var(--color-gold)',
              color: 'var(--color-black)',
              padding: '14px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '1px',
              textTransform: 'uppercase' as const,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)',
              transition: 'background-color 0.15s',
              minHeight: '48px',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' as const }}>
          <a href="/" style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textDecoration: 'none' }}>
            ← Back to site
          </a>
        </div>
      </div>

      {/* Session note */}
      <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '11px', marginTop: '24px', textAlign: 'center' as const }}>
        Session expires after 24 hours
      </p>

    </main>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
