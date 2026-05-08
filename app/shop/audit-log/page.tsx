'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShopLayout } from '@/components/ShopLayout'
import { supabase } from '@/lib/supabase'

const GOLD  = '#c9a84c'
const RED   = '#ff4d4d'
const GREEN = '#4cba7f'
const PAGE_SIZE = 50

type AuditLog = {
  id: string
  created_at: string
  staff_name: string | null
  action: string
  table_name: string
  record_id: string | null
  payload: unknown
}

const INP: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8,
  border: '1px solid rgba(201,168,76,0.15)',
  backgroundColor: '#161616', color: '#fff', fontSize: 13,
}

const actionColor = (a: string) =>
  a === 'insert' || a === 'insert_many' ? GREEN
  : a === 'update' || a === 'upsert'    ? GOLD
  : a === 'delete' || a === 'delete_match' ? RED
  : 'rgba(255,255,255,0.4)'

export default function AuditLogPage() {
  const [logs,         setLogs]         = useState<AuditLog[]>([])
  const [loading,      setLoading]      = useState(true)
  const [noTable,      setNoTable]      = useState(false)
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [staffFilter,  setStaffFilter]  = useState('')
  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(2000)
    if (dateFrom) q = q.gte('created_at', dateFrom)
    if (dateTo)   q = q.lte('created_at', dateTo + 'T23:59:59')
    const { data, error } = await q
    if ((error as { code?: string } | null)?.code === '42P01') { setNoTable(true); setLoading(false); return }
    setLogs((data as AuditLog[]) ?? [])
    setPage(0)
    setLoading(false)
  }, [dateFrom, dateTo])

  useEffect(() => { void load() }, [load])

  const filtered = logs.filter(l => {
    if (actionFilter !== 'all' && l.action !== actionFilter) return false
    if (staffFilter && !(l.staff_name ?? '').toLowerCase().includes(staffFilter.toLowerCase())) return false
    if (search) {
      const q = search.toLowerCase()
      const hay = `${l.table_name} ${l.record_id ?? ''} ${JSON.stringify(l.payload)} ${l.staff_name ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function exportCSV() {
    const rows = [
      ['เวลา', 'พนักงาน', 'Action', 'ตาราง', 'Record ID', 'Payload'],
      ...filtered.map(l => [
        new Date(l.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Vientiane' }),
        l.staff_name ?? '',
        l.action,
        l.table_name,
        l.record_id ?? '',
        JSON.stringify(l.payload),
      ]),
    ]
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => { setDateFrom(''); setDateTo(''); setActionFilter('all'); setSearch(''); setStaffFilter(''); setPage(0) }
  const hasFilter = dateFrom || dateTo || actionFilter !== 'all' || search || staffFilter

  if (noTable) {
    return (
      <ShopLayout>
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.35)' }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>📋</div>
          <div style={{ fontSize: 15, marginBottom: 8 }}>ยังไม่มีตาราง audit_logs</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            CREATE TABLE audit_logs (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, created_at timestamptz DEFAULT now(), staff_name text, action text, table_name text, record_id text, payload jsonb);
          </div>
        </div>
      </ShopLayout>
    )
  }

  return (
    <ShopLayout>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 6 }}>บันทึกระบบ</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>ประวัติการเปลี่ยนแปลงข้อมูลในระบบ</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Filters row 1 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }} style={INP} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>—</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }} style={INP} />
          <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0) }}
            style={{ ...INP, cursor: 'pointer' }}>
            <option value="all">ทุก Action</option>
            {['insert', 'update', 'delete', 'upsert', 'insert_many', 'delete_match'].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Filters row 2 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="ค้นหา..." style={{ ...INP, minWidth: 200 }} />
          <input value={staffFilter} onChange={e => { setStaffFilter(e.target.value); setPage(0) }} placeholder="กรองพนักงาน" style={{ ...INP, minWidth: 160 }} />
          {hasFilter && (
            <button onClick={clearFilters}
              style={{ ...INP, backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit' }}>
              ล้างทั้งหมด
            </button>
          )}
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{filtered.length.toLocaleString()} รายการ</span>
          <button onClick={exportCSV}
            style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: `1px solid ${GOLD}44`, backgroundColor: `${GOLD}12`, color: GOLD, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ⬇ CSV
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[1,2,3,4].map(i => <div key={i} style={{ height: 44, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.04)' }} />)}
            <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
          </div>
        ) : pageRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>ไม่พบรายการ</div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(201,168,76,0.1)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  {['เวลา', 'พนักงาน', 'Action', 'ตาราง', 'Record ID', 'รายละเอียด'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', backgroundColor: i % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                    <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.4)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Vientiane', dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{log.staff_name ?? '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: actionColor(log.action), backgroundColor: actionColor(log.action) + '18' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.65)' }}>{log.table_name}</td>
                    <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: 11 }}>
                      {log.record_id ? log.record_id.slice(0, 8) + '...' : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.28)', fontFamily: 'monospace', fontSize: 11, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {JSON.stringify(log.payload)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', paddingTop: 8 }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: page === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: page === 0 ? 'default' : 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              ←
            </button>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>หน้า {page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: page >= totalPages - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              →
            </button>
          </div>
        )}
      </div>
    </ShopLayout>
  )
}
