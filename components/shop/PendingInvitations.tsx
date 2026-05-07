'use client'

import { useRef, useState } from 'react'
import { RoleBadge } from './RoleBadge'
import { buildInviteLink } from '@/lib/invitations'

const CARD: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 24 }

export type Invitation = {
  id: string
  email: string
  role: string
  status: string
  expires_at: string
  created_at: string
  token: string
}

interface PendingInvitationsProps {
  invitations: Invitation[]
  onRevoke: (inv: Invitation) => void
  onResend: (inv: Invitation) => void
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
}

function daysSince(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return 'วันนี้'
  if (d === 1) return 'เมื่อวาน'
  return `${d} วันที่แล้ว`
}

function InvitationRow({ inv, onRevoke, onResend }: { inv: Invitation; onRevoke: () => void; onResend: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied]     = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const left    = daysUntil(inv.expires_at)
  const urgent  = left <= 2

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildInviteLink(inv.token))
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      {/* Status dot */}
      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: urgent ? '#ffb700' : 'rgba(255,255,255,0.2)', flexShrink: 0 }} />

      {/* Email + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <RoleBadge role={inv.role} size="sm" />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>ส่งเมื่อ {daysSince(inv.created_at)}</span>
          <span style={{ color: urgent ? '#ffb700' : 'rgba(255,255,255,0.25)', fontSize: 11 }}>
            {left > 0 ? `หมดอายุใน ${left} วัน` : 'หมดอายุแล้ว'}
          </span>
        </div>
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: copied ? 'rgba(76,186,127,0.1)' : 'rgba(255,255,255,0.04)', color: copied ? '#4cba7f' : 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
      >
        {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
      </button>

      {/* Actions menu */}
      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', backgroundColor: menuOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >⋮</button>
        {menuOpen && (
          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 100, backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '4px 0', minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            <button onClick={() => { setMenuOpen(false); onResend() }} style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
              🔄 ต่ออายุ 7 วัน
            </button>
            <button onClick={() => { setMenuOpen(false); onRevoke() }} style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', color: '#ff6b6b', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,77,77,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
              ✕ ยกเลิกคำเชิญ
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function PendingInvitations({ invitations, onRevoke, onResend }: PendingInvitationsProps) {
  if (invitations.length === 0) {
    return (
      <div style={CARD}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 16 }}>คำเชิญที่รอตอบรับ</div>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, padding: '12px 0' }}>ไม่มีคำเชิญที่รอตอบรับ</div>
      </div>
    )
  }
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>คำเชิญที่รอตอบรับ</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{invitations.length} คำเชิญรอผู้รับ</div>
        </div>
      </div>
      <div>
        {invitations.map(inv => (
          <InvitationRow key={inv.id} inv={inv} onRevoke={() => onRevoke(inv)} onResend={() => onResend(inv)} />
        ))}
      </div>
    </div>
  )
}
