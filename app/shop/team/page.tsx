'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShopLayout } from '@/components/ShopLayout'
import { useShop } from '@/lib/use-shop'
import { useAuth } from '@/contexts/AuthContext'
import { MembersList, type Member } from '@/components/shop/MembersList'
import { PendingInvitations, type Invitation } from '@/components/shop/PendingInvitations'
import { InviteMemberModal } from '@/components/shop/InviteMemberModal'

type ConfirmAction =
  | { type: 'role';    member: Member; newRole: string }
  | { type: 'suspend'; member: Member }
  | { type: 'remove';  member: Member }
  | null

export default function TeamPage() {
  const { user } = useAuth()
  const { shopId, loading: shopLoading } = useShop()
  const [members,     setMembers]     = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [myRole,      setMyRole]      = useState('')
  const [loading,     setLoading]     = useState(true)
  const [showInvite,  setShowInvite]  = useState(false)
  const [confirm,     setConfirm]     = useState<ConfirmAction>(null)
  const [acting,      setActing]      = useState(false)

  const load = useCallback(async () => {
    if (!shopId || !user) return
    const { authClient } = await import('@/lib/supabase-auth')
    const [membRes, invRes] = await Promise.all([
      authClient.from('shop_users')
        .select('id, user_id, email, role, full_name, display_name, active, last_seen_at, accepted_at')
        .eq('shop_id', shopId)
        .order('role'),
      authClient.from('shop_invitations')
        .select('id, email, role, status, expires_at, created_at, token')
        .eq('shop_id', shopId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
    ])
    const allMembers = (membRes.data as Member[]) ?? []
    setMembers(allMembers)
    setInvitations((invRes.data as Invitation[]) ?? [])
    const me = allMembers.find(m => m.user_id === user.id)
    setMyRole(me?.role ?? '')
    setLoading(false)
  }, [shopId, user])

  useEffect(() => {
    if (shopLoading) return
    if (shopId && user) load()
    else setLoading(false)
  }, [shopLoading, shopId, user, load])

  const doAction = async () => {
    if (!confirm || !shopId) return
    setActing(true)
    try {
      const { authClient } = await import('@/lib/supabase-auth')
      if (confirm.type === 'role') {
        await authClient.from('shop_users').update({ role: confirm.newRole }).eq('id', confirm.member.id)
      } else if (confirm.type === 'suspend') {
        await authClient.from('shop_users').update({ active: !confirm.member.active }).eq('id', confirm.member.id)
      } else if (confirm.type === 'remove') {
        await authClient.from('shop_users').delete().eq('id', confirm.member.id)
      }
      await load()
    } catch { /* ignore */ } finally {
      setActing(false); setConfirm(null)
    }
  }

  const handleRevoke = async (inv: Invitation) => {
    const { authClient } = await import('@/lib/supabase-auth')
    await authClient.from('shop_invitations').update({ status: 'revoked' }).eq('id', inv.id)
    load()
  }

  const handleResend = async (inv: Invitation) => {
    const { authClient } = await import('@/lib/supabase-auth')
    const newExpiry = new Date(Date.now() + 7 * 86400000).toISOString()
    await authClient.from('shop_invitations').update({ expires_at: newExpiry, created_at: new Date().toISOString() }).eq('id', inv.id)
    load()
  }

  const existingEmails = members.map(m => m.email)

  const confirmLabel = confirm?.type === 'role'
    ? `เปลี่ยนบทบาทของ ${confirm.member.display_name || confirm.member.email} เป็น ${confirm.newRole}?`
    : confirm?.type === 'suspend'
    ? `${confirm.member.active ? 'ระงับการเข้าถึงของ' : 'เปิดการเข้าถึงของ'} ${confirm.member.display_name || confirm.member.email}?`
    : confirm?.type === 'remove'
    ? `นำ ${confirm.member.display_name || confirm.member.email} ออกจากทีม?`
    : ''

  if (shopLoading || loading) {
    return (
      <ShopLayout>
        <div style={{ marginBottom: 32 }}>
          <div style={{ height: 28, width: 140, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 8 }} />
        </div>
        <div style={{ height: 260, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 20 }} />
        <div style={{ height: 140, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)' }} />
      </ShopLayout>
    )
  }

  if (!shopId) {
    return (
      <ShopLayout>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 300, textAlign: 'center', backgroundColor: 'rgba(255,77,77,0.04)',
          border: '1px dashed rgba(255,77,77,0.2)', borderRadius: 16, padding: 32,
        }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'white', marginBottom: 8 }}>ไม่พบร้านที่คุณเป็นเจ้าของ</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', maxWidth: 360, lineHeight: 1.7 }}>
            บัญชีนี้ไม่มีบทบาท owner ผูกกับร้านใดเลยในระบบ ({user?.email}) — ลองออกจากระบบแล้วเข้าใหม่
            ถ้ายังเจอปัญหานี้อยู่ ติดต่อทีมพัฒนา
          </div>
        </div>
      </ShopLayout>
    )
  }

  return (
    <ShopLayout>
      {/* Invite modal */}
      {showInvite && shopId && user && (
        <InviteMemberModal
          shopId={shopId} userId={user.id}
          existingEmails={existingEmails}
          onSaved={load}
          onClose={() => setShowInvite(false)}
        />
      )}

      {/* Confirm modal */}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', fontFamily: 'inherit' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 10 }}>ยืนยันการดำเนินการ</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{confirmLabel}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
              <button onClick={doAction} disabled={acting} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', backgroundColor: confirm.type === 'remove' ? '#ff4d4d' : '#c9a84c', color: confirm.type === 'remove' ? 'white' : '#000', fontSize: 14, fontWeight: 700, cursor: acting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: acting ? 0.6 : 1 }}>
                {acting ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 6 }}>ทีมงาน</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>จัดการผู้ใช้งานระบบแดชบอร์ด</div>
      </div>

      <MembersList
        members={members}
        currentUserId={user?.id ?? ''}
        currentRole={myRole}
        onRoleChange={(m, r) => setConfirm({ type: 'role', member: m, newRole: r })}
        onSuspend={m => setConfirm({ type: 'suspend', member: m })}
        onRemove={m => setConfirm({ type: 'remove', member: m })}
        onInvite={() => setShowInvite(true)}
      />

      <PendingInvitations
        invitations={invitations}
        onRevoke={handleRevoke}
        onResend={handleResend}
      />
    </ShopLayout>
  )
}
