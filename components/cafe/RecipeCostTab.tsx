'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MoneyInput } from '@/components/MoneyInput'
import {
  GOLD, BLACK, CARD, CARD2, BORDER, RED, GREEN, ORANGE,
  inputStyle, btnStyle, btnStyleSm,
  Toast, SectionCard, Field,
} from '@/components/cafe/shared'

// ─── RecipeCostTab ────────────────────────────────────────────────────────────

export default function RecipeCostTab() {
  type SubTab = 'ingredients' | 'bases' | 'recipes' | 'pricing'
  type Ingredient  = { id: string; name: string; unit: string; pkg_size: number; pkg_cost: number }
  type BaseIngItem = { ingredient_id: string; qty: number }
  type BaseRecipe  = { id: string; name: string; unit: string; yield_qty: number; items: BaseIngItem[] }
  type FormulaItem = { ingredient_id?: string; base_id?: string; qty_normal: number; qty_less: number; qty_more: number }
  type RecipeFormula = { id: string; recipe_id: string; recipe_name: string; price_lak: number; items: FormulaItem[]; target_margin: number }

  const [sub, setSub]                 = useState<SubTab>('ingredients')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [baseRecipes, setBaseRecipes] = useState<BaseRecipe[]>([])
  const [formulas, setFormulas]       = useState<RecipeFormula[]>([])
  const [menuItems, setMenuItems]     = useState<{ id: string; product_name: string; price_lak: number }[]>([])
  const [msg, setMsg]                 = useState<string | null>(null)

  useEffect(() => {
    supabase.from('cost_ingredients').select('*').order('name')
      .then(({ data }) => { if (data) setIngredients(data.map(r => ({ id: r.id as string, name: r.name as string, unit: r.unit as string, pkg_size: r.package_size as number, pkg_cost: r.package_cost as number }))) })
    supabase.from('cost_base_recipes').select('*').order('name')
      .then(({ data }) => { if (data) setBaseRecipes(data.map(r => ({ id: r.id as string, name: r.name as string, unit: r.unit as string, yield_qty: r.total_yield as number, items: (r.ingredients ?? []) as BaseIngItem[] }))) })
    supabase.from('cost_formulas').select('*').order('recipe_name')
      .then(({ data }) => { if (data) setFormulas(data.map(r => ({ id: r.id as string, recipe_id: r.menu_item_id as string, recipe_name: r.recipe_name as string, price_lak: r.price_lak as number, target_margin: r.target_margin as number, items: (r.components ?? []) as FormulaItem[] }))) })
    supabase.from('recipes').select('id, product_name, price_lak').eq('is_active', true).order('product_name')
      .then(({ data }) => setMenuItems((data ?? []) as { id: string; product_name: string; price_lak: number }[]))
  }, [])

  async function upsertIngredient(ing: Ingredient): Promise<Ingredient> {
    const row = { name: ing.name, unit: ing.unit, package_size: ing.pkg_size, package_cost: ing.pkg_cost }
    if (ing.id) {
      const { error } = await supabase.from('cost_ingredients').upsert({ id: ing.id, ...row })
      if (error) throw new Error('ไม่สามารถบันทึกวัตถุดิบได้ กรุณาลองใหม่')
      return ing
    }
    const { data, error } = await supabase.from('cost_ingredients').insert(row).select('id').single()
    if (error) throw new Error('ไม่สามารถบันทึกวัตถุดิบได้ กรุณาลองใหม่')
    return { ...ing, id: (data as { id: string }).id }
  }
  async function removeIngredient(id: string) { await supabase.from('cost_ingredients').delete().eq('id', id) }

  async function upsertBaseRecipe(b: BaseRecipe): Promise<BaseRecipe> {
    const yield_qty = b.items.reduce((s, i) => s + i.qty, 0)
    const row = { name: b.name, unit: b.unit, ingredients: b.items, total_yield: yield_qty }
    if (b.id) {
      const { error } = await supabase.from('cost_base_recipes').upsert({ id: b.id, ...row })
      if (error) throw new Error('ไม่สามารถบันทึกสูตรฐานได้ กรุณาลองใหม่')
      return { ...b, yield_qty }
    }
    const { data, error } = await supabase.from('cost_base_recipes').insert(row).select('id').single()
    if (error) throw new Error('ไม่สามารถบันทึกสูตรฐานได้ กรุณาลองใหม่')
    return { ...b, id: (data as { id: string }).id, yield_qty }
  }
  async function removeBaseRecipe(id: string) { await supabase.from('cost_base_recipes').delete().eq('id', id) }

  async function upsertFormula(f: RecipeFormula): Promise<RecipeFormula> {
    const row = { menu_item_id: f.recipe_id, recipe_name: f.recipe_name, price_lak: f.price_lak, target_margin: f.target_margin, components: f.items }
    if (f.id) {
      const { error } = await supabase.from('cost_formulas').upsert({ id: f.id, ...row })
      if (error) throw new Error('ไม่สามารถบันทึกสูตรได้ กรุณาลองใหม่')
      return f
    }
    const { data, error } = await supabase.from('cost_formulas').insert(row).select('id').single()
    if (error) throw new Error('ไม่สามารถบันทึกสูตรได้ กรุณาลองใหม่')
    return { ...f, id: (data as { id: string }).id }
  }
  async function removeFormula(id: string) { await supabase.from('cost_formulas').delete().eq('id', id) }

  function calcBaseCost(base: BaseRecipe, ings: Ingredient[]): number {
    return base.items.reduce((s, item) => {
      const ing = ings.find(i => i.id === item.ingredient_id)
      return s + (ing ? item.qty * ing.pkg_cost / ing.pkg_size : 0)
    }, 0)
  }

  function calcCost(items: FormulaItem[], field: 'qty_normal' | 'qty_less' | 'qty_more', ings: Ingredient[], bases: BaseRecipe[]) {
    return items.reduce((s, item) => {
      if (item.base_id) {
        const base      = bases.find(b => b.id === item.base_id)
        if (!base) return s
        const baseYield = base.items.reduce((s2, i) => s2 + i.qty, 0)
        if (baseYield <= 0) return s
        return s + item[field] * calcBaseCost(base, ings) / baseYield
      }
      const ing = ings.find(i => i.id === item.ingredient_id)
      return s + (ing ? item[field] * ing.pkg_cost / ing.pkg_size : 0)
    }, 0)
  }

  // ── Ingredients Panel ─────────────────────────────────────────────────────
  function IngredientsPanel() {
    const [editing, setEditing] = useState<Ingredient | null>(null)
    const [form, setForm]       = useState({ name: '', unit: 'g', pkg_size: '', pkg_cost: '' })

    function startNew() { setEditing({ id: '', name: '', unit: 'g', pkg_size: 0, pkg_cost: 0 }); setForm({ name: '', unit: 'g', pkg_size: '', pkg_cost: '' }) }
    function startEdit(ing: Ingredient) { setEditing(ing); setForm({ name: ing.name, unit: ing.unit, pkg_size: String(ing.pkg_size), pkg_cost: String(ing.pkg_cost) }) }

    async function save() {
      const pkg_size = parseFloat(form.pkg_size) || 0
      const pkg_cost = parseFloat(form.pkg_cost) || 0
      if (!form.name || pkg_size <= 0 || pkg_cost <= 0) { setMsg('เกิดข้อผิดพลาด: กรอกข้อมูลให้ครบ'); return }
      const draft: Ingredient = { id: editing?.id ?? '', name: form.name, unit: form.unit, pkg_size, pkg_cost }
      try {
        const saved = await upsertIngredient(draft)
        setIngredients(prev => editing?.id ? prev.map(i => i.id === editing!.id ? saved : i) : [...prev, saved])
        setEditing(null); setMsg('บันทึกแล้ว')
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionCard title="เพิ่ม / แก้ไข วัตถุดิบ" action={<button style={btnStyle(GOLD)} onClick={startNew}>+ เพิ่มใหม่</button>}>
          {editing !== null ? (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
              <Field label="ชื่อวัตถุดิบ">
                <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น นมสด" />
              </Field>
              <Field label="หน่วย">
                <select style={inputStyle} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  <option value="g">กรัม (g)</option>
                  <option value="ml">มิลลิลิตร (ml)</option>
                  <option value="piece">ชิ้น</option>
                </select>
              </Field>
              <Field label={`ขนาดแพ็กเกจ (${form.unit})`}>
                <input style={inputStyle} type="number" min={0} value={form.pkg_size} onChange={e => setForm(f => ({ ...f, pkg_size: e.target.value }))} placeholder="เช่น 1000" />
              </Field>
              <Field label="ราคาแพ็กเกจ (₭)">
                <MoneyInput style={inputStyle} value={form.pkg_cost} onChange={v => setForm(f => ({ ...f, pkg_cost: v }))} placeholder="25,000" />
              </Field>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnStyle(GOLD)} onClick={save}>บันทึก</button>
                <button style={btnStyle('#333')} onClick={() => setEditing(null)}>ยกเลิก</button>
              </div>
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>คลิก &ldquo;+ เพิ่มใหม่&rdquo; เพื่อเพิ่มวัตถุดิบ</div>
          )}
        </SectionCard>

        <SectionCard title={`วัตถุดิบทั้งหมด (${ingredients.length})`}>
          {ingredients.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>ยังไม่มีวัตถุดิบ</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 12, padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                <span>ชื่อ</span><span>หน่วย</span><span>ขนาดแพ็ก</span><span>ราคาแพ็ก</span><span>ราคา/หน่วย</span><span></span>
              </div>
              {ingredients.map(ing => (
                <div key={ing.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 12, padding: '12px', borderRadius: 8, backgroundColor: CARD2, alignItems: 'center', fontSize: 14 }}>
                  <span style={{ fontWeight: 600 }}>{ing.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{ing.unit}</span>
                  <span>{ing.pkg_size.toLocaleString()}</span>
                  <span>{ing.pkg_cost.toLocaleString()} ₭</span>
                  <span style={{ color: GOLD, fontWeight: 700 }}>{(ing.pkg_cost / ing.pkg_size).toFixed(2)} ₭/{ing.unit}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={btnStyleSm(GOLD)} onClick={() => startEdit(ing)}>แก้ไข</button>
                    <button style={btnStyleSm(RED + '22', RED)} onClick={async () => { await removeIngredient(ing.id); setIngredients(prev => prev.filter(i => i.id !== ing.id)); setMsg('ลบแล้ว') }}>ลบ</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    )
  }

  // ── Base Recipes Panel ────────────────────────────────────────────────────
  function BaseRecipesPanel() {
    type BaseForm = { name: string; unit: string; items: BaseIngItem[] }
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm]     = useState<BaseForm>({ name: '', unit: 'ml', items: [] })

    function startNew() { setEditId('new'); setForm({ name: '', unit: 'ml', items: [] }) }
    function startEdit(b: BaseRecipe) {
      setEditId(b.id)
      setForm({ name: b.name, unit: b.unit, items: b.items.map(i => ({ ...i })) })
    }
    function addItem() {
      if (!ingredients.length) return
      setForm(f => ({ ...f, items: [...f.items, { ingredient_id: ingredients[0].id, qty: 0 }] }))
    }
    function updateItem(idx: number, patch: Partial<BaseIngItem>) {
      setForm(f => { const items = [...f.items]; items[idx] = { ...items[idx], ...patch }; return { ...f, items } })
    }
    function removeItem(idx: number) { setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) })) }

    async function save() {
      if (!form.name) { setMsg('กรอกชื่อสูตรพื้นฐาน'); return }
      const draft: BaseRecipe = { id: editId === 'new' ? '' : editId!, name: form.name, unit: form.unit, yield_qty: 0, items: form.items }
      try {
        const saved = await upsertBaseRecipe(draft)
        setBaseRecipes(prev => editId === 'new' ? [...prev, saved] : prev.map(b => b.id === editId ? saved : b))
        setEditId(null); setMsg('บันทึกแล้ว')
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      }
    }

    const previewCost  = form.items.reduce((s, item) => {
      const ing = ingredients.find(i => i.id === item.ingredient_id)
      return s + (ing ? item.qty * ing.pkg_cost / ing.pkg_size : 0)
    }, 0)
    const autoYield    = form.items.reduce((s, item) => s + item.qty, 0)
    const costPerUnit  = autoYield > 0 ? previewCost / autoYield : 0

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionCard title="สร้าง / แก้ไข สูตรพื้นฐาน" action={<button style={btnStyle(GOLD)} onClick={startNew}>+ สร้างสูตรพื้นฐาน</button>}>
          {editId !== null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, alignItems: 'end' }}>
                <Field label="ชื่อสูตรพื้นฐาน">
                  <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น นมมิกซ์, ไซรัปวนิลา" />
                </Field>
                <Field label="หน่วย">
                  <select style={inputStyle} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    <option value="ml">ml</option>
                    <option value="g">g</option>
                  </select>
                </Field>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase' }}>ส่วนผสม</span>
                  <button style={btnStyleSm('#333')} onClick={addItem} disabled={ingredients.length === 0}>+ เพิ่มวัตถุดิบ</button>
                </div>
                {form.items.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                    {ingredients.length === 0 ? 'เพิ่มวัตถุดิบในแท็บ "วัตถุดิบ" ก่อน' : 'กด "+ เพิ่มวัตถุดิบ" เพื่อใส่ส่วนผสม'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', padding: '0 4px' }}>
                      <span>วัตถุดิบ</span><span>ปริมาณ</span><span>ต้นทุน</span><span></span>
                    </div>
                    {form.items.map((item, idx) => {
                      const ing      = ingredients.find(i => i.id === item.ingredient_id)
                      const itemCost = ing ? item.qty * ing.pkg_cost / ing.pkg_size : 0
                      return (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'center' }}>
                          <select style={inputStyle} value={item.ingredient_id} onChange={e => updateItem(idx, { ingredient_id: e.target.value })}>
                            {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                          </select>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input style={{ ...inputStyle, flex: 1 }} type="number" min={0} value={item.qty} onChange={e => updateItem(idx, { qty: parseFloat(e.target.value) || 0 })} />
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{ing?.unit ?? ''}</span>
                          </div>
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{itemCost.toFixed(0)} ₭</span>
                          <button style={btnStyleSm(RED + '22', RED)} onClick={() => removeItem(idx)}>✕</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {form.items.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div style={{ backgroundColor: CARD2, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>ปริมาณรวม (อัตโนมัติ)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{autoYield.toLocaleString()} {form.unit}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>= ผลรวมส่วนผสมทั้งหมด</div>
                  </div>
                  <div style={{ backgroundColor: CARD2, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>ต้นทุนรวมต่อชุด</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>{previewCost.toFixed(0)} ₭</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>ต้นทุน ÷ {autoYield.toLocaleString()} {form.unit}</div>
                  </div>
                  <div style={{ backgroundColor: CARD2, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>ราคาต่อ{form.unit}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>{costPerUnit.toFixed(3)} ₭/{form.unit}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>คำนวณอัตโนมัติ</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnStyle(GOLD)} onClick={save}>บันทึกสูตร</button>
                <button style={btnStyle('#333')} onClick={() => setEditId(null)}>ยกเลิก</button>
              </div>
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>เช่น &ldquo;นมมิกซ์&rdquo; (นมสด + นมข้น), &ldquo;ไซรัปวนิลา&rdquo; — ใช้ซ้ำในหลายสูตรได้</div>
          )}
        </SectionCard>

        {baseRecipes.length > 0 && (
          <SectionCard title={`สูตรพื้นฐานทั้งหมด (${baseRecipes.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                <span>ชื่อ</span><span>ปริมาณที่ได้</span><span>ส่วนผสม</span><span>ราคา/หน่วย</span><span></span>
              </div>
              {baseRecipes.map(b => {
                const totalCost = calcBaseCost(b, ingredients)
                const autoQty   = b.items.reduce((s, i) => s + i.qty, 0)
                const cpUnit    = autoQty > 0 ? totalCost / autoQty : 0
                return (
                  <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, padding: '12px', borderRadius: 8, backgroundColor: CARD2, alignItems: 'center', fontSize: 14 }}>
                    <span style={{ fontWeight: 600 }}>{b.name}</span>
                    <span>{autoQty.toLocaleString()} {b.unit}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{b.items.length} รายการ</span>
                    <span style={{ color: GOLD, fontWeight: 700 }}>{cpUnit.toFixed(3)} ₭/{b.unit}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={btnStyleSm(GOLD)} onClick={() => startEdit(b)}>แก้ไข</button>
                      <button style={btnStyleSm(RED + '22', RED)} onClick={async () => { await removeBaseRecipe(b.id); setBaseRecipes(prev => prev.filter(x => x.id !== b.id)); setMsg('ลบแล้ว') }}>ลบ</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}
      </div>
    )
  }

  // ── Recipe Builder Panel ──────────────────────────────────────────────────
  function RecipesPanel() {
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm]     = useState<{ recipe_id: string; target_margin: number; items: FormulaItem[] }>({ recipe_id: '', target_margin: 60, items: [] })

    function startNew() { setEditId('new'); setForm({ recipe_id: menuItems[0]?.id ?? '', target_margin: 60, items: [] }) }
    function startEdit(f: RecipeFormula) { setEditId(f.id); setForm({ recipe_id: f.recipe_id, target_margin: f.target_margin, items: f.items.map(i => ({ ...i })) }) }
    function addRawItem() {
      if (!ingredients.length) return
      setForm(f => ({ ...f, items: [...f.items, { ingredient_id: ingredients[0].id, qty_normal: 0, qty_less: 0, qty_more: 0 }] }))
    }
    function addBaseItem() {
      if (!baseRecipes.length) return
      setForm(f => ({ ...f, items: [...f.items, { base_id: baseRecipes[0].id, qty_normal: 0, qty_less: 0, qty_more: 0 }] }))
    }
    function updateItem(idx: number, patch: Partial<FormulaItem>) {
      setForm(f => { const items = [...f.items]; items[idx] = { ...items[idx], ...patch }; return { ...f, items } })
    }
    function removeItem(idx: number) { setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) })) }

    async function save() {
      const menu = menuItems.find(m => m.id === form.recipe_id)
      if (!menu) { setMsg('เกิดข้อผิดพลาด: เลือกเมนูก่อน'); return }
      const draft: RecipeFormula = { id: editId === 'new' ? '' : editId!, recipe_id: form.recipe_id, recipe_name: menu.product_name, price_lak: menu.price_lak, items: form.items, target_margin: form.target_margin }
      try {
        const saved = await upsertFormula(draft)
        // Sync calculated cost back to the menu item in recipes table
        const costNormal = calcCost(form.items, 'qty_normal', ingredients, baseRecipes)
        await supabase.from('recipes').update({ cost_per_cup_lak: Math.round(costNormal) }).eq('id', form.recipe_id)
        setFormulas(prev => editId === 'new' ? [...prev, saved] : prev.map(f => f.id === editId ? saved : f))
        setEditId(null); setMsg('บันทึกแล้ว')
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      }
    }

    const sweetnessFields: { field: 'qty_less' | 'qty_normal' | 'qty_more'; label: string }[] = [
      { field: 'qty_less',   label: 'หวานน้อย' },
      { field: 'qty_normal', label: 'หวานกลาง' },
      { field: 'qty_more',   label: 'หวานมาก'  },
    ]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionCard title="สร้าง / แก้ไข สูตร" action={<button style={btnStyle(GOLD)} onClick={startNew}>+ สร้างสูตรใหม่</button>}>
          {editId !== null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="เมนู">
                  <select style={inputStyle} value={form.recipe_id} onChange={e => setForm(f => ({ ...f, recipe_id: e.target.value }))}>
                    {menuItems.length === 0 && <option value="">— ยังไม่มีเมนู —</option>}
                    {menuItems.map(m => <option key={m.id} value={m.id}>{m.product_name}</option>)}
                  </select>
                </Field>
                <Field label="เป้าหมาย Gross Margin (%)">
                  <input style={inputStyle} type="number" min={0} max={99} value={form.target_margin} onChange={e => setForm(f => ({ ...f, target_margin: parseFloat(e.target.value) || 0 }))} />
                </Field>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase' }}>ส่วนผสมในสูตร</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={btnStyleSm('#333')} onClick={addRawItem} disabled={ingredients.length === 0}>+ วัตถุดิบ</button>
                    <button style={btnStyleSm(GOLD + '22', GOLD)} onClick={addBaseItem} disabled={baseRecipes.length === 0}
                      title={baseRecipes.length === 0 ? 'สร้างสูตรพื้นฐานก่อน' : ''}>+ สูตรพื้นฐาน</button>
                  </div>
                </div>
                {form.items.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                    {ingredients.length === 0 ? 'เพิ่มวัตถุดิบในแท็บ "วัตถุดิบ" ก่อน' : 'กด "+ วัตถุดิบ" หรือ "+ สูตรพื้นฐาน" เพื่อใส่ส่วนผสม'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', padding: '0 4px' }}>
                      <span>ส่วนผสม</span><span>หวานน้อย</span><span>หวานกลาง</span><span>หวานมาก</span><span></span>
                    </div>
                    {form.items.map((item, idx) => {
                      const isBase   = !!item.base_id
                      const unitLabel = isBase
                        ? (baseRecipes.find(b => b.id === item.base_id)?.unit ?? '')
                        : (ingredients.find(i => i.id === item.ingredient_id)?.unit ?? '')
                      return (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isBase && (
                              <span style={{ fontSize: 10, backgroundColor: GOLD + '22', color: GOLD, padding: '2px 6px', borderRadius: 4, flexShrink: 0, fontWeight: 600 }}>สูตร</span>
                            )}
                            <select style={{ ...inputStyle, flex: 1 }}
                              value={isBase ? item.base_id : item.ingredient_id}
                              onChange={e => updateItem(idx, isBase ? { base_id: e.target.value } : { ingredient_id: e.target.value })}>
                              {isBase
                                ? baseRecipes.map(b => <option key={b.id} value={b.id}>{b.name} ({b.unit})</option>)
                                : ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)
                              }
                            </select>
                          </div>
                          {(['qty_less', 'qty_normal', 'qty_more'] as const).map(field => (
                            <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <input style={{ ...inputStyle, flex: 1 }} type="number" min={0} value={item[field]}
                                onChange={e => updateItem(idx, { [field]: parseFloat(e.target.value) || 0 })} />
                              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{unitLabel}</span>
                            </div>
                          ))}
                          <button style={btnStyleSm(RED + '22', RED)} onClick={() => removeItem(idx)}>✕</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {form.items.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {sweetnessFields.map(({ field, label }) => {
                    const cost = calcCost(form.items, field, ingredients, baseRecipes)
                    return (
                      <div key={field} style={{ backgroundColor: CARD2, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{label}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>{cost.toFixed(0)} ₭</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>ต้นทุน/แก้ว</div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnStyle(GOLD)} onClick={save}>บันทึกสูตร</button>
                <button style={btnStyle('#333')} onClick={() => setEditId(null)}>ยกเลิก</button>
              </div>
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>คลิก &ldquo;+ สร้างสูตรใหม่&rdquo; หรือกดแก้ไขสูตรที่มีอยู่</div>
          )}
        </SectionCard>

        {formulas.length > 0 && (
          <SectionCard title={`สูตรทั้งหมด (${formulas.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {formulas.map(f => {
                const cost    = calcCost(f.items, 'qty_normal', ingredients, baseRecipes)
                const hasBase = f.items.some(i => i.base_id)
                return (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: CARD2, borderRadius: 10, padding: '14px 16px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{f.recipe_name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                        {f.items.length} ส่วนผสม · ต้นทุนหวานกลาง: <span style={{ color: GOLD }}>{cost.toFixed(0)} ₭</span>
                        {hasBase && <span style={{ color: GOLD + 'aa', marginLeft: 8 }}>· มีสูตรพื้นฐาน</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={btnStyleSm(GOLD)} onClick={() => startEdit(f)}>แก้ไข</button>
                      <button style={btnStyleSm(RED + '22', RED)} onClick={async () => { await removeFormula(f.id); setFormulas(prev => prev.filter(x => x.id !== f.id)); setMsg('ลบแล้ว') }}>ลบ</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}
      </div>
    )
  }

  // ── Pricing Advisor Panel ─────────────────────────────────────────────────
  function PricingPanel() {
    const [globalMargin, setGlobalMargin] = useState(60)
    const [vatEnabled,   setVatEnabled]   = useState(false)
    const [vatRate,      setVatRate]      = useState(10)
    const [expanded,     setExpanded]     = useState<string | null>(null)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionCard title="ตั้งค่า Margin และ VAT">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, alignItems: 'end' }}>
            <Field label="Gross Margin เป้าหมาย (%)">
              <input style={inputStyle} type="number" min={0} max={99} value={globalMargin}
                onChange={e => setGlobalMargin(parseFloat(e.target.value) || 0)} />
            </Field>
            <Field label="คิด VAT หรือไม่">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 38 }}>
                <button onClick={() => setVatEnabled(v => !v)} style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative',
                  backgroundColor: vatEnabled ? GOLD : 'rgba(255,255,255,0.12)', transition: 'background .2s',
                }}>
                  <span style={{
                    position: 'absolute', top: 3, left: vatEnabled ? 25 : 3,
                    width: 20, height: 20, borderRadius: '50%',
                    backgroundColor: vatEnabled ? BLACK : 'rgba(255,255,255,0.5)',
                    transition: 'left .2s',
                  }} />
                </button>
                <span style={{ fontSize: 13, color: vatEnabled ? GOLD : 'rgba(255,255,255,0.4)' }}>
                  {vatEnabled ? 'มี VAT' : 'ไม่มี VAT'}
                </span>
              </div>
            </Field>
            <Field label="อัตรา VAT (%)">
              <input style={{ ...inputStyle, opacity: vatEnabled ? 1 : 0.35 }} type="number"
                min={0} max={50} value={vatRate} disabled={!vatEnabled}
                onChange={e => setVatRate(parseFloat(e.target.value) || 0)} />
            </Field>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            แถวที่ Margin ต่ำกว่าเป้าจะแสดงเป็นสีแดง · คลิกแถวเพื่อดูรายละเอียดราคา
          </div>
        </SectionCard>

        {formulas.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', padding: '60px 0', fontSize: 14 }}>
            ยังไม่มีสูตร — ไปสร้างสูตรในแท็บ &ldquo;สร้างสูตร&rdquo; ก่อน
          </div>
        ) : (
          <SectionCard title="ราคาแนะนำ vs ราคาจริง">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: vatEnabled ? '2fr 1fr 1fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                <span>เมนู</span>
                <span>ต้นทุน/แก้ว</span>
                <span>แนะนำ (ไม่รวม VAT)</span>
                {vatEnabled && <span>แนะนำ (รวม VAT)</span>}
                <span>ราคาจริง</span>
                <span>Margin จริง</span>
              </div>
              {formulas.map(f => {
                const cost         = calcCost(f.items, 'qty_normal', ingredients, baseRecipes)
                const target       = f.target_margin > 0 ? f.target_margin : globalMargin
                const suggestedEx  = target < 100 ? cost / (1 - target / 100) : 0
                const suggestedInc = suggestedEx * (1 + vatRate / 100)
                const actualMargin = f.price_lak > 0 ? ((f.price_lak - cost) / f.price_lak) * 100 : 0
                const isBad        = actualMargin < target
                const isOpen       = expanded === f.id
                const profit       = suggestedEx - cost
                const vatAmt       = suggestedEx * (vatRate / 100)

                return (
                  <div key={f.id} style={{ marginBottom: 2 }}>
                    <div
                      onClick={() => setExpanded(isOpen ? null : f.id)}
                      style={{ display: 'grid', gridTemplateColumns: vatEnabled ? '2fr 1fr 1fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '14px 12px', borderRadius: isOpen ? '8px 8px 0 0' : 8, backgroundColor: isBad ? `${RED}0d` : CARD2, border: `1px solid ${isBad ? RED + '33' : isOpen ? BORDER : 'transparent'}`, borderBottom: isOpen ? 'none' : undefined, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{f.recipe_name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>เป้า {target}%{vatEnabled ? ` · VAT ${vatRate}%` : ''}</div>
                      </div>
                      <span style={{ color: GOLD }}>{cost.toFixed(0)} ₭</span>
                      <span style={{ color: GREEN }}>{suggestedEx.toFixed(0)} ₭</span>
                      {vatEnabled && <span style={{ color: GREEN, fontWeight: 700 }}>{suggestedInc.toFixed(0)} ₭</span>}
                      <span>{f.price_lak.toLocaleString()} ₭</span>
                      <span style={{ color: isBad ? RED : GREEN, fontWeight: 700 }}>{actualMargin.toFixed(1)}%</span>
                    </div>

                    {isOpen && (
                      <div style={{ backgroundColor: isBad ? `${RED}08` : '#1e1e1e', border: `1px solid ${isBad ? RED + '22' : BORDER}`, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '16px 18px' }}>
                        <div style={{ fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 12 }}>รายละเอียดราคา (หวานกลาง)</div>

                        {/* Per-component breakdown */}
                        <div style={{ marginBottom: 12, padding: '10px 12px', backgroundColor: `${GOLD}08`, borderRadius: 6, border: `1px solid ${GOLD}22` }}>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>ส่วนผสม</div>
                          {f.items.map((item, idx) => {
                            if (item.base_id) {
                              const base = baseRecipes.find(b => b.id === item.base_id)
                              if (!base) return null
                              const baseYield = base.items.reduce((s, i) => s + i.qty, 0)
                              const cpUnit    = baseYield > 0 ? calcBaseCost(base, ingredients) / baseYield : 0
                              const itemCost = cpUnit * item.qty_normal
                              return (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 3 }}>
                                  <span style={{ color: GOLD }}>🧪 {base.name} × {item.qty_normal}{base.unit} <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>({cpUnit.toFixed(3)}₭/{base.unit})</span></span>
                                  <span style={{ color: GOLD }}>{itemCost.toFixed(0)} ₭</span>
                                </div>
                              )
                            }
                            const ing      = ingredients.find(i => i.id === item.ingredient_id)
                            if (!ing) return null
                            const itemCost = (ing.pkg_cost / ing.pkg_size) * item.qty_normal
                            return (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 3 }}>
                                <span>{ing.name} × {item.qty_normal}{ing.unit}</span>
                                <span>{itemCost.toFixed(0)} ₭</span>
                              </div>
                            )
                          })}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[
                            { label: 'ต้นทุน',           value: cost,         color: RED   },
                            { label: 'กำไร (Margin)',     value: profit,       color: GREEN },
                            { label: 'ราคาก่อน VAT',     value: suggestedEx,  color: '#fff' },
                            ...(vatEnabled ? [
                              { label: `VAT ${vatRate}%`, value: vatAmt,       color: ORANGE },
                              { label: 'ราคาสุดท้าย',    value: suggestedInc, color: GOLD   },
                            ] : []),
                          ].map((row, i, arr) => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 6, backgroundColor: i === arr.length - 1 ? `${GOLD}12` : 'transparent', borderTop: i === arr.length - 1 && vatEnabled ? `1px solid ${BORDER}` : 'none' }}>
                              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{row.label}</span>
                              <span style={{ fontSize: 14, fontWeight: i === arr.length - 1 ? 700 : 500, color: row.color }}>{row.value.toFixed(0)} ₭</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}
      </div>
    )
  }

  const subs: { id: SubTab; label: string }[] = [
    { id: 'ingredients', label: 'วัตถุดิบ'     },
    { id: 'bases',       label: 'สูตรพื้นฐาน' },
    { id: 'recipes',     label: 'สร้างสูตร'    },
    { id: 'pricing',     label: 'แนะนำราคา'   },
  ]

  return (
    <div>
      <Toast msg={msg} />
      <div style={{ display: 'flex', marginBottom: 28, borderBottom: `1px solid ${BORDER}` }}>
        {subs.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)} style={{
            padding: '8px 22px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            backgroundColor: 'transparent',
            color: sub === s.id ? GOLD : 'rgba(255,255,255,0.4)',
            borderBottom: sub === s.id ? `2px solid ${GOLD}` : '2px solid transparent',
            marginBottom: -1,
          }}>{s.label}</button>
        ))}
      </div>
      {sub === 'ingredients' && <IngredientsPanel />}
      {sub === 'bases'       && <BaseRecipesPanel />}
      {sub === 'recipes'     && <RecipesPanel />}
      {sub === 'pricing'     && <PricingPanel />}
    </div>
  )
}
