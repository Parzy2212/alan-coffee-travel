'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { MoneyInput } from '@/components/MoneyInput'
import {
  GOLD, CARD, CARD2, BORDER, RED, GREEN, ORANGE,
  StockDetail, InventoryForm, AddStockForm, UsageStat, PurchaseLog,
  inputStyle, btnStyle, btnStyleSm,
  Badge, Toast, LoadingSpinner, Field,
  fmtLAK, fmtDate, todayISO,
  STORAGE_OPTIONS, emptyInventoryForm, storageIcon,
} from '@/components/cafe/shared'

// ─── InventoryFormFields ──────────────────────────────────────────────────────

function InventoryFormFields({ data, onChange, showQty }: {
  data: InventoryForm; onChange: (d: InventoryForm) => void; showQty?: boolean
}) {
  const set = (k: keyof InventoryForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [k]: e.target.value })
  const setMoney = (k: keyof InventoryForm) => (v: string) => onChange({ ...data, [k]: v })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Field label="ชื่อ EN *"><input value={data.name} onChange={set('name')} style={inputStyle} placeholder="Fresh Milk" /></Field>
        <Field label="ชื่อ TH"><input value={data.name_th} onChange={set('name_th')} style={inputStyle} placeholder="นมสด" /></Field>
        <Field label="ชื่อ LO"><input value={data.name_lo} onChange={set('name_lo')} style={inputStyle} placeholder="ນົມສົດ" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 120px 120px 120px 1fr', gap: 10 }}>
        <Field label="หน่วย"><input value={data.unit} onChange={set('unit')} style={inputStyle} placeholder="ml" /></Field>
        {showQty && <Field label="ปริมาณเริ่มต้น"><input value={data.current_qty} onChange={set('current_qty')} type="number" min="0" style={inputStyle} /></Field>}
        <Field label="Reorder Point"><input value={data.reorder_point} onChange={set('reorder_point')} type="number" min="0" style={inputStyle} placeholder="ขั้นต่ำ" /></Field>
        <Field label="ความจุสูงสุด"><input value={data.max_quantity} onChange={set('max_quantity')} type="number" min="0" style={inputStyle} placeholder="Max" /></Field>
        <Field label="ต้นทุน/หน่วย ₭"><MoneyInput value={data.cost_per_unit} onChange={setMoney('cost_per_unit')} style={inputStyle} placeholder="0" /></Field>
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

// ─── StockItemRow ─────────────────────────────────────────────────────────────

