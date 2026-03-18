'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { MoneyInput } from '@/components/MoneyInput'
import {
  GOLD, GOLD_DIM, BLACK, CARD, CARD2, BORDER, RED, GREEN, ORANGE,
  Category, RecipeFull, RecipeFullEdit, DaySale,
  inputStyle, btnStyle, btnStyleSm,
  Badge, Toast, LoadingSpinner, Field,
  fmtLAK, fmtK, fmtDate,
  ALLERGENS, toEdit, emptyEdit,
} from '@/components/cafe/shared'

// ─── AllergenToggle ───────────────────────────────────────────────────────────

function AllergenToggle({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (a: string) => onChange(selected.includes(a) ? selected.filter(x => x !== a) : [...selected, a])
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {ALLERGENS.map(a => {
        const on = selected.includes(a)
        return (
          <button key={a} onClick={() => toggle(a)} type="button" style={{
            padding: '3px 10px', borderRadius: 20, border: `1px solid ${on ? ORANGE : 'rgba(255,255,255,0.12)'}`,
            backgroundColor: on ? ORANGE + '22' : 'transparent',
            color: on ? ORANGE : 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer',
          }}>{a}</button>
        )
      })}
    </div>
  )
}

// ─── RecipeFullForm ───────────────────────────────────────────────────────────

