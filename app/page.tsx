import { supabase } from '@/lib/supabase'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'Alan Coffee & Travel — Attapeu, Laos',
  description: 'Discover Laos through the lens of a traveler\'s café. Alan Coffee & Travel in Attapeu curates authentic local experiences, destinations, and travel guidance.',
  openGraph: {
    title: 'Alan Coffee & Travel — Attapeu, Laos',
    description: 'Discover Laos through the lens of a traveler\'s café. Authentic experiences, curated destinations.',
    url: 'https://alan-coffee-travel.vercel.app',
  },
}

export default async function Home() {
  const { data: destinations } = await supabase
    .from('destinations')
    .select('*')
    .eq('status', 'active')
    .order('featured', { ascending: false })

  return (
    <main style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }}>
      <Navbar />

      {/* HERO */}
      <section className="hero-section" style={{ backgroundColor: 'var(--color-black)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(ellipse at 70% 50%, rgba(201,168,76,0.08) 0%, transparent 60%)' }}></div>
        <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ height: '1px', width: '40px', backgroundColor: 'var(--color-gold)', flexShrink: 0 }}></div>
            <span style={{ color: 'var(--color-gold)', fontSize: '12px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>Curated Travel Experience</span>
          </div>
          <h1 className="hero-h1" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-white)', marginBottom: '24px' }}>
            Travel Deeper.<br />
            <span style={{ color: 'var(--color-gold)' }}>Live Authentically.</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '18px', lineHeight: 1.7, maxWidth: '560px', marginBottom: '40px' }}>
            Like a perfectly brewed cup — we curate only the most authentic local experiences in Laos.
          </p>
          <div className="hero-buttons">
            <a href="/destinations" style={{ display: 'inline-block', backgroundColor: 'var(--color-gold)', color: 'var(--color-black)', padding: '16px 36px', borderRadius: '4px', fontWeight: 700, fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' as const, textDecoration: 'none', textAlign: 'center' as const }}>Explore Now</a>
            <a href="/guides" style={{ display: 'inline-block', backgroundColor: 'transparent', color: 'var(--color-white)', padding: '16px 36px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 500, fontSize: '14px', textDecoration: 'none', textAlign: 'center' as const }}>Meet Our Guides →</a>
          </div>
        </div>
      </section>

      {/* DESTINATIONS */}
      <section className="section-pad" style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div className="section-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
              <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>Destinations</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 800, color: 'var(--color-black)', letterSpacing: '-1px' }}>Curated Places</h2>
          </div>
          <a href="/destinations" style={{ color: 'var(--color-gray-600)', fontSize: '13px', textDecoration: 'none', borderBottom: '1px solid var(--color-cream-border)', paddingBottom: '2px', alignSelf: 'flex-end' }}>View all →</a>
        </div>
        <div className="grid-3">
          {destinations?.map((d) => (
            <a key={d.id} href={`/destinations/${d.slug}`} style={{ backgroundColor: 'var(--color-white)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-cream-border)', cursor: 'pointer', textDecoration: 'none', display: 'block' }}>
              <div style={{ height: '200px', backgroundColor: 'var(--color-black-soft)', display: 'flex', alignItems: 'flex-end', padding: '20px', backgroundImage: d.image_urls?.[0] ? `url(${d.image_urls[0]})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>{d.region}</p>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '20px', color: 'var(--color-white)' }}>{d.title_en}</h3>
                </div>
              </div>
              <div style={{ padding: '18px 20px' }}>
                <p style={{ color: 'var(--color-gray-600)', fontSize: '14px', lineHeight: 1.6 }}>{d.excerpt_en}</p>
                <span style={{ color: 'var(--color-gold)', fontSize: '13px', fontWeight: 600, marginTop: '14px', display: 'block' }}>Discover →</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* WHY ALAN */}
      <section className="section-pad" style={{ backgroundColor: 'var(--color-black)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', textAlign: 'center' as const }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
            <span style={{ color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const }}>Why Alan</span>
            <div style={{ height: '1px', width: '32px', backgroundColor: 'var(--color-gold)' }}></div>
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 800, color: 'var(--color-white)', marginBottom: '48px', letterSpacing: '-1px' }}>Travel Like a Local</h2>
          <div className="grid-4">
            {[
              { icon: '☕', title: 'Curated', desc: 'Every experience is hand-picked like our coffee beans' },
              { icon: '🤝', title: 'Local First', desc: 'Supporting local guides, families, and communities' },
              { icon: '💎', title: 'Premium', desc: 'Quality over quantity — always' },
              { icon: '🌿', title: 'Transparent', desc: 'Honest pricing, honest impact' },
            ].map(item => (
              <div key={item.title} style={{ padding: '28px 20px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                <div style={{ fontSize: '28px', marginBottom: '16px' }}>{item.icon}</div>
                <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-gold)', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>{item.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ backgroundColor: 'var(--color-black-soft)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 20px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div className="footer-layout">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '18px', color: 'var(--color-white)' }}>ALAN</span>
                <span style={{ width: '4px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--color-gold)' }}></span>
                <span style={{ color: 'var(--color-gray-400)', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Coffee Travel</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>© 2025 Alan Coffee Travel Platform</p>
            </div>
            <div className="footer-links">
              {[{ label: 'Destinations', href: '/destinations' }, { label: 'Guides', href: '/guides' }, { label: 'Map', href: '/map' }, { label: 'About', href: '/about' }].map(item => (
                <a key={item.label} href={item.href} style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', textDecoration: 'none' }}>{item.label}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
