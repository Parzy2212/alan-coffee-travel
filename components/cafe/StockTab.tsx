'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { authClient, dbErrorText, isNetworkError } from '@/lib/supabase-auth'
import { MoneyInput } from '@/components/MoneyInput'
import {
  GOLD, CARD, CARD2, BORDER, RED, GREEN, ORANGE,
  StockDetail, InventoryForm, ReceiveForm, UsageStat,
  inputStyle, btnStyle, btnStyleSm,
  Badge, Toast, LoadingSpinner, Field,
  fmtLAK,
  STORAGE_OPTIONS, emptyInventoryForm, storageIcon,
} from '@/components/cafe/shared'

// ─── InventoryFormFields ──────────────────────────────────────────────────────

function InventoryFormFields({ data, onChange }: {
  data: InventoryForm; onChange: (d: InventoryForm) => void
}) {
  const set = (k: keyof InventoryForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [k]: e.target.value })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Field label="ชื่อ EN *"><input value={data.name} onChange={set('name')} style={inputStyle} placeholder="Fresh Milk" /></Field>
        <Field label="ชื่อ TH"><input value={data.name_th} onChange={set('name_th')} style={inputStyle} placeholder="นมสด" /></Field>
        <Field label="ชื่อ LO"><input value={data.name_lo} onChange={set('name_lo')} style={inputStyle} placeholder="ນົມສົດ" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 120px 120px 1fr', gap: 10 }}>
        <Field label="หน่วย"><input value={data.unit} onChange={set('unit')} style={inputStyle} placeholder="ml" /></Field>
        <Field label="Reorder Point"><input value={data.reorder_point} onChange={set('reorder_point')} type="number" min="0" style={inputStyle} placeholder="ขั้นต่ำ" /></Field>
        <Field label="ความจุสูงสุด"><input value={data.max_quantity} onChange={set('max_quantity')} type="number" min="0" style={inputStyle} placeholder="Max" /></Field>
        {/* not MoneyInput: average costs have decimals (25.8333 ₭/g) and MoneyInput keeps digits only */}
        <Field label="ต้นทุน/หน่วย ₭"><input value={data.cost_per_unit} onChange={set('cost_per_unit')} type="number" min="0" step="any" inputMode="decimal" style={inputStyle} placeholder="ยังไม่ทราบ" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 100px', gap: 10 }}>
        <Field label="ที่เก็บ">
          <select value={data.storage_location} onChange={set('storage_location')} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">— ไม่ระบุ —</option>
            {STORAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="อายุหลังเปิด (วัน)"><input value={data.expiry_days} onChange={set('expiry_days')} type="number" min="0" style={inputStyle} placeholder="3" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
        <Field label="ซัพพลายเออร์หลัก"><input value={data.supplier} onChange={set('supplier')} style={inputStyle} /></Field>
        <Field label="เบอร์โทร"><input value={data.supplier_phone} onChange={set('supplier_phone')} style={inputStyle} placeholder="020-xxx-xxx" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
        <Field label="ซัพพลายเออร์สำรอง"><input value={data.secondary_supplier} onChange={set('secondary_supplier')} style={inputStyle} /></Field>
        <Field label="เบอร์โทรสำรอง"><input value={data.secondary_supplier_phone} onChange={set('secondary_supplier_phone')} style={inputStyle} placeholder="020-xxx-xxx" /></Field>
      </div>
      <Field label="หมายเหตุ">
        <textarea value={data.notes} onChange={set('notes')} style={{ ...inputStyle, height: 52, resize: 'vertical' as const }} placeholder="รายละเอียดเพิ่มเติม..." />
      </Field>
    </div>
  )
}

// ─── stock helpers ────────────────────────────────────────────────────────────

type Movement = {
  id: string; kind: 'sale' | 'void_return' | 'receive' | 'waste' | 'count' | 'opening'
  qty_delta: number; qty_after: number; unit_cost: number | null; reason: string | null; created_at: string
}

const MOVEMENT_LABEL: Record<Movement['kind'], string> = {
  sale: 'ขาย', void_return: 'คืนจากยกเลิกบิล', receive: 'รับของ', waste: 'ของเสีย', count: 'นับสต็อก', opening: 'ยอดตั้งต้น',
}

const PAID_FROM: { id: 'drawer' | 'owner' | 'transfer'; label: string }[] = [
  { id: 'drawer', label: 'เงินในลิ้นชัก' }, { id: 'owner', label: 'เงินเจ้าของ' }, { id: 'transfer', label: 'โอน' },
]

const emptyReceive = (supplier: string | null): ReceiveForm =>
  ({ qty: '', cost: '', free: false, paidFrom: '', supplier: supplier ?? '', note: '' })

// the error codes raised by stock_receive / stock_waste / stock_count_submit (migration 073)
function stockErrorText(error: { code?: string; message: string }): string {
  const m = error.message
  if (m.startsWith('PRICE_REQUIRED')) return 'ใส่ราคาที่จ่ายทั้งหมด หรือติ๊ก "ได้มาฟรี"'
  if (m.startsWith('PAID_FROM_REQUIRED')) return 'เลือกว่าจ่ายด้วยเงินอะไร'
  if (m.startsWith('NO_OPEN_SESSION')) return 'ลิ้นชักยังไม่เปิด: เปิดลิ้นชักที่หน้าขายก่อน หรือเลือก "เงินเจ้าของ"'
  if (m.startsWith('QTY_INVALID')) return 'จำนวนต้องมากกว่า 0'
  if (m.startsWith('REASON_REQUIRED')) return 'ต้องใส่เหตุผล'
  if (m.startsWith('COUNT_EMPTY')) return 'ยังไม่ได้ใส่ยอดที่นับ'
  if (m.startsWith('COUNT_DUPLICATE')) return 'มีรายการซ้ำในการนับ'
  if (m.startsWith('COUNT_INVALID')) return 'ยอดที่นับต้องเป็น 0 ขึ้นไป'
  if (m.startsWith('COST_REQUIRED')) return 'ยอดตั้งต้นต้องใส่ต้นทุนต่อหน่วยทุกรายการ'
  if (m.startsWith('ingredient not found')) return 'ไม่พบวัตถุดิบนี้ (อาจถูกลบไปแล้ว) กดโหลดใหม่'
  if (error.code === '22003') return 'ตัวเลขใหญ่เกินไป (ราคารวมต่อครั้งต้องไม่ถึง 100 ล้านกีบ) ตรวจจำนวนและราคาอีกครั้ง'
  return dbErrorText(error)
}

