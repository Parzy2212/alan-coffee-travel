'use client'

import { useCallback, useEffect, useState } from 'react'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import { MoneyInput } from '@/components/MoneyInput'
import {
  GOLD, CARD, BORDER, RED, GREEN, ORANGE,
  CashflowRow,
} from '@/components/cafe/shared'

// ─── Constants & helpers ─────────────────────────────────────────────────────

const BUDGET_CATS = [
  { key: 'cogs',      label: 'ต้นทุนสินค้า (COGS)',     color: ORANGE },
  { key: 'labor',     label: 'ค่าแรงพนักงาน',            color: '#7fa8e8' },
  { key: 'fixed',     label: 'ค่าใช้จ่ายคงที่',          color: '#b07fe8' },
  { key: 'marketing', label: 'การตลาด',                  color: '#e87f9c' },
  { key: 'growth',    label: 'การเติบโต / อื่นๆ',       color: '#7fe8b0' },
] as const
type BudgetKey = (typeof BUDGET_CATS)[number]['key']

function loadBudgets(): Record<BudgetKey, number> {
  try {
    const raw = localStorage.getItem('alan_budgets')
    if (raw) return JSON.parse(raw) as Record<BudgetKey, number>
  } catch { /* ignore */ }
  return { cogs: 0, labor: 0, fixed: 0, marketing: 0, growth: 0 }
}
function saveBudgets(b: Record<BudgetKey, number>) {
  try { localStorage.setItem('alan_budgets', JSON.stringify(b)) } catch { /* ignore */ }
}

// ─── FinanceTab ───────────────────────────────────────────────────────────────

