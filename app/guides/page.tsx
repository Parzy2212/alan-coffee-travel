'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

type Guide = {
  id: string
  name: string
  photo_url: string | null
  province: string | null
  districts: string[] | null
  languages: string[] | null
  specialties: string[] | null
  bio: string | null
  phone: string | null
  facebook: string | null
  experience_years: number | null
  is_verified: boolean | null
  status: string | null
}

export default function GuidesPage() {
  const [guides, setGuides] = useState<Guide[]>([])
  const [loading, setLoading] = useState(true)
  const [province, setProvince] = useState('all')
  const [language, setLanguage] = useState('all')

  useEffect(() => {
    supabase
      .from('guides')
      .select('*')
      .eq('status', 'active')
      .order('is_verified', { ascending: false })
      .then(({ data }) => {
        setGuides((data as Guide[]) ?? [])
        setLoading(false)
      })
  }, [])

  const provinces = useMemo(() => {
    const s = new Set<string>()
    guides.forEach(g => { if (g.province) s.add(g.province) })
    return Array.from(s).sort()
  }, [guides])

  const languages = useMemo(() => {
    const s = new Set<string>()
    guides.forEach(g => g.languages?.forEach(l => s.add(l)))
    return Array.from(s).sort()
  }, [guides])

  const filtered = useMemo(() => guides.filter(g => {
    if (province !== 'all' && g.province !== province) return false
    if (language !== 'all' && !(g.languages ?? []).includes(language)) return false
    return true
  }), [guides, province, language])

  const selectStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'white',
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
            <a href="/destinations" style={{ color: 'var(--color-gray-600)', fontSize: '13px', textDecoration: 'none', fontWeight: 500 }}>Destinations</a>
            <a href="/guides" style={{ color: 'var(--color-black)', fontSize: '13px', textDecoration: 'none', fontWeight: 700, borderBottom: '2px solid var(--color-gold)', paddingBottom: '2px' }}>Guides</a>
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
            <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' }}>Local Expertise</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '56px', fontWeight: 800, color: 'var(--color-white)', letterSpacing: '-2px', marginBottom: '16px' }}>
            Find Your Guide
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '18px', lineHeight: 1.6, maxWidth: '560px' }}>
            Trusted local guides who know Laos deeply — its paths, its people, and the places that never appear on maps.
          </p>
        </div>
      </section>

      {/* FILTERS */}
      <section style={{ backgroundColor: '#0d0d0d', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '24px 32px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={province} onChange={e => setProvince(e.target.value)} style={selectStyle}>
            <option value="all">All Provinces</option>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={language} onChange={e => setLanguage(e.target.value)} style={selectStyle}>
            <option value="all">All Languages</option>
            {languages.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginLeft: 'auto' }}>
            {loading ? '…' : `${filtered.length} guide${filtered.length !== 1 ? 's' : ''}`}
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
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🧭</div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px', marginBottom: '8px' }}>No guides found</p>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>Try adjusting your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '28px' }}>
            {filtered.map(g => (
              <div key={g.id} style={{ backgroundColor: '#111', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column' }}>

                {/* Card header — photo + name + verified */}
                <div style={{ padding: '28px 24px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Photo */}
                  <div style={{ flexShrink: 0 }}>
                    {g.photo_url ? (
                      <img src={g.photo_url} alt={g.name}
                        style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(201,168,76,0.4)' }} />
                    ) : (
                      <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', border: '2px solid rgba(255,255,255,0.08)' }}>
                        👤
                      </div>
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.3px' }}>
                        {g.name}
                      </h2>
                      {g.is_verified && (
                        <span style={{ backgroundColor: 'rgba(201,168,76,0.15)', color: '#c9a84c', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', border: '1px solid rgba(201,168,76,0.3)' }}>
                          ✓ VERIFIED
                        </span>
                      )}
                    </div>
                    {g.province && (
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>
                        {g.province}
                        {g.experience_years ? ` · ${g.experience_years} yrs exp` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '0 24px' }}></div>

                {/* Languages */}
                {(g.languages ?? []).length > 0 && (
                  <div style={{ padding: '16px 24px 0' }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Languages</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(g.languages ?? []).map(lang => (
                        <span key={lang} style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#c9a84c', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specialties */}
                {(g.specialties ?? []).length > 0 && (
                  <div style={{ padding: '12px 24px 0' }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Specialties</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(g.specialties ?? []).map(sp => (
                        <span key={sp} style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', padding: '3px 10px', borderRadius: '999px', fontSize: '11px' }}>
                          {sp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bio */}
                {g.bio && (
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', lineHeight: 1.6, padding: '14px 24px 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: 0 }}>
                    {g.bio}
                  </p>
                )}

                {/* Spacer */}
                <div style={{ flex: 1 }}></div>

                {/* Contact buttons */}
                <div style={{ padding: '20px 24px 24px', display: 'flex', gap: '10px', marginTop: '16px' }}>
                  {g.phone && (
                    <a href={`tel:${g.phone}`}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#c9a84c', color: '#000', padding: '10px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px' }}>
                      📞 Call
                    </a>
                  )}
                  {g.facebook && (
                    <a href={g.facebook} target="_blank" rel="noopener noreferrer"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', padding: '10px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)' }}>
                      Facebook
                    </a>
                  )}
                  {!g.phone && !g.facebook && (
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', alignSelf: 'center' }}>Contact via Alan Café</span>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section style={{ backgroundColor: '#0d0d0d', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ maxWidth: '540px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', justifyContent: 'center' }}>
            <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
            <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' }}>Alan Café · Attapeu</span>
            <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 800, color: 'white', letterSpacing: '-1px', lineHeight: 1.2, marginBottom: '16px' }}>
            Not sure which guide is right for you?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '16px', lineHeight: 1.7, marginBottom: '32px' }}>
            Come to Alan Café in Attapeu. We know every guide personally and can match you to the right person for your journey.
          </p>
          <a href="/contact" style={{ display: 'inline-block', backgroundColor: 'var(--color-gold)', color: 'var(--color-black)', padding: '14px 36px', borderRadius: '4px', textDecoration: 'none', fontWeight: 700, fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            Get in Touch
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ backgroundColor: 'var(--color-black-soft)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '48px 32px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '18px', color: 'white' }}>ALAN</span>
              <span style={{ width: '4px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--color-gold)' }}></span>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>Coffee & Travel</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>© 2025 Alan Coffee & Travel — Attapeu, Laos</p>
          </div>
          <div style={{ display: 'flex', gap: '32px' }}>
            {[{ label: 'Destinations', href: '/destinations' }, { label: 'Guides', href: '/guides' }, { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }].map(item => (
              <a key={item.label} href={item.href} style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', textDecoration: 'none' }}>{item.label}</a>
            ))}
          </div>
        </div>
      </footer>

    </main>
  )
}
