'use client'

import { CurrencySection } from '@/components/shop/CurrencySection'
import { TEXT_2 } from '@/lib/pos-theme-tokens'

export function CurrencyClient() {
  return (
    <>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 6 }}>สกุลเงิน</div>
        <div style={{ fontSize: 14, color: TEXT_2 }}>อัตราแลกเปลี่ยนและสกุลเงินที่แสดงในหน้า POS</div>
      </div>
      <CurrencySection />
    </>
  )
}
