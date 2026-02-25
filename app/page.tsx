export default function Home() {
  return (
    <main className="min-h-screen" style={{backgroundColor: 'var(--background)'}}>

      {/* NAVBAR */}
      <nav style={{backgroundColor: 'var(--color-neutral-0)', borderBottom: '1px solid var(--color-neutral-200)'}}>
        <div style={{maxWidth: '1280px', margin: '0 auto', padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <span style={{fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '20px', color: 'var(--color-accent-500)'}}>
            Alan Coffee Travel
          </span>
          <div style={{display: 'flex', gap: '32px'}}>
            <a href="#" style={{color: 'var(--color-neutral-700)', fontSize: '14px', textDecoration: 'none'}}>Destinations</a>
            <a href="#" style={{color: 'var(--color-neutral-700)', fontSize: '14px', textDecoration: 'none'}}>Guides</a>
            <a href="#" style={{color: 'var(--color-neutral-700)', fontSize: '14px', textDecoration: 'none'}}>Rentals</a>
            <a href="#" style={{color: 'var(--color-neutral-700)', fontSize: '14px', textDecoration: 'none'}}>Auction</a>
          </div>
          <button style={{backgroundColor: 'var(--color-accent-500)', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer'}}>
            Explore Now
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{background: 'linear-gradient(135deg, #1a381f 0%, #3d7a47 50%, #8c7f6e 100%)', padding: '120px 24px', textAlign: 'center'}}>
        <div style={{maxWidth: '800px', margin: '0 auto'}}>
          <span style={{backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', padding: '6px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 500}}>
            🌿 Discover Authentic Laos
          </span>
          <h1 style={{fontFamily: 'var(--font-heading)', fontSize: '56px', fontWeight: 700, color: 'white', marginTop: '24px', lineHeight: 1.2}}>
            Travel Deeper.<br />Live Authentically.
          </h1>
          <p style={{color: 'rgba(255,255,255,0.8)', fontSize: '18px', marginTop: '16px', lineHeight: 1.6}}>
            Connect with local guides, explore hidden destinations, and experience Laos the way it was meant to be discovered.
          </p>
          <div style={{display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '36px'}}>
            <button style={{backgroundColor: 'white', color: 'var(--color-accent-600)', padding: '14px 32px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '16px', cursor: 'pointer'}}>
              Explore Now
            </button>
            <button style={{backgroundColor: 'transparent', color: 'white', padding: '14px 32px', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.5)', fontWeight: 600, fontSize: '16px', cursor: 'pointer'}}>
              Meet Our Guides
            </button>
          </div>
        </div>
      </section>

      {/* DESTINATIONS */}
      <section style={{padding: '80px 24px', maxWidth: '1280px', margin: '0 auto'}}>
        <h2 style={{fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 700, color: 'var(--color-neutral-900)', marginBottom: '8px'}}>
          Popular Destinations
        </h2>
        <p style={{color: 'var(--color-neutral-500)', marginBottom: '40px'}}>Explore the most beloved places in Laos</p>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px'}}>
          {[
            {name: 'Luang Prabang', desc: 'Ancient temples and golden sunsets', color: '#2f6238'},
            {name: 'Vang Vieng', desc: 'Karst mountains and turquoise rivers', color: '#3d7a47'},
            {name: 'Vientiane', desc: 'Charming capital with French heritage', color: '#8c7f6e'},
          ].map((d) => (
            <div key={d.name} style={{borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(28,27,24,0.08)', cursor: 'pointer'}}>
              <div style={{height: '200px', backgroundColor: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <span style={{fontSize: '48px'}}>🏔️</span>
              </div>
              <div style={{padding: '20px', backgroundColor: 'white'}}>
                <h3 style={{fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '18px', color: 'var(--color-neutral-900)'}}>{d.name}</h3>
                <p style={{color: 'var(--color-neutral-500)', fontSize: '14px', marginTop: '4px'}}>{d.desc}</p>
                <span style={{color: 'var(--color-accent-500)', fontSize: '14px', fontWeight: 600, marginTop: '12px', display: 'block'}}>Explore →</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{backgroundColor: 'var(--color-neutral-900)', color: 'var(--color-neutral-300)', padding: '40px 24px', textAlign: 'center'}}>
        <p style={{fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '18px', color: 'white', marginBottom: '8px'}}>Alan Coffee Travel</p>
        <p style={{fontSize: '14px'}}>© 2025 Alan Coffee Travel Platform. All rights reserved.</p>
      </footer>

    </main>
  );
}