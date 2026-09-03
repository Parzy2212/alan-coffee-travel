'use client'

import { useEffect, useRef, useState } from 'react'
import { IBM_Plex_Sans_Thai } from 'next/font/google'
import { useShop } from '@/lib/use-shop'
import { logAccountEvent } from '@/lib/account-events'
import { SaveButton } from './ShopIdentitySection'
import {
  BG_CARD, BG_CARD_ALT, BORDER_SUBTLE, BORDER_DEFAULT,
  TEXT_1, TEXT_2, TEXT_3, DANGER, RADIUS,
} from '@/lib/pos-theme-tokens'

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

const CARD: React.CSSProperties = { backgroundColor: BG_CARD, border: `1px solid ${BORDER_SUBTLE}`, borderRadius: RADIUS['2xl'], padding: 24, marginBottom: 24 }
const LABEL: React.CSSProperties = { color: TEXT_2, fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', display: 'block', marginBottom: 6 }
const INP: React.CSSProperties = { width: '100%', backgroundColor: BG_CARD_ALT, border: `1px solid ${BORDER_DEFAULT}`, borderRadius: RADIUS.md, padding: '12px 14px', color: TEXT_1, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' }

const CITIES = ['Vientiane', 'Luang Prabang', 'Pakse', 'Savannakhet', 'Attapeu', 'Other']
const COUNTRIES = ['Laos', 'Thailand', 'Vietnam', 'Cambodia', 'Other']

export function ContactSection() {
  const { shop, shopId, loading } = useShop()
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('Vientiane')
  const [country, setCountry] = useState('Laos')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!shop) return
    setPhone(shop.phone ?? '')
    setEmail(shop.email ?? '')
    setCity(shop.city ?? 'Vientiane')
    setCountry(shop.country ?? 'Laos')
  }, [shop])

  const handleSave = async () => {
    if (!shopId) return
    setSaving(true); setError('')
    if (timer.current) clearTimeout(timer.current)
    try {
      const { authClient } = await import('@/lib/supabase-auth')
      const { error: err } = await authClient.from('shops').update({ phone: phone.trim() || null, email: email.trim() || null, city, country }).eq('id', shopId)
      if (err) throw err
      await logAccountEvent('shop_settings_updated' as never, 'Contact info updated')
      setSaved(true)
      timer.current = setTimeout(() => setSaved(false), 2500)
    } catch (e) { setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด') }
    finally { setSaving(false) }
  }

  return (
    <div className={ibmPlexSansThai.className} style={CARD}>
      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_2, marginBottom: 20 }}>ข้อมูลติดต่อ</div>
      {loading ? (
        <div style={{ height: 180, borderRadius: RADIUS.md, backgroundColor: BG_CARD_ALT }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>เบอร์โทรศัพท์</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="020-xxx-xxxx" style={INP} />
            </div>
            <div>
              <label style={LABEL}>อีเมลร้าน</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cafe@example.com" style={INP} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>เมือง</label>
              <div style={{ position: 'relative' }}>
                <select value={city} onChange={e => setCity(e.target.value)} style={{ ...INP, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', paddingRight: 36 }}>
                  {CITIES.map(c => <option key={c} value={c} style={{ backgroundColor: BG_CARD_ALT }}>{c}</option>)}
                </select>
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: TEXT_3, pointerEvents: 'none', fontSize: 10 }}>▼</div>
              </div>
            </div>
            <div>
              <label style={LABEL}>ประเทศ</label>
              <div style={{ position: 'relative' }}>
                <select value={country} onChange={e => setCountry(e.target.value)} style={{ ...INP, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', paddingRight: 36 }}>
                  {COUNTRIES.map(c => <option key={c} value={c} style={{ backgroundColor: BG_CARD_ALT }}>{c}</option>)}
                </select>
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: TEXT_3, pointerEvents: 'none', fontSize: 10 }}>▼</div>
              </div>
            </div>
          </div>
          {error && <div style={{ backgroundColor: `${DANGER}14`, border: `1px solid ${DANGER}33`, borderRadius: RADIUS.md, padding: '10px 14px', color: DANGER, fontSize: 13 }}>{error}</div>}
          <SaveButton saving={saving} saved={saved} onClick={handleSave} />
        </div>
      )}
    </div>
  )
}
