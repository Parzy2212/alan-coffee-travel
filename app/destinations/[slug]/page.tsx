import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data } = await supabase
    .from('destinations')
    .select('title_en, excerpt_en, region, image_urls')
    .eq('slug', slug)
    .single()

  if (!data) return { title: 'Destination' }

  const heroImage = data.image_urls?.[0]

  return {
    title: data.title_en,
    description: data.excerpt_en || `Discover ${data.title_en} — ${data.region}, Laos.`,
    openGraph: {
      title: `${data.title_en} — Alan Coffee & Travel`,
      description: data.excerpt_en || `Discover ${data.title_en} in ${data.region}, Laos.`,
      url: `https://alan-coffee-travel.vercel.app/destinations/${slug}`,
      ...(heroImage && { images: [{ url: heroImage }] }),
    },
  }
}

export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: destination } = await supabase
    .from('destinations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!destination) notFound()

  const images: string[] = destination.image_urls ?? []
  const heroImage = images[0] ?? null
  const galleryImages = images.slice(1)
  const isAssessed = destination.assessment_status === 'assessed'
  const ratedDims = RATINGS.filter(d => destination[d.key] != null && destination[d.key] > 0)

  const { data: guideRows } = await supabase
    .from('guide_destinations')
    .select('guides(*)')
    .eq('destination_id', destination.id)
  const linkedGuides: any[] = (guideRows ?? []).map((r: any) => r.guides).filter(Boolean)

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>

      {/* NAV */}
      <nav style={{ backgroundColor: 'var(--color-white)', borderBottom: '1px solid var(--color-cream-border)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 20px', height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '20px', color: 'var(--color-black)' }}>ALAN</span>
            <span style={{ width: '4px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--color-gold)', flexShrink: 0 }}></span>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 400, fontSize: '13px', color: 'var(--color-gray-600)', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Coffee Travel</span>
          </a>
          <a href="/" style={{ color: 'var(--color-gray-600)', fontSize: '13px', textDecoration: 'none', minHeight: '44px', display: 'flex', alignItems: 'center' }}>← Back</a>
        </div>
      </nav>

      {/* HERO TEXT */}
      <section className="hero-section-sm" style={{ backgroundColor: 'var(--color-black)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)', flexShrink: 0 }}></div>
            <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>{destination.region}</span>
          </div>
          <h1 className="hero-h1-lg" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-white)', marginBottom: '16px' }}>
            {destination.title_en}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '18px', lineHeight: 1.6, maxWidth: '640px' }}>
            {destination.excerpt_en}
          </p>
        </div>
      </section>

      {/* HERO IMAGE or placeholder */}
      {heroImage ? (
        <section style={{ backgroundColor: 'var(--color-black)', lineHeight: 0 }}>
          <img
            src={heroImage}
            alt={destination.title_en}
            style={{ width: '100%', height: '480px', objectFit: 'cover', display: 'block' }}
          />
        </section>
      ) : (
        <section style={{ backgroundColor: 'var(--color-black-muted)', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏔️</div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Photo coming soon</p>
          </div>
        </section>
      )}

      {/* GALLERY (additional images) */}
      {galleryImages.length > 0 && (
        <section style={{ backgroundColor: 'var(--color-black)', padding: '16px 32px 0' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
            {galleryImages.map((url: string, i: number) => (
              <img
                key={i}
                src={url}
                alt={`${destination.title_en} ${i + 2}`}
                style={{ height: '180px', minWidth: '260px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
              />
            ))}
          </div>
        </section>
      )}

      {/* CONTENT */}
      <section style={{ padding: '48px 20px', maxWidth: '900px', margin: '0 auto' }}>
        <div className="grid-detail">

          {/* LEFT: description */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
              <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>About</span>
            </div>
            <p style={{ color: 'var(--color-gray-600)', fontSize: '16px', lineHeight: 1.8 }}>
              {destination.description_en || destination.excerpt_en || 'Full description coming soon.'}
            </p>
          </div>

          {/* RIGHT: details + ratings */}
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>

            {/* Details card */}
            <div style={{ backgroundColor: 'var(--color-black)', borderRadius: '12px', padding: '28px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-gold)', fontSize: '14px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '20px' }}>Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>Region</p>
                  <p style={{ color: 'var(--color-white)', fontSize: '14px', fontWeight: 600 }}>{destination.region || '—'}</p>
                </div>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>Assessment</p>
                  {isAssessed ? (
                    <span style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: '#c9a84c', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>★ Assessed</span>
                  ) : (
                    <span style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', padding: '4px 10px', borderRadius: '999px', fontSize: '12px' }}>Not yet assessed</span>
                  )}
                </div>
                {destination.transport_price && (
                  <div>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>Transport</p>
                    <p style={{ color: 'var(--color-white)', fontSize: '14px', fontWeight: 600 }}>🚗 {destination.transport_price}</p>
                  </div>
                )}
                {destination.has_guide && (
                  <div>
                    <p style={{ color: '#4caf50', fontSize: '13px', fontWeight: 600 }}>✓ Guide Available</p>
                  </div>
                )}
                {destination.location_lat && destination.location_lng && (
                  <a
                    href={`https://www.google.com/maps?q=${destination.location_lat},${destination.location_lng}`}
                    target="_blank"
                    style={{ display: 'block', backgroundColor: 'rgba(201,168,76,0.1)', color: '#c9a84c', padding: '10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' as const, border: '1px solid rgba(201,168,76,0.2)' }}
                  >
                    View on Google Maps 🗺️
                  </a>
                )}
              </div>
            </div>

            {/* Alan Travel Standard card */}
            {isAssessed && ratedDims.length > 0 && (
              <div style={{ backgroundColor: 'var(--color-black)', borderRadius: '12px', padding: '28px', border: '1px solid rgba(201,168,76,0.2)' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-gold)', fontSize: '14px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '20px' }}>★ Alan Travel Standard</h3>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '18px' }}>
                  {ratedDims.map(dim => {
                    const val = destination[dim.key] as number
                    return (
                      <div key={dim.key}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '1px', margin: 0 }}>{dim.label}</p>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[1, 2, 3, 4, 5].map(n => (
                              <span key={n} style={{ fontSize: '14px', color: n <= val ? '#c9a84c' : 'rgba(255,255,255,0.12)' }}>★</span>
                            ))}
                          </div>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>{dim.criteria[val - 1]}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Book button */}
            <button style={{ width: '100%', backgroundColor: 'var(--color-gold)', color: 'var(--color-black)', padding: '16px', borderRadius: '4px', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' as const }}>
              Book Experience
            </button>
          </div>
        </div>
      </section>

      {/* AVAILABLE GUIDES */}
      {linkedGuides.length > 0 && (
        <section style={{ backgroundColor: '#0d0d0d', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '64px 32px' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
              <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>Local Expertise</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 800, color: 'var(--color-white)', letterSpacing: '-1px', marginBottom: '28px' }}>
              Available Guides
            </h2>
            <div className="grid-3" style={{ gap: '16px' }}>
              {linkedGuides.map(g => (
                <div key={g.id} style={{ backgroundColor: '#111', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  {g.photo_url ? (
                    <img src={g.photo_url} alt={g.name} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(201,168,76,0.35)', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>👤</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' as const }}>
                      <p style={{ color: 'var(--color-white)', fontWeight: 700, fontSize: '15px', margin: 0 }}>{g.name}</p>
                      {g.is_verified && <span style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: '#c9a84c', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700 }}>✓ Verified</span>}
                    </div>
                    {(g.languages ?? []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '4px', marginBottom: '10px' }}>
                        {(g.languages ?? []).map((l: string) => (
                          <span key={l} style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: '#c9a84c', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 600 }}>{l}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                      {g.phone && (
                        <a href={`tel:${g.phone}`} style={{ backgroundColor: '#c9a84c', color: '#000', padding: '7px 14px', borderRadius: '4px', textDecoration: 'none', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                          📞 Call
                        </a>
                      )}
                      {g.facebook && (
                        <a href={g.facebook} target="_blank" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', padding: '7px 14px', borderRadius: '4px', textDecoration: 'none', fontSize: '11px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)' }}>
                          Facebook
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', marginTop: '20px' }}>
              More guides available at <a href="/guides" style={{ color: '#c9a84c' }}>Alan Café · Attapeu</a>
            </p>
          </div>
        </section>
      )}

      <footer style={{ backgroundColor: 'var(--color-black)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 32px', textAlign: 'center' as const }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>© 2025 Alan Coffee Travel Platform</p>
      </footer>

    </main>
  )
}
