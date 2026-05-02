'use client'
import { useState } from 'react'
import Navbar from '@/components/Navbar'
import { useLang } from '@/contexts/LanguageContext'
import { tr } from '@/lib/translations'

const GOLD = '#c9a84c'

type Guide = Record<string, any> | null
type Review = Record<string, any>
type SimilarExp = {
  id: string
  slug: string | null
  title_en: string | null
  cover_image_url: string | null
  category: string | null
  price_per_person_lak: number | null
  duration_hours: number | null
  duration_days: number | null
  region: string | null
}

function StarRating({ rating, count, size = 14 }: { rating: number; count?: number; size?: number }) {
  const r = Math.round(rating * 2) / 2
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: GOLD, fontSize: size }}>
        {[1,2,3,4,5].map(i => <span key={i} style={{ opacity: i <= r ? 1 : 0.25 }}>★</span>)}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: size - 2 }}>{rating.toFixed(1)}</span>
      {count != null && count > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: size - 3 }}>({count})</span>}
    </span>
  )
}

function InquiryModal({ experience, guide, onClose, lang }: { experience: Record<string, any>; guide: Guide; onClose: () => void; lang: string }) {
  const [form, setForm] = useState({ name: '', email: '', country: '', date: '', group: '2', message: '' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.name || !form.message) return
    setSending(true)
    const { supabase } = await import('@/lib/supabase')
    await supabase.from('inquiries').insert({
      experience_id: experience.id,
      guide_id: guide?.id ?? null,
      name: form.name, email: form.email || null, country: form.country || null,
      preferred_date: form.date || null, group_size: Number(form.group) || 2,
      message: form.message, contact_via: 'web',
    })
    setSent(true)
    setSending(false)
  }

  const inp: React.CSSProperties = {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '10px 14px', color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <p style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>{tr('inq_success', lang as any)}</p>
            <button onClick={onClose} style={{ marginTop: 24, backgroundColor: GOLD, color: '#000', padding: '10px 28px', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Close</button>
          </div>
        ) : (
          <>
            <h3 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>
              {tr('exp_book', lang as any)}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 24 }}>{experience.title_en}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input placeholder={tr('inq_name', lang as any)} value={form.name} onChange={e => set('name', e.target.value)} style={inp} />
              <input placeholder={tr('inq_email', lang as any)} type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inp} />
              <div style={{ display: 'flex', gap: 10 }}>
                <input placeholder={tr('inq_country', lang as any)} value={form.country} onChange={e => set('country', e.target.value)} style={{ ...inp, flex: 1 }} />
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={{ ...inp, flex: 1 }} />
              </div>
              <input placeholder={`${tr('inq_group', lang as any)}`} type="number" min={1} max={50} value={form.group} onChange={e => set('group', e.target.value)} style={inp} />
              <textarea placeholder={tr('inq_message', lang as any)} value={form.message} onChange={e => set('message', e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} />
            </div>
            {guide && (guide.contact_whatsapp || guide.contact_line || guide.contact_telegram) && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 10 }}>{tr('inq_or_open', lang as any)}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {guide.contact_whatsapp && (
                    <a href={`https://wa.me/${guide.contact_whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                      style={{ backgroundColor: '#25D366', color: '#fff', padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>WhatsApp</a>
                  )}
                  {guide.contact_line && (
                    <a href={`https://line.me/R/ti/p/${guide.contact_line}`} target="_blank" rel="noopener noreferrer"
                      style={{ backgroundColor: '#00B900', color: '#fff', padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>LINE</a>
                  )}
                  {guide.contact_telegram && (
                    <a href={`https://t.me/${guide.contact_telegram.replace('@','')}`} target="_blank" rel="noopener noreferrer"
                      style={{ backgroundColor: '#2CA5E0', color: '#fff', padding: '8px 14px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Telegram</a>
                  )}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={onClose} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={submit} disabled={sending || !form.name || !form.message}
                style={{ flex: 2, backgroundColor: GOLD, color: '#000', padding: '12px', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: sending ? 0.7 : 1 }}>
                {sending ? '…' : tr('inq_submit', lang as any)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ExperienceDetailClient({
  experience, guide, reviews, similar, expJsonLd,
}: {
  experience: Record<string, any>
  guide: Guide
  reviews: Review[]
  similar: SimilarExp[]
  expJsonLd: object
}) {
  const { lang } = useLang()
  const [showInquiry, setShowInquiry] = useState(false)

  const guidePhoto = guide ? (guide.profile_photo_url ?? guide.photo_url) : null
  const ratingAvg  = experience.rating_avg ?? 0
  const revCount   = experience.review_count ?? reviews.length
  const images: string[] = experience.image_urls ?? (experience.cover_image_url ? [experience.cover_image_url] : [])
  const [heroIdx, setHeroIdx] = useState(0)

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{label}</span>
      <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>{value}</span>
    </div>
  )

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(expJsonLd) }} />
      {showInquiry && <InquiryModal experience={experience} guide={guide} onClose={() => setShowInquiry(false)} lang={lang} />}

      <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-black)' }}>
        <Navbar />

        {/* HERO IMAGE */}
        {images.length > 0 && (
          <div style={{ position: 'relative', height: 420, overflow: 'hidden' }}>
            <img src={images[heroIdx]} alt={experience.title_en ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(10,10,10,0.95) 100%)' }} />
            {images.length > 1 && (
              <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                {images.map((_: string, i: number) => (
                  <button key={i} onClick={() => setHeroIdx(i)}
                    style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', backgroundColor: i === heroIdx ? GOLD : 'rgba(255,255,255,0.3)', padding: 0 }} />
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 48, paddingTop: images.length ? 0 : 48, paddingBottom: 80, alignItems: 'start' }} className="grid-detail">

            {/* LEFT COLUMN */}
            <div>
              {/* Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 0 24px', fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
                <a href="/experiences" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>← {tr('exp_plural', lang)}</a>
                {experience.category && <><span>·</span><span style={{ color: GOLD }}>{experience.category}</span></>}
              </div>

              {/* Title */}
              <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 36, color: 'white', letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: 16 }}>
                {experience.title_en}
              </h1>

              {/* Meta chips */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
                {experience.region && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>📍 {experience.region}</span>}
                {experience.duration_days && <span style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', padding: '4px 10px', borderRadius: 99, fontSize: 13 }}>{experience.duration_days} {tr('exp_days', lang)}</span>}
                {experience.duration_hours && !experience.duration_days && <span style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', padding: '4px 10px', borderRadius: 99, fontSize: 13 }}>{experience.duration_hours} {tr('exp_hrs', lang)}</span>}
                {experience.difficulty && <span style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', padding: '4px 10px', borderRadius: 99, fontSize: 13 }}>{tr('exp_difficulty', lang)}: {experience.difficulty}</span>}
                {ratingAvg > 0 && <StarRating rating={ratingAvg} count={revCount} size={13} />}
              </div>

              {/* Summary */}
              {experience.summary_en && (
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17, lineHeight: 1.8, marginBottom: 32 }}>{experience.summary_en}</p>
              )}

              {/* Description */}
              {experience.description_en && (
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.9, marginBottom: 40, whiteSpace: 'pre-line' }}>{experience.description_en}</p>
              )}

              {/* Highlights */}
              {(experience.highlights ?? []).length > 0 && (
                <div style={{ marginBottom: 36 }}>
                  <h2 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, marginBottom: 16 }}>{tr('exp_highlights', lang)}</h2>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(experience.highlights as string[]).map((h, i) => (
                      <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>
                        <span style={{ color: GOLD, flexShrink: 0, marginTop: 2 }}>✓</span>{h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Includes / Excludes */}
              {((experience.includes ?? []).length > 0 || (experience.excludes ?? []).length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 36 }}>
                  {(experience.includes ?? []).length > 0 && (
                    <div>
                      <h3 style={{ color: 'white', fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{tr('exp_includes', lang)}</h3>
                      {(experience.includes as string[]).map((item, i) => (
                        <div key={i} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginBottom: 6 }}>✓ {item}</div>
                      ))}
                    </div>
                  )}
                  {(experience.excludes ?? []).length > 0 && (
                    <div>
                      <h3 style={{ color: 'white', fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{tr('exp_excludes', lang)}</h3>
                      {(experience.excludes as string[]).map((item, i) => (
                        <div key={i} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 6 }}>✗ {item}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* What to bring */}
              {(experience.what_to_bring ?? []).length > 0 && (
                <div style={{ marginBottom: 36 }}>
                  <h3 style={{ color: 'white', fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{tr('exp_bring', lang)}</h3>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(experience.what_to_bring as string[]).map((item, i) => (
                      <span key={i} style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', padding: '5px 12px', borderRadius: 99, fontSize: 13 }}>{item}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Meeting point */}
              {experience.meeting_point && (
                <div style={{ marginBottom: 36 }}>
                  <h3 style={{ color: 'white', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{tr('exp_meeting', lang)}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>📍 {experience.meeting_point}</p>
                </div>
              )}

              {/* About guide */}
              {guide && (
                <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '24px', marginBottom: 40 }}>
                  <h3 style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 18 }}>{tr('exp_about_guide', lang)}</h3>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    {guidePhoto && <img src={guidePhoto} alt={guide.name} style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{guide.name}</span>
                        {(guide.verified ?? guide.is_verified) && <span style={{ color: GOLD, fontSize: 11 }}>✓ Verified</span>}
                      </div>
                      {guide.province && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: '0 0 8px' }}>{guide.province}</p>}
                      {(guide.bio_en ?? guide.bio) && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.7, margin: '0 0 14px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{guide.bio_en ?? guide.bio}</p>}
                      {guide.slug && <a href={`/guides/${guide.slug}`} style={{ color: GOLD, fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>{tr('guides_view_profile', lang)} →</a>}
                    </div>
                  </div>
                </div>
              )}

              {/* Reviews */}
              {reviews.length > 0 && (
                <div style={{ marginBottom: 48 }}>
                  <h2 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, marginBottom: 24 }}>
                    {tr('gp_reviews', lang)}
                    {ratingAvg > 0 && <span style={{ fontSize: 16, fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginLeft: 12 }}>{ratingAvg.toFixed(1)} · {revCount} {tr('guides_reviews', lang)}</span>}
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {reviews.map(rev => (
                      <div key={rev.id} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div>
                            <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>{rev.reviewer_name ?? 'Anonymous'}</span>
                            {rev.reviewer_country && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginLeft: 8 }}>{rev.reviewer_country}</span>}
                          </div>
                          {rev.rating && <StarRating rating={rev.rating} />}
                        </div>
                        {rev.review_text && <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{rev.review_text}</p>}
                        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 10 }}>
                          {new Date(rev.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Similar */}
              {similar.length > 0 && (
                <div>
                  <h2 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, marginBottom: 20 }}>{tr('exp_similar', lang)}</h2>
                  <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                    {similar.map(s => (
                      <a key={s.id} href={`/experiences/${s.slug ?? s.id}`}
                        style={{ backgroundColor: '#111', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
                        {s.cover_image_url && <div style={{ height: 140, overflow: 'hidden' }}><img src={s.cover_image_url} alt={s.title_en ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                        <div style={{ padding: '14px 16px' }}>
                          <h3 style={{ color: 'white', fontWeight: 700, fontSize: 14, margin: '0 0 6px', lineHeight: 1.3 }}>{s.title_en}</h3>
                          {s.price_per_person_lak && <div style={{ color: GOLD, fontWeight: 700, fontSize: 14 }}>{Number(s.price_per_person_lak).toLocaleString()} ₭</div>}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: BOOKING CARD */}
            <div style={{ position: 'sticky', top: 80, backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px 24px', marginTop: images.length ? '-60px' : 0 }}>
              {experience.price_per_person_lak && (
                <div style={{ marginBottom: 20 }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{tr('exp_from', lang)} </span>
                  <span style={{ color: GOLD, fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                    {Number(experience.price_per_person_lak).toLocaleString()} ₭
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}> / {tr('exp_per_person', lang)}</span>
                </div>
              )}

              {ratingAvg > 0 && <div style={{ marginBottom: 20 }}><StarRating rating={ratingAvg} count={revCount} size={15} /></div>}

              <button onClick={() => setShowInquiry(true)}
                style={{ width: '100%', backgroundColor: GOLD, color: '#000', padding: '16px', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 12 }}>
                {tr('exp_book', lang)}
              </button>

              {guide && (guide.contact_whatsapp || guide.contact_line) && (
                <button onClick={() => setShowInquiry(true)}
                  style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 20 }}>
                  {tr('exp_contact_guide', lang)}
                </button>
              )}

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20 }}>
                {experience.duration_days && <InfoRow label={tr('exp_days', lang)} value={`${experience.duration_days} ${tr('exp_days', lang)}`} />}
                {experience.duration_hours && !experience.duration_days && <InfoRow label={tr('exp_hrs', lang)} value={`${experience.duration_hours} hrs`} />}
                {(experience.min_group || experience.max_group) && <InfoRow label={tr('exp_group', lang)} value={`${experience.min_group ?? 1}–${experience.max_group ?? '∞'} ${tr('exp_min_max', lang)}`} />}
                {experience.difficulty && <InfoRow label={tr('exp_difficulty', lang)} value={experience.difficulty} />}
                {(experience.languages ?? []).length > 0 && <InfoRow label={tr('exp_lang', lang)} value={(experience.languages as string[]).join(', ')} />}
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE STICKY CTA */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 20px', display: 'flex', gap: 10, zIndex: 100 }}>
          {experience.price_per_person_lak && (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginRight: 8 }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{tr('exp_from', lang)}</span>
              <span style={{ color: GOLD, fontWeight: 800, fontSize: 18 }}>{Number(experience.price_per_person_lak).toLocaleString()} ₭</span>
            </div>
          )}
          <button onClick={() => setShowInquiry(true)} style={{ flex: 1, backgroundColor: GOLD, color: '#000', padding: '14px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            {tr('exp_book', lang)}
          </button>
        </div>
      </main>
    </>
  )
}
