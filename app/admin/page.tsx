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

const LANGUAGES = ['English', 'Lao', 'Thai', 'French', 'Chinese', 'Vietnamese', 'German', 'Russian', 'Japanese', 'Korean']
const SPECIALTIES = ['Trekking', 'Wildlife', 'Culture & History', 'Photography', 'Fishing', 'Kayaking', 'Village Homestay', 'Bird Watching', 'Motorbike Tours', 'Coffee & Food']

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

const emptyGuideForm = {
  name: '',
  province: '',
  districts: [] as string[],
  languages: [] as string[],
  specialties: [] as string[],
  bio: '',
  phone: '',
  facebook: '',
  experience_years: '',
  is_verified: false,
  status: 'active',
  linked_destination_ids: [] as string[],
}

function findProvinceForDistrict(districtSlug: string): string {
  for (const [province, districts] of Object.entries(PROVINCE_DISTRICTS)) {
    if (districts.some(d => d.slug === districtSlug)) return province
  }
  return ''
}

function toggleArr<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
}

export default function AdminPage() {
  const [tab, setTab] = useState<'destinations' | 'guides' | 'settings'>('destinations')

  // ── Destination state ──────────────────────────────────────
  const [destinations, setDestinations] = useState<any[]>([])
  const [form, setForm] = useState({ ...emptyForm })
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // ── Guide state ────────────────────────────────────────────
  const [guides, setGuides] = useState<any[]>([])
  const [guideForm, setGuideForm] = useState({ ...emptyGuideForm })
  const [guidePhotoFile, setGuidePhotoFile] = useState<File | null>(null)
  const [guidePhotoPreview, setGuidePhotoPreview] = useState('')
  const [existingGuidePhotoUrl, setExistingGuidePhotoUrl] = useState('')
  const [editingGuideId, setEditingGuideId] = useState<string | null>(null)
  const [guideMsg, setGuideMsg] = useState('')
  const [deleteGuideId, setDeleteGuideId] = useState<string | null>(null)
  const [guideUploading, setGuideUploading] = useState(false)

  // ── Site Settings state ────────────────────────────────────
  const [heroImageUrl, setHeroImageUrl] = useState('')
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null)
  const [heroImagePreview, setHeroImagePreview] = useState('')
  const [settingsMsg, setSettingsMsg] = useState('')
  const [settingsUploading, setSettingsUploading] = useState(false)

  useEffect(() => { fetchAll(); fetchGuides(); fetchSiteSettings() }, [])

  useEffect(() => {
    return () => { imagePreviews.forEach(url => URL.revokeObjectURL(url)) }
  }, [imagePreviews])

  // ── Site Settings functions ────────────────────────────────
  async function fetchSiteSettings() {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'hero_image_url')
      .maybeSingle()
    if (data?.value) setHeroImageUrl(data.value)
  }

  async function uploadHeroImage() {
    if (!heroImageFile) return
    setSettingsUploading(true)
    setSettingsMsg('')
    try {
      const ext = heroImageFile.name.split('.').pop() ?? 'jpg'
      const path = `hero.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('site-assets')
        .upload(path, heroImageFile, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(path)
      const { error: dbError } = await supabase
        .from('site_settings')
        .upsert({ key: 'hero_image_url', value: publicUrl })
      if (dbError) throw dbError
      setHeroImageUrl(publicUrl)
      setHeroImageFile(null)
      setHeroImagePreview('')
      setSettingsMsg('Hero image updated successfully!')
    } catch (err: any) {
      setSettingsMsg('Error: ' + err.message)
    } finally {
      setSettingsUploading(false)
    }
  }

  async function removeHeroImage() {
    setSettingsUploading(true)
    setSettingsMsg('')
    try {
      await supabase.from('site_settings').upsert({ key: 'hero_image_url', value: '' })
      setHeroImageUrl('')
      setSettingsMsg('Hero image removed. Homepage will use gradient background.')
    } catch (err: any) {
      setSettingsMsg('Error: ' + err.message)
    } finally {
      setSettingsUploading(false)
    }
  }

  // ── Destination functions ──────────────────────────────────
  async function fetchAll() {
    const { data } = await supabase.from('destinations').select('*').order('created_at', { ascending: false })
    setDestinations(data || [])
  }

  function startEdit(d: any) {
    const province = PROVINCES.includes(d.region) ? d.region : findProvinceForDistrict(d.district || '')
    setEditingId(d.id)
    setExistingImageUrls(d.image_urls || [])
    setImageFiles([])
    setImagePreviews([])
    setMsg('')
    setForm({
      title_en: d.title_en || '',
      slug: d.slug || '',
      excerpt_en: d.excerpt_en || '',
      province,
      district: d.district || '',
      region: d.region || '',
      location_lat: d.location_lat?.toString() || '',
      location_lng: d.location_lng?.toString() || '',
      transport_price: d.transport_price || '',
      has_guide: d.has_guide || false,
      status: d.status || 'active',
      assessment_status: d.assessment_status || 'not_assessed',
      rating_experience: d.rating_experience ?? null,
      rating_accessibility: d.rating_accessibility ?? null,
      rating_authenticity: d.rating_authenticity ?? null,
      rating_tranquility: d.rating_tranquility ?? null,
      rating_traveler_value: d.rating_traveler_value ?? null,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setExistingImageUrls([])
    setForm({ ...emptyForm })
    setImageFiles([])
    setImagePreviews([])
    setMsg('')
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setImageFiles(files)
    imagePreviews.forEach(url => URL.revokeObjectURL(url))
    setImagePreviews(files.map(f => URL.createObjectURL(f)))
  }

  async function uploadImages(files: File[]): Promise<string[] | null> {
    const urls: string[] = []
    for (const file of files) {
      const path = `${form.slug}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('destination-images').upload(path, file, { upsert: true })
      if (error) { setMsg('❌ Image upload failed: ' + error.message); return null }
      const { data: urlData } = supabase.storage.from('destination-images').getPublicUrl(path)
      urls.push(urlData.publicUrl)
    }
    return urls
  }

  function buildPayload(image_urls: string[]) {
    const assessed = form.assessment_status === 'assessed'
    return {
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
      image_urls,
    }
  }

  async function handleAdd() {
    if (!form.title_en || !form.slug) return setMsg('❌ Title and slug are required')
    setUploading(true); setMsg('')
    const newUrls = await uploadImages(imageFiles)
    if (newUrls === null) { setUploading(false); return }
    const { error } = await supabase.from('destinations').insert([buildPayload(newUrls)])
    setUploading(false)
    if (error) return setMsg('❌ ' + error.message)
    setMsg('✅ Added successfully!')
    setForm({ ...emptyForm }); setImageFiles([]); setImagePreviews([])
    fetchAll()
  }

  async function handleSave() {
    if (!form.title_en || !form.slug) return setMsg('❌ Title and slug are required')
    setUploading(true); setMsg('')
    const newUrls = await uploadImages(imageFiles)
    if (newUrls === null) { setUploading(false); return }
    const { error } = await supabase.from('destinations').update(buildPayload([...existingImageUrls, ...newUrls])).eq('id', editingId)
    setUploading(false)
    if (error) return setMsg('❌ ' + error.message)
    setMsg('✅ Saved successfully!')
    cancelEdit(); fetchAll()
  }

  async function handleDelete(id: string) {
    await supabase.from('destinations').delete().eq('id', id)
    setDeleteId(null); fetchAll()
  }

  // ── Guide functions ────────────────────────────────────────
  async function fetchGuides() {
    const { data } = await supabase
      .from('guides')
      .select('*, guide_destinations(destination_id)')
      .order('created_at', { ascending: false })
    setGuides(data || [])
  }

  async function uploadGuidePhoto(file: File, name: string): Promise<string | null> {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('guide-photos').upload(path, file, { upsert: true })
    if (error) { setGuideMsg('❌ Photo upload failed: ' + error.message); return null }
    return supabase.storage.from('guide-photos').getPublicUrl(path).data.publicUrl
  }

  async function saveGuideDestinations(guideId: string, destIds: string[]) {
    await supabase.from('guide_destinations').delete().eq('guide_id', guideId)
    if (destIds.length > 0) {
      await supabase.from('guide_destinations').insert(destIds.map(did => ({ guide_id: guideId, destination_id: did })))
    }
  }

  function buildGuidePayload(photo_url: string | null) {
    return {
      name: guideForm.name,
      photo_url,
      province: guideForm.province,
      districts: guideForm.districts,
      languages: guideForm.languages,
      specialties: guideForm.specialties,
      bio: guideForm.bio,
      phone: guideForm.phone,
      facebook: guideForm.facebook,
      experience_years: guideForm.experience_years ? parseInt(guideForm.experience_years) : null,
      is_verified: guideForm.is_verified,
      status: guideForm.status,
    }
  }

  async function handleAddGuide() {
    if (!guideForm.name) return setGuideMsg('❌ Name is required')
    setGuideUploading(true); setGuideMsg('')
    let photo_url: string | null = null
    if (guidePhotoFile) {
      photo_url = await uploadGuidePhoto(guidePhotoFile, guideForm.name)
      if (!photo_url) { setGuideUploading(false); return }
    }
    const { data, error } = await supabase.from('guides').insert([buildGuidePayload(photo_url)]).select().single()
    if (error || !data) { setGuideUploading(false); return setGuideMsg('❌ ' + (error?.message || 'Failed')) }
    await saveGuideDestinations(data.id, guideForm.linked_destination_ids)
    setGuideUploading(false)
    setGuideMsg('✅ Guide added!')
    setGuideForm({ ...emptyGuideForm }); setGuidePhotoFile(null); setGuidePhotoPreview('')
    fetchGuides()
  }

  async function handleSaveGuide() {
    if (!guideForm.name) return setGuideMsg('❌ Name is required')
    setGuideUploading(true); setGuideMsg('')
    let photo_url: string | null = existingGuidePhotoUrl || null
    if (guidePhotoFile) {
      photo_url = await uploadGuidePhoto(guidePhotoFile, guideForm.name)
      if (!photo_url) { setGuideUploading(false); return }
    }
    const { error } = await supabase.from('guides').update(buildGuidePayload(photo_url)).eq('id', editingGuideId)
    if (error) { setGuideUploading(false); return setGuideMsg('❌ ' + error.message) }
    await saveGuideDestinations(editingGuideId!, guideForm.linked_destination_ids)
    setGuideUploading(false)
    setGuideMsg('✅ Saved!')
    cancelEditGuide(); fetchGuides()
  }

  function startEditGuide(g: any) {
    setEditingGuideId(g.id)
    setExistingGuidePhotoUrl(g.photo_url || '')
    setGuidePhotoFile(null); setGuidePhotoPreview(''); setGuideMsg('')
    setGuideForm({
      name: g.name || '',
      province: g.province || '',
      districts: g.districts || [],
      languages: g.languages || [],
      specialties: g.specialties || [],
      bio: g.bio || '',
      phone: g.phone || '',
      facebook: g.facebook || '',
      experience_years: g.experience_years?.toString() || '',
      is_verified: g.is_verified || false,
      status: g.status || 'active',
      linked_destination_ids: (g.guide_destinations || []).map((gd: any) => gd.destination_id),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEditGuide() {
    setEditingGuideId(null)
    setExistingGuidePhotoUrl('')
    setGuidePhotoFile(null); setGuidePhotoPreview('')
    setGuideForm({ ...emptyGuideForm }); setGuideMsg('')
  }

  async function handleDeleteGuide(id: string) {
    await supabase.from('guides').delete().eq('id', id)
    setDeleteGuideId(null); fetchGuides()
  }

  // ── Shared styles ──────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px', padding: '10px 14px', color: 'white', fontSize: '14px',
    boxSizing: 'border-box', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px',
    textTransform: 'uppercase', marginBottom: '6px', display: 'block',
  }

  function chipStyle(active: boolean): React.CSSProperties {
    return {
      padding: '5px 12px', borderRadius: '999px', cursor: 'pointer',
      border: `1px solid ${active ? '#c9a84c' : 'rgba(255,255,255,0.1)'}`,
      backgroundColor: active ? 'rgba(201,168,76,0.15)' : 'transparent',
      color: active ? '#c9a84c' : 'rgba(255,255,255,0.4)',
      fontSize: '12px', fontWeight: active ? 600 : 400,
      background: active ? 'rgba(201,168,76,0.15)' : 'transparent',
    }
  }

  const districtOptions = form.province ? (PROVINCE_DISTRICTS[form.province] || []) : []
  const guideDistrictOptions = guideForm.province ? (PROVINCE_DISTRICTS[guideForm.province] || []) : []

  return (
    <main className="admin-page-pad" style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 800, color: 'white', letterSpacing: '-1px' }}>Admin Panel</h1>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginTop: '4px' }}>Alan Coffee & Travel</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <a href="/" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', textDecoration: 'none' }}>← Back to Site</a>
            <button
              onClick={async () => {
                await fetch('/api/admin/logout', { method: 'POST' })
                window.location.href = '/admin/login'
              }}
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '7px 16px', fontSize: '12px', cursor: 'pointer', fontWeight: 600, letterSpacing: '0.5px' }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', marginBottom: '36px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {(['destinations', 'guides', 'settings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '12px 28px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === t ? '2px solid #c9a84c' : '2px solid transparent',
              color: tab === t ? '#c9a84c' : 'rgba(255,255,255,0.4)',
              fontWeight: tab === t ? 700 : 500, fontSize: '14px',
              letterSpacing: '0.5px', marginBottom: '-1px',
            }}>
              {t === 'destinations' ? `Destinations (${destinations.length})` : t === 'guides' ? `Guides (${guides.length})` : 'Site Settings'}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════
            DESTINATIONS TAB
        ═══════════════════════════════════════════════════ */}
        {tab === 'destinations' && (
          <>
            <div style={{ backgroundColor: '#111', borderRadius: '12px', padding: '32px', marginBottom: '40px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <h2 style={{ color: '#c9a84c', fontSize: '16px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', margin: 0 }}>
                  {editingId ? 'Edit Destination' : 'Add Destination'}
                </h2>
                {editingId && (
                  <button onClick={cancelEdit} style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 16px', cursor: 'pointer', fontSize: '13px' }}>
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="admin-grid-2">
                <div>
                  <label style={labelStyle}>Title (EN) *</label>
                  <input value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })} placeholder="e.g. Katamtoy Waterfall" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Slug *</label>
                  <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="e.g. katamtoy-waterfall" style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Short Description</label>
                <textarea value={form.excerpt_en} onChange={e => setForm({ ...form, excerpt_en: e.target.value })} placeholder="Brief description..." rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              <div className="admin-grid-2">
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

              <div style={{ backgroundColor: 'rgba(201,168,76,0.06)', borderRadius: '8px', padding: '20px', marginBottom: '16px', border: '1px solid rgba(201,168,76,0.15)' }}>
                <p style={{ color: '#c9a84c', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px' }}>📍 Location Coordinates</p>
                <div className="admin-grid-2" style={{ marginBottom: '10px' }}>
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

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Photos</label>
                {existingImageUrls.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginBottom: '8px' }}>Saved photos — click × to remove</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {existingImageUrls.map((url, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={url} alt="" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)' }} />
                          <button type="button" onClick={() => setExistingImageUrls(prev => prev.filter((_, idx) => idx !== i))}
                            style={{ position: 'absolute', top: '-7px', right: '-7px', background: '#c0392b', color: 'white', border: 'none', borderRadius: '999px', width: '20px', height: '20px', cursor: 'pointer', fontSize: '13px', lineHeight: '20px', textAlign: 'center', padding: 0 }}>
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <input type="file" multiple accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} id="image-upload" />
                <label htmlFor="image-upload" style={{ display: 'block', backgroundColor: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer' }}>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', margin: 0 }}>
                    {imageFiles.length === 0 ? '📷 Click to add photos' : `${imageFiles.length} photo${imageFiles.length > 1 ? 's' : ''} selected`}
                  </p>
                </label>
                {imagePreviews.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {imagePreviews.map((src, i) => (
                      <img key={i} src={src} alt="" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(201,168,76,0.3)' }} />
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-grid-3">
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {RATINGS.map(dim => {
                      const val = form[dim.key as keyof typeof form] as number | null
                      return (
                        <div key={dim.key}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600 }}>{dim.label}</label>
                            <div style={{ display: 'flex', gap: '2px' }}>
                              {[1, 2, 3, 4, 5].map(n => (
                                <button key={n} type="button" onClick={() => setForm({ ...form, [dim.key]: val === n ? null : n })}
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

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button onClick={editingId ? handleSave : handleAdd} disabled={uploading}
                  style={{ backgroundColor: uploading ? 'rgba(201,168,76,0.4)' : '#c9a84c', color: '#0a0a0a', padding: '12px 32px', borderRadius: '6px', border: 'none', fontWeight: 800, fontSize: '14px', cursor: uploading ? 'not-allowed' : 'pointer', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {uploading ? 'Saving...' : editingId ? 'Save Changes' : 'Add Destination'}
                </button>
                {editingId && (
                  <button onClick={cancelEdit} style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '12px 24px', cursor: 'pointer', fontSize: '14px' }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div>
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>All Destinations ({destinations.length})</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                      <button onClick={() => startEdit(d)} style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#c9a84c', padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(201,168,76,0.2)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
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
          </>
        )}

        {/* ═══════════════════════════════════════════════════
            GUIDES TAB
        ═══════════════════════════════════════════════════ */}
        {tab === 'guides' && (
          <>
            {/* Guide form */}
            <div style={{ backgroundColor: '#111', borderRadius: '12px', padding: '32px', marginBottom: '40px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <h2 style={{ color: '#c9a84c', fontSize: '16px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', margin: 0 }}>
                  {editingGuideId ? 'Edit Guide' : 'Add Guide'}
                </h2>
                {editingGuideId && (
                  <button onClick={cancelEditGuide} style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 16px', cursor: 'pointer', fontSize: '13px' }}>
                    Cancel Edit
                  </button>
                )}
              </div>

              {/* Photo + Name row */}
              <div className="admin-grid-photo">
                <div>
                  <label style={labelStyle}>Photo</label>
                  <input type="file" accept="image/*" id="guide-photo-upload" style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null
                      setGuidePhotoFile(file)
                      setGuidePhotoPreview(file ? URL.createObjectURL(file) : '')
                    }} />
                  <label htmlFor="guide-photo-upload" style={{ cursor: 'pointer', display: 'block' }}>
                    {(guidePhotoPreview || existingGuidePhotoUrl) ? (
                      <img src={guidePhotoPreview || existingGuidePhotoUrl} alt=""
                        style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #c9a84c', display: 'block' }} />
                    ) : (
                      <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)', border: '2px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                        👤
                      </div>
                    )}
                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', textAlign: 'center', marginTop: '6px' }}>Click to change</p>
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>Full Name *</label>
                    <input value={guideForm.name} onChange={e => setGuideForm({ ...guideForm, name: e.target.value })} placeholder="Guide's full name" style={inputStyle} />
                  </div>
                  <div className="admin-grid-3" style={{ gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Experience (yrs)</label>
                      <input type="number" min="0" max="50" value={guideForm.experience_years} onChange={e => setGuideForm({ ...guideForm, experience_years: e.target.value })} placeholder="e.g. 5" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Status</label>
                      <select value={guideForm.status} onChange={e => setGuideForm({ ...guideForm, status: e.target.value })} style={inputStyle}>
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={guideForm.is_verified} onChange={e => setGuideForm({ ...guideForm, is_verified: e.target.checked })} style={{ width: '16px', height: '16px', accentColor: '#c9a84c' }} />
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Verified</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Province */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Primary Province</label>
                <select value={guideForm.province} onChange={e => setGuideForm({ ...guideForm, province: e.target.value, districts: [] })} style={inputStyle}>
                  <option value="">— Select Province —</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Districts (chips) */}
              {guideDistrictOptions.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Districts Covered</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {guideDistrictOptions.map(d => (
                      <button key={d.slug} type="button"
                        onClick={() => setGuideForm({ ...guideForm, districts: toggleArr(guideForm.districts, d.slug) })}
                        style={chipStyle(guideForm.districts.includes(d.slug))}>
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Languages (chips) */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Languages Spoken</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {LANGUAGES.map(lang => (
                    <button key={lang} type="button"
                      onClick={() => setGuideForm({ ...guideForm, languages: toggleArr(guideForm.languages, lang) })}
                      style={chipStyle(guideForm.languages.includes(lang))}>
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specialties (chips) */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Specialties</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {SPECIALTIES.map(sp => (
                    <button key={sp} type="button"
                      onClick={() => setGuideForm({ ...guideForm, specialties: toggleArr(guideForm.specialties, sp) })}
                      style={chipStyle(guideForm.specialties.includes(sp))}>
                      {sp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bio */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Bio</label>
                <textarea value={guideForm.bio} onChange={e => setGuideForm({ ...guideForm, bio: e.target.value })} placeholder="Brief description of the guide, experience, personality..." rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              {/* Contact */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Phone / WhatsApp</label>
                  <input value={guideForm.phone} onChange={e => setGuideForm({ ...guideForm, phone: e.target.value })} placeholder="+856 20 ..." style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Facebook URL</label>
                  <input value={guideForm.facebook} onChange={e => setGuideForm({ ...guideForm, facebook: e.target.value })} placeholder="https://facebook.com/..." style={inputStyle} />
                </div>
              </div>

              {/* Linked destinations */}
              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Linked Destinations</label>
                <div style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', padding: '8px 12px' }}>
                  {destinations.filter(d => d.status === 'active').length === 0 ? (
                    <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', padding: '8px 0' }}>No active destinations yet</p>
                  ) : destinations.filter(d => d.status === 'active').map(d => (
                    <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <input type="checkbox"
                        checked={guideForm.linked_destination_ids.includes(d.id)}
                        onChange={() => setGuideForm({ ...guideForm, linked_destination_ids: toggleArr(guideForm.linked_destination_ids, d.id) })}
                        style={{ accentColor: '#c9a84c', flexShrink: 0 }} />
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>{d.title_en}</span>
                      {d.district && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', marginLeft: 'auto' }}>{d.district}</span>}
                    </label>
                  ))}
                </div>
              </div>

              {guideMsg && <p style={{ color: guideMsg.startsWith('✅') ? '#4caf50' : '#e74c3c', fontSize: '13px', marginBottom: '16px' }}>{guideMsg}</p>}

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button onClick={editingGuideId ? handleSaveGuide : handleAddGuide} disabled={guideUploading}
                  style={{ backgroundColor: guideUploading ? 'rgba(201,168,76,0.4)' : '#c9a84c', color: '#0a0a0a', padding: '12px 32px', borderRadius: '6px', border: 'none', fontWeight: 800, fontSize: '14px', cursor: guideUploading ? 'not-allowed' : 'pointer', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {guideUploading ? 'Saving...' : editingGuideId ? 'Save Guide' : 'Add Guide'}
                </button>
                {editingGuideId && (
                  <button onClick={cancelEditGuide} style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '12px 24px', cursor: 'pointer', fontSize: '14px' }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Guide list */}
            <div>
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>All Guides ({guides.length})</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {guides.length === 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>No guides yet. Add the first one above.</p>
                )}
                {guides.map(g => (
                  <div key={g.id} style={{ backgroundColor: '#111', borderRadius: '10px', padding: '18px 20px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                      {g.photo_url ? (
                        <img src={g.photo_url} alt="" style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(201,168,76,0.3)', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>👤</div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <p style={{ color: 'white', fontWeight: 700, fontSize: '15px', margin: 0 }}>{g.name}</p>
                          {g.is_verified && <span style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: '#c9a84c', padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>✓ Verified</span>}
                          <span style={{ backgroundColor: g.status === 'active' ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.06)', color: g.status === 'active' ? '#4caf50' : 'rgba(255,255,255,0.3)', padding: '2px 10px', borderRadius: '999px', fontSize: '11px' }}>{g.status}</span>
                          {g.province && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>{g.province}</span>}
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: 0 }}>
                          {[g.languages?.join(' · '), g.experience_years && `${g.experience_years}y exp`].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button onClick={() => startEditGuide(g)} style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#c9a84c', padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(201,168,76,0.2)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                      {deleteGuideId === g.id ? (
                        <>
                          <button onClick={() => handleDeleteGuide(g.id)} style={{ backgroundColor: '#c0392b', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>Confirm</button>
                          <button onClick={() => setDeleteGuideId(null)} style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteGuideId(g.id)} style={{ backgroundColor: 'rgba(192,57,43,0.15)', color: '#e74c3c', padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(192,57,43,0.3)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════
            SITE SETTINGS TAB
        ═══════════════════════════════════════════════════ */}
        {tab === 'settings' && (
          <div style={{ backgroundColor: '#111', borderRadius: '12px', padding: '32px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ color: '#c9a84c', fontSize: '16px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 6px' }}>
              Site Settings
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginBottom: '32px' }}>
              Manage site-wide assets and configuration.
            </p>

            {/* ── Hero Image ─────────────────────────────── */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '28px' }}>
              <h3 style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>
                Homepage Hero Image
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '12px', lineHeight: 1.65, marginBottom: '24px', maxWidth: '540px' }}>
                This image fills the full-screen hero section on the homepage. A dark overlay is applied automatically so text stays readable.
                Recommended: 1920×1080px or wider, landscape orientation, JPG or WebP.
              </p>

              {/* Current image preview */}
              {heroImageUrl ? (
                <div style={{ marginBottom: '28px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>
                    Current Hero Image
                  </p>
                  <div style={{ position: 'relative', maxWidth: '600px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <img src={heroImageUrl} alt="Current hero" style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.65) 100%)', display: 'flex', alignItems: 'flex-end', padding: '14px 16px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.5px' }}>
                        ✓ Live on homepage
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '28px', padding: '28px 20px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center' }}>
                  <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: '13px', margin: 0 }}>
                    No hero image set — homepage displays gradient background
                  </p>
                </div>
              )}

              {/* Upload new */}
              <div style={{ marginBottom: '24px' }}>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>
                  {heroImageUrl ? 'Replace Image' : 'Upload Image'}
                </p>
                <input
                  type="file" accept="image/*" id="hero-image-upload"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0] ?? null
                    setHeroImageFile(file)
                    setHeroImagePreview(file ? URL.createObjectURL(file) : '')
                  }}
                />
                <label htmlFor="hero-image-upload" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  cursor: 'pointer', backgroundColor: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.6)', padding: '10px 20px',
                  borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '13px', fontWeight: 500,
                }}>
                  Choose File
                </label>
                {heroImageFile && (
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginLeft: '12px' }}>
                    {heroImageFile.name}
                  </span>
                )}

                {/* New image preview */}
                {heroImagePreview && (
                  <div style={{ marginTop: '16px', maxWidth: '600px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(201,168,76,0.25)' }}>
                    <img src={heroImagePreview} alt="Preview" style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', display: 'block' }} />
                    <p style={{ backgroundColor: 'rgba(201,168,76,0.06)', color: 'rgba(255,255,255,0.35)', fontSize: '11px', padding: '8px 14px', margin: 0, letterSpacing: '0.5px' }}>
                      Preview — not yet saved
                    </p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  disabled={!heroImageFile || settingsUploading}
                  onClick={uploadHeroImage}
                  style={{
                    backgroundColor: heroImageFile && !settingsUploading ? '#c9a84c' : 'rgba(201,168,76,0.15)',
                    color: heroImageFile && !settingsUploading ? '#0a0a0a' : 'rgba(201,168,76,0.35)',
                    padding: '11px 32px', borderRadius: '6px', border: 'none',
                    fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px',
                    cursor: heroImageFile && !settingsUploading ? 'pointer' : 'not-allowed',
                  }}
                >
                  {settingsUploading ? 'Uploading…' : 'Save Hero Image'}
                </button>
                {heroImageUrl && (
                  <button
                    disabled={settingsUploading}
                    onClick={removeHeroImage}
                    style={{ backgroundColor: 'rgba(192,57,43,0.1)', color: '#e74c3c', padding: '11px 20px', borderRadius: '6px', border: '1px solid rgba(192,57,43,0.25)', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Remove Image
                  </button>
                )}
              </div>

              {settingsMsg && (
                <p style={{ marginTop: '16px', color: settingsMsg.startsWith('Error') ? '#e74c3c' : '#4caf50', fontSize: '13px', fontWeight: 600 }}>
                  {settingsMsg}
                </p>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
