'use client'

import { useEffect, useRef, useState } from 'react'
import {
  parseCSVtoMenuRows, parseCSVtoInventoryRows,
  validateMenuRows, validateInventoryRows,
  bulkInsertMenuItems, bulkInsertInventory,
  type ImportRow, type InventoryRow,
} from '@/lib/bulk-import'

const GOLD  = '#c9a84c'
const GREEN = '#4cba7f'
const RED   = '#ff6b6b'
const LS_MENU_DRAFT = 'alan_import_menu_draft'
const LS_INV_DRAFT  = 'alan_import_inv_draft'

type Mode = 'menu' | 'inventory'

const EMPTY_MENU_ROW  = (): ImportRow     => ({ product_name: '', product_name_lo: '', price_lak: '', category: '' })
const EMPTY_INV_ROW   = (): InventoryRow  => ({ name: '', name_lo: '', unit: 'g', current_qty: '0', cost_per_unit: '0' })

const MENU_HEADERS    = ['ชื่อเมนู (EN)', 'ราคา LAK', 'ชื่อ Lao', 'หมวดหมู่']
const INV_HEADERS     = ['ชื่อวัตถุดิบ', 'ชื่อ Lao', 'หน่วย', 'จำนวนปัจจุบัน', 'ราคา/หน่วย LAK']

