'use client'

const GOLD = '#c9a84c'

export type DateRange = 'today' | '7d' | '30d' | '90d' | 'all'

export const EVENT_TYPES = [
  { value: 'login',                    icon: '🔓', label: 'เข้าสู่ระบบ'     },
  { value: 'logout',                   icon: '🔒', label: 'ออกจากระบบ'       },
  { value: 'password_changed',         icon: '🔑', label: 'เปลี่ยนรหัสผ่าน' },
  { value: 'password_reset',           icon: '🔓', label: 'รีเซ็ตรหัสผ่าน'  },
  { value: 'profile_updated',          icon: '👤', label: 'อัปเดตโปรไฟล์'   },
  { value: 'sessions_revoked',         icon: '🚪', label: 'ออกทุกอุปกรณ์'   },
  { value: 'shop_settings_updated',    icon: '⚙️', label: 'ตั้งค่าร้านค้า'   },
  { value: 'team_invitation_sent',     icon: '📧', label: 'ส่งคำเชิญ'        },
  { value: 'team_invitation_accepted', icon: '✅', label: 'ตอบรับคำเชิญ'    },
  { value: 'account_deleted',          icon: '🗑️', label: 'ลบบัญชี'          },
]

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'วันนี้' },
  { value: '7d',    label: '7 วัน'  },
  { value: '30d',   label: '30 วัน' },
  { value: '90d',   label: '90 วัน' },
  { value: 'all',   label: 'ทั้งหมด' },
]

interface Props {
  dateRange: DateRange
  selectedTypes: string[]
  onDateRange: (v: DateRange) => void
  onToggleType: (v: string) => void
  onClear: () => void
  total: number
}

export function ActivityFilters({ dateRange, selectedTypes, onDateRange, onToggleType, onClear, total }: Props) {
  const hasFilter = dateRange !== '30d' || selectedTypes.length > 0

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Date range pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {DATE_RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => onDateRange(r.value)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              backgroundColor: dateRange === r.value ? GOLD : 'rgba(255,255,255,0.06)',
              color: dateRange === r.value ? '#000' : 'rgba(255,255,255,0.5)',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Event type chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {EVENT_TYPES.map(t => {
          const on = selectedTypes.includes(t.value)
          return (
            <button
              key={t.value}
              onClick={() => onToggleType(t.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 6, border: `1px solid ${on ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.07)'}`,
                fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                backgroundColor: on ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.03)',
                color: on ? GOLD : 'rgba(255,255,255,0.4)',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 11 }}>{t.icon}</span> {t.label}
            </button>
          )
        })}
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          {total.toLocaleString()} รายการ
        </span>
        {hasFilter && (
          <button
            onClick={onClear}
            style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: 'inherit' }}
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>
    </div>
  )
}
