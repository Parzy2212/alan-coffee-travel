'use client'

import { useEffect, useRef, useState } from 'react'
import { useShop } from '@/lib/use-shop'
import { getInitials } from '@/lib/avatar'
import { logAccountEvent } from '@/lib/account-events'

const GOLD = '#c9a84c'
const CARD: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 24 }
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', display: 'block', marginBottom: 6 }
const INP: React.CSSProperties = { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 14px', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' }

export function ShopIdentitySection() {
  const { shop, shopId, loading } = useShop()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!shop) return
    setName(shop.name ?? '')
    setDescription(shop.description ?? '')
  }, [shop])

  const handleSave = async () => {
    if (!shopId || !name.trim()) return
    setSaving(true); setError('')
    if (timer.current) clearTimeout(timer.current)
    try {
      const { authClient } = await import('@/lib/supabase-auth')
      const { error: err } = await authClient.from('shops').update({ name: name.trim(), description: description.trim() || null }).eq('id', shopId)
      if (err) throw err
      await logAccountEvent('shop_settings_updated' as never, 'Shop name / description updated')
      setSaved(true)
      timer.current = setTimeout(() => setSaved(false), 2500)
    } catch (e) { setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด') }
    finally { setSaving(false) }
  }

  const initials = getInitials(name, '')

  return (
    <div style={CARD}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>ข้อมูลร้านค้า</div>

      {/* Logo placeholder */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(201,168,76,0.12)', border: '2px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: GOLD, fontSize: 26, fontWeight: 700 }}>{initials || '?'}</span>
        </div>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 8 }}>อัปโหลดโลโก้ร้าน</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: 'not-allowed', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
            เลือกรูปภาพ
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', padding: '1px 5px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>เร็วๆ นี้</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ height: 120, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }}>
          <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={LABEL}>
              ชื่อร้าน <span style={{ color: '#ff6b6b' }}>*</span>
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Alan Coffee & Travel" style={INP} />
          </div>
          <div>
            <label style={LABEL}>
              คำอธิบายสั้น <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(ไม่บังคับ)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="ร้านกาแฟบรรยากาศดี..."
              rows={3}
              style={{ ...INP, resize: 'vertical' as const, lineHeight: 1.6 }}
            />
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 }}>จะแสดงในใบเสร็จและหน้าแรก</div>
          </div>
          {error && <div style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13 }}>{error}</div>}
          <SaveButton saving={saving} saved={saved} disabled={!name.trim()} onClick={handleSave} />
        </div>
      )}
    </div>
  )
}

export function SaveButton({ saving, saved, disabled, onClick }: { saving: boolean; saved: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving || disabled}
      style={{
        alignSelf: 'flex-start', padding: '11px 24px',
        backgroundColor: saved ? 'rgba(76,186,127,0.15)' : (saving || disabled) ? 'rgba(201,168,76,0.3)' : '#c9a84c',
        color: saved ? '#4cba7f' : (saving || disabled) ? 'rgba(255,255,255,0.3)' : '#000',
        border: saved ? '1px solid rgba(76,186,127,0.3)' : 'none',
        borderRadius: 9, fontSize: 14, fontWeight: 700,
        cursor: (saving || disabled) ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', transition: 'all 0.2s',
      }}
    >
      {saving ? 'กำลังบันทึก...' : saved ? 'บันทึกแล้ว ✓' : 'บันทึกการเปลี่ยนแปลง'}
    </button>
  )
}
