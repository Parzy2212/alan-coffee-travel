'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { MoneyInput } from '@/components/MoneyInput'
import {
  GOLD, BLACK, CARD, CARD2, BORDER, RED, GREEN, ORANGE,
  Category, RecipeFull, RecipeFullEdit, DaySale,
  inputStyle, btnStyle, btnStyleSm,
  Badge, Toast, LoadingSpinner,
  fmtLAK, fmtK,
  ALLERGENS, toEdit, emptyEdit,
} from '@/components/cafe/shared'
void BLACK

// ─── AllergenToggle ───────────────────────────────────────────────────────────

function AllergenToggle({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (a: string) => onChange(selected.includes(a) ? selected.filter(x => x !== a) : [...selected, a])
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {ALLERGENS.map(a => {
        const on = selected.includes(a)
        return (
          <button key={a} onClick={() => toggle(a)} type="button" style={{
            padding: '6px 14px', borderRadius: 20,
            border: `1px solid ${on ? ORANGE : 'rgba(255,255,255,0.12)'}`,
            backgroundColor: on ? ORANGE + '22' : 'transparent',
            color: on ? ORANGE : 'rgba(255,255,255,0.4)',
            fontSize: 13, cursor: 'pointer', transition: 'all .15s',
          }}>{a}</button>
        )
      })}
    </div>
  )
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ on, onChange, label, icon }: { on: boolean; onChange: (v: boolean) => void; label: string; icon?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => onChange(!on)}>
      <div style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative',
        backgroundColor: on ? GOLD : 'rgba(255,255,255,0.1)', transition: 'background .2s', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18,
          borderRadius: 9, backgroundColor: '#fff', transition: 'left .2s',
        }} />
      </div>
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      <span style={{ fontSize: 14, color: on ? GOLD : 'rgba(255,255,255,0.45)' }}>{label}</span>
    </div>
  )
}

// ─── MenuWizard ───────────────────────────────────────────────────────────────

