'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const DISTRICTS = [
  { label: 'Samakhi Xai', value: 'samakhi-xai' },
  { label: 'Xayxetha', value: 'xayxetha' },
  { label: 'Sanxay', value: 'sanxay' },
  { label: 'Phouvong', value: 'phouvong' },
  { label: 'Sanamxay', value: 'sanamxay' },
]

export default function AdminPage() {
  const [destinations, setDestinations] = useState<any[]>([])
  const [form, setForm] = useState({
    title_en: '',
    slug: '',
    excerpt_en: '',
    region: '',
    district: '',
    location_lat: '',
    location_lng: '',
    transport_price: '',
    has_guide: false,
    status: 'active',
  })
  const [msg, setMsg] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const { data } = await supabase.from('destinations').select('*').order('created_at', { ascending: false })
    setDestinations(data || [])
  }

  async function handleAdd() {
    if (!form.title_en || !form.slug) return setMsg('❌ Title and slug are required')
    const { error } = await supabase.from('destinations').insert([{
      ...form,
      location_lat: form.location_lat ? parseFloat(form.location_lat) : null,
      location_lng: form.location_lng ? parseFloat(form.location_lng) : null,
    }])
    if (error) return setMsg('❌ ' + error.message)
    setMsg('✅ Added successfully!')
    setForm({ title_en: '', slug: '', excerpt_en: '', region: '', district: '', location_lat: '', location_lng: '', transport_price: '', has_guide: false, status: 'active' })
    fetchAll()
  }

  async function handleDelete(id: string) {
    await supabase.from('destinations').delete().eq('id', id)
    setDeleteId(null)
    fetchAll()
  }

  const inputStyle = {
    width: '100%', backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px', padding: '10px 14px', color: 'white', fontSize: '14px',
    boxSizing: 'border-box' as const, outline: 'none',
  }
  const labelStyle = { fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block' }

  return (
    <main style={{minHeight: '100vh', backgroundColor: '#0a0a0a', padding: '48px 32px'}}>
      <div style={{maxWidth: '1100px', margin: '0 auto'}}>

        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px'}}>
          <div>
            <h1 style={{fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 800, color: 'white', letterSpacing: '-1px'}}>Admin Panel</h1>
            <p style={{color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginTop: '4px'}}>Alan Coffee & Travel</p>
          </div>
          <a href="/" style={{color: 'rgba(255,255,255,0.4)', fontSize: '13px', textDecoration: 'none'}}>← Back to Site</a>
        </div>

        {/* ADD FORM */}
        <div style={{backgroundColor: '#111', borderRadius: '12px', padding: '32px', marginBottom: '40px', border: '1px solid rgba(255,255,255,0.06)'}}>
          <h2 style={{color: '#c9a84c', fontSize: '16px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '28px'}}>Add Destination</h2>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px'}}>
            <div>
              <label style={labelStyle}>Title (EN) *</label>
              <input value={form.title_en} onChange={e => setForm({...form, title_en: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} placeholder="e.g. Katamtoy Waterfall" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Slug *</label>
              <input value={form.slug} onChange={e => setForm({...form, slug: e.target.value.toLowerCase()})} placeholder="e.g. katamtoy-waterfall" style={inputStyle} />
            </div>
          </div>

          <div style={{marginBottom: '16px'}}>
            <label style={labelStyle}>Short Description</label>
            <textarea value={form.excerpt_en} onChange={e => setForm({...form, excerpt_en: e.target.value})} placeholder="Brief description of this destination..." rows={3} style={{...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit'}} />
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px'}}>
            <div>
              <label style={labelStyle}>Region</label>
              <input value={form.region} onChange={e => setForm({...form, region: e.target.value})} placeholder="e.g. Southern Laos" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>District</label>
              <select value={form.district} onChange={e => setForm({...form, district: e.target.value})} style={{...inputStyle}}>
                <option value="">— Select District —</option>
                {DISTRICTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          {/* COORDINATES */}
          <div style={{backgroundColor: 'rgba(201,168,76,0.06)', borderRadius: '8px', padding: '20px', marginBottom: '16px', border: '1px solid rgba(201,168,76,0.15)'}}>
            <p style={{color: '#c9a84c', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px'}}>📍 Location Coordinates</p>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '10px'}}>
              <div>
                <label style={labelStyle}>Latitude</label>
                <input value={form.location_lat} onChange={e => setForm({...form, location_lat: e.target.value})} placeholder="e.g. 14.8167" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Longitude</label>
                <input value={form.location_lng} onChange={e => setForm({...form, location_lng: e.target.value})} placeholder="e.g. 107.0833" style={inputStyle} />
              </div>
            </div>
            <p style={{color: 'rgba(255,255,255,0.25)', fontSize: '12px'}}>
              💡 Get coordinates from{' '}
              <a href="https://maps.google.com" target="_blank" style={{color: '#c9a84c'}}>Google Maps</a>
              {' '}— right click on location → "What's here?"
            </p>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px'}}>
            <div>
              <label style={labelStyle}>Transport Price</label>
              <input value={form.transport_price} onChange={e => setForm({...form, transport_price: e.target.value})} placeholder="e.g. 50,000 LAK" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} style={inputStyle}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div style={{display: 'flex', alignItems: 'flex-end', paddingBottom: '2px'}}>
              <label style={{display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'}}>
                <input type="checkbox" checked={form.has_guide} onChange={e => setForm({...form, has_guide: e.target.checked})} style={{width: '16px', height: '16px', accentColor: '#c9a84c'}} />
                <span style={{color: 'rgba(255,255,255,0.6)', fontSize: '14px'}}>Guide Available</span>
              </label>
            </div>
          </div>

          {msg && <p style={{color: msg.startsWith('✅') ? '#4caf50' : '#e74c3c', fontSize: '13px', marginBottom: '16px'}}>{msg}</p>}

          <button onClick={handleAdd} style={{backgroundColor: '#c9a84c', color: '#0a0a0a', padding: '12px 32px', borderRadius: '6px', border: 'none', fontWeight: 800, fontSize: '14px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' as const}}>
            Add Destination
          </button>
        </div>

        {/* LIST */}
        <div>
          <h2 style={{color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '20px'}}>All Destinations ({destinations.length})</h2>
          <div style={{display: 'flex', flexDirection: 'column' as const, gap: '10px'}}>
            {destinations.map(d => (
              <div key={d.id} style={{backgroundColor: '#111', borderRadius: '10px', padding: '18px 20px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px'}}>
                    <p style={{color: 'white', fontWeight: 700, fontSize: '15px'}}>{d.title_en}</p>
                    <span style={{backgroundColor: d.status === 'active' ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.06)', color: d.status === 'active' ? '#4caf50' : 'rgba(255,255,255,0.3)', padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600}}>{d.status}</span>
                    {d.district && <span style={{backgroundColor: 'rgba(201,168,76,0.1)', color: '#c9a84c', padding: '2px 10px', borderRadius: '999px', fontSize: '11px'}}>{d.district}</span>}
                  </div>
                  <p style={{color: 'rgba(255,255,255,0.35)', fontSize: '12px'}}>/destinations/{d.slug}</p>
                  {d.location_lat && <p style={{color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '2px'}}>📍 {d.location_lat}, {d.location_lng}</p>}
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <a href={`/destinations/${d.slug}`} target="_blank" style={{backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', fontWeight: 600}}>View</a>
                  {deleteId === d.id ? (
                    <>
                      <button onClick={() => handleDelete(d.id)} style={{backgroundColor: '#c0392b', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer', fontWeight: 600}}>Confirm</button>
                      <button onClick={() => setDeleteId(null)} style={{backgroundColor: 'rgba(255,255,255,0.06)', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer'}}>Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteId(d.id)} style={{backgroundColor: 'rgba(192,57,43,0.15)', color: '#e74c3c', padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(192,57,43,0.3)', fontSize: '12px', cursor: 'pointer', fontWeight: 600}}>Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  )
}