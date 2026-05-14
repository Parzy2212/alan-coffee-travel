'use client'

import { useEffect, useState } from 'react'
import { runHealthCheck, type HealthCheck, type HealthReport } from '@/lib/health-check'

const GOLD   = '#c9a84c'
const GREEN  = '#4cba7f'
const YELLOW = '#f59e0b'
const RED    = '#ff6b6b'

const STATUS_COLOR: Record<string, string> = { ok: GREEN, warn: YELLOW, error: RED, loading: 'rgba(255,255,255,0.3)' }
const STATUS_ICON:  Record<string, string> = { ok: '✓', warn: '⚠', error: '✗', loading: '…' }

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    ;(acc[k] ??= []).push(item)
    return acc
  }, {} as Record<string, T[]>)
}

export function HealthCheckClient() {
  const [report,    setReport]    = useState<HealthReport | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const r = await runHealthCheck()
      setReport(r)
    } catch { /* ignore */ }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { void load() }, [])

  async function refresh() {
    setRefreshing(true)
    await load()
  }

  const sections = report ? groupBy(report.checks, c => c.section) : {}
  const score    = report?.score ?? 0
  const ready    = report?.ready ?? false
  const incomplete = report?.checks.filter(c => c.status !== 'ok') ?? []

  const scoreColor = score >= 90 ? GREEN : score >= 60 ? YELLOW : RED

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'var(--font-body, Inter, sans-serif)' }}>
      {/* Top bar */}
      <header style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 16 }}>
        <a href="/cafe" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 13 }}>← Dashboard</a>
        <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>ตรวจสอบความพร้อม</span>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => void refresh()}
            disabled={refreshing}
            style={{
              padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.12)',
              backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
              fontSize: 12, cursor: 'pointer',
            }}
          >
            {refreshing ? 'กำลังตรวจสอบ...' : '🔄 ตรวจใหม่'}
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>

        {/* Hero score */}
        <div style={{
          padding: '28px 32px', borderRadius: 18, marginBottom: 28,
          background: `linear-gradient(135deg, ${scoreColor}10 0%, rgba(255,255,255,0.02) 100%)`,
          border: `1px solid ${scoreColor}33`,
          display: 'flex', alignItems: 'center', gap: 28,
        }}>
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
              <circle cx="40" cy="40" r="34" fill="none" stroke={scoreColor} strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - score / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: scoreColor }}>
              {loading ? '…' : score}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
              {loading ? 'กำลังตรวจสอบ...' : ready ? 'ร้านพร้อมเปิดแล้ว!' : 'ยังมีบางอย่างต้องทำ'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
              {loading ? '' : `คะแนนความพร้อม ${score}/100`}
            </div>
            {/* Progress bar */}
            {!loading && (
              <div style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  width: `${score}%`, backgroundColor: scoreColor,
                  transition: 'width 0.6s ease',
                }} />
              </div>
            )}
          </div>
          {!loading && ready && (
            <div style={{ fontSize: 48, flexShrink: 0 }}>🚀</div>
          )}
        </div>

        {/* Incomplete items shortlist */}
        {!loading && incomplete.length > 0 && (
          <div style={{ marginBottom: 24, padding: '16px 20px', borderRadius: 14, backgroundColor: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 12, color: GOLD, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>
              สิ่งที่ต้องทำ ({incomplete.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {incomplete.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={{ color: STATUS_COLOR[c.status] }}>{STATUS_ICON[c.status]}</span>
                  <span style={{ color: 'rgba(255,255,255,0.75)' }}>{c.label}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', flex: 1 }}>— {c.detail}</span>
                  {c.href && (
                    <a href={c.href} style={{
                      padding: '2px 10px', borderRadius: 5,
                      border: `1px solid ${STATUS_COLOR[c.status]}44`,
                      color: STATUS_COLOR[c.status], fontSize: 11, fontWeight: 600, textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}>
                      {c.actionLabel ?? 'แก้ไข'}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full checklist by section */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ height: 52, borderRadius: 10, backgroundColor: '#161616', opacity: 0.5 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {Object.entries(sections).map(([section, checks]) => (
              <div key={section} style={{ backgroundColor: '#161616', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {section}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {(checks as HealthCheck[]).map(check => (
                    <div key={check.id} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 20px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      {/* Status indicator */}
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: `${STATUS_COLOR[check.status]}18`,
                        border: `1px solid ${STATUS_COLOR[check.status]}44`,
                        fontSize: 12, fontWeight: 900,
                        color: STATUS_COLOR[check.status],
                      }}>
                        {STATUS_ICON[check.status]}
                      </div>

                      {/* Label + detail */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{check.label}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{check.detail}</div>
                      </div>

                      {/* Action link */}
                      {check.href && check.status !== 'ok' && (
                        <a href={check.href} style={{
                          padding: '5px 12px', borderRadius: 7, flexShrink: 0,
                          border: `1px solid ${STATUS_COLOR[check.status]}44`,
                          backgroundColor: `${STATUS_COLOR[check.status]}10`,
                          color: STATUS_COLOR[check.status], fontSize: 12, fontWeight: 600,
                          textDecoration: 'none', whiteSpace: 'nowrap',
                        }}>
                          {check.actionLabel ?? 'ไปที่'}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Launch button */}
        {!loading && (
          <div style={{ marginTop: 28, textAlign: 'center' }}>
            {ready ? (
              <a href="/pos" style={{
                display: 'inline-block', padding: '14px 40px', borderRadius: 14,
                backgroundColor: GREEN, color: '#000', fontWeight: 900, fontSize: 16,
                textDecoration: 'none', boxShadow: `0 0 30px ${GREEN}40`,
              }}>
                🚀 เปิด POS เลย!
              </a>
            ) : (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
                แก้ไขรายการที่ค้างอยู่ก่อน แล้วกด "ตรวจใหม่"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
