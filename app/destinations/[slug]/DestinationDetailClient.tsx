'use client'
import Navbar from '@/components/Navbar'
import { useLang } from '@/contexts/LanguageContext'
import { tr } from '@/lib/translations'

type Destination = {
  id: string
  slug: string
  title_en: string
  title_lo: string | null
  excerpt_en: string | null
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
  transport_price: string | null
  has_guide: boolean | null
  location_lat: number | null
  location_lng: number | null
}

type Guide = {
  id: string
  name: string
  photo_url: string | null
  languages: string[] | null
  phone: string | null
  facebook: string | null
  is_verified: boolean | null
}

const RATINGS = [
  {
    key: 'rating_experience',
    labelKey: 'rating_exp' as const,
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
    labelKey: 'rating_access' as const,
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
    labelKey: 'rating_auth' as const,
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
    labelKey: 'rating_tranq' as const,
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
    labelKey: 'rating_value' as const,
    criteria: [
      '1 — Poor value, high cost for average experience',
      '2 — Below average return',
      '3 — Fair, balanced cost and experience',
      '4 — Great value, rewarding experience',
      '5 — Exceptional, unforgettable at any cost',
    ],
  },
]

export default function DestinationDetailClient({
  destination,
  linkedGuides,
  attractionJsonLd,
}: {
  destination: Destination
  linkedGuides: Guide[]
  attractionJsonLd: object
}) {
  const { lang } = useLang()

  const images: string[] = destination.image_urls ?? []
  const heroImage = images[0] ?? null
  const galleryImages = images.slice(1)
  const isAssessed = destination.assessment_status === 'assessed'
  const ratedDims = RATINGS.filter(
    d => (destination as any)[d.key] != null && (destination as any)[d.key] > 0
  )

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
            {tr('detail_all_dest', lang)}
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
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' as const }}>{tr('detail_photo_coming', lang)}</p>
          </div>
        </section>
      )}

      {/* GALLERY */}
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
              <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>{tr('detail_about_eyebrow', lang)}</span>
            </div>
            <p style={{ color: 'var(--color-gray-600)', fontSize: '16px', lineHeight: 1.8 }}>
              {destination.description_en || destination.excerpt_en || tr('detail_desc_coming', lang)}
            </p>
          </div>

          {/* RIGHT: details + ratings */}
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>

            {/* Details card */}
            <div style={{ backgroundColor: 'var(--color-black)', borderRadius: '12px', padding: '28px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-gold)', fontSize: '14px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '20px' }}>{tr('detail_details_card', lang)}</h3>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>{tr('detail_label_region', lang)}</p>
                  <p style={{ color: 'var(--color-white)', fontSize: '14px', fontWeight: 600 }}>{destination.region || '—'}</p>
                </div>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>{tr('detail_label_assessment', lang)}</p>
                  {isAssessed ? (
                    <span style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: '#c9a84c', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>{tr('detail_assessed_badge', lang)}</span>
                  ) : (
                    <span style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', padding: '4px 10px', borderRadius: '999px', fontSize: '12px' }}>{tr('detail_not_assessed', lang)}</span>
                  )}
                </div>
                {destination.transport_price && (
                  <div>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>{tr('detail_label_transport', lang)}</p>
                    <p style={{ color: 'var(--color-white)', fontSize: '14px', fontWeight: 600 }}>🚗 {destination.transport_price}</p>
                  </div>
                )}
                {destination.has_guide && (
                  <div>
                    <p style={{ color: '#4caf50', fontSize: '13px', fontWeight: 600 }}>{tr('detail_guide_avail', lang)}</p>
                  </div>
                )}
                {destination.location_lat && destination.location_lng && (
                  <a
                    href={`https://www.google.com/maps?q=${destination.location_lat},${destination.location_lng}`}
                    target="_blank"
                    style={{ display: 'block', backgroundColor: 'rgba(201,168,76,0.1)', color: '#c9a84c', padding: '10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' as const, border: '1px solid rgba(201,168,76,0.2)' }}
                  >
                    {tr('detail_view_maps', lang)}
                  </a>
                )}
              </div>
            </div>

            {/* Alan Travel Standard card */}
            {isAssessed && ratedDims.length > 0 && (
              <div style={{ backgroundColor: 'var(--color-black)', borderRadius: '12px', padding: '28px', border: '1px solid rgba(201,168,76,0.2)' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-gold)', fontSize: '14px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '20px' }}>{tr('detail_alan_standard', lang)}</h3>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '18px' }}>
                  {ratedDims.map(dim => {
                    const val = (destination as any)[dim.key] as number
                    return (
                      <div key={dim.key}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '1px', margin: 0 }}>{tr(dim.labelKey, lang)}</p>
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
              {tr('detail_book', lang)}
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
              <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>{tr('guides_eyebrow', lang)}</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 800, color: 'var(--color-white)', letterSpacing: '-1px', marginBottom: '28px' }}>
              {tr('detail_guides_h2', lang)}
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
                      {g.is_verified && (
                        <span style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: '#c9a84c', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700 }}>
                          ✓ {tr('guides_verified', lang)}
                        </span>
                      )}
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
                          📞 {tr('guides_call', lang)}
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
              {tr('detail_more_guides', lang)} <a href="/guides" style={{ color: '#c9a84c' }}>Alan Café · Attapeu</a>
            </p>
          </div>
        </section>
      )}

      <footer style={{ backgroundColor: 'var(--color-black)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 32px', textAlign: 'center' as const }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{tr('footer_copy', lang)}</p>
      </footer>

    </main>
  )
}
