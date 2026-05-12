'use client'

import { useCallback, useEffect, useState } from 'react'

const GOLD  = '#c9a84c'
const GREEN = '#4cba7f'
const RED   = '#ff6b6b'

type ServerStatus = 'idle' | 'checking' | 'up' | 'down'

export interface PrinterDiagnosticProps {
  receiptText: string
  onSkip: () => void
  onOpenSettings?: () => void
}

// ── helpers ───────────────────────────────────────────────────────────────────

function statusIcon(s: ServerStatus) {
  if (s === 'up')       return { icon: '✓', color: GREEN }
  if (s === 'down')     return { icon: '✗', color: RED }
  if (s === 'checking') return { icon: '⟳', color: 'rgba(255,255,255,0.4)' }
  return                       { icon: '○', color: 'rgba(255,255,255,0.25)' }
}

function boolIcon(v: boolean) {
  return v ? { icon: '✓', color: GREEN } : { icon: '✗', color: RED }
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return iso }
}

// ── sub-components ────────────────────────────────────────────────────────────

function DiagRow({ icon, iconColor, title, subtitle, subtitleColor, children }: {
  icon: string; iconColor: string; title: string
  subtitle?: string; subtitleColor?: string
  children?: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '14px 0',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        width: 22, flexShrink: 0, marginTop: 1,
        fontSize: 15, fontWeight: 700, color: iconColor,
        textAlign: 'center', lineHeight: 1.3,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: subtitle || children ? 5 : 0 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: subtitleColor ?? 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{subtitle}</div>
        )}
        {children}
      </div>
    </div>
  )
}

