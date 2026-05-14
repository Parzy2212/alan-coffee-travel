'use client'

const YELLOW = '#f59e0b'

export function TestModeBanner({ onDisable }: { onDisable: () => void }) {
  return (
    <div style={{
      backgroundColor: `${YELLOW}18`,
      border: `1px solid ${YELLOW}55`,
      borderRadius: 0,
      padding: '6px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>🧪</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: YELLOW, letterSpacing: '0.5px' }}>
          โหมดทดสอบ — ออเดอร์จะถูกทำเครื่องหมาย TEST ไม่นับยอดขายจริง
        </span>
      </div>
      <button
        onClick={onDisable}
        style={{
          padding: '3px 12px', borderRadius: 6, border: `1px solid ${YELLOW}66`,
          backgroundColor: `${YELLOW}20`, color: YELLOW, fontSize: 11, fontWeight: 700,
          cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        ปิดโหมดทดสอบ
      </button>
    </div>
  )
}
