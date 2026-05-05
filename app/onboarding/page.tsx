'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const GOLD = '#c9a84c'
const STEPS = 5

const inp: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '14px 16px',
  color: 'white',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const label: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.5px',
  display: 'block',
  marginBottom: 6,
}

function Field({ lab, children }: { lab: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={label}>{lab}</label>
      {children}
    </div>
  )
}

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1 — shop info
  const [shopName, setShopName] = useState('Alan Coffee & Travel')
  const [shopSlug, setShopSlug] = useState('alan-cafe')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('Attapeu')

  // Step 3 — first menu item
  const [menuName, setMenuName] = useState('')
  const [menuPrice, setMenuPrice] = useState('')
  const [skipMenu, setSkipMenu] = useState(false)

  // Step 4 — printer
  const [hasPrinter, setHasPrinter] = useState<'yes' | 'no' | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [user, authLoading, router])

  const slugify = (v: string) =>
    v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40)

  const saveAndFinish = async () => {
    setSaving(true)
    try {
      const { supabase } = await import('@/lib/supabase')

      // Get or create the alan-cafe shop
      const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('slug', shopSlug)
        .maybeSingle()

      const shopId = shop?.id

      if (shopId && user) {
        // Link this user to the shop
        await supabase.from('shop_users').upsert({
          shop_id: shopId,
          user_id: user.id,
          email: user.email!,
          role: 'owner',
          full_name: user.user_metadata?.full_name ?? null,
          accepted_at: new Date().toISOString(),
          active: true,
        }, { onConflict: 'shop_id,email' })

        // Optionally add first menu item
        if (menuName && menuPrice && !skipMenu) {
          await supabase.from('recipes').insert({
            product_name: menuName,
            price_lak: parseInt(menuPrice.replace(/[^0-9]/g, '')) || 0,
            is_active: true,
            shop_id: shopId,
          })
        }
      }
    } catch {
      // DB not set up yet — still proceed
    }
    setSaving(false)
    router.replace('/cafe')
  }

  const stepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <h2 style={{ color: 'white', fontWeight: 800, fontSize: 24, marginBottom: 8, fontFamily: 'var(--font-heading)' }}>
              ข้อมูลร้านค้า
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 28 }}>
              ตั้งชื่อร้านและข้อมูลพื้นฐาน
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field lab="ชื่อร้าน *">
                <input
                  style={inp}
                  value={shopName}
                  onChange={e => { setShopName(e.target.value); setShopSlug(slugify(e.target.value)) }}
                  placeholder="ชื่อร้านของคุณ"
                />
              </Field>
              <Field lab="ชื่อ URL (slug)">
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                    alancafeos.com/
                  </span>
                  <input
                    style={{ ...inp, paddingLeft: 140 }}
                    value={shopSlug}
                    onChange={e => setShopSlug(slugify(e.target.value))}
                    placeholder="alan-cafe"
                  />
                </div>
              </Field>
              <Field lab="เบอร์โทรศัพท์">
                <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+856 20..." />
              </Field>
              <Field lab="เมือง / จังหวัด">
                <input style={inp} value={city} onChange={e => setCity(e.target.value)} placeholder="Attapeu" />
              </Field>
            </div>
          </>
        )

      case 2:
        return (
          <>
            <h2 style={{ color: 'white', fontWeight: 800, fontSize: 24, marginBottom: 8, fontFamily: 'var(--font-heading)' }}>
              ยืนยันการตั้งค่า
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 28 }}>
              ตรวจสอบข้อมูลก่อนดำเนินการต่อ
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['ชื่อร้าน', shopName || '—'],
                ['URL', `alancafeos.com/${shopSlug || '—'}`],
                ['เบอร์โทร', phone || '(ยังไม่ระบุ)'],
                ['เมือง', city || '(ยังไม่ระบุ)'],
                ['แผน', 'Free Beta — ฟรีทุกอย่าง'],
                ['สกุลเงิน', 'LAK (กีบ)'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{k}</span>
                  <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </>
        )

      case 3:
        return (
          <>
            <h2 style={{ color: 'white', fontWeight: 800, fontSize: 24, marginBottom: 8, fontFamily: 'var(--font-heading)' }}>
              เพิ่มเมนูแรก
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 28 }}>
              เพิ่มเมนูอย่างน้อยหนึ่งอย่าง หรือข้ามและเพิ่มทีหลัง
            </p>
            {!skipMenu ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field lab="ชื่อเมนู">
                  <input style={inp} value={menuName} onChange={e => setMenuName(e.target.value)} placeholder="เช่น กาแฟดำ, ลาเต้..." />
                </Field>
                <Field lab="ราคา (กีบ)">
                  <input style={inp} value={menuPrice} onChange={e => setMenuPrice(e.target.value)} placeholder="เช่น 15000" type="number" />
                </Field>
                <button onClick={() => setSkipMenu(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                  ข้ามขั้นตอนนี้ →
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>ข้ามแล้ว — เพิ่มเมนูได้จากแดชบอร์ด</div>
                <button onClick={() => setSkipMenu(false)} style={{ marginTop: 12, background: 'none', border: 'none', color: GOLD, fontSize: 13, cursor: 'pointer' }}>
                  + เพิ่มเมนูเลย
                </button>
              </div>
            )}
          </>
        )

      case 4:
        return (
          <>
            <h2 style={{ color: 'white', fontWeight: 800, fontSize: 24, marginBottom: 8, fontFamily: 'var(--font-heading)' }}>
              เครื่องพิมพ์ใบเสร็จ
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 28 }}>
              Alan CafeOS รองรับเครื่องพิมพ์ความร้อน Xprinter และอื่น ๆ
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { id: 'yes' as const, title: 'มีเครื่องพิมพ์อยู่แล้ว', sub: 'ตั้งค่าในภายหลังจาก Settings' },
                { id: 'no' as const, title: 'ยังไม่มีเครื่องพิมพ์', sub: 'ข้ามได้ก่อน ตั้งค่าทีหลัง' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setHasPrinter(opt.id)}
                  style={{
                    padding: '16px 20px',
                    backgroundColor: hasPrinter === opt.id ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${hasPrinter === opt.id ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'white',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{opt.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>{opt.sub}</div>
                </button>
              ))}
            </div>
          </>
        )

      case 5:
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>✓</div>
            <h2 style={{ color: 'white', fontWeight: 800, fontSize: 28, marginBottom: 12, fontFamily: 'var(--font-heading)' }}>
              ยินดีต้อนรับ!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16, lineHeight: 1.7, marginBottom: 32 }}>
              {shopName} พร้อมแล้ว<br />
              Alan CafeOS จะเริ่มต้นทำงานสำหรับร้านของคุณ
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              {[
                ['เมนู', 'เพิ่มและจัดการเมนูทั้งหมด'],
                ['สต็อก', 'ติดตามวัตถุดิบ'],
                ['รายงาน', 'ยอดขายและกำไร'],
                ['พนักงาน', 'บันทึกเวลาทำงาน'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                  <span style={{ color: GOLD, fontWeight: 700, minWidth: 60, textAlign: 'right' }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )
    }
  }

  const canNext = () => {
    if (step === 1) return !!shopName
    if (step === 4) return hasPrinter !== null
    return true
  }

  const handleNext = () => {
    if (step < STEPS) setStep(s => s + 1)
    else saveAndFinish()
  }

  if (authLoading) return null

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: GOLD, fontFamily: 'var(--font-heading)', letterSpacing: '-0.5px' }}>
          ALAN <span style={{ color: 'rgba(201,168,76,0.4)', fontSize: 11, letterSpacing: '3px', fontWeight: 600 }}>CafeOS</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 480, marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 99,
                backgroundColor: i < step ? GOLD : 'rgba(255,255,255,0.1)',
                transition: 'background-color 0.3s',
              }}
            />
          ))}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 8, textAlign: 'right' }}>
          ขั้นตอน {step}/{STEPS}
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 480,
        backgroundColor: '#111',
        border: '1px solid rgba(201,168,76,0.15)',
        borderRadius: 20,
        padding: '36px 32px',
      }}>
        {stepContent()}

        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '13px',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ← ย้อนกลับ
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canNext() || saving}
            style={{
              flex: 2,
              backgroundColor: canNext() && !saving ? GOLD : 'rgba(201,168,76,0.3)',
              color: '#000',
              border: 'none',
              borderRadius: 10,
              padding: '14px',
              fontSize: 15,
              fontWeight: 700,
              cursor: canNext() && !saving ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              transition: 'background-color 0.15s',
            }}
          >
            {saving ? 'กำลังบันทึก...' : step === STEPS ? 'ไปที่แดชบอร์ด →' : 'ถัดไป →'}
          </button>
        </div>
      </div>
    </main>
  )
}
