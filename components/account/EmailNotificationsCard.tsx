'use client'

import { useEffect, useRef } from 'react'
import type { NotificationPrefs } from '@/lib/notification-preferences'

const GOLD = '#c9a84c'
const CARD: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, padding: 24, marginBottom: 24,
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      style={{
        flexShrink: 0, width: 44, height: 24, borderRadius: 12, border: 'none',
        backgroundColor: on ? GOLD : 'rgba(255,255,255,0.12)',
        cursor: disabled ? 'default' : 'pointer',
        position: 'relative', transition: 'background-color 0.2s',
        opacity: disabled ? 0.55 : 1,
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

function ToggleRow({
  icon, title, help, value, onChange, locked,
}: {
  icon: string; title: string; help: string
  value: boolean; onChange: (v: boolean) => void; locked?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
          {title}
          {locked && <span style={{ marginLeft: 8, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>🔒 บังคับเปิด</span>}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, lineHeight: 1.5 }}>{help}</div>
      </div>
      <Toggle on={locked ? true : value} onChange={onChange} disabled={locked} />
    </div>
  )
}

function GroupLabel({ label }: { label: string }) {
  return (
    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '16px 0 4px' }}>
      {label}
    </div>
  )
}

interface Props {
  prefs: NotificationPrefs
  onChange: (patch: Partial<NotificationPrefs>) => void
  savedAt: number
}

export function EmailNotificationsCard({ prefs, onChange, savedAt }: Props) {
  const savedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!savedAt || !savedRef.current) return
    savedRef.current.style.opacity = '1'
    const t = setTimeout(() => { if (savedRef.current) savedRef.current.style.opacity = '0' }, 2000)
    return () => clearTimeout(t)
  }, [savedAt])

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 600 }}>อีเมล</div>
        <div ref={savedRef} style={{ color: '#4cba7f', fontSize: 12, fontWeight: 600, opacity: 0, transition: 'opacity 0.3s' }}>
          บันทึกแล้ว ✓
        </div>
      </div>

      <GroupLabel label="รายงานธุรกิจ" />
      <ToggleRow icon="📊" title="รายงานประจำวัน" help="ส่งทุกเย็น สรุปยอดขายและออเดอร์วันนี้"
        value={prefs.email_daily_report} onChange={v => onChange({ email_daily_report: v })} />
      <ToggleRow icon="📈" title="รายงานประจำสัปดาห์" help="ส่งทุกวันจันทร์ สรุปผลประกอบการสัปดาห์ที่ผ่านมา"
        value={prefs.email_weekly_report} onChange={v => onChange({ email_weekly_report: v })} />

      <GroupLabel label="การแจ้งเตือน" />
      <ToggleRow icon="📦" title="สต็อกใกล้หมด" help="เมื่อวัตถุดิบใกล้ถึงจุดสั่งซื้อใหม่"
        value={prefs.email_low_stock} onChange={v => onChange({ email_low_stock: v })} />
      <ToggleRow icon="🎉" title="ออเดอร์ใหญ่" help="เมื่อมีออเดอร์เกินจำนวนที่กำหนด"
        value={prefs.email_large_order} onChange={v => onChange({ email_large_order: v })} />
      <ToggleRow icon="👥" title="สมาชิกใหม่" help="เมื่อมีสมาชิกใหม่ตอบรับคำเชิญ"
        value={prefs.email_new_member} onChange={v => onChange({ email_new_member: v })} />
      <ToggleRow icon="🔒" title="การแจ้งเตือนความปลอดภัย" help="การเข้าสู่ระบบจากอุปกรณ์ใหม่ การเปลี่ยนรหัสผ่าน"
        value={prefs.email_security_alerts} onChange={v => onChange({ email_security_alerts: v })} locked />

      <GroupLabel label="การตลาด" />
      <ToggleRow icon="💌" title="ข่าวสารและโปรโมชัน" help="อัปเดตฟีเจอร์ใหม่และเคล็ดลับการใช้งาน"
        value={prefs.email_marketing} onChange={v => onChange({ email_marketing: v })} />
    </div>
  )
}
