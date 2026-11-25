'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { authClient, dbErrorText } from '@/lib/supabase-auth'
import type { MenuVariantRow } from '@/components/cafe/MenuVariants'
import {
  GOLD, BLACK, CARD, CARD2, BORDER, RED, GREEN, ORANGE,
  inputStyle, btnStyle, btnStyleSm,
  Toast, SectionCard, Field,
} from '@/components/cafe/shared'
import { ShopCostPanel } from '@/components/cafe/ShopCostSection'

// ─── Types ────────────────────────────────────────────────────────────────────

type InvItem    = { id: string; name: string; name_th: string | null; unit: string; cost_per_unit: number | null; current_qty: number }
type BaseRecipe = { id: string; name: string; unit: string; yield_qty: number }
type BaseIng    = { base_id: string; inventory_id: string; qty: number }
// one row per menu variant from get_menu_costs (075); a NULL cost = an ingredient without a cost yet
export type MenuCostRow = { recipe_id: string; variant_id: string; kind: MenuVariantRow['kind']; price_lak: number; is_active: boolean
  line_count: number; cost_less: number | null; cost_normal: number | null; cost_more: number | null; cost_none: number | null }
const VARIANT_LABEL: Record<MenuVariantRow['kind'], string> = { default: 'ราคาเดียว', hot: 'ร้อน', iced: 'เย็น' }
const VARIANT_ORDER: Record<MenuVariantRow['kind'], number> = { default: 0, hot: 1, iced: 2 }

// ─── FormulaPanel ─────────────────────────────────────────────────────────────

