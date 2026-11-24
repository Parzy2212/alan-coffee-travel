import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { authClient, dbErrorText } from '@/lib/supabase-auth'
import { MoneyInput } from '@/components/MoneyInput'
import { GOLD, CARD, BORDER, RED, GREEN, inputStyle, btnStyleSm, fmtLAK } from '@/components/cafe/shared'

export type MenuVariantRow = { id: string; recipe_id: string; kind: 'default' | 'hot' | 'iced'; price_lak: number; is_active: boolean }

const TEMP_NAME = { hot: 'ร้อน', iced: 'เย็น' } as const

// with 2 active prices the menu form cannot say which one it means, so the database refuses it (072 trigger)
export function priceInMenuFormLocked(variants: MenuVariantRow[]): boolean {
  return variants.filter(v => v.is_active).length > 1
}

// variants = the saved rows of one menu item; save_menu_variants (072) switches rows off but never deletes them,
// so a switched-off row still holds its last price and is used to fill the field again
export function VariantPricesEditor({ recipeId, variants, menuPrice, onSaved }: { recipeId: string; variants: MenuVariantRow[]; menuPrice: number; onSaved: () => void }) {
  const active = variants.filter(v => v.is_active)
  const priceOf = (kind: MenuVariantRow['kind']) => String(variants.find(v => v.kind === kind)?.price_lak ?? '')
  const [split, setSplit] = useState(active.some(v => v.kind !== 'default'))
  const [hotOn, setHotOn] = useState(active.some(v => v.kind === 'hot'))
  const [icedOn, setIcedOn] = useState(active.some(v => v.kind === 'iced'))
  const [hot, setHot] = useState(priceOf('hot') || String(menuPrice))
  const [iced, setIced] = useState(priceOf('iced') || String(menuPrice))
  const [single, setSingle] = useState(String(menuPrice))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save() {
    if (saving) return
    const list: { kind: string; price_lak: number }[] = []
    if (split) {
      if (hotOn) list.push({ kind: 'hot', price_lak: Number(hot) })
      if (icedOn) list.push({ kind: 'iced', price_lak: Number(iced) })
      if (list.length === 0) { setMsg({ ok: false, text: 'เลือกอย่างน้อย ร้อน หรือ เย็น' }); return }
    } else {
      list.push({ kind: 'default', price_lak: Number(single) })
    }
    if (list.some(v => !(v.price_lak > 0))) { setMsg({ ok: false, text: 'ราคาต้องมากกว่า 0 ₭' }); return }
    setSaving(true); setMsg(null)
    const { error } = await authClient.rpc('save_menu_variants', { p_recipe_id: recipeId, p_variants: list })
    setSaving(false)
    if (error) { setMsg({ ok: false, text: dbErrorText(error) }); return }
    setMsg({ ok: true, text: 'บันทึกราคาแล้ว หน้าขายจะเปลี่ยนเอง' })
    onSaved()
  }

  const row = (label: string, on: boolean, setOn: (v: boolean) => void, value: string, setValue: (v: string) => void) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input type="checkbox" checked={on} onChange={e => { setOn(e.target.checked); setMsg(null) }} style={{ width: 18, height: 18, accentColor: GOLD }} />
      <span style={{ width: 40, fontSize: 13, color: '#fff' }}>{label}</span>
      <MoneyInput value={value} onChange={v => { setValue(v); setMsg(null) }} style={{ ...inputStyle, flex: 1, opacity: on ? 1 : 0.4 }} placeholder="ราคา ₭" ariaLabel={`ราคา${label}`} disabled={!on} />
    </label>
  )

  return (
    <div style={{ marginBottom: 14, padding: 12, backgroundColor: CARD, borderRadius: 8, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>ราคาขาย</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button type="button" onClick={() => { setSplit(false); setMsg(null) }} style={btnStyleSm(!split ? GOLD + '33' : 'rgba(255,255,255,0.05)', !split ? GOLD : 'rgba(255,255,255,0.5)')}>ราคาเดียว</button>
        <button type="button" onClick={() => { setSplit(true); setMsg(null) }} style={btnStyleSm(split ? GOLD + '33' : 'rgba(255,255,255,0.05)', split ? GOLD : 'rgba(255,255,255,0.5)')}>แยก ร้อน / เย็น</button>
      </div>
      {split ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {row('ร้อน', hotOn, setHotOn, hot, setHot)}
          {row('เย็น', icedOn, setIcedOn, iced, setIced)}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>หน้าขายจะให้เลือก ร้อน / เย็น ตามที่ติ๊ก ส่วนผสมที่ใช้ต่างกันตั้งได้ในหน้าต้นทุนเมนู</div>
        </div>
      ) : (
        <MoneyInput value={single} onChange={v => { setSingle(v); setMsg(null) }} style={inputStyle} placeholder="ราคา ₭" ariaLabel="ราคาเดียว" />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <button type="button" onClick={() => void save()} disabled={saving} style={btnStyleSm(GOLD + '22', GOLD)}>{saving ? 'กำลังบันทึก...' : 'บันทึกราคา'}</button>
        {msg && <span style={{ fontSize: 12, color: msg.ok ? GREEN : RED }}>{msg.text}</span>}
      </div>
    </div>
  )
}

export function VariantPriceLine({ variants }: { variants: MenuVariantRow[] }) {
  const temp = (['hot', 'iced'] as const).flatMap(k => variants.filter(v => v.is_active && v.kind === k))
  if (temp.length === 0) return null
  return (
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
      {temp.map(v => `${TEMP_NAME[v.kind as 'hot' | 'iced']} ${fmtLAK(v.price_lak)}`).join(' · ')}
    </div>
  )
}

type InvOption = { id: string; name: string; name_th: string | null; unit: string; is_active: boolean | null }

// extra shot: price per shot + what one shot takes from stock; all empty = no button on the POS (072 set_extra_shot)
export function ExtraShotSettings({ shopId }: { shopId: string }) {
  const [loaded, setLoaded] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [inv, setInv] = useState<InvOption[]>([])
  const [price, setPrice] = useState('')
  const [invId, setInvId] = useState('')
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      supabase.from('shops').select('extra_shot_price_lak, extra_shot_inventory_id, extra_shot_qty').eq('id', shopId).maybeSingle(),
      supabase.from('inventory').select('id, name, name_th, unit, is_active').order('name'),
    ]).then(([s, i]) => {
      if (cancelled) return
      const err = s.error ?? i.error
      if (err) { setLoadErr(dbErrorText(err)); return }
      setInv((i.data as InvOption[]) ?? [])
      setPrice(s.data?.extra_shot_price_lak == null ? '' : String(Number(s.data.extra_shot_price_lak)))
      setInvId(s.data?.extra_shot_inventory_id ?? '')
      setQty(s.data?.extra_shot_qty == null ? '' : String(Number(s.data.extra_shot_qty)))
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [shopId])

  async function save(clear: boolean) {
    if (saving) return
    const p = Number(price), q = Number(qty)
    if (!clear && (!(p > 0) || !invId || !(q > 0))) { setMsg({ ok: false, text: 'ใส่ราคาต่อ shot, วัตถุดิบ และปริมาณต่อ shot ให้ครบ' }); return }
    setSaving(true); setMsg(null)
    const { error } = await authClient.rpc('set_extra_shot', clear
      ? { p_price_lak: null, p_inventory_id: null, p_qty: null }
      : { p_price_lak: p, p_inventory_id: invId, p_qty: q })
    setSaving(false)
    if (error) { setMsg({ ok: false, text: dbErrorText(error) }); return }
    if (clear) { setPrice(''); setInvId(''); setQty('') }
    setMsg({ ok: true, text: clear ? 'ปิด extra shot แล้ว (ไม่มีปุ่มบนหน้าขาย)' : 'บันทึกแล้ว หน้าขายมีปุ่ม +shot เมื่อโหลดหน้าใหม่' })
  }

  const unit = inv.find(i => i.id === invId)?.unit ?? ''
  return (
    <div style={{ marginBottom: 16, padding: 14, backgroundColor: CARD, borderRadius: 10, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 11, color: GOLD, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 4 }}>Extra shot</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>ราคาต่อ shot และกาแฟที่ใช้ต่อ shot · ยังไม่ตั้ง = ไม่มีปุ่ม +shot บนหน้าขาย</div>
      {loadErr ? (
        <div style={{ fontSize: 12, color: RED }}>โหลดค่า extra shot ไม่ได้: {loadErr}</div>
      ) : !loaded ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>กำลังโหลด...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>ราคาต่อ shot ₭
              <MoneyInput value={price} onChange={v => { setPrice(v); setMsg(null) }} style={{ ...inputStyle, marginTop: 4 }} placeholder="เช่น 5000" ariaLabel="ราคาต่อ shot" />
            </label>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>วัตถุดิบที่ตัด
              <select value={invId} onChange={e => { setInvId(e.target.value); setMsg(null) }} style={{ ...inputStyle, marginTop: 4, cursor: 'pointer' }} aria-label="วัตถุดิบที่ตัดต่อ shot">
                <option value="">— เลือก —</option>
                {inv.filter(i => i.is_active !== false || i.id === invId).map(i => (
                  <option key={i.id} value={i.id}>{i.name_th || i.name} ({i.unit}){i.is_active === false ? ' — ปิดใช้งานแล้ว' : ''}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>ปริมาณต่อ shot {unit && `(${unit})`}
              <input value={qty} onChange={e => { setQty(e.target.value); setMsg(null) }} type="number" min="0" step="any" inputMode="decimal" style={{ ...inputStyle, marginTop: 4 }} placeholder="เช่น 18" aria-label="ปริมาณต่อ shot" />
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void save(false)} disabled={saving} style={btnStyleSm(GOLD + '22', GOLD)}>{saving ? 'กำลังบันทึก...' : 'บันทึก extra shot'}</button>
            <button type="button" onClick={() => void save(true)} disabled={saving} style={btnStyleSm('rgba(255,255,255,0.05)', 'rgba(255,255,255,0.55)')}>ปิด extra shot</button>
            {msg && <span style={{ fontSize: 12, color: msg.ok ? GREEN : RED }}>{msg.text}</span>}
          </div>
        </>
      )}
    </div>
  )
}
