'use client'

import { useEffect, useRef, useState } from 'react'
import { RoleBadge } from './RoleBadge'
import { buildInviteLink, roleLabel, type InvitationRole } from '@/lib/invitations'
import { logAccountEvent } from '@/lib/account-events'

const GOLD = '#c9a84c'
const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
}
const CARD: React.CSSProperties = {
  backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16, padding: 28, width: '100%', maxWidth: 480,
  maxHeight: '90vh', overflowY: 'auto',
  fontFamily: 'var(--font-body, Inter, sans-serif)',
}
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', display: 'block', marginBottom: 6 }
const INP: React.CSSProperties = { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '11px 14px', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

const ROLES: { value: InvitationRole; icon: string; title: string; sub: string }[] = [
  { value: 'manager', icon: '🔧', title: 'ผู้จัดการ',  sub: 'จัดการเมนู สต็อก พนักงาน ดูรายงาน' },
  { value: 'cashier', icon: '💼', title: 'แคชเชียร์',  sub: 'ใช้ POS เท่านั้น'                   },
  { value: 'viewer',  icon: '👁️', title: 'ผู้ดู',     sub: 'ดูรายงานอย่างเดียว (อ่านอย่างเดียว)' },
]

interface InviteMemberModalProps {
  shopId: string
  userId: string
  existingEmails: string[]
  onSaved: () => void
  onClose: () => void
}

type Step = 'form' | 'link'

export function InviteMemberModal({ shopId, userId, existingEmails, onSaved, onClose }: InviteMemberModalProps) {
  const [step, setStep]       = useState<Step>('form')
  const [email, setEmail]     = useState('')
  const [role, setRole]       = useState<InvitationRole>('cashier')
  const [message, setMessage] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied]   = useState(false)
  const overlayRef            = useRef<HTMLDivElement>(null)
  const copyTimer             = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSend = async () => {
    const trimEmail = email.trim().toLowerCase()
    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError('กรุณาใส่อีเมลที่ถูกต้อง'); return
    }
    if (existingEmails.map(e => e.toLowerCase()).includes(trimEmail)) {
      setError('อีเมลนี้เป็นสมาชิกของร้านอยู่แล้ว'); return
    }
    setSaving(true); setError('')
    try {
      const { authClient } = await import('@/lib/supabase-auth')

      // Revoke any existing pending invitation for this email
      await authClient.from('shop_invitations')
        .update({ status: 'revoked' })
        .eq('shop_id', shopId)
        .eq('email', trimEmail)
        .eq('status', 'pending')

      // Create new invitation
      const { data, error: err } = await authClient.from('shop_invitations').insert({
        shop_id:             shopId,
        invited_by_user_id:  userId,
        email:               trimEmail,
        role,
        message:             message.trim() || null,
      }).select('token').single()

      if (err) throw err

      const token = (data as { token: string }).token
      setInviteLink(buildInviteLink(token))
      await logAccountEvent('team_invitation_sent', `Team invitation sent to ${trimEmail}`)
      setStep('link')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2500)
    } catch { /* ignore */ }
  }

  return (
    <div ref={overlayRef} style={OVERLAY} onClick={e => { if (e.target === overlayRef.current) onClose() }}>
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'white' }}>
            {step === 'form' ? 'เชิญสมาชิกใหม่' : 'ลิงก์คำเชิญ'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {step === 'form' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={LABEL}>อีเมล <span style={{ color: '#ff6b6b' }}>*</span></label>
              <input
                type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="colleague@example.com" style={INP} autoFocus
              />
            </div>

            <div>
              <label style={{ ...LABEL, marginBottom: 10 }}>บทบาท</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ROLES.map(r => (
                  <button key={r.value} onClick={() => setRole(r.value)} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderRadius: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    backgroundColor: role === r.value ? 'rgba(201,168,76,0.07)' : 'rgba(255,255,255,0.02)',
                    border: `2px solid ${role === r.value ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.07)'}`,
                    transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{r.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{r.title}</div>
                      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{r.sub}</div>
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${role === r.value ? GOLD : 'rgba(255,255,255,0.15)'}`, backgroundColor: role === r.value ? GOLD : 'transparent', flexShrink: 0, transition: 'all 0.15s' }} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={LABEL}>ข้อความส่วนตัว <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(ไม่บังคับ)</span></label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} placeholder="ยินดีต้อนรับเข้าทีมนะครับ!" style={{ ...INP, resize: 'vertical', lineHeight: 1.6 }} />
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>จะแสดงในหน้าตอบรับคำเชิญ</div>
            </div>

            {error && <div style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                ยกเลิก
              </button>
              <button onClick={handleSend} disabled={saving || !email.trim()} style={{
                flex: 2, padding: '12px 0', borderRadius: 9, border: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                backgroundColor: (saving || !email.trim()) ? 'rgba(201,168,76,0.3)' : GOLD,
                color: (saving || !email.trim()) ? 'rgba(255,255,255,0.3)' : '#000',
                cursor: (saving || !email.trim()) ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'กำลังสร้าง...' : 'สร้างลิงก์คำเชิญ'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Success indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', backgroundColor: 'rgba(76,186,127,0.07)', border: '1px solid rgba(76,186,127,0.2)', borderRadius: 10 }}>
              <span style={{ fontSize: 20 }}>✓</span>
              <div>
                <div style={{ color: '#4cba7f', fontSize: 13, fontWeight: 600 }}>สร้างคำเชิญสำเร็จ</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
                  <RoleBadge role={role} size="sm" /> · {email} · หมดอายุใน 7 วัน
                </div>
              </div>
            </div>

            {/* Link box */}
            <div>
              <label style={LABEL}>ลิงก์คำเชิญ — ส่งให้ {email}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '11px 14px', color: 'rgba(255,255,255,0.5)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                  {inviteLink}
                </div>
                <button
                  onClick={handleCopy}
                  style={{
                    flexShrink: 0, padding: '0 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                    backgroundColor: copied ? 'rgba(76,186,127,0.15)' : GOLD,
                    color: copied ? '#4cba7f' : '#000',
                    transition: 'all 0.2s', whiteSpace: 'nowrap',
                  }}
                >
                  {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก'}
                </button>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
                ส่งลิงก์นี้ให้ {email} ผ่าน LINE / WhatsApp / อีเมล<br />
                เมื่อคลิกลิงก์ {roleLabel(role)}คนนี้จะเข้าร่วมทีมโดยอัตโนมัติ
              </div>
            </div>

            <button onClick={onClose} style={{ padding: '12px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ปิด
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
