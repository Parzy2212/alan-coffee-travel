'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { useLang } from '@/contexts/LanguageContext'
import { tr } from '@/lib/translations'

const GOLD = '#c9a84c'

type Experience = {
  id: string
  slug: string | null
  title_en: string | null
  title_lo: string | null
  summary_en: string | null
  cover_image_url: string | null
  category: string | null
  region: string | null
  difficulty: string | null
  duration_hours: number | null
  duration_days: number | null
  price_per_person_lak: number | null
  min_group: number | null
  max_group: number | null
  featured: boolean | null
  status: string | null
  rating_avg: number | null
  review_count: number | null
  guides: { name: string; profile_photo_url: string | null; photo_url: string | null } | null
}

function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  const r = Math.round(rating * 2) / 2
  return (
    <span style={{ color: GOLD, fontSize: size, letterSpacing: 1 }}>
      {[1,2,3,4,5].map(i => <span key={i} style={{ opacity: i <= r ? 1 : 0.25 }}>★</span>)}
    </span>
  )
}

export default function ExperiencesPage() {
  const { lang } = useLang()
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const [region, setRegion]     = useState('all')
  const [difficulty, setDiff]   = useState('all')
  const [sort, setSort]         = useState<'featured' | 'price' | 'pop' | 'rating'>('featured')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('experiences')
          .select('*, guides(name, profile_photo_url, photo_url)')
          .eq('status', 'active')
          .order('featured', { ascending: false })
        if (err) {
          console.error('Experiences page: failed to load experiences', err)
          setError(tr('fetch_error_msg', lang))
          setLoading(false)
          return
        }
        setExperiences((data as Experience[]) ?? [])
        setLoading(false)
      } catch (err) {
        console.error('Experiences page: failed to load experiences', err)
        setError(tr('fetch_error_msg', lang))
        setLoading(false)
      }
    })()
  }, [])

  const categories = useMemo(() => Array.from(new Set(experiences.map(e => e.category).filter(Boolean))).sort() as string[], [experiences])
  const regions    = useMemo(() => Array.from(new Set(experiences.map(e => e.region).filter(Boolean))).sort() as string[], [experiences])
  const difficulties = useMemo(() => Array.from(new Set(experiences.map(e => e.difficulty).filter(Boolean))).sort() as string[], [experiences])

  const filtered = useMemo(() => {
    let list = experiences.filter(e => {
      if (category !== 'all' && e.category !== category) return false
      if (region !== 'all' && e.region !== region) return false
      if (difficulty !== 'all' && e.difficulty !== difficulty) return false
      return true
    })
    if (sort === 'price')   list = [...list].sort((a, b) => (a.price_per_person_lak ?? 0) - (b.price_per_person_lak ?? 0))
    if (sort === 'pop')     list = [...list].sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0))
    if (sort === 'rating')  list = [...list].sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0))
    if (sort === 'featured') list = [...list].sort((a, b) => Number(b.featured ?? 0) - Number(a.featured ?? 0))
    return list
  }, [experiences, category, region, difficulty, sort])

  const selStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: 'white', padding: '10px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', outline: 'none',
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-black)' }}>
      <Navbar />

      {/* HERO */}
      <section className="hero-section-sm" style={{ backgroundColor: 'var(--color-black)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ height: 1, width: 32, backgroundColor: GOLD }} />
            <span style={{ color: GOLD, fontSize: 11, fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' }}>{tr('exp_eyebrow', lang)}</span>
          </div>
          <h1 className="hero-h1-lg" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'white', marginBottom: 16 }}>
            {tr('exp_h1', lang)}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, lineHeight: 1.6, maxWidth: 560, marginBottom: 28 }}>
            {tr('exp_sub', lang)}
          </p>
          <a href="/become-a-guide" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: GOLD, fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(201,168,76,0.35)', padding: '8px 18px', borderRadius: 6 }}>
            {tr('nav_become_guide', lang)} →
          </a>
        </div>
      </section>

      {/* FILTERS */}
      <section style={{ backgroundColor: '#0c0c0c', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={category} onChange={e => setCategory(e.target.value)} style={selStyle}>
            <option value="all">{tr('exp_all_cats', lang)}</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={region} onChange={e => setRegion(e.target.value)} style={selStyle}>
            <option value="all">{tr('exp_all_regions', lang)}</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={difficulty} onChange={e => setDiff(e.target.value)} style={selStyle}>
            <option value="all">{tr('exp_all_diff', lang)}</option>
            {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} style={selStyle}>
            <option value="featured">{tr('exp_sort_feat', lang)}</option>
            <option value="price">{tr('exp_sort_price', lang)}</option>
            <option value="pop">{tr('exp_sort_pop', lang)}</option>
            <option value="rating">{tr('exp_sort_rating', lang)}</option>
          </select>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginLeft: 'auto' }}>
            {loading ? '…' : `${filtered.length} ${filtered.length === 1 ? tr('exp_singular', lang) : tr('exp_plural', lang)}`}
          </span>
        </div>
      </section>

      {/* GRID */}
      <section style={{ padding: '48px 20px', maxWidth: 1280, margin: '0 auto' }}>
        {loading ? (
          <div className="grid-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ backgroundColor: '#111', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div className="skeleton" style={{ height: 200 }} />
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="skeleton" style={{ height: 18, width: '60%' }} />
                  <div className="skeleton" style={{ height: 13, width: '80%' }} />
                  <div className="skeleton" style={{ height: 13, width: '45%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>⚠️ {error}</p>
            <button onClick={() => window.location.reload()} style={{ backgroundColor: GOLD, color: '#000', padding: '10px 24px', borderRadius: 6, border: 'none', fontWeight: 700, cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🗺️</div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>{tr('exp_no_results', lang)}</p>
          </div>
        ) : (
          <div className="grid-3">
            {filtered.map(exp => {
              const href = `/experiences/${exp.slug ?? exp.id}`
              const hovered = hoveredId === exp.id
              const guide = exp.guides
              const guidePhoto = guide ? (guide.profile_photo_url ?? guide.photo_url) : null
              return (
                <a key={exp.id} href={href}
                  onMouseEnter={() => setHoveredId(exp.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{ backgroundColor: '#111', borderRadius: 14, overflow: 'hidden', border: `1px solid ${hovered ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.07)'}`, display: 'flex', flexDirection: 'column', transform: hovered ? 'translateY(-4px)' : 'none', boxShadow: hovered ? '0 20px 60px rgba(0,0,0,0.5)' : 'none', transition: 'all 0.22s ease', textDecoration: 'none' }}>

                  {/* Cover image */}
                  {exp.cover_image_url ? (
                    <div style={{ height: 200, overflow: 'hidden', position: 'relative' }}>
                      <img src={exp.cover_image_url} alt={exp.title_en ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s', transform: hovered ? 'scale(1.04)' : 'scale(1)' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.6))' }} />
                      {exp.featured && (
                        <div style={{ position: 'absolute', top: 12, left: 12, backgroundColor: GOLD, color: '#000', padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700 }}>★ FEATURED</div>
                      )}
                    </div>
                  ) : (
                    <div style={{ height: 6, backgroundColor: 'rgba(201,168,76,0.25)' }} />
                  )}

                  <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Category + duration */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {exp.category && <span style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: GOLD, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{exp.category}</span>}
                      {exp.difficulty && <span style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', padding: '2px 8px', borderRadius: 99, fontSize: 11 }}>{exp.difficulty}</span>}
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginLeft: 'auto' }}>
                        {exp.duration_days ? `${exp.duration_days} ${tr('exp_days', lang)}` : exp.duration_hours ? `${exp.duration_hours} ${tr('exp_hrs', lang)}` : null}
                      </span>
                    </div>

                    <h2 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17, margin: 0, lineHeight: 1.3 }}>
                      {exp.title_en ?? ''}
                    </h2>

                    {exp.summary_en && (
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 1.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
                        {exp.summary_en}
                      </p>
                    )}

                    {/* Guide byline */}
                    {guide && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        {guidePhoto && <img src={guidePhoto} alt={guide.name} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />}
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{guide.name}</span>
                      </div>
                    )}

                    {/* Rating */}
                    {(exp.rating_avg ?? 0) > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <StarRating rating={exp.rating_avg!} />
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{exp.rating_avg!.toFixed(1)}</span>
                        {(exp.review_count ?? 0) > 0 && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>({exp.review_count})</span>}
                      </div>
                    )}

                    <div style={{ flex: 1 }} />

                    {/* Price + region */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {exp.price_per_person_lak ? (
                        <div>
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{tr('exp_from', lang)} </span>
                          <span style={{ color: GOLD, fontWeight: 700, fontSize: 16 }}>{Number(exp.price_per_person_lak).toLocaleString()} ₭</span>
                          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}> / {tr('exp_per_person', lang)}</span>
                        </div>
                      ) : <div />}
                      {exp.region && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>{exp.region}</span>}
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </section>

      {/* BECOME A GUIDE CTA */}
      <section style={{ background: 'linear-gradient(135deg, #0d0d0d 0%, #151208 100%)', borderTop: '1px solid rgba(201,168,76,0.1)', borderBottom: '1px solid rgba(201,168,76,0.1)', padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', backgroundColor: 'rgba(201,168,76,0.1)', color: GOLD, padding: '6px 16px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 24 }}>
            {tr('bag_eyebrow', lang)}
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 800, color: 'white', letterSpacing: '-1px', lineHeight: 1.2, marginBottom: 16 }}>
            {tr('bag_h1', lang)}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16, lineHeight: 1.7, marginBottom: 32 }}>
            {tr('bag_sub', lang)}
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/become-a-guide" style={{ backgroundColor: GOLD, color: '#000', padding: '14px 32px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
              {tr('bag_apply', lang)}
            </a>
            <a href="/contact" style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)', padding: '14px 28px', borderRadius: 8, textDecoration: 'none', fontSize: 14, border: '1px solid rgba(255,255,255,0.12)' }}>
              {tr('guides_cta_btn', lang)}
            </a>
          </div>
        </div>
      </section>

      <footer style={{ backgroundColor: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 20px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, color: 'white' }}>ALAN</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', marginLeft: 8 }}>Coffee & Travel</span>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 }}>{tr('footer_copy', lang)}</p>
            <a href="tel:+8562094366635" style={{ color: 'var(--color-gold)', fontSize: 12, textDecoration: 'none', fontWeight: 600, display: 'inline-block', marginTop: 4 }}>📞 +856 20 94 366 635</a>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            {['/destinations','/guides','/experiences','/about','/contact'].map(href => (
              <a key={href} href={href} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textDecoration: 'none' }}>{href.slice(1).charAt(0).toUpperCase() + href.slice(2)}</a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  )
}
