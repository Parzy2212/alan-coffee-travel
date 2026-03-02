'use client'
import { useState } from 'react'
import Navbar from '@/components/Navbar'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [sent, setSent] = useState(false)

  function handleSubmit() {
    if (!form.name || !form.email || !form.message) return
    setSent(true)
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>

      <Navbar />

      {/* HERO */}
      <section className="hero-section-sm" style={{ backgroundColor: 'var(--color-black)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
            <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>Contact</span>
          </div>
          <h1 className="page-h1" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-white)' }}>
            Come find us.<br />
            <span style={{ color: 'var(--color-gold)' }}>Or reach out.</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '18px', lineHeight: 1.8 }}>
            We are always happy to hear from travelers, partners, and anyone curious about Attapeu and Laos.
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <section className="section-pad" style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div className="grid-2">

          {/* LEFT — INFO */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
              <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>Find Us</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '40px' }}>
              <div>
                <p style={{ color: 'var(--color-black)', fontWeight: 700, fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '8px' }}>Location</p>
                <p style={{ color: 'var(--color-gray-600)', fontSize: '16px', lineHeight: 1.7 }}>Alan Coffee & Travel<br />Attapeu, Laos</p>
              </div>

              <div>
                <p style={{ color: 'var(--color-black)', fontWeight: 700, fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '8px' }}>Hours</p>
                <p style={{ color: 'var(--color-gray-600)', fontSize: '16px', lineHeight: 1.7 }}>
                  Monday — Friday<br />
                  8:00 AM — 6:00 PM<br />
                  <span style={{ color: 'var(--color-gray-400)', fontSize: '14px' }}>Saturday — Sunday: 9:00 AM — 5:00 PM</span>
                </p>
              </div>

              <div>
                <p style={{ color: 'var(--color-black)', fontWeight: 700, fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '8px' }}>Social</p>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                  <a href="#" style={{ color: 'var(--color-gold)', fontSize: '15px', textDecoration: 'none', fontWeight: 500 }}>Facebook →</a>
                  <a href="#" style={{ color: 'var(--color-gold)', fontSize: '15px', textDecoration: 'none', fontWeight: 500 }}>Instagram →</a>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--color-black)', borderRadius: '12px', padding: '28px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ color: 'var(--color-gold)', fontWeight: 700, fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '12px' }}>For Partners</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: 1.7 }}>
                  Want to list your province or local experience on Alan Coffee Travel? We'd love to hear from you.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT — FORM */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
              <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>Send a Message</span>
            </div>

            {sent ? (
              <div style={{ backgroundColor: 'var(--color-black)', borderRadius: '12px', padding: '48px 32px', textAlign: 'center' as const, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '32px', marginBottom: '16px' }}>☕</div>
                <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-white)', fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>Message received.</h3>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '15px', lineHeight: 1.7 }}>Thank you for reaching out. We will get back to you shortly — over a good cup of coffee.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '20px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--color-gray-600)', display: 'block', marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase' as const }}>Name</label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Your name"
                    style={{ width: '100%', backgroundColor: 'var(--color-cream-dark)', border: '1px solid var(--color-cream-border)', borderRadius: '6px', padding: '14px 16px', color: 'var(--color-black)', fontSize: '15px', boxSizing: 'border-box' as const, outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--color-gray-600)', display: 'block', marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase' as const }}>Email</label>
                  <input
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="your@email.com"
                    type="email"
                    style={{ width: '100%', backgroundColor: 'var(--color-cream-dark)', border: '1px solid var(--color-cream-border)', borderRadius: '6px', padding: '14px 16px', color: 'var(--color-black)', fontSize: '15px', boxSizing: 'border-box' as const, outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--color-gray-600)', display: 'block', marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase' as const }}>Message</label>
                  <textarea
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                    placeholder="Tell us what's on your mind..."
                    rows={6}
                    style={{ width: '100%', backgroundColor: 'var(--color-cream-dark)', border: '1px solid var(--color-cream-border)', borderRadius: '6px', padding: '14px 16px', color: 'var(--color-black)', fontSize: '15px', boxSizing: 'border-box' as const, outline: 'none', resize: 'vertical' as const, fontFamily: 'var(--font-body)' }}
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  style={{ backgroundColor: 'var(--color-black)', color: 'var(--color-gold)', padding: '16px 32px', borderRadius: '4px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' as const, alignSelf: 'flex-start' as const, minHeight: '48px' }}>
                  Send Message
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ backgroundColor: 'var(--color-black-soft)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div className="footer-layout">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '18px', color: 'var(--color-white)' }}>ALAN</span>
                <span style={{ width: '4px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--color-gold)' }}></span>
                <span style={{ color: 'var(--color-gray-400)', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Coffee & Travel</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>© 2025 Alan Coffee & Travel — Attapeu, Laos</p>
            </div>
            <div className="footer-links">
              {[{ label: 'Destinations', href: '/destinations' }, { label: 'Guides', href: '/guides' }, { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }].map(item => (
                <a key={item.label} href={item.href} style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', textDecoration: 'none' }}>{item.label}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </main>
  )
}
