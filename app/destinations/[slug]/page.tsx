import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'

export const runtime = 'edge'

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

const BASE_URL = 'https://www.alan-coffee-travel.com'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data } = await supabase
    .from('destinations')
    .select('title_en, title_lo, excerpt_en, region, district, image_urls')
    .eq('slug', slug)
    .single()

  if (!data) return { title: 'Destination' }

  const heroImage = data.image_urls?.[0]
  const region = data.region || 'Laos'
  const title = data.title_en
  const description =
    data.excerpt_en
      ? `${data.excerpt_en} — ${region}, Laos. ທ່ອງທ່ຽວລາວ | ท่องเที่ยวลาว`
      : `Discover ${title} — ${region}, Laos. Authentic local experience curated by Alan Coffee & Travel. ທ່ອງທ່ຽວລາວ | ท่องเที่ยวลาว`

  return {
    title: `${title} — ${region}`,
    description,
    keywords: [
      title, region, 'Laos travel', 'ທ່ອງທ່ຽວລາວ', 'ท่องเที่ยวลาว',
      `${region} tourism`, `${region} Laos`, 'authentic Laos', 'Laos destinations',
      `สถานที่ท่องเที่ยว${region}`, `ທ່ຽວ${region}`,
      ...(data.title_lo ? [data.title_lo] : []),
    ],
    alternates: {
      canonical: `${BASE_URL}/destinations/${slug}`,
    },
    openGraph: {
      title: `${title} — ${region}, Laos | Alan Coffee & Travel`,
      description: data.excerpt_en || `Discover ${title} in ${region}, Laos.`,
      url: `${BASE_URL}/destinations/${slug}`,
      images: heroImage
        ? [{ url: heroImage, width: 1200, height: 630, alt: `${title} — ${region}, Laos` }]
        : [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Alan Coffee & Travel — Laos' }],
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

  const attractionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: destination.title_en,
    ...(destination.title_lo && { alternateName: destination.title_lo }),
    description: destination.excerpt_en || destination.description_en || `${destination.title_en} — ${destination.region}, Laos`,
    url: `${BASE_URL}/destinations/${slug}`,
    ...(heroImage && { image: heroImage }),
    touristType: ['Adventure', 'Nature', 'Cultural'],
    address: {
      '@type': 'PostalAddress',
      addressLocality: destination.district || destination.region,
      addressRegion: destination.region,
      addressCountry: 'LA',
    },
    ...(destination.location_lat && destination.location_lng && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: destination.location_lat,
        longitude: destination.location_lng,
      },
    }),
    isAccessibleForFree: true,
    inLanguage: ['en', 'lo', 'th'],
    provider: {
      '@type': 'LocalBusiness',
      name: 'Alan Coffee & Travel',
      url: BASE_URL,
    },
  }

  const { data: guideRows } = await supabase
    .from('guide_destinations')
    .select('guides(*)')
    .eq('destination_id', destination.id)
  const linkedGuides: any[] = (guideRows ?? []).map((r: any) => r.guides).filter(Boolean)

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(attractionJsonLd) }}
      />

      <Navbar />

      {/* BREADCRUMB */}
      <div style={{ backgroundColor: 'var(--color-black)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <a href="/destinations" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'color 0.15s' }}>
            ← All Destinations
          </a>
        </div>
      </div>

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
            <a href="/contact" style={{ display: 'block', width: '100%', backgroundColor: 'var(--color-gold)', color: 'var(--color-black)', padding: '16px', borderRadius: '4px', fontWeight: 700, fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' as const, textDecoration: 'none', textAlign: 'center' as const, boxSizing: 'border-box' as const }}>
              Book Experience
            </a>
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
