'use client'

export type Persona = 'owner' | 'manager' | 'new'

const CARDS: { id: Persona; icon: string; title: string; sub: string }[] = [
  { id: 'owner',   icon: '🧑‍💼', title: 'เจ้าของร้านกาแฟ',     sub: 'ดูแลร้านและจัดการทุกอย่าง'        },
  { id: 'manager', icon: '🏪',   title: 'คุมทีม / หลายสาขา',    sub: 'บริหารพนักงานและหลายสถานที่'      },
  { id: 'new',     icon: '✨',   title: 'เพิ่งเปิดร้านใหม่',     sub: 'ยังไม่มีเมนู ไม่มีพนักงาน'       },
]

interface Props {
  value: Persona
  onChange: (p: Persona) => void
  onNext: () => void
}

export function PersonaSelect({ value, onChange, onNext }: Props) {
  return (
    <div>
      <h2 style={{ color: 'white', fontWeight: 800, fontSize: 24, marginBottom: 6, fontFamily: 'var(--font-heading)', lineHeight: 1.2 }}>
        คุณเป็นใคร?
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 28, lineHeight: 1.5 }}>
        เพื่อให้เราเตรียมระบบได้เหมาะกับคุณ
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {CARDS.map(card => {
          const selected = value === card.id
          return (
            <button
              key={card.id}
              onClick={() => onChange(card.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '18px 20px',
                backgroundColor: selected ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${selected ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                width: '100%', fontFamily: 'inherit',
                transition: 'border-color 0.15s, background-color 0.15s',
              }}
            >
              <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>{card.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{card.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 3 }}>{card.sub}</div>
              </div>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                backgroundColor: selected ? '#c9a84c' : 'rgba(255,255,255,0.06)',
                border: selected ? 'none' : '1px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 0.15s',
                animation: selected ? 'checkIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
              }}>
                {selected && <span style={{ color: '#000', fontSize: 11, fontWeight: 800 }}>✓</span>}
              </div>
            </button>
          )
        })}
      </div>

      <button
        onClick={onNext}
        style={{
          width: '100%', backgroundColor: '#c9a84c', color: '#000',
          border: 'none', borderRadius: 12, padding: '15px',
          fontSize: 15, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', transition: 'opacity 0.15s',
          letterSpacing: '0.3px',
        }}
      >
        ถัดไป →
      </button>
    </div>
  )
}
