'use client'

const GOLD = '#c9a84c'

type Shortcut = { keys: string[]; action: string; group: string }

const SHORTCUTS: Shortcut[] = [
  // Solo-operator quick keys
  { keys: ['1-9'],     action: 'เพิ่มเมนูที่ 1–9 ลงตะกร้า',          group: 'Solo' },
  { keys: ['Space'],   action: 'เปิดชำระเงิน (ถ้ามีสินค้าในตะกร้า)', group: 'Solo' },
  { keys: ['@'],       action: 'เลือกลูกค้า',                           group: 'Solo' },
  // Payment quick keys (only when charge popup is open)
  { keys: ['1'],       action: 'ชำระพอดี (เงินสด)',                     group: 'Payment' },
  { keys: ['2'],       action: '20,000 ₭',                               group: 'Payment' },
  { keys: ['3'],       action: '50,000 ₭',                               group: 'Payment' },
  { keys: ['4'],       action: '100,000 ₭',                              group: 'Payment' },
  { keys: ['5'],       action: '200,000 ₭',                              group: 'Payment' },
  { keys: ['Enter'],   action: 'ยืนยันการชำระเงิน',                     group: 'Payment' },
  // Classic shortcuts
  { keys: ['Ctrl', 'P'], action: 'เปิดหน้าชำระเงิน',                  group: 'Classic' },
  { keys: ['Ctrl', 'H'], action: 'พักออเดอร์ปัจจุบัน',                group: 'Classic' },
  { keys: ['Ctrl', 'L'], action: 'ดูออเดอร์ที่พักไว้',                 group: 'Classic' },
  { keys: ['/'],         action: 'โฟกัสช่องค้นหาเมนู',                 group: 'Classic' },
  { keys: ['Esc'],       action: 'ปิด popup / modal',                   group: 'Classic' },
  { keys: ['F1', '?'],   action: 'แสดง / ซ่อน shortcuts',              group: 'Classic' },
]

const GROUP_LABELS: Record<string, string> = {
  Solo:    'Solo Operator',
  Payment: 'ในหน้าชำระเงิน',
  Classic: 'Classic',
}

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
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>Solo + Classic mode</div>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {['Solo', 'Payment', 'Classic'].map(group => {
            const groupShortcuts = SHORTCUTS.filter(s => s.group === group)
            return (
              <div key={group}>
                <div style={{ fontSize: 9, color: `${GOLD}66`, textTransform: 'uppercase', letterSpacing: '1.5px', padding: '10px 2px 4px', fontWeight: 600 }}>
                  {GROUP_LABELS[group]}
                </div>
                {groupShortcuts.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 12px', borderRadius: 8,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{s.action}</span>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {s.keys.map((k, j) => (
                        <span key={j}>
                          {j > 0 && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginRight: 4 }}>or</span>}
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 7px', borderRadius: 5,
                            backgroundColor: 'rgba(255,255,255,0.07)',
                            border: '1px solid rgba(255,255,255,0.14)',
                            color: GOLD, fontSize: 11, fontWeight: 700,
                            fontFamily: "'SF Mono', 'Fira Code', 'Courier New', monospace",
                          }}>{k}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
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
