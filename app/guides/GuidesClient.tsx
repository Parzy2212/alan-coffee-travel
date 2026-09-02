'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { useLang } from '@/contexts/LanguageContext'
import { tr } from '@/lib/translations'

type Guide = {
  id: string
  slug: string | null
  name: string
  profile_photo_url: string | null
  photo_url: string | null
  cover_photo_url: string | null
  province: string | null
  languages: string[] | null
  languages_spoken: string[] | null
  specialties: string[] | null
  bio: string | null
  bio_en: string | null
  bio_th: string | null
  bio_lo: string | null
  phone: string | null
  contact_phone: string | null
  contact_whatsapp: string | null
  contact_line: string | null
  contact_telegram: string | null
  facebook: string | null
  experience_years: number | null
  years_experience: number | null
  is_verified: boolean | null
  verified: boolean | null
  featured: boolean | null
  active: boolean | null
  status: string | null
  rating_avg: number | null
  review_count: number | null
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  const r = Math.round(rating * 2) / 2
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ color: '#c9a84c', fontSize: 13, letterSpacing: 1 }}>
        {[1,2,3,4,5].map(i => (
          <span key={i} style={{ opacity: i <= r ? 1 : 0.25 }}>★</span>
        ))}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{rating.toFixed(1)}</span>
      {count > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>({count})</span>}
    </div>
  )
}

