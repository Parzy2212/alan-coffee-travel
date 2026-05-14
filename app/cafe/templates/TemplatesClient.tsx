'use client'

import { useState } from 'react'
import { CAFE_TEMPLATES, applyTemplate, type CafeTemplate, type ApplyResult } from '@/lib/cafe-templates'

const GOLD  = '#c9a84c'
const GREEN = '#4cba7f'
const RED   = '#ff6b6b'

export function TemplatesClient() {
  const [applying,  setApplying]  = useState<string | null>(null)
  const [confirm,   setConfirm]   = useState<CafeTemplate | null>(null)
  const [result,    setResult]    = useState<{ template: string; data: ApplyResult } | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  async function handleApply(template: CafeTemplate) {
    setApplying(template.id)
    setError(null)
    setResult(null)
    try {
      const data = await applyTemplate(template)

      // Guard: 0 created + 0 skipped means something went wrong silently
      if (data.recipesCreated === 0 && data.recipesSkipped === 0) {
        throw new Error('ไม่มีเมนูถูกสร้าง — อาจเกิดปัญหากับสิทธิ์หรือการเชื่อมต่อ ลองล็อกออกแล้วล็อกอินใหม่')
      }

      setResult({ template: template.name_th, data })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาดที่ไม่คาดคิด')
    }
    setApplying(null)
    setConfirm(null)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'var(--font-body, Inter, sans-serif)' }}>
      {/* Top bar */}
      <header style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 16, flexShrink: 0 }}>
        <a href="/cafe" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Dashboard
        </a>
        <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Template เริ่มต้น</span>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 8 }}>เริ่มต้นร้านได้เร็ว</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 520, margin: '0 auto' }}>
            เลือก template ที่เหมาะกับร้านของคุณ — ระบบจะสร้างเมนู วัตถุดิบ และสูตรให้อัตโนมัติ
            <br />รายการที่มีอยู่แล้วจะไม่ถูกเขียนทับ
          </div>
        </div>

        {/* Result toast */}
        {result && (
          <div style={{
            padding: '16px 20px', borderRadius: 14, marginBottom: 24,
            backgroundColor: `${GREEN}10`, border: `1px solid ${GREEN}33`,
            display: 'flex', alignItems: 'flex-start', gap: 14,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>✅</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: GREEN, marginBottom: 4 }}>
                ใช้ Template "{result.template}" สำเร็จ
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8 }}>
                เมนู: สร้าง {result.data.recipesCreated} รายการ
                {result.data.recipesSkipped > 0 && ` (ข้าม ${result.data.recipesSkipped} ที่มีอยู่แล้ว)`}
                <br />วัตถุดิบ: สร้าง {result.data.ingredientsCreated} รายการ
                {result.data.ingredientsSkipped > 0 && ` (ข้าม ${result.data.ingredientsSkipped})`}
                <br />เชื่อมสูตร: {result.data.linksCreated} รายการ
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <a href="/cafe" style={{
                padding: '6px 14px', borderRadius: 8, border: `1px solid ${GREEN}55`,
                backgroundColor: `${GREEN}15`, color: GREEN,
                fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
              }}>
                ดูเมนู →
              </a>
              <button onClick={() => setResult(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div style={{
            padding: '14px 18px', borderRadius: 12, backgroundColor: `${RED}10`,
            border: `1px solid ${RED}33`, marginBottom: 24,
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <span style={{ color: RED, fontSize: 16, flexShrink: 0 }}>✗</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: RED, marginBottom: 2 }}>เกิดข้อผิดพลาด</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{error}</div>
            </div>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>×</button>
          </div>
        )}

        {/* Template cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {CAFE_TEMPLATES.map(template => (
            <div key={template.id} style={{
              backgroundColor: '#161616', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column',
              transition: 'border-color 0.2s',
            }}>
              {/* Card header */}
              <div style={{ padding: '24px 24px 16px', background: `linear-gradient(135deg, rgba(201,168,76,0.08) 0%, transparent 100%)` }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{template.emoji}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{template.name_th}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{template.description_th}</div>
              </div>

              {/* Stats */}
              <div style={{ padding: '0 24px 16px', display: 'flex', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>{template.items.length}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px' }}>เมนู</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>{template.ingredients.length}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px' }}>วัตถุดิบ</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>{template.recipeLinks.length}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px' }}>สูตร</div>
                </div>
              </div>

              {/* Menu preview */}
              <div style={{ padding: '0 24px', flex: 1 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>ตัวอย่างเมนู</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {template.items.slice(0, 5).map(item => (
                    <div key={item.product_name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ color: 'rgba(255,255,255,0.65)' }}>{item.emoji} {item.product_name_th || item.product_name}</span>
                      <span style={{ color: GOLD, fontWeight: 600 }}>{item.price_lak.toLocaleString()} ₭</span>
                    </div>
                  ))}
                  {template.items.length > 5 && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', paddingTop: 4 }}>
                      + {template.items.length - 5} รายการอื่น
                    </div>
                  )}
                </div>
              </div>

              {/* Action */}
              <div style={{ padding: 20 }}>
                <button
                  onClick={() => setConfirm(template)}
                  disabled={applying !== null}
                  style={{
                    width: '100%', height: 44, borderRadius: 10, border: `1px solid ${GOLD}55`,
                    backgroundColor: applying === template.id ? `${GOLD}20` : `${GOLD}12`,
                    color: GOLD, fontWeight: 700, fontSize: 14, cursor: applying ? 'wait' : 'pointer',
                    opacity: applying !== null && applying !== template.id ? 0.4 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {applying === template.id ? 'กำลังสร้าง...' : 'ใช้ Template นี้ →'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Quick nav */}
        <div style={{ marginTop: 40, padding: '20px 24px', borderRadius: 14, backgroundColor: '#161616', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>ต้องการเพิ่มเมนูเอง?</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>ใช้ Bulk Import สำหรับเพิ่มหลายรายการพร้อมกัน</div>
          </div>
          <a href="/cafe/import" style={{
            padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
            whiteSpace: 'nowrap', backgroundColor: 'rgba(255,255,255,0.04)',
          }}>
            Bulk Import →
          </a>
        </div>
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setConfirm(null) }}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
        >
          <div style={{ backgroundColor: '#1a1a1a', border: `1px solid ${GOLD}44`, borderRadius: 18, padding: 28, maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 }}>ยืนยันการใช้ Template</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20, lineHeight: 1.6 }}>
              จะสร้าง <strong style={{ color: '#fff' }}>{confirm.items.length} เมนู</strong>,{' '}
              <strong style={{ color: '#fff' }}>{confirm.ingredients.length} วัตถุดิบ</strong> และ{' '}
              <strong style={{ color: '#fff' }}>{confirm.recipeLinks.length} สูตร</strong>
              <br />รายการที่มีชื่อซ้ำจะถูกข้ามอัตโนมัติ
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => void handleApply(confirm)}
                style={{ flex: 1, height: 44, borderRadius: 10, border: 'none', backgroundColor: GOLD, color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
              >
                ยืนยัน
              </button>
              <button
                onClick={() => setConfirm(null)}
                style={{ padding: '0 20px', height: 44, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
