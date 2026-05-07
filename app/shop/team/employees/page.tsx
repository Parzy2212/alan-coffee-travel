'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShopLayout } from '@/components/ShopLayout'
import { useShop } from '@/lib/use-shop'
import { EmployeeCard } from '@/components/shop/EmployeeCard'
import { AddEmployeeModal } from '@/components/shop/AddEmployeeModal'
import { EditEmployeeModal, type EmployeeRow } from '@/components/shop/EditEmployeeModal'
import { EmployeeHistoryModal } from '@/components/shop/EmployeeHistoryModal'

const GOLD = '#c9a84c'

type Employee = EmployeeRow & { hourly_rate: number | null }
type ActiveShift = { id: string; employee_id: string; clocked_in: string }

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; employee: Employee; tab: 'info' | 'pin' }
  | { type: 'history'; employee: Employee }
  | null

export default function EmployeesPage() {
  const { shopId, loading: shopLoading } = useShop()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [activeShifts, setActiveShifts] = useState<ActiveShift[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!shopId) return
    const { authClient } = await import('@/lib/supabase-auth')
    const [empRes, shiftRes] = await Promise.all([
      authClient.from('employees').select('id, name, role, is_active, hourly_rate, notes').eq('shop_id', shopId).order('name'),
      authClient.from('employee_shifts').select('id, employee_id, clocked_in').eq('shop_id', shopId).is('clocked_out', null),
    ])
    setEmployees((empRes.data as Employee[]) ?? [])
    setActiveShifts((shiftRes.data as ActiveShift[]) ?? [])
    setLoading(false)
  }, [shopId])

  useEffect(() => { if (shopId) load() }, [shopId, load])

  const activeShiftMap = new Map(activeShifts.map(s => [s.employee_id, s]))

  const handleToggleActive = async (emp: Employee) => {
    const { authClient } = await import('@/lib/supabase-auth')
    await authClient.from('employees').update({ is_active: !emp.is_active }).eq('id', emp.id)
    load()
  }

  const handleDelete = async (emp: Employee) => {
    setDeleting(true)
    try {
      const { authClient } = await import('@/lib/supabase-auth')
      const { error } = await authClient.from('employees').delete().eq('id', emp.id)
      if (error) {
        if (error.message.includes('foreign key') || error.message.includes('orders')) {
          await authClient.from('employees').update({ is_active: false }).eq('id', emp.id)
        } else {
          throw error
        }
      }
    } catch { /* ignore */ } finally {
      setDeleting(false)
      setDeleteConfirm(null)
      load()
    }
  }

  const totalActive = employees.filter(e => e.is_active).length
  const totalWorking = activeShifts.filter(s => employees.find(e => e.id === s.employee_id)?.is_active).length

  if (shopLoading || loading) {
    return (
      <ShopLayout>
        <div style={{ marginBottom: 32 }}>
          <div style={{ height: 28, width: 180, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 8 }} />
          <div style={{ height: 16, width: 120, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 140, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)' }} />)}
        </div>
      </ShopLayout>
    )
  }

  return (
    <ShopLayout>
      {modal?.type === 'add' && shopId && (
        <AddEmployeeModal shopId={shopId} onSaved={() => { setModal(null); load() }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'edit' && (
        <EditEmployeeModal employee={modal.employee} initialTab={modal.tab} onSaved={() => { setModal(null); load() }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'history' && (
        <EmployeeHistoryModal employeeId={modal.employee.id} employeeName={modal.employee.name} hourlyRate={modal.employee.hourly_rate} onClose={() => setModal(null)} />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', fontFamily: 'inherit' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 10 }}>ลบพนักงาน?</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              &ldquo;{deleteConfirm.name}&rdquo; จะถูกลบออกจากระบบ<br />
              หากมีออเดอร์ที่เชื่อมโยงอยู่ จะถูกปิดการใช้งานแทนการลบ
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', backgroundColor: deleting ? 'rgba(255,77,77,0.3)' : '#ff4d4d', color: 'white', fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {deleting ? 'กำลังลบ...' : 'ลบพนักงาน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 6 }}>พนักงาน POS</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
            {totalActive} คน{totalWorking > 0 ? ` • ${totalWorking} กำลังทำงาน` : ''}
          </div>
        </div>
        <button
          onClick={() => setModal({ type: 'add' })}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 9, border: 'none',
            backgroundColor: GOLD, color: '#000', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          + เพิ่มพนักงาน
        </button>
      </div>

      {/* Empty state */}
      {employees.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 360, textAlign: 'center',
          backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16,
          border: '1px dashed rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🏷️</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 8 }}>ยังไม่มีพนักงาน</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 320, lineHeight: 1.7, marginBottom: 24 }}>
            เพิ่มพนักงานเพื่อให้แต่ละคนเข้าใช้งาน POS ด้วย PIN ของตัวเอง
          </div>
          <button
            onClick={() => setModal({ type: 'add' })}
            style={{ padding: '12px 28px', borderRadius: 9, border: 'none', backgroundColor: GOLD, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            + เพิ่มพนักงานคนแรก
          </button>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 14 }}>พนักงานจะใช้ PIN 4 หลักเข้าสู่ระบบ POS</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {employees.map(emp => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              activeShift={activeShiftMap.get(emp.id) ?? null}
              onEdit={() => setModal({ type: 'edit', employee: emp, tab: 'info' })}
              onChangePin={() => setModal({ type: 'edit', employee: emp, tab: 'pin' })}
              onHistory={() => setModal({ type: 'history', employee: emp })}
              onToggleActive={() => handleToggleActive(emp)}
              onDelete={() => setDeleteConfirm(emp)}
            />
          ))}
        </div>
      )}
    </ShopLayout>
  )
}
