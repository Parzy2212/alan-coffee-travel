'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { logAccountEvent } from '@/lib/account-events'

const GOLD = '#c9a84c'
const CARD: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: 24,
  marginBottom: 24,
}
const INP: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '12px 44px 12px 14px',
  color: 'white',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
}

type Strength = 'weak' | 'medium' | 'strong'

function getStrength(pw: string): Strength {
  if (pw.length < 8) return 'weak'
  const hasLetter = /[a-zA-Z]/.test(pw)
  const hasNumber = /[0-9]/.test(pw)
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw)
  if (pw.length >= 12 && hasLetter && hasNumber && hasSymbol) return 'strong'
  if (hasLetter && hasNumber) return 'medium'
  return 'weak'
}

const STRENGTH = {
  weak:   { bars: 1, color: '#ff4d4d', label: 'ไม่ปลอดภัย' },
  medium: { bars: 2, color: '#f0b429', label: 'พอใช้'       },
  strong: { bars: 3, color: '#4cba7f', label: 'แข็งแกร่ง'  },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function PasswordSection() {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showCf, setShowCf] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [lastChanged, setLastChanged] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { authClient } = await import('@/lib/supabase-auth')
      const { data } = await authClient
        .from('account_events')
        .select('created_at')
        .eq('user_id', user!.id)
        .in('event_type', ['password_changed', 'password_reset'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) setLastChanged(data.created_at)
    }
    load()
  }, [user])

  const strength = pw ? getStrength(pw) : null
  const mismatch = confirm.length > 0 && confirm !== pw
  const canSubmit = pw.length >= 8 && pw === confirm && !saving

  const handleSave = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      const { authClient } = await import('@/lib/supabase-auth')
      const { error: updateError } = await authClient.auth.updateUser({ password: pw })
      if (updateError) { setError(updateError.message); return }
      await logAccountEvent('password_changed')
      setLastChanged(new Date().toISOString())
      setSaved(true)
      setPw(''); setConfirm('')
      setExpanded(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>รหัสผ่าน</div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            {saved
              ? <span style={{ color: '#4cba7f' }}>เปลี่ยนรหัสผ่านสำเร็จ ✓</span>
              : lastChanged
              ? `อัปเดตล่าสุด: ${formatDate(lastChanged)}`
              : 'อัปเดตล่าสุด: ไม่ทราบ'}
          </div>
        </div>
        <button
          onClick={() => { setExpanded(v => !v); setError(''); setPw(''); setConfirm('') }}
          style={{
            padding: '9px 18px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, color: 'rgba(255,255,255,0.6)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
        >
          {expanded ? 'ยกเลิก' : 'เปลี่ยนรหัสผ่าน →'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* New password */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>
              รหัสผ่านใหม่
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                value={pw}
                onChange={e => setPw(e.target.value)}
                autoFocus
                autoComplete="new-password"
                style={INP}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: 'inherit', padding: '2px 4px' }}
              >
                {showPw ? 'ซ่อน' : 'แสดง'}
              </button>
            </div>
            {pw.length > 0 && strength && (
              <div style={{ marginTop: 7 }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
                  {[1, 2, 3].map(bar => (
                    <div key={bar} style={{ flex: 1, height: 3, borderRadius: 99, backgroundColor: bar <= STRENGTH[strength].bars ? STRENGTH[strength].color : 'rgba(255,255,255,0.08)', transition: 'background-color 0.2s' }} />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: STRENGTH[strength].color }}>
                  {STRENGTH[strength].label}
                  {strength === 'weak' && <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 6 }}>— ต้องอย่างน้อย 8 ตัวอักษร</span>}
                </div>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>
              ยืนยันรหัสผ่านใหม่
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCf ? 'text' : 'password'}
                placeholder="ใส่รหัสผ่านอีกครั้ง"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                style={{ ...INP, borderColor: mismatch ? 'rgba(255,77,77,0.5)' : 'rgba(255,255,255,0.1)' }}
              />
              <button
                type="button"
                onClick={() => setShowCf(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: 'inherit', padding: '2px 4px' }}
              >
                {showCf ? 'ซ่อน' : 'แสดง'}
              </button>
            </div>
            {mismatch && <div style={{ color: '#ff6b6b', fontSize: 12, marginTop: 4 }}>รหัสผ่านไม่ตรงกัน</div>}
          </div>

          {error && (
            <div style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!canSubmit}
            style={{
              alignSelf: 'flex-start', padding: '11px 24px',
              backgroundColor: canSubmit ? GOLD : 'rgba(201,168,76,0.25)',
              color: canSubmit ? '#000' : 'rgba(255,255,255,0.25)',
              border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', transition: 'background-color 0.15s',
            }}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
          </button>
        </div>
      )}
    </div>
  )
}
