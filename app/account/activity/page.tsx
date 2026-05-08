'use client'

import { useCallback, useEffect, useState } from 'react'
import { AccountLayout } from '@/components/AccountLayout'
import { ActivityFilters, type DateRange } from '@/components/account/ActivityFilters'
import { ActivityTimeline, type AccountEvent } from '@/components/account/ActivityTimeline'
import { ActivityExportButton } from '@/components/account/ActivityExport'
import { useAuth } from '@/contexts/AuthContext'

const PAGE_SIZE = 50

function dateRangeStart(range: DateRange): string | null {
  const now = new Date()
  if (range === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString() }
  if (range === '7d')  { return new Date(now.getTime() - 7  * 86400000).toISOString() }
  if (range === '30d') { return new Date(now.getTime() - 30 * 86400000).toISOString() }
  if (range === '90d') { return new Date(now.getTime() - 90 * 86400000).toISOString() }
  return null
}

export default function ActivityPage() {
  const { user } = useAuth()
  const [events, setEvents]           = useState<AccountEvent[]>([])
  const [loading, setLoading]         = useState(true)
  const [dateRange, setDateRange]     = useState<DateRange>('30d')
  const [selectedTypes, setSelected]  = useState<string[]>([])
  const [page, setPage]               = useState(0)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { authClient } = await import('@/lib/supabase-auth')
    let q = authClient
      .from('account_events')
      .select('id, event_type, description, ip_address, user_agent, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(2000)
    const start = dateRangeStart(dateRange)
    if (start) q = q.gte('created_at', start)
    if (selectedTypes.length > 0) q = q.in('event_type', selectedTypes)
    const { data } = await q
    setEvents((data as AccountEvent[]) ?? [])
    setPage(0)
    setLoading(false)
  }, [user, dateRange, selectedTypes])

  useEffect(() => { load() }, [load])

  const handleToggleType = (type: string) => {
    setSelected(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  const handleClear = () => { setDateRange('30d'); setSelected([]) }

  const totalPages = Math.ceil(events.length / PAGE_SIZE)

  return (
    <AccountLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: 'white', fontWeight: 800, fontSize: 22, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>
          กิจกรรม
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>
          บันทึกการใช้งานและเหตุการณ์ทั้งหมดในบัญชีของคุณ
        </p>
      </div>

      <div style={{
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 600 }}>บันทึกกิจกรรม</div>
          <ActivityExportButton events={events} disabled={loading} />
        </div>

        <ActivityFilters
          dateRange={dateRange}
          selectedTypes={selectedTypes}
          onDateRange={r => { setDateRange(r); setPage(0) }}
          onToggleType={handleToggleType}
          onClear={handleClear}
          total={events.length}
        />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ height: 52, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)' }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
          </div>
        ) : (
          <ActivityTimeline events={events} page={page} pageSize={PAGE_SIZE} />
        )}

        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: page === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: page === 0 ? 'default' : 'pointer', fontSize: 13, fontFamily: 'inherit' }}
            >
              ← ก่อนหน้า
            </button>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>หน้า {page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: page >= totalPages - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontSize: 13, fontFamily: 'inherit' }}
            >
              ถัดไป →
            </button>
          </div>
        )}
      </div>
    </AccountLayout>
  )
}
