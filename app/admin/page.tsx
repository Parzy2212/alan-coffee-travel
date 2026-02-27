'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminPage() {
  const [destinations, setDestinations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    title_en: '', excerpt_en: '', region: '', slug: '', status: 'active'
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { fetchDestinations() }, [])

  async function fetchDestinations() {
    const { data } = await supabase.from('destinations').select('*').order('created_at', { ascending: false })
    setDestinations(data || [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!form.title_en || !form.slug) { setMessage('⚠️ กรุณากรอก Title และ Slug'); return }
    setSaving(true)
    const { error } = await supabase.from('destinations').insert([form])
    if (error) { setMessage('❌ ' + error.message) }
    else { setMessage('✅ เพิ่มสำเร็จ!'); setForm({ title_en: '', excerpt_en: '', region: '', slug: '', status: 'active' }); fetchDestinations() }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    await supabase.from('destinations').delete().eq('id', id)
    fetchDestinations()
  }

  return (
    <div style={{minHeight: '100vh', backgroundColor: '#0f0f0f', color: 'white', padding: '40px 32px'}}>
      <div style={{maxWidth: '1000px', margin: '0 auto'}}>
        <div style={{marginBottom: '40px'}}>
          <a href="/" style={{color: '#c9a84c', fontSize: '13px', textDecoration: 'none'}}>← Back to Site</a>
          <h1 style={{fontSize: '32px', fontWeight: 800, marginTop: '12px'}}>Admin Panel</h1>
          <p style={{color: '#666', fontSize: '14px'}}>Alan Coffee Travel — จัดการข้อมูล</p>
        </div>

        <div style={{backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '28px', marginBottom: '40px', border: '1px solid #2d2d2d'}}>
          <h2 style={{fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: '#c9a84c'}}>➕ เพิ่ม Destination ใหม่</h2>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px'}}>
            <div>
              <label style={{fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px'}}>ชื่อสถานที่ (EN) *</label>
              <input value={form.title_en} onChange={e => setForm({...form, title_en: e.target.value})} placeholder="เช่น Luang Prabang"
                style={{width: '100%', backgroundColor: '#0f0f0f', border: '1px solid #333', borderRadius: '6px', padding: '10px 14px', color: 'white', fontSize: '14px', boxSizing: 'border-box' as const}} />
            </div>
            <div>
              <label style={{fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px'}}>Slug *</label>
              <input value={form.slug} onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} placeholder="เช่น luang-prabang"
                style={{width: '100%', backgroundColor: '#0f0f0f', border: '1px solid #333', borderRadius: '6px', padding: '10px 14px', color: 'white', fontSize: '14px', boxSizing: 'border-box' as const}} />
            </div>
          </div>
          <div style={{marginBottom: '16px'}}>
            <label style={{fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px'}}>คำอธิบายสั้น</label>
            <input value={form.excerpt_en} onChange={e => setForm({...form, excerpt_en: e.target.value})} placeholder="เช่น Ancient temples and golden sunsets"
              style={{width: '100%', backgroundColor: '#0f0f0f', border: '1px solid #333', borderRadius: '6px', padding: '10px 14px', color: 'white', fontSize: '14px', boxSizing: 'border-box' as const}} />
          </div>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px'}}>
            <div>
              <label style={{fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px'}}>Region</label>
              <input value={form.region} onChange={e => setForm({...form, region: e.target.value})} placeholder="เช่น Northern Laos"
                style={{width: '100%', backgroundColor: '#0f0f0f', border: '1px solid #333', borderRadius: '6px', padding: '10px 14px', color: 'white', fontSize: '14px', boxSizing: 'border-box' as const}} />
            </div>
            <div>
              <label style={{fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px'}}>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                style={{width: '100%', backgroundColor: '#0f0f0f', border: '1px solid #333', borderRadius: '6px', padding: '10px 14px', color: 'white', fontSize: '14px', boxSizing: 'border-box' as const}}>
                <option value="active">Active — แสดงบนเว็บ</option>
                <option value="draft">Draft — ซ่อนไว้ก่อน</option>
              </select>
            </div>
          </div>
          {message && <div style={{padding: '10px 16px', backgroundColor: '#1f2f1f', borderRadius: '6px', marginBottom: '16px', fontSize: '14px'}}>{message}</div>}
          <button onClick={handleAdd} disabled={saving}
            style={{backgroundColor: '#c9a84c', color: '#0f0f0f', padding: '12px 28px', borderRadius: '6px', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer'}}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>

        <h2 style={{fontSize: '18px', fontWeight: 700, marginBottom: '16px'}}>📍 Destinations ทั้งหมด ({destinations.length})</h2>
        {loading ? <p style={{color: '#666'}}>กำลังโหลด...</p> : (
          <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            {destinations.map(d => (
              <div key={d.id} style={{backgroundColor: '#1a1a1a', borderRadius: '8px', padding: '16px 20px', border: '1px solid #2d2d2d', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <span style={{fontWeight: 700, fontSize: '16px'}}>{d.title_en}</span>
                    <span style={{fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 600, backgroundColor: d.status === 'active' ? '#1f3f1f' : '#2f2f1f', color: d.status === 'active' ? '#4caf50' : '#c9a84c'}}>
                      {d.status}
                    </span>
                  </div>
                  <p style={{color: '#666', fontSize: '13px', marginTop: '4px'}}>{d.excerpt_en}</p>
                  <p style={{color: '#444', fontSize: '12px', marginTop: '2px'}}>/{d.slug} · {d.region}</p>
                </div>
                <button onClick={() => handleDelete(d.id)}
                  style={{backgroundColor: 'transparent', color: '#c0392b', border: '1px solid #c0392b', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer'}}>
                  ลบ
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}