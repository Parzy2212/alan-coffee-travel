import { supabase } from '@/lib/supabase'
import type { Metadata } from 'next'

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
    <main style={{backgroundColor: 'var(--background)', minHeight: '100vh'}}>
      <nav style={{backgroundColor: 'var(--color-white)', borderBottom: '1px solid var(--color-cream-border)', position: 'sticky', top: 0, zIndex: 50}}>
        <div style={{maxWidth: '1280px', margin: '0 auto', padding: '0 32px', height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            <span style={{fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '20px', color: 'var(--color-black)'}}>ALAN</span>
            <span style={{width: '4px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--color-gold)'}}></span>
            <span style={{fontFamily: 'var(--font-heading)', fontWeight: 400, fontSize: '13px', color: 'var(--color-gray-600)', letterSpacing: '2px', textTransform: 'uppercase' as const}}>Coffee Travel</span>
          </div>
          <div style={{display: 'flex', gap: '36px'}}>
            {['Destinations', 'Guides', 'Rentals', 'Auction'].map(item => (
              <a key={item} href="#" style={{color: 'var(--color-gray-600)', fontSize: '13px', textDecoration: 'none', fontWeight: 500}}>{item}</a>
            ))}
          </div>
          <button style={{backgroundColor: 'var(--color-black)', color: 'var(--color-gold)', padding: '10px 24px', borderRadius: '4px', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' as const}}>Explore</button>
        </div>
      </nav>

      <section style={{backgroundColor: 'var(--color-black)', padding: '140px 32px', position: 'relative', overflow: 'hidden'}}>
        <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(ellipse at 70% 50%, rgba(201,168,76,0.08) 0%, transparent 60%)'}}></div>
        <div style={{maxWidth: '900px', margin: '0 auto', position: 'relative'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px'}}>
            <div style={{height: '1px', width: '40px', backgroundColor: 'var(--color-gold)'}}></div>
            <span style={{color: 'var(--color-gold)', fontSize: '12px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const}}>Curated Travel Experience</span>
          </div>
          <h1 style={{fontFamily: 'var(--font-heading)', fontSize: '64px', fontWeight: 800, color: 'var(--color-white)', lineHeight: 1.1, letterSpacing: '-2px', marginBottom: '24px'}}>
            Travel Deeper.<br />
            <span style={{color: 'var(--color-gold)'}}>Live Authentically.</span>
          </h1>
          <p style={{color: 'rgba(255,255,255,0.55)', fontSize: '18px', lineHeight: 1.7, maxWidth: '560px', marginBottom: '48px'}}>
            Like a perfectly brewed cup — we curate only the most authentic local experiences in Laos.
          </p>
          <div style={{display: 'flex', gap: '16px'}}>
            <button style={{backgroundColor: 'var(--color-gold)', color: 'var(--color-black)', padding: '16px 36px', borderRadius: '4px', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' as const}}>Explore Now</button>
            <button style={{backgroundColor: 'transparent', color: 'var(--color-white)', padding: '16px 36px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 500, fontSize: '14px', cursor: 'pointer'}}>Meet Our Guides →</button>
          </div>
        </div>
      </section>

      <section style={{padding: '100px 32px', maxWidth: '1280px', margin: '0 auto'}}>
        <div style={{display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '56px'}}>
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px'}}>
              <div style={{height: '1px', width: '32px', backgroundColor: 'var(--color-gold)'}}></div>
              <span style={{color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const}}>Destinations</span>
            </div>
            <h2 style={{fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 800, color: 'var(--color-black)', letterSpacing: '-1px'}}>Curated Places</h2>
          </div>
          <a href="#" style={{color: 'var(--color-gray-600)', fontSize: '13px', textDecoration: 'none', borderBottom: '1px solid var(--color-cream-border)', paddingBottom: '2px'}}>View all →</a>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px'}}>
          {destinations?.map((d) => (
            <a key={d.id} href={`/destinations/${d.slug}`} style={{backgroundColor: 'var(--color-white)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-cream-border)', cursor: 'pointer', textDecoration: 'none', display: 'block'}}>
              <div style={{height: '220px', backgroundColor: 'var(--color-black-soft)', display: 'flex', alignItems: 'flex-end', padding: '20px'}}>
                <div>
                  <p style={{color: 'rgba(255,255,255,0.5)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '4px'}}>{d.region}</p>
                  <h3 style={{fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '22px', color: 'var(--color-white)'}}>{d.title_en}</h3>
                </div>
              </div>
              <div style={{padding: '20px 24px'}}>
                <p style={{color: 'var(--color-gray-600)', fontSize: '14px', lineHeight: 1.6}}>{d.excerpt_en}</p>
                <span style={{color: 'var(--color-gold)', fontSize: '13px', fontWeight: 600, marginTop: '16px', display: 'block'}}>Discover →</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section style={{backgroundColor: 'var(--color-black)', padding: '100px 32px'}}>
        <div style={{maxWidth: '1280px', margin: '0 auto', textAlign: 'center' as const}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px'}}>
            <div style={{height: '1px', width: '32px', backgroundColor: 'var(--color-gold)'}}></div>
            <span style={{color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const}}>Why Alan</span>
            <div style={{height: '1px', width: '32px', backgroundColor: 'var(--color-gold)'}}></div>
          </div>
          <h2 style={{fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 800, color: 'var(--color-white)', marginBottom: '64px', letterSpacing: '-1px'}}>Travel Like a Local</h2>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '32px'}}>
            {[
              {icon: '☕', title: 'Curated', desc: 'Every experience is hand-picked like our coffee beans'},
              {icon: '🤝', title: 'Local First', desc: 'Supporting local guides, families, and communities'},
              {icon: '💎', title: 'Premium', desc: 'Quality over quantity — always'},
              {icon: '🌿', title: 'Transparent', desc: 'Honest pricing, honest impact'},
            ].map(item => (
              <div key={item.title} style={{padding: '32px 24px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px'}}>
                <div style={{fontSize: '28px', marginBottom: '16px'}}>{item.icon}</div>
                <h3 style={{fontFamily: 'var(--font-heading)', color: 'var(--color-gold)', fontWeight: 700, fontSize: '16px', marginBottom: '8px'}}>{item.title}</h3>
                <p style={{color: 'rgba(255,255,255,0.45)', fontSize: '13px', lineHeight: 1.6}}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{backgroundColor: 'var(--color-black-soft)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '48px 32px'}}>
        <div style={{maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
              <span style={{fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '18px', color: 'var(--color-white)'}}>ALAN</span>
              <span style={{width: '4px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--color-gold)'}}></span>
              <span style={{color: 'var(--color-gray-400)', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase' as const}}>Coffee Travel</span>
            </div>
            <p style={{color: 'rgba(255,255,255,0.3)', fontSize: '12px'}}>© 2025 Alan Coffee Travel Platform</p>
          </div>
          <div style={{display: 'flex', gap: '32px'}}>
            {['Destinations', 'Guides', 'Rentals', 'Auction', 'Donate'].map(item => (
              <a key={item} href="#" style={{color: 'rgba(255,255,255,0.35)', fontSize: '12px', textDecoration: 'none'}}>{item}</a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  )
}