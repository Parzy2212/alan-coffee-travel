'use client'
import { useState } from 'react'
import Navbar from '@/components/Navbar'
import { useLang } from '@/contexts/LanguageContext'
import { tr } from '@/lib/translations'

const GOLD = '#c9a84c'

const STEPS = [
  { n: '01', title: 'Apply Online', body: 'Fill out our short form — name, phone, province, specialties. Takes 3 minutes.' },
  { n: '02', title: 'Quick Call', body: "Alan team does a brief call to verify your experience and get to know you." },
  { n: '03', title: 'Build Your Profile', body: 'Add your photo, bio, and list your tours. We help you get the details right.' },
  { n: '04', title: 'Go Live', body: 'Your profile appears on AlanGuide. Travelers can find and contact you directly.' },
]

const PERKS = [
  { icon: '🆓', title: 'Free to List', body: 'No upfront fees. No commission unless negotiated. Your tours, your income.' },
  { icon: '🌍', title: 'International Reach', body: 'Reach travelers from Thailand, Europe, and beyond who search for authentic Laos experiences.' },
  { icon: '📱', title: 'Direct Contact', body: 'Travelers message you via WhatsApp, LINE, or Telegram — no middleman.' },
  { icon: '✓', title: 'Verified Badge', body: 'We verify guide licenses and display a verified badge — building trust with travelers.' },
  { icon: '☕', title: 'Alan Network', body: 'Connect with other guides and get referrals from Alan Coffee & Travel in Attapeu.' },
  { icon: '📊', title: 'Guide Dashboard', body: 'Manage your profile, experiences, and inquiries from a simple dashboard. Coming soon.' },
]

export default function BecomeAGuidePage() {
  const { lang } = useLang()
  const [form, setForm] = useState({ name: '', phone: '', email: '', province: '', specialties: '', message: '' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.name || !form.phone) return
    setSending(true)
    const { supabase } = await import('@/lib/supabase')
    await supabase.from('inquiries').insert({
      name: form.name,
      email: form.email || null,
      message: `GUIDE APPLICATION\nPhone: ${form.phone}\nProvince: ${form.province}\nSpecialties: ${form.specialties}\n\n${form.message}`,
      contact_via: 'become_a_guide',
    })
    setSent(true)
    setSending(false)
  }

  const inp: React.CSSProperties = {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '12px 16px', color: 'white', fontSize: 15, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--color-black)' }}>
      <Navbar />

      {/* HERO */}
      <section style={{ background: 'linear-gradient(160deg, #0a0a0a 0%, #13100a 60%, #0a0a0a 100%)', borderBottom: '1px solid rgba(201,168,76,0.1)', padding: '80px 20px 60px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', backgroundColor: 'rgba(201,168,76,0.1)', color: GOLD, padding: '6px 18px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 28 }}>
            {tr('bag_eyebrow', lang)}
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 'clamp(36px, 6vw, 60px)', color: 'white', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 24 }}>
            {tr('bag_h1', lang)}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, lineHeight: 1.7, maxWidth: 560, margin: '0 auto 36px' }}>
            {tr('bag_sub', lang)}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="#apply" style={{ backgroundColor: GOLD, color: '#000', padding: '16px 36px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 15, letterSpacing: '0.3px' }}>
              {tr('bag_apply', lang)}
            </a>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>{tr('bag_free', lang)}</span>
          </div>
        </div>
      </section>

      {/* PERKS */}
      <section style={{ padding: '80px 20px', maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 32, color: 'white', letterSpacing: '-0.5px' }}>Why Join AlanGuide?</h2>
        </div>
        <div className="grid-3">
          {PERKS.map(p => (
            <div key={p.title} style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '28px 24px' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>{p.icon}</div>
              <h3 style={{ color: 'white', fontWeight: 700, fontSize: 17, marginBottom: 10 }}>{p.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: '80px 20px', backgroundColor: '#0c0c0c', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 32, color: 'white', letterSpacing: '-0.5px' }}>How It Works</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: 'flex', gap: 28, alignItems: 'flex-start', paddingBottom: i < STEPS.length - 1 ? 40 : 0, position: 'relative' }}>
                <div style={{ flexShrink: 0, textAlign: 'center', width: 48 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(201,168,76,0.12)', border: `2px solid ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD, fontWeight: 800, fontSize: 14, fontFamily: 'var(--font-heading)' }}>
                    {s.n}
                  </div>
                  {i < STEPS.length - 1 && <div style={{ width: 2, height: 32, backgroundColor: 'rgba(201,168,76,0.15)', margin: '8px auto 0' }} />}
                </div>
                <div style={{ flex: 1, paddingTop: 10 }}>
                  <h3 style={{ color: 'white', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{s.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.7, margin: 0 }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APPLY FORM */}
      <section id="apply" style={{ padding: '80px 20px', maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 32, color: 'white', letterSpacing: '-0.5px', marginBottom: 12 }}>Apply to Join</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>{tr('bag_free', lang)} · We'll get back to you within 48 hours.</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', backgroundColor: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 20, padding: '60px 40px' }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
            <h3 style={{ color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 24, marginBottom: 12 }}>Application Received!</h3>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15 }}>Alan team will contact you within 48 hours via phone or WhatsApp.</p>
          </div>
        ) : (
          <div style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '40px 36px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <input placeholder="Full Name *" value={form.name} onChange={e => set('name', e.target.value)} style={{ ...inp, flex: 1 }} />
                <input placeholder="Phone / WhatsApp *" value={form.phone} onChange={e => set('phone', e.target.value)} style={{ ...inp, flex: 1 }} />
              </div>
              <input placeholder="Email (optional)" type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inp} />
              <input placeholder="Province (e.g. Attapeu, Champasak…)" value={form.province} onChange={e => set('province', e.target.value)} style={inp} />
              <input placeholder="Specialties (e.g. Trekking, Cultural tours, Waterfalls…)" value={form.specialties} onChange={e => set('specialties', e.target.value)} style={inp} />
              <textarea placeholder="Anything else you'd like to share?" value={form.message} onChange={e => set('message', e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} />
              <button onClick={submit} disabled={sending || !form.name || !form.phone}
                style={{ backgroundColor: GOLD, color: '#000', padding: '16px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 16, cursor: 'pointer', opacity: sending ? 0.7 : 1, marginTop: 8 }}>
                {sending ? 'Sending…' : tr('bag_apply', lang)}
              </button>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', margin: 0 }}>
                {tr('bag_free', lang)} · No commission · Alan Coffee & Travel, Attapeu
              </p>
            </div>
          </div>
        )}
      </section>

      <footer style={{ backgroundColor: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 20px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, color: 'white' }}>ALAN</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', marginLeft: 8 }}>Coffee & Travel</span>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 }}>{tr('footer_copy', lang)}</p>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            {['/destinations','/guides','/experiences','/about','/contact'].map(href => (
              <a key={href} href={href} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textDecoration: 'none' }}>{href.slice(1).charAt(0).toUpperCase() + href.slice(2)}</a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  )
}
