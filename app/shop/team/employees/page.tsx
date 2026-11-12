'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShopLayout } from '@/components/ShopLayout'
import { useShop } from '@/lib/use-shop'
import { useAuth } from '@/contexts/AuthContext'
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
  const { user } = useAuth()
  const { shopId, loading: shopLoading } = useShop()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [activeShifts, setActiveShifts] = useState<ActiveShift[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>(null)
  const [toggleErr, setToggleErr] = useState('')

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

  useEffect(() => {
    if (shopLoading) return
    if (shopId) load()
    else setLoading(false)
  }, [shopLoading, shopId, load])

  const activeShiftMap = new Map(activeShifts.map(s => [s.employee_id, s]))

  // Same rules the old HR on/off button had: never switch off someone who is still
  // clocked in at the kiosk, and take them off the future schedule.
  const handleToggleActive = async (emp: Employee) => {
    setToggleErr('')
    const { authClient } = await import('@/lib/supabase-auth')
    const { supabase } = await import('@/lib/supabase')
    let staffId: string | null = null
    if (emp.is_active) {
      const { data: hr, error: hrErr } = await supabase.from('staff').select('id').eq('employee_id', emp.id).maybeSingle()
      if (hrErr) { setToggleErr(`ปิดใช้งานไม่ได้: ตรวจการลงเวลาไม่สำเร็จ (${hrErr.message})`); return }
      staffId = (hr as { id: string } | null)?.id ?? null
      if (staffId) {
        const { data: today, error: todayErr } = await supabase.rpc('get_staff_today_status')
        if (todayErr) { setToggleErr(`ปิดใช้งานไม่ได้: ตรวจการลงเวลาไม่สำเร็จ (${todayErr.message})`); return }
        const t = ((today ?? []) as { id: string; clock_in: string | null; clock_out: string | null }[]).find(r => r.id === staffId)
        if (t?.clock_in && !t.clock_out) { setToggleErr(`ปิดใช้งาน ${emp.name} ไม่ได้: ยังลงเวลาเข้างานอยู่ ให้ลงเวลาออกก่อน`); return }
      }
    }
    // RLS refuses by updating 0 rows without an error, so ask for the row back
    const { data: changed, error } = await authClient.from('employees').update({ is_active: !emp.is_active }).eq('id', emp.id).select('id')
    if (error || !changed?.length) { setToggleErr(`เปลี่ยนสถานะไม่สำเร็จ: ${error?.message ?? 'ไม่มีสิทธิ์ หรือหมดเวลาเข้าสู่ระบบ ให้เข้าสู่ระบบใหม่'}`); return }
    if (staffId) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Vientiane' })
      const { error: schedErr } = await supabase.from('staff_schedules').delete()
        .eq('staff_id', staffId).gte('date', today)
      if (schedErr) setToggleErr(`ปิดใช้งานแล้ว แต่ลบกะล่วงหน้าในตารางงานไม่สำเร็จ: ${schedErr.message}`)
    }
    load()
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

  if (!shopId) {
    return (
      <ShopLayout>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 300, textAlign: 'center', backgroundColor: 'rgba(255,77,77,0.04)',
          border: '1px dashed rgba(255,77,77,0.2)', borderRadius: 16, padding: 32,
        }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'white', marginBottom: 8 }}>ไม่พบร้านที่คุณเป็นเจ้าของ</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', maxWidth: 360, lineHeight: 1.7 }}>
            บัญชีนี้ไม่มีบทบาท owner ผูกกับร้านใดเลยในระบบ ({user?.email}) — ลองออกจากระบบแล้วเข้าใหม่
            ถ้ายังเจอปัญหานี้อยู่ ติดต่อทีมพัฒนา
          </div>
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

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 6 }}>รายชื่อพนักงาน</div>
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

      {toggleErr && (
        <div role="alert" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 9, border: '1px solid rgba(255,77,77,0.3)', backgroundColor: 'rgba(255,77,77,0.08)', color: '#ff8080', fontSize: 13 }}>{toggleErr}</div>
      )}

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
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 14 }}>พนักงานใช้ PIN 4 หลักเดียวกันทั้งหน้าขายและลงเวลา</div>
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
            />
          ))}
        </div>
      )}
    </ShopLayout>
  )
}