const fmtQty  = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 3 })
const fmtCost = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 })
const fmtWhen = (iso: string) => new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane' })

// ─── StockItemRow ─────────────────────────────────────────────────────────────

function itemToForm(item: StockDetail): InventoryForm {
  return {
    name: item.name, name_th: item.name_th ?? '', name_lo: item.name_lo ?? '', unit: item.unit,
    reorder_point: String(item.reorder_point ?? ''),
    max_quantity: String(item.max_quantity ?? ''), cost_per_unit: String(item.cost_per_unit ?? ''),
    storage_location: item.storage_location ?? 'shelf', expiry_days: String(item.expiry_days ?? ''),
    supplier: item.supplier ?? '', supplier_phone: item.supplier_phone ?? '',
    secondary_supplier: item.secondary_supplier ?? '', secondary_supplier_phone: item.secondary_supplier_phone ?? '',
    notes: item.notes ?? '',
  }
}

function StockItemRow({ item, onReload, showMsg, onDelete }: {
  item: StockDetail; onReload: () => void; showMsg: (m: string) => void; onDelete: (item: StockDetail) => void
}) {
  const [panel,       setPanel]       = useState<'detail' | 'add' | 'waste' | 'edit' | null>(null)
  const [addForm,     setAddForm]     = useState<ReceiveForm>(emptyReceive(item.supplier))
  const [priceOk,     setPriceOk]     = useState(false)
  // one id per opened form: pressing again after a dropped connection must not receive twice
  // (closing the form or reloading the page starts a new id, so the screen text says so)
  const [requestId,   setRequestId]   = useState(() => crypto.randomUUID())
  const [wasteQty,    setWasteQty]    = useState('')
  const [wasteReason, setWasteReason] = useState('')
  const [formErr,     setFormErr]     = useState<string | null>(null)
  const [editData,    setEditData]    = useState<InventoryForm>(() => itemToForm(item))
  const [history,     setHistory]     = useState<Movement[] | null>(null)
  const [usage,       setUsage]       = useState<UsageStat[] | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailErr,   setDetailErr]   = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)

  const isNeg    = item.current_qty < 0
  const isEmpty  = item.current_qty === 0
  const isLow    = !isEmpty && !isNeg && item.reorder_point != null && item.current_qty <= item.reorder_point
  const isExpiring = item.expiry_days_remaining != null && item.expiry_days_remaining >= 0 && item.expiry_days_remaining <= 3
  const pct      = item.max_quantity ? Math.min((item.current_qty / item.max_quantity) * 100, 100) : null
  const barColor = pct == null ? GOLD : pct > 50 ? GREEN : pct > 25 ? ORANGE : RED
  const daysColor = item.days_until_empty != null && item.days_until_empty < 3 ? RED
    : item.days_until_empty != null && item.days_until_empty < 7 ? ORANGE : 'rgba(255,255,255,0.5)'

  function openPanel(p: 'detail' | 'add' | 'waste' | 'edit') {
    const next = panel === p ? null : p
    setPanel(next)
    setFormErr(null)
    if (next === 'detail') void loadDetail()
    // the row stays mounted across reloads: the form must start from today's figures, or saving
    // would put back an old cost (e.g. the one from before a receive or the opening count)
    if (next === 'edit') setEditData(itemToForm(item))
  }

  async function loadDetail() {
    setDetailLoading(true); setDetailErr(null)
    const [hRes, uRes] = await Promise.all([
      authClient.from('stock_movements').select('id, kind, qty_delta, qty_after, unit_cost, reason, created_at')
        .eq('inventory_id', item.id).order('created_at', { ascending: false }).limit(15),
      authClient.rpc('stock_daily_usage', { p_inventory_id: item.id, p_days: 14 }),
    ])
    const err = hRes.error ?? uRes.error
    if (err) setDetailErr(dbErrorText(err))
    setHistory((hRes.data as Movement[]) ?? [])
    setUsage((uRes.data as UsageStat[]) ?? [])
    setDetailLoading(false)
  }

  const recvQty   = parseFloat(addForm.qty)
  const recvTotal = addForm.free ? 0 : parseFloat(addForm.cost)
  const recvUnit  = recvQty > 0 && recvTotal >= 0 ? recvTotal / recvQty : null
  const costAfter = recvUnit == null ? null
    : item.current_qty <= 0 || item.cost_per_unit == null ? recvUnit
    : (item.current_qty * item.cost_per_unit + recvTotal) / (item.current_qty + recvQty)
  // a slipped digit (30,000,000 for 30,000) would wreck the average cost, so a price far from
  // today's cost needs a second press
  const priceJump = !addForm.free && recvUnit != null && recvUnit > 0 && item.cost_per_unit != null && item.cost_per_unit > 0
    && (recvUnit > item.cost_per_unit * 3 || recvUnit < item.cost_per_unit / 3)

  function setRecv(patch: Partial<ReceiveForm>) {
    setAddForm(f => ({ ...f, ...patch })); setPriceOk(false); setFormErr(null)
  }

  async function submitAdd() {
    if (saving) return
    if (!(recvQty > 0)) { setFormErr('ใส่จำนวนที่รับเข้า'); return }
    if (!addForm.free && !(recvTotal > 0)) { setFormErr('ใส่ราคาที่จ่ายทั้งหมด หรือติ๊ก "ได้มาฟรี"'); return }
    if (!addForm.free && !addForm.paidFrom) { setFormErr('เลือกว่าจ่ายด้วยเงินอะไร'); return }
    if (priceJump && !priceOk) { setPriceOk(true); return }
    setSaving(true); setFormErr(null)
    const { data, error } = await authClient.rpc('stock_receive', {
      p_inventory_id: item.id, p_qty: recvQty, p_total_cost_lak: addForm.free ? null : recvTotal,
      p_free: addForm.free, p_paid_from: addForm.free ? null : addForm.paidFrom,
      p_supplier: addForm.supplier.trim() || null, p_note: addForm.note.trim() || null,
      p_request_id: requestId,
    })
    setSaving(false)
    if (error) {
      setFormErr(isNetworkError(error)
        ? 'เชื่อมต่อไม่ได้ อาจบันทึกไปแล้ว — กด "บันทึกรับของ" ซ้ำได้ ระบบจะไม่รับซ้ำ ถ้าไม่ปิดฟอร์มนี้ (ถ้าปิดหรือโหลดหน้าใหม่แล้ว ให้ดูประวัติก่อนรับใหม่)'
        : stockErrorText(error))
      return
    }
    setRequestId(crypto.randomUUID())
    // a retry after a lost answer keeps the first save, even if the numbers were changed in between
    if ((data as { duplicate?: boolean } | null)?.duplicate) { showMsg('รายการนี้บันทึกไว้แล้วตั้งแต่ครั้งก่อน (ไม่ได้รับซ้ำ) — ระบบเก็บตามที่บันทึกครั้งแรก ดูยอดที่ "ประวัติ"'); setPanel(null); onReload(); return }
    showMsg(`รับ ${item.name_th || item.name} +${fmtQty(recvQty)} ${item.unit}` + (addForm.paidFrom === 'drawer' && !addForm.free ? ' (ลงจ่ายออกจากลิ้นชักแล้ว)' : ''))
    setPanel(null); onReload()
  }

  async function submitWaste() {
    if (saving) return
    const qty = parseFloat(wasteQty)
    if (!(qty > 0)) { setFormErr('ใส่จำนวนที่ทิ้ง'); return }
    if (!wasteReason.trim()) { setFormErr('ต้องใส่เหตุผล'); return }
    setSaving(true); setFormErr(null)
    const { error } = await authClient.rpc('stock_waste', { p_inventory_id: item.id, p_qty: qty, p_reason: wasteReason.trim() })
    setSaving(false)
    // a waste has no request id: pressing again after a lost answer would take it off twice
    if (error) { setFormErr(isNetworkError(error) ? 'เชื่อมต่อไม่ได้ อาจบันทึกไปแล้ว — โหลดหน้าใหม่ ดูยอดหรือ "ประวัติ" ก่อนบันทึกซ้ำ' : stockErrorText(error)); return }
    showMsg(`ตัดของเสีย ${item.name_th || item.name} -${fmtQty(qty)} ${item.unit}`)
    setPanel(null); onReload()
  }

  async function saveEdit() {
    if (!editData.name.trim()) { showMsg('กรุณาระบุชื่อ'); return }
    const reorder = parseFloat(editData.reorder_point)
    const maxQty  = parseFloat(editData.max_quantity)
    if (!isNaN(reorder) && !isNaN(maxQty) && maxQty > 0 && reorder > maxQty) {
      showMsg('Reorder Point ต้องไม่เกินค่า Max Quantity'); return
    }
    const cost = editData.cost_per_unit.trim()
    if (cost !== '' && !(Number(cost) >= 0)) { showMsg('ต้นทุนต่อหน่วยต้องเป็น 0 ขึ้นไป'); return }
    setSaving(true)
    const { error } = await authClient.rpc('update_inventory_item', {
      p_id:                       item.id,
      p_name:                     editData.name,
      p_name_th:                  editData.name_th,
      p_name_lo:                  editData.name_lo,
      p_unit:                     editData.unit,
      p_reorder_point:            parseFloat(editData.reorder_point)  || null,
      p_max_quantity:             parseFloat(editData.max_quantity)   || null,
      // 0 is a real cost (free goods); an empty box leaves the cost as it is
      p_cost_per_unit:            cost === '' ? null : Number(cost),
      p_storage_location:         editData.storage_location || null,
      p_expiry_days:              parseInt(editData.expiry_days)      || null,
      p_supplier:                 editData.supplier,
      p_supplier_phone:           editData.supplier_phone,
      p_secondary_supplier:       editData.secondary_supplier,
      p_secondary_supplier_phone: editData.secondary_supplier_phone,
      p_notes:                    editData.notes,
    })
    if (!error) { showMsg('บันทึกสำเร็จ'); setPanel(null); onReload() }
    else showMsg('บันทึกไม่ได้: ' + dbErrorText(error))
    setSaving(false)
  }

  const borderColor = isEmpty || isNeg ? RED + '44' : isLow ? ORANGE + '33' : isExpiring ? ORANGE + '44' : BORDER
  const usageMax = usage ? Math.max(...usage.map(u => u.used_qty), 0.001) : 0.001

  return (
    <div style={{ marginBottom: 6 }}>
      {/* ── Main row ── */}
      <div style={{
        backgroundColor: isEmpty || isNeg ? RED + '10' : isLow ? ORANGE + '0a' : CARD,
        border: `1px solid ${borderColor}`,
        borderRadius: panel ? '10px 10px 0 0' : 10, padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 20 }}>{storageIcon(item.storage_location)}</span>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: isEmpty || isNeg ? RED : isLow ? ORANGE : GREEN, boxShadow: `0 0 5px ${isEmpty || isNeg ? RED : isLow ? ORANGE : GREEN}88` }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{item.name}</span>
              {isNeg      && <Badge label="ติดลบ (ขายเกินที่นับไว้)" bg={RED + '18'} color={RED} />}
              {isEmpty    && <Badge label="หมดแล้ว"  bg={RED    + '18'} color={RED} />}
              {isLow      && <Badge label="ใกล้หมด"  bg={ORANGE + '18'} color={ORANGE} />}
              {isExpiring && <Badge label={`หมดอายุใน ${item.expiry_days_remaining} วัน`} bg={ORANGE + '18'} color={ORANGE} />}
            </div>
            {(item.name_th || item.name_lo) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                {item.name_th && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{item.name_th}</span>}
                {item.name_lo && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{item.name_lo}</span>}
              </div>
            )}

            {pct !== null && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: barColor, borderRadius: 3, transition: 'width .4s' }} />
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{Math.round(pct)}%</span>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div>
              <span style={{ fontSize: 20, fontWeight: 800, color: isEmpty || isNeg ? RED : isLow ? ORANGE : '#fff' }}>{fmtQty(item.current_qty)}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginLeft: 3 }}>{item.unit}</span>
            </div>
            {item.max_quantity && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>max {item.max_quantity}</div>
            )}
            {item.reorder_point != null && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>min {item.reorder_point}</div>
            )}
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
            {item.days_until_empty != null && (
              <div style={{ fontSize: 12, fontWeight: 700, color: daysColor }}>
                {item.days_until_empty === 0 ? 'หมดแล้ว' : `หมดใน ${item.days_until_empty} วัน`}
              </div>
            )}
            <div style={{ fontSize: 10, color: item.cost_per_unit == null ? ORANGE : 'rgba(255,255,255,0.25)', marginTop: 3 }}>
              {item.cost_per_unit == null ? 'ยังไม่มีต้นทุน' : `₭${fmtCost(item.cost_per_unit)}/${item.unit}`}
            </div>
            {item.stock_value > 0 && (
              <div style={{ fontSize: 11, color: GOLD, marginTop: 2 }}>{fmtLAK(item.stock_value)}</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
            <button onClick={() => { openPanel('add'); setAddForm(emptyReceive(item.supplier)); setPriceOk(false); setRequestId(crypto.randomUUID()) }} style={btnStyleSm(panel === 'add' ? GOLD + '33' : GOLD + '22', GOLD)}>+ รับของ</button>
            <button onClick={() => { openPanel('waste'); setWasteQty(''); setWasteReason('') }} style={btnStyleSm(panel === 'waste' ? ORANGE + '33' : ORANGE + '14', ORANGE)}>ตัดของเสีย</button>
            <button onClick={() => openPanel('detail')} style={btnStyleSm('rgba(255,255,255,0.07)', 'rgba(255,255,255,0.55)')}>ประวัติ</button>
            <button onClick={() => openPanel('edit')} style={btnStyleSm('rgba(255,255,255,0.05)', 'rgba(255,255,255,0.4)')}>แก้ไข</button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(item) }}
              style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(255,77,77,0.3)', cursor: 'pointer', backgroundColor: 'rgba(255,77,77,0.08)', color: '#ff4d4d', fontSize: 11 }}
            >
              ลบ
            </button>
          </div>
        </div>

        {item.supplier && (
          <div style={{ marginTop: 8, display: 'flex', gap: 16, paddingLeft: 36, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{item.supplier}</span>
            {item.supplier_phone && (
              <a href={`tel:${item.supplier_phone}`} style={{ fontSize: 11, color: GOLD, textDecoration: 'none' }}>
                {item.supplier_phone}
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Add Stock panel ── */}
      {panel === 'add' && (
        <div style={{ backgroundColor: '#0f0f0f', border: `1px solid ${GOLD}33`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 16 }}>
          <div style={{ fontSize: 12, color: GOLD, marginBottom: 12, letterSpacing: '1px' }}>+ รับของเข้า — {item.name_th || item.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
            <Field label={`จำนวนที่รับ (${item.unit})`}><input autoFocus value={addForm.qty} onChange={e => setRecv({ qty: e.target.value })} type="number" min="0" inputMode="decimal" style={inputStyle} /></Field>
            <Field label="ราคาที่จ่ายทั้งหมด ₭">
              <MoneyInput value={addForm.free ? '' : addForm.cost} onChange={v => setRecv({ cost: v })} style={{ ...inputStyle, opacity: addForm.free ? 0.35 : 1 }} placeholder={addForm.free ? 'ได้มาฟรี' : '0'} disabled={addForm.free} />
            </Field>
            <Field label="ซัพพลายเออร์"><input value={addForm.supplier} onChange={e => setRecv({ supplier: e.target.value })} style={inputStyle} /></Field>
            <Field label="หมายเหตุ"><input value={addForm.note} onChange={e => setRecv({ note: e.target.value })} style={inputStyle} placeholder="ไม่บังคับ" /></Field>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={addForm.free} onChange={e => setRecv({ free: e.target.checked })} />
            ได้มาฟรี (ไม่ได้จ่ายเงิน)
          </label>
          {!addForm.free && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>จ่ายด้วย (ต้องเลือก)</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PAID_FROM.map(o => (
                  <button key={o.id} type="button" onClick={() => setRecv({ paidFrom: o.id })}
                    style={btnStyleSm(addForm.paidFrom === o.id ? GOLD + '33' : 'rgba(255,255,255,0.06)', addForm.paidFrom === o.id ? GOLD : 'rgba(255,255,255,0.6)')}>
                    {addForm.paidFrom === o.id ? '● ' : ''}{o.label}
                  </button>
                ))}
              </div>
              {addForm.paidFrom === 'drawer' && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>ระบบจะลงจ่ายออกจากลิ้นชักที่เปิดอยู่ให้เอง ไม่ต้องลงซ้ำที่หน้าขาย</div>
              )}
            </div>
          )}
          {recvUnit != null && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>
              ราคาต่อหน่วย ₭{fmtCost(recvUnit)} / {item.unit}
              {costAfter != null && <> · ต้นทุนเฉลี่ยหลังรับ ₭{fmtCost(costAfter)} (เดิม {item.cost_per_unit == null ? 'ยังไม่มี' : '₭' + fmtCost(item.cost_per_unit)})</>}
            </div>
          )}
          {priceJump && (
            <div style={{ fontSize: 12, color: ORANGE, marginBottom: 10, padding: '8px 12px', borderRadius: 8, backgroundColor: ORANGE + '12', border: `1px solid ${ORANGE}44` }}>
              ราคาต่อหน่วยต่างจากต้นทุนเดิมเกิน 3 เท่า — ตรวจจำนวนและราคาอีกครั้ง (พิมพ์ศูนย์เกินหรือหน่วยผิดหรือเปล่า)
            </div>
          )}
          {formErr && <div style={{ fontSize: 13, color: RED, marginBottom: 10 }}>{formErr}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => void submitAdd()} disabled={saving} style={btnStyle(priceJump && priceOk ? ORANGE : GOLD)}>
              {saving ? 'กำลังบันทึก...' : priceJump && priceOk ? 'ยืนยัน ราคานี้ถูกต้อง' : 'บันทึกรับของ'}
            </button>
            <button onClick={() => setPanel(null)} style={btnStyle('rgba(255,255,255,0.08)')}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* ── Waste panel ── */}
      {panel === 'waste' && (
        <div style={{ backgroundColor: '#0f0f0f', border: `1px solid ${ORANGE}33`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 16 }}>
          <div style={{ fontSize: 12, color: ORANGE, marginBottom: 12, letterSpacing: '1px' }}>ตัดของเสีย — {item.name_th || item.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
            <Field label={`จำนวนที่ทิ้ง (${item.unit})`}><input autoFocus value={wasteQty} onChange={e => { setWasteQty(e.target.value); setFormErr(null) }} type="number" min="0" inputMode="decimal" style={inputStyle} /></Field>
            <Field label="เหตุผล (ต้องใส่)"><input value={wasteReason} onChange={e => { setWasteReason(e.target.value); setFormErr(null) }} style={inputStyle} placeholder="เช่น บูด, หก, หมดอายุ" /></Field>
          </div>
          {formErr && <div style={{ fontSize: 13, color: RED, marginBottom: 10 }}>{formErr}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => void submitWaste()} disabled={saving} style={btnStyle(ORANGE)}>{saving ? 'กำลังบันทึก...' : 'บันทึกของเสีย'}</button>
            <button onClick={() => setPanel(null)} style={btnStyle('rgba(255,255,255,0.08)')}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* ── Detail panel ── */}
      {panel === 'detail' && (
        <div style={{ backgroundColor: '#0d0d0d', border: `1px solid ${BORDER}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 16 }}>
          {detailLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${GOLD}33`, borderTopColor: GOLD, animation: 'spin .7s linear infinite' }} />
            </div>
          ) : (
            <>
              {item.secondary_supplier && (
                <div style={{ marginBottom: 14, padding: '10px 12px', backgroundColor: CARD2, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>ซัพพลายเออร์สำรอง</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#fff' }}>{item.secondary_supplier}</span>
                    {item.secondary_supplier_phone && (
                      <a href={`tel:${item.secondary_supplier_phone}`} style={{ fontSize: 12, color: GOLD, textDecoration: 'none' }}>{item.secondary_supplier_phone}</a>
                    )}
                  </div>
                </div>
              )}

              {item.notes && (
                <div style={{ marginBottom: 14, padding: '8px 12px', backgroundColor: CARD2, borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 3 }}>หมายเหตุ</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{item.notes}</div>
                </div>
              )}

              {item.daily_usage > 0 && (
                <div style={{ marginBottom: 14, display: 'flex', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px' }}>ใช้เฉลี่ย/วัน</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 2 }}>{item.daily_usage.toFixed(2)} <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{item.unit}</span></div>
                  </div>
                  {item.last_price && (
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px' }}>ราคาซื้อล่าสุด</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: GOLD, marginTop: 2 }}>{fmtLAK(item.last_price)}<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>/{item.unit}</span></div>
                    </div>
                  )}
                </div>
              )}

              {usage && usage.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>ใช้ 14 วัน ({item.unit})</div>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 48 }}>
                    {usage.map((u, i) => {
                      const h = Math.round((u.used_qty / usageMax) * 48)
                      const d = new Date(u.day + 'T00:00:00')
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`${u.day}: ${u.used_qty.toFixed(2)} ${item.unit}`}>
                          <div style={{ width: '100%', height: Math.max(h, 2), backgroundColor: u.used_qty > 0 ? GOLD : 'rgba(255,255,255,0.05)', borderRadius: '2px 2px 0 0' }} />
                          {i % 3 === 0 && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>{d.getDate()}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>ความเคลื่อนไหว (15 ล่าสุด)</div>
                {detailErr ? (
                  <div style={{ fontSize: 12, color: RED }}>โหลดประวัติไม่ได้: {detailErr} <button onClick={() => void loadDetail()} style={btnStyleSm('rgba(255,255,255,0.07)', GOLD)}>ลองใหม่</button></div>
                ) : !history || history.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>ยังไม่มีประวัติ (เริ่มบันทึกตั้งแต่อัปเดตนี้)</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {history.map(m => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 12px', backgroundColor: CARD, borderRadius: 6 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 13, color: m.qty_delta < 0 ? ORANGE : m.qty_delta > 0 ? GREEN : '#fff', fontWeight: 600 }}>
                            {m.qty_delta > 0 ? '+' : ''}{fmtQty(m.qty_delta)} {item.unit}
                          </span>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginLeft: 8 }}>{MOVEMENT_LABEL[m.kind]}</span>
                          {m.reason && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 8 }}>{m.reason}</span>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>เหลือ {fmtQty(m.qty_after)}{m.kind === 'receive' && m.unit_cost != null ? ` · ₭${fmtCost(m.unit_cost)}/${item.unit}` : ''}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>{fmtWhen(m.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Edit panel ── */}
      {panel === 'edit' && (
        <div style={{ backgroundColor: '#0d0d0d', border: `1px solid ${GOLD}33`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 16 }}>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 14 }}>แก้ไข: {item.name}</div>
          <InventoryFormFields data={editData} onChange={setEditData} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={saveEdit} disabled={saving} style={btnStyle(GOLD)}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            <button onClick={() => setPanel(null)} style={btnStyle('rgba(255,255,255,0.08)')}>ยกเลิก</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ConfirmDeleteModal ───────────────────────────────────────────────────────

function ConfirmDeleteModal({ item, recipeCount, onConfirm, onCancel, deleting }: { item: StockDetail; recipeCount: number; onConfirm: () => void; onCancel: () => void; deleting: boolean }) {
  const hasStock     = item.current_qty > 0
  const usedInRecipe = recipeCount !== 0
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ backgroundColor: '#161616', borderRadius: 16, border: `1px solid ${usedInRecipe ? 'rgba(255,77,77,0.35)' : hasStock ? 'rgba(255,153,51,0.35)' : 'rgba(201,168,76,0.15)'}`, padding: 28, maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{usedInRecipe ? '🚫' : hasStock ? '⚠️' : '🗑️'}</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          ลบ {item.name_th || item.name} ออกจากสต็อก?
        </div>

        {usedInRecipe && (
          <div style={{ margin: '0 0 16px', padding: '12px 16px', backgroundColor: 'rgba(255,77,77,0.1)', borderRadius: 10, border: '1px solid rgba(255,77,77,0.3)' }}>
            <div style={{ fontSize: 13, color: '#ff4d4d', fontWeight: 700 }}>{recipeCount < 0 ? 'ตรวจไม่ได้ว่าใช้ในสูตรไหนบ้าง' : `ใช้อยู่ใน ${recipeCount} สูตรเมนู`}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,77,77,0.7)', marginTop: 4 }}>ต้องลบออกจากสูตรก่อนจึงจะลบได้</div>
          </div>
        )}

        {!usedInRecipe && hasStock && (
          <div style={{ margin: '0 0 16px', padding: '12px 16px', backgroundColor: 'rgba(255,153,51,0.1)', borderRadius: 10, border: '1px solid rgba(255,153,51,0.3)' }}>
            <div style={{ fontSize: 13, color: '#ff9933', fontWeight: 700 }}>สต็อกยังเหลืออยู่ {item.current_qty} {item.unit}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,153,51,0.7)', marginTop: 4 }}>ควรใช้จนหมดก่อนลบ</div>
          </div>
        )}

        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>
          การดำเนินการนี้ไม่สามารถย้อนกลับได้
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={deleting} style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)', background: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14 }}>
            ยกเลิก
          </button>
          <button onClick={onConfirm} disabled={deleting || usedInRecipe} style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', backgroundColor: usedInRecipe ? 'rgba(255,77,77,0.3)' : '#ff4d4d', color: '#fff', fontWeight: 700, fontSize: 14, cursor: (deleting || usedInRecipe) ? 'not-allowed' : 'pointer', opacity: (deleting || usedInRecipe) ? 0.5 : 1 }}>
            {deleting ? 'กำลังลบ...' : usedInRecipe ? 'ลบไม่ได้' : hasStock ? 'ยืนยัน ลบทิ้ง' : 'ยืนยัน ลบ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CountPanel ───────────────────────────────────────────────────────────────

// every active item must be counted, so nothing is forgotten; the opening count (before the
// first real bill) also sets each item's cost per unit
function CountPanel({ items, opening, onDone, onClose }: {
  items: StockDetail[]; opening: boolean; onDone: (m: string) => void; onClose: () => void
}) {
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [costs,   setCosts]   = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map(i => [i.id, i.cost_per_unit == null ? '' : String(i.cost_per_unit)])))
  const [note,    setNote]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)

  const missing = items.filter(i => (counted[i.id] ?? '').trim() === '' || (opening && (costs[i.id] ?? '').trim() === ''))

  async function submit() {
    if (saving) return
    if (missing.length > 0) { setErr(`ยังไม่ได้ใส่ ${missing.length} รายการ: ${missing.slice(0, 3).map(i => i.name_th || i.name).join(', ')}${missing.length > 3 ? ' …' : ''}`); return }
    const rows = items.map(i => ({
      inventory_id: i.id, counted_qty: Number(counted[i.id]),
      unit_cost: opening ? Number(costs[i.id]) : undefined,
    }))
    if (rows.some(r => !(r.counted_qty >= 0) || (opening && !(Number(r.unit_cost) >= 0)))) {
      setErr('ตัวเลขต้องเป็น 0 ขึ้นไป'); return
    }
    setSaving(true); setErr(null)
    const { data, error } = await authClient.rpc('stock_count_submit', { p_counts: rows, p_is_opening: opening, p_note: note.trim() || null })
    setSaving(false)
    if (error) { setErr(opening && error.code === '42501' ? 'ยอดตั้งต้นทำได้เฉพาะบัญชีเจ้าของร้าน (ผู้จัดการใช้ “นับสต็อก” ได้)' : stockErrorText(error)); return }
    const r = data as { items: number; changed: number; value_change: number }
    onDone(`บันทึก${opening ? 'ยอดตั้งต้น' : 'การนับ'} ${r.items} รายการ · ต่างจากระบบ ${r.changed} รายการ (มูลค่า ${r.value_change >= 0 ? '+' : ''}${fmtLAK(r.value_change)})`)
  }

  return (
    <div style={{ marginBottom: 20, padding: 20, backgroundColor: '#0d0d0d', border: `1px solid ${GOLD}33`, borderRadius: 12 }}>
      <div style={{ fontSize: 13, color: GOLD, letterSpacing: '1px', marginBottom: 6 }}>{opening ? 'นับยอดตั้งต้นวันเปิดร้าน' : 'นับสต็อก'}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 14 }}>
        {opening
          ? 'นับของที่มีจริงทุกรายการ พร้อมต้นทุนต่อหน่วย (ราคาที่ซื้อมา ÷ จำนวน) ทำก่อนขายบิลแรก — ยอดในระบบจะเปลี่ยนเป็นตามนี้'
          : 'นับของที่มีจริงทุกรายการ ยอดในระบบจะเปลี่ยนเป็นตามที่นับ ควรนับตอนร้านปิด (ของที่ขายระหว่างนับจะไม่ถูกนับ)'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {items.map(i => (
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', backgroundColor: CARD, borderRadius: 8 }}>
            <div style={{ flex: '1 1 160px', minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{i.name_th || i.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>ในระบบ {fmtQty(i.current_qty)} {i.unit}</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
              นับได้
              <input value={counted[i.id] ?? ''} onChange={e => { setCounted(c => ({ ...c, [i.id]: e.target.value })); setErr(null) }}
                type="number" min="0" inputMode="decimal" style={{ ...inputStyle, width: 110 }} aria-label={`นับได้ ${i.name}`} />
              {i.unit}
            </label>
            {opening && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                ต้นทุน ₭/{i.unit}
                <input value={costs[i.id] ?? ''} onChange={e => { setCosts(c => ({ ...c, [i.id]: e.target.value })); setErr(null) }}
                  type="number" min="0" inputMode="decimal" style={{ ...inputStyle, width: 110 }} aria-label={`ต้นทุน ${i.name}`} />
              </label>
            )}
          </div>
        ))}
      </div>
      <Field label="หมายเหตุ (ไม่บังคับ)"><input value={note} onChange={e => setNote(e.target.value)} style={inputStyle} /></Field>
      {err && <div style={{ fontSize: 13, color: RED, marginTop: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => void submit()} disabled={saving} style={btnStyle(GOLD)}>{saving ? 'กำลังบันทึก...' : opening ? 'บันทึกยอดตั้งต้น' : 'บันทึกการนับ'}</button>
        <button onClick={onClose} disabled={saving} style={btnStyle('rgba(255,255,255,0.08)')}>ยกเลิก</button>
        <span style={{ fontSize: 12, color: missing.length ? ORANGE : GREEN }}>{missing.length ? `เหลือ ${missing.length} รายการ` : 'ครบทุกรายการแล้ว'}</span>
      </div>
    </div>
  )
}

// ─── StockTab ─────────────────────────────────────────────────────────────────

export default function StockTab() {
  const [items,        setItems]        = useState<StockDetail[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [newData,      setNewData]      = useState<InventoryForm>(emptyInventoryForm())
  const [saving,       setSaving]       = useState(false)
  const [msg,          setMsg]          = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [deleteTarget,      setDeleteTarget]      = useState<StockDetail | null>(null)
  const [deleting,          setDeleting]          = useState(false)
  const [deleteRecipeCount, setDeleteRecipeCount] = useState(0)
  const [loadErr,      setLoadErr]      = useState<string | null>(null)
  const [countMode,    setCountMode]    = useState<'count' | 'opening' | null>(null)

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500) }

  // only the first load shows the spinner: a reload replacing the list would close open panels and lose a count in progress
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_stock_detail')
    setLoadErr(error ? dbErrorText(error) : null)
    if (!error) setItems((data as StockDetail[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!deleteTarget) { setDeleteRecipeCount(0); return }
    authClient.from('recipe_ingredients').select('id', { count: 'exact', head: true })
      .eq('inventory_id', deleteTarget.id)
      .then(({ count, error }) => {
        // unknown = treat as used, so an ingredient in a recipe is never deleted by mistake
        if (error) { showMsg('ตรวจสูตรที่ใช้วัตถุดิบนี้ไม่ได้: ' + dbErrorText(error)); setDeleteRecipeCount(-1); return }
        setDeleteRecipeCount(count ?? 0)
      })
  }, [deleteTarget])

  async function createItem() {
    if (!newData.name.trim()) { showMsg('กรุณาระบุชื่อวัตถุดิบ'); return }
    const reorder = parseFloat(newData.reorder_point)
    const maxQty  = parseFloat(newData.max_quantity)
    if (!isNaN(reorder) && !isNaN(maxQty) && maxQty > 0 && reorder > maxQty) {
      showMsg('Reorder Point ต้องไม่เกินค่า Max Quantity'); return
    }
    setSaving(true)
    const { error } = await authClient.rpc('create_inventory_item', {
      p_name:                     newData.name,
      p_name_th:                  newData.name_th,
      p_name_lo:                  newData.name_lo,
      p_unit:                     newData.unit,
      p_current_qty:              0,
      p_reorder_point:            parseFloat(newData.reorder_point) || null,
      p_max_quantity:             parseFloat(newData.max_quantity)  || null,
      p_cost_per_unit:            parseFloat(newData.cost_per_unit) || null,
      p_storage_location:         newData.storage_location || null,
      p_expiry_days:              parseInt(newData.expiry_days)     || null,
      p_supplier:                 newData.supplier,
      p_supplier_phone:           newData.supplier_phone,
      p_secondary_supplier:       newData.secondary_supplier,
      p_secondary_supplier_phone: newData.secondary_supplier_phone,
      p_notes:                    newData.notes,
    })
    if (!error) { showMsg('เพิ่มวัตถุดิบสำเร็จ'); setShowForm(false); setNewData(emptyInventoryForm()); await load() }
    else showMsg('บันทึกไม่ได้: ' + dbErrorText(error))
    setSaving(false)
  }

  async function deleteItem(id: string) {
    setDeleting(true)
    const { error } = await authClient.rpc('delete_inventory_item', { p_id: id })
    if (!error) { setDeleteTarget(null); showMsg('ลบเรียบร้อย'); await load() }
    else showMsg('ลบไม่ได้: ' + dbErrorText(error))
    setDeleting(false)
  }

  if (loading) return <LoadingSpinner />
  if (loadErr && items.length === 0) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ color: RED, fontSize: 14, marginBottom: 12 }}>โหลดรายการวัตถุดิบไม่ได้: {loadErr}</div>
      <button onClick={() => void load()} style={btnStyle(GOLD)}>ลองใหม่</button>
    </div>
  )

  const totalValue   = items.reduce((s, i) => s + Math.max(i.stock_value, 0), 0)
  const lowCount     = items.filter(i => i.current_qty >= 0 && i.reorder_point != null && i.current_qty <= i.reorder_point).length
  const negCount     = items.filter(i => i.current_qty < 0).length
  const expiryCount  = items.filter(i => i.expiry_days_remaining != null && i.expiry_days_remaining >= 0 && i.expiry_days_remaining <= 3).length

  // sold past the count (below 0) first, so the owner sees what needs a recount or a receive
  const filtered = items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.name_th ?? '').includes(search) || (i.unit ?? '').includes(search)
  ).sort((a, b) => Number(b.current_qty < 0) - Number(a.current_qty < 0))

  return (
    <div>
      {loadErr && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, border: `1px solid ${RED}44`, backgroundColor: RED + '10', color: RED, fontSize: 13 }}>
          โหลดยอดล่าสุดไม่ได้ ตัวเลขด้านล่างอาจไม่ใช่ล่าสุด: {loadErr}{' '}
          <button onClick={() => void load()} style={btnStyleSm('rgba(255,255,255,0.07)', GOLD)}>ลองใหม่</button>
        </div>
      )}
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'มูลค่าสต็อกรวม', value: fmtLAK(totalValue), color: GOLD },
          { label: 'วัตถุดิบทั้งหมด', value: `${items.length} รายการ`, color: '#fff' },
          { label: 'ใกล้หมด / ติดลบ', value: `${lowCount} / ${negCount}`, color: lowCount + negCount > 0 ? RED : GREEN },
          { label: 'ใกล้หมดอายุ', value: String(expiryCount), color: expiryCount > 0 ? ORANGE : GREEN },
        ].map(c => (
          <div key={c.label} style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase' }}>
          วัตถุดิบ ({filtered.length} รายการ)
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา..." style={{ ...inputStyle, width: 160, padding: '6px 12px' }} />
          <button onClick={() => setCountMode(countMode === 'count' ? null : 'count')} disabled={items.length === 0} style={btnStyle('rgba(255,255,255,0.08)')}>นับสต็อก</button>
          <button onClick={() => setCountMode(countMode === 'opening' ? null : 'opening')} disabled={items.length === 0} style={btnStyle('rgba(255,255,255,0.08)')}>ยอดตั้งต้น (เจ้าของ)</button>
          <button onClick={() => { setShowForm(!showForm); setNewData(emptyInventoryForm()) }} style={btnStyle(GOLD)}>
            {showForm ? '✕ ปิด' : '+ เพิ่มวัตถุดิบ'}
          </button>
        </div>
      </div>

      <Toast msg={msg} />

      {deleteTarget && (
        <ConfirmDeleteModal
          item={deleteTarget}
          recipeCount={deleteRecipeCount}
          onConfirm={() => void deleteItem(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {countMode && (
        <CountPanel key={countMode} items={items} opening={countMode === 'opening'} onClose={() => setCountMode(null)}
          onDone={m => { showMsg(m); setCountMode(null); void load() }} />
      )}

      {/* Add form */}
      {showForm && (
        <div style={{ marginBottom: 20, padding: 20, backgroundColor: '#0d0d0d', border: `1px solid ${GOLD}33`, borderRadius: 12 }}>
          <div style={{ fontSize: 12, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 16 }}>เพิ่มวัตถุดิบใหม่</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>เพิ่มแล้วเริ่มที่ 0 — ใส่จำนวนที่มีด้วยปุ่ม “+ รับของ” หรือ “ยอดตั้งต้น” เพื่อให้มีประวัติและลงรายจ่ายถูก</div>
          <InventoryFormFields data={newData} onChange={setNewData} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={createItem} disabled={saving} style={btnStyle(GOLD)}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            <button onClick={() => setShowForm(false)} style={btnStyle('rgba(255,255,255,0.08)')}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* Stock list */}
      <div>
        {filtered.map(item => (
          <StockItemRow key={item.id} item={item} onReload={load} showMsg={showMsg} onDelete={setDeleteTarget} />
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: 48, fontSize: 14 }}>
            ไม่พบวัตถุดิบ
          </div>
        )}
      </div>
    </div>
  )
}
