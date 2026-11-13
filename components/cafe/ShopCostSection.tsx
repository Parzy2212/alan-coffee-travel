'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { authClient } from '@/lib/supabase-auth'
import { MoneyInput } from '@/components/MoneyInput'
import { GOLD, CARD, CARD2, BORDER, RED, GREEN, ORANGE, inputStyle, btnStyleSm } from '@/components/cafe/shared'

// Shop cost inputs (site_settings keys) used by RecipeCostTab to add packaging, ice and overhead to each cup.
export const COST_DEFAULTS = {
  cost_cup_lid: '2500', cost_straw: '210', cost_bag: '500', cost_bag_pct: '30',
  cost_other_pkg: '0', cost_waste_pct: '15',
  cost_ice_bag_price: '20000', cost_ice_melt_pct: '30', cost_ice_per_cup_g: '175',
  overhead_rent: '0', overhead_electric: '0', overhead_water: '0',
  overhead_salary: '0', overhead_internet: '0',
  overhead_consumables_json: '', overhead_other_json: '',
  target_cups_month: '500',
}
export type CostSettings = typeof COST_DEFAULTS
export const COST_KEYS = Object.keys(COST_DEFAULTS) as (keyof CostSettings)[]

// ─── Expense item type + defaults ────────────────────────────────────────────

type ExpenseItem = { id: string; name: string; amount: number }

const DEFAULT_CONSUMABLES: ExpenseItem[] = [
  { id: 'c1', name: 'น้ำยาถูพื้น',          amount: 50000 },
  { id: 'c2', name: 'น้ำยาล้างจาน (ซันไลต์)', amount: 30000 },
  { id: 'c3', name: 'ผ้าสก๊อตไบรท์',        amount: 20000 },
  { id: 'c4', name: 'น้ำยาเช็ดกระจก',        amount: 15000 },
  { id: 'c5', name: 'ถุงขยะ',                amount: 10000 },
  { id: 'c6', name: 'กระดาษทิชชู่',          amount: 20000 },
]

function parseItems(json: string, defaults: ExpenseItem[]): ExpenseItem[] {
  if (!json) return defaults
  try {
    const p = JSON.parse(json)
    if (Array.isArray(p)) {
      // Empty array or all-empty names → fall back to defaults (handles un-initialized DB state)
      if (p.length === 0 || p.every((i: ExpenseItem) => !i.name)) return defaults
      return p
    }
  } catch {}
  return defaults
}

// ─── ItemizedList (module-scope so React never remounts it on parent re-render) ─

