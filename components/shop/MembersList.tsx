'use client'

import { useEffect, useRef, useState } from 'react'
import { RoleBadge } from './RoleBadge'

const GOLD = '#c9a84c'
const CARD: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 24 }

export type Member = {
  id: string
  user_id: string | null
  email: string
  role: string
  full_name: string | null
  display_name: string | null
  active: boolean
  last_seen_at: string | null
  accepted_at: string | null
}

interface MembersListProps {
  members: Member[]
  currentUserId: string
  currentRole: string
  onRoleChange: (member: Member, newRole: string) => void
  onSuspend: (member: Member) => void
  onRemove: (member: Member) => void
  onInvite: () => void
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'ไม่เคยเข้าสู่ระบบ'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2) return 'เมื่อสักครู่'
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`
  const d = Math.floor(h / 24)
  if (d === 1) return 'เมื่อวาน'
  if (d < 7) return `${d} วันที่แล้ว`
  if (d < 30) return `${Math.floor(d / 7)} สัปดาห์ที่แล้ว`
  return `${Math.floor(d / 30)} เดือนที่แล้ว`
}

function MemberRow({ member, currentUserId, currentRole, onRoleChange, onSuspend, onRemove }: {
  member: Member
  currentUserId: string
  currentRole: string
  onRoleChange: (m: Member, r: string) => void
  onSuspend: (m: Member) => void
  onRemove: (m: Member) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const isSelf  = member.user_id === currentUserId
  const isOwner = member.role === 'owner'
  const canAct  = !isSelf && !isOwner && currentRole === 'owner'
  const displayName = member.display_name || member.full_name || member.email.split('@')[0]
  const initial = displayName[0]?.toUpperCase() ?? '?'

  useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      opacity: member.active ? 1 : 0.45,
    }}>
      {/* Avatar */}
      <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: isOwner ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.07)', border: `1.5px solid ${isOwner ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color: isOwner ? GOLD : 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 700 }}>{initial}</span>
      </div>

      {/* Name + email */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'white', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
          {isSelf && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 400, marginLeft: 6 }}>(คุณ)</span>}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</div>
      </div>

      {/* Role */}
      <div style={{ flexShrink: 0 }}><RoleBadge role={member.role} size="sm" /></div>

      {/* Last seen */}
      <div style={{ flexShrink: 0, minWidth: 100, textAlign: 'right' }}>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{timeAgo(member.last_seen_at)}</div>
        {!member.active && <div style={{ color: '#ff6b6b', fontSize: 11, marginTop: 1 }}>ถูกระงับ</div>}
      </div>

      {/* Actions */}
      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => canAct && setMenuOpen(v => !v)}
          style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', backgroundColor: menuOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.35)', cursor: canAct ? 'pointer' : 'default', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >⋮</button>
        {menuOpen && (
          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 100, backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '4px 0', minWidth: 170, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            {['manager','cashier','viewer'].filter(r => r !== member.role).map(r => (
              <button key={r} onClick={() => { setMenuOpen(false); onRoleChange(member, r) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                เปลี่ยนเป็น <RoleBadge role={r} size="sm" />
              </button>
            ))}
            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
            <button onClick={() => { setMenuOpen(false); onSuspend(member) }} style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', color: member.active ? 'rgba(255,185,0,0.8)' : '#4cba7f', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
              {member.active ? '🔴 ระงับการเข้าถึง' : '🟢 เปิดการเข้าถึง'}
            </button>
            <button onClick={() => { setMenuOpen(false); onRemove(member) }} style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', color: '#ff6b6b', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,77,77,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
              🗑️ นำออกจากทีม
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function MembersList({ members, currentUserId, currentRole, onRoleChange, onSuspend, onRemove, onInvite }: MembersListProps) {
  const activeCount = members.filter(m => m.active).length
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>สมาชิกในทีม</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{activeCount} คนใช้งานระบบ</div>
        </div>
        {currentRole === 'owner' || currentRole === 'manager' ? (
          <button onClick={onInvite} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: GOLD, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + เชิญสมาชิก
          </button>
        ) : null}
      </div>
      <div>
        {members.map(m => (
          <MemberRow key={m.id} member={m} currentUserId={currentUserId} currentRole={currentRole} onRoleChange={onRoleChange} onSuspend={onSuspend} onRemove={onRemove} />
        ))}
      </div>
    </div>
  )
}
