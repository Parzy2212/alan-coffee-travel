'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  GOLD, BLACK, CARD, CARD2, BORDER, RED, GREEN, ORANGE,
  inputStyle, btnStyle, btnStyleSm,
  Toast, SectionCard, Field,
} from '@/components/cafe/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

type InvItem    = { id: string; name: string; name_th: string | null; unit: string; cost_per_unit: number | null; current_qty: number }
type BaseRecipe = { id: string; name: string; unit: string; total_yield: number }
type BaseIng    = { base_id: string; inventory_id: string; qty_required: number }

// ─── RecipeCostTab ────────────────────────────────────────────────────────────

export default function RecipeCostTab() {
  type SubTab = 'ingredients' | 'bases' | 'recipes' | 'pricing'

  const [sub,          setSub]         = useState<SubTab>('ingredients')
  const [inventory,    setInventory]   = useState<InvItem[]>([])
  const [baseRecipes,  setBaseRecipes] = useState<BaseRecipe[]>([])
  const [baseIngs,     setBaseIngs]    = useState<BaseIng[]>([])
  const [msg,          setMsg]         = useState<string | null>(null)

  // Overhead from site_settings
  const [packagingPerCup, setPackagingPerCup] = useState(0)
  const [icePerCup,       setIcePerCup]       = useState(0)
  const [overheadPerCup,  setOverheadPerCup]  = useState(0)

  const loadInventory = useCallback(() => {
    supabase.from('inventory')
      .select('id, name, name_th, unit, cost_per_unit, current_qty')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { if (data) setInventory(data as InvItem[]) })
  }, [])

  const loadBases = useCallback(() => {
    supabase.from('recipe_bases').select('id, name, unit, total_yield').order('name')
      .then(({ data }) => { if (data) setBaseRecipes(data as BaseRecipe[]) })
    supabase.from('recipe_base_ingredients').select('base_id, inventory_id, qty_required')
      .then(({ data }) => { if (data) setBaseIngs(data as BaseIng[]) })
  }, [])

  function loadOverhead() {
    supabase.rpc('get_site_settings').then(({ data }) => {
      if (!data) return
      const s = data as Record<string, string>
      const n = (k: string, d = 0) => parseFloat(s[k] ?? '') || d
      const bagContrib   = n('cost_bag') * (n('cost_bag_pct') / 100)
      const basePkg      = n('cost_cup_lid', 2500) + n('cost_straw', 210) + bagContrib + n('cost_other_pkg')
      const pkg          = Math.round(basePkg * (1 + n('cost_waste_pct', 15) / 100))
      const usableKg     = 30 * (1 - n('cost_ice_melt_pct', 30) / 100)
      const cpg          = usableKg > 0 ? n('cost_ice_bag_price', 20000) / (usableKg * 1000) : 0
      const ice          = Math.round(cpg * n('cost_ice_per_cup_g', 175))
      const consumables  = (() => { try { const p = JSON.parse(s['overhead_consumables_json'] ?? ''); if (Array.isArray(p)) return p } catch {} return [] })()
      const others       = (() => { try { const p = JSON.parse(s['overhead_other_json'] ?? ''); if (Array.isArray(p)) return p } catch {} return [] })()
      const totalItemized = [...consumables, ...others].reduce((a: number, i: { amount?: number }) => a + (i.amount ?? 0), 0)
      const totalOH      = n('overhead_rent') + n('overhead_electric') + n('overhead_water') + n('overhead_internet') + n('overhead_salary') + totalItemized
      const targetCups   = Math.max(n('target_cups_month', 500) || 500, 1)
      setPackagingPerCup(pkg)
      setIcePerCup(ice)
      setOverheadPerCup(Math.round(totalOH / targetCups))
    })
  }

  useEffect(() => {
    loadInventory()
    loadBases()
    loadOverhead()
  }, [loadInventory, loadBases])

  // ── Cost helpers ─────────────────────────────────────────────────────────

  function baseCostPerUnit(baseId: string): number {
    const base = baseRecipes.find(b => b.id === baseId)
    if (!base || base.total_yield <= 0) return 0
    const cost = baseIngs
      .filter(bi => bi.base_id === baseId)
      .reduce((s, bi) => {
        const inv = inventory.find(i => i.id === bi.inventory_id)
        return s + (inv?.cost_per_unit ?? 0) * bi.qty_required
      }, 0)
    return cost / base.total_yield
  }

  // ── Ingredients Panel (read-only inventory view) ──────────────────────────

  function IngredientsPanel() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>วัตถุดิบในสต็อก</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
              ราคาต่อหน่วยอัปเดตอัตโนมัติเมื่อมีการซื้อสต็อก — แก้ไขที่แท็บ &ldquo;สต็อก&rdquo;
            </div>
          </div>
          <button style={{ ...btnStyle('#333'), fontSize: 12 }} onClick={loadInventory}>↺ รีเฟรช</button>
        </div>

        <SectionCard title={`วัตถุดิบ (${inventory.length} รายการ)`}>
          {inventory.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              ยังไม่มีวัตถุดิบ — เพิ่มในแท็บ &ldquo;สต็อก&rdquo;
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 1fr 1fr', gap: 12, padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                <span>ชื่อ</span><span>หน่วย</span><span>ต้นทุน/หน่วย</span><span>คงเหลือ</span>
              </div>
              {inventory.map(item => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 1fr 1fr', gap: 12, padding: '12px', borderRadius: 8, backgroundColor: CARD2, alignItems: 'center', fontSize: 14 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name_th || item.name}</div>
                    {item.name_th && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{item.name}</div>}
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{item.unit}</span>
                  <span style={{ color: item.cost_per_unit ? GOLD : 'rgba(255,255,255,0.25)', fontWeight: item.cost_per_unit ? 700 : 400 }}>
                    {item.cost_per_unit != null ? item.cost_per_unit.toFixed(2) + ' ₭' : '—'}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {item.current_qty.toLocaleString()} {item.unit}
                  </span>
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
    type BaseIngForm = { inventory_id: string; qty_required: string }
    type BaseForm    = { name: string; unit: string; items: BaseIngForm[] }

    const [editId, setEditId] = useState<string | null>(null)
    const [form,   setForm]   = useState<BaseForm>({ name: '', unit: 'ml', items: [] })
    const [saving, setSaving] = useState(false)

    function startNew() {
      setEditId('new')
      setForm({ name: '', unit: 'ml', items: [] })
    }

    async function startEdit(b: BaseRecipe) {
      setEditId(b.id)
      const { data } = await supabase.from('recipe_base_ingredients')
        .select('inventory_id, qty_required')
        .eq('base_id', b.id)
      setForm({
        name: b.name,
        unit: b.unit,
        items: ((data ?? []) as { inventory_id: string; qty_required: number }[])
          .map(r => ({ inventory_id: r.inventory_id, qty_required: String(r.qty_required) })),
      })
    }

    function addItem() {
      if (!inventory.length) return
      setForm(f => ({ ...f, items: [...f.items, { inventory_id: inventory[0].id, qty_required: '0' }] }))
    }

    function updateItem(idx: number, patch: Partial<BaseIngForm>) {
      setForm(f => { const items = [...f.items]; items[idx] = { ...items[idx], ...patch }; return { ...f, items } })
    }

    function removeItem(idx: number) {
      setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
    }

    async function save() {
      if (!form.name) { setMsg('กรอกชื่อสูตรพื้นฐาน'); return }
      setSaving(true)
      try {
        const totalYield = form.items.reduce((s, i) => s + (parseFloat(i.qty_required) || 0), 0)
        let baseId: string

        if (editId === 'new') {
          const { data, error } = await supabase.from('recipe_bases')
            .insert({ name: form.name, unit: form.unit, total_yield: totalYield })
            .select('id').single()
          if (error) throw new Error('ไม่สามารถบันทึกได้: ' + error.message)
          baseId = (data as { id: string }).id
        } else {
          baseId = editId!
          const { error } = await supabase.from('recipe_bases')
            .update({ name: form.name, unit: form.unit, total_yield: totalYield })
            .eq('id', baseId)
          if (error) throw new Error('ไม่สามารถอัปเดตได้: ' + error.message)
          await supabase.from('recipe_base_ingredients').delete().eq('base_id', baseId)
        }

        if (form.items.length > 0) {
          const rows = form.items.map(i => ({
            base_id:      baseId,
            inventory_id: i.inventory_id,
            qty_required: parseFloat(i.qty_required) || 0,
          }))
          const { error } = await supabase.from('recipe_base_ingredients').insert(rows)
          if (error) throw new Error('ไม่สามารถบันทึกส่วนผสมได้: ' + error.message)
        }

        loadBases()
        setEditId(null)
        setMsg('บันทึกสูตรพื้นฐานแล้ว')
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      } finally { setSaving(false) }
    }

    async function deleteBase(id: string) {
      await supabase.from('recipe_base_ingredients').delete().eq('base_id', id)
      const { error } = await supabase.from('recipe_bases').delete().eq('id', id)
      if (error) { setMsg('เกิดข้อผิดพลาด: ' + error.message); return }
      setBaseRecipes(prev => prev.filter(b => b.id !== id))
      setBaseIngs(prev => prev.filter(bi => bi.base_id !== id))
      setMsg('ลบแล้ว')
    }

    // Live cost preview for the form being edited
    const previewCost = form.items.reduce((s, item) => {
      const inv = inventory.find(i => i.id === item.inventory_id)
      return s + (inv?.cost_per_unit ?? 0) * (parseFloat(item.qty_required) || 0)
    }, 0)
    const autoYield  = form.items.reduce((s, i) => s + (parseFloat(i.qty_required) || 0), 0)
    const cpUnit     = autoYield > 0 ? previewCost / autoYield : 0

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
                  <button style={btnStyleSm('#333')} onClick={addItem} disabled={inventory.length === 0}>
                    + เพิ่มวัตถุดิบ
                  </button>
                </div>
                {form.items.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                    {inventory.length === 0 ? 'ยังไม่มีวัตถุดิบในสต็อก' : 'กด "+ เพิ่มวัตถุดิบ" เพื่อใส่ส่วนผสม'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', padding: '0 4px' }}>
                      <span>วัตถุดิบ</span><span>ปริมาณ</span><span>ต้นทุน</span><span></span>
                    </div>
                    {form.items.map((item, idx) => {
                      const inv      = inventory.find(i => i.id === item.inventory_id)
                      const qty      = parseFloat(item.qty_required) || 0
                      const itemCost = (inv?.cost_per_unit ?? 0) * qty
                      return (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'center' }}>
                          <select style={inputStyle} value={item.inventory_id} onChange={e => updateItem(idx, { inventory_id: e.target.value })}>
                            {inventory.map(i => <option key={i.id} value={i.id}>{i.name_th || i.name} ({i.unit})</option>)}
                          </select>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input style={{ ...inputStyle, flex: 1 }} type="number" min={0} value={item.qty_required}
                              onChange={e => updateItem(idx, { qty_required: e.target.value })} />
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{inv?.unit ?? ''}</span>
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
                  {[
                    { label: 'ปริมาณรวม', value: autoYield.toLocaleString() + ' ' + form.unit, sub: '= ผลรวมส่วนผสม' },
                    { label: 'ต้นทุนรวม',  value: previewCost.toFixed(0) + ' ₭',               sub: 'ทั้งหมด' },
                    { label: 'ราคาต่อหน่วย', value: cpUnit.toFixed(3) + ' ₭/' + form.unit,     sub: 'คำนวณอัตโนมัติ' },
                  ].map(card => (
                    <div key={card.label} style={{ backgroundColor: CARD2, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{card.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>{card.value}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{card.sub}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...btnStyle(GOLD), opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึกสูตร'}
                </button>
                <button style={btnStyle('#333')} onClick={() => setEditId(null)}>ยกเลิก</button>
              </div>
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              เช่น &ldquo;นมมิกซ์&rdquo; (นมสด + นมข้น) — ใช้ซ้ำในหลายสูตรได้
            </div>
          )}
        </SectionCard>

        {baseRecipes.length > 0 && (
          <SectionCard title={`สูตรพื้นฐานทั้งหมด (${baseRecipes.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                <span>ชื่อ</span><span>หน่วย</span><span>ปริมาณที่ได้</span><span>ราคา/หน่วย</span><span></span>
              </div>
              {baseRecipes.map(b => {
                const cpu = baseCostPerUnit(b.id)
                return (
                  <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, padding: '12px', borderRadius: 8, backgroundColor: CARD2, alignItems: 'center', fontSize: 14 }}>
                    <span style={{ fontWeight: 600 }}>{b.name}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{b.unit}</span>
                    <span>{b.total_yield.toLocaleString()} {b.unit}</span>
                    <span style={{ color: cpu > 0 ? GOLD : 'rgba(255,255,255,0.25)', fontWeight: 700 }}>
                      {cpu > 0 ? cpu.toFixed(3) + ' ₭/' + b.unit : '—'}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={btnStyleSm(GOLD)} onClick={() => startEdit(b)}>แก้ไข</button>
                      <button style={btnStyleSm(RED + '22', RED)} onClick={() => deleteBase(b.id)}>ลบ</button>
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

  // ── Formula Builder Panel ─────────────────────────────────────────────────

  function FormulaPanel() {
    type RIForm = { inventory_id: string | null; base_id: string | null; qty_normal: string; qty_less: string; qty_more: string }
    type MenuItem = { id: string; product_name: string; product_name_th: string | null; price_lak: number; uses_ice: boolean }

    const [menuItems, setMenuItems] = useState<MenuItem[]>([])
    const [recipeId,  setRecipeId]  = useState('')
    const [usesIce,   setUsesIce]   = useState(false)
    const [items,     setItems]     = useState<RIForm[]>([])
    const [saving,    setSaving]    = useState(false)
    const [loaded,    setLoaded]    = useState(false)

    useEffect(() => {
      supabase.from('recipes')
        .select('id, product_name, product_name_th, price_lak, uses_ice')
        .eq('is_active', true)
        .neq('is_archived', true)
        .order('product_name_th')
        .then(({ data }) => {
          const rows = (data ?? []) as MenuItem[]
          setMenuItems(rows)
          if (rows.length > 0) setRecipeId(rows[0].id)
          setLoaded(true)
        })
    }, [])

    useEffect(() => {
      if (!recipeId || !loaded) return
      const menu = menuItems.find(m => m.id === recipeId)
      setUsesIce(menu?.uses_ice ?? false)
      supabase.from('recipe_ingredients')
        .select('id, inventory_id, base_id, qty_normal, qty_less, qty_more')
        .eq('recipe_id', recipeId)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setItems((data as { inventory_id: string | null; base_id: string | null; qty_normal: number; qty_less: number; qty_more: number }[])
              .map(r => ({
                inventory_id: r.inventory_id,
                base_id:      r.base_id,
                qty_normal:   String(r.qty_normal),
                qty_less:     String(r.qty_less),
                qty_more:     String(r.qty_more),
              })))
          } else {
            setItems([])
          }
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recipeId, loaded])

    function addIngItem() {
      if (!inventory.length) return
      setItems(prev => [...prev, { inventory_id: inventory[0].id, base_id: null, qty_normal: '0', qty_less: '0', qty_more: '0' }])
    }

    function addBaseItem() {
      if (!baseRecipes.length) return
      setItems(prev => [...prev, { inventory_id: null, base_id: baseRecipes[0].id, qty_normal: '0', qty_less: '0', qty_more: '0' }])
    }

    function updateItem(idx: number, patch: Partial<RIForm>) {
      setItems(prev => { const next = [...prev]; next[idx] = { ...next[idx], ...patch }; return next })
    }

    function itemCost(item: RIForm, field: 'qty_normal' | 'qty_less' | 'qty_more'): number {
      const qty = parseFloat(item[field]) || 0
      if (item.base_id) return baseCostPerUnit(item.base_id) * qty
      const inv = inventory.find(i => i.id === item.inventory_id)
      return (inv?.cost_per_unit ?? 0) * qty
    }

    function totalCost(field: 'qty_normal' | 'qty_less' | 'qty_more'): number {
      return items.reduce((s, item) => s + itemCost(item, field), 0)
    }

    async function save() {
      if (!recipeId) { setMsg('เลือกเมนูก่อน'); return }
      setSaving(true)
      try {
        // Persist uses_ice
        await supabase.from('recipes').update({ uses_ice: usesIce }).eq('id', recipeId)

        // Replace all recipe_ingredients for this recipe
        await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId)

        if (items.length > 0) {
          const rows = items.map(item => ({
            recipe_id:    recipeId,
            inventory_id: item.inventory_id,
            base_id:      item.base_id,
            qty_normal:   parseFloat(item.qty_normal) || 0,
            qty_less:     parseFloat(item.qty_less)   || 0,
            qty_more:     parseFloat(item.qty_more)   || 0,
          }))
          const { error } = await supabase.from('recipe_ingredients').insert(rows)
          if (error) throw new Error('ไม่สามารถบันทึกสูตรได้: ' + error.message)
        }

        // Update cost_per_cup_lak (normal sweetness)
        const ingCost   = totalCost('qty_normal')
        const fixedCost = packagingPerCup + (usesIce ? icePerCup : 0) + overheadPerCup
        await supabase.from('recipes').update({ cost_per_cup_lak: Math.round(ingCost + fixedCost) }).eq('id', recipeId)

        setMsg('บันทึกสูตรแล้ว')
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      } finally { setSaving(false) }
    }

    const menu = menuItems.find(m => m.id === recipeId)
    const levels: { key: 'qty_less' | 'qty_normal' | 'qty_more'; label: string; color: string }[] = [
      { key: 'qty_less',   label: '🔵 น้อย', color: '#4a9eff' },
      { key: 'qty_normal', label: '🟡 กลาง', color: GOLD      },
      { key: 'qty_more',   label: '🔴 มาก',  color: '#ff6b6b' },
    ]

    if (!loaded) return (
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, padding: '60px 0', textAlign: 'center' }}>กำลังโหลด...</div>
    )

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Menu selector ── */}
        <div style={{ backgroundColor: CARD2, borderRadius: 14, padding: 20, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 10 }}>เลือกเมนู</div>
          {menuItems.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
              ยังไม่มีเมนู — ไปแท็บ &ldquo;เมนู&rdquo; แล้วเพิ่มเมนูก่อน
            </div>
          ) : (
            <select
              style={{ ...inputStyle, fontSize: 15, height: 50, fontWeight: 600 }}
              value={recipeId}
              onChange={e => setRecipeId(e.target.value)}
            >
              {menuItems.map(m => (
                <option key={m.id} value={m.id}>
                  {m.product_name_th || m.product_name} · {m.price_lak.toLocaleString()} ₭
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── uses_ice toggle ── */}
        {recipeId && (
          <div style={{ backgroundColor: CARD2, borderRadius: 12, padding: '16px 20px', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', flexShrink: 0 }}>เครื่องดื่มเย็น (มีน้ำแข็ง)</span>
            <div
              onClick={() => setUsesIce(v => !v)}
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative',
                backgroundColor: usesIce ? GOLD : 'rgba(255,255,255,0.12)', transition: 'background .2s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: usesIce ? 25 : 3,
                width: 20, height: 20, borderRadius: '50%',
                backgroundColor: usesIce ? BLACK : 'rgba(255,255,255,0.5)',
                transition: 'left .2s', display: 'block',
              }} />
            </div>
            <span style={{ fontSize: 13, color: usesIce ? '#4a9eff' : 'rgba(255,255,255,0.35)' }}>
              {usesIce ? `🧊 + ${icePerCup.toLocaleString()} ₭/แก้ว` : 'ปิด'}
            </span>
          </div>
        )}

        {/* ── Ingredient builder ── */}
        {recipeId && (
          <div style={{ backgroundColor: CARD, borderRadius: 14, padding: 20, border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase' }}>ส่วนผสมในสูตร</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnStyle('#333')} onClick={addIngItem} disabled={!inventory.length}>
                  ➕ วัตถุดิบ
                </button>
                <button
                  style={{ ...btnStyle(GOLD + '22'), color: GOLD }}
                  onClick={addBaseItem}
                  disabled={!baseRecipes.length}
                  title={!baseRecipes.length ? 'สร้างสูตรพื้นฐานในแท็บ "สูตรพื้นฐาน" ก่อน' : undefined}
                >
                  ➕ สูตรพื้นฐาน
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div style={{ padding: '36px 0', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
                กดปุ่มด้านบนเพื่อเพิ่มส่วนผสม
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {items.map((item, idx) => {
                  const isBase = item.base_id !== null
                  const base   = isBase ? baseRecipes.find(b => b.id === item.base_id) : undefined
                  const inv    = !isBase ? inventory.find(i => i.id === item.inventory_id) : undefined
                  const unit   = isBase ? (base?.unit ?? '') : (inv?.unit ?? '')
                  const cpu    = isBase ? baseCostPerUnit(item.base_id!) : (inv?.cost_per_unit ?? 0)

                  return (
                    <div key={idx} style={{ backgroundColor: CARD2, borderRadius: 12, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        {isBase && (
                          <span style={{ fontSize: 10, backgroundColor: GOLD + '22', color: GOLD, padding: '2px 7px', borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>สูตรพื้นฐาน</span>
                        )}
                        <select
                          style={{ ...inputStyle, flex: 1, fontWeight: 600 }}
                          value={isBase ? (item.base_id ?? '') : (item.inventory_id ?? '')}
                          onChange={e => updateItem(idx, isBase ? { base_id: e.target.value } : { inventory_id: e.target.value })}
                        >
                          {isBase
                            ? baseRecipes.map(b => <option key={b.id} value={b.id}>{b.name} ({b.unit})</option>)
                            : inventory.map(i => <option key={i.id} value={i.id}>{i.name_th || i.name} ({i.unit})</option>)
                          }
                        </select>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {cpu.toFixed(2)} ₭/{unit}
                        </span>
                        <button
                          onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                        >✕</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        {levels.map(lv => {
                          const cost = cpu * (parseFloat(item[lv.key]) || 0)
                          return (
                            <div key={lv.key} style={{ backgroundColor: `${lv.color}12`, borderRadius: 10, padding: '10px 12px', border: `1px solid ${lv.color}28` }}>
                              <div style={{ fontSize: 11, color: lv.color, marginBottom: 6, fontWeight: 700 }}>{lv.label}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input
                                  style={{ ...inputStyle, flex: 1 }}
                                  type="number" min={0}
                                  value={item[lv.key]}
                                  onChange={e => updateItem(idx, { [lv.key]: e.target.value })}
                                />
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{unit}</span>
                              </div>
                              <div style={{ fontSize: 12, color: lv.color, marginTop: 6, fontWeight: 600 }}>{cost.toFixed(0)} ₭</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Fixed-cost banner ── */}
        {items.length > 0 && (packagingPerCup > 0 || overheadPerCup > 0) && (
          <div style={{ backgroundColor: CARD2, borderRadius: 12, padding: '12px 16px', border: `1px solid ${BORDER}`, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: GOLD, letterSpacing: '1px', textTransform: 'uppercase', flexShrink: 0 }}>ต้นทุน fixed ต่อแก้ว</span>
            {packagingPerCup > 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>📦 packaging {packagingPerCup.toLocaleString()} ₭</span>}
            {usesIce && icePerCup > 0 && <span style={{ fontSize: 12, color: '#4a9eff' }}>🧊 น้ำแข็ง {icePerCup.toLocaleString()} ₭</span>}
            {overheadPerCup > 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>🏠 overhead {overheadPerCup.toLocaleString()} ₭</span>}
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: ORANGE, flexShrink: 0 }}>
              fixed: {(packagingPerCup + (usesIce ? icePerCup : 0) + overheadPerCup).toLocaleString()} ₭
            </span>
          </div>
        )}

        {/* ── Cost summary per sweetness level ── */}
        {items.length > 0 && menu && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            {levels.map(lv => {
              const ingCost   = totalCost(lv.key)
              const fixedCost = packagingPerCup + (usesIce ? icePerCup : 0) + overheadPerCup
              const total     = ingCost + fixedCost
              const margin    = menu.price_lak > 0 ? ((menu.price_lak - total) / menu.price_lak) * 100 : 0
              const ok        = margin >= 60
              return (
                <div key={lv.key} style={{ backgroundColor: CARD2, borderRadius: 14, padding: 18, border: `2px solid ${ok ? GREEN + '50' : RED + '50'}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: lv.color, marginBottom: 14 }}>{lv.label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10, padding: '8px 10px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}><span>วัตถุดิบ</span><span>{ingCost.toFixed(0)} ₭</span></div>
                    {packagingPerCup > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}><span>📦 packaging</span><span>{packagingPerCup.toLocaleString()} ₭</span></div>}
                    {usesIce && icePerCup > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4a9eff' }}><span>🧊 น้ำแข็ง</span><span>{icePerCup.toLocaleString()} ₭</span></div>}
                    {overheadPerCup > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}><span>🏠 overhead</span><span>{overheadPerCup.toLocaleString()} ₭</span></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#fff', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4, marginTop: 2 }}><span>รวม</span><span>{total.toFixed(0)} ₭</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Margin จริง</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: ok ? GREEN : RED }}>{margin.toFixed(1)}%</div>
                  </div>
                  {menu.price_lak > 0 && menu.price_lak < total && (
                    <div style={{ marginTop: 12, backgroundColor: RED + '22', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: RED, fontWeight: 600, border: `1px solid ${RED}44` }}>
                      ⚠️ ราคาขายต่ำกว่าต้นทุน!
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Save button ── */}
        {recipeId && (
          <button
            style={{ ...btnStyle(GOLD), fontSize: 16, height: 56, borderRadius: 14, fontWeight: 800, letterSpacing: '0.5px', opacity: saving ? 0.6 : 1 }}
            disabled={saving}
            onClick={save}
          >
            {saving ? 'กำลังบันทึก...' : '✓ บันทึกสูตร'}
          </button>
        )}
      </div>
    )
  }

  // ── Pricing Panel ─────────────────────────────────────────────────────────

  function PricingPanel() {
    type PRow = { id: string; product_name: string; product_name_th: string | null; price_lak: number; cost_per_cup_lak: number | null; uses_ice: boolean }

    const [rows,         setRows]         = useState<PRow[]>([])
    const [loading,      setLoading]      = useState(true)
    const [globalMargin, setGlobalMargin] = useState(60)
    const [vatEnabled,   setVatEnabled]   = useState(false)
    const [vatRate,      setVatRate]      = useState(10)

    useEffect(() => {
      supabase.from('recipes')
        .select('id, product_name, product_name_th, price_lak, cost_per_cup_lak, uses_ice')
        .eq('is_active', true)
        .neq('is_archived', true)
        .order('product_name_th')
        .then(({ data }) => { if (data) setRows(data as PRow[]); setLoading(false) })
    }, [])

    function exportCsv() {
      const withCost = rows.filter(r => r.cost_per_cup_lak != null)
      const date = new Date().toISOString().slice(0, 10)
      const cc = (v: unknown) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s }
      const data = [
        ['ชื่อเมนู', 'เย็น/ร้อน', 'ต้นทุน/แก้ว (₭)', 'ราคาขาย (₭)', 'Margin %', 'สถานะ'],
        ...withCost.map(r => {
          const cost   = r.cost_per_cup_lak!
          const margin = r.price_lak > 0 ? Math.round(((r.price_lak - cost) / r.price_lak) * 100) : 0
          return [r.product_name_th || r.product_name, r.uses_ice ? 'เย็น' : 'ร้อน', cost, r.price_lak, margin + '%', margin >= globalMargin ? 'ดี' : 'ต่ำกว่าเป้า']
        }),
      ]
      const blob = new Blob(['\uFEFF' + data.map(row => row.map(cc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a'); a.href = url; a.download = `alan-pricing-${date}.csv`; a.click()
      URL.revokeObjectURL(url)
    }

    if (loading) return (
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, padding: '60px 0', textAlign: 'center' }}>กำลังโหลด...</div>
    )

    const withCost = rows.filter(r => r.cost_per_cup_lak != null)
    const noCost   = rows.filter(r => r.cost_per_cup_lak == null)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionCard title="ตั้งค่า Margin">
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 120px', gap: 16, alignItems: 'end' }}>
            <Field label="Gross Margin เป้า (%)">
              <input style={inputStyle} type="number" min={0} max={99} value={globalMargin}
                onChange={e => setGlobalMargin(parseFloat(e.target.value) || 0)} />
            </Field>
            <Field label="คิด VAT">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 38 }}>
                <div onClick={() => setVatEnabled(v => !v)} style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative',
                  backgroundColor: vatEnabled ? GOLD : 'rgba(255,255,255,0.12)', transition: 'background .2s',
                }}>
                  <span style={{ position: 'absolute', top: 3, left: vatEnabled ? 25 : 3, width: 20, height: 20, borderRadius: '50%', backgroundColor: vatEnabled ? BLACK : 'rgba(255,255,255,0.5)', transition: 'left .2s', display: 'block' }} />
                </div>
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
          <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            ต้นทุนต่อแก้วอัปเดตอัตโนมัติจาก DB เมื่อราคาซื้อหรือสูตรเปลี่ยน
          </div>
        </SectionCard>

        {noCost.length > 0 && (
          <div style={{ padding: '12px 16px', backgroundColor: ORANGE + '12', borderRadius: 10, border: `1px solid ${ORANGE}33`, fontSize: 13, color: ORANGE }}>
            {noCost.length} เมนูยังไม่มีสูตร: {noCost.slice(0, 5).map(r => r.product_name_th || r.product_name).join(', ')}{noCost.length > 5 ? ` +${noCost.length - 5} รายการ` : ''}
          </div>
        )}

        {withCost.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', padding: '60px 0', fontSize: 14 }}>
            ยังไม่มีสูตร — ไปสร้างสูตรในแท็บ &ldquo;สร้างสูตร&rdquo; ก่อน
          </div>
        ) : (
          <SectionCard
            title={`ราคา vs ต้นทุน (${withCost.length} เมนู)`}
            action={
              <button onClick={exportCsv} style={{ fontSize: 11, color: GREEN, background: 'none', border: `1px solid ${GREEN}44`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                ⬇ Export CSV
              </button>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: vatEnabled ? '2fr 1fr 1fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                <span>เมนู</span>
                <span>ต้นทุน/แก้ว</span>
                <span>ราคาขาย</span>
                {vatEnabled && <span>แนะนำ (รวม VAT)</span>}
                <span>Margin</span>
                <span>สถานะ</span>
              </div>
              {withCost.map(r => {
                const cost      = r.cost_per_cup_lak!
                const margin    = r.price_lak > 0 ? ((r.price_lak - cost) / r.price_lak) * 100 : 0
                const isBad     = margin < globalMargin
                const suggested = vatEnabled ? Math.round((cost / (1 - globalMargin / 100)) * (1 + vatRate / 100) / 1000) * 1000 : 0
                return (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: vatEnabled ? '2fr 1fr 1fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '12px', borderRadius: 8, backgroundColor: isBad ? `${RED}0d` : CARD2, border: `1px solid ${isBad ? RED + '33' : 'transparent'}`, alignItems: 'center', fontSize: 14 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.product_name_th || r.product_name}</div>
                      {r.uses_ice && <div style={{ fontSize: 11, color: '#4a9eff', marginTop: 2 }}>🧊 เย็น</div>}
                    </div>
                    <span style={{ color: GOLD, fontWeight: 700 }}>{cost.toLocaleString()} ₭</span>
                    <span>{r.price_lak.toLocaleString()} ₭</span>
                    {vatEnabled && <span style={{ color: GREEN }}>{suggested.toLocaleString()} ₭</span>}
                    <span style={{ color: isBad ? RED : GREEN, fontWeight: 700 }}>{margin.toFixed(1)}%</span>
                    <span style={{ fontSize: 12, color: isBad ? RED : GREEN }}>{isBad ? '⚠️ ต่ำกว่าเป้า' : '✓ ดี'}</span>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}
      </div>
    )
  }

  // ── Tab nav + render ──────────────────────────────────────────────────────

  const subs: { id: SubTab; label: string }[] = [
    { id: 'ingredients', label: 'วัตถุดิบ'     },
    { id: 'bases',       label: 'สูตรพื้นฐาน' },
    { id: 'recipes',     label: 'สร้างสูตร'    },
    { id: 'pricing',     label: 'ราคา & Margin' },
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
      {sub === 'recipes'     && <FormulaPanel />}
      {sub === 'pricing'     && <PricingPanel />}
    </div>
  )
}
