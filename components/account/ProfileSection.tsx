'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getInitials } from '@/lib/avatar'
import { logAccountEvent } from '@/lib/account-events'

const GOLD = '#c9a84c'
const CARD: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: 24,
  marginBottom: 24,
}
const LABEL: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.4px',
  display: 'block',
  marginBottom: 6,
}
const INP: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '12px 14px',
  color: 'white',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
}

const LANGUAGES = [
  { value: 'th', label: 'ไทย' },
  { value: 'lo', label: 'ລາວ' },
  { value: 'en', label: 'English' },
]
const TIMEZONES = [
  { value: 'Asia/Vientiane', label: 'Asia/Vientiane (UTC+7)' },
  { value: 'Asia/Bangkok',   label: 'Asia/Bangkok (UTC+7)'   },
  { value: 'Asia/Yangon',    label: 'Asia/Yangon (UTC+6:30)' },
  { value: 'Asia/Kolkata',   label: 'Asia/Kolkata (UTC+5:30)'},
  { value: 'UTC',            label: 'UTC (UTC+0)'             },
]

interface Form {
  displayName: string
  phone: string
  language: string
  timezone: string
}

export function ProfileSection() {
  const { user } = useAuth()
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [form, setForm] = useState<Form>({ displayName: '', phone: '', language: 'th', timezone: 'Asia/Vientiane' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { authClient } = await import('@/lib/supabase-auth')
      const { data } = await authClient
        .from('shop_users')
        .select('display_name, phone, language, timezone, full_name')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (data) {
        setForm({
          displayName: data.display_name || data.full_name || '',
          phone: data.phone || '',
          language: data.language || 'th',
          timezone: data.timezone || 'Asia/Vientiane',
        })
      }
      setLoadingProfile(false)
    }
    load()
  }, [user])

  const handleSave = async () => {
    if (!user || saving) return
    setSaving(true)
    setSaveError(null)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    try {
      const { authClient } = await import('@/lib/supabase-auth')
      const { error } = await authClient
        .from('shop_users')
        .update({
          display_name: form.displayName.trim() || null,
          phone: form.phone.trim() || null,
          language: form.language,
          timezone: form.timezone,
        })
        .eq('user_id', user.id)
      if (error) throw error
      await logAccountEvent('profile_updated')
      setSaved(true)
      savedTimer.current = setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  const initials = getInitials(form.displayName, user?.email ?? '')
  const email = user?.email ?? ''

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: 'white', fontWeight: 800, fontSize: 22, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>โปรไฟล์</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>ข้อมูลส่วนตัวและการตั้งค่าบัญชี</p>
      </div>

      {/* Avatar */}
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>รูปโปรไฟล์</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            backgroundColor: 'rgba(201,168,76,0.15)',
            border: '2px solid rgba(201,168,76,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ color: GOLD, fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{initials}</span>
          </div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
              อัปโหลดรูปโปรไฟล์
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px',
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, cursor: 'not-allowed',
              color: 'rgba(255,255,255,0.25)', fontSize: 13,
            }}>
              เลือกรูปภาพ
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', padding: '1px 5px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>เร็วๆ นี้</span>
            </div>
          </div>
        </div>
      </div>

      {/* Personal info */}
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>ข้อมูลส่วนตัว</div>

        {loadingProfile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: 44, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
            <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }`}</style>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Display name */}
            <div>
              <label style={LABEL}>ชื่อแสดงผล</label>
              <input
                type="text"
                placeholder="ใส่ชื่อที่ต้องการแสดง"
                value={form.displayName}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                style={INP}
              />
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 5 }}>
                ชื่อนี้จะแสดงในใบเสร็จและรายงาน
              </div>
            </div>

            {/* Phone */}
            <div>
              <label style={LABEL}>
                เบอร์โทรศัพท์ <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(ไม่บังคับ)</span>
              </label>
              <input
                type="tel"
                placeholder="020-xxx-xxxx"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                style={INP}
              />
            </div>

            {/* Language */}
            <div>
              <label style={LABEL}>ภาษา</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={form.language}
                  onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                  style={{ ...INP, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', paddingRight: 36 }}
                >
                  {LANGUAGES.map(l => <option key={l.value} value={l.value} style={{ backgroundColor: '#1a1a1a' }}>{l.label}</option>)}
                </select>
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none', fontSize: 10 }}>▼</div>
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label style={LABEL}>เขตเวลา</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={form.timezone}
                  onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                  style={{ ...INP, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', paddingRight: 36 }}
                >
                  {TIMEZONES.map(tz => <option key={tz.value} value={tz.value} style={{ backgroundColor: '#1a1a1a' }}>{tz.label}</option>)}
                </select>
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none', fontSize: 10 }}>▼</div>
              </div>
            </div>

            {/* Error */}
            {saveError && (
              <div style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13 }}>
                {saveError}
              </div>
            )}

            {/* Save button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '11px 24px',
                  backgroundColor: saved ? 'rgba(76,186,127,0.15)' : saving ? 'rgba(201,168,76,0.35)' : GOLD,
                  color: saved ? '#4cba7f' : saving ? 'rgba(255,255,255,0.4)' : '#000',
                  border: saved ? '1px solid rgba(76,186,127,0.3)' : 'none',
                  borderRadius: 9, fontSize: 14, fontWeight: 700,
                  cursor: saving ? 'wait' : 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.2s',
                }}
              >
                {saving ? 'กำลังบันทึก...' : saved ? 'บันทึกแล้ว ✓' : 'บันทึกการเปลี่ยนแปลง'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Email (read-only) */}
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>อีเมล</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 4 }}>อีเมลปัจจุบัน</div>
            <div style={{ color: 'white', fontSize: 15, fontWeight: 500 }}>{email}</div>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px',
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, cursor: 'not-allowed',
            color: 'rgba(255,255,255,0.25)', fontSize: 13,
          }}>
            เปลี่ยนอีเมล
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', padding: '1px 5px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>เร็วๆ นี้</span>
          </div>
        </div>
      </div>
    </div>
  )
}
