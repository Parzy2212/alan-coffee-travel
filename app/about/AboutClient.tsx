'use client'
import Navbar from '@/components/Navbar'
import { useLang } from '@/contexts/LanguageContext'
import { tr } from '@/lib/translations'

export default function AboutClient() {
  const { lang } = useLang()

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>

      <Navbar />

      {/* OPENING */}
      <section className="hero-section" style={{ backgroundColor: 'var(--color-black)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
            <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
            <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>{tr('about_eyebrow', lang)}</span>
          </div>
          <h1 className="page-h1" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-white)' }}>
            {tr('about_h1_line1', lang)}<br />
            <span style={{ color: 'var(--color-gold)' }}>{tr('about_h1_line2', lang)}</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '18px', lineHeight: 1.8, fontWeight: 400 }}>
            {tr('about_sub', lang)}
          </p>
        </div>
      </section>

      {/* PART 1 — WHAT ALAN IS */}
      <section className="prose-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
          <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>{tr('about_s1_eyebrow', lang)}</span>
        </div>
        <h2 className="page-h2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-black)' }}>
          {tr('about_s1_h2', lang)}
        </h2>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9 }}>
          {tr('about_s1_p1', lang)}
        </p>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9, marginTop: '20px' }}>
          {tr('about_s1_p2', lang)}
        </p>
      </section>

      {/* DIVIDER */}
      <div className="px-page" style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ height: '1px', backgroundColor: 'var(--color-cream-border)' }}></div>
      </div>

      {/* PART 2 — WHY IT EXISTS */}
      <section className="prose-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
          <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>{tr('about_s2_eyebrow', lang)}</span>
        </div>
        <h2 className="page-h2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-black)' }}>
          {tr('about_s2_h2_line1', lang)}<br />{tr('about_s2_h2_line2', lang)}
        </h2>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9 }}>
          {tr('about_s2_p1', lang)}
        </p>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9, marginTop: '20px' }}>
          {tr('about_s2_p2', lang)}
        </p>
      </section>

      {/* DIVIDER */}
      <div className="px-page" style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ height: '1px', backgroundColor: 'var(--color-cream-border)' }}></div>
      </div>

      {/* PART 3 — WHAT MAKES IT DIFFERENT */}
      <section className="prose-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
          <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>{tr('about_s3_eyebrow', lang)}</span>
        </div>
        <h2 className="page-h2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-black)' }}>
          {tr('about_s3_h2_line1', lang)}<br />{tr('about_s3_h2_line2', lang)}
        </h2>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9 }}>
          {tr('about_s3_p1', lang)}
        </p>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9, marginTop: '20px' }}>
          {tr('about_s3_p2', lang)}
        </p>
      </section>

      {/* DIVIDER */}
      <div className="px-page" style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ height: '1px', backgroundColor: 'var(--color-cream-border)' }}></div>
      </div>

      {/* PART 4 — WHAT YOU WILL FEEL */}
      <section className="prose-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
          <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>{tr('about_s4_eyebrow', lang)}</span>
        </div>
        <h2 className="page-h2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-black)' }}>
          {tr('about_s4_h2', lang)}
        </h2>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9 }}>
          {tr('about_s4_p1', lang)}
        </p>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9, marginTop: '20px' }}>
          {tr('about_s4_p2', lang)}
        </p>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9, marginTop: '20px' }}>
          {tr('about_s4_p3', lang)}
        </p>
      </section>

      {/* CLOSING */}
      <section className="hero-section-sm" style={{ backgroundColor: 'var(--color-black)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '24px' }}>Alan Coffee & Travel</p>
          <h2 className="page-h2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-white)', marginBottom: '40px' }}>
            {tr('about_closing_h2_line1', lang)}<br />
            <span style={{ color: 'var(--color-gold)' }}>{tr('about_closing_h2_line2', lang)}</span>
          </h2>
          <a href="/" style={{ display: 'inline-block', backgroundColor: 'var(--color-gold)', color: 'var(--color-black)', padding: '16px 40px', borderRadius: '4px', fontWeight: 700, fontSize: '14px', textDecoration: 'none', letterSpacing: '1px', textTransform: 'uppercase' as const }}>
            {tr('about_closing_cta', lang)}
          </a>
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
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{tr('footer_copy', lang)}</p>
              <a href="tel:+8562094366635" style={{ color: 'var(--color-gold)', fontSize: '12px', textDecoration: 'none', fontWeight: 600, display: 'inline-block', marginTop: '4px' }}>📞 +856 20 94 366 635</a>
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
