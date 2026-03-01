'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Province → district mapping extracted from lao_admin2.geojson
// Attapeu entries use corrected display names and DB slugs for backward compat
const PROVINCE_DISTRICTS: Record<string, { name: string; slug: string }[]> = {
  'Attapeu': [
    { name: 'Phouvong',    slug: 'phouvong' },
    { name: 'Samakhi Xai', slug: 'samakhi-xai' },
    { name: 'Sanamxay',    slug: 'sanamxay' },
    { name: 'Sanxay',      slug: 'sanxay' },
    { name: 'Xayxetha',   slug: 'xayxetha' },
  ],
  'Bokeo': [
    { name: 'Huoixai',   slug: 'huoixai' },
    { name: 'Meung',     slug: 'meung' },
    { name: 'Paktha',    slug: 'paktha' },
    { name: 'Pha Oudom', slug: 'pha-oudom' },
    { name: 'Tonpheung', slug: 'tonpheung' },
  ],
  'Bolikhamxai': [
    { name: 'Bolikhanh',    slug: 'bolikhanh' },
    { name: 'Khamkeuth',    slug: 'khamkeuth' },
    { name: 'Pakkading',    slug: 'pakkading' },
    { name: 'Pakxane',      slug: 'pakxane' },
    { name: 'Thaphabath',   slug: 'thaphabath' },
    { name: 'Viengthong',   slug: 'viengthong' },
    { name: 'Xaychamphone', slug: 'xaychamphone' },
  ],
  'Champasack': [
    { name: 'Bachiangchaleunsook', slug: 'bachiangchaleunsook' },
    { name: 'Champasack',          slug: 'champasack' },
    { name: 'Khong',               slug: 'khong' },
    { name: 'Moonlapamok',         slug: 'moonlapamok' },
    { name: 'Pakse',               slug: 'pakse' },
    { name: 'Paksxong',            slug: 'paksxong' },
    { name: 'Pathoomphone',        slug: 'pathoomphone' },
    { name: 'Phonthong',           slug: 'phonthong' },
    { name: 'Sanasomboon',         slug: 'sanasomboon' },
    { name: 'Sukhuma',             slug: 'sukhuma' },
  ],
  'Houaphan': [
    { name: 'Add',      slug: 'add' },
    { name: 'Hiem',     slug: 'hiem' },
    { name: 'Huameuang', slug: 'huameuang' },
    { name: 'Kuan',     slug: 'kuan' },
    { name: 'Sopbao',   slug: 'sopbao' },
    { name: 'Viengxay', slug: 'viengxay' },
    { name: 'Xamneua',  slug: 'xamneua' },
    { name: 'Xamtay',   slug: 'xamtay' },
    { name: 'Xiengkhor', slug: 'xiengkhor' },
    { name: 'Xon',      slug: 'xon' },
  ],
  'Khammouan': [
    { name: 'Bualapha',     slug: 'bualapha' },
    { name: 'Hinboon',      slug: 'hinboon' },
    { name: 'Khounkham',    slug: 'khounkham' },
    { name: 'Mahaxay',      slug: 'mahaxay' },
    { name: 'Nakay',        slug: 'nakay' },
    { name: 'Nhommalath',   slug: 'nhommalath' },
    { name: 'Nongbok',      slug: 'nongbok' },
    { name: 'Thakhek',      slug: 'thakhek' },
    { name: 'Xaybuathong',  slug: 'xaybuathong' },
    { name: 'Xebangfay',    slug: 'xebangfay' },
  ],
  'Louangnamtha': [
    { name: 'Long',         slug: 'long' },
    { name: 'Nalae',        slug: 'nalae' },
    { name: 'Namtha',       slug: 'namtha' },
    { name: 'Sing',         slug: 'sing' },
    { name: 'Viengphoukha', slug: 'viengphoukha' },
  ],
  'Louangphabang': [
    { name: 'Chomphet',   slug: 'chomphet' },
    { name: 'Luangprabang', slug: 'luangprabang' },
    { name: 'Nambak',     slug: 'nambak' },
    { name: 'Nan',        slug: 'nan' },
    { name: 'Ngoi',       slug: 'ngoi' },
    { name: 'Pak Xeng',   slug: 'pak-xeng' },
    { name: 'Park Ou',    slug: 'park-ou' },
    { name: 'Phonthong',  slug: 'phonthong' },
    { name: 'Phonxay',    slug: 'phonxay' },
    { name: 'Phoukhoune', slug: 'phoukhoune' },
    { name: 'Viengkham',  slug: 'viengkham' },
    { name: 'Xieng Ngeun', slug: 'xieng-ngeun' },
  ],
  'Oudomxai': [
    { name: 'Beng',    slug: 'beng' },
    { name: 'Hoon',    slug: 'hoon' },
    { name: 'La',      slug: 'la' },
    { name: 'Namor',   slug: 'namor' },
    { name: 'Nga',     slug: 'nga' },
    { name: 'Pakbeng', slug: 'pakbeng' },
    { name: 'Xay',     slug: 'xay' },
  ],
  'Phongsaly': [
    { name: 'Boon Neua', slug: 'boon-neua' },
    { name: 'Boontay',   slug: 'boontay' },
    { name: 'Khua',      slug: 'khua' },
    { name: 'May',       slug: 'may' },
    { name: 'Nhot Ou',   slug: 'nhot-ou' },
    { name: 'Phongsaly', slug: 'phongsaly' },
    { name: 'Samphanh',  slug: 'samphanh' },
  ],
  'Salavan': [
    { name: 'Khongxedone',  slug: 'khongxedone' },
    { name: 'Lakhonepheng', slug: 'lakhonepheng' },
    { name: 'Lao Ngarm',    slug: 'lao-ngarm' },
    { name: 'Samuoi',       slug: 'samuoi' },
    { name: 'Saravane',     slug: 'saravane' },
    { name: 'Ta Oi',        slug: 'ta-oi' },
    { name: 'Toomlarn',     slug: 'toomlarn' },
    { name: 'Vapy',         slug: 'vapy' },
  ],
  'Savannakhet': [
    { name: 'Atsaphangthong',    slug: 'atsaphangthong' },
    { name: 'Atsaphone',         slug: 'atsaphone' },
    { name: 'Champhone',         slug: 'champhone' },
    { name: 'Kaysone Phomvihane', slug: 'kaysone-phomvihane' },
    { name: 'Nong',              slug: 'nong' },
    { name: 'Outhoomphone',      slug: 'outhoomphone' },
    { name: 'Phalanxay',         slug: 'phalanxay' },
    { name: 'Phine',             slug: 'phine' },
    { name: 'Sepone',            slug: 'sepone' },
    { name: 'Songkhone',         slug: 'songkhone' },
    { name: 'Thapangthong',      slug: 'thapangthong' },
    { name: 'Vilabuly',          slug: 'vilabuly' },
    { name: 'Xaybuly',           slug: 'xaybuly' },
    { name: 'Xayphoothong',      slug: 'xayphoothong' },
    { name: 'Xonbuly',           slug: 'xonbuly' },
  ],
  'Sekong': [
    { name: 'Dakcheung', slug: 'dakcheung' },
    { name: 'Kaleum',    slug: 'kaleum' },
    { name: 'Lamarm',    slug: 'lamarm' },
    { name: 'Thateng',   slug: 'thateng' },
  ],
  'Vientiane': [
    { name: 'Feuang',    slug: 'feuang' },
    { name: 'Hinherb',   slug: 'hinherb' },
    { name: 'Kasy',      slug: 'kasy' },
    { name: 'Keo Oudom', slug: 'keo-oudom' },
    { name: 'Mad',       slug: 'mad' },
    { name: 'Meun',      slug: 'meun' },
    { name: 'Phonhong',  slug: 'phonhong' },
    { name: 'Thoulakhom', slug: 'thoulakhom' },
    { name: 'Vangvieng', slug: 'vangvieng' },
    { name: 'Viengkham', slug: 'viengkham' },
    { name: 'Xanakharm', slug: 'xanakharm' },
  ],
  'Vientiane Capital': [
    { name: 'Chanthabuly', slug: 'chanthabuly' },
    { name: 'Hadxaifong',  slug: 'hadxaifong' },
    { name: 'Mayparkngum', slug: 'mayparkngum' },
    { name: 'Naxaithong',  slug: 'naxaithong' },
    { name: 'Sangthong',   slug: 'sangthong' },
    { name: 'Sikhottabong', slug: 'sikhottabong' },
    { name: 'Sisattanak',  slug: 'sisattanak' },
    { name: 'Xaysetha',    slug: 'xaysetha' },
    { name: 'Xaythany',    slug: 'xaythany' },
  ],
  'Xaignabouly': [
    { name: 'Botene',     slug: 'botene' },
    { name: 'Hongsa',     slug: 'hongsa' },
    { name: 'Kenethao',   slug: 'kenethao' },
    { name: 'Khop',       slug: 'khop' },
    { name: 'Ngeun',      slug: 'ngeun' },
    { name: 'Parklai',    slug: 'parklai' },
    { name: 'Phiang',     slug: 'phiang' },
    { name: 'Thongmyxay', slug: 'thongmyxay' },
    { name: 'Xayabury',   slug: 'xayabury' },
    { name: 'Xaysathan',  slug: 'xaysathan' },
    { name: 'Xienghone',  slug: 'xienghone' },
  ],
  'Xaisomboon': [
    { name: 'Anouvong',  slug: 'anouvong' },
    { name: 'Home',      slug: 'home' },
    { name: 'Longcheng', slug: 'longcheng' },
    { name: 'Longsane',  slug: 'longsane' },
    { name: 'Thathom',   slug: 'thathom' },
  ],
  'Xiengkhouang': [
    { name: 'Kham',     slug: 'kham' },
    { name: 'Khoune',   slug: 'khoune' },
    { name: 'Mork',     slug: 'mork' },
    { name: 'Nonghed',  slug: 'nonghed' },
    { name: 'Pek',      slug: 'pek' },
    { name: 'Phaxay',   slug: 'phaxay' },
    { name: 'Phookood', slug: 'phookood' },
  ],
}

