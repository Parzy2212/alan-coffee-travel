'use client'

import { useRef, useState } from 'react'

export interface SampleItem {
  id: string
  emoji: string
  name: string
  price: number
  preChecked: boolean
}

export interface CustomItem {
  id: string
  name: string
  price: number
}

export const SAMPLE_ITEMS: SampleItem[] = [
  { id: '1', emoji: '☕', name: 'กาแฟดำ',    price: 15000, preChecked: true  },
  { id: '2', emoji: '☕', name: 'ลาเต้',      price: 20000, preChecked: true  },
  { id: '3', emoji: '🍵', name: 'ชาเขียว',   price: 18000, preChecked: true  },
  { id: '4', emoji: '☕', name: 'อเมริกาโน่', price: 18000, preChecked: false },
  { id: '5', emoji: '☕', name: 'คาปูชิโน่', price: 20000, preChecked: false },
  { id: '6', emoji: '🥤', name: 'ชาไทย',     price: 18000, preChecked: false },
  { id: '7', emoji: '🧊', name: 'กาแฟเย็น',  price: 20000, preChecked: false },
]

const fmt = (n: number) => n.toLocaleString('en-US')

interface Props {
  selectedIds: Set<string>
  onSelectionChange: (s: Set<string>) => void
  customItems: CustomItem[]
  onCustomItemsChange: (items: CustomItem[]) => void
  onNext: () => void
  onSkip: () => void
  onBack: () => void
}

export function SampleMenu({ selectedIds, onSelectionChange, customItems, onCustomItemsChange, onNext, onSkip, onBack }: Props) {
  const [showAddRow, setShowAddRow] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const counterRef = useRef(100)

  const toggle = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  const addCustom = () => {
    const name = newName.trim()
    const price = parseInt(newPrice.replace(/[^0-9]/g, ''), 10) || 0
    if (!name) return
    const id = String(++counterRef.current)
    onCustomItemsChange([...customItems, { id, name, price }])
    setNewName('')
    setNewPrice('')
    setShowAddRow(false)
  }

  const removeCustom = (id: string) => {
    onCustomItemsChange(customItems.filter(c => c.id !== id))
  }

  const totalCount = selectedIds.size + customItems.length

  const inp: React.CSSProperties = {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: '10px 12px',
    color: 'white',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
  }

  return (
    <div>
      <h2 style={{ color: 'white', fontWeight: 800, fontSize: 24, marginBottom: 6, fontFamily: 'var(--font-heading)', lineHeight: 1.2 }}>
        เริ่มจากเมนูเริ่มต้นไหม?
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
        แก้ไข ลบ หรือเพิ่มเองได้ทุกเมื่อจากแดชบอร์ด
      </p>

      {/* Sample items list */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
      }}>
        {SAMPLE_ITEMS.map((item, i) => {
          const checked = selectedIds.has(item.id)
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%', padding: '13px 16px',
                backgroundColor: checked ? 'rgba(201,168,76,0.06)' : 'transparent',
                border: 'none',
                borderBottom: i < SAMPLE_ITEMS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                transition: 'background-color 0.12s',
              }}
            >
              {/* Checkbox */}
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                backgroundColor: checked ? '#c9a84c' : 'transparent',
                border: `1.5px solid ${checked ? '#c9a84c' : 'rgba(255,255,255,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.12s',
              }}>
                {checked && <span style={{ color: '#000', fontSize: 11, fontWeight: 800, lineHeight: 1 }}>✓</span>}
              </div>

              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{item.emoji}</span>

              <span style={{ flex: 1, color: checked ? 'white' : 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: checked ? 600 : 400, transition: 'color 0.12s' }}>
                {item.name}
              </span>

              {item.preChecked && (
                <span style={{ fontSize: 10, color: 'rgba(201,168,76,0.5)', fontWeight: 600, letterSpacing: '0.4px', marginRight: 4 }}>เริ่มต้น</span>
              )}

              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, flexShrink: 0, fontFamily: 'monospace' }}>
                {fmt(item.price)}
              </span>
            </button>
          )
        })}

        {/* Custom items */}
        {customItems.map(item => (
          <div
            key={item.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 16px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              backgroundColor: 'rgba(201,168,76,0.05)',
            }}
          >
            <div style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: '#c9a84c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#000', fontSize: 11, fontWeight: 800 }}>✓</span>
            </div>
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>☕</span>
            <span style={{ flex: 1, color: 'white', fontSize: 15, fontWeight: 600 }}>{item.name}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'monospace', marginRight: 8 }}>
              {fmt(item.price)}
            </span>
            <button
              onClick={() => removeCustom(item.id)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1, flexShrink: 0 }}
              aria-label="ลบ"
            >×</button>
          </div>
        ))}

        {/* Add custom item row */}
        {showAddRow ? (
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              style={{ ...inp }}
              placeholder="ชื่อเมนู"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') addCustom(); if (e.key === 'Escape') setShowAddRow(false) }}
            />
            <input
              style={{ ...inp, flex: '0 0 110px' }}
              placeholder="ราคา LAK"
              value={newPrice}
              onChange={e => setNewPrice(e.target.value)}
              type="number"
              min="0"
              onKeyDown={e => { if (e.key === 'Enter') addCustom(); if (e.key === 'Escape') setShowAddRow(false) }}
            />
            <button
              onClick={addCustom}
              style={{ background: '#c9a84c', border: 'none', borderRadius: 8, padding: '10px 14px', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}
            >+</button>
            <button
              onClick={() => setShowAddRow(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 16, cursor: 'pointer', flexShrink: 0, padding: '0 4px' }}
            >×</button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddRow(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '12px 16px',
              background: 'none', border: 'none',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              color: 'rgba(201,168,76,0.7)', fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
              transition: 'color 0.12s',
            }}
          >
            <span style={{ fontSize: 16 }}>+</span> เพิ่มเมนูของฉันเอง
          </button>
        )}
      </div>

      {/* Primary action */}
      <button
        onClick={onNext}
        style={{
          width: '100%', backgroundColor: '#c9a84c', color: '#000',
          border: 'none', borderRadius: 12, padding: '15px',
          fontSize: 15, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', marginBottom: 10,
          opacity: totalCount === 0 ? 0.5 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {totalCount > 0
          ? `ใช้เมนูที่เลือก (${totalCount} รายการ) →`
          : 'เลือกเมนูอย่างน้อย 1 รายการ'}
      </button>

      {/* Skip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >
          ← ย้อนกลับ
        </button>
        <button
          onClick={onSkip}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >
          ข้าม — เพิ่มเมนูเองทีหลัง
        </button>
      </div>
    </div>
  )
}
