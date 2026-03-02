import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'About — ກ່ຽວກັບເຮົາ | ท่องเที่ยวลาว',
  description:
    'Alan Coffee & Travel was born in Attapeu — the only café in the province built for international travelers. A calm space for coffee, reflection, and cultural discovery. ອັດຕະປື ລາວ | อัตตะปือ ลาว | Attapeu Laos',
  keywords: [
    'about Alan Coffee Travel', 'Attapeu café story', 'Laos travel café',
    'ກ່ຽວກັບ Alan Coffee', 'ອັດຕະປື', 'อัตตะปือ', 'ท่องเที่ยวลาว', 'ທ່ອງທ່ຽວລາວ',
  ],
  alternates: {
    canonical: 'https://www.alan-coffee-travel.com/about',
  },
  openGraph: {
    title: 'About Alan Coffee & Travel — Attapeu, Laos',
    description:
      'A calm meeting place for travelers in Attapeu. Built from quiet resilience. Shaped by stillness. ອັດຕະປື ລາວ | อัตตะปือ',
    url: 'https://www.alan-coffee-travel.com/about',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Alan Coffee & Travel — Attapeu, Laos' }],
  },
}

export default function AboutPage() {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>

      <Navbar />

      {/* OPENING */}
      <section className="hero-section" style={{ backgroundColor: 'var(--color-black)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
            <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
            <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>Attapeu, Laos</span>
          </div>
          <h1 className="page-h1" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-white)' }}>
            A place to arrive.<br />
            <span style={{ color: 'var(--color-gold)' }}>Before you continue.</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '18px', lineHeight: 1.8, fontWeight: 400 }}>
            Alan is a café in Attapeu built for those who travel with intention. Not a stopover. A destination in itself.
          </p>
        </div>
      </section>

      {/* PART 1 — WHAT ALAN IS */}
      <section className="prose-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
          <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>What Alan Is</span>
        </div>
        <h2 className="page-h2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-black)' }}>
          A meeting place for travelers.
        </h2>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9 }}>
          Alan is not defined by its menu. It is defined by its quality of space — calm, refined, and unhurried. A room where a traveller can sit without agenda, order something honest, and feel the weight of the road begin to lift.
        </p>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9, marginTop: '20px' }}>
          It exists at the intersection of coffee culture and travel culture — where the two have always belonged together.
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
          <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>Why It Exists</span>
        </div>
        <h2 className="page-h2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-black)' }}>
          Built from doubt.<br />Shaped by stillness.
        </h2>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9 }}>
          Alan did not begin with confidence. It began with the honest recognition that we were not yet good enough — and the decision to build anyway. Quietly. Carefully. Without noise.
        </p>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9, marginTop: '20px' }}>
          That origin is still present in every corner of the space. Not as a story we tell — but as a quality you feel when you walk in.
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
          <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>What Makes It Different</span>
        </div>
        <h2 className="page-h2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-black)' }}>
          The only café in Attapeu<br />built for the world.
        </h2>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9 }}>
          Most cafés in this region serve locals. Alan serves anyone who travels with purpose. It is the only space in Attapeu that positions itself as a direct touchpoint for international travellers — offering not just coffee, but cultural orientation, local knowledge, and curated travel guidance.
        </p>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9, marginTop: '20px' }}>
          Coffee. Cultural discovery. Travel guidance. In one room.
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
          <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>What You Will Feel Here</span>
        </div>
        <h2 className="page-h2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-black)' }}>
          Quiet courage.
        </h2>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9 }}>
          Not inspiration. Not motivation. Something quieter than that.
        </p>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9, marginTop: '20px' }}>
          Alan is for the traveller who is tired — not of the journey, but of the noise around it. For those who feel lost and need space to think. For those who already know what they want to do, but need a moment of stillness before they begin.
        </p>
        <p style={{ color: 'var(--color-gray-600)', fontSize: '17px', lineHeight: 1.9, marginTop: '20px' }}>
          You will leave feeling ready. Not loud. Not rushed. Just ready.
        </p>
      </section>

      {/* CLOSING */}
      <section className="hero-section-sm" style={{ backgroundColor: 'var(--color-black)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '24px' }}>Alan Coffee & Travel</p>
          <h2 className="page-h2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-white)', marginBottom: '40px' }}>
            Attapeu, Laos.<br />
            <span style={{ color: 'var(--color-gold)' }}>Where the journey slows down.</span>
          </h2>
          <a href="/" style={{ display: 'inline-block', backgroundColor: 'var(--color-gold)', color: 'var(--color-black)', padding: '16px 40px', borderRadius: '4px', fontWeight: 700, fontSize: '14px', textDecoration: 'none', letterSpacing: '1px', textTransform: 'uppercase' as const }}>
            Explore Destinations
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