function StockItemRow({ item, onReload, showMsg }: {
  item: StockDetail; onReload: () => void; showMsg: (m: string) => void
}) {
  const [panel,       setPanel]       = useState<'detail' | 'add' | 'edit' | null>(null)
  const [addForm,     setAddForm]     = useState<AddStockForm>({ qty: '', cost: '', supplier: item.supplier ?? '', date: todayISO() })
  const [editData,    setEditData]    = useState<InventoryForm>({
    name: item.name, name_th: item.name_th ?? '', name_lo: item.name_lo ?? '', unit: item.unit,
    current_qty: String(item.current_qty), reorder_point: String(item.reorder_point ?? ''),
    max_quantity: String(item.max_quantity ?? ''), cost_per_unit: String(item.cost_per_unit ?? ''),
    storage_location: item.storage_location ?? 'shelf', expiry_days: String(item.expiry_days ?? ''),
    supplier: item.supplier ?? '', supplier_phone: item.supplier_phone ?? '',
    secondary_supplier: item.secondary_supplier ?? '', secondary_supplier_phone: item.secondary_supplier_phone ?? '',
    notes: item.notes ?? '',
  })
  const [history,     setHistory]     = useState<PurchaseLog[] | null>(null)
  const [usage,       setUsage]       = useState<UsageStat[] | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving,      setSaving]      = useState(false)

  const isEmpty  = item.current_qty === 0
  const isLow    = !isEmpty && item.reorder_point != null && item.current_qty <= item.reorder_point
  const isExpiring = item.expiry_days_remaining != null && item.expiry_days_remaining >= 0 && item.expiry_days_remaining <= 3
  const pct      = item.max_quantity ? Math.min((item.current_qty / item.max_quantity) * 100, 100) : null
  const barColor = pct == null ? GOLD : pct > 50 ? GREEN : pct > 25 ? ORANGE : RED
  const daysColor = item.days_until_empty != null && item.days_until_empty < 3 ? RED
    : item.days_until_empty != null && item.days_until_empty < 7 ? ORANGE : 'rgba(255,255,255,0.5)'

  function openPanel(p: 'detail' | 'add' | 'edit') {
    const next = panel === p ? null : p
    setPanel(next)
    if (next === 'detail' && history === null) {
      setDetailLoading(true)
      Promise.all([
        supabase.rpc('get_purchase_history', { p_inventory_id: item.id, p_limit: 5 }),
        supabase.rpc('get_stock_analytics',  { p_inventory_id: item.id, p_days: 14 }),
      ]).then(([hRes, uRes]) => {
        setHistory((hRes.data as PurchaseLog[]) ?? [])
        setUsage((uRes.data as UsageStat[]) ?? [])
        setDetailLoading(false)
      })
    }
  }

  async function submitAdd() {
    const qty = parseFloat(addForm.qty)
    if (isNaN(qty) || qty <= 0) { showMsg('กรุณาระบุจำนวน'); return }
    setSaving(true)
    const { error } = await supabase.rpc('add_stock', {
      p_inventory_id: item.id, p_qty: qty, p_cost_lak: parseFloat(addForm.cost) || 0,
      p_supplier: addForm.supplier || null,
      p_purchased_at: addForm.date ? new Date(addForm.date + 'T12:00:00+07:00').toISOString() : new Date().toISOString(),
    })
    if (!error) { showMsg(`เติม ${item.name} +${qty} ${item.unit}`); setPanel(null); onReload() }
    else showMsg('Error: ' + error.message)
    setSaving(false)
  }

  async function saveEdit() {
    if (!editData.name.trim()) { showMsg('กรุณาระบุชื่อ'); return }
    setSaving(true)
    const { error } = await supabase.rpc('update_inventory_item', {
      p_id:                       item.id,
      p_name:                     editData.name,
      p_name_th:                  editData.name_th,
      p_name_lo:                  editData.name_lo,
      p_unit:                     editData.unit,
      p_reorder_point:            parseFloat(editData.reorder_point)  || null,
      p_max_quantity:             parseFloat(editData.max_quantity)   || null,
      p_cost_per_unit:            parseFloat(editData.cost_per_unit)  || null,
      p_storage_location:         editData.storage_location || null,
      p_expiry_days:              parseInt(editData.expiry_days)      || null,
      p_supplier:                 editData.supplier,
      p_supplier_phone:           editData.supplier_phone,
      p_secondary_supplier:       editData.secondary_supplier,
      p_secondary_supplier_phone: editData.secondary_supplier_phone,
      p_notes:                    editData.notes,
    })
    if (!error) { showMsg('บันทึกสำเร็จ'); setPanel(null); onReload() }
    else showMsg('Error: ' + error.message)
    setSaving(false)
  }

  const borderColor = isEmpty ? RED + '44' : isLow ? ORANGE + '33' : isExpiring ? ORANGE + '44' : BORDER
  const usageMax = usage ? Math.max(...usage.map(u => u.used_qty), 0.001) : 0.001

  return (
    <div style={{ marginBottom: 6 }}>
      {/* ── Main row ── */}
      <div style={{
        backgroundColor: isEmpty ? RED + '10' : isLow ? ORANGE + '0a' : CARD,
        border: `1px solid ${borderColor}`,
        borderRadius: panel ? '10px 10px 0 0' : 10, padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 20 }}>{storageIcon(item.storage_location)}</span>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: isEmpty ? RED : isLow ? ORANGE : GREEN, boxShadow: `0 0 5px ${isEmpty ? RED : isLow ? ORANGE : GREEN}88` }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{item.name}</span>
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
              <span style={{ fontSize: 20, fontWeight: 800, color: isEmpty ? RED : isLow ? ORANGE : '#fff' }}>{item.current_qty}</span>
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
            {item.cost_per_unit && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 3 }}>
                ₭{item.cost_per_unit}/{item.unit}
              </div>
            )}
            {item.stock_value > 0 && (
              <div style={{ fontSize: 11, color: GOLD, marginTop: 2 }}>{fmtLAK(item.stock_value)}</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
            <button onClick={() => { openPanel('add'); setAddForm({ qty: '', cost: '', supplier: item.supplier ?? '', date: todayISO() }) }} style={btnStyleSm(panel === 'add' ? GOLD + '33' : GOLD + '22', GOLD)}>+ เติม</button>
            <button onClick={() => openPanel('detail')} style={btnStyleSm('rgba(255,255,255,0.07)', 'rgba(255,255,255,0.55)')}>ประวัติ</button>
            <button onClick={() => openPanel('edit')} style={btnStyleSm('rgba(255,255,255,0.05)', 'rgba(255,255,255,0.4)')}>แก้ไข</button>
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
          <div style={{ fontSize: 12, color: GOLD, marginBottom: 12, letterSpacing: '1px' }}>+ เติมสต็อก — {item.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <Field label={`จำนวน (${item.unit})`}><input autoFocus value={addForm.qty} onChange={e => setAddForm(f => ({ ...f, qty: e.target.value }))} type="number" min="0" style={inputStyle} /></Field>
            <Field label="ราคาทุน ₭ (รวม)"><MoneyInput value={addForm.cost} onChange={v => setAddForm(f => ({ ...f, cost: v }))} style={inputStyle} placeholder="0" /></Field>
            <Field label="ซัพพลายเออร์"><input value={addForm.supplier} onChange={e => setAddForm(f => ({ ...f, supplier: e.target.value }))} style={inputStyle} /></Field>
            <Field label="วันที่ซื้อ"><input value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} type="date" style={inputStyle} /></Field>
          </div>
          {addForm.qty && addForm.cost && parseFloat(addForm.qty) > 0 && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
              ราคา/หน่วย: ₭{(parseFloat(addForm.cost) / parseFloat(addForm.qty)).toFixed(0)} / {item.unit}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={submitAdd} disabled={saving} style={btnStyle(GOLD)}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
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
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>ประวัติการซื้อ (5 ล่าสุด)</div>
                {!history || history.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>ยังไม่มีประวัติ</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {history.map(log => (
                      <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: CARD, borderRadius: 6 }}>
                        <div>
                          <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>+{log.qty_purchased} {item.unit}</span>
                          {log.supplier && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 10 }}>{log.supplier}</span>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: GOLD }}>{fmtLAK(log.unit_price_lak)}/{item.unit}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>{fmtDate(log.created_at)}</div>
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
          <InventoryFormFields data={editData} onChange={setEditData} showQty={false} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={saveEdit} disabled={saving} style={btnStyle(GOLD)}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            <button onClick={() => setPanel(null)} style={btnStyle('rgba(255,255,255,0.08)')}>ยกเลิก</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── StockTab ─────────────────────────────────────────────────────────────────

export default function StockTab() {
  const [items,    setItems]    = useState<StockDetail[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newData,  setNewData]  = useState<InventoryForm>(emptyInventoryForm())
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<string | null>(null)
  const [search,   setSearch]   = useState('')

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.rpc('get_stock_detail')
    setItems((data as StockDetail[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createItem() {
    if (!newData.name.trim()) { showMsg('กรุณาระบุชื่อวัตถุดิบ'); return }
    setSaving(true)
    const { error } = await supabase.rpc('create_inventory_item', {
      p_name:                     newData.name,
      p_name_th:                  newData.name_th,
      p_name_lo:                  newData.name_lo,
      p_unit:                     newData.unit,
      p_current_qty:              parseFloat(newData.current_qty)  || 0,
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
    else showMsg('Error: ' + error.message)
    setSaving(false)
  }

  if (loading) return <LoadingSpinner />

  const totalValue   = items.reduce((s, i) => s + i.stock_value, 0)
  const lowCount     = items.filter(i => i.reorder_point != null && i.current_qty <= i.reorder_point).length
  const expiryCount  = items.filter(i => i.expiry_days_remaining != null && i.expiry_days_remaining >= 0 && i.expiry_days_remaining <= 3).length

  const filtered = items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.name_th ?? '').includes(search) || (i.unit ?? '').includes(search)
  )

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'มูลค่าสต็อกรวม', value: fmtLAK(totalValue), color: GOLD },
          { label: 'วัตถุดิบทั้งหมด', value: `${items.length} รายการ`, color: '#fff' },
          { label: 'ใกล้หมด / หมด', value: String(lowCount), color: lowCount > 0 ? RED : GREEN },
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา..." style={{ ...inputStyle, width: 160, padding: '6px 12px' }} />
          <button onClick={() => { setShowForm(!showForm); setNewData(emptyInventoryForm()) }} style={btnStyle(GOLD)}>
            {showForm ? '✕ ปิด' : '+ เพิ่มวัตถุดิบ'}
          </button>
        </div>
      </div>

      <Toast msg={msg} />

      {/* Add form */}
      {showForm && (
        <div style={{ marginBottom: 20, padding: 20, backgroundColor: '#0d0d0d', border: `1px solid ${GOLD}33`, borderRadius: 12 }}>
          <div style={{ fontSize: 12, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 16 }}>เพิ่มวัตถุดิบใหม่</div>
          <InventoryFormFields data={newData} onChange={setNewData} showQty={true} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={createItem} disabled={saving} style={btnStyle(GOLD)}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            <button onClick={() => setShowForm(false)} style={btnStyle('rgba(255,255,255,0.08)')}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* Stock list */}
      <div>
        {filtered.map(item => (
          <StockItemRow key={item.id} item={item} onReload={load} showMsg={showMsg} />
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
