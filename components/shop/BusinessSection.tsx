'use client'

import { useEffect, useRef, useState } from 'react'
import { useShop } from '@/lib/use-shop'
import { logAccountEvent } from '@/lib/account-events'
import { SaveButton } from './ShopIdentitySection'

const CARD: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 24 }
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', display: 'block', marginBottom: 6 }
const INP: React.CSSProperties = { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 14px', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' }

const CURRENCIES = [{ value: 'LAK', label: 'LAK — กีบลาว' }, { value: 'THB', label: 'THB — บาทไทย' }, { value: 'USD', label: 'USD — ดอลลาร์' }, { value: 'VND', label: 'VND — ดองเวียดนาม' }]
const LANGUAGES  = [{ value: 'th', label: 'ไทย' }, { value: 'lo', label: 'ລາວ' }, { value: 'en', label: 'English' }]
const TIMEZONES  = [{ value: 'Asia/Vientiane', label: 'Asia/Vientiane (UTC+7)' }, { value: 'Asia/Bangkok', label: 'Asia/Bangkok (UTC+7)' }, { value: 'Asia/Yangon', label: 'Asia/Yangon (UTC+6:30)' }, { value: 'Asia/Kolkata', label: 'Asia/Kolkata (UTC+5:30)' }, { value: 'UTC', label: 'UTC (UTC+0)' }]

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      <div style={{ position: 'relative' }}>
        <select value={value} onChange={e => onChange(e.target.value)} style={{ ...INP, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', paddingRight: 36 }}>
          {options.map(o => <option key={o.value} value={o.value} style={{ backgroundColor: '#1a1a1a' }}>{o.label}</option>)}
        </select>
        <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none', fontSize: 10 }}>▼</div>
      </div>
    </div>
  )
}

export function BusinessSection() {
  const { shop, shopId, loading } = useShop()
  const [currency, setCurrency] = useState('LAK')
  const [language, setLanguage] = useState('th')
  const [timezone, setTimezone] = useState('Asia/Vientiane')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!shop) return
    setCurrency(shop.currency ?? 'LAK')
    setLanguage(shop.language ?? 'th')
    setTimezone(shop.timezone ?? 'Asia/Vientiane')
  }, [shop])

  const handleSave = async () => {
    if (!shopId) return
    setSaving(true); setError('')
    if (timer.current) clearTimeout(timer.current)
    try {
      const { authClient } = await import('@/lib/supabase-auth')
      const { error: err } = await authClient.from('shops').update({ currency, language, timezone }).eq('id', shopId)
      if (err) throw err
      await logAccountEvent('shop_settings_updated' as never, 'Business settings updated')
      setSaved(true)
      timer.current = setTimeout(() => setSaved(false), 2500)
    } catch (e) { setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด') }
    finally { setSaving(false) }
  }

  return (
    <div style={CARD}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>การตั้งค่าธุรกิจ</div>
      {loading ? (
        <div style={{ height: 160, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Sel label="สกุลเงิน" value={currency} onChange={setCurrency} options={CURRENCIES} />
            <Sel label="ภาษาเริ่มต้น" value={language} onChange={setLanguage} options={LANGUAGES} />
          </div>
          <Sel label="เขตเวลา" value={timezone} onChange={setTimezone} options={TIMEZONES} />
          {error && <div style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13 }}>{error}</div>}
          <SaveButton saving={saving} saved={saved} onClick={handleSave} />
        </div>
      )}
    </div>
  )
}
