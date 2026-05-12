'use client'

const GOLD = '#c9a84c'

const SHORTCUTS = [
  { keys: ['Ctrl', 'P'], action: 'เปิดหน้าชำระเงิน' },
  { keys: ['Ctrl', 'H'], action: 'พักออเดอร์ปัจจุบัน' },
  { keys: ['Ctrl', 'L'], action: 'ดูออเดอร์ที่พักไว้' },
  { keys: ['/'],          action: 'โฟกัสช่องค้นหาเมนู' },
  { keys: ['Esc'],        action: 'ปิด popup / modal' },
  { keys: ['F1', '?'],    action: 'แสดง / ซ่อน shortcuts' },
]

export interface KeyboardShortcutsProps {
  onClose: () => void
}

export function KeyboardShortcuts({ onClose }: KeyboardShortcutsProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        backgroundColor: 'rgba(0,0,0,0.78)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#181818',
          border: `1px solid rgba(201,168,76,0.2)`,
          borderRadius: 16,
          padding: '24px 28px',
          width: '100%', maxWidth: 380,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Keyboard Shortcuts</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>สำหรับผู้ใช้ขั้นสูง</div>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.35)', fontSize: 22,
              cursor: 'pointer', lineHeight: 1, padding: '2px 6px',
            }}
          >×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SHORTCUTS.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '11px 14px', borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{s.action}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {s.keys.map((k, j) => (
                  <span key={j}>
                    {j > 0 && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginRight: 4 }}>or</span>}
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px', borderRadius: 6,
                      backgroundColor: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: GOLD, fontSize: 11, fontWeight: 700,
                      fontFamily: "'SF Mono', 'Fira Code', 'Courier New', monospace",
                      letterSpacing: '0.3px',
                    }}>{k}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 18, fontSize: 11,
          color: 'rgba(255,255,255,0.18)', textAlign: 'center',
        }}>
          กด <span style={{ color: GOLD }}>F1</span> หรือ{' '}
          <span style={{ color: GOLD, fontFamily: 'monospace' }}>?</span> เพื่อเปิด / ปิด
        </div>
      </div>
    </div>
  )
}
