'use client'

import { useEffect, useState } from 'react'
import { PrinterDiagnostic } from './PrinterDiagnostic'

const GOLD  = '#c9a84c'
const GREEN = '#4cba7f'
const BLACK = '#0a0a0a'

const CSS = `
@keyframes _rp_in     { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:none} }
@keyframes _rp_shrink { from{width:100%} to{width:0%} }
@media (prefers-reduced-motion:reduce) {
  ._rp_in { animation: none !important }
  ._rp_shrink_el { animation: none !important; width: 0 !important }
}
`

export interface ReceiptPreviewProps {
  receiptText: string
  onPrint: () => Promise<void>
  onSkip: () => void
  onOpenSettings?: () => void
  autoSkipSecs?: number
}

export function ReceiptPreview({ receiptText, onPrint, onSkip, onOpenSettings, autoSkipSecs = 4 }: ReceiptPreviewProps) {
  const [timeLeft,     setTimeLeft]     = useState(autoSkipSecs)
  const [printing,     setPrinting]     = useState(false)
  const [printDone,    setPrintDone]    = useState(false)
  const [showDiagnostic, setShowDiagnostic] = useState(false)

  useEffect(() => {
    if (showDiagnostic) return  // pause countdown while diagnostic is open
    if (timeLeft <= 0) { onSkip(); return }
    const t = setTimeout(() => setTimeLeft(n => n - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, onSkip, showDiagnostic])

  async function handlePrint() {
    setPrinting(true)
    try {
      await onPrint()
      setPrintDone(true)
      setTimeout(onSkip, 700)
    } catch {
      setPrinting(false)
      setShowDiagnostic(true)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ตรวจสอบใบเสร็จ"
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        backgroundColor: 'rgba(0,0,0,0.94)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <style>{CSS}</style>

      <div style={{
        width: '100%', maxWidth: 400,
        animation: '_rp_in 0.25s cubic-bezier(0.2,0,0,1)',
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            fontSize: 11, color: GOLD,
            letterSpacing: '2.5px', textTransform: 'uppercase',
            fontWeight: 700, marginBottom: 4,
          }}>
            ตรวจสอบใบเสร็จ
          </div>
          {!showDiagnostic && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
              ข้ามอัตโนมัติใน {timeLeft} วินาที
            </div>
          )}
        </div>

        {/* Paper receipt */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 10,
          padding: '20px 16px',
          maxHeight: '50vh',
          overflowY: 'auto',
          boxShadow: '0 8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
          marginBottom: 14,
          scrollbarWidth: 'thin' as const,
        }}>
          <pre style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: 10.5,
            lineHeight: 1.5,
            color: '#111',
            margin: 0,
            whiteSpace: 'pre',
            overflowX: 'auto',
          }}>
            {receiptText}
          </pre>
        </div>

        {/* Auto-skip progress bar — 4px gold bar, shrinks to 0 over autoSkipSecs */}
        <div style={{
          height: 4, backgroundColor: 'rgba(255,255,255,0.07)',
          borderRadius: 2, overflow: 'hidden', marginBottom: 10,
        }}>
          <div className="_rp_shrink_el" style={{
            height: '100%', width: '100%', backgroundColor: GOLD, borderRadius: 2,
            animation: showDiagnostic ? 'none' : `_rp_shrink ${autoSkipSecs}s linear forwards`,
          }} />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handlePrint}
            disabled={printing && !printDone}
            aria-label="พิมพ์ใบเสร็จ"
            style={{
              flex: 1, height: 60, borderRadius: 14, border: 'none',
              backgroundColor: printDone ? GREEN : GOLD,
              color: BLACK, fontSize: 17, fontWeight: 800,
              cursor: (printing && !printDone) ? 'wait' : 'pointer',
              fontFamily: 'var(--font-heading)',
              transition: 'all 0.2s',
              opacity: (printing && !printDone) ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {printDone
              ? '✓ พิมพ์แล้ว'
              : printing
              ? 'กำลังพิมพ์...'
              : <><span>🖨️</span><span>พิมพ์</span></>
            }
          </button>
          <button
            onClick={onSkip}
            disabled={printing && !printDone}
            aria-label="ข้ามการพิมพ์"
            style={{
              flex: 1, height: 60, borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.12)',
              backgroundColor: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.65)',
              fontSize: 17, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'var(--font-heading)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}
          >
            <span>ข้าม</span><span style={{ fontSize: 14 }}>⏭</span>
          </button>
        </div>
      </div>

      {/* Diagnostic overlay — appears on top when print fails */}
      {showDiagnostic && (
        <PrinterDiagnostic
          onSkip={onSkip}
          onOpenSettings={onOpenSettings}
        />
      )}
    </div>
  )
}
