'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { matchesSearch } from '@/lib/search'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import DestinationMap from '@/components/DestinationMap'
import { useLang } from '@/contexts/LanguageContext'
import { tr } from '@/lib/translations'

type Destination = {
  id: string
  slug: string
  title_en: string
  title_lo: string | null
  excerpt_en: string | null
  excerpt_lo: string | null
  description_en: string | null
  region: string | null
  district: string | null
  image_urls: string[] | null
  assessment_status: string | null
  rating_experience: number | null
  rating_accessibility: number | null
  rating_authenticity: number | null
  rating_tranquility: number | null
  rating_traveler_value: number | null
  featured: boolean | null
  transport_price: string | null
  has_guide: boolean | null
  location_lat: number | null
  location_lng: number | null
}

function avgRating(d: Destination): number | null {
  const vals = [
    d.rating_experience,
    d.rating_accessibility,
    d.rating_authenticity,
    d.rating_tranquility,
    d.rating_traveler_value,
  ].filter((v): v is number => v != null && v > 0)
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export default function DestinationsClient() {
  const { lang } = useLang()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [province, setProvince] = useState('all')
  const [assessment, setAssessment] = useState('all')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)

  // Card <-> pin sync: when a pin is clicked on the map, scroll the matching
  // card into view and highlight it. When a card is clicked, the map effect
  // in DestinationMap reacts to selectedId and flies to that pin.
  useEffect(() => {
    if (!selectedId) return
    document.getElementById(`dest-card-${selectedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [selectedId])

  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('destinations')
          .select('*')
          .eq('status', 'active')
          .order('featured', { ascending: false })
        if (err) {
          console.error('Destinations page: failed to load destinations', err)
          setError(tr('fetch_error_msg', lang))
          setLoading(false)
          return
        }
        setDestinations((data as Destination[]) ?? [])
        setLoading(false)
      } catch (err) {
        console.error('Destinations page: failed to load destinations', err)
        setError(tr('fetch_error_msg', lang))
        setLoading(false)
      }
    })()
  }, [])

  const provinces = useMemo(() => {
    const set = new Set<string>()
    destinations.forEach(d => { if (d.region) set.add(d.region) })
    return Array.from(set).sort()
  }, [destinations])

  const filtered = useMemo(() => {
    return destinations.filter(d => {
      if (search && !matchesSearch(d, search)) return false
      if (province !== 'all' && d.region !== province) return false
      if (assessment === 'assessed' && d.assessment_status !== 'assessed') return false
      if (assessment === 'not_assessed' && d.assessment_status === 'assessed') return false
      return true
    })
  }, [destinations, search, province, assessment])

  const selectStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'var(--color-white)',
    padding: '10px 16px',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '160px',
    minHeight: '44px',
    boxSizing: 'border-box',
  }

  const countLabel = loading
    ? '…'
    : `${filtered.length} ${filtered.length === 1 ? tr('dest_singular', lang) : tr('dest_plural', lang)}`

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-black)' }}>

      <Navbar />

      {/* HERO */}
      <section className="hero-section-sm" style={{ backgroundColor: 'var(--color-black)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)', flexShrink: 0 }}></div>
            <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' }}>{tr('dest_eyebrow', lang)}</span>
          </div>
          <h1 className="hero-h1-lg" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-white)', marginBottom: '16px' }}>
            {tr('dest_h1', lang)}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '17px', lineHeight: 1.6, maxWidth: '560px' }}>
            {tr('dest_sub', lang)}
          </p>
        </div>
      </section>

      {/* FILTERS */}
      <section style={{ backgroundColor: '#0d0d0d', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div className="filter-row">
            <input
              type="text"
              placeholder={tr('dest_search_ph', lang)}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...selectStyle, minHeight: '44px', flex: 1 }}
            />
            <select value={province} onChange={e => setProvince(e.target.value)} className="filter-select" style={selectStyle} aria-label={tr('dest_all_provinces', lang)}>
              <option value="all">{tr('dest_all_provinces', lang)}</option>
              {provinces.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select value={assessment} onChange={e => setAssessment(e.target.value)} className="filter-select" style={selectStyle} aria-label={tr('dest_all_status', lang)}>
              <option value="all">{tr('dest_all_status', lang)}</option>
              <option value="assessed">{tr('dest_filter_assessed', lang)}</option>
              <option value="not_assessed">{tr('dest_filter_not_assessed', lang)}</option>
            </select>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>{countLabel}</span>
          </div>
        </div>
      </section>

      {/* SPLIT VIEW: list + map */}
      <div className={`dest-split ${showMap ? 'show-map' : 'show-list'}`}>
        <div className="dest-split-list">

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ borderRadius: '8px', overflow: 'hidden', backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="skeleton" style={{ height: '220px' }} />
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="skeleton" style={{ height: '22px', width: '80px', borderRadius: '999px' }} />
                    <div className="skeleton" style={{ height: '22px', width: '60px', borderRadius: '999px' }} />
                  </div>
                  <div className="skeleton" style={{ height: '24px', width: '75%' }} />
                  <div className="skeleton" style={{ height: '14px', width: '100%' }} />
                  <div className="skeleton" style={{ height: '14px', width: '65%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '120px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '16px', marginBottom: '20px' }}>{error}</p>
            <button onClick={() => window.location.reload()} style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-black)', padding: '12px 28px', borderRadius: '4px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}>
              {tr('try_again', lang)}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '120px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🏔️</div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px', marginBottom: '8px' }}>{tr('dest_no_results', lang)}</p>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>{tr('dest_no_results_sub', lang)}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
            {filtered.map(d => {
              const heroImage = d.image_urls?.[0] ?? null
              const isAssessed = d.assessment_status === 'assessed'
              const avg = avgRating(d)
              const stars = avg != null ? Math.round(avg) : null

              const isHovered = hoveredId === d.id
              const isSelected = selectedId === d.id
              const borderColor = d.featured
                ? isHovered ? 'rgba(201,168,76,0.5)' : 'rgba(201,168,76,0.22)'
                : isHovered ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.07)'

              return (
                <div
                  key={d.id}
                  id={`dest-card-${d.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(d.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(d.id) } }}
                  onMouseEnter={() => setHoveredId(d.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{ cursor: 'pointer', display: 'block', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#111', border: `1px solid ${borderColor}`, boxShadow: isSelected ? '0 0 0 2px var(--color-gold)' : isHovered ? '0 16px 48px rgba(0,0,0,0.45)' : 'none', transform: isHovered ? 'translateY(-4px)' : 'none', transition: 'border-color 0.2s, transform 0.22s, box-shadow 0.22s' }}
                >
                  {/* Image */}
                  <div style={{ position: 'relative', height: '220px', backgroundColor: '#0a0a0a', overflow: 'hidden' }}>
                    {heroImage ? (
                      <img
                        src={heroImage}
                        alt={d.title_en}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '32px', opacity: 0.3 }}>🏔️</span>
                      </div>
                    )}
                    {d.featured && (
                      <div style={{ position: 'absolute', top: '12px', left: '12px', backgroundColor: 'rgba(201,168,76,0.92)', color: '#000', padding: '4px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                        ★ Featured
                      </div>
                    )}
                    {isAssessed && (
                      <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'rgba(201,168,76,0.9)', color: '#000', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                        {tr('dest_badge_assessed', lang)}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '12px' }}>
                      {d.region && (
                        <span style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#c9a84c', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>
                          {d.region}
                        </span>
                      )}
                      {d.district && (
                        <span style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', padding: '3px 10px', borderRadius: '999px', fontSize: '11px' }}>
                          {d.district}
                        </span>
                      )}
                    </div>

                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 800, color: 'var(--color-white)', letterSpacing: '-0.5px', marginBottom: '8px', lineHeight: 1.2 }}>
                      {d.title_en}
                    </h2>

                    {d.excerpt_en && (
                      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: 1.6, marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                        {d.excerpt_en}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        {stars != null ? (
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1, 2, 3, 4, 5].map(n => (
                              <span key={n} style={{ fontSize: '13px', color: n <= stars ? '#c9a84c' : 'rgba(255,255,255,0.12)' }}>★</span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' as const }}>{tr('dest_not_assessed_label', lang)}</span>
                        )}
                      </div>
                      <a
                        href={`/destinations/${d.slug}`}
                        onClick={e => e.stopPropagation()}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-gold)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const, textDecoration: 'none', padding: '13px 10px', margin: '-13px -10px', minHeight: '44px', boxSizing: 'border-box' as const }}
                      >
                        {tr('dest_discover_link', lang)}
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </div>

        <div className="dest-split-map">
          <DestinationMap destinations={filtered} lang={lang} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>

      <button
        className="dest-map-toggle"
        onClick={() => setShowMap(m => !m)}
      >
        {showMap ? `☰ ${tr('dest_show_list', lang)}` : `🗺️ ${tr('dest_show_map', lang)}`}
      </button>

      {/* paddingBottom 116 — the floating "Show Map" toggle pill (.dest-map-toggle) is fixed to the
          viewport bottom below 1024px and would otherwise sit on top of the footer's bottom row */}
      <Footer lang={lang} paddingBottom={116} />

    </main>
  )
}
