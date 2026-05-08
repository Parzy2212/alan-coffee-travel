'use client'

import { EVENT_TYPES } from './ActivityFilters'
import type { AccountEvent } from './ActivityTimeline'

const EVENT_MAP = Object.fromEntries(EVENT_TYPES.map(t => [t.value, t]))

export function exportActivityCSV(events: AccountEvent[]) {
  const header = ['เวลา', 'ประเภท', 'รายละเอียด', 'IP Address', 'อุปกรณ์']
  const rows = events.map(ev => [
    new Date(ev.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Vientiane' }),
    EVENT_MAP[ev.event_type]?.label ?? ev.event_type,
    ev.description ?? '',
    ev.ip_address ?? '',
    ev.user_agent ?? '',
  ])
  const csv = [header, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `account-activity-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface Props {
  events: AccountEvent[]
  disabled?: boolean
}

export function ActivityExportButton({ events, disabled }: Props) {
  return (
    <button
      onClick={() => exportActivityCSV(events)}
      disabled={disabled || events.length === 0}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 8,
        border: '1px solid rgba(201,168,76,0.3)',
        backgroundColor: 'rgba(201,168,76,0.08)',
        color: events.length === 0 ? 'rgba(255,255,255,0.2)' : '#c9a84c',
        fontSize: 13, fontWeight: 600, cursor: events.length === 0 ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s',
      }}
    >
      ⬇ ส่งออก CSV
    </button>
  )
}
