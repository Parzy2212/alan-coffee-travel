'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { logAccountEvent } from '@/lib/account-events'

const CONFIRM_PHRASE = 'ลบบัญชี'

export function DangerZone() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const confirmed = typed === CONFIRM_PHRASE

  const handleDelete = async () => {
    if (!confirmed || !user || deleting) return
    setDeleting(true)
    setError('')
    try {
      const { authClient } = await import('@/lib/supabase-auth')
      // Soft delete: deactivate all shop_users rows for this user
      await authClient
        .from('shop_users')
        .update({ active: false })
        .eq('user_id', user.id)
      await logAccountEvent('account_deleted', 'Soft delete — 30 day grace period')
      await signOut()
      router.replace('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      setDeleting(false)
    }
  }

  return (
    <>
      {/* Danger zone card */}
      <div style={{
        backgroundColor: 'rgba(255,77,77,0.04)',
        border: '1px solid rgba(255,77,77,0.2)',
        borderRadius: 16, padding: 24,
        marginBottom: 24,
      }}>
        <div style={{ color: 'rgba(255,100,100,0.9)', fontSize: 14, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          เขตอันตราย
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          การลบบัญชีจะระงับการใช้งานและจะถูกลบถาวรหลังจาก 30 วัน
        </div>
        <button
          onClick={() => { setShowModal(true); setTyped(''); setError('') }}
          style={{
            padding: '9px 18px',
            backgroundColor: 'rgba(255,77,77,0.08)',
            border: '1px solid rgba(255,77,77,0.3)',
            borderRadius: 8, color: 'rgba(255,120,120,0.85)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,77,77,0.14)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255,77,77,0.08)')}
        >
          ลบบัญชี
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,77,77,0.25)', borderRadius: 16, padding: '28px 28px', maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 18, marginBottom: 10 }}>ลบบัญชีของคุณ</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
              การลบบัญชีจะ:
              <ul style={{ marginTop: 8, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>ลบข้อมูลทั้งหมดของคุณ</li>
                <li>ระงับการใช้งานทันที</li>
                <li>หลังจาก 30 วัน ข้อมูลจะถูกลบถาวร</li>
              </ul>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>
                พิมพ์ <span style={{ color: 'rgba(255,120,120,0.9)', fontFamily: 'monospace' }}>{CONFIRM_PHRASE}</span> เพื่อยืนยัน:
              </label>
              <input
                type="text"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoFocus
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${confirmed ? 'rgba(255,77,77,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8, padding: '12px 14px',
                  color: 'white', fontSize: 14, outline: 'none',
                  boxSizing: 'border-box', fontFamily: 'inherit',
                }}
              />
            </div>

            {error && (
              <div style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13, marginBottom: 14 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={deleting}
                style={{ flex: 1, padding: '11px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                disabled={!confirmed || deleting}
                style={{
                  flex: 1, padding: '11px',
                  backgroundColor: confirmed && !deleting ? 'rgba(255,77,77,0.85)' : 'rgba(255,77,77,0.2)',
                  border: 'none', borderRadius: 9,
                  color: confirmed && !deleting ? 'white' : 'rgba(255,255,255,0.3)',
                  fontSize: 14, fontWeight: 700,
                  cursor: confirmed && !deleting ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                {deleting ? 'กำลังลบ...' : 'ลบบัญชี'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
