'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { matchesSearch } from '@/lib/search'

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

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [province, setProvince] = useState('all')
  const [assessment, setAssessment] = useState('all')

  useEffect(() => {
    supabase
      .from('destinations')
      .select('*')
      .eq('status', 'active')
      .order('featured', { ascending: false })
      .then(({ data }) => {
        setDestinations((data as Destination[]) ?? [])
        setLoading(false)
      })
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
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-black)' }}>

      {/* NAV */}
      <nav style={{ backgroundColor: 'var(--color-white)', borderBottom: '1px solid var(--color-cream-border)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 32px', height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '20px', color: 'var(--color-black)' }}>ALAN</span>
            <span style={{ width: '4px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--color-gold)' }}></span>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 400, fontSize: '13px', color: 'var(--color-gray-600)', letterSpacing: '2px', textTransform: 'uppercase' }}>Coffee Travel</span>
          </a>
          <div style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>
            <a href="/" style={{ color: 'var(--color-gray-600)', fontSize: '13px', textDecoration: 'none', fontWeight: 500 }}>Home</a>
            <a href="/destinations" style={{ color: 'var(--color-black)', fontSize: '13px', textDecoration: 'none', fontWeight: 700, borderBottom: '2px solid var(--color-gold)', paddingBottom: '2px' }}>Destinations</a>
            <a href="/about" style={{ color: 'var(--color-gray-600)', fontSize: '13px', textDecoration: 'none', fontWeight: 500 }}>About</a>
          </div>
          <a href="/contact" style={{ backgroundColor: 'var(--color-black)', color: 'var(--color-gold)', padding: '10px 24px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600, fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            Contact
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ backgroundColor: 'var(--color-black)', padding: '100px 32px 80px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
            <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' }}>Laos</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '56px', fontWeight: 800, color: 'var(--color-white)', letterSpacing: '-2px', marginBottom: '16px' }}>
            All Destinations
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '18px', lineHeight: 1.6, maxWidth: '560px' }}>
            Curated places across Laos — assessed for experience, authenticity, and tranquility.
          </p>
        </div>
      </section>

      {/* FILTERS */}
      <section style={{ backgroundColor: '#0d0d0d', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '24px 32px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', gap: '16px', flexWrap: 'wrap' as const, alignItems: 'center' }}>

          {/* Search */}
          <input
            type="text"
            placeholder="Search destinations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              ...selectStyle,
              minWidth: '240px',
              flex: 1,
            }}
          />

          {/* Province filter */}
          <select value={province} onChange={e => setProvince(e.target.value)} style={selectStyle}>
            <option value="all">All Provinces</option>
            {provinces.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Assessment filter */}
          <select value={assessment} onChange={e => setAssessment(e.target.value)} style={selectStyle}>
            <option value="all">All Status</option>
            <option value="assessed">Assessed</option>
            <option value="not_assessed">Not Yet Assessed</option>
          </select>

          {/* Count */}
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginLeft: 'auto' }}>
            {loading ? '…' : `${filtered.length} destination${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </section>

      {/* GRID */}
      <section style={{ padding: '64px 32px', maxWidth: '1280px', margin: '0 auto' }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '120px 0' }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase' }}>Loading…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '120px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🏔️</div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px', marginBottom: '8px' }}>No destinations found</p>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>Try adjusting your filters or search term.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '28px' }}>
            {filtered.map(d => {
              const heroImage = d.image_urls?.[0] ?? null
              const isAssessed = d.assessment_status === 'assessed'
              const avg = avgRating(d)
              const stars = avg != null ? Math.round(avg) : null

              return (
                <a
                  key={d.id}
                  href={`/destinations/${d.slug}`}
                  style={{ textDecoration: 'none', display: 'block', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.07)', transition: 'border-color 0.2s' }}
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
                    {/* Assessment badge overlay */}
                    {isAssessed && (
                      <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'rgba(201,168,76,0.9)', color: '#000', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                        ★ Assessed
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ padding: '20px' }}>
                    {/* Province + district badges */}
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

                    {/* Title */}
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 800, color: 'var(--color-white)', letterSpacing: '-0.5px', marginBottom: '8px', lineHeight: 1.2 }}>
                      {d.title_en}
                    </h2>

                    {/* Excerpt */}
                    {d.excerpt_en && (
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', lineHeight: 1.6, marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                        {d.excerpt_en}
                      </p>
                    )}

                    {/* Footer: stars + discover link */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        {stars != null ? (
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1, 2, 3, 4, 5].map(n => (
                              <span key={n} style={{ fontSize: '13px', color: n <= stars ? '#c9a84c' : 'rgba(255,255,255,0.12)' }}>★</span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' as const }}>Not assessed</span>
                        )}
                      </div>
                      <span style={{ color: 'var(--color-gold)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                        Discover →
                      </span>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer style={{ backgroundColor: 'var(--color-black-soft)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '48px 32px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '18px', color: 'var(--color-white)' }}>ALAN</span>
              <span style={{ width: '4px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--color-gold)' }}></span>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Coffee & Travel</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>© 2025 Alan Coffee & Travel — Attapeu, Laos</p>
          </div>
          <div style={{ display: 'flex', gap: '32px' }}>
            {[{ label: 'Destinations', href: '/destinations' }, { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }].map(item => (
              <a key={item.label} href={item.href} style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', textDecoration: 'none' }}>{item.label}</a>
            ))}
          </div>
        </div>
      </footer>

    </main>
  )
}
