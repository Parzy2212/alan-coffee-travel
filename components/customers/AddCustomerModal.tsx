'use client'

import { useRef, useState } from 'react'
import { createCustomer } from '@/lib/customers'
import type { Customer } from '@/lib/customers'

const GOLD   = '#c9a84c'
const RED    = '#ff6b6b'
const BORDER = 'rgba(255,255,255,0.1)'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 9,
  border: `1px solid ${BORDER}`, backgroundColor: '#0f0f0f',
  color: '#fff', fontSize: 14, boxSizing: 'border-box',
}

const PRESET_TAGS = ['ลูกค้าประจำ', 'VIP', 'ชอบลาเต้', 'นักท่องเที่ยว', 'ไม่ดื่มคาเฟอีน']

export interface AddCustomerModalProps {
  shopId?: string | null
  onSave: (customer: Customer) => void
  onClose: () => void
  initialPhone?: string
}

export function AddCustomerModal({ shopId, onSave, onClose, initialPhone = '' }: AddCustomerModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [phone,    setPhone]    = useState(initialPhone)
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [birthday, setBirthday] = useState('')
  const [notes,    setNotes]    = useState('')
  const [tags,     setTags]     = useState<string[]>([])
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')

  function toggleTag(t: string) {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function handleSave() {
    if (!phone.trim()) { setErr('กรุณากรอกเบอร์โทร'); return }
    if (!name.trim())  { setErr('กรุณากรอกชื่อ'); return }
    setSaving(true); setErr('')
    try {
      const result = await createCustomer({
        phone:    phone.trim(),
        name:     name.trim(),
        email:    email.trim() || undefined,
        birthday: birthday || undefined,
        notes:    notes.trim() || undefined,
        tags:     tags.length ? tags : undefined,
        shop_id:  shopId ?? undefined,
      })
      if (result) onSave(result)
      else setErr('ไม่สามารถบันทึกได้ ลองใหม่อีกครั้ง')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    }
    setSaving(false)
  }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        backgroundColor: '#181818', border: `1px solid ${GOLD}44`,
        borderRadius: 16, width: '100%', maxWidth: 440,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: GOLD }}>เพิ่มลูกค้าใหม่</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 22, cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Phone + Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>เบอร์โทร *</div>
              <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="020 xxx xxxx" type="tel" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>ชื่อ *</div>
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="ชื่อลูกค้า" />
            </div>
          </div>

          {/* Email + Birthday */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>อีเมล (ไม่บังคับ)</div>
              <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="email@example.com" type="email" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>วันเกิด (ไม่บังคับ)</div>
              <input value={birthday} onChange={e => setBirthday(e.target.value)} style={inputStyle} type="date" />
            </div>
          </div>

          {/* Tags */}
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 7 }}>แท็ก</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PRESET_TAGS.map(t => {
                const on = tags.includes(t)
                return (
                  <button key={t} onClick={() => toggleTag(t)} style={{
                    padding: '4px 12px', borderRadius: 99, cursor: 'pointer', fontSize: 12,
                    border: `1px solid ${on ? GOLD : BORDER}`,
                    backgroundColor: on ? `${GOLD}18` : 'transparent',
                    color: on ? GOLD : 'rgba(255,255,255,0.45)',
                  }}>{t}</button>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>หมายเหตุ (ไม่บังคับ)</div>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="บันทึกข้อมูลพิเศษ..."
            />
          </div>

          {err && <div style={{ fontSize: 12, color: RED }}>{err}</div>}

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1, height: 48, borderRadius: 12, border: 'none',
                backgroundColor: GOLD, color: '#000',
                fontSize: 15, fontWeight: 800, cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button onClick={onClose} style={{
              flex: 1, height: 48, borderRadius: 12,
              border: `1px solid ${BORDER}`, backgroundColor: 'transparent',
              color: 'rgba(255,255,255,0.5)', fontSize: 15, cursor: 'pointer',
            }}>ยกเลิก</button>
          </div>
        </div>
      </div>
    </div>
  )
}