export default function GuidesClient() {
  const { lang } = useLang()
  const [guides,    setGuides]    = useState<Guide[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [province,  setProvince]  = useState('all')
  const [language,  setLanguage]  = useState('all')
  const [sort,      setSort]      = useState<'featured' | 'rating' | 'exp'>('featured')
  const [search,    setSearch]    = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('guides')
          .select('*')
          .or('status.eq.active,active.eq.true')
          .order('featured', { ascending: false })
        if (err) {
          console.error('Guides page: failed to load guides', err)
          setError(tr('fetch_error_msg', lang))
          setLoading(false)
          return
        }
        setGuides((data as Guide[]) ?? [])
        setLoading(false)
      } catch (err) {
        console.error('Guides page: failed to load guides', err)
        setError(tr('fetch_error_msg', lang))
        setLoading(false)
      }
    })()
  }, [])

  const provinces = useMemo(() => {
    const s = new Set<string>()
    guides.forEach(g => { if (g.province) s.add(g.province) })
    return Array.from(s).sort()
  }, [guides])

  const allLanguages = useMemo(() => {
    const s = new Set<string>()
    guides.forEach(g => {
      ;(g.languages_spoken ?? g.languages ?? []).forEach(l => s.add(l))
    })
    return Array.from(s).sort()
  }, [guides])

  const filtered = useMemo(() => {
    let list = guides.filter(g => {
      if (province !== 'all' && g.province !== province) return false
      const langs = g.languages_spoken ?? g.languages ?? []
      if (language !== 'all' && !langs.includes(language)) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = `${g.name} ${g.bio_en ?? g.bio ?? ''} ${(g.specialties ?? []).join(' ')} ${g.province ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (sort === 'rating')   list = [...list].sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0))
    if (sort === 'exp')      list = [...list].sort((a, b) => ((b.years_experience ?? b.experience_years ?? 0) - (a.years_experience ?? a.experience_years ?? 0)))
    if (sort === 'featured') list = [...list].sort((a, b) => Number(b.featured ?? 0) - Number(a.featured ?? 0))
    return list
  }, [guides, province, language, search, sort])

  const selStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white', padding: '10px 14px', borderRadius: 6,
    fontSize: 13, cursor: 'pointer', outline: 'none',
    minHeight: 44, boxSizing: 'border-box',
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-black)' }}>
      <Navbar />

      {/* HERO */}
      <section className="hero-section-sm" style={{ backgroundColor: 'var(--color-black)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ height: 1, width: 32, backgroundColor: 'var(--color-gold)' }} />
            <span style={{ color: 'var(--color-gold)', fontSize: 11, fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' }}>{tr('guides_eyebrow', lang)}</span>
          </div>
          <h1 className="hero-h1-lg" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'white', marginBottom: 16 }}>
            {tr('guides_h1', lang)}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, lineHeight: 1.6, maxWidth: 560, marginBottom: 28 }}>
            {tr('guides_sub', lang)}
          </p>
          <a href="/become-a-guide" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--color-gold)', fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(201,168,76,0.35)', padding: '8px 18px', borderRadius: 6 }}>
            {tr('nav_become_guide', lang)} →
          </a>
        </div>
      </section>

      {/* FILTERS */}
      <section style={{ backgroundColor: '#0c0c0c', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr('guides_search', lang)}
            style={{ ...selStyle, minWidth: 200, flex: '0 1 220px' }} />
          <select value={province} onChange={e => setProvince(e.target.value)} style={selStyle} aria-label={tr('guides_all_provinces', lang)}>
            <option value="all">{tr('guides_all_provinces', lang)}</option>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={language} onChange={e => setLanguage(e.target.value)} style={selStyle} aria-label={tr('guides_all_languages', lang)}>
            <option value="all">{tr('guides_all_languages', lang)}</option>
            {allLanguages.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} style={selStyle} aria-label="Sort by">
            <option value="featured">{tr('guides_sort_feat', lang)}</option>
            <option value="rating">{tr('guides_sort_rating', lang)}</option>
            <option value="exp">{tr('guides_sort_exp', lang)}</option>
          </select>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginLeft: 'auto' }}>
            {loading ? '…' : `${filtered.length} ${filtered.length === 1 ? tr('guides_singular', lang) : tr('guides_plural', lang)}`}
          </span>
        </div>
      </section>

      {/* GRID */}
      <section style={{ padding: '48px 20px', maxWidth: 1280, margin: '0 auto' }}>
        {loading ? (
          <div className="grid-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ backgroundColor: '#111', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div className="skeleton" style={{ height: 140 }} />
                <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="skeleton" style={{ height: 18, width: '55%' }} />
                  <div className="skeleton" style={{ height: 13, width: '40%' }} />
                  <div className="skeleton" style={{ height: 13, width: '70%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>⚠️ {error}</p>
            <button onClick={() => window.location.reload()} style={{ backgroundColor: 'var(--color-gold)', color: '#000', padding: '10px 24px', borderRadius: 6, border: 'none', fontWeight: 700, cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🧭</div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>{tr('guides_no_results', lang)}</p>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>{tr('guides_no_results_sub', lang)}</p>
          </div>
        ) : (
          <div className="grid-3">
            {filtered.map(g => {
              const photo   = g.profile_photo_url ?? g.photo_url
              const bio     = g.bio_en ?? g.bio
              const langs   = g.languages_spoken ?? g.languages ?? []
              const expYrs  = g.years_experience ?? g.experience_years
              const isVerif = g.verified ?? g.is_verified
              const profileHref = g.slug ? `/guides/${g.slug}` : null
              const hovered = hoveredId === g.id
              return (
                <div key={g.id}
                  onMouseEnter={() => setHoveredId(g.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{ backgroundColor: '#111', borderRadius: 14, overflow: 'hidden', border: `1px solid ${hovered ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.07)'}`, display: 'flex', flexDirection: 'column', transform: hovered ? 'translateY(-4px)' : 'none', boxShadow: hovered ? '0 20px 60px rgba(0,0,0,0.5)' : 'none', transition: 'all 0.22s ease' }}>

                  {/* Cover photo */}
                  {g.cover_photo_url ? (
                    <div style={{ height: 130, overflow: 'hidden', position: 'relative' }}>
                      <img src={g.cover_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7))' }} />
                    </div>
                  ) : (
                    <div style={{ height: 6, backgroundColor: 'rgba(201,168,76,0.25)' }} />
                  )}

                  {/* Profile section */}
                  <div style={{ padding: '20px 22px 0', display: 'flex', gap: 14, alignItems: 'flex-start', marginTop: g.cover_photo_url ? -32 : 0 }}>
                    <div style={{ flexShrink: 0 }}>
                      {photo ? (
                        <img src={photo} alt={g.name} style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', border: '3px solid #111' }} />
                      ) : (
                        <div style={{ width: 68, height: 68, borderRadius: '50%', backgroundColor: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, border: '3px solid #111' }}>
                          👤
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingTop: g.cover_photo_url ? 28 : 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 800, color: 'white', margin: 0 }}>{g.name}</h2>
                        {isVerif && (
                          <span style={{ backgroundColor: 'rgba(201,168,76,0.15)', color: '#c9a84c', padding: '1px 7px', borderRadius: 99, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', border: '1px solid rgba(201,168,76,0.3)' }}>
                            ✓ {tr('guides_verified', lang)}
                          </span>
                        )}
                        {g.featured && (
                          <span style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#c9a84c', padding: '1px 6px', borderRadius: 99, fontSize: 9, fontWeight: 600 }}>★ FEATURED</span>
                        )}
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, margin: 0 }}>
                        {g.province}{expYrs ? ` · ${expYrs} ${tr('guides_yrs_exp', lang)}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Rating */}
                  {(g.rating_avg ?? 0) > 0 && (
                    <div style={{ padding: '10px 22px 0' }}>
                      <StarRating rating={g.rating_avg!} count={g.review_count ?? 0} />
                    </div>
                  )}

                  {/* Languages */}
                  {langs.length > 0 && (
                    <div style={{ padding: '12px 22px 0' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {langs.map(l => (
                          <span key={l} style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#c9a84c', padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{l}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Specialties */}
                  {(g.specialties ?? []).length > 0 && (
                    <div style={{ padding: '8px 22px 0' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {(g.specialties ?? []).slice(0, 4).map(sp => (
                          <span key={sp} style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', padding: '2px 8px', borderRadius: 99, fontSize: 11 }}>{sp}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bio */}
                  {bio && (
                    <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, lineHeight: 1.6, padding: '10px 22px 0', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {bio}
                    </p>
                  )}

                  <div style={{ flex: 1 }} />

                  {/* Actions */}
                  <div style={{ padding: '18px 22px 22px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {profileHref && (
                      <Link href={profileHref} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-gold)', color: '#000', padding: '10px', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 700, minWidth: 100 }}>
                        {tr('guides_view_profile', lang)}
                      </Link>
                    )}
                    {g.contact_whatsapp && (
                      <a href={`https://wa.me/${g.contact_whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, backgroundColor: '#25D366', borderRadius: 8, textDecoration: 'none', fontSize: 18 }}>
                        💬
                      </a>
                    )}
                    {g.contact_line && (
                      <a href={`https://line.me/R/ti/p/${g.contact_line}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, backgroundColor: '#00B900', borderRadius: 8, textDecoration: 'none', fontSize: 15, color: '#fff', fontWeight: 800 }}>
                        L
                      </a>
                    )}
                    {(g.contact_phone ?? g.phone) && !profileHref && (
                      <a href={`tel:${g.contact_phone ?? g.phone}`}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-gold)', color: '#000', padding: '10px', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
                        📞 {tr('guides_call', lang)}
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* BECOME A GUIDE CTA */}
      <section style={{ background: 'linear-gradient(135deg, #0d0d0d 0%, #151208 100%)', borderTop: '1px solid rgba(201,168,76,0.1)', borderBottom: '1px solid rgba(201,168,76,0.1)', padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: 580, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', backgroundColor: 'rgba(201,168,76,0.1)', color: 'var(--color-gold)', padding: '6px 16px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 24 }}>
            AlanGuide · For Guides
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 800, color: 'white', letterSpacing: '-1px', lineHeight: 1.2, marginBottom: 16 }}>
            {tr('bag_h1', lang)}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16, lineHeight: 1.7, marginBottom: 32 }}>
            {tr('bag_sub', lang)}
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/become-a-guide" style={{ backgroundColor: 'var(--color-gold)', color: '#000', padding: '14px 32px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14, letterSpacing: '0.5px' }}>
              {tr('bag_apply', lang)}
            </a>
            <a href="/contact" style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.6)', padding: '14px 28px', borderRadius: 8, textDecoration: 'none', fontSize: 14, border: '1px solid rgba(255,255,255,0.12)' }}>
              {tr('guides_cta_btn', lang)}
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ backgroundColor: 'var(--color-black-soft)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 20px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, color: 'white' }}>ALAN</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', marginLeft: 8 }}>Coffee & Travel</span>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>{tr('footer_copy', lang)}</p>
            <a href="tel:+8562094366635" style={{ color: 'var(--color-gold)', fontSize: 12, textDecoration: 'none', fontWeight: 600, display: 'inline-block', marginTop: 4 }}>📞 +856 20 94 366 635</a>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            {['/destinations','/guides','/experiences','/about','/contact'].map(href => (
              <a key={href} href={href} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, textDecoration: 'none' }}>{href.slice(1).charAt(0).toUpperCase() + href.slice(2)}</a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  )
}