function ItemizedList({ items, onUpdate, emptyHint }: { items: ExpenseItem[]; onUpdate: (items: ExpenseItem[]) => void; emptyHint?: string }) {
  function updateItem(id: string, patch: Partial<ExpenseItem>) {
    onUpdate(items.map(i => i.id === id ? { ...i, ...patch } : i))
  }
  function removeItem(id: string) { onUpdate(items.filter(i => i.id !== id)) }
  function addItem() { onUpdate([...items, { id: Date.now().toString(), name: '', amount: 0 }]) }
  const total = items.reduce((s, i) => s + i.amount, 0)
  return (
    <div>
      {items.length === 0 && emptyHint && (
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', marginBottom: 8 }}>{emptyHint}</div>
      )}
      {items.map(item => (
        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 28px', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <input
            value={item.name}
            onChange={e => updateItem(item.id, { name: e.target.value })}
            style={{ ...inputStyle, fontSize: 13 }}
            placeholder="ชื่อรายการ..."
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <MoneyInput
              value={item.amount || ''}
              onChange={raw => updateItem(item.id, { amount: parseInt(raw) || 0 })}
              style={{ ...inputStyle, textAlign: 'right' as const, fontSize: 13 }}
              placeholder="0"
            />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>₭</span>
          </div>
          <button onClick={() => removeItem(item.id)}
            style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, justifySelf: 'center' }}>
            ✕
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <button onClick={addItem} style={{ ...btnStyleSm(GOLD + '22', GOLD) }}>+ เพิ่มรายการ</button>
        {total > 0 && (
          <span style={{ fontSize: 13, color: GOLD, fontWeight: 600 }}>
            รวม {total.toLocaleString()} ₭/เดือน
          </span>
        )}
      </div>
    </div>
  )
}

// ─── CostManagementSection ────────────────────────────────────────────────────

type SalaryBreakdownItem = { name: string; monthly: number; note: string }

export function ShopCostSection({ settings, onChange }: { settings: CostSettings; onChange: (s: CostSettings) => void }) {
  const [loadingSalary,    setLoadingSalary]    = useState(false)
  const [salaryBreakdown,  setSalaryBreakdown]  = useState<SalaryBreakdownItem[]>([])
  const set = (k: keyof CostSettings) =>
    (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...settings, [k]: e.target.value })
  const n = (k: keyof CostSettings, def = 0) => parseFloat(settings[k] as string) || def

  // ── Parse itemized lists ─────────────────────────────────────────────────
  const consumables = parseItems(settings.overhead_consumables_json, DEFAULT_CONSUMABLES)
  const otherItems  = parseItems(settings.overhead_other_json, [])

  const setConsumables = (items: ExpenseItem[]) =>
    onChange({ ...settings, overhead_consumables_json: JSON.stringify(items) })
  const setOtherItems = (items: ExpenseItem[]) =>
    onChange({ ...settings, overhead_other_json: JSON.stringify(items) })

  // ── Derived calculations ─────────────────────────────────────────────────
  const bagContrib    = n('cost_bag') * (n('cost_bag_pct') / 100)
  const basePackaging = n('cost_cup_lid') + n('cost_straw') + bagContrib + n('cost_other_pkg')
  const packagingPerCup = Math.round(basePackaging * (1 + n('cost_waste_pct') / 100))

  const usableKg    = 30 * (1 - n('cost_ice_melt_pct') / 100)
  const costPerGram = usableKg > 0 ? n('cost_ice_bag_price') / (usableKg * 1000) : 0
  const icePerCup   = Math.round(costPerGram * n('cost_ice_per_cup_g'))

  const totalFixed       = n('overhead_rent') + n('overhead_electric') + n('overhead_water') +
    n('overhead_salary') + n('overhead_internet')
  const totalConsumables = consumables.reduce((s, i) => s + i.amount, 0)
  const totalOther       = otherItems.reduce((s, i) => s + i.amount, 0)
  const totalOverhead    = totalFixed + totalConsumables + totalOther
  const targetCups       = Math.max(n('target_cups_month', 500) || 500, 1)
  const overheadPerCup   = Math.round(totalOverhead / targetCups)
  const fixedPerCup      = packagingPerCup + overheadPerCup
  const breakEvenPerDay  = Math.ceil(targetCups / 30)

  async function loadSalaries() {
    setLoadingSalary(true)
    const { data } = await authClient.rpc('get_all_staff')
    if (data) {
      type StaffRow = { name?: string; name_th?: string | null; salary?: number | null; salary_type?: string | null; hours_per_day?: number | null; is_active?: boolean }
      const active = (data as StaffRow[]).filter(st => st.is_active !== false)
      const breakdown: SalaryBreakdownItem[] = active.map(st => {
        const amount = st.salary ?? 0
        const displayName = st.name || st.name_th || '?'
        if (st.salary_type === 'daily')  return { name: displayName, monthly: amount * 26, note: `${amount.toLocaleString()}×26วัน` }
        if (st.salary_type === 'hourly') {
          const hrs = st.hours_per_day ?? 8
          return { name: displayName, monthly: amount * hrs * 26, note: `${amount.toLocaleString()}₭/ชม×${hrs}ชม×26วัน` }
        }
        return { name: displayName, monthly: amount, note: 'รายเดือน' }
      })
      const total = breakdown.reduce((s, b) => s + b.monthly, 0)
      setSalaryBreakdown(breakdown)
      onChange({ ...settings, overhead_salary: String(total) })
    }
    setLoadingSalary(false)
  }

  const cardS: React.CSSProperties  = { backgroundColor: CARD2, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}`, marginBottom: 12 }

  function exportCostCSV() {
    const rows: string[][] = []
    const h = (label: string) => rows.push([label])
    const r = (label: string, val: string | number) => rows.push([label, String(val)])
    const sep = () => rows.push([''])

    h('=== 1. ต้นทุนบรรจุภัณฑ์ต่อแก้ว ===')
    r('แก้ว + ฝา (₭)', n('cost_cup_lid'))
    r('หลอด (₭)', n('cost_straw'))
    r('ถุงกลับบ้าน ₭/ถุง', n('cost_bag'))
    r('% ลูกค้าที่ขอถุง', n('cost_bag_pct') + '%')
    r('บรรจุภัณฑ์อื่นๆ (₭)', n('cost_other_pkg'))
    r('Waste & Loss Factor', n('cost_waste_pct') + '%')
    r('ต้นทุน packaging จริงต่อแก้ว (₭)', packagingPerCup)
    sep()

    h('=== 2. ต้นทุนน้ำแข็งต่อแก้วเย็น ===')
    r('ราคาน้ำแข็งต่อกระสอบ 30kg (₭)', n('cost_ice_bag_price'))
    r('น้ำแข็งที่ละลายก่อนใช้', n('cost_ice_melt_pct') + '%')
    r('น้ำแข็งต่อแก้ว (g)', n('cost_ice_per_cup_g'))
    r('ต้นทุนน้ำแข็งต่อแก้วเย็น (₭)', icePerCup)
    sep()

    h('=== 3. ค่าใช้จ่ายประจำเดือน ===')
    r('ค่าเช่า (₭)', n('overhead_rent'))
    r('ค่าไฟ (₭)', n('overhead_electric'))
    r('ค่าน้ำ (₭)', n('overhead_water'))
    r('เงินเดือนรวม (₭)', n('overhead_salary'))
    r('อินเตอร์เน็ต (₭)', n('overhead_internet'))
    consumables.forEach(i => r(`  ${i.name} (₭)`, i.amount))
    r('รวมของใช้สิ้นเปลือง (₭)', totalConsumables)
    otherItems.forEach(i => r(`  ${i.name} (₭)`, i.amount))
    r('รวมค่าใช้จ่ายอื่นๆ (₭)', totalOther)
    r('รวมค่าใช้จ่ายทั้งหมด/เดือน (₭)', totalOverhead)
    sep()

    h('=== 4. ต้นทุนต่อแก้ว (ทุกหมวด) ===')
    r('เป้าหมายแก้ว/เดือน', targetCups)
    r('ต้นทุน packaging ต่อแก้ว (₭)', packagingPerCup)
    r('ต้นทุนน้ำแข็งต่อแก้วเย็น (₭)', icePerCup)
    r('ต้นทุน overhead ต่อแก้ว (₭)', overheadPerCup)
    r('ต้นทุนรวมต่อแก้ว excl. น้ำแข็ง (₭)', fixedPerCup)
    sep()

    h('=== 5. Break-even Analysis ===')
    r('เป้าหมายแก้ว/เดือน', targetCups)
    r('แก้วที่ต้องขาย/วัน (เพื่อ cover overhead)', breakEvenPerDay)

    const csvContent = '\uFEFF' + rows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `alan-cafe-cost-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }
  const labelS: React.CSSProperties = { fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }
  const dimS: React.CSSProperties   = { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4, lineHeight: 1.5 }
  const calcRow: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px', backgroundColor: `${GOLD}10`, borderRadius: 8,
    border: `1px solid ${GOLD}22`, marginTop: 12,
  }

  function SliderField({ label, fieldKey, min, max, unit, hint }: { label: string; fieldKey: keyof CostSettings; min: number; max: number; unit: string; hint?: string }) {
    const val = n(fieldKey)
    const sliderColor = val <= max * 0.4 ? GREEN : val <= max * 0.7 ? ORANGE : RED
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: sliderColor }}>{val}{unit}</span>
        </div>
        <input type="range" min={min} max={max} value={val}
          onChange={e => onChange({ ...settings, [fieldKey]: e.target.value })}
          style={{ width: '100%', accentColor: sliderColor, cursor: 'pointer' }} />
        {hint && <div style={dimS}>{hint}</div>}
      </div>
    )
  }
  function MoneyRow({ label, fieldKey, placeholder }: { label: string; fieldKey: keyof CostSettings; placeholder?: string }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MoneyInput value={settings[fieldKey] as string}
            onChange={raw => onChange({ ...settings, [fieldKey]: raw })}
            style={{ ...inputStyle, flex: 1 }} placeholder={placeholder ?? '0'} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>₭</span>
        </div>
      </div>
    )
  }

  return (
    <div>

      {/* ── Export CSV button ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={exportCostCSV}
          style={{ ...btnStyleSm(GOLD + '22', GOLD), display: 'flex', alignItems: 'center', gap: 6 }}>
          ⬇ Export CSV
        </button>
      </div>

      {/* ── Section 1: Packaging ── */}
      <div style={cardS}>
        <div style={labelS}>1. บรรจุภัณฑ์ต่อแก้ว</div>
        <MoneyRow label="แก้ว + ฝา" fieldKey="cost_cup_lid" placeholder="2500" />
        <MoneyRow label="หลอด" fieldKey="cost_straw" placeholder="210" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>ถุงกลับบ้าน</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MoneyInput value={settings.cost_bag}
              onChange={raw => onChange({ ...settings, cost_bag: raw })}
              style={{ ...inputStyle, flex: 1 }} placeholder="500" />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>₭/ถุง</span>
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>% ลูกค้าที่ขอถุง</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>{n('cost_bag_pct')}%</span>
          </div>
          <input type="range" min={0} max={100} value={n('cost_bag_pct')}
            onChange={e => onChange({ ...settings, cost_bag_pct: e.target.value })}
            style={{ width: '100%', accentColor: GOLD, cursor: 'pointer' }} />
        </div>
        <MoneyRow label="บรรจุภัณฑ์อื่นๆ" fieldKey="cost_other_pkg" placeholder="0" />
        <SliderField label="Waste & Loss Factor" fieldKey="cost_waste_pct" min={0} max={30} unit="%"
          hint="ครอบคลุมของหล่น ลูกค้าหยิบหลอดเพิ่ม ผิดพลาด" />
        <div style={calcRow}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>ต้นทุน packaging จริงต่อแก้ว</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>{packagingPerCup.toLocaleString()} ₭</span>
        </div>
        <div style={dimS}>= (แก้ว+ฝา+หลอด+ถุง×{n('cost_bag_pct')}%) × (1 + {n('cost_waste_pct')}%)</div>
      </div>

      {/* ── Section 2: Ice ── */}
      <div style={cardS}>
        <div style={labelS}>2. ต้นทุนน้ำแข็ง</div>
        <MoneyRow label="ราคาน้ำแข็งต่อกระสอบ (30 kg)" fieldKey="cost_ice_bag_price" placeholder="20000" />
        <SliderField label="น้ำแข็งที่ละลายก่อนใช้" fieldKey="cost_ice_melt_pct" min={0} max={50} unit="%" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>น้ำแข็งต่อแก้วเย็น (g)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="number" min="0" value={settings.cost_ice_per_cup_g} onChange={set('cost_ice_per_cup_g')}
              style={{ ...inputStyle, flex: 1 }} placeholder="175" />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>g</span>
          </div>
        </div>
        <div style={calcRow}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>ต้นทุนน้ำแข็งต่อแก้วเย็น</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#4a9eff' }}>{icePerCup.toLocaleString()} ₭</span>
        </div>
        <div style={dimS}>= {n('cost_ice_per_cup_g')}g × (ราคา/30kg ÷ {Math.round(usableKg*1000).toLocaleString()}g usable)</div>
      </div>

      {/* ── Section 3: Monthly Overhead (Itemized) ── */}
      <div style={cardS}>
        <div style={labelS}>3. ค่าใช้จ่ายประจำเดือน</div>

        {/* Fixed expenses */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>
          ค่าใช้จ่ายคงที่
        </div>
        {([
          { icon: '🏠', label: 'ค่าเช่า',          key: 'overhead_rent'      },
          { icon: '⚡', label: 'ค่าไฟ',             key: 'overhead_electric'  },
          { icon: '💧', label: 'ค่าน้ำ',            key: 'overhead_water'     },
          { icon: '🌐', label: 'อินเทอร์เน็ต',      key: 'overhead_internet'  },
        ] as { icon: string; label: string; key: keyof CostSettings }[]).map(row => (
          <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{row.icon} {row.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MoneyInput value={settings[row.key] as string}
                onChange={raw => onChange({ ...settings, [row.key]: raw })}
                style={{ ...inputStyle, flex: 1 }} placeholder="0" />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>₭</span>
            </div>
          </div>
        ))}
        {/* Salary auto-fill */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>👥 เงินเดือนรวม</span>
            <button type="button" onClick={loadSalaries} disabled={loadingSalary}
              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, border: `1px solid ${GOLD}44`, backgroundColor: 'transparent', color: GOLD, cursor: 'pointer', opacity: loadingSalary ? 0.5 : 1 }}>
              {loadingSalary ? '...' : '↓ ดึงอัตโนมัติ'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MoneyInput value={settings.overhead_salary}
              onChange={raw => onChange({ ...settings, overhead_salary: raw })}
              style={{ ...inputStyle, flex: 1 }} placeholder="0" />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>₭</span>
          </div>
        </div>

        {/* Salary breakdown */}
        {salaryBreakdown.length > 0 && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14, lineHeight: 1.8, paddingLeft: 4 }}>
            <span style={{ color: GOLD, fontWeight: 600 }}>{salaryBreakdown.length} คน: </span>
            {salaryBreakdown.map((b, i) => (
              <span key={i}>
                {i > 0 && <span style={{ color: 'rgba(255,255,255,0.2)' }}> + </span>}
                <span style={{ color: b.monthly === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)' }}>
                  {b.name} <span style={{ color: b.monthly === 0 ? 'rgba(255,255,255,0.2)' : GOLD }}>{b.monthly.toLocaleString()}₭</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}> ({b.note})</span>
                </span>
              </span>
            ))}
            <span style={{ color: 'rgba(255,255,255,0.25)' }}> = รวม </span>
            <span style={{ color: GOLD, fontWeight: 700 }}>
              {salaryBreakdown.reduce((s, b) => s + b.monthly, 0).toLocaleString()} ₭
            </span>
          </div>
        )}

        <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 14 }} />

        {/* Consumables */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>
          วัสดุสิ้นเปลือง (ค่าใช้จ่ายผันแปร)
        </div>
        <ItemizedList items={consumables} onUpdate={setConsumables} emptyHint="กด + เพิ่มรายการ เพื่อเพิ่มวัสดุสิ้นเปลือง" />

        <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', margin: '16px 0' }} />

        {/* Other expenses */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>
          ค่าใช้จ่ายอื่นๆ
        </div>
        <ItemizedList items={otherItems} onUpdate={setOtherItems} emptyHint="เช่น ค่าการตลาด, ซ่อมบำรุง, ฯลฯ" />

        {/* Summary box */}
        <div style={{ marginTop: 16, backgroundColor: CARD, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
          {[
            { label: 'ค่าใช้จ่ายคงที่',      value: totalFixed       },
            { label: 'วัสดุสิ้นเปลือง',       value: totalConsumables },
            { label: 'อื่นๆ',                  value: totalOther       },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{row.label}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{row.value.toLocaleString()} ₭</span>
            </div>
          ))}
          <div style={{ height: 1, backgroundColor: `${GOLD}33`, margin: '10px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: GOLD, fontWeight: 700 }}>รวมทั้งหมด</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: GOLD }}>{totalOverhead.toLocaleString()} ₭/เดือน</span>
          </div>
        </div>
      </div>

      {/* ── Section 4: Per-Cup Summary ── */}
      <div style={{ ...cardS, border: `1px solid ${GOLD}44` }}>
        <div style={labelS}>4. ต้นทุนต่อแก้ว (สรุป)</div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>เป้าหมายจำนวนแก้ว/เดือน</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: GOLD }}>{n('target_cups_month').toLocaleString()} แก้ว</span>
          </div>
          <input type="range" min={100} max={3000} step={50} value={n('target_cups_month', 500)}
            onChange={e => onChange({ ...settings, target_cups_month: e.target.value })}
            style={{ width: '100%', accentColor: GOLD, cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
            <span>100</span><span>3,000 แก้ว</span>
          </div>
        </div>
        {overheadPerCup > 20000 && (
          <div style={{ marginBottom: 12, padding: '8px 12px', backgroundColor: RED + '12', borderRadius: 8, border: `1px solid ${RED}22`, fontSize: 12, color: RED }}>
            ⚠️ Overhead ต่อแก้ว = {overheadPerCup.toLocaleString()} ₭ สูงผิดปกติ — เพิ่มจำนวนเป้าหมายแก้ว/เดือน หรือลดค่าใช้จ่ายรายเดือน
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          {[
            { label: 'Overhead ต่อแก้ว', value: overheadPerCup, color: '#ff9f43' },
            { label: 'Packaging ต่อแก้ว', value: packagingPerCup, color: GOLD },
          ].map(item => (
            <div key={item.label} style={{ backgroundColor: CARD, borderRadius: 10, padding: '12px 14px', border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value.toLocaleString()} ₭</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px', backgroundColor: `${GOLD}12`, borderRadius: 12, border: `1px solid ${GOLD}33` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>ต้นทุน fixed ต่อแก้ว</span>
            <span style={{ fontSize: 26, fontWeight: 900, color: GOLD }}>{fixedPerCup.toLocaleString()} ₭</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>packaging {packagingPerCup.toLocaleString()} + overhead {overheadPerCup.toLocaleString()} ₭</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>+ ต้นทุนวัตถุดิบ (คำนวณในแท็บ สร้างสูตร)</div>
          {totalOverhead > 0 && (
            <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: `${GOLD}18`, borderRadius: 8, fontSize: 13, color: GOLD, fontWeight: 600 }}>
              💡 ต้องขายอย่างน้อย {breakEvenPerDay} แก้ว/วัน เพื่อคุ้มทุน overhead
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ShopCostPanel: loads, edits and saves only the cost keys (owner-only RPC, signed-in session) ─

export function ShopCostPanel({ onSaved }: { onSaved: () => void }) {
  const [settings,  setSettings]  = useState<CostSettings>({ ...COST_DEFAULTS })
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // On a failed load the form would hold defaults, and saving would overwrite the real costs with them.
  function load() {
    setLoading(true); setLoadError(false)
    supabase.rpc('get_site_settings').then(({ data, error }) => {
      if (error || !data || typeof data !== 'object') {
        setLoadError(true)
      } else {
        const d = data as Record<string, unknown>
        const loaded = Object.fromEntries(
          COST_KEYS.filter(k => d[k] !== null && d[k] !== undefined).map(k => [k, String(d[k])])
        )
        setSettings({ ...COST_DEFAULTS, ...loaded })
      }
      setLoading(false)
    }, () => { setLoadError(true); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true); setSaved(false); setSaveError(null)
    try {
      const results = await Promise.all(
        COST_KEYS.map(k => authClient.rpc('update_site_setting', { p_key: k, p_value: settings[k] }))
      )
      const failed = COST_KEYS.filter((_, i) => results[i].error)
      if (failed.length) {
        setSaveError(`บันทึกไม่สำเร็จ ${failed.length} รายการ (${results.find(r => r.error)?.error?.message ?? ''})`)
        return
      }
      const { logAccountEvent } = await import('@/lib/account-events')
      await logAccountEvent('shop_settings_updated' as never, 'Shop costs updated').catch(() => {})
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onSaved()
    } catch {
      setSaveError('บันทึกไม่สำเร็จ — เชื่อมต่อไม่ได้')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '20px 0' }}>กำลังโหลด...</div>

  if (loadError) return (
    <div role="alert" style={{ padding: '20px 16px', backgroundColor: CARD, border: `1px solid ${RED}33`, borderRadius: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: '1 1 120px', color: RED, fontSize: 14, fontWeight: 600 }}>โหลดต้นทุนร้านไม่สำเร็จ</div>
      <button onClick={load} style={btnStyleSm(GOLD + '22', GOLD)}>ลองใหม่</button>
    </div>
  )

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>ต้นทุนร้าน</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 3, lineHeight: 1.6 }}>
          ค่าบรรจุภัณฑ์ น้ำแข็ง และค่าใช้จ่ายรายเดือน จะถูกบวกเข้าต้นทุนต่อแก้วของทุกเมนู —
          เมนูที่บันทึกสูตรไว้แล้วจะใช้ตัวเลขใหม่เมื่อกดบันทึกสูตรนั้นอีกครั้ง
        </div>
      </div>
      <ShopCostSection settings={settings} onChange={setSettings} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 16, marginBottom: 24 }}>
        <button onClick={save} disabled={saving} style={{
          padding: '12px 32px', borderRadius: 8, border: 'none', cursor: saving ? 'default' : 'pointer',
          backgroundColor: GOLD, color: '#0a0a0a', fontSize: 14, fontWeight: 700, opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'กำลังบันทึก...' : 'บันทึกต้นทุนร้าน'}
        </button>
        {saved && <div style={{ color: GREEN, fontSize: 13, fontWeight: 600 }}>✓ บันทึกแล้ว</div>}
        {saveError && <div role="alert" style={{ color: RED, fontSize: 13, fontWeight: 600 }}>{saveError}</div>}
      </div>
    </div>
  )
}
