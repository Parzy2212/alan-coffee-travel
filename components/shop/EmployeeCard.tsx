'use client'

import { useEffect, useRef, useState } from 'react'
import type { EmployeeRow } from './EditEmployeeModal'

const GOLD = '#c9a84c'

type ActiveShift = { id: string; clocked_in: string }

interface EmployeeCardProps {
  employee: EmployeeRow
  activeShift: ActiveShift | null
  onEdit: () => void
  onChangePin: () => void
  onHistory: () => void
  onToggleActive: () => void
  onDelete: () => void
}

function timeAgoShort(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 0) return `${h} ชม. ${m} น.`
  return `${m} น.`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

export function EmployeeCard({ employee, activeShift, onEdit, onChangePin, onHistory, onToggleActive, onDelete }: EmployeeCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initial    = employee.name.trim()[0]?.toUpperCase() ?? '?'
  const isWorking  = !!activeShift && employee.is_active
  const roleLabel  = employee.role === 'manager' ? 'ผู้จัดการ' : 'พนักงาน'
  const roleIcon   = employee.role === 'manager' ? '👨‍💼' : '👨‍🍳'

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const menuActions: { label: string; icon: string; action: () => void; danger?: boolean; disabled?: boolean }[] = [
    { label: 'แก้ไขข้อมูล',  icon: '✏️',  action: onEdit },
    { label: 'เปลี่ยน PIN',  icon: '🔑',  action: onChangePin },
    { label: 'ดูประวัติ',    icon: '📊',  action: onHistory },
    { label: employee.is_active ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน', icon: employee.is_active ? '🔴' : '🟢', action: onToggleActive },
    { label: 'ลบพนักงาน',   icon: '🗑️',  action: onDelete, danger: true, disabled: isWorking },
  ]

  return (
    <div style={{
      backgroundColor: isWorking ? 'rgba(76,186,127,0.04)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isWorking ? 'rgba(76,186,127,0.2)' : employee.is_active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
      borderRadius: 14, padding: 20, position: 'relative',
      opacity: employee.is_active ? 1 : 0.5,
      transition: 'all 0.2s',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Avatar */}
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            backgroundColor: isWorking ? 'rgba(76,186,127,0.15)' : 'rgba(201,168,76,0.1)',
            border: `2px solid ${isWorking ? 'rgba(76,186,127,0.4)' : 'rgba(201,168,76,0.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ color: isWorking ? '#4cba7f' : GOLD, fontSize: 17, fontWeight: 700 }}>{initial}</span>
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{employee.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12 }}>{roleIcon}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{roleLabel}</span>
            </div>
          </div>
        </div>

        {/* Actions menu */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
              backgroundColor: menuOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ⋮
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 100,
              backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: '4px 0', minWidth: 160,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {menuActions.map(a => (
                <button
                  key={a.label}
                  onClick={() => { if (!a.disabled) { setMenuOpen(false); a.action() } }}
                  disabled={a.disabled}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                    color: a.disabled ? 'rgba(255,255,255,0.2)' : a.danger ? '#ff6b6b' : 'rgba(255,255,255,0.7)',
                    fontSize: 13, cursor: a.disabled ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={e => { if (!a.disabled) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <span>{a.icon}</span>
                  <span>{a.label}</span>
                  {a.disabled && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>ทำงานอยู่</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PIN dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600 }}>PIN</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          backgroundColor: isWorking ? '#4cba7f' : 'rgba(255,255,255,0.2)',
          boxShadow: isWorking ? '0 0 6px #4cba7f88' : 'none',
        }} />
        <span style={{ color: isWorking ? '#4cba7f' : 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: isWorking ? 600 : 400 }}>
          {isWorking
            ? `กำลังทำงาน — เข้า ${fmtTime(activeShift!.clocked_in)} (${timeAgoShort(activeShift!.clocked_in)})`
            : employee.is_active ? 'ไม่ได้ทำงาน' : 'ปิดการใช้งาน'}
        </span>
      </div>
    </div>
  )
}