export function ImportClient() {
  const [mode,       setMode]       = useState<Mode>('menu')
  const [menuRows,   setMenuRows]   = useState<ImportRow[]>([EMPTY_MENU_ROW(), EMPTY_MENU_ROW(), EMPTY_MENU_ROW()])
  const [invRows,    setInvRows]    = useState<InventoryRow[]>([EMPTY_INV_ROW(), EMPTY_INV_ROW(), EMPTY_INV_ROW()])
  const [csvText,    setCsvText]    = useState('')
  const [showCsv,    setShowCsv]    = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ created: number; errors: string[] } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  // Restore drafts
  useEffect(() => {
    try {
      const md = localStorage.getItem(LS_MENU_DRAFT)
      if (md) setMenuRows(JSON.parse(md))
      const id = localStorage.getItem(LS_INV_DRAFT)
      if (id) setInvRows(JSON.parse(id))
    } catch {}
  }, [])

  // Persist drafts
  useEffect(() => {
    try { localStorage.setItem(LS_MENU_DRAFT, JSON.stringify(menuRows)) } catch {}
  }, [menuRows])
  useEffect(() => {
    try { localStorage.setItem(LS_INV_DRAFT, JSON.stringify(invRows)) } catch {}
  }, [invRows])

  function updateMenuRow(i: number, key: keyof ImportRow, val: string) {
    setMenuRows(prev => { const next = [...prev]; next[i] = { ...next[i], [key]: val, _error: undefined }; return next })
  }
  function updateInvRow(i: number, key: keyof InventoryRow, val: string) {
    setInvRows(prev => { const next = [...prev]; next[i] = { ...next[i], [key]: val, _error: undefined }; return next })
  }

  function addRow() {
    if (mode === 'menu')      setMenuRows(prev => [...prev, EMPTY_MENU_ROW()])
    else                      setInvRows(prev => [...prev, EMPTY_INV_ROW()])
  }
  function removeRow(i: number) {
    if (mode === 'menu')      setMenuRows(prev => prev.filter((_, idx) => idx !== i))
    else                      setInvRows(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleCsvPaste() {
    if (!csvText.trim()) return
    if (mode === 'menu') {
      const parsed = validateMenuRows(parseCSVtoMenuRows(csvText))
      setMenuRows(parsed.length > 0 ? parsed : [EMPTY_MENU_ROW()])
    } else {
      const parsed = validateInventoryRows(parseCSVtoInventoryRows(csvText))
      setInvRows(parsed.length > 0 ? parsed : [EMPTY_INV_ROW()])
    }
    setCsvText(''); setShowCsv(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number, totalCols: number) {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      const nextCol = colIdx + 1
      if (nextCol < totalCols) {
        const next = tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${rowIdx}-${nextCol}"]`)
        next?.focus()
      } else {
        const nextRow = rowIdx + 1
        if (mode === 'menu' && nextRow >= menuRows.length) setMenuRows(prev => [...prev, EMPTY_MENU_ROW()])
        if (mode === 'inventory' && nextRow >= invRows.length) setInvRows(prev => [...prev, EMPTY_INV_ROW()])
        setTimeout(() => {
          const next = tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${nextRow}-0"]`)
          next?.focus()
        }, 20)
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const nextRow = rowIdx + 1
      if (mode === 'menu' && nextRow >= menuRows.length) setMenuRows(prev => [...prev, EMPTY_MENU_ROW()])
      if (mode === 'inventory' && nextRow >= invRows.length) setInvRows(prev => [...prev, EMPTY_INV_ROW()])
      setTimeout(() => {
        const next = tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${nextRow}-0"]`)
        next?.focus()
      }, 20)
    }
  }

  async function handleSubmit() {
    setSubmitting(true); setSubmitResult(null)
    let res: { created: number; errors: string[] }
    if (mode === 'menu') {
      const validated = validateMenuRows(menuRows.filter(r => r.product_name.trim()))
      setMenuRows(prev => prev.map(r => r.product_name.trim() ? (validated.find(v => v.product_name === r.product_name) ?? r) : r))
      if (validated.some(r => r._error)) { setSubmitting(false); return }
      res = await bulkInsertMenuItems(validated)
    } else {
      const validated = validateInventoryRows(invRows.filter(r => r.name.trim()))
      setInvRows(prev => prev.map(r => r.name.trim() ? (validated.find(v => v.name === r.name) ?? r) : r))
      if (validated.some(r => r._error)) { setSubmitting(false); return }
      res = await bulkInsertInventory(validated)
    }
    setSubmitResult(res)
    if (res.created > 0) {
      if (mode === 'menu') { setMenuRows([EMPTY_MENU_ROW()]); localStorage.removeItem(LS_MENU_DRAFT) }
      else { setInvRows([EMPTY_INV_ROW()]); localStorage.removeItem(LS_INV_DRAFT) }
    }
    setSubmitting(false)
  }

  const validRows = mode === 'menu'
    ? menuRows.filter(r => r.product_name.trim()).length
    : invRows.filter(r => r.name.trim()).length
  const hasErrors = mode === 'menu'
    ? menuRows.some(r => r._error)
    : invRows.some(r => r._error)

  const cellStyle: React.CSSProperties = {
    border: 'none', backgroundColor: 'transparent', color: '#fff', fontSize: 13,
    padding: '8px 10px', width: '100%', fontFamily: 'inherit', outline: 'none',
  }
  const thStyle: React.CSSProperties = {
    padding: '10px 10px', fontSize: 11, color: GOLD, textTransform: 'uppercase',
    letterSpacing: '1px', fontWeight: 700, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.07)',
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'var(--font-body, Inter, sans-serif)' }}>
      {/* Top bar */}
      <header style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 16 }}>
        <a href="/cafe" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 13 }}>← Dashboard</a>
        <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Bulk Import</span>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 6 }}>นำเข้าข้อมูลจำนวนมาก</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            พิมพ์หรือวาง CSV เพื่อเพิ่มเมนูหรือวัตถุดิบหลายรายการพร้อมกัน — กด Tab เพื่อย้ายช่อง, Enter ขึ้นแถวใหม่
          </div>
        </div>

        {/* Result */}
        {submitResult && (
          <div style={{
            padding: '14px 18px', borderRadius: 12, marginBottom: 20,
            backgroundColor: submitResult.errors.length === 0 ? `${GREEN}10` : `${RED}10`,
            border: `1px solid ${submitResult.errors.length === 0 ? GREEN : RED}33`,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: submitResult.errors.length === 0 ? GREEN : '#fff', marginBottom: submitResult.errors.length ? 6 : 0 }}>
              {submitResult.created > 0 ? `สร้างสำเร็จ ${submitResult.created} รายการ` : 'ไม่มีรายการที่สร้างได้'}
            </div>
            {submitResult.errors.map((e, i) => (
              <div key={i} style={{ fontSize: 12, color: RED }}>{e}</div>
            ))}
          </div>
        )}

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, backgroundColor: '#161616', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid rgba(255,255,255,0.07)' }}>
          {(['menu', 'inventory'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setSubmitResult(null) }} style={{
              padding: '8px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              backgroundColor: mode === m ? GOLD : 'transparent',
              color: mode === m ? '#000' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.15s',
            }}>
              {m === 'menu' ? 'เมนู' : 'วัตถุดิบ'}
            </button>
          ))}
        </div>

        {/* CSV Paste toggle */}
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setShowCsv(!showCsv)} style={{
            padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.12)',
            backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {showCsv ? 'ซ่อน CSV' : '📋 วาง CSV'}
          </button>
        </div>

        {showCsv && (
          <div style={{ marginBottom: 16, padding: 16, backgroundColor: '#161616', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
              {mode === 'menu'
                ? 'Format: ชื่อ, ราคา, ชื่อ Lao, หมวดหมู่'
                : 'Format: ชื่อ, ชื่อ Lao, หน่วย, จำนวน, ราคา/หน่วย'}
            </div>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder={mode === 'menu' ? 'Espresso, 15000, ເອສເປຣໂຊ, Coffee' : 'Coffee beans, ເມັດກາເຟ, g, 1000, 80'}
              style={{ width: '100%', height: 120, backgroundColor: '#0f0f0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12, fontFamily: 'monospace', padding: 10, resize: 'vertical', boxSizing: 'border-box' }}
            />
            <button onClick={handleCsvPaste} style={{
              marginTop: 8, padding: '7px 16px', borderRadius: 7, border: 'none',
              backgroundColor: GOLD, color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>นำเข้า CSV</button>
          </div>
        )}

        {/* Spreadsheet table */}
        <div ref={tableRef} style={{ backgroundColor: '#161616', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {(mode === 'menu' ? MENU_HEADERS : INV_HEADERS).map((h, i) => (
                  <th key={i} style={{ ...thStyle, width: i === 0 ? '30%' : 'auto' }}>{h}</th>
                ))}
                <th style={{ ...thStyle, width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {mode === 'menu' ? menuRows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', backgroundColor: row._error ? `${RED}08` : 'transparent' }}>
                  {(['product_name', 'price_lak', 'product_name_lo', 'category'] as const).map((col, ci) => (
                    <td key={col} style={{ padding: 0, borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                      <input
                        data-cell={`${ri}-${ci}`}
                        value={row[col]}
                        onChange={e => updateMenuRow(ri, col, e.target.value)}
                        onKeyDown={e => handleKeyDown(e, ri, ci, 4)}
                        style={{ ...cellStyle, borderBottom: row._error ? `1px solid ${RED}44` : 'none' }}
                        placeholder={col === 'price_lak' ? '15000' : col === 'category' ? 'Coffee' : ''}
                        type={col === 'price_lak' ? 'number' : 'text'}
                      />
                    </td>
                  ))}
                  <td style={{ padding: '0 8px', textAlign: 'center' }}>
                    {row._error
                      ? <span title={row._error} style={{ color: RED, fontSize: 14, cursor: 'help' }}>⚠</span>
                      : <button onClick={() => removeRow(ri)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 14, padding: 4 }}>×</button>}
                  </td>
                </tr>
              )) : invRows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', backgroundColor: row._error ? `${RED}08` : 'transparent' }}>
                  {(['name', 'name_lo', 'unit', 'current_qty', 'cost_per_unit'] as const).map((col, ci) => (
                    <td key={col} style={{ padding: 0, borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                      <input
                        data-cell={`${ri}-${ci}`}
                        value={row[col]}
                        onChange={e => updateInvRow(ri, col, e.target.value)}
                        onKeyDown={e => handleKeyDown(e, ri, ci, 5)}
                        style={cellStyle}
                        placeholder={col === 'unit' ? 'g' : col === 'current_qty' ? '1000' : col === 'cost_per_unit' ? '80' : ''}
                        type={['current_qty', 'cost_per_unit'].includes(col) ? 'number' : 'text'}
                      />
                    </td>
                  ))}
                  <td style={{ padding: '0 8px', textAlign: 'center' }}>
                    {row._error
                      ? <span title={row._error} style={{ color: RED, fontSize: 14, cursor: 'help' }}>⚠</span>
                      : <button onClick={() => removeRow(ri)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 14, padding: 4 }}>×</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ padding: '10px 12px' }}>
            <button onClick={addRow} style={{
              padding: '6px 14px', borderRadius: 6, border: '1px dashed rgba(255,255,255,0.15)',
              backgroundColor: 'transparent', color: 'rgba(255,255,255,0.35)',
              fontSize: 12, cursor: 'pointer',
            }}>+ เพิ่มแถว</button>
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            {validRows > 0 ? `${validRows} รายการพร้อมนำเข้า` : 'ยังไม่มีข้อมูล'}
            {hasErrors && <span style={{ color: RED, marginLeft: 8 }}>· มีข้อผิดพลาด — ตรวจสอบก่อน</span>}
          </div>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting || validRows === 0 || hasErrors}
            style={{
              padding: '10px 28px', borderRadius: 10, border: 'none',
              backgroundColor: validRows > 0 && !hasErrors ? GOLD : 'rgba(255,255,255,0.08)',
              color: validRows > 0 && !hasErrors ? '#000' : 'rgba(255,255,255,0.25)',
              fontWeight: 800, fontSize: 14, cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'กำลังนำเข้า...' : `นำเข้า ${validRows} รายการ`}
          </button>
        </div>
      </div>
    </div>
  )
}