const PROVINCES = Object.keys(PROVINCE_DISTRICTS).sort()

const RATINGS = [
  {
    key: 'rating_experience',
    label: 'Experience',
    criteria: [
      '1 — Basic, no standout element',
      '2 — Mildly interesting, some moments',
      '3 — Memorable, worth the trip',
      '4 — Outstanding, deeply engaging',
      '5 — Transformative, once-in-a-lifetime',
    ],
  },
  {
    key: 'rating_accessibility',
    label: 'Accessibility',
    criteria: [
      '1 — Multi-day trek or specialist vehicle required',
      '2 — Hard: 4x4 and significant physical effort',
      '3 — Moderate: standard vehicle, some walking',
      '4 — Easy: good road, short walk',
      '5 — Very easy: paved, suitable for everyone',
    ],
  },
  {
    key: 'rating_authenticity',
    label: 'Authenticity',
    criteria: [
      '1 — Heavily commercialized',
      '2 — Some local character, mixed tourist presence',
      '3 — Mostly genuine, limited tourism',
      '4 — Strongly authentic, rare tourist contact',
      '5 — Completely pristine and undiscovered',
    ],
  },
  {
    key: 'rating_tranquility',
    label: 'Tranquility',
    criteria: [
      '1 — Crowded and noisy at all times',
      '2 — Busy at peak hours, some quiet moments',
      '3 — Peaceful most of the time',
      '4 — Very quiet, few visitors ever',
      '5 — Complete solitude, true wilderness',
    ],
  },
  {
    key: 'rating_traveler_value',
    label: 'Traveler Value',
    criteria: [
      '1 — Poor value, high cost for average experience',
      '2 — Below average return',
      '3 — Fair, balanced cost and experience',
      '4 — Great value, rewarding experience',
      '5 — Exceptional, unforgettable at any cost',
    ],
  },
]

