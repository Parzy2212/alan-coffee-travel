'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const LS_FIRST  = 'alan_welcome_first_seen'
const LS_DIMISS = 'alan_welcome_dismissed'
const SEVEN_DAYS = 7 * 86400000

export function WelcomeBanner() {
  const [show,     setShow]     = useState(false)
  const [shopName, setShopName] = useState('')

  useEffect(() => {
    if (localStorage.getItem(LS_DIMISS)) return

    let first = localStorage.getItem(LS_FIRST)
    if (!first) {
      first = String(Date.now())
      localStorage.setItem(LS_FIRST, first)
    }

    if (Date.now() - Number(first) >= SEVEN_DAYS) return

    setShow(true)

    supabase.from('site_settings').select('value').eq('key', 'shop_name').maybeSingle()
      .then(({ data }) => { if (data?.value) setShopName(data.value as string) })
  }, [])

  if (!show) return null

  const dismiss = () => {
    localStorage.setItem(LS_DIMISS, '1')
    setShow(false)
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(201,168,76,0.18) 0%, rgba(201,168,76,0.06) 100%)',
      border: '1px solid rgba(201,168,76,0.4)',
      borderRadius: 14, padding: '20px 24px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
          ยินดีต้อนรับสู่ Alan Cafe OS{shopName ? `, ${shopName}!` : '!'}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 16 }}>
          ตั้งค่าร้านของคุณใน 5 ขั้นตอนง่ายๆ ดูรายการด้านล่างและเริ่มต้นได้เลย
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="/pos" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 18px', borderRadius: 8, textDecoration: 'none',
            backgroundColor: '#c9a84c', color: '#000',
            fontSize: 13, fontWeight: 700,
          }}>
            ▶ เปิดทดลองใช้งาน POS
          </a>
          <button onClick={dismiss} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
            backgroundColor: 'transparent', color: 'rgba(255,255,255,0.45)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            เข้าใจแล้ว ไม่ต้องแสดง
          </button>
        </div>
      </div>
      <button onClick={dismiss} style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
        fontSize: 22, cursor: 'pointer', flexShrink: 0, padding: '0 4px', lineHeight: 1,
      }}>
        ×
      </button>
    </div>
  )
}