// module level, not inside RecipeCostTab: a component declared inside another is remounted on every
// parent render (each toast), which wiped unsaved recipe lines and jumped back to the first menu item
function FormulaPanel({ inventory, baseRecipes, baseCostPerUnit, setMsg }: {
  inventory: InvItem[]; baseRecipes: BaseRecipe[]; baseCostPerUnit: (baseId: string) => number; setMsg: (m: string) => void
}) {
  // qty_less / qty_more '' = same as normal (stored NULL; 075)
  type RIForm = { inventory_id: string | null; base_id: string | null; variant_id: string | null; qty_normal: string; qty_less: string; qty_more: string }
  type MenuItem = { id: string; product_name: string; product_name_th: string | null; price_lak: number }

  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [recipeId,  setRecipeId]  = useState('')
  const [variants,  setVariants]  = useState<MenuVariantRow[]>([])
  const [items,     setItems]     = useState<RIForm[]>([])
  const [costs,     setCosts]     = useState<MenuCostRow[] | null>(null)
  const [costErr,   setCostErr]   = useState<string | null>(null)
  const [loadErr,   setLoadErr]   = useState<string | null>(null)
  const [dirty,     setDirty]     = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [loaded,    setLoaded]    = useState(false)

  useEffect(() => {
    supabase.from('recipes')
      .select('id, product_name, product_name_th, price_lak')
      .eq('is_active', true)
      .neq('is_archived', true)
      .order('product_name_th')
      .then(({ data, error }) => {
        if (error) setLoadErr('โหลดรายการเมนูไม่ได้: ' + dbErrorText(error))
        const rows = (data ?? []) as MenuItem[]
        setMenuItems(rows)
        if (rows.length > 0) setRecipeId(rows[0].id)
        setLoaded(true)
      })
  }, [])

  const costReq = useRef(0)
  const loadCosts = useCallback((id: string) => {
    const req = ++costReq.current
    setCosts(null)
    authClient.rpc('get_menu_costs').then(({ data, error }) => {
      if (req !== costReq.current) return
      if (error) { setCostErr(dbErrorText(error)); setCosts([]); return }
      setCostErr(null)
      setCosts(((data ?? []) as MenuCostRow[]).filter(c => c.recipe_id === id))
    })
  }, [])

  useEffect(() => {
    if (!recipeId) return
    let cancelled = false
    setDirty(false)
    setLoadErr(null)
    void Promise.all([
      authClient.from('recipe_ingredients')
        .select('inventory_id, base_id, variant_id, qty_normal, qty_less, qty_more, sort_order')
        .eq('recipe_id', recipeId).order('sort_order'),
      supabase.from('menu_variants').select('id, recipe_id, kind, price_lak, is_active').eq('recipe_id', recipeId),
    ]).then(([ri, mv]) => {
      if (cancelled) return
      const err = ri.error ?? mv.error
      // a failed load must not show an empty recipe that a save would then wipe
      if (err) { setLoadErr('โหลดสูตรไม่ได้: ' + dbErrorText(err)); setItems([]); return }
      setVariants((mv.data ?? []) as MenuVariantRow[])
      const num = (v: number | null) => (v == null ? '' : String(Number(v)))
      setItems(((ri.data ?? []) as { inventory_id: string | null; base_id: string | null; variant_id: string | null; qty_normal: number; qty_less: number | null; qty_more: number | null }[])
        .map(r => ({ inventory_id: r.inventory_id, base_id: r.base_id, variant_id: r.variant_id,
          qty_normal: num(r.qty_normal), qty_less: num(r.qty_less), qty_more: num(r.qty_more) })))
    })
    loadCosts(recipeId)
    return () => { cancelled = true }
  }, [recipeId, loadCosts])

  const tempVariants = variants.filter(v => v.kind !== 'default' && (v.is_active || items.some(i => i.variant_id === v.id)))

  function edit(next: RIForm[]) { setItems(next); setDirty(true) }

  function addIngItem() {
    if (!inventory.length) return
    edit([...items, { inventory_id: inventory[0].id, base_id: null, variant_id: null, qty_normal: '', qty_less: '', qty_more: '' }])
  }

  function addBaseItem() {
    if (!baseRecipes.length) return
    edit([...items, { inventory_id: null, base_id: baseRecipes[0].id, variant_id: null, qty_normal: '', qty_less: '', qty_more: '' }])
  }

  function updateItem(idx: number, patch: Partial<RIForm>) {
    edit(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  async function save() {
    if (saving || !recipeId || loadErr) return
    if (items.length === 0) { setMsg('กรุณาเพิ่มส่วนผสมอย่างน้อย 1 รายการก่อนบันทึก'); return }
    const toNum = (s: string) => (s.trim() === '' ? null : Number(s))
    const payload = items.map(it => ({
      inventory_id: it.inventory_id, base_id: it.base_id, variant_id: it.variant_id,
      qty_normal: Number(it.qty_normal), qty_less: toNum(it.qty_less), qty_more: toNum(it.qty_more),
    }))
    const bad = payload.some(p => !(p.qty_normal > 0) || [p.qty_less, p.qty_more].some(q => q !== null && !(q >= 0)))
    if (bad) { setMsg('ทุกบรรทัดต้องใส่ปริมาณ "กลาง" มากกว่า 0 (น้อย/มาก เว้นว่างได้ = เท่ากลาง)'); return }
    setSaving(true)
    const { error } = await authClient.rpc('save_recipe_lines', { p_recipe_id: recipeId, p_items: payload })
    setSaving(false)
    if (error) { setMsg('บันทึกสูตรไม่ได้: ' + dbErrorText(error)); return }
    setDirty(false)
    setMsg('บันทึกสูตรแล้ว')
    loadCosts(recipeId)
  }

  const levels: { key: 'qty_less' | 'qty_normal' | 'qty_more'; label: string; name: string; color: string }[] = [
    { key: 'qty_less',   label: '🔵 น้อย', name: 'น้อย', color: '#4a9eff' },
    { key: 'qty_normal', label: '🟡 กลาง', name: 'กลาง', color: GOLD      },
    { key: 'qty_more',   label: '🔴 มาก',  name: 'มาก',  color: '#ff6b6b' },
  ]
  const costCards = (costs ?? []).filter(c => c.is_active).sort((a, b) => VARIANT_ORDER[a.kind] - VARIANT_ORDER[b.kind])

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
            disabled={saving}
            onChange={e => { if (!dirty || window.confirm('สูตรที่แก้ยังไม่ได้บันทึก เปลี่ยนเมนูแล้วจะหาย ต่อไหม?')) setRecipeId(e.target.value) }}
            aria-label="เลือกเมนู"
          >
            {menuItems.map(m => (
              <option key={m.id} value={m.id}>
                {m.product_name_th || m.product_name} · {m.price_lak.toLocaleString()} ₭
              </option>
            ))}
          </select>
        )}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 10, lineHeight: 1.5 }}>
          ใส่แก้ว ฝา หลอด และน้ำแข็งเป็นส่วนผสมในสูตรด้วย — ต้นทุนต่อแก้วคิดจากส่วนผสมในสูตรเท่านั้น (ค่าเช่า ค่าไฟ เงินเดือน อยู่ที่แท็บต้นทุนร้าน)
        </div>
      </div>

      {loadErr && <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: RED + '15', color: RED, fontSize: 13 }}>{loadErr} — ลองโหลดหน้าใหม่ (ปิดการบันทึกไว้ กันสูตรเดิมหาย)</div>}

      {/* ── Ingredient builder ── */}
      {recipeId && !loadErr && (
        <div style={{ backgroundColor: CARD, borderRadius: 14, padding: 20, border: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                      {isBase && (
                        <span style={{ fontSize: 10, backgroundColor: GOLD + '22', color: GOLD, padding: '2px 7px', borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>สูตรพื้นฐาน</span>
                      )}
                      <select
                        style={{ ...inputStyle, flex: '1 1 160px', fontWeight: 600 }}
                        value={isBase ? (item.base_id ?? '') : (item.inventory_id ?? '')}
                        onChange={e => updateItem(idx, isBase ? { base_id: e.target.value } : { inventory_id: e.target.value })}
                        aria-label={`ส่วนผสมบรรทัด ${idx + 1}`}
                      >
                        {isBase
                          ? baseRecipes.map(b => <option key={b.id} value={b.id}>{b.name} ({b.unit})</option>)
                          : inventory.map(i => <option key={i.id} value={i.id}>{i.name_th || i.name} ({i.unit})</option>)
                        }
                      </select>
                      {tempVariants.length > 0 && (
                        <select
                          style={{ ...inputStyle, width: 'auto', flex: '0 0 auto' }}
                          value={item.variant_id ?? ''}
                          onChange={e => updateItem(idx, { variant_id: e.target.value || null })}
                          aria-label={`ใช้กับแบบไหน บรรทัด ${idx + 1}`}
                        >
                          <option value="">ทุกแบบ</option>
                          {tempVariants.map(v => (
                            <option key={v.id} value={v.id}>{VARIANT_LABEL[v.kind]}เท่านั้น{v.is_active ? '' : ' (ปิดอยู่)'}</option>
                          ))}
                        </select>
                      )}
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {cpu.toFixed(2)} ₭/{unit}
                      </span>
                      <button
                        onClick={() => edit(items.filter((_, i) => i !== idx))}
                        aria-label={`ลบบรรทัด ${idx + 1}`}
                        style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                      >✕</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                      {levels.map(lv => {
                        const raw = item[lv.key]
                        const qty = raw.trim() === '' && lv.key !== 'qty_normal' ? (parseFloat(item.qty_normal) || 0) : (parseFloat(raw) || 0)
                        return (
                          <div key={lv.key} style={{ backgroundColor: `${lv.color}12`, borderRadius: 10, padding: '8px', border: `1px solid ${lv.color}28`, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: lv.color, marginBottom: 6, fontWeight: 700, whiteSpace: 'nowrap' }}>{lv.label} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>{unit}</span></div>
                            <div>
                              <input
                                style={{ ...inputStyle, width: '100%', minWidth: 0, padding: '8px 6px' }}
                                type="number" min={0} step="any" inputMode="decimal"
                                value={raw}
                                placeholder={lv.key === 'qty_normal' ? '0' : '= กลาง'}
                                onChange={e => updateItem(idx, { [lv.key]: e.target.value })}
                                aria-label={`ปริมาณ${lv.name} บรรทัด ${idx + 1}`}
                              />
                            </div>
                            <div style={{ fontSize: 12, color: lv.color, marginTop: 6, fontWeight: 600 }}>{(cpu * qty).toFixed(0)} ₭</div>
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

      {/* ── Cost per drink, from the database ── */}
      {recipeId && !loadErr && (
        <div style={{ backgroundColor: CARD, borderRadius: 14, padding: 20, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6 }}>ต้นทุนต่อแก้ว (จากสูตรที่บันทึกแล้ว)</div>
          {dirty && <div style={{ fontSize: 12, color: ORANGE, marginBottom: 10 }}>สูตรยังไม่ได้บันทึก — ตัวเลขด้านล่างเป็นของสูตรเดิม กดบันทึกแล้วจะคิดใหม่</div>}
          {costErr ? (
            <div style={{ fontSize: 13, color: RED }}>โหลดต้นทุนไม่ได้: {costErr}</div>
          ) : costs === null ? (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>กำลังโหลด...</div>
          ) : costCards.length === 0 ? (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>เมนูนี้ยังไม่มีราคาขายที่เปิดใช้</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, opacity: dirty ? 0.5 : 1 }}>
              {costCards.map(c => {
                const margin = c.cost_normal != null && c.price_lak > 0 ? ((c.price_lak - c.cost_normal) / c.price_lak) * 100 : null
                const ok = margin != null && margin >= 60
                return (
                  <div key={c.variant_id} style={{ backgroundColor: CARD2, borderRadius: 12, padding: 16, border: `2px solid ${c.line_count === 0 || c.cost_normal == null ? BORDER : ok ? GREEN + '50' : RED + '50'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{VARIANT_LABEL[c.kind]}</span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>ขาย {Number(c.price_lak).toLocaleString()} ₭</span>
                    </div>
                    {c.line_count === 0 ? (
                      <div style={{ fontSize: 13, color: ORANGE }}>ยังไม่มีสูตรสำหรับแบบนี้</div>
                    ) : c.cost_normal == null ? (
                      <div style={{ fontSize: 13, color: ORANGE }}>มีวัตถุดิบที่ยังไม่มีราคาทุน — ใส่ราคาตอนรับของ หรือแก้ในหน้าสต็อก</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>{Math.round(c.cost_normal).toLocaleString()} ₭</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                          หวานน้อย {Math.round(c.cost_less ?? 0).toLocaleString()} · หวานมาก {Math.round(c.cost_more ?? 0).toLocaleString()} · ไม่หวาน {Math.round(c.cost_none ?? 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 13, marginTop: 8, color: ok ? GREEN : RED, fontWeight: 700 }}>
                          Margin {margin == null ? '—' : margin.toFixed(1) + '%'}{c.price_lak < c.cost_normal ? ' — ราคาขายต่ำกว่าต้นทุน!' : ''}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Save button ── */}
      {recipeId && !loadErr && (
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

// ─── RecipeCostTab ────────────────────────────────────────────────────────────

export default function RecipeCostTab() {
  type SubTab = 'ingredients' | 'bases' | 'recipes' | 'pricing' | 'shopcost'

  const [sub,          setSub]         = useState<SubTab>('ingredients')
  const [inventory,    setInventory]   = useState<InvItem[]>([])
  const [baseRecipes,  setBaseRecipes] = useState<BaseRecipe[]>([])
  const [baseIngs,     setBaseIngs]    = useState<BaseIng[]>([])
  const [msg,          setMsg]         = useState<string | null>(null)

  const loadInventory = useCallback(() => {
    supabase.from('inventory')
      .select('id, name, name_th, unit, cost_per_unit, current_qty')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { if (data) setInventory(data as InvItem[]) })
  }, [])

  const loadBases = useCallback(() => {
    authClient.from('recipe_bases').select('id, name, unit, yield_qty').order('name')
      .then(({ data }) => { if (data) setBaseRecipes(data as BaseRecipe[]) })
    authClient.from('recipe_base_ingredients').select('base_id, inventory_id, qty')
      .then(({ data }) => { if (data) setBaseIngs(data as BaseIng[]) })
  }, [])

  useEffect(() => {
    loadInventory()
    loadBases()
  }, [loadInventory, loadBases])

  // ── Cost helpers ─────────────────────────────────────────────────────────

  function baseCostPerUnit(baseId: string): number {
    const base = baseRecipes.find(b => b.id === baseId)
    if (!base || base.yield_qty <= 0) return 0
    const cost = baseIngs
      .filter(bi => bi.base_id === baseId)
      .reduce((s, bi) => {
        const inv = inventory.find(i => i.id === bi.inventory_id)
        return s + (inv?.cost_per_unit ?? 0) * bi.qty
      }, 0)
    return cost / base.yield_qty
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
    type BaseIngForm = { inventory_id: string; qty: string }
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
      const { data } = await authClient.from('recipe_base_ingredients')
        .select('inventory_id, qty')
        .eq('base_id', b.id)
      setForm({
        name: b.name,
        unit: b.unit,
        items: ((data ?? []) as { inventory_id: string; qty: number }[])
          .map(r => ({ inventory_id: r.inventory_id, qty: String(r.qty) })),
      })
    }

    function addItem() {
      if (!inventory.length) return
      setForm(f => ({ ...f, items: [...f.items, { inventory_id: inventory[0].id, qty: '0' }] }))
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
        const totalYield = form.items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0)
        let baseId: string

        if (editId === 'new') {
          const { data, error } = await authClient.from('recipe_bases')
            .insert({ name: form.name, unit: form.unit, yield_qty: totalYield })
            .select('id').single()
          if (error) throw new Error('ไม่สามารถบันทึกได้: ' + error.message)
          baseId = (data as { id: string }).id
        } else {
          baseId = editId!
          const { error } = await authClient.from('recipe_bases')
            .update({ name: form.name, unit: form.unit, yield_qty: totalYield })
            .eq('id', baseId)
          if (error) throw new Error('ไม่สามารถอัปเดตได้: ' + error.message)
          await authClient.from('recipe_base_ingredients').delete().eq('base_id', baseId)
        }

        if (form.items.length > 0) {
          const rows = form.items.map(i => ({
            base_id:      baseId,
            inventory_id: i.inventory_id,
            qty: parseFloat(i.qty) || 0,
          }))
          const { error } = await authClient.from('recipe_base_ingredients').insert(rows)
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
      await authClient.from('recipe_base_ingredients').delete().eq('base_id', id)
      const { error } = await authClient.from('recipe_bases').delete().eq('id', id)
      if (error) { setMsg('เกิดข้อผิดพลาด: ' + error.message); return }
      setBaseRecipes(prev => prev.filter(b => b.id !== id))
      setBaseIngs(prev => prev.filter(bi => bi.base_id !== id))
      setMsg('ลบแล้ว')
    }

    // Live cost preview for the form being edited
    const previewCost = form.items.reduce((s, item) => {
      const inv = inventory.find(i => i.id === item.inventory_id)
      return s + (inv?.cost_per_unit ?? 0) * (parseFloat(item.qty) || 0)
    }, 0)
    const autoYield  = form.items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0)
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
                      const qty      = parseFloat(item.qty) || 0
                      const itemCost = (inv?.cost_per_unit ?? 0) * qty
                      return (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'center' }}>
                          <select style={inputStyle} value={item.inventory_id} onChange={e => updateItem(idx, { inventory_id: e.target.value })}>
                            {inventory.map(i => <option key={i.id} value={i.id}>{i.name_th || i.name} ({i.unit})</option>)}
                          </select>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input style={{ ...inputStyle, flex: 1 }} type="number" min={0} value={item.qty}
                              onChange={e => updateItem(idx, { qty: e.target.value })} />
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
                    <span>{b.yield_qty.toLocaleString()} {b.unit}</span>
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

  // ── Pricing Panel ─────────────────────────────────────────────────────────

  function PricingPanel() {
    // one row per active price (hot / iced / single); cost = normal sweetness, from get_menu_costs (075)
    type PRow = { id: string; name: string; kind: MenuVariantRow['kind']; price_lak: number; cost: number | null; line_count: number }

    const [rows,         setRows]         = useState<PRow[]>([])
    const [loading,      setLoading]      = useState(true)
    const [loadErr,      setLoadErr]      = useState<string | null>(null)
    const [globalMargin, setGlobalMargin] = useState(60)
    const [vatEnabled,   setVatEnabled]   = useState(false)
    const [vatRate,      setVatRate]      = useState(10)

    useEffect(() => {
      void Promise.all([
        supabase.from('recipes')
          .select('id, product_name, product_name_th')
          .eq('is_active', true)
          .neq('is_archived', true)
          .order('product_name_th'),
        authClient.rpc('get_menu_costs'),
      ]).then(([rec, mc]) => {
        const err = rec.error ?? mc.error
        if (err) { setLoadErr(dbErrorText(err)); setLoading(false); return }
        const costs = (mc.data ?? []) as MenuCostRow[]
        const out: PRow[] = []
        for (const r of (rec.data ?? []) as { id: string; product_name: string; product_name_th: string | null }[]) {
          costs.filter(c => c.recipe_id === r.id && c.is_active)
            .sort((a, b) => VARIANT_ORDER[a.kind] - VARIANT_ORDER[b.kind])
            .forEach(c => out.push({ id: c.variant_id, name: r.product_name_th || r.product_name, kind: c.kind,
              price_lak: Number(c.price_lak), cost: c.line_count > 0 ? c.cost_normal : null, line_count: c.line_count }))
        }
        setRows(out)
        setLoading(false)
      })
    }, [])

    function exportCsv() {
      const withCost = rows.filter(r => r.cost != null)
      const date = new Date().toISOString().slice(0, 10)
      const cc = (v: unknown) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s }
      const data = [
        ['ชื่อเมนู', 'แบบ', 'ต้นทุน/แก้ว (₭)', 'ราคาขาย (₭)', 'Margin %', 'สถานะ'],
        ...withCost.map(r => {
          const cost   = Math.round(r.cost!)
          const margin = r.price_lak > 0 ? Math.round(((r.price_lak - cost) / r.price_lak) * 100) : 0
          return [r.name, VARIANT_LABEL[r.kind], cost, r.price_lak, margin + '%', margin >= globalMargin ? 'ดี' : 'ต่ำกว่าเป้า']
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

    if (loadErr) return (
      <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: RED + '15', color: RED, fontSize: 13 }}>โหลดต้นทุนไม่ได้: {loadErr}</div>
    )

    const label    = (r: PRow) => r.kind === 'default' ? r.name : `${r.name} (${VARIANT_LABEL[r.kind]})`
    const withCost = rows.filter(r => r.cost != null)
    const noRecipe = rows.filter(r => r.line_count === 0)
    const noPrice  = rows.filter(r => r.line_count > 0 && r.cost == null)

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
            ต้นทุนต่อแก้ว = วัตถุดิบในสูตร (ความหวานปกติ) คิดจากราคาทุนล่าสุดในฐานข้อมูล
          </div>
        </SectionCard>

        {noRecipe.length > 0 && (
          <div style={{ padding: '12px 16px', backgroundColor: ORANGE + '12', borderRadius: 10, border: `1px solid ${ORANGE}33`, fontSize: 13, color: ORANGE }}>
            {noRecipe.length} รายการยังไม่มีสูตร: {noRecipe.slice(0, 5).map(label).join(', ')}{noRecipe.length > 5 ? ` +${noRecipe.length - 5} รายการ` : ''}
          </div>
        )}
        {noPrice.length > 0 && (
          <div style={{ padding: '12px 16px', backgroundColor: ORANGE + '12', borderRadius: 10, border: `1px solid ${ORANGE}33`, fontSize: 13, color: ORANGE }}>
            {noPrice.length} รายการมีวัตถุดิบที่ยังไม่มีราคาทุน (คิดต้นทุนไม่ได้): {noPrice.slice(0, 5).map(label).join(', ')}{noPrice.length > 5 ? ` +${noPrice.length - 5} รายการ` : ''}
          </div>
        )}

        {withCost.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', padding: '60px 0', fontSize: 14 }}>
            ยังไม่มีสูตร — ไปสร้างสูตรในแท็บ &ldquo;สร้างสูตร&rdquo; ก่อน
          </div>
        ) : (
          <SectionCard
            title={`ราคา vs ต้นทุน (${withCost.length} รายการ)`}
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
                const cost      = Math.round(r.cost!)
                const margin    = r.price_lak > 0 ? ((r.price_lak - cost) / r.price_lak) * 100 : 0
                const isBad     = margin < globalMargin
                const suggested = vatEnabled ? Math.round((cost / (1 - globalMargin / 100)) * (1 + vatRate / 100) / 1000) * 1000 : 0
                return (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: vatEnabled ? '2fr 1fr 1fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '12px', borderRadius: 8, backgroundColor: isBad ? `${RED}0d` : CARD2, border: `1px solid ${isBad ? RED + '33' : 'transparent'}`, alignItems: 'center', fontSize: 14 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      {r.kind !== 'default' && <div style={{ fontSize: 11, color: r.kind === 'iced' ? '#4a9eff' : ORANGE, marginTop: 2 }}>{VARIANT_LABEL[r.kind]}</div>}
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
    { id: 'shopcost',    label: 'ต้นทุนร้าน'   },
  ]

  return (
    <div>
      <Toast msg={msg} />
      <div style={{ display: 'flex', marginBottom: 28, borderBottom: `1px solid ${BORDER}`, overflowX: 'auto' }}>
        {subs.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)} style={{
            padding: '8px 22px', whiteSpace: 'nowrap', flexShrink: 0, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            backgroundColor: 'transparent',
            color: sub === s.id ? GOLD : 'rgba(255,255,255,0.4)',
            borderBottom: sub === s.id ? `2px solid ${GOLD}` : '2px solid transparent',
            marginBottom: -1,
          }}>{s.label}</button>
        ))}
      </div>
      {sub === 'ingredients' && <IngredientsPanel />}
      {sub === 'bases'       && <BaseRecipesPanel />}
      {sub === 'recipes'     && <FormulaPanel inventory={inventory} baseRecipes={baseRecipes} baseCostPerUnit={baseCostPerUnit} setMsg={setMsg} />}
      {sub === 'pricing'     && <PricingPanel />}
      {/* kept mounted so unsaved cost edits survive switching sub-tabs */}
      <div style={{ display: sub === 'shopcost' ? undefined : 'none' }}><ShopCostPanel /></div>
    </div>
  )
}