const emptyForm = {
  title_en: '',
  slug: '',
  excerpt_en: '',
  province: '',
  district: '',
  region: '',
  location_lat: '',
  location_lng: '',
  transport_price: '',
  has_guide: false,
  status: 'active',
  assessment_status: 'not_assessed',
  rating_experience: null as number | null,
  rating_accessibility: null as number | null,
  rating_authenticity: null as number | null,
  rating_tranquility: null as number | null,
  rating_traveler_value: null as number | null,
}

export default function AdminPage() {
  const [destinations, setDestinations] = useState<any[]>([])
  const [form, setForm] = useState({ ...emptyForm })
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [msg, setMsg] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { fetchAll() }, [])

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => { imagePreviews.forEach(url => URL.revokeObjectURL(url)) }
  }, [imagePreviews])

  async function fetchAll() {
    const { data } = await supabase.from('destinations').select('*').order('created_at', { ascending: false })
    setDestinations(data || [])
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setImageFiles(files)
    imagePreviews.forEach(url => URL.revokeObjectURL(url))
    setImagePreviews(files.map(f => URL.createObjectURL(f)))
  }

  async function handleAdd() {
    if (!form.title_en || !form.slug) return setMsg('❌ Title and slug are required')
    setUploading(true)
    setMsg('')

    // Upload images to Supabase Storage
    const image_urls: string[] = []
    for (const file of imageFiles) {
      const path = `${form.slug}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('destination-images')
        .upload(path, file, { upsert: true })
      if (uploadError) {
        setMsg('❌ Image upload failed: ' + uploadError.message)
        setUploading(false)
        return
      }
      const { data: urlData } = supabase.storage.from('destination-images').getPublicUrl(path)
      image_urls.push(urlData.publicUrl)
    }

    const assessed = form.assessment_status === 'assessed'
    const { error } = await supabase.from('destinations').insert([{
      title_en: form.title_en,
      slug: form.slug,
      excerpt_en: form.excerpt_en,
      region: form.region || form.province,
      district: form.district,
      location_lat: form.location_lat ? parseFloat(form.location_lat) : null,
      location_lng: form.location_lng ? parseFloat(form.location_lng) : null,
      transport_price: form.transport_price,
      has_guide: form.has_guide,
      status: form.status,
      assessment_status: form.assessment_status,
      rating_experience:     assessed ? form.rating_experience     : null,
      rating_accessibility:  assessed ? form.rating_accessibility  : null,
      rating_authenticity:   assessed ? form.rating_authenticity   : null,
      rating_tranquility:    assessed ? form.rating_tranquility    : null,
      rating_traveler_value: assessed ? form.rating_traveler_value : null,
      image_urls: image_urls.length > 0 ? image_urls : [],
    }])

    setUploading(false)
    if (error) return setMsg('❌ ' + error.message)

    setMsg('✅ Added successfully!')
    setForm({ ...emptyForm })
    setImageFiles([])
    setImagePreviews([])
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
  const labelStyle: React.CSSProperties = {
    fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px',
    textTransform: 'uppercase', marginBottom: '6px', display: 'block',
  }

  const districtOptions = form.province ? (PROVINCE_DISTRICTS[form.province] || []) : []

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', padding: '48px 32px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 800, color: 'white', letterSpacing: '-1px' }}>Admin Panel</h1>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginTop: '4px' }}>Alan Coffee & Travel</p>
          </div>
          <a href="/" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', textDecoration: 'none' }}>← Back to Site</a>
        </div>

        {/* ADD FORM */}
        <div style={{ backgroundColor: '#111', borderRadius: '12px', padding: '32px', marginBottom: '40px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={{ color: '#c9a84c', fontSize: '16px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '28px' }}>Add Destination</h2>

          {/* Title + Slug */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Title (EN) *</label>
              <input value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })} placeholder="e.g. Katamtoy Waterfall" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Slug *</label>
              <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="e.g. katamtoy-waterfall" style={inputStyle} />
            </div>
          </div>

          {/* Excerpt */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Short Description</label>
            <textarea value={form.excerpt_en} onChange={e => setForm({ ...form, excerpt_en: e.target.value })} placeholder="Brief description..." rows={3} style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit' }} />
          </div>

          {/* Province + District */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Province</label>
              <select value={form.province} onChange={e => setForm({ ...form, province: e.target.value, district: '', region: e.target.value })} style={inputStyle}>
                <option value="">— Select Province —</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>District</label>
              <select value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} style={{ ...inputStyle, opacity: districtOptions.length === 0 ? 0.4 : 1 }} disabled={districtOptions.length === 0}>
                <option value="">— Select District —</option>
                {districtOptions.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Coordinates */}
          <div style={{ backgroundColor: 'rgba(201,168,76,0.06)', borderRadius: '8px', padding: '20px', marginBottom: '16px', border: '1px solid rgba(201,168,76,0.15)' }}>
            <p style={{ color: '#c9a84c', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px' }}>📍 Location Coordinates</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '10px' }}>
              <div>
                <label style={labelStyle}>Latitude</label>
                <input value={form.location_lat} onChange={e => setForm({ ...form, location_lat: e.target.value })} placeholder="e.g. 14.8167" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Longitude</label>
                <input value={form.location_lng} onChange={e => setForm({ ...form, location_lng: e.target.value })} placeholder="e.g. 107.0833" style={inputStyle} />
              </div>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>
              💡 Get from <a href="https://maps.google.com" target="_blank" style={{ color: '#c9a84c' }}>Google Maps</a> — right click → "What's here?"
            </p>
          </div>

          {/* Images */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Photos</label>
            <input type="file" multiple accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} id="image-upload" />
            <label htmlFor="image-upload" style={{ display: 'block', backgroundColor: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer' }}>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', margin: 0 }}>
                {imageFiles.length === 0 ? '📷 Click to select photos' : `${imageFiles.length} photo${imageFiles.length > 1 ? 's' : ''} selected`}
              </p>
            </label>
            {imagePreviews.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' as const }}>
                {imagePreviews.map((src, i) => (
                  <img key={i} src={src} alt="" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
                ))}
              </div>
            )}
          </div>

          {/* Transport + Status + Guide */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Transport Price</label>
              <input value={form.transport_price} onChange={e => setForm({ ...form, transport_price: e.target.value })} placeholder="e.g. 50,000 LAK" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.has_guide} onChange={e => setForm({ ...form, has_guide: e.target.checked })} style={{ width: '16px', height: '16px', accentColor: '#c9a84c' }} />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>Guide Available</span>
              </label>
            </div>
          </div>

          {/* Alan Travel Standard Rating */}
          <div style={{ backgroundColor: 'rgba(201,168,76,0.06)', borderRadius: '8px', padding: '20px', marginBottom: '24px', border: '1px solid rgba(201,168,76,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <p style={{ color: '#c9a84c', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>★ Alan Travel Standard</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['not_assessed', 'assessed'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setForm({ ...form, assessment_status: s })}
                    style={{ padding: '6px 14px', borderRadius: '4px', border: '1px solid', borderColor: form.assessment_status === s ? '#c9a84c' : 'rgba(255,255,255,0.1)', backgroundColor: form.assessment_status === s ? 'rgba(201,168,76,0.15)' : 'transparent', color: form.assessment_status === s ? '#c9a84c' : 'rgba(255,255,255,0.3)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    {s === 'not_assessed' ? 'Not Assessed' : 'Assessed'}
                  </button>
                ))}
              </div>
            </div>

            {form.assessment_status === 'assessed' && (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '18px' }}>
                {RATINGS.map(dim => {
                  const val = form[dim.key as keyof typeof form] as number | null
                  return (
                    <div key={dim.key}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600 }}>{dim.label}</label>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <button key={n} type="button"
                              onClick={() => setForm({ ...form, [dim.key]: val === n ? null : n })}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: val && n <= val ? '#c9a84c' : 'rgba(255,255,255,0.15)', padding: '2px 3px', lineHeight: 1 }}>
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                      {val ? (
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: 0 }}>{dim.criteria[val - 1]}</p>
                      ) : (
                        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', margin: 0, fontStyle: 'italic' }}>Click stars to rate</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {msg && <p style={{ color: msg.startsWith('✅') ? '#4caf50' : '#e74c3c', fontSize: '13px', marginBottom: '16px' }}>{msg}</p>}

          <button onClick={handleAdd} disabled={uploading} style={{ backgroundColor: uploading ? 'rgba(201,168,76,0.4)' : '#c9a84c', color: '#0a0a0a', padding: '12px 32px', borderRadius: '6px', border: 'none', fontWeight: 800, fontSize: '14px', cursor: uploading ? 'not-allowed' : 'pointer', letterSpacing: '1px', textTransform: 'uppercase' as const }}>
            {uploading ? 'Uploading...' : 'Add Destination'}
          </button>
        </div>

        {/* DESTINATION LIST */}
        <div>
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>All Destinations ({destinations.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
            {destinations.map(d => (
              <div key={d.id} style={{ backgroundColor: '#111', borderRadius: '10px', padding: '18px 20px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {d.image_urls && d.image_urls.length > 0 && (
                    <img src={d.image_urls[0]} alt="" style={{ width: '64px', height: '48px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <p style={{ color: 'white', fontWeight: 700, fontSize: '15px' }}>{d.title_en}</p>
                      <span style={{ backgroundColor: d.status === 'active' ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.06)', color: d.status === 'active' ? '#4caf50' : 'rgba(255,255,255,0.3)', padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>{d.status}</span>
                      <span style={{ backgroundColor: d.assessment_status === 'assessed' ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', color: d.assessment_status === 'assessed' ? '#c9a84c' : 'rgba(255,255,255,0.25)', padding: '2px 10px', borderRadius: '999px', fontSize: '11px' }}>
                        {d.assessment_status === 'assessed' ? '★ Assessed' : 'Not assessed'}
                      </span>
                      {d.district && <span style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#c9a84c', padding: '2px 10px', borderRadius: '999px', fontSize: '11px' }}>{d.district}</span>}
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>/destinations/{d.slug}</p>
                    {d.location_lat && <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginTop: '2px' }}>📍 {d.location_lat}, {d.location_lng}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <a href={`/destinations/${d.slug}`} target="_blank" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', fontWeight: 600 }}>View</a>
                  {deleteId === d.id ? (
                    <>
                      <button onClick={() => handleDelete(d.id)} style={{ backgroundColor: '#c0392b', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>Confirm</button>
                      <button onClick={() => setDeleteId(null)} style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteId(d.id)} style={{ backgroundColor: 'rgba(192,57,43,0.15)', color: '#e74c3c', padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(192,57,43,0.3)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
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
