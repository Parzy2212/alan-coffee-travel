'use client'
import { useState } from 'react'
import Navbar from '@/components/Navbar'
import InquiryModal from '@/components/InquiryModal'
import { useLang } from '@/contexts/LanguageContext'
import { tr } from '@/lib/translations'

type Guide = Record<string, any>
type Experience = Record<string, any>
type Review = Record<string, any>

type Tab = 'about' | 'experiences' | 'reviews' | 'photos'

const GOLD = '#c9a84c'

function StarRating({ rating, count, size = 14 }: { rating: number; count?: number; size?: number }) {
  const r = Math.round(rating * 2) / 2
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: GOLD, fontSize: size, letterSpacing: 1 }}>
        {[1,2,3,4,5].map(i => (
          <span key={i} style={{ opacity: i <= r ? 1 : 0.25 }}>★</span>
        ))}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: size - 2 }}>{rating.toFixed(1)}</span>
      {count != null && count > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: size - 3 }}>({count})</span>}
    </span>
  )
}

// InquiryModal moved to components/InquiryModal.tsx (shared with ExperienceDetailClient)

export default function GuideProfileClient({
  guide, experiences, reviews, guideJsonLd,
}: {
  guide: Guide
  experiences: Experience[]
  reviews: Review[]
  guideJsonLd: object
}) {
  const { lang } = useLang()
  const [activeTab, setActiveTab] = useState<Tab>('about')
  const [showInquiry, setShowInquiry] = useState(false)

  const logContactClick = async (via: string) => {
    try {
      const { supabase } = await import('@/lib/supabase')
      await supabase.from('inquiries').insert({
        guide_id: guide.id,
        name: 'Direct Click',
        message: `Contact click: ${via}`,
        contact_via: via,
        status: 'new',
      })
    } catch {}
  }

  const photo     = guide.profile_photo_url ?? guide.photo_url
  const bio       = lang === 'th' ? (guide.bio_th ?? guide.bio_en ?? guide.bio) : lang === 'lo' ? (guide.bio_lo ?? guide.bio_en ?? guide.bio) : (guide.bio_en ?? guide.bio)
  const langs     = guide.languages_spoken ?? guide.languages ?? []
  const expYrs    = guide.years_experience ?? guide.experience_years
  const isVerif   = guide.verified ?? guide.is_verified
  const photos    = guide.gallery_photos ?? []
  const ratingAvg = guide.rating_avg ?? 0
  const revCount  = guide.review_count ?? reviews.length

  const tabs: { key: Tab; label: string }[] = [
    { key: 'about',       label: tr('gp_about', lang)       },
    { key: 'experiences', label: tr('gp_experiences', lang) },
    { key: 'reviews',     label: tr('gp_reviews', lang)     },
    { key: 'photos',      label: tr('gp_photos', lang)      },
  ]

  const tabStyle = (k: Tab): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '14px 20px', fontSize: 14, fontWeight: activeTab === k ? 700 : 500,
    color: activeTab === k ? 'white' : 'rgba(255,255,255,0.4)',
    borderBottom: `2px solid ${activeTab === k ? GOLD : 'transparent'}`,
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(guideJsonLd) }} />
      {showInquiry && <InquiryModal guide={guide} onClose={() => setShowInquiry(false)} lang={lang} />}

      <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-black)' }}>
        <Navbar />

        {/* HERO / COVER */}
        <div style={{ position: 'relative' }}>
          {guide.cover_photo_url ? (
            <div style={{ height: 320, overflow: 'hidden' }}>
              <img src={guide.cover_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(10,10,10,0.9) 100%)' }} />
            </div>
          ) : (
            <div style={{ height: 200, background: 'linear-gradient(135deg, #111 0%, #1a1508 100%)' }} />
          )}
        </div>

        {/* PROFILE HEADER */}
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end', marginTop: guide.cover_photo_url ? -60 : -30, marginBottom: 32, flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{ flexShrink: 0, position: 'relative' }}>
              {photo ? (
                <img src={photo} alt={guide.name} style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '4px solid #0a0a0a', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }} />
              ) : (
                <div style={{ width: 120, height: 120, borderRadius: '50%', backgroundColor: 'rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, border: '4px solid #0a0a0a' }}>
                  👤
                </div>
              )}
              {isVerif && (
                <div style={{ position: 'absolute', bottom: 4, right: 4, width: 26, height: 26, borderRadius: '50%', backgroundColor: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, border: '2px solid #0a0a0a' }}>
                  ✓
                </div>
              )}
            </div>

            {/* Name + info */}
            <div style={{ flex: 1, minWidth: 200, paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 32, color: 'white', margin: 0, letterSpacing: '-0.5px' }}>{guide.name}</h1>
                {isVerif && (
                  <span style={{ backgroundColor: 'rgba(201,168,76,0.15)', color: GOLD, padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: '1px', border: `1px solid rgba(201,168,76,0.3)` }}>
                    ✓ {tr('gp_license', lang)}
                  </span>
                )}
                {guide.featured && (
                  <span style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: GOLD, padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600 }}>★ FEATURED</span>
                )}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 10px' }}>
                {guide.province}{expYrs ? ` · ${expYrs} ${tr('gp_years_exp', lang)}` : ''}
              </p>
              {ratingAvg > 0 && <StarRating rating={ratingAvg} count={revCount} size={15} />}
              {langs.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {langs.map((l: string) => (
                    <span key={l} style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: GOLD, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{l}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop CTA */}
            <div style={{ paddingBottom: 8 }}>
              <button onClick={() => setShowInquiry(true)} style={{ backgroundColor: GOLD, color: '#000', padding: '14px 32px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: '0.3px' }}>
                {tr('gp_contact', lang)}
              </button>
            </div>
          </div>

          {/* TABS */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 40, overflowX: 'auto', display: 'flex' }}>
            {tabs.map(t => (
              <button key={t.key} style={tabStyle(t.key)} onClick={() => setActiveTab(t.key)}>
                {t.label}
                {t.key === 'experiences' && experiences.length > 0 && (
                  <span style={{ marginLeft: 6, backgroundColor: 'rgba(201,168,76,0.15)', color: GOLD, padding: '1px 6px', borderRadius: 99, fontSize: 11 }}>{experiences.length}</span>
                )}
                {t.key === 'reviews' && revCount > 0 && (
                  <span style={{ marginLeft: 6, backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', padding: '1px 6px', borderRadius: 99, fontSize: 11 }}>{revCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* TAB CONTENT */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 40, paddingBottom: 80 }}>

            {/* ABOUT TAB */}
            {activeTab === 'about' && (
              <div style={{ display: 'grid', gap: 40 }}>
                {bio && (
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, color: 'white', marginBottom: 16 }}>{tr('gp_about', lang)}</h2>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 1.8, maxWidth: 720, margin: 0, whiteSpace: 'pre-line' }}>{bio}</p>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                  {expYrs != null && (
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px 24px' }}>
                      <div style={{ color: GOLD, fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>{expYrs}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{tr('gp_years_exp', lang)}</div>
                    </div>
                  )}
                  {revCount > 0 && (
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px 24px' }}>
                      <div style={{ color: GOLD, fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>{ratingAvg.toFixed(1)}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{tr('guides_rating', lang)} ({revCount} {tr(revCount === 1 ? 'guides_review' : 'guides_reviews', lang)})</div>
                    </div>
                  )}
                  {experiences.length > 0 && (
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px 24px' }}>
                      <div style={{ color: GOLD, fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>{experiences.length}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{tr('gp_experiences', lang)}</div>
                    </div>
                  )}
                </div>
                {(guide.specialties ?? []).length > 0 && (
                  <div>
                    <h3 style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 14 }}>{tr('gp_specialties', lang)}</h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(guide.specialties ?? []).map((sp: string) => (
                        <span key={sp} style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', padding: '6px 14px', borderRadius: 99, fontSize: 13 }}>{sp}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* EXPERIENCES TAB */}
            {activeTab === 'experiences' && (
              <div>
                {experiences.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 15, padding: '40px 0', textAlign: 'center' }}>{tr('gp_no_exp', lang)}</p>
                ) : (
                  <div className="grid-2">
                    {experiences.map(exp => (
                      <a key={exp.id} href={`/experiences/${exp.slug ?? exp.id}`}
                        style={{ backgroundColor: '#111', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
                        {exp.cover_image_url && (
                          <div style={{ height: 180, overflow: 'hidden' }}>
                            <img src={exp.cover_image_url} alt={exp.title_en} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                        <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {exp.category && <span style={{ backgroundColor: 'rgba(201,168,76,0.1)', color: GOLD, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{exp.category}</span>}
                            {exp.duration_hours && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{exp.duration_hours} {tr('exp_hrs', lang)}</span>}
                            {exp.duration_days && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{exp.duration_days} {tr('exp_days', lang)}</span>}
                          </div>
                          <h3 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17, margin: 0, lineHeight: 1.3 }}>
                            {exp.title_en ?? exp.title}
                          </h3>
                          {exp.summary_en && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 1.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{exp.summary_en}</p>}
                          <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {exp.price_per_person_lak && (
                              <div>
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{tr('exp_from', lang)} </span>
                                <span style={{ color: GOLD, fontWeight: 700, fontSize: 15 }}>{Number(exp.price_per_person_lak).toLocaleString()} ₭</span>
                              </div>
                            )}
                            <span style={{ color: GOLD, fontSize: 13, fontWeight: 600 }}>→</span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* REVIEWS TAB */}
            {activeTab === 'reviews' && (
              <div>
                {reviews.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 15 }}>{tr('gp_no_reviews', lang)}</p>
                    <button onClick={() => setShowInquiry(true)} style={{ marginTop: 20, backgroundColor: GOLD, color: '#000', padding: '12px 28px', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                      {tr('gp_contact', lang)}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {ratingAvg > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '24px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 48, fontWeight: 800, color: 'white', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>{ratingAvg.toFixed(1)}</div>
                          <StarRating rating={ratingAvg} size={18} />
                          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6 }}>{revCount} {tr('guides_reviews', lang)}</div>
                        </div>
                      </div>
                    )}
                    {reviews.map((rev: Review) => (
                      <div key={rev.id} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div>
                            <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{rev.reviewer_name ?? 'Anonymous'}</div>
                            {rev.reviewer_country && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{rev.reviewer_country}</div>}
                          </div>
                          {rev.rating && <StarRating rating={rev.rating} />}
                        </div>
                        {rev.review_text && (
                          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{rev.review_text}</p>
                        )}
                        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 12 }}>
                          {new Date(rev.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PHOTOS TAB */}
            {activeTab === 'photos' && (
              <div>
                {photos.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 15, padding: '40px 0', textAlign: 'center' }}>No photos yet.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                    {photos.map((url: string, i: number) => (
                      <div key={i} style={{ aspectRatio: '4/3', overflow: 'hidden', borderRadius: 10 }}>
                        <img src={url} alt={`${guide.name} photo ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* MOBILE STICKY CTA */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 20px', display: 'flex', gap: 10, zIndex: 100 }}>
          <button onClick={() => setShowInquiry(true)} style={{ flex: 1, backgroundColor: GOLD, color: '#000', padding: '14px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            {tr('gp_contact', lang)}
          </button>
          {guide.contact_whatsapp && (
            <a
              href={`https://wa.me/${guide.contact_whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(`Hi ${guide.name}, I found you on AlanGuide. I'd like to know more about your tours.`)}`}
              target="_blank" rel="noopener noreferrer"
              onClick={() => logContactClick('whatsapp')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 50, height: 50, backgroundColor: '#25D366', borderRadius: 10, textDecoration: 'none', fontSize: 22 }}>
              💬
            </a>
          )}
          {guide.contact_line && (
            <a
              href={`https://line.me/R/ti/p/${guide.contact_line}`}
              target="_blank" rel="noopener noreferrer"
              onClick={() => logContactClick('line')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 50, height: 50, backgroundColor: '#00B900', borderRadius: 10, textDecoration: 'none', fontSize: 16, color: '#fff', fontWeight: 800 }}>
              L
            </a>
          )}
        </div>
      </main>
    </>
  )
}