function RecipeFullForm({ data, onChange, categories, saving, onSave, onCancel, title }: {
  data: RecipeFullEdit; onChange: (d: RecipeFullEdit) => void; categories: Category[]
  saving: boolean; onSave: () => void; onCancel: () => void; title: string
}) {
  const [uploading, setUploading] = useState(false)
  const set = (k: keyof RecipeFullEdit) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...data, [k]: e.target.value })
  const setMoney = (k: keyof RecipeFullEdit) => (v: string) => onChange({ ...data, [k]: v })
  const taStyle: React.CSSProperties = { ...inputStyle, height: 60, resize: 'vertical' as const }
  return (
    <div style={{ padding: 20, backgroundColor: '#0d0d0d', border: `1px solid ${GOLD}33`, borderRadius: 12 }}>
      <div style={{ fontSize: 12, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 16 }}>{title}</div>

      {/* Names */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Field label="ชื่อ EN *"><input value={data.product_name} onChange={set('product_name')} style={inputStyle} placeholder="Espresso" /></Field>
        <Field label="ชื่อ TH"><input value={data.product_name_th} onChange={set('product_name_th')} style={inputStyle} placeholder="เอสเพรสโซ่" /></Field>
        <Field label="ชื่อ LO"><input value={data.product_name_lo} onChange={set('product_name_lo')} style={inputStyle} placeholder="ເອສເປຣັສໂຊ" /></Field>
      </div>

      {/* Descriptions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Field label="คำอธิบาย EN"><textarea value={data.description_en} onChange={set('description_en')} style={taStyle} placeholder="Rich espresso..." /></Field>
        <Field label="คำอธิบาย TH"><textarea value={data.description_th} onChange={set('description_th')} style={taStyle} placeholder="กาแฟเข้มข้น..." /></Field>
        <Field label="คำอธิบาย LO"><textarea value={data.description_lo} onChange={set('description_lo')} style={taStyle} placeholder="ກາເຟ..." /></Field>
      </div>

      {/* Price + Cost + Prep + Cal + Category */}
      <div style={{ display: 'grid', gridTemplateColumns: '110px 110px 100px 100px 1fr', gap: 10, marginBottom: 12 }}>
        <Field label="ราคา ₭ *"><MoneyInput value={data.price_str} onChange={setMoney('price_str')} style={inputStyle} placeholder="0" /></Field>
        <Field label="ต้นทุน/แก้ว ₭"><MoneyInput value={data.cost_str} onChange={setMoney('cost_str')} style={inputStyle} placeholder="0" /></Field>
        <Field label="เวลา (นาที)"><input value={data.prep_str} onChange={set('prep_str')} type="number" min="0" style={inputStyle} /></Field>
        <Field label="แคลอรี่"><input value={data.cal_str} onChange={set('cal_str')} type="number" min="0" style={inputStyle} /></Field>
        <Field label="หมวดหมู่">
          <select value={data.category_id} onChange={set('category_id')} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">— ไม่ระบุ —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}{c.name_th ? ` (${c.name_th})` : ''}</option>)}
          </select>
        </Field>
      </div>

      {/* Allergens */}
      <div style={{ marginBottom: 12 }}>
        <Field label="Allergens">
          <AllergenToggle selected={data.allergens} onChange={v => onChange({ ...data, allergens: v })} />
        </Field>
      </div>

      {/* Image upload */}
      <div style={{ marginBottom: 12 }}>
        <Field label="รูปภาพ">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ padding: '8px 14px', borderRadius: 6, border: `1px solid ${GOLD}44`, color: GOLD, fontSize: 13, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1, userSelect: 'none' }}>
              {uploading ? 'กำลังอัปโหลด...' : '+ เลือกรูป'}
              <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
                onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploading(true)
                  const ext = file.name.split('.').pop() ?? 'jpg'
                  const path = `recipes/${Date.now()}.${ext}`
                  const { data: up, error } = await supabase.storage.from('menu-images').upload(path, file, { upsert: true })
                  if (!error && up) {
                    const { data: url } = supabase.storage.from('menu-images').getPublicUrl(up.path)
                    onChange({ ...data, image_url: url.publicUrl })
                  }
                  setUploading(false)
                  e.target.value = ''
                }} />
            </label>
            {data.image_url && (
              <img src={data.image_url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: `1px solid ${BORDER}` }} />
            )}
            {data.image_url && (
              <button type="button" onClick={() => onChange({ ...data, image_url: '' })} style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
            )}
          </div>
        </Field>
      </div>

      {/* Seasonal toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button type="button" onClick={() => onChange({ ...data, is_seasonal: !data.is_seasonal })} style={{
          width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
          backgroundColor: data.is_seasonal ? GOLD : 'rgba(255,255,255,0.1)', transition: 'background .2s',
        }} />
        <span style={{ fontSize: 13, color: data.is_seasonal ? GOLD : 'rgba(255,255,255,0.4)' }}>Seasonal</span>
        {data.is_seasonal && (
          <input value={data.seasonal_note} onChange={set('seasonal_note')} style={{ ...inputStyle, flex: 1 }} placeholder="หมายเหตุ Seasonal..." />
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onSave} disabled={saving} style={btnStyle(GOLD)}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        <button onClick={onCancel} style={btnStyle('rgba(255,255,255,0.08)')}>ยกเลิก</button>
      </div>
    </div>
  )
}

// ─── RecipeCard ───────────────────────────────────────────────────────────────

function RecipeCard({ r, categories, onReload }: { r: RecipeFull; categories: Category[]; onReload: () => void }) {
  const [open,        setOpen]        = useState(false)
  const [editing,     setEditing]     = useState(false)
  const [editData,    setEditData]    = useState<RecipeFullEdit>(toEdit(r))
  const [saving,      setSaving]      = useState(false)
  const [history,     setHistory]     = useState<DaySale[] | null>(null)
  const [histLoading, setHistLoading] = useState(false)
  const [msg,         setMsg]         = useState<string | null>(null)

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000) }

  async function loadHistory() {
    if (history !== null) return
    setHistLoading(true)
    const { data } = await supabase.rpc('get_recipe_sales_history', { p_recipe_id: r.id, p_days: 7 })
    setHistory((data as DaySale[]) ?? [])
    setHistLoading(false)
  }

  function handleExpand() {
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
      p_product_name:   editData.product_name,
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

  const marginColor = r.margin_pct >= 60 ? GREEN : r.margin_pct >= 40 ? GOLD : RED
  const histMax = history ? Math.max(...history.map(d => d.sales), 1) : 1
  void histMax

  return (
    <div style={{ backgroundColor: CARD, border: `1px solid ${open ? GOLD + '44' : BORDER}`, borderRadius: 12, overflow: 'hidden', opacity: r.is_active ? 1 : 0.5, transition: 'border-color .2s' }}>
      {/* Card header */}
      <div onClick={handleExpand} style={{ padding: '16px 18px', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <button onClick={toggleActive} title={r.is_active ? 'ปิด' : 'เปิด'} style={{
            width: 34, height: 19, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2,
            backgroundColor: r.is_active ? GOLD : 'rgba(255,255,255,0.1)', transition: 'background .2s',
          }} />
          {r.image_url && (
            <img src={r.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: `1px solid ${BORDER}` }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{r.product_name}</span>
              {r.is_seasonal && <Badge label="Seasonal" bg={GOLD + '22'} color={GOLD} />}
              {!r.is_active && <Badge label="ปิด" bg="rgba(255,255,255,0.06)" color="rgba(255,255,255,0.3)" />}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
              {r.product_name_th && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>{r.product_name_th}</span>}
              {r.product_name_lo && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>{r.product_name_lo}</span>}
            </div>
          </div>
          {r.category && <Badge label={r.category} bg={GOLD + '18'} color={GOLD} />}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: GOLD }}>{fmtLAK(r.price_lak)}</div>
            {r.cost_per_cup_lak && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                ต้นทุน {fmtLAK(r.cost_per_cup_lak)}
              </div>
            )}
          </div>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 3, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Margin</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: marginColor }}>{r.margin_pct}%</span>
          </div>
          {r.preparation_time && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>⏱ {r.preparation_time} นาที</div>
          )}
          {r.calories && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{r.calories} kcal</div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '1px' }}>30 วัน</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{r.total_qty_30d} แก้ว</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '1px' }}>ยอดรวม</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{fmtK(r.total_sales_30d)}</div>
            </div>
          </div>
        </div>

        {r.allergens && r.allergens.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {r.allergens.map(a => <Badge key={a} label={a} bg={ORANGE + '18'} color={ORANGE} />)}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {open && !editing && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px 18px', backgroundColor: '#0d0d0d' }}>
          {(r.description_en || r.description_th || r.description_lo) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>คำอธิบาย</div>
              {r.description_en && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>{r.description_en}</div>}
              {r.description_th && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 3 }}>{r.description_th}</div>}
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

          <div style={{ marginBottom: 14 }}>
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

          <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
            {r.calc_cost > 0 && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                ต้นทุนจากสูตร: <span style={{ color: 'rgba(255,255,255,0.55)' }}>{fmtLAK(r.calc_cost)}</span>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              Gross Margin: <span style={{ color: marginColor, fontWeight: 700 }}>{r.margin_pct}%</span>
            </div>
          </div>

          {msg && <Toast msg={msg} />}

          <button onClick={() => { setEditing(true); setEditData(toEdit(r)) }} style={btnStyleSm(GOLD + '22', GOLD)}>
            แก้ไขข้อมูล
          </button>
        </div>
      )}

      {/* Edit form */}
      {open && editing && (
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          {msg && <div style={{ padding: '8px 18px' }}><Toast msg={msg} /></div>}
          <RecipeFullForm
            title={`แก้ไข: ${r.product_name}`}
            data={editData}
            onChange={setEditData}
            categories={categories}
            saving={saving}
            onSave={saveEdit}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  )
}

// ─── MenuTab ──────────────────────────────────────────────────────────────────

export default function MenuTab() {
  const [recipes,    setRecipes]    = useState<RecipeFull[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [newData,    setNewData]    = useState<RecipeFullEdit>(emptyEdit())
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState<string | null>(null)
  const [search,     setSearch]     = useState('')

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
    if (!newData.product_name.trim()) { showMsg('กรุณาระบุชื่อเมนู'); return }
    const price = parseFloat(newData.price_str)
    if (isNaN(price) || price < 0) { showMsg('ราคาไม่ถูกต้อง'); return }
    setSaving(true)
    const { error } = await supabase.rpc('create_recipe_full', {
      p_product_name:   newData.product_name.trim(),
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

  const filtered = recipes.filter(r =>
    !search || r.product_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.product_name_th ?? '').includes(search) || (r.category ?? '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
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

      <Toast msg={msg} />

      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <RecipeFullForm
            title="เพิ่มเมนูใหม่"
            data={newData}
            onChange={setNewData}
            categories={categories}
            saving={saving}
            onSave={createRecipe}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {filtered.map(r => (
          <RecipeCard key={r.id} r={r} categories={categories} onReload={load} />
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
