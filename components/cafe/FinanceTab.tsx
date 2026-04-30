'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { MoneyInput } from '@/components/MoneyInput'
import {
  GOLD, CARD, BORDER, RED, GREEN, ORANGE,
  fmtLAK, todayISO, inputStyle,
} from '@/components/cafe/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

type CFEntry = {
  id: string
  type: 'income' | 'expense'
  category: string
  amount_lak: number
  description: string | null
  payment_method: string
  date: string
  notes: string | null
  created_at: string
}

type BudgetRow = {
  id: string
  category: string
  monthly_budget_lak: number
  spent_this_month: number
  start_date: string
}

type DailyBar = { day: string; income: number; expense: number }

type CFSummary = { total_income: number; total_expense: number; net: number }

// ─── Constants ────────────────────────────────────────────────────────────────

const INCOME_CATS  = ['ยอดขาย', 'บริการพิเศษ', 'เงินฝาก', 'อื่นๆ']
const EXPENSE_CATS = ['วัตถุดิบ', 'ค่าแรง', 'ค่าเช่า', 'ค่าไฟ', 'ค่าน้ำ', 'การตลาด', 'อุปกรณ์', 'อื่นๆ']
const PAY_METHODS  = ['cash', 'transfer', 'card', 'QR']

function monthStart(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`
}

function lbl(text: string) {
  return (
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: 5 }}>
      {text}
    </div>
  )
}

// ─── SetupWizard ──────────────────────────────────────────────────────────────

function SetupWizard({ onDone }: { onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [notes,  setNotes]  = useState('')
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  async function save() {
    const n = parseFloat(amount)
    if (isNaN(n) || n < 0) { setErr('กรุณากรอกยอดทุนเริ่มต้น (0 หรือมากกว่า)'); return }
    setSaving(true)
    const { error } = await supabase.from('initial_capital').insert({
      amount_lak: n, as_of_date: todayISO(), notes: notes.trim() || null,
    })
    if (error) { setErr(error.message); setSaving(false); return }
    onDone()
  }

  return (
    <div style={{ maxWidth: 440, margin: '60px auto', padding: 32, borderRadius: 16, backgroundColor: CARD, border: `1px solid ${GOLD}44` }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: GOLD, marginBottom: 6 }}>ตั้งค่าเงินทุนเริ่มต้น</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 28, lineHeight: 1.6 }}>
        กรุณากรอกยอดเงินสดที่มีอยู่ ณ วันนี้เพื่อเริ่มระบบติดตามกระแสเงินสด
      </div>
      <div style={{ marginBottom: 16 }}>
        {lbl('ยอดเงินสดเริ่มต้น (LAK)')}
        <MoneyInput value={amount} onChange={setAmount} placeholder="0"
          style={{ ...inputStyle, fontSize: 18, fontWeight: 700 }} />
      </div>
      <div style={{ marginBottom: 24 }}>
        {lbl('หมายเหตุ (ไม่บังคับ)')}
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="เช่น ยอดเงินในกล่องเก็บเงิน"
          style={inputStyle} />
      </div>
      {err && <div style={{ color: RED, fontSize: 13, marginBottom: 12 }}>{err}</div>}
      <button onClick={() => void save()} disabled={saving}
        style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', backgroundColor: GOLD, color: '#000', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'กำลังบันทึก...' : 'เริ่มต้นใช้งาน'}
      </button>
    </div>
  )
}

// ─── AddEntryModal ────────────────────────────────────────────────────────────

function AddEntryModal({ type, onSave, onClose }: {
  type: 'income' | 'expense'
  onSave: () => void
  onClose: () => void
}) {
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS
  const [form, setForm] = useState({
    category: cats[0], amount: '', description: '', payment_method: 'cash', date: todayISO(), notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) { setErr('กรุณากรอกจำนวนเงินที่ถูกต้อง (> 0)'); return }
    setSaving(true)
    const { error } = await supabase.from('cash_flow').insert({
      type, category: form.category, amount_lak: amt,
      description: form.description.trim() || null,
      payment_method: form.payment_method,
      date: form.date,
      notes: form.notes.trim() || null,
    })
    if (error) { setErr(error.message); setSaving(false); return }
    onSave()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, backgroundColor: '#111', borderRadius: 16, border: `1px solid ${type === 'income' ? GREEN : RED}44`, padding: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: type === 'income' ? GREEN : RED, marginBottom: 20 }}>
          {type === 'income' ? '+ บันทึกเงินเข้า' : '− บันทึกเงินออก'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            {lbl('หมวดหมู่')}
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            {lbl('จำนวนเงิน (LAK)')}
            <MoneyInput value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} placeholder="0" style={inputStyle} />
          </div>
          <div>
            {lbl('รายละเอียด')}
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="เช่น รายรับจากการขายกาแฟ" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {lbl('วิธีชำระ')}
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} style={inputStyle}>
                {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              {lbl('วันที่')}
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div>
            {lbl('หมายเหตุ')}
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="(ไม่บังคับ)" style={inputStyle} />
          </div>
        </div>
        {err && <div style={{ color: RED, fontSize: 12, marginTop: 10 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={() => void save()} disabled={saving}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', backgroundColor: type === 'income' ? GREEN : RED, color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
          <button onClick={onClose}
            style={{ padding: '10px 18px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── OverviewSection ──────────────────────────────────────────────────────────

function OverviewSection() {
  const [balance,  setBalance]  = useState<number | null>(null)
  const [summary,  setSummary]  = useState<CFSummary | null>(null)
  const [daily,    setDaily]    = useState<DailyBar[]>([])
  const [loading,  setLoading]  = useState(true)
  const [shiftOpen, setShiftOpen] = useState(false)
  const [shiftForm, setShiftForm] = useState({ shift: 'morning', opening_cash: '', actual_cash: '' })
  const [shiftSaving, setShiftSaving] = useState(false)
  const [shiftMsg, setShiftMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const [{ data: bal }, { data: sum }, { data: dc }] = await Promise.all([
      supabase.rpc('get_current_cash_balance'),
      supabase.rpc('get_cash_flow_summary', { p_start: monthStart(), p_end: todayISO() }),
      supabase.rpc('get_daily_cashflow', { p_year: now.getFullYear(), p_month: now.getMonth() + 1 }),
    ])
    setBalance((bal as number | null) ?? 0)
    setSummary((sum as CFSummary[] | null)?.[0] ?? null)
    setDaily(((dc as { day: string; income: number; expense: number }[] | null) ?? []).map(r => ({
      day: r.day.slice(5), income: r.income, expense: r.expense,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function closeShift() {
    const opening = parseFloat(shiftForm.opening_cash), actual = parseFloat(shiftForm.actual_cash)
    if (isNaN(opening) || isNaN(actual)) { setShiftMsg('กรุณากรอกยอดเงินให้ถูกต้อง'); return }
    setShiftSaving(true); setShiftMsg('')
    const { data: stats } = await supabase.rpc('get_dashboard_stats')
    const systemSales = (stats as { today_sales?: number } | null)?.today_sales ?? 0
    const { error } = await supabase.rpc('close_shift', {
      p_staff_id: null, p_shift: shiftForm.shift,
      p_opening_cash: opening, p_actual_cash: actual, p_system_sales: systemSales,
    })
    if (error) { setShiftMsg(error.message) } else {
      setShiftForm(f => ({ ...f, opening_cash: '', actual_cash: '' }))
      setShiftOpen(false)
    }
    setShiftSaving(false)
  }

  const kpis = [
    { label: 'ยอดเงินสด (ปัจจุบัน)',  val: balance ?? 0,           color: GOLD  },
    { label: 'รายรับเดือนนี้',          val: summary?.total_income ?? 0,  color: GREEN },
    { label: 'รายจ่ายเดือนนี้',         val: summary?.total_expense ?? 0, color: RED   },
    { label: 'กำไร/ขาดทุน เดือนนี้',   val: summary?.net ?? 0,           color: (summary?.net ?? 0) >= 0 ? GREEN : RED },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ padding: '18px 20px', borderRadius: 12, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>{k.label}</div>
            {loading
              ? <div style={{ height: 28, borderRadius: 6, backgroundColor: '#1a1a1a', animation: 'pulse 1.5s infinite' }} />
              : <div style={{ fontSize: 20, fontWeight: 800, color: k.color, fontVariantNumeric: 'tabular-nums' }}>{fmtLAK(Math.abs(k.val))}</div>
            }
          </div>
        ))}
      </div>

      {/* Daily bar chart */}
      <div style={{ padding: 22, borderRadius: 14, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: 'rgba(255,255,255,0.8)' }}>รายรับ vs รายจ่าย — เดือนนี้ (รายวัน)</div>
        {loading ? (
          <div style={{ height: 200, borderRadius: 10, backgroundColor: '#0f0f0f', animation: 'pulse 1.5s infinite' }} />
        ) : daily.every(d => d.income === 0 && d.expense === 0) ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)' }}>ยังไม่มีข้อมูลเดือนนี้</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} width={52}
                tickFormatter={v => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000)+'k' : String(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: `1px solid ${GOLD}44`, borderRadius: 8 }}
                labelStyle={{ color: GOLD }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [fmtLAK(Number(v ?? 0))]}
              />
              <Bar dataKey="income"  name="รายรับ"  fill={GREEN} radius={[3,3,0,0]} />
              <Bar dataKey="expense" name="รายจ่าย" fill={RED}   radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Shift close (collapsible) */}
      <div style={{ borderRadius: 14, border: `1px solid ${GOLD}33`, backgroundColor: CARD, overflow: 'hidden' }}>
        <button onClick={() => setShiftOpen(o => !o)}
          style={{ width: '100%', padding: '14px 22px', backgroundColor: 'transparent', border: 'none', color: GOLD, fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, transform: shiftOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s', display: 'inline-block' }}>▶</span>
          ปิดกะ (Shift Close)
        </button>
        {shiftOpen && (
          <div style={{ padding: '0 22px 22px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                {lbl('กะ')}
                <select value={shiftForm.shift} onChange={e => setShiftForm(f => ({ ...f, shift: e.target.value }))} style={inputStyle}>
                  <option value="morning">เช้า</option>
                  <option value="afternoon">บ่าย</option>
                  <option value="evening">เย็น</option>
                </select>
              </div>
              {(['opening_cash', 'actual_cash'] as const).map(k => (
                <div key={k}>
                  {lbl(k === 'opening_cash' ? 'เงินเปิดกะ (LAK)' : 'เงินที่นับได้ (LAK)')}
                  <MoneyInput value={shiftForm[k]} onChange={v => setShiftForm(f => ({ ...f, [k]: v }))} placeholder="0" style={inputStyle} />
                </div>
              ))}
            </div>
            {shiftForm.opening_cash && shiftForm.actual_cash && (() => {
              const v = parseFloat(shiftForm.actual_cash) - parseFloat(shiftForm.opening_cash)
              const ok = Math.abs(v) <= 5000
              return (
                <div style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, backgroundColor: `${ok ? GREEN : RED}10`, border: `1px solid ${ok ? GREEN : RED}33` }}>
                  <span style={{ fontSize: 13, color: ok ? GREEN : RED, fontWeight: 600 }}>
                    ผลต่าง: {v >= 0 ? '+' : ''}{v.toLocaleString()} LAK
                  </span>
                </div>
              )
            })()}
            {shiftMsg && <div style={{ color: RED, fontSize: 13, marginTop: 8 }}>{shiftMsg}</div>}
            <button onClick={() => void closeShift()} disabled={shiftSaving}
              style={{ marginTop: 12, padding: '10px 26px', borderRadius: 8, border: 'none', backgroundColor: GOLD, color: '#000', fontWeight: 700, cursor: 'pointer', opacity: shiftSaving ? 0.6 : 1 }}>
              {shiftSaving ? 'กำลังบันทึก...' : 'บันทึกปิดกะ'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── EntriesSection ───────────────────────────────────────────────────────────

const DATE_FILTERS = [
  { key: 'today', label: 'วันนี้'  },
  { key: 'week',  label: '7 วัน'  },
  { key: 'month', label: 'เดือนนี้' },
  { key: 'all',   label: 'ทั้งหมด' },
] as const
type DateFilter = (typeof DATE_FILTERS)[number]['key']

function EntriesSection() {
  const [entries,    setEntries]    = useState<CFEntry[]>([])
  const [loading,    setLoading]    = useState(true)
  const [addType,    setAddType]    = useState<'income' | 'expense' | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>('month')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [deleting,   setDeleting]   = useState<string | null>(null)

  function getRange(): { start: string | null; end: string | null } {
    const today = todayISO()
    if (dateFilter === 'today') return { start: today, end: today }
    if (dateFilter === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 6)
      return { start: d.toISOString().slice(0, 10), end: today }
    }
    if (dateFilter === 'month') return { start: monthStart(), end: today }
    return { start: null, end: null }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { start, end } = getRange()
    const { data } = await supabase.rpc('get_cash_flow_entries', {
      p_start:  start,
      p_end:    end,
      p_type:   typeFilter === 'all' ? null : typeFilter,
      p_limit:  50,
      p_offset: 0,
    })
    setEntries((data as CFEntry[] | null) ?? [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, typeFilter])

  useEffect(() => { void load() }, [load])

  async function deleteEntry(id: string) {
    setDeleting(id)
    await supabase.from('cash_flow').delete().eq('id', id)
    setEntries(e => e.filter(r => r.id !== id))
    setDeleting(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {addType && (
        <AddEntryModal type={addType} onClose={() => setAddType(null)} onSave={() => { setAddType(null); void load() }} />
      )}

      {/* Actions + filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <button onClick={() => setAddType('income')}
          style={{ padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: GREEN, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + รายรับ
        </button>
        <button onClick={() => setAddType('expense')}
          style={{ padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: RED, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          − รายจ่าย
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DATE_FILTERS.map(f => (
            <button key={f.key} onClick={() => setDateFilter(f.key)}
              style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${dateFilter === f.key ? GOLD : BORDER}`, backgroundColor: dateFilter === f.key ? `${GOLD}18` : 'transparent', color: dateFilter === f.key ? GOLD : 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>
              {f.label}
            </button>
          ))}
          {(['all', 'income', 'expense'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${typeFilter === t ? GOLD : BORDER}`, backgroundColor: typeFilter === t ? `${GOLD}18` : 'transparent', color: typeFilter === t ? GOLD : 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>
              {t === 'all' ? 'ทั้งหมด' : t === 'income' ? 'รายรับ' : 'รายจ่าย'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ padding: 22, borderRadius: 14, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        {loading ? (
          <div style={{ height: 120, borderRadius: 10, backgroundColor: '#0f0f0f', animation: 'pulse 1.5s infinite' }} />
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)' }}>ยังไม่มีรายการ</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {['วันที่', 'ประเภท', 'หมวด', 'รายละเอียด', 'จำนวน (LAK)', ''].map((h, i) => (
                    <th key={i} style={{ padding: '7px 10px', textAlign: i >= 4 ? 'right' : 'left', fontWeight: 500, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${BORDER}22` }}>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{r.date}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: r.type === 'income' ? GREEN : RED, backgroundColor: r.type === 'income' ? `${GREEN}18` : `${RED}18`, padding: '2px 8px', borderRadius: 99 }}>
                        {r.type === 'income' ? 'รายรับ' : 'รายจ่าย'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.6)' }}>{r.category}</td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.4)', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: r.type === 'income' ? GREEN : RED, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {r.type === 'income' ? '+' : '−'}{fmtLAK(r.amount_lak)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <button onClick={() => void deleteEntry(r.id)} disabled={deleting === r.id}
                        style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${RED}33`, backgroundColor: 'transparent', color: RED, fontSize: 11, cursor: 'pointer', opacity: deleting === r.id ? 0.4 : 0.65 }}>
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── BudgetSection ────────────────────────────────────────────────────────────

function BudgetSection() {
  const [rows,    setRows]    = useState<BudgetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [newCat,  setNewCat]  = useState('')
  const [newAmt,  setNewAmt]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [editId,  setEditId]  = useState<string | null>(null)
  const [editAmt, setEditAmt] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.rpc('get_budget_summary')
    setRows((data as BudgetRow[] | null) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function addBudget() {
    const amt = parseFloat(newAmt)
    if (!newCat.trim() || isNaN(amt) || amt <= 0) return
    setSaving(true)
    await supabase.from('budgets').insert({ category: newCat.trim(), monthly_budget_lak: amt })
    setNewCat(''); setNewAmt(''); setAddOpen(false); setSaving(false)
    void load()
  }

  async function saveEdit(id: string) {
    const amt = parseFloat(editAmt)
    if (isNaN(amt) || amt <= 0) { setEditId(null); return }
    await supabase.from('budgets').update({ monthly_budget_lak: amt }).eq('id', id)
    setEditId(null)
    void load()
  }

  async function deleteBudget(id: string) {
    await supabase.from('budgets').delete().eq('id', id)
    setRows(r => r.filter(b => b.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>งบประมาณรายเดือน — ใช้จ่ายจริงอ้างอิงจาก cash_flow</div>
        <button onClick={() => setAddOpen(o => !o)}
          style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${GOLD}44`, backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + เพิ่มหมวด
        </button>
      </div>

      {addOpen && (
        <div style={{ padding: 18, borderRadius: 12, backgroundColor: CARD, border: `1px solid ${BORDER}`, display: 'grid', gridTemplateColumns: '1fr 160px auto', gap: 10, alignItems: 'end' }}>
          <div>
            {lbl('ชื่อหมวดหมู่')}
            <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="เช่น ค่าไฟ, วัตถุดิบ" style={inputStyle} />
          </div>
          <div>
            {lbl('งบ/เดือน (LAK)')}
            <MoneyInput value={newAmt} onChange={setNewAmt} placeholder="0" style={inputStyle} />
          </div>
          <button onClick={() => void addBudget()} disabled={saving}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', backgroundColor: GOLD, color: '#000', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            บันทึก
          </button>
        </div>
      )}

      <div style={{ padding: 22, borderRadius: 14, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        {loading ? (
          <div style={{ height: 100, borderRadius: 10, backgroundColor: '#0f0f0f', animation: 'pulse 1.5s infinite' }} />
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)' }}>
            ยังไม่มีงบประมาณ — กด &quot;+ เพิ่มหมวด&quot; เพื่อเริ่มต้น
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {rows.map(b => {
              const pct = b.monthly_budget_lak > 0
                ? Math.min(100, Math.round((b.spent_this_month / b.monthly_budget_lak) * 100))
                : 0
              const over = b.spent_this_month > b.monthly_budget_lak
              const barColor = pct >= 100 ? RED : pct >= 80 ? ORANGE : GREEN
              const remaining = b.monthly_budget_lak - b.spent_this_month
              return (
                <div key={b.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{b.category}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {editId === b.id ? (
                        <>
                          <MoneyInput value={editAmt} onChange={setEditAmt} placeholder="0"
                            style={{ ...inputStyle, width: 140, padding: '4px 8px', fontSize: 12 }} />
                          <button onClick={() => void saveEdit(b.id)}
                            style={{ padding: '4px 12px', borderRadius: 6, border: 'none', backgroundColor: GOLD, color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            บันทึก
                          </button>
                          <button onClick={() => setEditId(null)}
                            style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer' }}>
                            ยกเลิก
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtLAK(b.spent_this_month)} / {fmtLAK(b.monthly_budget_lak)}
                          </span>
                          <button onClick={() => { setEditId(b.id); setEditAmt(String(b.monthly_budget_lak)) }}
                            style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer' }}>
                            แก้ไข
                          </button>
                          <button onClick={() => void deleteBudget(b.id)}
                            style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${RED}33`, backgroundColor: 'transparent', color: RED, fontSize: 11, cursor: 'pointer', opacity: 0.65 }}>
                            ลบ
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, backgroundColor: barColor, transition: 'width .4s' }} />
                  </div>
                  <div style={{ fontSize: 10, marginTop: 4, color: over ? RED : 'rgba(255,255,255,0.3)' }}>
                    {pct}% ใช้ไปแล้ว
                    {over
                      ? ` · เกินงบ ${fmtLAK(Math.abs(remaining))}`
                      : ` · เหลือ ${fmtLAK(remaining)}`}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PlanningSection ──────────────────────────────────────────────────────────

function PlanningSection() {
  const [avgPrice,  setAvgPrice]  = useState('25000')
  const [cupsDay,   setCupsDay]   = useState('50')
  const [daysMonth, setDaysMonth] = useState('26')
  const [costPct,   setCostPct]   = useState('35')
  const [bePrice,   setBePrice]   = useState('25000')
  const [beCostCup, setBeCostCup] = useState('8750')
  const [beFixed,   setBeFixed]   = useState('5000000')
  const [mktSpend,  setMktSpend]  = useState('')
  const [mktNewCust,setMktNewCust]= useState('')
  const [mktVisits, setMktVisits] = useState('3')
  const [mktMargin, setMktMargin] = useState('15000')
  const [monthlyNet,setMonthlyNet]= useState<number | null>(null)
  const [cashBal,   setCashBal]   = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.rpc('get_cash_flow_summary', { p_start: monthStart(), p_end: todayISO() }),
      supabase.rpc('get_current_cash_balance'),
    ]).then(([{ data: sum }, { data: bal }]) => {
      setMonthlyNet((sum as CFSummary[] | null)?.[0]?.net ?? 0)
      setCashBal((bal as number | null) ?? 0)
    })
  }, [])

  const scenRevenue = parseFloat(avgPrice || '0') * parseFloat(cupsDay || '0') * parseFloat(daysMonth || '0')
  const scenCost    = scenRevenue * (parseFloat(costPct || '0') / 100)
  const scenProfit  = scenRevenue - scenCost

  const beContrib   = parseFloat(bePrice || '0') - parseFloat(beCostCup || '0')
  const beCups      = beContrib > 0 ? Math.ceil(parseFloat(beFixed || '0') / beContrib) : null
  const beDays      = beCups != null ? Math.ceil(beCups / Math.max(1, parseFloat(cupsDay || '50'))) : null

  const mktSpendN   = parseFloat(mktSpend || '0')
  const mktRevenue  = parseFloat(mktNewCust || '0') * parseFloat(mktVisits || '0') * parseFloat(mktMargin || '0')
  const mktROI      = mktSpendN > 0 ? Math.round(((mktRevenue - mktSpendN) / mktSpendN) * 100) : null

  const forecast = cashBal != null && monthlyNet != null
    ? [1, 2, 3].map(m => ({ month: m, balance: cashBal + monthlyNet * m }))
    : []

  const cardSt: React.CSSProperties = { padding: 22, borderRadius: 14, backgroundColor: CARD, border: `1px solid ${BORDER}` }

  function numInput(val: string, set: (v: string) => void, ph: string, unit?: string) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="number" value={val} onChange={e => set(e.target.value)} placeholder={ph} style={{ ...inputStyle, flex: 1 }} />
        {unit && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{unit}</span>}
      </div>
    )
  }

  function resultRow(label2: string, val: string, color?: string) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${BORDER}33` }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{label2}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: color ?? GOLD, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Scenario calculator */}
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18, color: 'rgba(255,255,255,0.85)' }}>เครื่องคำนวณสถานการณ์ (Scenario)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div>{lbl('ราคาขายเฉลี่ย (LAK)')}{numInput(avgPrice, setAvgPrice, '25000')}</div>
          <div>{lbl('แก้วต่อวัน')}{numInput(cupsDay, setCupsDay, '50', 'แก้ว')}</div>
          <div>{lbl('วันทำงาน/เดือน')}{numInput(daysMonth, setDaysMonth, '26', 'วัน')}</div>
          <div>{lbl('สัดส่วนต้นทุน')}{numInput(costPct, setCostPct, '35', '%')}</div>
        </div>
        {resultRow('รายได้เดือน (ประมาณ)', fmtLAK(scenRevenue))}
        {resultRow('ต้นทุนรวม (ประมาณ)', fmtLAK(scenCost), RED)}
        {resultRow('กำไรสุทธิ (ประมาณ)', fmtLAK(scenProfit), scenProfit >= 0 ? GREEN : RED)}
      </div>

      {/* Break-even */}
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18, color: 'rgba(255,255,255,0.85)' }}>จุดคุ้มทุน (Break-even)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div>{lbl('ราคาขายต่อแก้ว (LAK)')}{numInput(bePrice, setBePrice, '25000')}</div>
          <div>{lbl('ต้นทุนต่อแก้ว (LAK)')}{numInput(beCostCup, setBeCostCup, '8750')}</div>
          <div>{lbl('ต้นทุนคงที่/เดือน (LAK)')}{numInput(beFixed, setBeFixed, '5000000')}</div>
        </div>
        {resultRow('กำไรส่วนเพิ่มต่อแก้ว', beContrib > 0 ? fmtLAK(beContrib) : '—')}
        {resultRow('แก้วที่ต้องขาย/เดือน', beCups != null ? `${beCups.toLocaleString()} แก้ว` : '—', ORANGE)}
        {resultRow('วันที่ถึงจุดคุ้มทุน', beDays != null ? `${beDays} วัน` : '—', ORANGE)}
      </div>

      {/* Marketing ROI */}
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18, color: 'rgba(255,255,255,0.85)' }}>ROI การตลาด</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div>{lbl('งบการตลาด (LAK)')}{numInput(mktSpend, setMktSpend, '500000')}</div>
          <div>{lbl('ลูกค้าใหม่')}{numInput(mktNewCust, setMktNewCust, '20', 'คน')}</div>
          <div>{lbl('ครั้ง/เดือน/คน')}{numInput(mktVisits, setMktVisits, '3', 'ครั้ง')}</div>
          <div>{lbl('กำไรต่อครั้ง (LAK)')}{numInput(mktMargin, setMktMargin, '15000')}</div>
        </div>
        {resultRow('รายได้จากลูกค้าใหม่', fmtLAK(mktRevenue))}
        {resultRow('Marketing ROI', mktROI != null ? `${mktROI}%` : '—', mktROI != null ? (mktROI >= 0 ? GREEN : RED) : undefined)}
      </div>

      {/* 3-month forecast */}
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: 'rgba(255,255,255,0.85)' }}>คาดการณ์เงินสด 3 เดือน</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
          อิงจากกระแสเงินสดสุทธิเดือนปัจจุบัน ({monthlyNet != null ? fmtLAK(monthlyNet) : '...'}/เดือน)
        </div>
        {forecast.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,0.2)' }}>กำลังโหลด...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {forecast.map(f => {
              const neg = f.balance < 0
              return (
                <div key={f.month} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 10, backgroundColor: neg ? `${RED}10` : `${GREEN}08`, border: `1px solid ${neg ? RED : GREEN}22` }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>เดือน +{f.month}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: neg ? RED : GREEN, fontVariantNumeric: 'tabular-nums' }}>{fmtLAK(f.balance)}</span>
                  {neg && <span style={{ fontSize: 10, color: RED, fontWeight: 600 }}>⚠ คาดว่าขาดทุน</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main FinanceTab ──────────────────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: 'ภาพรวมเงินสด'    },
  { key: 'entries',  label: 'บันทึกเงินเข้า-ออก' },
  { key: 'budgets',  label: 'งบประมาณ'         },
  { key: 'planning', label: 'วางแผนธุรกิจ'     },
] as const
type SubTab = (typeof TABS)[number]['key']

export default function FinanceTab() {
  const [hasCapital, setHasCapital] = useState<boolean | null>(null)
  const [subTab,     setSubTab]     = useState<SubTab>('overview')

  const checkCapital = useCallback(async () => {
    const { count } = await supabase.from('initial_capital').select('id', { count: 'exact', head: true })
    setHasCapital((count ?? 0) > 0)
  }, [])

  useEffect(() => { void checkCapital() }, [checkCapital])

  if (hasCapital === null) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>กำลังโหลด...</div>
  }

  if (!hasCapital) {
    return <SetupWizard onDone={() => setHasCapital(true)} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            style={{ padding: '8px 18px', borderRadius: 9, border: `1px solid ${subTab === t.key ? GOLD : BORDER}`, backgroundColor: subTab === t.key ? `${GOLD}18` : 'transparent', color: subTab === t.key ? GOLD : 'rgba(255,255,255,0.45)', fontWeight: subTab === t.key ? 700 : 400, fontSize: 13, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && <OverviewSection />}
      {subTab === 'entries'  && <EntriesSection />}
      {subTab === 'budgets'  && <BudgetSection />}
      {subTab === 'planning' && <PlanningSection />}
    </div>
  )
}
