'use client'

import { useEffect, useRef, useState } from 'react'
import { SaveButton } from './ShopIdentitySection'

const CARD: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 24 }
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', display: 'block', marginBottom: 6 }
const INP: React.CSSProperties = { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 14px', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const GOLD = '#c9a84c'

const PAPER_WIDTHS = [
  { value: '80', label: '80mm — มาตรฐาน (48 chars)' },
  { value: '58', label: '58mm — เล็ก (32 chars)' },
]

const LS_PRINTER = 'alan_printer_name'
const LS_PAPER   = 'alan_paper_width'
const LS_IP      = 'alan_printer_ip'

export function PrinterSection() {
  const [printerName, setPrinterName] = useState('')
  const [paperWidth, setPaperWidth]   = useState('80')
  const [printerIp, setPrinterIp]     = useState('')
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [testStatus, setTestStatus]   = useState<'idle' | 'testing' | 'ok' | 'err'>('idle')
  const [testMsg, setTestMsg]         = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setPrinterName(localStorage.getItem(LS_PRINTER) ?? '')
    setPaperWidth(localStorage.getItem(LS_PAPER) ?? '80')
    setPrinterIp(localStorage.getItem(LS_IP) ?? '')
  }, [])

  const handleSave = () => {
    if (timer.current) clearTimeout(timer.current)
    localStorage.setItem(LS_PRINTER, printerName.trim())
    localStorage.setItem(LS_PAPER, paperWidth)
    localStorage.setItem(LS_IP, printerIp.trim())
    setSaved(true)
    timer.current = setTimeout(() => setSaved(false), 2500)
  }

  const handleTest = async () => {
    setTestStatus('testing'); setTestMsg('')
    try {
      const name = printerName.trim()
      const url = name
        ? `http://localhost:3002/test-ascii?printer=${encodeURIComponent(name)}&width=${paperWidth}`
        : `http://localhost:3002/test-ascii?width=${paperWidth}`
      const res = await fetch(url)
      if (res.ok) { setTestStatus('ok'); setTestMsg('พิมพ์ทดสอบสำเร็จ') }
      else { setTestStatus('err'); setTestMsg(`Error ${res.status}`) }
    } catch (e) {
      setTestStatus('err')
      setTestMsg('ไม่สามารถเชื่อมต่อ print server ได้ — ตรวจสอบว่า AlanPOS Print Server กำลังทำงานอยู่')
    }
    setTimeout(() => setTestStatus('idle'), 5000)
  }

  return (
    <>
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>ตั้งค่าเครื่องพิมพ์</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={LABEL}>ชื่อเครื่องพิมพ์ (Windows Printer Name)</label>
            <input
              type="text"
              value={printerName}
              onChange={e => setPrinterName(e.target.value)}
              placeholder="XP-T80A หรือชื่อเครื่องพิมพ์ใน Windows"
              style={INP}
            />
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 }}>
              เปิด Printers &amp; Scanners แล้วก็อปชื่อเครื่องพิมพ์มาวาง — ทิ้งว่างไว้ถ้าจะใช้ USB auto-detect
            </div>
          </div>
          <div>
            <label style={LABEL}>ขนาดกระดาษ</label>
            <div style={{ position: 'relative' }}>
              <select
                value={paperWidth}
                onChange={e => setPaperWidth(e.target.value)}
                style={{ ...INP, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', paddingRight: 36 }}
              >
                {PAPER_WIDTHS.map(w => (
                  <option key={w.value} value={w.value} style={{ backgroundColor: '#1a1a1a' }}>{w.label}</option>
                ))}
              </select>
              <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none', fontSize: 10 }}>▼</div>
            </div>
          </div>
          <div>
            <label style={LABEL}>IP เครื่องพิมพ์ WiFi <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(ถ้ามี)</span></label>
            <input
              type="text"
              value={printerIp}
              onChange={e => setPrinterIp(e.target.value)}
              placeholder="192.168.1.100"
              style={INP}
            />
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 }}>ทิ้งว่างไว้ถ้าเชื่อมต่อผ่าน USB หรือ Windows Printer Driver</div>
          </div>
        </div>
      </div>

      {/* Print server status */}
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>AlanPOS Print Server</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 32 }}>🖨️</div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 4 }}>ต้องติดตั้ง Print Server บนเครื่อง Windows</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, lineHeight: 1.6 }}>
              AlanPOS Print Server ทำงานที่ localhost:3002 และรับคำสั่งพิมพ์จากหน้า POS<br />
              ดาวน์โหลดและเรียกใช้ AlanPOS-PrintServer.exe บนเครื่องที่ต่อเครื่องพิมพ์
            </div>
          </div>
        </div>

        <button
          onClick={handleTest}
          disabled={testStatus === 'testing'}
          style={{
            padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            backgroundColor: testStatus === 'ok' ? 'rgba(76,186,127,0.15)' : testStatus === 'err' ? 'rgba(255,77,77,0.1)' : 'rgba(255,255,255,0.06)',
            color: testStatus === 'ok' ? '#4cba7f' : testStatus === 'err' ? '#ff6b6b' : 'rgba(255,255,255,0.6)',
            border: testStatus === 'ok' ? '1px solid rgba(76,186,127,0.3)' : testStatus === 'err' ? '1px solid rgba(255,77,77,0.2)' : '1px solid rgba(255,255,255,0.1)',
            cursor: testStatus === 'testing' ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'all 0.2s',
          }}
        >
          {testStatus === 'testing' ? 'กำลังทดสอบ...' : testStatus === 'ok' ? 'สำเร็จ ✓' : testStatus === 'err' ? 'ล้มเหลว ✗' : 'ทดสอบพิมพ์'}
        </button>

        {testMsg && (
          <div style={{ marginTop: 10, fontSize: 13, color: testStatus === 'ok' ? '#4cba7f' : '#ff6b6b' }}>
            {testMsg}
          </div>
        )}
      </div>

      <SaveButton saving={saving} saved={saved} onClick={handleSave} />
    </>
  )
}
