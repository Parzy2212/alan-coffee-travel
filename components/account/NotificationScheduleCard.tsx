'use client'

import type { NotificationPrefs } from '@/lib/notification-preferences'

const CARD: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, padding: 24, marginBottom: 24,
}
const SEL: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '10px 14px', color: 'white', fontSize: 14,
  outline: 'none', fontFamily: 'inherit', cursor: 'pointer', width: '100%', boxSizing: 'border-box',
}
const LABEL: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600,
  letterSpacing: '0.4px', display: 'block', marginBottom: 6,
}

const DAYS = [
  { value: 'monday',    label: 'วันจันทร์'  },
  { value: 'tuesday',   label: 'วันอังคาร' },
  { value: 'wednesday', label: 'วันพุธ'    },
  { value: 'thursday',  label: 'วันพฤหัส'  },
  { value: 'friday',    label: 'วันศุกร์'   },
  { value: 'saturday',  label: 'วันเสาร์'   },
  { value: 'sunday',    label: 'วันอาทิตย์' },
]

const LANGUAGES = [
  { value: 'th', label: 'ภาษาไทย' },
  { value: 'lo', label: 'ภาษาลาว' },
  { value: 'en', label: 'English'  },
]

interface Props {
  prefs: NotificationPrefs
  onChange: (patch: Partial<NotificationPrefs>) => void
}

export function NotificationScheduleCard({ prefs, onChange }: Props) {
  return (
    <div style={CARD}>
      <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 600, marginBottom: 20 }}>ตารางเวลา</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={LABEL}>เวลารับรายงานประจำวัน</label>
          <input
            type="time"
            value={prefs.daily_report_time}
            onChange={e => onChange({ daily_report_time: e.target.value })}
            style={{ ...SEL, width: 'auto' }}
          />
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6 }}>
            รายงานจะส่งทุกวันเวลาที่กำหนด (เวลาเวียงจันทน์)
          </div>
        </div>

        <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />

        <div>
          <label style={LABEL}>วันรับรายงานประจำสัปดาห์</label>
          <select value={prefs.weekly_report_day} onChange={e => onChange({ weekly_report_day: e.target.value })} style={SEL}>
            {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />

        <div>
          <label style={LABEL}>ภาษาของอีเมล</label>
          <select value={prefs.notification_language} onChange={e => onChange({ notification_language: e.target.value })} style={SEL}>
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
