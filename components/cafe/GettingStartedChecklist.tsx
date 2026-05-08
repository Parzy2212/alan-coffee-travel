'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const GOLD  = '#c9a84c'
const GREEN = '#4cba7f'
const LS_HIDDEN    = 'alan_checklist_hidden'
const LS_COLLAPSED = 'alan_checklist_collapsed'

type Counts = {
  recipeCount:    number
  inventoryCount: number
  employeeCount:  number
  orderCount:     number
  printerSet:     boolean
}

const ANIM = `
@keyframes cl-shine { 0%,100%{opacity:.4} 50%{opacity:.75} }
@keyframes cl-pop { 0%{transform:scale(.95);opacity:0} 100%{transform:scale(1);opacity:1} }
@keyframes cl-celebrate { 0%{background-color:rgba(76,186,127,0.0)} 50%{background-color:rgba(76,186,127,0.12)} 100%{background-color:rgba(76,186,127,0.0)} }
`

export function GettingStartedChecklist() {
  const [counts,    setCounts]    = useState<Counts | null>(null)
  const [hidden,    setHidden]    = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [allDone,   setAllDone]   = useState(false)
  const collapseTimer             = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (localStorage.getItem(LS_HIDDEN))    { setHidden(true);    return }
    if (localStorage.getItem(LS_COLLAPSED)) { setCollapsed(true) }

    const printer = !!localStorage.getItem('alan_printer_name')

    Promise.all([
      supabase.from('recipes').select('id', { count: 'exact', head: true }),
      supabase.from('inventory').select('id', { count: 'exact', head: true }),
      supabase.from('employees').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
    ]).then(([r, inv, emp, ord]) => {
      setCounts({
        recipeCount:    r.count   ?? 0,
        inventoryCount: inv.count ?? 0,
        employeeCount:  emp.count ?? 0,
        orderCount:     ord.count ?? 0,
        printerSet:     printer,
      })
    })
    return () => { if (collapseTimer.current) clearTimeout(collapseTimer.current) }
  }, [])

  useEffect(() => {
    if (!counts) return
    const done = buildTasks(counts).every(t => t.done)
    if (done && !allDone) {
      setAllDone(true)
      collapseTimer.current = setTimeout(() => {
        localStorage.setItem(LS_HIDDEN, '1')
        setHidden(true)
      }, 4000)
    }
  }, [counts, allDone])

  if (hidden || !counts) return null

  const tasks = buildTasks(counts)
  const doneCount = tasks.filter(t => t.done).length
  const pct = Math.round((doneCount / tasks.length) * 100)

  const hide = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current)
    localStorage.setItem(LS_HIDDEN, '1')
    setHidden(true)
  }

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    if (next) localStorage.setItem(LS_COLLAPSED, '1')
    else localStorage.removeItem(LS_COLLAPSED)
  }

  return (
    <div style={{
      backgroundColor: allDone ? 'rgba(76,186,127,0.06)' : '#161616',
      border: `1px solid ${allDone ? 'rgba(76,186,127,0.3)' : 'rgba(201,168,76,0.2)'}`,
      borderRadius: 14, overflow: 'hidden',
      animation: allDone ? 'cl-celebrate 1.5s ease-in-out' : 'cl-pop 0.2s ease-out',
    }}>
      <style>{ANIM}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', cursor: 'pointer',
        borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.05)',
      }} onClick={toggleCollapse}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 20 }}>{allDone ? '🎉' : '🚀'}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: allDone ? GREEN : '#fff', marginBottom: 2 }}>
              {allDone ? 'ยินดีด้วย! ร้านพร้อมขายแล้ว' : 'เริ่มต้นใช้งาน'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              {doneCount}/{tasks.length} รายการ
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Progress bar */}
          <div style={{ width: 100, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${pct}%`,
              backgroundColor: allDone ? GREEN : GOLD,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', minWidth: 32 }}>{pct}%</span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16, lineHeight: 1 }}>
            {collapsed ? '▼' : '▲'}
          </span>
        </div>
      </div>

      {/* Task list */}
      {!collapsed && (
        <div style={{ padding: '4px 0 8px' }}>
          {tasks.map((task, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '10px 20px',
              opacity: task.done ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${task.done ? GREEN : 'rgba(255,255,255,0.2)'}`,
                backgroundColor: task.done ? GREEN : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: 'white',
                transition: 'all 0.2s',
              }}>
                {task.done ? '✓' : ''}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  fontSize: 13, color: task.done ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.85)',
                  textDecoration: task.done ? 'line-through' : 'none',
                  fontWeight: task.star && !task.done ? 600 : 400,
                }}>
                  {task.label}
                  {task.star && !task.done && <span style={{ marginLeft: 6, fontSize: 14 }}>⭐</span>}
                </span>
              </div>
              {!task.done && task.href && (
                <a href={task.href} style={{
                  flexShrink: 0, padding: '5px 12px', borderRadius: 6,
                  border: '1px solid rgba(201,168,76,0.3)',
                  backgroundColor: 'rgba(201,168,76,0.08)',
                  color: GOLD, fontSize: 12, fontWeight: 600, textDecoration: 'none',
                }}>
                  ทำเลย →
                </a>
              )}
            </div>
          ))}
          <div style={{ padding: '6px 20px 4px', textAlign: 'right' }}>
            <button onClick={hide} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)',
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              textDecoration: 'underline',
            }}>
              ซ่อน
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function buildTasks(c: Counts) {
  return [
    { label: 'ตั้งค่าร้านค้า',        done: true,                    href: '/shop/settings',          star: false },
    { label: 'เพิ่มเมนูเริ่มต้น',      done: c.recipeCount >= 1,      href: '/cafe',                   star: false },
    { label: 'ตั้งค่าเครื่องพิมพ์',   done: c.printerSet,             href: '/shop/settings/printer',  star: false },
    { label: 'เพิ่มเมนูครบ 10 รายการ', done: c.recipeCount >= 10,     href: '/cafe',                   star: false },
    { label: 'เพิ่มสต็อกวัตถุดิบ',    done: c.inventoryCount >= 1,   href: '/cafe',                   star: false },
    { label: 'เพิ่มพนักงาน POS',       done: c.employeeCount >= 1,    href: '/shop/team/employees',    star: false },
    { label: 'ทำออเดอร์แรก',           done: c.orderCount >= 1,       href: '/pos',                    star: true  },
  ]
}
