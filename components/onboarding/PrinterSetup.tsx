'use client'

import { useState } from 'react'

export type PrinterPath = 'setup' | 'later' | 'none'
type TestStatus = 'idle' | 'printing' | 'success' | 'fail'

const PATH_OPTIONS: { id: PrinterPath; title: string; sub: string; icon: string }[] = [
  { id: 'setup', icon: '🖨️', title: 'มีอยู่แล้ว — ตั้งค่าเลย', sub: 'เชื่อมต่อและทดสอบพิมพ์ตอนนี้' },
  { id: 'later', icon: '🕐', title: 'ยังไม่มี — ตั้งทีหลัง',   sub: 'ข้ามก่อน ตั้งทีหลังได้ที่ หน้าขาย → ⚙️' },
  { id: 'none',  icon: '📱', title: 'ไม่ใช้เครื่องพิมพ์',      sub: 'ขายได้ตามปกติ โดยไม่พิมพ์ใบเสร็จ' },
]

interface Props {
  printerPath: PrinterPath | null
  onPathChange: (p: PrinterPath) => void
  shopName: string
  onNext: () => void
  onBack: () => void
}

export function PrinterSetup({ printerPath, onPathChange, shopName, onNext, onBack }: Props) {
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState('')

  const handlePathChange = (p: PrinterPath) => {
    onPathChange(p)
    setTestStatus('idle')
    setTestError('')
  }

  const handleTestPrint = async () => {
    setTestStatus('printing')
    setTestError('')

    try {
      const { testPrint } = await import('@/lib/thermal-printer')
      await testPrint(shopName || 'Alan Coffee & Travel', '')
      setTestStatus('success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[PrinterSetup] testPrint error:', msg)
      setTestStatus('fail')
      setTestError(msg)
    }
  }

  const canNext = printerPath !== null

  return (
    <div>
      <h2 style={{ color: 'white', fontWeight: 800, fontSize: 24, marginBottom: 6, fontFamily: 'var(--font-heading)', lineHeight: 1.2 }}>
        เครื่องพิมพ์
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
        พิมพ์ผ่านไดรเวอร์เครื่องพิมพ์ของ Windows — ใช้ได้กับเครื่องพิมพ์ความร้อน Xprinter, EPSON และอื่น ๆ
      </p>

      {/* Path chooser */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {PATH_OPTIONS.map(opt => {
          const selected = printerPath === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => handlePathChange(opt.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 18px',
                backgroundColor: selected ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${selected ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                width: '100%', fontFamily: 'inherit',
                transition: 'border-color 0.15s, background-color 0.15s',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{opt.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{opt.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{opt.sub}</div>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                backgroundColor: selected ? '#c9a84c' : 'transparent',
                border: `1.5px solid ${selected ? '#c9a84c' : 'rgba(255,255,255,0.15)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.12s',
              }}>
                {selected && <span style={{ color: '#000', fontSize: 10, fontWeight: 800 }}>✓</span>}
              </div>
            </button>
          )
        })}
      </div>

      {/* Setup mini-wizard (มีอยู่แล้ว) */}
      {printerPath === 'setup' && (
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          padding: '20px',
          marginBottom: 20,
        }}>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.8, marginBottom: 18 }}>
            1. ต่อเครื่องพิมพ์กับคอมพิวเตอร์ แล้วติดตั้งไดรเวอร์ของเครื่องพิมพ์ใน Windows<br />
            2. ตั้งเครื่องพิมพ์ใบเสร็จเป็น <span style={{ color: 'rgba(201,168,76,0.8)' }}>เครื่องพิมพ์หลัก (Default)</span> ของ Windows<br />
            3. กด ทดสอบพิมพ์ — ถ้ามีหน้าต่างพิมพ์ขึ้นมา ให้เลือกเครื่องพิมพ์ใบเสร็จแล้วกดพิมพ์
          </div>

          {/* Test print */}
          <div>
            <button
              onClick={handleTestPrint}
              disabled={testStatus === 'printing'}
              style={{
                width: '100%', padding: '12px',
                backgroundColor: testStatus === 'success' ? 'rgba(76,186,127,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${testStatus === 'success' ? 'rgba(76,186,127,0.4)' : testStatus === 'fail' ? 'rgba(255,77,77,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 10, cursor: testStatus === 'printing' ? 'wait' : 'pointer',
                fontFamily: 'inherit', color: testStatus === 'success' ? '#4cba7f' : testStatus === 'fail' ? 'rgba(255,120,120,0.9)' : 'rgba(255,255,255,0.7)',
                fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
              }}
            >
              {testStatus === 'idle'     && '🖨️ ทดสอบพิมพ์'}
              {testStatus === 'printing' && '⏳ กำลังพิมพ์...'}
              {testStatus === 'success'  && '✓ ส่งงานพิมพ์แล้ว — ดูว่ากระดาษออกมาหรือไม่'}
              {testStatus === 'fail'     && '✗ พิมพ์ไม่สำเร็จ — กดลองใหม่'}
            </button>

            {testStatus === 'fail' && (
              <div style={{ marginTop: 10, padding: '10px 14px', backgroundColor: 'rgba(255,77,77,0.06)', border: '1px solid rgba(255,77,77,0.15)', borderRadius: 8 }}>
                <div style={{ color: 'rgba(255,150,150,0.9)', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>
                  ตรวจสอบ:
                </div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.6 }}>
                  1. เครื่องพิมพ์เปิดอยู่และต่อสาย USB แล้วหรือยัง?<br />
                  2. ติดตั้งไดรเวอร์และตั้งเป็นเครื่องพิมพ์หลักใน Windows แล้วหรือยัง?<br />
                  3. ตรวจสอบ Settings → Bluetooth &amp; devices → Printers &amp; scanners
                </div>
                {testError && (
                  <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {testError.slice(0, 120)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Skip path reassurance (ยังไม่มี / ไม่ใช้) */}
      {(printerPath === 'later' || printerPath === 'none') && (
        <div style={{
          padding: '16px 18px',
          backgroundColor: 'rgba(76,186,127,0.05)',
          border: '1px solid rgba(76,186,127,0.15)',
          borderRadius: 12, marginBottom: 20,
        }}>
          <div style={{ color: '#4cba7f', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
            ✓ ไม่เป็นไรเลย
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.7 }}>
            คุณยังใช้ Alan CafeOS ได้เต็มระบบโดยไม่มีเครื่องพิมพ์<br />
            เมื่อพร้อมแล้ว ตั้งค่าได้จาก <span style={{ color: 'rgba(201,168,76,0.7)' }}>หน้าขาย → ⚙️</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onBack}
          style={{
            flex: 1, backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
            padding: '14px', color: 'rgba(255,255,255,0.5)',
            fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ← ย้อนกลับ
        </button>
        <button
          onClick={onNext}
          disabled={!canNext}
          style={{
            flex: 2, backgroundColor: canNext ? '#c9a84c' : 'rgba(201,168,76,0.2)',
            color: canNext ? '#000' : 'rgba(255,255,255,0.25)',
            border: 'none', borderRadius: 12, padding: '14px',
            fontSize: 15, fontWeight: 700,
            cursor: canNext ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
        >
          ถัดไป →
        </button>
      </div>
    </div>
  )
}