function Chip({ label, onClick, variant = 'default' }: {
  label: string; onClick?: () => void; variant?: 'default' | 'gold' | 'danger'
}) {
  const colors = {
    default: { bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' },
    gold:    { bg: `rgba(201,168,76,0.12)`,  border: `rgba(201,168,76,0.35)`,  color: GOLD },
    danger:  { bg: 'rgba(255,107,107,0.1)',  border: 'rgba(255,107,107,0.3)',  color: RED },
  }[variant]
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-block', marginTop: 8,
        padding: '5px 12px', borderRadius: 7,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.bg, color: colors.color,
        fontSize: 12, fontWeight: 700, cursor: onClick ? 'pointer' : 'default',
        letterSpacing: '0.2px', lineHeight: 1, transition: 'all 0.15s',
      }}
    >{label}</button>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function PrinterDiagnostic({ receiptText, onSkip, onOpenSettings }: PrinterDiagnosticProps) {
  const [serverStatus,  setServerStatus]  = useState<ServerStatus>('idle')
  const [checking,      setChecking]      = useState(false)
  const [printerName,   setPrinterName]   = useState<string | null>(null)
  const [isHttps,       setIsHttps]       = useState(false)
  const [lastPrint,     setLastPrint]     = useState<{ time: string; result: 'success' | 'error'; error?: string } | null>(null)

  const pingServer = useCallback(async () => {
    setChecking(true)
    setServerStatus('checking')
    try {
      const res = await fetch('http://127.0.0.1:12345/status', { signal: AbortSignal.timeout(3000) })
      setServerStatus(res.ok ? 'up' : 'down')
    } catch {
      setServerStatus('down')
    }
    setChecking(false)
  }, [])

  useEffect(() => {
    const name = localStorage.getItem('pos_printer_name') || ''
    setPrinterName(name || null)
    setIsHttps(window.location.protocol === 'https:')
    try {
      const s = localStorage.getItem('pos_last_print_info')
      if (s) setLastPrint(JSON.parse(s))
    } catch { /* ignore */ }
    pingServer()
  }, [pingServer])

  function switchToHttp() {
    window.location.href = window.location.href.replace('https://', 'http://')
  }

  function printFromBrowser() {
    const win = window.open('', '_blank', 'width=420,height=640,scrollbars=yes')
    if (!win) { alert('เบราว์เซอร์บล็อก popup — อนุญาต popup สำหรับเว็บนี้ก่อน'); return }
    const safe = receiptText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt</title>
<style>
  body{margin:0;padding:20px;font-family:'Courier New',monospace;font-size:12px;color:#111;background:#fff}
  pre{white-space:pre;margin:0;line-height:1.45}
  @media print{body{padding:4px 8px}@page{margin:0;size:80mm auto}}
</style></head>
<body><pre>${safe}</pre>
<script>window.onload=()=>{window.print()}</script>
</body></html>`)
    win.document.close()
    setTimeout(onSkip, 800)
  }

  const { icon: srvIcon, color: srvColor } = statusIcon(serverStatus)
  const { icon: nameIcon, color: nameColor } = boolIcon(!!printerName)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="วินิจฉัยปัญหาเครื่องพิมพ์"
      style={{
        position: 'fixed', inset: 0, zIndex: 450,
        backgroundColor: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        backgroundColor: '#181818',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        width: '100%', maxWidth: 460,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ fontSize: 24, lineHeight: 1, marginBottom: 8 }}>🖨️</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 4 }}>ไม่พบเครื่องพิมพ์</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>ลองตรวจสอบสิ่งเหล่านี้:</div>

          {/* Last attempt info */}
          {lastPrint && (
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 8,
              backgroundColor: lastPrint.result === 'success'
                ? `rgba(76,186,127,0.1)` : `rgba(255,107,107,0.1)`,
              border: `1px solid ${lastPrint.result === 'success'
                ? 'rgba(76,186,127,0.25)' : 'rgba(255,107,107,0.25)'}`,
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
                ครั้งล่าสุด: {fmtTime(lastPrint.time)}
              </div>
              <div style={{
                fontSize: 12, fontWeight: 600,
                color: lastPrint.result === 'success' ? GREEN : RED,
              }}>
                {lastPrint.result === 'success' ? '✓ พิมพ์สำเร็จ' : `✗ ${lastPrint.error ?? 'พิมพ์ล้มเหลว'}`}
              </div>
            </div>
          )}
        </div>

        {/* ── Checklist ── */}
        <div style={{ padding: '0 24px' }}>

          {/* 1. Print Server */}
          <DiagRow
            icon={srvIcon} iconColor={srvColor}
            title="Print Server กำลังทำงาน?"
            subtitle={
              serverStatus === 'up'       ? 'เชื่อมต่อได้ที่ localhost:12345 ✓' :
              serverStatus === 'down'     ? 'ไม่พบ — เปิด AlanPOS-PrintServer.exe' :
              serverStatus === 'checking' ? 'กำลังตรวจสอบ localhost:12345...' :
              'ยังไม่ได้ตรวจสอบ'
            }
            subtitleColor={
              serverStatus === 'up' ? GREEN : serverStatus === 'down' ? RED : undefined
            }
          >
            {serverStatus !== 'up' && (
              <div style={{ marginTop: 8 }}>
                <div style={{
                  padding: '6px 10px', borderRadius: 6,
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontFamily: "'Courier New', monospace",
                  fontSize: 11, color: GOLD,
                  marginBottom: 8, letterSpacing: '0.3px',
                }}>
                  AlanPOS-PrintServer.exe
                </div>
                <Chip
                  label={checking ? '⟳  กำลังตรวจสอบ...' : '🔄 ตรวจสอบใหม่'}
                  onClick={checking ? undefined : pingServer}
                  variant="default"
                />
              </div>
            )}
          </DiagRow>

          {/* 2. Hardware */}
          <DiagRow
            icon="○" iconColor="rgba(255,255,255,0.25)"
            title="เครื่องพิมพ์เปิดอยู่และเชื่อม USB?"
            subtitle="ตรวจสอบไฟสถานะเครื่องพิมพ์และสาย USB"
          />

          {/* 3. Printer name */}
          <DiagRow
            icon={nameIcon} iconColor={nameColor}
            title="ตั้งค่าชื่อ Printer ใน Settings?"
            subtitle={
              printerName
                ? `ชื่อ: "${printerName}"`
                : 'ยังไม่ได้ตั้งค่า — ไปที่ Settings → เครื่องพิมพ์'
            }
            subtitleColor={printerName ? undefined : RED}
          >
            {!printerName && (
              <Chip
                label="→ ไป Settings"
                onClick={onOpenSettings}
                variant="gold"
              />
            )}
          </DiagRow>

          {/* 4. HTTPS warning */}
          {isHttps && (
            <DiagRow
              icon="⚠" iconColor={GOLD}
              title="URL เป็น HTTPS — Print Server ต้องการ HTTP"
              subtitle={`ปัจจุบัน: ${typeof window !== 'undefined' ? window.location.origin : ''}`}
              subtitleColor={GOLD}
            >
              <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 2, lineHeight: 1.5 }}>
                เบราว์เซอร์บล็อก HTTP request จาก HTTPS — ต้องเปิดด้วย <strong style={{ color: 'rgba(255,255,255,0.5)' }}>http://</strong>
              </div>
              <Chip
                label="🔗 เปลี่ยนไปใช้ HTTP"
                onClick={switchToHttp}
                variant="gold"
              />
            </DiagRow>
          )}

          <div style={{ height: 8 }} />
        </div>

        {/* ── Footer actions ── */}
        <div style={{
          padding: '16px 24px 20px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <button
            onClick={printFromBrowser}
            style={{
              width: '100%', height: 52, borderRadius: 12,
              border: `1px solid ${GOLD}44`,
              backgroundColor: `${GOLD}0f`, color: GOLD,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${GOLD}1e` }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = `${GOLD}0f` }}
          >
            <span>📋</span><span>พิมพ์จากเบราว์เซอร์แทน</span>
          </button>
          <button
            onClick={onSkip}
            style={{
              width: '100%', height: 52, borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              backgroundColor: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.65)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}
          >
            <span>⏭️</span><span>ข้ามและบันทึกออเดอร์</span>
          </button>
        </div>
      </div>
    </div>
  )
}