export default function FinanceTab() {
  const [cashflow7,   setCashflow7]   = useState<CashflowRow[]>([])
  const [cashflow30,  setCashflow30]  = useState<CashflowRow[]>([])
  const [purchases,   setPurchases]   = useState<{ created_at: string; unit_price_lak: number; qty_purchased: number }[]>([])
  const [loading,     setLoading]     = useState(false)
  const [form,        setForm]        = useState({ shift: 'morning', opening_cash: '', actual_cash: '' })
  const [saving,      setSaving]      = useState(false)
  const [msg,         setMsg]         = useState('')
  const [budgets,     setBudgets]     = useState<Record<BudgetKey, number>>(loadBudgets)
  const [editBudget,  setEditBudget]  = useState(false)
  const [budgetDraft, setBudgetDraft] = useState<Record<BudgetKey, string>>({ cogs: '', labor: '', fixed: '', marketing: '', growth: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: d7 }, { data: d30 }, { data: dpurch }] = await Promise.all([
      supabase.rpc('get_cashflow_summary', { p_days: 7 }),
      supabase.rpc('get_cashflow_summary', { p_days: 30 }),
      supabase.from('purchase_logs').select('created_at,unit_price_lak,qty_purchased').eq('status', 'approved')
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    ])
    setCashflow7((d7 as CashflowRow[]) ?? [])
    setCashflow30((d30 as CashflowRow[]) ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPurchases((dpurch as any[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function closeShift() {
    const opening = parseFloat(form.opening_cash), actual = parseFloat(form.actual_cash)
    if (isNaN(opening) || isNaN(actual)) { setMsg('กรุณากรอกยอดเงินให้ถูกต้อง'); return }
    setSaving(true); setMsg('')
    const { error } = await supabase.rpc('close_shift', {
      p_staff_id: null, p_shift: form.shift,
      p_opening_cash: opening, p_actual_cash: actual, p_system_sales: 0,
    })
    if (error) { setMsg(error.message) } else {
      setForm(f => ({ ...f, opening_cash: '', actual_cash: '' }))
      await load()
    }
    setSaving(false)
  }

  // ── Computed summary ──
  const today = new Date().toISOString().slice(0, 10)
  const todayRows   = cashflow30.filter(r => r.log_date === today)
  const todaySales  = todayRows.reduce((s, r) => s + r.system_sales, 0)
  const todayCash   = todayRows.reduce((s, r) => s + r.actual_cash, 0)
  const todayVar    = todayRows.reduce((s, r) => s + r.variance_lak, 0)
  const weekSales   = cashflow7.reduce((s, r) => s + r.system_sales, 0)
  const totalCogs   = purchases.reduce((s, p) => s + p.unit_price_lak * p.qty_purchased, 0)
  const grossProfit = weekSales - totalCogs
  const grossPct    = weekSales > 0 ? Math.round((grossProfit / weekSales) * 100) : 0

  // ── Weekly chart: group by date, sum sales+cash ──
  const weekMap: Record<string, { ยอดขาย: number; เงินจริง: number; กำไรขั้นต้น: number }> = {}
  for (const r of cashflow7) {
    if (!weekMap[r.log_date]) weekMap[r.log_date] = { ยอดขาย: 0, เงินจริง: 0, กำไรขั้นต้น: 0 }
    weekMap[r.log_date].ยอดขาย  += r.system_sales
    weekMap[r.log_date].เงินจริง += r.actual_cash
  }
  const chartData = Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, vals]) => ({
    name: date.slice(5),
    ยอดขาย:     vals.ยอดขาย,
    เงินจริง:    vals.เงินจริง,
    กำไรขั้นต้น: Math.max(0, vals.ยอดขาย - totalCogs / 7),
  }))

  // ── Budget actual: cogs from purchase_logs ──
  const budgetActual: Record<BudgetKey, number> = {
    cogs:      totalCogs,
    labor:     0,
    fixed:     0,
    marketing: 0,
    growth:    0,
  }

  function openBudgetEdit() {
    setBudgetDraft(Object.fromEntries(BUDGET_CATS.map(c => [c.key, budgets[c.key] ? String(budgets[c.key]) : ''])) as Record<BudgetKey, string>)
    setEditBudget(true)
  }
  function saveBudgetEdit() {
    const next = Object.fromEntries(BUDGET_CATS.map(c => [c.key, parseFloat(budgetDraft[c.key]) || 0])) as Record<BudgetKey, number>
    setBudgets(next); saveBudgets(next); setEditBudget(false)
  }

  const shiftName = (s: string) => s === 'morning' ? 'เช้า' : s === 'afternoon' ? 'บ่าย' : 'เย็น'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Daily KPI summary ── */}
      <div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 14 }}>
          สรุปวันนี้ · {today}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: 'ยอดขาย', val: todaySales, color: GOLD, fmt: (n: number) => n.toLocaleString() + ' ₭' },
            { label: 'เงินสดจริง', val: todayCash, color: '#fff', fmt: (n: number) => n.toLocaleString() + ' ₭' },
            { label: 'ผลต่างเงินสด', val: todayVar, color: todayVar >= 0 ? GREEN : RED, fmt: (n: number) => (n >= 0 ? '+' : '') + n.toLocaleString() + ' ₭' },
            { label: 'กำไรขั้นต้น (7วัน)', val: grossProfit, color: grossProfit >= 0 ? GREEN : RED, fmt: (n: number) => n.toLocaleString() + ' ₭' },
            { label: 'Gross Margin', val: grossPct, color: GOLD, fmt: (n: number) => n + '%' },
          ].map(item => (
            <div key={item.label} style={{ padding: '16px 18px', borderRadius: 12, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{item.fmt(item.val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Close shift form ── */}
      <div style={{ padding: 22, borderRadius: 14, border: `1px solid ${GOLD}33`, backgroundColor: CARD }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: GOLD, marginBottom: 14 }}>🔒 ปิดกะ</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>กะ</div>
            <select value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: '#0f0f0f', color: '#fff', fontSize: 14 }}>
              <option value="morning">เช้า</option>
              <option value="afternoon">บ่าย</option>
              <option value="evening">เย็น</option>
            </select>
          </div>
          {[['opening_cash', 'เงินเปิดกะ'], ['actual_cash', 'เงินที่นับได้']].map(([key, lbl]) => (
            <div key={key}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>{lbl} (LAK)</div>
              <MoneyInput value={(form as Record<string, string>)[key]} onChange={v => setForm(f => ({ ...f, [key]: v }))}
                placeholder="0" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: '#0f0f0f', color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
        {form.opening_cash && form.actual_cash && (() => {
          const v = parseFloat(form.actual_cash) - parseFloat(form.opening_cash)
          return (
            <div style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, backgroundColor: `${Math.abs(v) <= 5000 ? GREEN : RED}10`, border: `1px solid ${Math.abs(v) <= 5000 ? GREEN : RED}33` }}>
              <span style={{ fontSize: 13, color: Math.abs(v) <= 5000 ? GREEN : RED, fontWeight: 600 }}>
                ผลต่าง: {v >= 0 ? '+' : ''}{v.toLocaleString()} LAK
              </span>
            </div>
          )
        })()}
        {msg && <div style={{ color: RED, fontSize: 13, marginTop: 8 }}>{msg}</div>}
        <button onClick={() => void closeShift()} disabled={saving}
          style={{ marginTop: 12, padding: '10px 26px', borderRadius: 8, border: 'none', backgroundColor: GOLD, color: '#000', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'กำลังบันทึก...' : 'บันทึกปิดกะ'}
        </button>
      </div>

      {/* ── Weekly chart ── */}
      <div style={{ padding: 22, borderRadius: 14, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'rgba(255,255,255,0.8)' }}>
          แนวโน้ม 7 วัน
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 400, marginLeft: 10 }}>ยอดขาย / เงินจริง / กำไรขั้นต้น (ประมาณ)</span>
        </div>
        {loading ? (
          <div style={{ height: 200, borderRadius: 10, backgroundColor: '#0f0f0f', animation: 'pulse 1.5s infinite' }} />
        ) : chartData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)' }}>ยังไม่มีข้อมูล</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: `1px solid ${GOLD}44`, borderRadius: 8 }} labelStyle={{ color: GOLD }} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }} />
              <Line type="monotone" dataKey="ยอดขาย"     stroke={GOLD}  strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="เงินจริง"    stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="กำไรขั้นต้น" stroke="#7fa8e8" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Budget section ── */}
      <div style={{ padding: 22, borderRadius: 14, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>งบประมาณรายสัปดาห์</div>
          <button onClick={openBudgetEdit} style={{ padding: '5px 14px', borderRadius: 7, border: `1px solid ${GOLD}44`, backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>ตั้งงบ</button>
        </div>

        {editBudget ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {BUDGET_CATS.map(c => (
              <div key={c.key} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: c.color }}>{c.label}</div>
                <MoneyInput value={budgetDraft[c.key]} onChange={v => setBudgetDraft(d => ({ ...d, [c.key]: v }))}
                  placeholder="0 LAK" style={{ padding: '8px 10px', borderRadius: 7, border: `1px solid ${BORDER}`, backgroundColor: '#0f0f0f', color: '#fff', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={saveBudgetEdit} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', backgroundColor: GOLD, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>บันทึก</button>
              <button onClick={() => setEditBudget(false)} style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}>ยกเลิก</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {BUDGET_CATS.map(c => {
              const budget = budgets[c.key]
              const actual = budgetActual[c.key]
              const pct = budget > 0 ? Math.min(100, Math.round((actual / budget) * 100)) : 0
              return (
                <div key={c.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: c.color }}>{c.label}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                      {actual.toLocaleString()} / {budget > 0 ? budget.toLocaleString() : '—'} LAK
                    </span>
                  </div>
                  <div style={{ height: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    {budget > 0 && (
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, backgroundColor: pct >= 90 ? RED : pct >= 70 ? ORANGE : c.color, transition: 'width .4s' }} />
                    )}
                  </div>
                  {budget > 0 && <div style={{ fontSize: 10, color: pct >= 90 ? RED : 'rgba(255,255,255,0.3)', marginTop: 3 }}>{pct}% ใช้ไปแล้ว</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── P&L Statement (30 days) ── */}
      {(() => {
        const rev30      = cashflow30.reduce((s, r) => s + r.system_sales, 0)
        const cogs30     = totalCogs
        const grossP     = rev30 - cogs30
        const grossM     = rev30 > 0 ? Math.round((grossP / rev30) * 100) : 0
        const laborCost  = budgets.labor
        const fixedCost  = budgets.fixed
        const netProfit  = grossP - laborCost - fixedCost
        const netMargin  = rev30 > 0 ? Math.round((netProfit / rev30) * 100) : 0

        const rows: { label: string; value: number; indent?: boolean; highlight?: boolean; separator?: boolean; dimLabel?: string }[] = [
          { label: 'รายได้รวม (Revenue)',            value: rev30,     highlight: false },
          { label: 'ต้นทุนขาย (COGS)',               value: -cogs30,   indent: true, dimLabel: 'จากการซื้อวัตถุดิบ 30 วัน' },
          { label: 'กำไรขั้นต้น (Gross Profit)',     value: grossP,    highlight: true },
          { label: `  Gross Margin`,                  value: grossM,    highlight: false, dimLabel: '%', separator: false },
          { label: 'ค่าแรงพนักงาน (Labor)',           value: -laborCost, indent: true, dimLabel: 'จากงบประมาณ' },
          { label: 'ต้นทุนคงที่ (Fixed)',             value: -fixedCost, indent: true, dimLabel: 'จากงบประมาณ' },
          { label: 'กำไรสุทธิ (Net Profit est.)',    value: netProfit, highlight: true },
          { label: `  Net Margin`,                    value: netMargin, highlight: false, dimLabel: '%' },
        ]

        return (
          <div style={{ padding: 22, borderRadius: 14, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>งบกำไรขาดทุน (P&L) — 30 วัน</div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>ESTIMATED</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {rows.map((row, i) => {
                  const isMargin = row.dimLabel === '%'
                  const displayVal = isMargin
                    ? `${row.value}%`
                    : (row.value < 0 ? `(${Math.abs(row.value).toLocaleString()})` : row.value.toLocaleString()) + ' ₭'
                  const valueColor = isMargin
                    ? (row.value >= 50 ? GREEN : row.value >= 30 ? GOLD : ORANGE)
                    : row.highlight
                      ? (row.value >= 0 ? GREEN : RED)
                      : row.value < 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.8)'
                  return (
                    <tr key={i} style={{
                      borderTop: row.highlight ? `1px solid ${BORDER}` : 'none',
                      borderBottom: row.highlight ? `1px solid ${BORDER}` : 'none',
                      backgroundColor: row.highlight ? `${GOLD}06` : 'transparent',
                    }}>
                      <td style={{ padding: row.highlight ? '10px 12px' : '7px 12px', color: row.indent ? 'rgba(255,255,255,0.45)' : row.highlight ? GOLD : 'rgba(255,255,255,0.75)', paddingLeft: row.indent ? 28 : 12, fontWeight: row.highlight ? 700 : 400 }}>
                        {row.label}
                        {row.dimLabel && row.dimLabel !== '%' && (
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginLeft: 8 }}>{row.dimLabel}</span>
                        )}
                      </td>
                      <td style={{ padding: row.highlight ? '10px 12px' : '7px 12px', textAlign: 'right', color: valueColor, fontWeight: row.highlight ? 800 : 500, fontVariantNumeric: 'tabular-nums' }}>
                        {displayVal}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* ── 30-day cashflow table ── */}
      <div style={{ padding: 22, borderRadius: 14, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>ประวัติ Cashflow 30 วัน</div>
        {loading ? (
          <div style={{ height: 120, borderRadius: 10, backgroundColor: '#0f0f0f', animation: 'pulse 1.5s infinite' }} />
        ) : cashflow30.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)' }}>ยังไม่มีข้อมูล</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
              <thead>
                <tr style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {['วันที่', 'กะ', 'ยอดขาย (LAK)', 'เงินจริง (LAK)', 'ผลต่าง (LAK)'].map((h, i) => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: i < 2 ? 'left' : 'right', fontWeight: 500, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cashflow30.map((r, i) => {
                  const bigVar = Math.abs(r.variance_lak) > 10000
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${BORDER}22`, backgroundColor: bigVar ? `${RED}08` : 'transparent' }}>
                      <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.7)' }}>{r.log_date}</td>
                      <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.45)' }}>{shiftName(r.shift)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{r.system_sales.toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.actual_cash.toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: r.variance_lak >= 0 ? GREEN : RED, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {bigVar && <span style={{ fontSize: 10, marginRight: 4 }}>⚠</span>}
                        {r.variance_lak >= 0 ? '+' : ''}{r.variance_lak.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td colSpan={2} style={{ padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>รวม</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: GOLD, fontWeight: 700 }}>{cashflow30.reduce((s, r) => s + r.system_sales, 0).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{cashflow30.reduce((s, r) => s + r.actual_cash, 0).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: cashflow30.reduce((s, r) => s + r.variance_lak, 0) >= 0 ? GREEN : RED }}>
                    {(() => { const t = cashflow30.reduce((s, r) => s + r.variance_lak, 0); return (t >= 0 ? '+' : '') + t.toLocaleString() })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
