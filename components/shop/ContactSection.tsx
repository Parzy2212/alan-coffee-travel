'use client'

import { useEffect, useRef, useState } from 'react'
import { useShop } from '@/lib/use-shop'
import { logAccountEvent } from '@/lib/account-events'
import { SaveButton } from './ShopIdentitySection'

const CARD: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 24 }
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', display: 'block', marginBottom: 6 }
const INP: React.CSSProperties = { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 14px', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' }

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
    <div style={CARD}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>ข้อมูลติดต่อ</div>
      {loading ? (
        <div style={{ height: 180, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)' }} />
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
                  {CITIES.map(c => <option key={c} value={c} style={{ backgroundColor: '#1a1a1a' }}>{c}</option>)}
                </select>
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none', fontSize: 10 }}>▼</div>
              </div>
            </div>
            <div>
              <label style={LABEL}>ประเทศ</label>
              <div style={{ position: 'relative' }}>
                <select value={country} onChange={e => setCountry(e.target.value)} style={{ ...INP, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', paddingRight: 36 }}>
                  {COUNTRIES.map(c => <option key={c} value={c} style={{ backgroundColor: '#1a1a1a' }}>{c}</option>)}
                </select>
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none', fontSize: 10 }}>▼</div>
              </div>
            </div>
          </div>
          {error && <div style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13 }}>{error}</div>}
          <SaveButton saving={saving} saved={saved} onClick={handleSave} />
        </div>
      )}
    </div>
  )
}
