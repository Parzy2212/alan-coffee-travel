'use client'
import { useState } from 'react'
import { tr } from '@/lib/translations'

const GOLD = '#c9a84c'

type Guide = Record<string, any> | null

export default function InquiryModal({
  guide,
  experience,
  destinationId,
  onClose,
  lang,
}: {
  guide: Guide
  onClose: () => void
  lang: string
  experience?: Record<string, any> | null
  destinationId?: string | null
}) {
  const [form, setForm] = useState({ name: '', email: '', country: '', date: '', group: '2', message: '' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.name || !form.message) return
    setSending(true)
    const { supabase } = await import('@/lib/supabase')
    const payload: Record<string, unknown> = {
      guide_id: guide?.id ?? null,
      name: form.name, email: form.email || null, country: form.country || null,
      preferred_date: form.date || null, group_size: Number(form.group) || 2,
      message: form.message, contact_via: 'web',
    }
    if (experience) payload.experience_id = experience.id
    if (destinationId) payload.destination_id = destinationId
    await supabase.from('inquiries').insert(payload)
    setSent(true)
    setSending(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '10px 14px', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <p style={{ color: 'white', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{tr('inq_success', lang as any)}</p>
            <button onClick={onClose} style={{ marginTop: 24, backgroundColor: GOLD, color: '#000', padding: '10px 28px', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Close</button>
          </div>
        ) : (
          <>
            {experience ? (
              <>
                <h3 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>
                  {tr('exp_book', lang as any)}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 24 }}>{experience.title_en}</p>
              </>
            ) : (
              <h3 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, marginBottom: 24 }}>
                {tr('gp_contact', lang as any)} — {guide?.name}
              </h3>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input placeholder={tr('inq_name', lang as any)} value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle} />
              <input placeholder={tr('inq_email', lang as any)} type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle} />
              <div style={{ display: 'flex', gap: 10 }}>
                <input placeholder={tr('inq_country', lang as any)} value={form.country} onChange={e => set('country', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              </div>
              <input
                placeholder={experience ? tr('inq_group', lang as any) : `${tr('inq_group', lang as any)} (${tr('exp_min_max', lang as any)})`}
                type="number" min={1} max={50} value={form.group} onChange={e => set('group', e.target.value)} style={inputStyle}
              />
              <textarea placeholder={tr('inq_message', lang as any)} value={form.message} onChange={e => set('message', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            {/* Direct contact links */}
            {guide && (guide.contact_whatsapp || guide.contact_line || guide.contact_telegram) && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 10 }}>{tr('inq_or_open', lang as any)}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {guide.contact_whatsapp && (
                    <a href={`https://wa.me/${guide.contact_whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#25D366', color: '#fff', padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                      WhatsApp
                    </a>
                  )}
                  {guide.contact_line && (
                    <a href={`https://line.me/R/ti/p/${guide.contact_line}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#00B900', color: '#fff', padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                      LINE
                    </a>
                  )}
                  {guide.contact_telegram && (
                    <a href={`https://t.me/${guide.contact_telegram.replace('@','')}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#2CA5E0', color: '#fff', padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                      Telegram
                    </a>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={onClose} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button onClick={submit} disabled={sending || !form.name || !form.message}
                style={{ flex: 2, backgroundColor: GOLD, color: '#000', padding: '12px', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: sending ? 0.7 : 1 }}>
                {sending ? '…' : tr('inq_submit', lang as any)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
