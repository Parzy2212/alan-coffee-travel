'use client'

const CITIES = [
  'Vientiane', 'Luang Prabang', 'Champasak', 'Attapeu',
  'Savannakhet', 'Xiangkhouang', 'Bokeo', 'Oudomxay', 'Other',
]

const inp: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '13px 16px',
  color: 'white',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
}

interface Props {
  shopName: string
  onShopNameChange: (v: string) => void
  city: string
  onCityChange: (v: string) => void
  onNext: () => void
  onBack: () => void
}

function ReceiptPreview({ shopName, city }: { shopName: string; city: string }) {
  const name = shopName.trim() || 'ชื่อร้านของคุณ'
  const isEmpty = !shopName.trim()

  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      padding: '16px 20px',
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: 12,
      lineHeight: 1.9,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 2 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: isEmpty ? 'rgba(255,255,255,0.25)' : 'white', letterSpacing: '0.5px', transition: 'color 0.15s' }}>
          {name}
        </span>
      </div>
      {city && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 6 }}>
          {city}, Laos
        </div>
      )}
      <div style={{ borderTop: '1px dashed rgba(255,255,255,0.12)', paddingTop: 8, color: 'rgba(255,255,255,0.55)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>กาแฟดำ</span>
          <span>15,000</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.35)' }}>
          <span>ลาเต้</span>
          <span>20,000</span>
        </div>
      </div>
      <div style={{ borderTop: '1px dashed rgba(255,255,255,0.12)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', color: 'white', fontWeight: 700 }}>
        <span>TOTAL</span>
        <span>35,000 LAK</span>
      </div>
      <div style={{ borderTop: '1px dashed rgba(255,255,255,0.12)', marginTop: 6, paddingTop: 6, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>
        ขอบคุณที่ใช้บริการ ☕
      </div>
    </div>
  )
}

export function ShopIdentity({ shopName, onShopNameChange, city, onCityChange, onNext, onBack }: Props) {
  const canNext = shopName.trim().length > 0

  return (
    <div>
      <h2 style={{ color: 'white', fontWeight: 800, fontSize: 24, marginBottom: 6, fontFamily: 'var(--font-heading)', lineHeight: 1.2 }}>
        ร้านของคุณชื่ออะไร?
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 28, lineHeight: 1.5 }}>
        ชื่อนี้จะปรากฏบนใบเสร็จของลูกค้า
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {/* Shop name */}
        <div>
          <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', display: 'block', marginBottom: 7 }}>
            ชื่อร้าน <span style={{ color: 'rgba(201,168,76,0.8)' }}>*</span>
          </label>
          <input
            style={{ ...inp, borderColor: shopName.trim() ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)' }}
            value={shopName}
            onChange={e => onShopNameChange(e.target.value)}
            placeholder="ชื่อร้านของคุณ"
            autoFocus
          />
        </div>

        {/* City */}
        <div>
          <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', display: 'block', marginBottom: 7 }}>
            เมือง / แขวง
          </label>
          <select
            value={city}
            onChange={e => onCityChange(e.target.value)}
            style={{ ...inp, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(255,255,255,0.3)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 40, cursor: 'pointer' }}
          >
            {CITIES.map(c => (
              <option key={c} value={c} style={{ backgroundColor: '#1a1a1a' }}>{c}</option>
            ))}
          </select>
        </div>

        {/* Live receipt preview */}
        <div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', marginBottom: 8 }}>
            ตัวอย่างใบเสร็จ
          </div>
          <ReceiptPreview shopName={shopName} city={city} />
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onBack}
          style={{
            flex: 1, backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
            padding: '14px', color: 'rgba(255,255,255,0.5)',
            fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ← ย้อนกลับ
        </button>
        <button
          onClick={onNext}
          disabled={!canNext}
          style={{
            flex: 2, backgroundColor: canNext ? '#c9a84c' : 'rgba(201,168,76,0.2)',
            color: canNext ? '#000' : 'rgba(255,255,255,0.25)',
            border: 'none', borderRadius: 12, padding: '14px',
            fontSize: 15, fontWeight: 700,
            cursor: canNext ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
        >
          ถัดไป →
        </button>
      </div>
    </div>
  )
}