function MenuWizard({
  data, onChange, categories, saving, onSave, onCancel, costPerCup, onSwitchToRecipeCost,
}: {
  data: RecipeFullEdit
  onChange: (d: RecipeFullEdit) => void
  categories: Category[]
  saving: boolean
  onSave: () => void
  onCancel: () => void
  costPerCup?: number
  onSwitchToRecipeCost?: (menuId: string) => void
}) {
  const [step,           setStep]          = useState(1)
  const [showAltNames,   setShowAltNames]  = useState(!!(data.product_name || data.product_name_lo))
  const [uploading,      setUploading]     = useState(false)
  const [toastMsg,       setToastMsg]      = useState<string | null>(null)
  const [costInputMode,  setCostInputMode] = useState(false)

  const showToast = (m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(null), 3000) }
  const set = (k: keyof RecipeFullEdit) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange({ ...data, [k]: e.target.value })

  const price         = parseFloat(data.price_str) || 0
  const effectiveCost = costPerCup ?? (parseFloat(data.cost_str) || 0)
  const margin        = price > 0 && effectiveCost > 0
    ? Math.round(((price - effectiveCost) / price) * 100) : null
  const marginColor   = margin === null ? 'rgba(255,255,255,0.3)'
    : margin >= 60 ? GREEN : margin >= 40 ? ORANGE : RED
  const suggested = effectiveCost > 0 ? {
    lo: Math.round(effectiveCost / 0.5 / 1000) * 1000,
    hi: Math.round(effectiveCost / 0.3 / 1000) * 1000,
  } : null

  function goNext() {
    if (step === 1 && !data.product_name_th.trim() && !data.product_name.trim()) {
      showToast('กรุณาระบุชื่อเมนูก่อน'); return
    }
    setStep(s => Math.min(s + 1, 3))
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `recipes/${Date.now()}.${ext}`
    const { data: up, error } = await supabase.storage.from('menu-images').upload(path, file, { upsert: true })
    if (!error && up) {
      const { data: url } = supabase.storage.from('menu-images').getPublicUrl(up.path)
      onChange({ ...data, image_url: url.publicUrl })
    }
    setUploading(false)
    e.target.value = ''
  }

  const stepLabels = ['ข้อมูลหลัก', 'ราคาและต้นทุน', 'รายละเอียด']

  const cardStyle: React.CSSProperties = {
    backgroundColor: CARD2, borderRadius: 12, padding: '18px 20px', border: `1px solid ${BORDER}`,
  }
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12,
  }

  return (
    <div style={{ backgroundColor: '#0d0d0d', border: `1px solid ${GOLD}33`, borderRadius: 16, overflow: 'hidden' }}>

      {/* ── Progress indicator ── */}
      <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: s < step ? 'pointer' : 'default' }}
            onClick={() => s < step && setStep(s)}>
            <div style={{
              width: s === step ? 28 : 22, height: 8, borderRadius: 4,
              backgroundColor: s === step ? GOLD : s < step ? GOLD + '66' : 'rgba(255,255,255,0.1)',
              transition: 'all .2s',
            }} />
          </div>
        ))}
        <span style={{ fontSize: 12, color: GOLD, fontWeight: 700, marginLeft: 4 }}>
          {stepLabels[step - 1]}
        </span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginLeft: 2 }}>
          ({step}/3)
        </span>
      </div>

      {/* ── Step content ── */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {toastMsg && <Toast msg={toastMsg} />}

        {/* ════════ STEP 1: Basic Info ════════ */}
        {step === 1 && (
          <>
            {/* Primary name — Thai */}
            <div style={cardStyle}>
              <div style={sectionLabel}>ชื่อเมนู *</div>
              <input
                value={data.product_name_th}
                onChange={set('product_name_th')}
                style={{ ...inputStyle, fontSize: 20, height: 56, fontWeight: 700 }}
                placeholder="เช่น กาแฟลาเต้..."
                autoFocus
              />
              {/* Collapsed alt names */}
              <button
                type="button"
                onClick={() => setShowAltNames(v => !v)}
                style={{ marginTop: 10, background: 'none', border: 'none', color: GOLD + 'aa', cursor: 'pointer', fontSize: 12, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {showAltNames ? '▼' : '▶'} ชื่อภาษาอื่น (EN / LO)
              </button>
              {showAltNames && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>ชื่อภาษาอังกฤษ</div>
                    <input value={data.product_name} onChange={set('product_name')} style={inputStyle} placeholder="Latte" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>ชื่อภาษาลาว</div>
                    <input value={data.product_name_lo} onChange={set('product_name_lo')} style={inputStyle} placeholder="ລາເຕ..." />
                  </div>
                </div>
              )}
            </div>

            {/* Category grid */}
            <div style={cardStyle}>
              <div style={sectionLabel}>หมวดหมู่</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" onClick={() => onChange({ ...data, category_id: '' })} style={{
                  padding: '8px 18px', borderRadius: 20, fontSize: 13, cursor: 'pointer', transition: 'all .15s',
                  border: `1px solid ${!data.category_id ? GOLD : 'rgba(255,255,255,0.14)'}`,
                  backgroundColor: !data.category_id ? GOLD + '22' : 'transparent',
                  color: !data.category_id ? GOLD : 'rgba(255,255,255,0.4)',
                }}>ไม่ระบุ</button>
                {categories.map(c => {
                  const sel = data.category_id === c.id
                  return (
                    <button key={c.id} type="button" onClick={() => onChange({ ...data, category_id: c.id })} style={{
                      padding: '8px 18px', borderRadius: 20, fontSize: 13, cursor: 'pointer', transition: 'all .15s',
                      border: `1px solid ${sel ? GOLD : 'rgba(255,255,255,0.14)'}`,
                      backgroundColor: sel ? GOLD + '22' : 'transparent',
                      color: sel ? GOLD : 'rgba(255,255,255,0.4)',
                    }}>
                      {c.name_th || c.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Photo upload */}
            <div style={cardStyle}>
              <div style={sectionLabel}>รูปภาพเมนู</div>
              <label style={{ display: 'block', cursor: uploading ? 'not-allowed' : 'pointer' }}>
                {data.image_url ? (
                  <div style={{ position: 'relative' }}>
                    <img src={data.image_url} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); onChange({ ...data, image_url: '' }) }}
                      style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 14, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                    >✕</button>
                  </div>
                ) : (
                  <div style={{
                    height: 130, border: `2px dashed ${GOLD}33`, borderRadius: 12,
                    backgroundColor: CARD2, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    <div style={{ fontSize: 28 }}>📷</div>
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
                      {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปภาพเมนู'}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>ลากหรือคลิกเพื่อเลือก</div>
                  </div>
                )}
                <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={handleUpload} />
              </label>
            </div>

            {/* Seasonal */}
            <div style={cardStyle}>
              <Toggle
                on={data.is_seasonal}
                onChange={v => onChange({ ...data, is_seasonal: v })}
                label="เมนูตามฤดูกาล (Seasonal)"
                icon="☀️"
              />
              {data.is_seasonal && (
                <input
                  value={data.seasonal_note}
                  onChange={set('seasonal_note')}
                  style={{ ...inputStyle, marginTop: 10 }}
                  placeholder="หมายเหตุ เช่น มีเฉพาะเดือนธันวา-กุมภา..."
                />
              )}
            </div>
          </>
        )}

        {/* ════════ STEP 2: Pricing ════════ */}
        {step === 2 && (
          <>
            {/* Cost connection */}
            <div style={cardStyle}>
              <div style={sectionLabel}>เชื่อมกับสูตรต้นทุน</div>
              {costPerCup ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', backgroundColor: GREEN + '14', borderRadius: 10, border: `1px solid ${GREEN}33` }}>
                  <span style={{ fontSize: 18 }}>✓</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: GREEN }}>เชื่อมกับสูตรต้นทุนแล้ว</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                      ต้นทุน/แก้ว: <span style={{ color: '#fff', fontWeight: 600 }}>{fmtLAK(costPerCup)}</span>
                    </div>
                  </div>
                </div>
              ) : parseFloat(data.cost_str) > 0 && !costInputMode ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: CARD, borderRadius: 10 }}>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                    ต้นทุนที่บันทึกไว้: <span style={{ color: '#fff', fontWeight: 600 }}>{fmtLAK(parseFloat(data.cost_str))}</span>
                  </div>
                  <button type="button" onClick={() => setCostInputMode(true)} style={btnStyleSm(GOLD + '22', GOLD)}>แก้ไข</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ padding: '12px 16px', backgroundColor: GOLD + '0d', borderRadius: 10, border: `1px solid ${GOLD}22`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>💡</span>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                        ยังไม่มีสูตรต้นทุน
                      </div>
                    </div>
                    {onSwitchToRecipeCost && (
                      <button
                        type="button"
                        onClick={() => onSwitchToRecipeCost('')}
                        style={{ ...btnStyleSm(GOLD + '22', GOLD), whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        🧮 สร้างสูตร
                      </button>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>หรือกรอกต้นทุนเองชั่วคราว</div>
                    <MoneyInput value={data.cost_str} onChange={v => onChange({ ...data, cost_str: v })} style={inputStyle} placeholder="ต้นทุน/แก้ว (₭)" />
                  </div>
                </div>
              )}
            </div>

            {/* Price — large prominent */}
            <div style={cardStyle}>
              <div style={sectionLabel}>ราคาขาย *</div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
                <MoneyInput
                  value={data.price_str}
                  onChange={v => onChange({ ...data, price_str: v })}
                  style={{ ...inputStyle, fontSize: 24, height: 60, fontWeight: 800, paddingRight: 36, flex: 1 }}
                  placeholder="0"
                />
                <span style={{ fontSize: 18, color: GOLD, fontWeight: 700, flexShrink: 0 }}>₭</span>
              </div>

              {/* Margin indicator */}
              {price > 0 && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Gross Margin</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: marginColor }}>
                      {margin !== null ? `${margin}%` : '—'}
                    </span>
                  </div>
                  {margin !== null && (
                    <div style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, margin))}%`, backgroundColor: marginColor, borderRadius: 3, transition: 'width .3s' }} />
                    </div>
                  )}
                  {suggested && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                      ราคาแนะนำ (margin 50-70%):&nbsp;
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                        {suggested.lo.toLocaleString()} – {suggested.hi.toLocaleString()} ₭
                      </span>
                    </div>
                  )}
                  {margin !== null && margin < 40 && price > 0 && (
                    <div style={{ padding: '8px 12px', backgroundColor: RED + '18', borderRadius: 8, border: `1px solid ${RED}33`, fontSize: 12, color: RED, fontWeight: 600 }}>
                      ⚠️ Margin ต่ำกว่า 40% — อาจไม่คุ้มต้นทุน
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Prep time + Calories */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={cardStyle}>
                <div style={sectionLabel}>เวลาเตรียม</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input value={data.prep_str} onChange={set('prep_str')} type="number" min="0"
                    style={{ ...inputStyle, flex: 1 }} placeholder="5" />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>นาที</span>
                </div>
              </div>
              <div style={cardStyle}>
                <div style={sectionLabel}>แคลอรี่</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input value={data.cal_str} onChange={set('cal_str')} type="number" min="0"
                    style={{ ...inputStyle, flex: 1 }} placeholder="120" />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>kcal</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════ STEP 3: Details (optional) ════════ */}
        {step === 3 && (
          <>
            {/* Allergens */}
            <div style={cardStyle}>
              <div style={sectionLabel}>สารก่อภูมิแพ้</div>
              <AllergenToggle selected={data.allergens} onChange={v => onChange({ ...data, allergens: v })} />
            </div>

            {/* Description — Thai only */}
            <div style={cardStyle}>
              <div style={sectionLabel}>คำอธิบายเมนู (ไทย)</div>
              <textarea
                value={data.description_th}
                onChange={set('description_th')}
                style={{ ...inputStyle, height: 80, resize: 'vertical' as const }}
                placeholder="อธิบายเมนูสั้นๆ เช่น กาแฟลาเต้เข้มข้น หอมกลิ่นนม..."
              />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>
                * ภาษาอื่นจะถูกแปลอัตโนมัติในอนาคต
              </div>
            </div>

            {/* Requires customization toggle */}
            <div style={cardStyle}>
              <Toggle
                on={data.is_seasonal}  // placeholder — requires_customization not yet in DB
                onChange={() => {}}    // no-op until DB column added
                label="ต้องเลือกความหวาน / อุณหภูมิ"
                icon="🎛️"
              />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>
                (ฟีเจอร์นี้จะพร้อมใช้ในเวอร์ชันถัดไป)
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Bottom action bar ── */}
      <div style={{ padding: '16px 24px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10, alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        {step > 1 && (
          <button onClick={() => setStep(s => s - 1)} style={btnStyle('rgba(255,255,255,0.08)')}>
            ← ย้อนกลับ
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onCancel} style={{ ...btnStyle('rgba(255,255,255,0.06)'), color: 'rgba(255,255,255,0.4)' }}>
          ยกเลิก
        </button>
        {step < 3 && (
          <button onClick={goNext} style={btnStyle('rgba(255,255,255,0.1)')}>
            ถัดไป →
          </button>
        )}
        <button onClick={onSave} disabled={saving} style={{ ...btnStyle(GOLD), fontWeight: 800, fontSize: 15, paddingLeft: 24, paddingRight: 24 }}>
          {saving ? 'กำลังบันทึก...' : '✓ บันทึก'}
        </button>
      </div>
    </div>
  )
}

// ─── RecipeCard ───────────────────────────────────────────────────────────────

function RecipeCard({
  r, categories, onReload, onDelete, onSwitchToRecipeCost,
}: {
  r: RecipeFull
  categories: Category[]
  onReload: () => void
  onDelete: (id: string) => void
  onSwitchToRecipeCost?: (menuId: string) => void
}) {
  const [open,         setOpen]         = useState(false)
  const [editing,      setEditing]      = useState(false)
  const [editData,     setEditData]     = useState<RecipeFullEdit>(toEdit(r))
  const [saving,       setSaving]       = useState(false)
  const [history,      setHistory]      = useState<DaySale[] | null>(null)
  const [histLoading,  setHistLoading]  = useState(false)
  const [msg,          setMsg]          = useState<string | null>(null)
  // Delete flow
  const [deleteStep,   setDeleteStep]   = useState<0 | 1>(0)
  const [deleteInput,  setDeleteInput]  = useState('')
  const [deleting,     setDeleting]     = useState(false)

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000) }

  const confirmName = r.product_name_th || r.product_name

  async function loadHistory() {
    if (history !== null) return
    setHistLoading(true)
    const { data } = await supabase.rpc('get_recipe_sales_history', { p_recipe_id: r.id, p_days: 7 })
    setHistory((data as DaySale[]) ?? [])
    setHistLoading(false)
  }

  function handleExpand() {
    if (deleteStep === 1) return  // don't expand while in delete confirm
    const next = !open
    setOpen(next)
    if (next) loadHistory()
  }

  async function toggleActive(e: React.MouseEvent) {
    e.stopPropagation()
    const { data } = await supabase.rpc('toggle_recipe_active', { p_recipe_id: r.id })
    if (data) onReload()
  }

  async function saveEdit() {
    const price = parseFloat(editData.price_str)
    if (isNaN(price) || price < 0) { showMsg('ราคาไม่ถูกต้อง'); return }
    setSaving(true)
    const { error } = await supabase.rpc('update_recipe_full', {
      p_recipe_id:      r.id,
      p_product_name:   editData.product_name || editData.product_name_th,
      p_name_th:        editData.product_name_th,
      p_name_lo:        editData.product_name_lo,
      p_description_en: editData.description_en,
      p_description_th: editData.description_th,
      p_description_lo: editData.description_lo,
      p_price:          price,
      p_cost_per_cup:   parseFloat(editData.cost_str) || null,
      p_prep_time:      parseInt(editData.prep_str) || null,
      p_calories:       parseInt(editData.cal_str) || null,
      p_allergens:      editData.allergens,
      p_category_id:    editData.category_id || null,
      p_is_seasonal:    editData.is_seasonal,
      p_seasonal_note:  editData.seasonal_note,
      p_image_url:      editData.image_url,
    })
    if (!error) { showMsg('บันทึกสำเร็จ'); setEditing(false); onReload() }
    else showMsg('Error: ' + error.message)
    setSaving(false)
  }

  async function handleDelete() {
    if (deleteInput.trim() !== confirmName.trim()) {
      showMsg('ชื่อไม่ตรงกัน'); return
    }
    setDeleting(true)
    const { data: deleted, error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', r.id)
      .select('id')
    if (error) {
      showMsg('เกิดข้อผิดพลาด: ' + error.message)
      setDeleting(false)
      return
    }
    if (!deleted || deleted.length === 0) {
      showMsg('ไม่สามารถลบได้ — อาจไม่มีสิทธิ์ (RLS) หรือไม่พบรายการนี้')
      setDeleting(false)
      return
    }
    // Success: remove immediately from parent state, then reload for consistency
    onDelete(r.id)
    onReload()
  }

  const marginColor = r.margin_pct >= 60 ? GREEN : r.margin_pct >= 40 ? GOLD : RED
  const histMax = history ? Math.max(...history.map(d => d.sales), 1) : 1
  void histMax

  return (
    <div style={{
      backgroundColor: CARD,
      border: `1px solid ${deleteStep === 1 ? RED + '55' : open ? GOLD + '44' : BORDER}`,
      borderRadius: 12, overflow: 'hidden',
      opacity: r.is_active ? 1 : 0.55,
      transition: 'border-color .2s',
    }}>
      {/* ── Card header (click to expand) ── */}
      <div onClick={handleExpand} style={{ padding: '14px 16px', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {/* Status toggle */}
          <button
            onClick={toggleActive}
            title={r.is_active ? 'ปิดเมนู' : 'เปิดเมนู'}
            style={{
              width: 34, height: 19, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 3,
              backgroundColor: r.is_active ? GOLD : 'rgba(255,255,255,0.1)', transition: 'background .2s',
            }}
          />

          {/* Image */}
          {r.image_url && (
            <img src={r.image_url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: `1px solid ${BORDER}` }} />
          )}

          {/* Name + badges */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{r.product_name_th || r.product_name}</span>
              {r.product_name_th && r.product_name && r.product_name !== r.product_name_th && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>{r.product_name}</span>
              )}
              {r.is_seasonal && <Badge label="Seasonal" bg={GOLD + '22'} color={GOLD} />}
              {!r.is_active && <Badge label="ปิด" bg="rgba(255,255,255,0.06)" color="rgba(255,255,255,0.3)" />}
            </div>
            {r.product_name_lo && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', marginTop: 1 }}>{r.product_name_lo}</div>
            )}
            {r.category && (
              <div style={{ marginTop: 4 }}>
                <Badge label={r.category} bg={GOLD + '18'} color={GOLD} />
              </div>
            )}
          </div>

          {/* Price + cost */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: GOLD }}>{fmtLAK(r.price_lak)}</div>
            {r.cost_per_cup_lak && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>
                ต้นทุน {fmtLAK(r.cost_per_cup_lak)}
              </div>
            )}
          </div>

          <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11, marginTop: 4, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px' }}>Margin</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: marginColor }}>{r.margin_pct}%</span>
          </div>
          {r.preparation_time && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>⏱ {r.preparation_time}m</div>
          )}
          {r.calories && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{r.calories} kcal</div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '1px' }}>30 วัน</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{r.total_qty_30d} แก้ว</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '1px' }}>ยอดรวม</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: GOLD }}>{fmtK(r.total_sales_30d)}</div>
            </div>
          </div>
        </div>

        {r.allergens && r.allergens.length > 0 && (
          <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
            {r.allergens.map(a => <Badge key={a} label={a} bg={ORANGE + '18'} color={ORANGE} />)}
          </div>
        )}
      </div>

      {/* ── Action buttons row (always visible) ── */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', gap: 6, padding: '0 16px 12px', alignItems: 'center' }}
      >
        {/* Edit */}
        <button
          onClick={e => { e.stopPropagation(); setEditing(true); setEditData(toEdit(r)); setOpen(true); loadHistory() }}
          style={{ ...btnStyleSm(GOLD + '18', GOLD), fontSize: 12 }}
        >
          ✏️ แก้ไข
        </button>

        {/* Recipe Cost */}
        {onSwitchToRecipeCost && (
          <button
            onClick={e => { e.stopPropagation(); onSwitchToRecipeCost(r.id) }}
            style={{ ...btnStyleSm('rgba(76,186,127,0.12)', GREEN), fontSize: 12 }}
          >
            🧮 ต้นทุน
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Delete */}
        {deleteStep === 0 ? (
          <button
            onClick={e => { e.stopPropagation(); setDeleteStep(1); setDeleteInput(''); setOpen(false) }}
            style={{ ...btnStyleSm(RED + '15', RED), fontSize: 12 }}
          >
            🗑️ ลบ
          </button>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); setDeleteStep(0); setDeleteInput('') }}
            style={{ ...btnStyleSm('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.4)'), fontSize: 12 }}
          >
            ยกเลิก
          </button>
        )}
      </div>

      {/* ── Delete confirmation ── */}
      {deleteStep === 1 && (
        <div style={{ borderTop: `1px solid ${RED}33`, padding: '14px 16px', backgroundColor: RED + '08' }}>
          {msg && <div style={{ marginBottom: 8 }}><Toast msg={msg} /></div>}
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 10 }}>
            พิมพ์ <span style={{ color: RED, fontWeight: 700 }}>{confirmName}</span> เพื่อยืนยันการลบ
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDelete()}
              style={{ ...inputStyle, flex: 1, borderColor: RED + '44' }}
              placeholder="ชื่อเมนู..."
              autoFocus
            />
            <button
              onClick={handleDelete}
              disabled={deleting || deleteInput.trim() !== confirmName.trim()}
              style={{
                ...btnStyleSm(RED + '22', RED),
                opacity: (deleting || deleteInput.trim() !== confirmName.trim()) ? 0.4 : 1,
                fontWeight: 700,
              }}
            >
              {deleting ? '...' : 'ลบ'}
            </button>
          </div>
        </div>
      )}

      {/* ── Expanded detail ── */}
      {open && !editing && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px 16px', backgroundColor: '#0d0d0d' }}>
          {(r.description_en || r.description_th || r.description_lo) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>คำอธิบาย</div>
              {r.description_th && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>{r.description_th}</div>}
              {r.description_en && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 3 }}>{r.description_en}</div>}
              {r.description_lo && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{r.description_lo}</div>}
            </div>
          )}

          {r.seasonal_note && (
            <div style={{ marginBottom: 14, padding: '8px 12px', backgroundColor: GOLD + '12', borderRadius: 6, border: `1px solid ${GOLD}22` }}>
              <span style={{ fontSize: 11, color: GOLD }}>Seasonal: </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{r.seasonal_note}</span>
            </div>
          )}

          {r.ingredients && r.ingredients.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>ส่วนผสม</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {r.ingredients.map(ing => (
                  <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', backgroundColor: CARD2, borderRadius: 6 }}>
                    <div>
                      <span style={{ fontSize: 13, color: '#fff' }}>{ing.name}</span>
                      {ing.name_th && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>{ing.name_th}</span>}
                    </div>
                    <span style={{ fontSize: 12, color: GOLD, fontWeight: 600 }}>{ing.qty_required} {ing.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>ยอดขาย 7 วัน</div>
            {histLoading ? (
              <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${GOLD}33`, borderTopColor: GOLD, animation: 'spin .7s linear infinite' }} />
              </div>
            ) : history && history.length > 0 ? (
              <div style={{ height: 80 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }}
                      tickFormatter={v => { const d = new Date(v + 'T00:00:00'); return (d.getMonth() + 1) + '/' + d.getDate() }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a1a', border: `1px solid ${GOLD}44`, borderRadius: 6, fontSize: 11 }}
                      labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                      formatter={(v) => [fmtLAK(Number(v ?? 0)), 'ยอดขาย']}
                    />
                    <Bar dataKey="sales" radius={[3, 3, 0, 0]}>
                      {history.map((d, i) => (
                        <Cell key={i} fill={d.sales > 0 ? GOLD : 'rgba(255,255,255,0.06)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>ยังไม่มีข้อมูลการขาย</div>
            )}
          </div>

          {r.calc_cost > 0 && (
            <div style={{ marginBottom: 8, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              ต้นทุนจากสูตร: <span style={{ color: 'rgba(255,255,255,0.55)' }}>{fmtLAK(r.calc_cost)}</span>
              &nbsp;&nbsp;Gross Margin: <span style={{ color: marginColor, fontWeight: 700 }}>{r.margin_pct}%</span>
            </div>
          )}

          {msg && <Toast msg={msg} />}
        </div>
      )}

      {/* ── Edit wizard ── */}
      {open && editing && (
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          {msg && <div style={{ padding: '8px 16px' }}><Toast msg={msg} /></div>}
          <MenuWizard
            data={editData}
            onChange={setEditData}
            categories={categories}
            saving={saving}
            onSave={saveEdit}
            onCancel={() => setEditing(false)}
            costPerCup={r.cost_per_cup_lak ?? undefined}
            onSwitchToRecipeCost={onSwitchToRecipeCost}
          />
        </div>
      )}
    </div>
  )
}

// ─── MenuTab ──────────────────────────────────────────────────────────────────

export default function MenuTab({ onSwitchToRecipeCost }: { onSwitchToRecipeCost?: (menuId: string) => void }) {
  const [recipes,      setRecipes]      = useState<RecipeFull[]>([])
  const [categories,   setCategories]   = useState<Category[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [newData,      setNewData]      = useState<RecipeFullEdit>(emptyEdit())
  const [saving,       setSaving]       = useState(false)
  const [msg,          setMsg]          = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [filterCatId,  setFilterCatId]  = useState<string | null>(null)  // null = all

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const [rRes, cRes] = await Promise.all([
      supabase.rpc('get_menu_with_stats'),
      supabase.from('categories').select('id, name, name_th, name_lo, parent_id').eq('is_active', true).order('sort_order'),
    ])
    setRecipes((rRes.data as RecipeFull[]) ?? [])
    setCategories((cRes.data as Category[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createRecipe() {
    const name = newData.product_name.trim() || newData.product_name_th.trim()
    if (!name) { showMsg('กรุณาระบุชื่อเมนู'); return }
    const price = parseFloat(newData.price_str)
    if (isNaN(price) || price < 0) { showMsg('ราคาไม่ถูกต้อง'); return }
    setSaving(true)
    const { error } = await supabase.rpc('create_recipe_full', {
      p_product_name:   name,
      p_name_th:        newData.product_name_th,
      p_name_lo:        newData.product_name_lo,
      p_description_en: newData.description_en,
      p_description_th: newData.description_th,
      p_description_lo: newData.description_lo,
      p_price:          price,
      p_cost_per_cup:   parseFloat(newData.cost_str) || null,
      p_prep_time:      parseInt(newData.prep_str) || null,
      p_calories:       parseInt(newData.cal_str) || null,
      p_allergens:      newData.allergens,
      p_category_id:    newData.category_id || null,
      p_is_seasonal:    newData.is_seasonal,
      p_seasonal_note:  newData.seasonal_note,
      p_image_url:      newData.image_url,
    })
    if (!error) {
      showMsg('เพิ่มเมนูสำเร็จ')
      setShowForm(false)
      setNewData(emptyEdit())
      await load()
    } else {
      showMsg('Error: ' + error.message)
    }
    setSaving(false)
  }

  // Category filter counts
  const catCounts = categories.reduce<Record<string, number>>((acc, c) => {
    acc[c.id] = recipes.filter(r => r.category_id === c.id).length
    return acc
  }, {})

  const filtered = recipes.filter(r => {
    const matchSearch = !search ||
      (r.product_name_th ?? '').includes(search) ||
      r.product_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.category ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCatId === null || r.category_id === filterCatId
    return matchSearch && matchCat
  })

  if (loading) return <LoadingSpinner />

  return (
    <div>
      {/* ── Header bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase' }}>
          เมนูทั้งหมด ({recipes.length})
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหา..." style={{ ...inputStyle, width: 180, padding: '6px 12px' }}
          />
          <button onClick={() => { setShowForm(!showForm); setNewData(emptyEdit()) }} style={btnStyle(GOLD)}>
            {showForm ? '✕ ปิด' : '+ เพิ่มเมนู'}
          </button>
        </div>
      </div>

      {/* ── Category filter pills ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          onClick={() => setFilterCatId(null)}
          style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', transition: 'all .15s',
            border: `1px solid ${filterCatId === null ? GOLD : 'rgba(255,255,255,0.12)'}`,
            backgroundColor: filterCatId === null ? GOLD + '22' : 'transparent',
            color: filterCatId === null ? GOLD : 'rgba(255,255,255,0.4)',
          }}
        >
          ทั้งหมด ({recipes.length})
        </button>
        {categories.map(c => {
          const sel = filterCatId === c.id
          const cnt = catCounts[c.id] ?? 0
          return (
            <button
              key={c.id}
              onClick={() => setFilterCatId(sel ? null : c.id)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', transition: 'all .15s',
                border: `1px solid ${sel ? GOLD : 'rgba(255,255,255,0.12)'}`,
                backgroundColor: sel ? GOLD + '22' : 'transparent',
                color: sel ? GOLD : 'rgba(255,255,255,0.4)',
              }}
            >
              {c.name_th || c.name} ({cnt})
            </button>
          )
        })}
      </div>

      <Toast msg={msg} />

      {/* ── Add wizard ── */}
      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <MenuWizard
            data={newData}
            onChange={setNewData}
            categories={categories}
            saving={saving}
            onSave={createRecipe}
            onCancel={() => setShowForm(false)}
            onSwitchToRecipeCost={onSwitchToRecipeCost}
          />
        </div>
      )}

      {/* ── Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {filtered.map(r => (
          <RecipeCard
            key={r.id}
            r={r}
            categories={categories}
            onReload={load}
            onDelete={(id) => {
              setRecipes(prev => prev.filter(x => x.id !== id))
              showMsg('ลบเมนูเรียบร้อยแล้ว')
            }}
            onSwitchToRecipeCost={onSwitchToRecipeCost}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'rgba(255,255,255,0.2)', padding: 40, fontSize: 14 }}>
            ไม่พบเมนู
          </div>
        )}
      </div>
    </div>
  )
}
