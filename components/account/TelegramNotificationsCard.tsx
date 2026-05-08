'use client'

import { useState } from 'react'
import type { NotificationPrefs } from '@/lib/notification-preferences'

const GOLD = '#c9a84c'
const CARD: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, padding: 24, marginBottom: 24,
}
const INP: React.CSSProperties = {
  width: '100%', backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  padding: '10px 14px', color: 'white', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch" aria-checked={on} onClick={() => onChange(!on)}
      style={{
        flexShrink: 0, width: 44, height: 24, borderRadius: 12, border: 'none',
        backgroundColor: on ? GOLD : 'rgba(255,255,255,0.12)',
        cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: on ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', backgroundColor: 'white',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }} />
    </button>
  )
}

interface Props {
  prefs: NotificationPrefs
  onChange: (patch: Partial<NotificationPrefs>) => void
}

export function TelegramNotificationsCard({ prefs, onChange }: Props) {
  const [testMsg, setTestMsg] = useState('')

  const handleTest = () => {
    // TODO Phase 8: call edge function to send test message
    setTestMsg('ฟีเจอร์นี้จะมาในเร็วๆ นี้ (Phase 8)')
    setTimeout(() => setTestMsg(''), 3000)
  }

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 600 }}>Telegram</div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 2 }}>รับการแจ้งเตือนผ่าน Telegram</div>
        </div>
        <Toggle on={prefs.telegram_enabled} onChange={v => onChange({ telegram_enabled: v })} />
      </div>

      {prefs.telegram_enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />

          <div>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>
              Telegram Chat ID
            </label>
            <input
              type="text"
              value={prefs.telegram_chat_id ?? ''}
              onChange={e => onChange({ telegram_chat_id: e.target.value || null })}
              placeholder="-1001234567890"
              style={INP}
            />
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
              ส่ง /start ให้ @userinfobot เพื่อดู Chat ID ของคุณ
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleTest}
              style={{
                padding: '9px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
                backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ส่งข้อความทดสอบ
            </button>
            {testMsg && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{testMsg}</span>}
          </div>

          <div style={{
            backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8, padding: '10px 14px',
          }}>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, lineHeight: 1.6 }}>
              หมายเหตุ: ร้านค้าอาจมี Telegram Bot ตั้งค่าในระดับร้านอยู่แล้ว
              การตั้งค่านี้จะ override เฉพาะสำหรับบัญชีของคุณ
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
