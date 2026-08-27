'use client'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import { getSupabase } from '@/lib/supabase'
import { useLang } from '@/contexts/LanguageContext'
import { tr } from '@/lib/translations'

type Destination = {
  id: string
  slug: string
  title_en: string
  excerpt_en: string | null
  region: string | null
  image_urls: string[] | null
  assessment_status: string | null
  rating_experience: number | null
  rating_accessibility: number | null
  rating_authenticity: number | null
  rating_tranquility: number | null
  rating_traveler_value: number | null
  featured: boolean | null
}

type Guide = {
  id: string
  slug: string | null
  name: string
  photo_url: string | null
  profile_photo_url: string | null
  province: string | null
  languages: string[] | null
  languages_spoken: string[] | null
  specialties: string[] | null
  is_verified: boolean | null
  verified: boolean | null
  experience_years: number | null
  years_experience: number | null
  rating_avg: number | null
  review_count: number | null
}

type FeaturedExp = {
  id: string
  slug: string | null
  title_en: string | null
  cover_image_url: string | null
  category: string | null
  duration_hours: number | null
  duration_days: number | null
  price_per_person_lak: number | null
  region: string | null
  guides: { name: string } | null
}

function avgRating(d: Destination): number | null {
  const vals = [
    d.rating_experience, d.rating_accessibility, d.rating_authenticity,
    d.rating_tranquility, d.rating_traveler_value,
  ].filter((v): v is number => v != null && v > 0)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

const FOOTER_LINK_KEYS = [
  { key: 'nav_destinations' as const, href: '/destinations' },
  { key: 'nav_guides'       as const, href: '/guides'       },
  { key: 'map_eyebrow'      as const, href: '/map'          },
  { key: 'nav_about'        as const, href: '/about'        },
  { key: 'nav_contact'      as const, href: '/contact'      },
]

export default function HomeClient() {
  const { lang } = useLang()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [guides, setGuides] = useState<Guide[]>([])
  const [featuredExps, setFeaturedExps] = useState<FeaturedExp[]>([])
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null)
  const [destError, setDestError] = useState(false)
  const [guidesError, setGuidesError] = useState(false)
  const [expError, setExpError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    const supabase = getSupabase()
    Promise.all([
      supabase
        .from('destinations')
        .select('id,slug,title_en,excerpt_en,region,image_urls,assessment_status,rating_experience,rating_accessibility,rating_authenticity,rating_tranquility,rating_traveler_value,featured')
        .eq('status', 'active')
        .order('featured', { ascending: false })
        .limit(6),
      supabase
        .from('guides')
        .select('id,slug,name,photo_url,profile_photo_url,province,languages,languages_spoken,specialties,is_verified,verified,experience_years,years_experience,rating_avg,review_count')
        .or('status.eq.active,active.eq.true')
        .or('is_verified.eq.true,verified.eq.true')
        .order('featured', { ascending: false })
        .limit(3),
      supabase
        .from('experiences')
        .select('id,slug,title_en,cover_image_url,category,duration_hours,duration_days,price_per_person_lak,region,guides(name)')
        .eq('status', 'active')
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'hero_image_url')
        .maybeSingle(),
    ]).then(([destRes, guideRes, expRes, heroRes]) => {
      if (destRes.error) {
        console.error('HomeClient: failed to load destinations', destRes.error)
        setDestError(true)
      } else {
        setDestError(false)
        if (destRes.data) setDestinations(destRes.data)
      }
      if (guideRes.error) {
        console.error('HomeClient: failed to load guides', guideRes.error)
        setGuidesError(true)
      } else {
        setGuidesError(false)
        if (guideRes.data) setGuides(guideRes.data as Guide[])
      }
      if (expRes.error) {
        console.error('HomeClient: failed to load experiences', expRes.error)
        setExpError(true)
      } else {
        setExpError(false)
        if (expRes.data) setFeaturedExps(expRes.data as unknown as FeaturedExp[])
      }
      if (heroRes.error) {
        console.error('HomeClient: failed to load hero image setting', heroRes.error)
      } else if (heroRes.data?.value) {
        setHeroImageUrl(heroRes.data.value)
      }
    }).catch(err => {
      console.error('HomeClient: failed to load homepage data', err)
      setDestError(true)
      setGuidesError(true)
      setExpError(true)
    })
  }, [loadAttempt])

  // Scroll-triggered fade-up animation.
  // Re-runs when async-loaded sections (destinations/guides/experiences) render,
  // since their .fade-up cards don't exist in the DOM on first mount.
  useEffect(() => {
    const els = document.querySelectorAll('.fade-up')
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('in-view')
            obs.unobserve(e.target)
          }
        })
      },
      { threshold: 0.08 }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [destinations, guides, featuredExps])

  const stats = [
    { value: '18',                          label: tr('stat_provinces',    lang) },
    { value: '148',                         label: tr('stat_districts',    lang) },
    { value: destinations.length ? `${destinations.length}+` : '—', label: tr('stat_destinations', lang) },
    { value: 'Attapeu',                     label: tr('stat_homebase',     lang) },
  ]

  const STEPS = [
    { num: '01', title: tr('step1_title', lang), desc: tr('step1_desc', lang) },
    { num: '02', title: tr('step2_title', lang), desc: tr('step2_desc', lang) },
    { num: '03', title: tr('step3_title', lang), desc: tr('step3_desc', lang) },
  ]

  return (
    <main style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
      <Navbar />

      {/* ═══════════════════════════════════════════════════════
          HERO — full viewport
      ═══════════════════════════════════════════════════════ */}
      <section style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        backgroundImage: heroImageUrl ? `url(${heroImageUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: 'clamp(100px, 14vw, 160px) clamp(24px, 4vw, 56px) 80px',
      }}>
        {/* Dark overlay — always shown over image, lighter otherwise */}
        <div style={{
          position: 'absolute', inset: 0,
          background: heroImageUrl
            ? 'linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.42) 50%, rgba(0,0,0,0.72) 100%)'
            : 'none',
          pointerEvents: 'none',
        }} />
        {/* Gold radial glow — top right (visible with or without image) */}
        <div style={{
          position: 'absolute', top: '-10%', right: '-8%',
          width: '65%', height: '80%',
          background: 'radial-gradient(ellipse, rgba(201,168,76,0.11) 0%, transparent 65%)',
          animation: 'heroPulse 6s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        {/* Subtle second glow — bottom left */}
        <div style={{
          position: 'absolute', bottom: '10%', left: '-5%',
          width: '40%', height: '50%',
          background: 'radial-gradient(ellipse, rgba(201,168,76,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {/* Fade into stats bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '160px',
          background: 'linear-gradient(to bottom, transparent, #0a0a0a)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', position: 'relative' }}>
          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '36px' }}>
            <div style={{ height: '1px', width: '48px', backgroundColor: 'var(--color-gold)', flexShrink: 0 }} />
            <span style={{
              color: 'var(--color-gold)', fontSize: '11px', fontWeight: 700,
              letterSpacing: '3.5px', textTransform: 'uppercase' as const,
            }}>
              {tr('hero_eyebrow', lang)}
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(52px, 7.5vw, 96px)',
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: '-0.04em',
            color: 'var(--color-white)',
            marginBottom: '32px',
          }}>
            {tr('hero_h1_line1', lang)}<br />
            <span style={{ color: 'var(--color-gold)' }}>{tr('hero_h1_line2', lang)}</span>
          </h1>

          {/* Subheadline */}
          <p style={{
            color: 'rgba(255,255,255,0.46)',
            fontSize: 'clamp(16px, 2vw, 19px)',
            lineHeight: 1.82,
            maxWidth: '520px',
            marginBottom: '52px',
          }}>
            {tr('hero_sub', lang)}
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '14px', alignItems: 'center' }}>
            <a href="/destinations" style={{
              display: 'inline-flex', alignItems: 'center',
              backgroundColor: 'var(--color-gold)', color: '#0a0a0a',
              padding: '17px 40px', borderRadius: '4px',
              fontWeight: 700, fontSize: '13px', letterSpacing: '1.5px',
              textTransform: 'uppercase' as const, textDecoration: 'none', minHeight: '52px',
            }}>
              {tr('hero_cta_explore', lang)}
            </a>
            <a href="/map" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              backgroundColor: 'transparent', color: 'rgba(255,255,255,0.75)',
              padding: '17px 40px', borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.14)',
              fontWeight: 500, fontSize: '13px', textDecoration: 'none', minHeight: '52px',
            }}>
              {tr('hero_cta_map', lang)}
            </a>
          </div>

          {/* Trust line */}
          <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: '12px', marginTop: '52px', letterSpacing: '0.5px' }}>
            {tr('hero_trust', lang)}
          </p>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: '36px', left: '50%',
          display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '8px',
          animation: 'scrollBounce 2.4s ease-in-out infinite',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.14)', fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase' as const }}>{tr('scroll', lang)}</span>
          <div style={{ width: '1px', height: '44px', background: 'linear-gradient(to bottom, rgba(201,168,76,0.45), transparent)' }} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          STATS BAR
      ═══════════════════════════════════════════════════════ */}
      <section style={{
        backgroundColor: '#111',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '44px clamp(24px, 4vw, 56px)',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div className="stat-grid">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className="fade-up"
                style={{
                  textAlign: 'center' as const,
                  padding: '8px 16px',
                  transitionDelay: `${i * 80}ms`,
                  borderRight: i < stats.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <div style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'clamp(30px, 3.5vw, 48px)',
                  fontWeight: 800,
                  color: 'var(--color-gold)',
                  letterSpacing: '-1px',
                  lineHeight: 1,
                  marginBottom: '8px',
                }}>
                  {s.value}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', letterSpacing: '2.5px', textTransform: 'uppercase' as const }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FEATURED DESTINATIONS
      ═══════════════════════════════════════════════════════ */}
      <section style={{ backgroundColor: 'var(--color-cream)', padding: 'clamp(64px, 9vw, 112px) clamp(24px, 4vw, 56px)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          {/* Section header */}
          <div className="section-header fade-up">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }} />
                <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' as const }}>{tr('section_curated', lang)}</span>
              </div>
              <h2 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(28px, 3.8vw, 52px)',
                fontWeight: 800, color: 'var(--color-black)',
                letterSpacing: '-1.5px', lineHeight: 1.08, margin: 0,
              }}>
                {tr('section_featured', lang)}
              </h2>
            </div>
            <a href="/destinations" style={{
              color: 'var(--color-gray-600)', fontSize: '13px', textDecoration: 'none',
              borderBottom: '1px solid var(--color-cream-border)', paddingBottom: '2px',
              alignSelf: 'flex-end', whiteSpace: 'nowrap' as const,
            }}>
              {tr('view_all_dest', lang)}
            </a>
          </div>

          {/* Cards */}
          {destError ? (
            <div style={{ textAlign: 'center' as const, padding: '80px 0' }}>
              <p style={{ color: 'var(--color-gray-400)', fontSize: '15px', marginBottom: '20px' }}>{tr('fetch_error_msg', lang)}</p>
              <button
                onClick={() => setLoadAttempt(n => n + 1)}
                style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-black)', padding: '12px 28px', borderRadius: '4px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
              >
                {tr('try_again', lang)}
              </button>
            </div>
          ) : destinations.length === 0 ? (
            <div style={{ textAlign: 'center' as const, padding: '80px 0' }}>
              <p style={{ color: 'var(--color-gray-400)', fontSize: '15px' }}>{tr('dest_coming_soon', lang)}</p>
            </div>
          ) : (
            <div className="grid-3">
              {destinations.map((d, i) => {
                const img = d.image_urls?.[0] ?? null
                const isAssessed = d.assessment_status === 'assessed'
                const avg = avgRating(d)
                const stars = avg != null ? Math.round(avg) : null

                return (
                  <a
                    key={d.id}
                    href={`/destinations/${d.slug}`}
                    className="fade-up"
                    style={{
                      display: 'block', textDecoration: 'none',
                      backgroundColor: 'var(--color-white)',
                      borderRadius: '10px', overflow: 'hidden',
                      border: '1px solid var(--color-cream-border)',
                      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                      transitionDelay: `${i * 60}ms`,
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(-5px)'
                      el.style.boxShadow = '0 20px 52px rgba(0,0,0,0.13)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(0)'
                      el.style.boxShadow = 'none'
                    }}
                  >
                    {/* Image */}
                    <div style={{ position: 'relative', height: '240px', overflow: 'hidden', backgroundColor: '#1a1a1a' }}>
                      {img ? (
                        <img
                          src={img} alt={d.title_en}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.4s ease' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }}>
                          <span style={{ fontSize: '44px', opacity: 0.25 }}>🏔️</span>
                        </div>
                      )}
                      {/* Gradient */}
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 45%, transparent 100%)' }} />
                      {/* Assessment badge */}
                      {isAssessed && (
                        <div style={{ position: 'absolute', top: '14px', right: '14px', backgroundColor: 'var(--color-gold)', color: '#000', padding: '4px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }}>
                          ★ Assessed
                        </div>
                      )}
                      {/* Region label */}
                      <div style={{ position: 'absolute', bottom: '14px', left: '16px' }}>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' as const, margin: 0 }}>{d.region}</p>
                      </div>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '22px 22px 20px' }}>
                      <h3 style={{
                        fontFamily: 'var(--font-heading)', fontSize: '19px', fontWeight: 800,
                        color: 'var(--color-black)', letterSpacing: '-0.5px',
                        marginBottom: '8px', lineHeight: 1.2,
                      }}>
                        {d.title_en}
                      </h3>
                      {d.excerpt_en && (
                        <p style={{
                          color: 'var(--color-gray-600)', fontSize: '13px', lineHeight: 1.65, marginBottom: '18px',
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                        }}>
                          {d.excerpt_en}
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {stars != null ? (
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1, 2, 3, 4, 5].map(n => (
                              <span key={n} style={{ fontSize: '12px', color: n <= stars ? 'var(--color-gold)' : 'var(--color-cream-border)' }}>★</span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--color-gray-400)', letterSpacing: '0.5px' }}>{tr('not_assessed', lang)}</span>
                        )}
                        <span style={{ color: 'var(--color-gold)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                          {tr('discover_arrow', lang)}
                        </span>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          HOW IT WORKS — Alan Travel Standard
      ═══════════════════════════════════════════════════════ */}
      <section style={{ backgroundColor: '#0a0a0a', padding: 'clamp(64px, 9vw, 112px) clamp(24px, 4vw, 56px)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          {/* Header */}
          <div className="fade-up" style={{ marginBottom: '72px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }} />
              <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' as const }}>{tr('standard_eyebrow', lang)}</span>
            </div>
            <h2 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(28px, 4vw, 56px)',
              fontWeight: 800, color: 'var(--color-white)',
              letterSpacing: '-1.5px', lineHeight: 1.08, margin: 0, maxWidth: '640px',
            }}>
              {tr('standard_h2_line1', lang)}<br />
              <span style={{ color: 'var(--color-gold)' }}>{tr('standard_h2_line2', lang)}</span>
            </h2>
          </div>

          {/* Steps */}
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className="fade-up"
              style={{
                display: 'grid',
                gridTemplateColumns: 'clamp(64px, 8vw, 100px) 1fr',
                gap: 'clamp(24px, 3vw, 48px)',
                padding: '40px 0',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                alignItems: 'start',
                transitionDelay: `${i * 110}ms`,
              }}
            >
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(44px, 6vw, 72px)',
                fontWeight: 800,
                color: 'rgba(201,168,76,0.14)',
                letterSpacing: '-2px',
                lineHeight: 1,
              }}>
                {step.num}
              </div>
              <div style={{ paddingTop: '6px' }}>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'clamp(18px, 2.2vw, 28px)',
                  fontWeight: 700, color: 'var(--color-white)',
                  letterSpacing: '-0.5px', marginBottom: '14px',
                }}>
                  {step.title}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '15px', lineHeight: 1.78, maxWidth: '560px', margin: 0 }}>
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: '48px' }} />

          {/* CTA */}
          <div className="fade-up" style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' as const }}>
            <a href="/destinations" style={{
              display: 'inline-flex', alignItems: 'center',
              backgroundColor: 'rgba(201,168,76,0.1)', color: 'var(--color-gold)',
              padding: '14px 36px', borderRadius: '4px',
              border: '1px solid rgba(201,168,76,0.25)',
              fontWeight: 700, fontSize: '13px', letterSpacing: '1.5px',
              textTransform: 'uppercase' as const, textDecoration: 'none',
            }}>
              {tr('standard_cta', lang)}
            </a>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>
              {tr('standard_note', lang)}
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          VERIFIED GUIDES
      ═══════════════════════════════════════════════════════ */}
      {(guides.length > 0 || guidesError) && (
        <section style={{ backgroundColor: 'var(--color-cream)', padding: 'clamp(64px, 9vw, 112px) clamp(24px, 4vw, 56px)' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
            {/* Header */}
            <div className="section-header fade-up">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }} />
                  <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' as const }}>{tr('section_local', lang)}</span>
                </div>
                <h2 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'clamp(28px, 3.8vw, 52px)',
                  fontWeight: 800, color: 'var(--color-black)',
                  letterSpacing: '-1.5px', lineHeight: 1.08, margin: 0,
                }}>
                  {tr('section_guides', lang)}
                </h2>
              </div>
              <a href="/guides" style={{
                color: 'var(--color-gray-600)', fontSize: '13px', textDecoration: 'none',
                borderBottom: '1px solid var(--color-cream-border)', paddingBottom: '2px',
                alignSelf: 'flex-end', whiteSpace: 'nowrap' as const,
              }}>
                {tr('view_all_guides', lang)}
              </a>
            </div>

            {guidesError ? (
              <div style={{ textAlign: 'center' as const, padding: '60px 0' }}>
                <p style={{ color: 'var(--color-gray-400)', fontSize: '15px', marginBottom: '20px' }}>{tr('fetch_error_msg', lang)}</p>
                <button
                  onClick={() => setLoadAttempt(n => n + 1)}
                  style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-black)', padding: '12px 28px', borderRadius: '4px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
                >
                  {tr('try_again', lang)}
                </button>
              </div>
            ) : (
            <div className="grid-3">
              {guides.map((g, i) => {
                const photo = g.profile_photo_url ?? g.photo_url
                const langs = g.languages_spoken ?? g.languages ?? []
                const expYrs = g.years_experience ?? g.experience_years
                const isVerif = g.verified ?? g.is_verified
                const href = g.slug ? `/guides/${g.slug}` : '/guides'
                return (
                  <a
                    key={g.id}
                    href={href}
                    className="fade-up"
                    style={{
                      display: 'block', textDecoration: 'none',
                      backgroundColor: 'var(--color-white)',
                      borderRadius: '10px',
                      border: '1px solid var(--color-cream-border)',
                      padding: '28px 24px',
                      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                      transitionDelay: `${i * 80}ms`,
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(-4px)'
                      el.style.boxShadow = '0 14px 44px rgba(0,0,0,0.09)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(0)'
                      el.style.boxShadow = 'none'
                    }}
                  >
                    {/* Photo + name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                      {photo ? (
                        <img
                          src={photo} alt={g.name}
                          style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(201,168,76,0.35)', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-cream-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0, border: '2px solid var(--color-cream-border)' }}>
                          👤
                        </div>
                      )}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const, marginBottom: '4px' }}>
                          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '17px', fontWeight: 800, color: 'var(--color-black)', margin: 0 }}>
                            {g.name}
                          </h3>
                          {isVerif && (
                            <span style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: 'var(--color-gold)', padding: '2px 8px', borderRadius: '999px', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', border: '1px solid rgba(201,168,76,0.22)' }}>
                              ✓ VERIFIED
                            </span>
                          )}
                        </div>
                        <p style={{ color: 'var(--color-gray-400)', fontSize: '12px', margin: 0 }}>
                          {g.province}{expYrs ? ` · ${expYrs} yrs exp` : ''}
                          {(g.rating_avg ?? 0) > 0 ? ` · ★ ${g.rating_avg!.toFixed(1)}` : ''}
                        </p>
                      </div>
                    </div>

                    <div style={{ height: '1px', backgroundColor: 'var(--color-cream-border)', marginBottom: '18px' }} />

                    {/* Languages */}
                    {langs.length > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <p style={{ color: 'var(--color-gray-400)', fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '8px' }}>{tr('label_languages', lang)}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                          {langs.map((l: string) => (
                            <span key={l} style={{ backgroundColor: 'rgba(201,168,76,0.08)', color: 'var(--color-gold)', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, border: '1px solid rgba(201,168,76,0.18)' }}>
                              {l}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Specialties */}
                    {(g.specialties ?? []).slice(0, 3).length > 0 && (
                      <div style={{ marginBottom: '18px' }}>
                        <p style={{ color: 'var(--color-gray-400)', fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '8px' }}>{tr('label_specialties', lang)}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                          {(g.specialties ?? []).slice(0, 3).map((s: string) => (
                            <span key={s} style={{ backgroundColor: 'var(--color-cream-dark)', color: 'var(--color-gray-600)', padding: '3px 10px', borderRadius: '999px', fontSize: '11px' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ color: 'var(--color-gold)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px' }}>
                      {tr('guides_view_profile', lang)} →
                    </div>
                  </a>
                )
              })}
            </div>
            )}

            {/* Bottom CTA */}
            {!guidesError && (
              <div className="fade-up" style={{ textAlign: 'center' as const, marginTop: '52px' }}>
                <a href="/guides" style={{
                  display: 'inline-flex', alignItems: 'center',
                  backgroundColor: 'var(--color-black)', color: 'var(--color-gold)',
                  padding: '15px 40px', borderRadius: '4px',
                  fontWeight: 700, fontSize: '13px', letterSpacing: '1.5px',
                  textTransform: 'uppercase' as const, textDecoration: 'none',
                }}>
                  {tr('meet_all_guides', lang)}
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          FEATURED EXPERIENCES
      ═══════════════════════════════════════════════════════ */}
      <section style={{ backgroundColor: '#0a0a0a', padding: 'clamp(64px, 9vw, 112px) clamp(24px, 4vw, 56px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div className="section-header fade-up" style={{ marginBottom: '52px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }} />
                <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' as const }}>{tr('home_exp_eyebrow', lang)}</span>
              </div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(28px, 3.8vw, 52px)', fontWeight: 800, color: 'var(--color-white)', letterSpacing: '-1.5px', lineHeight: 1.08, margin: 0 }}>
                {tr('home_exp_h2', lang)}
              </h2>
            </div>
            <a href="/experiences" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '2px', alignSelf: 'flex-end', whiteSpace: 'nowrap' as const }}>
              {tr('view_all_exp', lang)}
            </a>
          </div>

          {expError ? (
            <div style={{ textAlign: 'center' as const, padding: '60px 0' }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '15px', marginBottom: '20px' }}>{tr('fetch_error_msg', lang)}</p>
              <button
                onClick={() => setLoadAttempt(n => n + 1)}
                style={{ backgroundColor: 'var(--color-gold)', color: 'var(--color-black)', padding: '12px 28px', borderRadius: '4px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' }}
              >
                {tr('try_again', lang)}
              </button>
            </div>
          ) : featuredExps.length === 0 ? (
            <div style={{ textAlign: 'center' as const, padding: '60px 0 40px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '24px' }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '15px' }}>{tr('home_exp_empty', lang)}</p>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' as const, justifyContent: 'center' }}>
                <a href="/guides" style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: 'var(--color-gold)', padding: '12px 28px', borderRadius: '6px', textDecoration: 'none', fontWeight: 700, fontSize: '13px', border: '1px solid rgba(201,168,76,0.25)', letterSpacing: '0.5px' }}>
                  {tr('home_guide_cta', lang)}
                </a>
                <a href="/become-a-guide" style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {tr('bag_apply', lang)}
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="grid-3">
                {featuredExps.map((exp, i) => (
                  <a key={exp.id} href={`/experiences/${exp.slug ?? exp.id}`}
                    className="fade-up"
                    style={{
                      display: 'flex', flexDirection: 'column' as const, textDecoration: 'none',
                      backgroundColor: '#111', borderRadius: '12px', overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.07)',
                      transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s',
                      transitionDelay: `${i * 70}ms`,
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(-5px)'
                      el.style.boxShadow = '0 20px 60px rgba(0,0,0,0.5)'
                      el.style.borderColor = 'rgba(201,168,76,0.35)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(0)'
                      el.style.boxShadow = 'none'
                      el.style.borderColor = 'rgba(255,255,255,0.07)'
                    }}
                  >
                    {exp.cover_image_url ? (
                      <div style={{ height: '200px', overflow: 'hidden', position: 'relative' }}>
                        <img src={exp.cover_image_url} alt={exp.title_en ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.55))' }} />
                        {exp.category && (
                          <div style={{ position: 'absolute', top: '12px', left: '12px', backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', color: 'var(--color-gold)', padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 700 }}>
                            {exp.category}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ height: '6px', backgroundColor: 'rgba(201,168,76,0.25)' }} />
                    )}
                    <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-white)', margin: 0, lineHeight: 1.3 }}>
                        {exp.title_en}
                      </h3>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const, alignItems: 'center' }}>
                        {exp.region && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>📍 {exp.region}</span>}
                        {exp.duration_days && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{exp.duration_days}d</span>}
                        {exp.duration_hours && !exp.duration_days && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{exp.duration_hours}h</span>}
                        {exp.guides && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>by {(exp.guides as any).name}</span>}
                      </div>
                      <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {exp.price_per_person_lak && (
                          <div>
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{tr('exp_from', lang)} </span>
                            <span style={{ color: 'var(--color-gold)', fontWeight: 800, fontSize: '17px', fontFamily: 'var(--font-heading)' }}>
                              {Number(exp.price_per_person_lak).toLocaleString()} ₭
                            </span>
                          </div>
                        )}
                        <span style={{ color: 'var(--color-gold)', fontSize: '13px', fontWeight: 600 }}>→</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
              <div className="fade-up" style={{ textAlign: 'center' as const, marginTop: '48px', display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' as const }}>
                <a href="/experiences" style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'rgba(201,168,76,0.1)', color: 'var(--color-gold)', padding: '14px 36px', borderRadius: '4px', border: '1px solid rgba(201,168,76,0.25)', fontWeight: 700, fontSize: '13px', letterSpacing: '1.5px', textTransform: 'uppercase' as const, textDecoration: 'none' }}>
                  {tr('home_exp_cta', lang)}
                </a>
                <a href="/guides" style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.45)', padding: '14px 28px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px', textDecoration: 'none' }}>
                  {tr('home_guide_cta', lang)} →
                </a>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          MAP TEASER
      ═══════════════════════════════════════════════════════ */}
      <section style={{ backgroundColor: '#0a0a0a', padding: 'clamp(64px, 9vw, 112px) clamp(24px, 4vw, 56px)', position: 'relative', overflow: 'hidden' }}>
        {/* Central glow */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '700px', height: '500px',
          background: 'radial-gradient(ellipse, rgba(201,168,76,0.08) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' as const, position: 'relative' }}>
          <div className="fade-up">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
              <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }} />
              <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' as const }}>{tr('map_eyebrow', lang)}</span>
              <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }} />
            </div>

            <h2 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(28px, 4.5vw, 60px)',
              fontWeight: 800, color: 'var(--color-white)',
              letterSpacing: '-1.5px', lineHeight: 1.06, marginBottom: '24px',
            }}>
              {tr('map_h2_line1', lang)}<br />
              <span style={{ color: 'var(--color-gold)' }}>{tr('map_h2_line2', lang)}</span>
            </h2>

            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '16px', lineHeight: 1.78, marginBottom: '44px', maxWidth: '580px', margin: '0 auto 44px' }}>
              {tr('map_desc', lang)}
            </p>

            <a href="/map" style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              backgroundColor: 'var(--color-gold)', color: '#0a0a0a',
              padding: '17px 48px', borderRadius: '4px',
              fontWeight: 700, fontSize: '13px', letterSpacing: '1.5px',
              textTransform: 'uppercase' as const, textDecoration: 'none',
            }}>
              {tr('map_cta', lang)}
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════ */}
      <footer style={{ backgroundColor: '#111', borderTop: '1px solid rgba(255,255,255,0.06)', padding: 'clamp(48px, 6vw, 80px) clamp(24px, 4vw, 56px) 40px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div className="footer-full">
            {/* Brand column */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '22px', color: 'var(--color-white)' }}>ALAN</span>
                <span style={{ width: '5px', height: '5px', borderRadius: '999px', backgroundColor: 'var(--color-gold)' }} />
                <span style={{ color: 'var(--color-gray-400)', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Coffee & Travel</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '14px', lineHeight: 1.75, maxWidth: '300px', marginBottom: '24px' }}>
                {tr('footer_tagline', lang)}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '6px' }}>
                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '12px', letterSpacing: '0.5px' }}>{tr('footer_location', lang)}</span>
                <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '12px' }}>{tr('footer_hours', lang)}</span>
              </div>
            </div>

            {/* Links columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '32px', alignContent: 'start' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '18px' }}>{tr('footer_nav', lang)}</p>
                {FOOTER_LINK_KEYS.slice(0, 3).map(l => (
                  <a key={l.href} href={l.href} style={{ display: 'block', color: 'rgba(255,255,255,0.3)', fontSize: '13px', textDecoration: 'none', marginBottom: '12px', transition: 'color 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-gold)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)' }}
                  >
                    {tr(l.key, lang)}
                  </a>
                ))}
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '18px' }}>{tr('footer_company', lang)}</p>
                {FOOTER_LINK_KEYS.slice(3).map(l => (
                  <a key={l.href} href={l.href} style={{ display: 'block', color: 'rgba(255,255,255,0.3)', fontSize: '13px', textDecoration: 'none', marginBottom: '12px', transition: 'color 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-gold)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)' }}
                  >
                    {tr(l.key, lang)}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '28px', display: 'flex', flexDirection: 'column' as const, gap: '6px' }}>
            <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: '12px' }}>{tr('footer_copy', lang)}</p>
            <a href="tel:+8562094366635" style={{ color: 'var(--color-gold)', fontSize: '12px', textDecoration: 'none', fontWeight: 600 }}>📞 +856 20 94 366 635</a>
            <p style={{ color: 'rgba(255,255,255,0.09)', fontSize: '11px', letterSpacing: '0.5px' }}>ທ່ອງທ່ຽວລາວ &nbsp;·&nbsp; ท่องเที่ยวลาว &nbsp;·&nbsp; Discover Laos Authentically</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
