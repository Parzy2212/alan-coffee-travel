'use client'

import { useCallback, useEffect, useState } from 'react'
import { IBM_Plex_Sans_Thai } from 'next/font/google'
import { ShopLayout } from '@/components/ShopLayout'
import { supabase } from '@/lib/supabase'
import {
  GOLD, BG_BASE, BG_SURFACE, BG_CARD_ALT,
  BORDER_SUBTLE, BORDER_DEFAULT, BORDER_GOLD,
  TEXT_1, TEXT_2, TEXT_3, TEXT_4, TEXT_5,
  SUCCESS, WARNING, DANGER,
  FONT_MONO, RADIUS, SHADOW_MODAL, STATE_HOVER, STATE_FOCUS_RING, STATE_SELECTED_BORDER,
} from '@/lib/pos-theme-tokens'

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

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
  fontFamily: 'inherit', fontSize: 13, color: TEXT_1,
  backgroundColor: BG_CARD_ALT, border: `1px solid ${BORDER_DEFAULT}`,
  borderRadius: RADIUS.md, padding: '10px 14px', outline: 'none',
}

const actionColor = (a: string) =>
  a === 'insert' || a === 'insert_many' ? SUCCESS
  : a === 'update' || a === 'upsert'    ? WARNING
  : a === 'delete' || a === 'delete_match' ? DANGER
  : TEXT_3

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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1
  const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const pageNumbers = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    const start = Math.max(0, Math.min(page - 2, totalPages - 5))
    return start + i
  }).filter(n => n < totalPages)

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

  const actionLabels: Record<string, string> = {
    all: 'ทุก Action', insert: 'insert', insert_many: 'insert_many',
    update: 'update', upsert: 'upsert', delete: 'delete', delete_match: 'delete_match',
  }

  if (noTable) {
    return (
      <ShopLayout>
        <div className={ibmPlexSansThai.className} style={{ textAlign: 'center', padding: '60px 0', color: TEXT_4 }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>📋</div>
          <div style={{ fontSize: 15, marginBottom: 8 }}>ยังไม่มีตาราง audit_logs</div>
          <div style={{ fontSize: 12, color: TEXT_5, fontFamily: FONT_MONO, wordBreak: 'break-all' }}>
            CREATE TABLE audit_logs (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, created_at timestamptz DEFAULT now(), staff_name text, action text, table_name text, record_id text, payload jsonb);
          </div>
        </div>
      </ShopLayout>
    )
  }

  return (
    <ShopLayout>
      <div className={`${ibmPlexSansThai.className} audit-log-card`} style={{
        backgroundColor: BG_BASE, border: `1px solid ${BORDER_SUBTLE}`, borderRadius: RADIUS['3xl'],
        overflow: 'hidden', boxShadow: SHADOW_MODAL,
      }}>
        {/* Header + filters */}
        <div style={{ padding: '22px 24px 18px', borderBottom: `1px solid ${BORDER_SUBTLE}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: TEXT_1 }}>ประวัติเหตุการณ์</h1>
              <div style={{ fontSize: 13, color: TEXT_2 }}>
                พบ <span style={{ fontFamily: FONT_MONO, color: TEXT_1 }}>{filtered.length.toLocaleString()}</span> รายการ
              </div>
            </div>
            <button onClick={exportCSV} style={{
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500, color: TEXT_2,
              backgroundColor: BG_CARD_ALT, border: `1px solid ${BORDER_DEFAULT}`, borderRadius: RADIUS.md,
              padding: '9px 14px', cursor: 'pointer',
            }}>⬇ ส่งออก CSV</button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
              placeholder="ค้นหาชื่อพนักงาน เลขรายการ หรือรายละเอียด…"
              style={{ ...INP, flex: 1, minWidth: 260 }}
            />
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }} style={INP} />
            <span style={{ color: TEXT_4, fontSize: 13 }}>—</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }} style={INP} />
            <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0) }}
              style={{ ...INP, cursor: 'pointer' }}>
              {Object.entries(actionLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <input value={staffFilter} onChange={e => { setStaffFilter(e.target.value); setPage(0) }} placeholder="กรองพนักงาน" style={{ ...INP, minWidth: 140 }} />
          </div>

          {hasFilter && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span
                onClick={clearFilters}
                style={{ fontSize: 12, color: TEXT_3, cursor: 'pointer', padding: '4px 2px' }}
              >ล้างตัวกรองทั้งหมด ✕</span>
            </div>
          )}
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '150px 168px 150px 1fr',
          padding: '11px 24px', backgroundColor: BG_SURFACE, borderBottom: `1px solid ${BORDER_SUBTLE}`,
          fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: TEXT_3,
        }}>
          <div>เวลา</div><div>พนักงาน</div><div>Action</div><div>รายละเอียด</div>
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 24 }}>
            {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 44, borderRadius: RADIUS.sm, backgroundColor: STATE_HOVER }} />)}
          </div>
        ) : pageRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: TEXT_4, fontSize: 14 }}>ไม่พบรายการ</div>
        ) : (
          pageRows.map((log, i) => (
            <div key={log.id} style={{
              display: 'grid', gridTemplateColumns: '150px 168px 150px 1fr', alignItems: 'center',
              padding: '13px 24px', borderBottom: `1px solid ${BORDER_SUBTLE}`,
              backgroundColor: i % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent',
            }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: TEXT_2 }}>
                {new Date(log.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Vientiane', dateStyle: 'short', timeStyle: 'short' })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: RADIUS.pill, flexShrink: 0,
                  backgroundColor: log.staff_name ? 'rgba(201,168,76,0.12)' : BG_CARD_ALT,
                  border: `1px solid ${log.staff_name ? BORDER_GOLD : BORDER_DEFAULT}`,
                  display: 'grid', placeItems: 'center', fontSize: 10, color: log.staff_name ? GOLD : TEXT_3,
                }}>{log.staff_name ? log.staff_name.charAt(0) : '◇'}</div>
                <span style={{ fontSize: 13, color: log.staff_name ? TEXT_1 : TEXT_2 }}>{log.staff_name ?? 'ระบบ'}</span>
              </div>
              <div>
                <span style={{
                  padding: '2px 8px', borderRadius: RADIUS.sm, fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.5px', textTransform: 'uppercase',
                  color: actionColor(log.action), backgroundColor: actionColor(log.action) + '18',
                }}>{log.action}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13, color: TEXT_2 }}>{log.table_name}{log.record_id ? ` · ${log.record_id.slice(0, 8)}…` : ''}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: TEXT_4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {JSON.stringify(log.payload)}
                </span>
              </div>
            </div>
          ))
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            padding: '14px 24px', backgroundColor: BG_SURFACE, borderTop: `1px solid ${BORDER_SUBTLE}`,
          }}>
            <div style={{ fontSize: 12, color: TEXT_3 }}>
              แสดง {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} จาก {filtered.length.toLocaleString()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{ fontFamily: 'inherit', fontSize: 13, padding: '7px 12px', borderRadius: RADIUS.md, border: `1px solid ${BORDER_DEFAULT}`, backgroundColor: 'transparent', color: page === 0 ? TEXT_5 : TEXT_2, cursor: page === 0 ? 'default' : 'pointer' }}>ก่อนหน้า</button>
              {pageNumbers.map(n => (
                <button key={n} onClick={() => setPage(n)} style={{
                  fontFamily: FONT_MONO, fontSize: 13, fontWeight: n === page ? 600 : 400,
                  padding: '7px 13px', borderRadius: RADIUS.md, cursor: 'pointer',
                  color: n === page ? GOLD : TEXT_2,
                  backgroundColor: n === page ? 'rgba(201,168,76,0.12)' : 'transparent',
                  border: `1px solid ${n === page ? STATE_SELECTED_BORDER : BORDER_DEFAULT}`,
                }}>{n + 1}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                style={{ fontFamily: 'inherit', fontSize: 13, padding: '7px 12px', borderRadius: RADIUS.md, border: `1px solid ${BORDER_DEFAULT}`, backgroundColor: 'transparent', color: page >= totalPages - 1 ? TEXT_5 : TEXT_2, cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>ถัดไป</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .audit-log-card input:focus,
        .audit-log-card select:focus {
          outline: ${STATE_FOCUS_RING};
          outline-offset: 2px;
          border-color: ${GOLD} !important;
        }
      `}</style>
    </ShopLayout>
  )
}
