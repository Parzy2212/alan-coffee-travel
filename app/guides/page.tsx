'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { useLang } from '@/contexts/LanguageContext'
import { tr } from '@/lib/translations'

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
  const { lang } = useLang()
  const [guides, setGuides] = useState<Guide[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [province, setProvince] = useState('all')
  const [language, setLanguage] = useState('all')

  useEffect(() => {
    supabase
      .from('guides')
      .select('*')
      .eq('status', 'active')
      .order('is_verified', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) { setError(tr('guides_no_results', lang)); setLoading(false); return }
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

  const countLabel = loading
    ? '…'
    : `${filtered.length} ${filtered.length === 1 ? tr('guides_singular', lang) : tr('guides_plural', lang)}`

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-black)' }}>

      <Navbar />

      {/* HERO */}
      <section className="hero-section-sm" style={{ backgroundColor: 'var(--color-black)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
            <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' }}>{tr('guides_eyebrow', lang)}</span>
          </div>
          <h1 className="hero-h1-lg" style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--color-white)', marginBottom: '16px' }}>
            {tr('guides_h1', lang)}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '18px', lineHeight: 1.6, maxWidth: '560px' }}>
            {tr('guides_sub', lang)}
          </p>
        </div>
      </section>

      {/* FILTERS */}
      <section style={{ backgroundColor: '#0d0d0d', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div className="filter-row">
          <select value={province} onChange={e => setProvince(e.target.value)} className="filter-select" style={selectStyle}>
            <option value="all">{tr('guides_all_provinces', lang)}</option>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={language} onChange={e => setLanguage(e.target.value)} className="filter-select" style={selectStyle}>
            <option value="all">{tr('guides_all_languages', lang)}</option>
            {languages.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginLeft: 'auto' }}>{countLabel}</span>
        </div>
        </div>
      </section>

      {/* GRID */}
      <section style={{ padding: '48px 20px', maxWidth: '1280px', margin: '0 auto' }}>
        {loading ? (
          <div className="grid-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ backgroundColor: '#111', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)', padding: '28px 24px' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                  <div className="skeleton" style={{ width: '72px', height: '72px', borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '8px' }}>
                    <div className="skeleton" style={{ height: '18px', width: '55%' }} />
                    <div className="skeleton" style={{ height: '14px', width: '40%' }} />
                  </div>
                </div>
                <div className="skeleton" style={{ height: '1px', marginBottom: '16px' }} />
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                  <div className="skeleton" style={{ height: '14px', width: '100%' }} />
                  <div className="skeleton" style={{ height: '14px', width: '80%' }} />
                  <div className="skeleton" style={{ height: '14px', width: '60%' }} />
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
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🧭</div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px', marginBottom: '8px' }}>{tr('guides_no_results', lang)}</p>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>{tr('guides_no_results_sub', lang)}</p>
          </div>
        ) : (
          <div className="grid-3">
            {filtered.map(g => (
              <div key={g.id} style={{ backgroundColor: '#111', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column' }}>

                {/* Card header — photo + name + verified */}
                <div style={{ padding: '28px 24px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                          ✓ {tr('guides_verified', lang)}
                        </span>
                      )}
                    </div>
                    {g.province && (
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>
                        {g.province}
                        {g.experience_years ? ` · ${g.experience_years} ${tr('guides_yrs_exp', lang)}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '0 24px' }}></div>

                {/* Languages */}
                {(g.languages ?? []).length > 0 && (
                  <div style={{ padding: '16px 24px 0' }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>{tr('label_languages', lang)}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(g.languages ?? []).map(l => (
                        <span key={l} style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#c9a84c', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specialties */}
                {(g.specialties ?? []).length > 0 && (
                  <div style={{ padding: '12px 24px 0' }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>{tr('label_specialties', lang)}</p>
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

                <div style={{ flex: 1 }}></div>

                {/* Contact buttons */}
                <div style={{ padding: '20px 24px 24px', display: 'flex', gap: '10px', marginTop: '16px' }}>
                  {g.phone && (
                    <a href={`tel:${g.phone}`}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#c9a84c', color: '#000', padding: '10px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px' }}>
                      📞 {tr('guides_call', lang)}
                    </a>
                  )}
                  {g.facebook && (
                    <a href={g.facebook} target="_blank" rel="noopener noreferrer"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', padding: '10px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)' }}>
                      Facebook
                    </a>
                  )}
                  {!g.phone && !g.facebook && (
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', alignSelf: 'center' }}>{tr('guides_contact_via', lang)}</span>
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
            {tr('guides_cta_h2', lang)}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '16px', lineHeight: 1.7, marginBottom: '32px' }}>
            {tr('guides_cta_p', lang)}
          </p>
          <a href="/contact" style={{ display: 'inline-block', backgroundColor: 'var(--color-gold)', color: 'var(--color-black)', padding: '14px 36px', borderRadius: '4px', textDecoration: 'none', fontWeight: 700, fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {tr('guides_cta_btn', lang)}
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ backgroundColor: 'var(--color-black-soft)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 20px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div className="footer-layout">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '18px', color: 'white' }}>ALAN</span>
                <span style={{ width: '4px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--color-gold)' }}></span>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>Coffee & Travel</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{tr('footer_copy', lang)}</p>
            </div>
            <div className="footer-links">
              {[
                { label: tr('nav_destinations', lang), href: '/destinations' },
                { label: tr('nav_guides', lang),       href: '/guides'       },
                { label: tr('nav_about', lang),        href: '/about'        },
                { label: tr('nav_contact', lang),      href: '/contact'      },
              ].map(item => (
                <a key={item.href} href={item.href} style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', textDecoration: 'none' }}>{item.label}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </main>
  )
}
