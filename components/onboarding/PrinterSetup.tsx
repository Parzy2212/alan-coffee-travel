'use client'

import { useState } from 'react'

export type PrinterPath = 'setup' | 'later' | 'none'
type ConnType = 'usb' | 'network' | 'bluetooth'
type TestStatus = 'idle' | 'printing' | 'success' | 'fail'

const PATH_OPTIONS: { id: PrinterPath; title: string; sub: string; icon: string }[] = [
  { id: 'setup', icon: '🖨️', title: 'มีอยู่แล้ว — ตั้งค่าเลย', sub: 'เชื่อมต่อและทดสอบพิมพ์ตอนนี้' },
  { id: 'later', icon: '🕐', title: 'ยังไม่มี — ตั้งทีหลัง',   sub: 'ข้ามก่อน ตั้งค่าจาก Settings ทีหลัง' },
  { id: 'none',  icon: '📱', title: 'ไม่ใช้เครื่องพิมพ์',      sub: 'ส่งใบเสร็จผ่าน LINE หรือ QR code' },
]

const CONN_TYPES: { id: ConnType; icon: string; label: string; enabled: boolean }[] = [
  { id: 'usb',       icon: '🔌', label: 'USB',       enabled: true  },
  { id: 'network',   icon: '📡', label: 'Network',   enabled: false },
  { id: 'bluetooth', icon: '🔵', label: 'Bluetooth', enabled: false },
]

interface Props {
  printerPath: PrinterPath | null
  onPathChange: (p: PrinterPath) => void
  shopName: string
  onNext: () => void
  onBack: () => void
}

export function PrinterSetup({ printerPath, onPathChange, shopName, onNext, onBack }: Props) {
  const [connType, setConnType] = useState<ConnType>('usb')
  const [printerName, setPrinterName] = useState('')
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

    // Persist printer name to localStorage before printing
    try {
      if (printerName.trim()) {
        localStorage.setItem('pos_printer_name', printerName.trim())
      } else {
        localStorage.removeItem('pos_printer_name')
      }
    } catch { /* ignore */ }

    try {
      const { testPrint } = await import('@/lib/thermal-printer')
      await testPrint(shopName || 'Alan Coffee & Travel')
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
        Alan CafeOS รองรับเครื่องพิมพ์ความร้อน Xprinter, EPSON และอื่น ๆ
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
          {/* Connection type */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', marginBottom: 10 }}>
              ประเภทการเชื่อมต่อ
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {CONN_TYPES.map(ct => {
                const selected = connType === ct.id
                return (
                  <div key={ct.id} style={{ flex: 1, position: 'relative' }}>
                    <button
                      onClick={() => ct.enabled && setConnType(ct.id)}
                      disabled={!ct.enabled}
                      title={!ct.enabled ? 'Coming soon' : undefined}
                      style={{
                        width: '100%', padding: '12px 8px',
                        backgroundColor: selected && ct.enabled ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${selected && ct.enabled ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.07)'}`,
                        borderRadius: 10, cursor: ct.enabled ? 'pointer' : 'not-allowed',
                        fontFamily: 'inherit', textAlign: 'center',
                        opacity: ct.enabled ? 1 : 0.4,
                        transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 4, lineHeight: 1 }}>{ct.icon}</div>
                      <div style={{ color: selected && ct.enabled ? '#c9a84c' : 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600 }}>
                        {ct.label}
                      </div>
                      {!ct.enabled && (
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2 }}>Coming soon</div>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Printer name (Windows printer name for print server) */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', display: 'block', marginBottom: 7 }}>
              ชื่อเครื่องพิมพ์ใน Windows <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(ไม่บังคับ)</span>
            </label>
            <input
              style={{
                width: '100%', backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                padding: '11px 14px', color: 'white', fontSize: 14,
                outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
              }}
              value={printerName}
              onChange={e => setPrinterName(e.target.value)}
              placeholder="เช่น Xprinter 58 (ชื่อใน Control Panel)"
            />
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 5, lineHeight: 1.4 }}>
              เปิด Control Panel → Devices and Printers เพื่อดูชื่อ
            </div>
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
              {testStatus === 'success'  && '✓ พิมพ์สำเร็จ — เครื่องพิมพ์พร้อมใช้งาน'}
              {testStatus === 'fail'     && '✗ ไม่พบเครื่องพิมพ์ — กดลองใหม่'}
            </button>

            {testStatus === 'fail' && (
              <div style={{ marginTop: 10, padding: '10px 14px', backgroundColor: 'rgba(255,77,77,0.06)', border: '1px solid rgba(255,77,77,0.15)', borderRadius: 8 }}>
                <div style={{ color: 'rgba(255,150,150,0.9)', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>
                  ตรวจสอบ:
                </div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.6 }}>
                  1. เปิดโปรแกรม AlanPOS Print Server แล้วหรือยัง?<br />
                  2. เครื่องพิมพ์เปิดอยู่และต่อสาย USB แล้วหรือยัง?<br />
                  3. ตรวจสอบ Control Panel → Devices and Printers
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
            เมื่อพร้อมแล้ว ตั้งค่าได้จาก <span style={{ color: 'rgba(201,168,76,0.7)' }}>Settings → เครื่องพิมพ์</span>
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
