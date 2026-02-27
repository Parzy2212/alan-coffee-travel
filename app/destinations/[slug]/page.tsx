import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'

export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: destination } = await supabase
    .from('destinations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!destination) notFound()

  return (
    <main style={{minHeight: '100vh', backgroundColor: 'var(--background)'}}>

      <nav style={{backgroundColor: 'var(--color-white)', borderBottom: '1px solid var(--color-cream-border)', position: 'sticky', top: 0, zIndex: 50}}>
        <div style={{maxWidth: '1280px', margin: '0 auto', padding: '0 32px', height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <a href="/" style={{display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none'}}>
            <span style={{fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '20px', color: 'var(--color-black)'}}>ALAN</span>
            <span style={{width: '4px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--color-gold)'}}></span>
            <span style={{fontFamily: 'var(--font-heading)', fontWeight: 400, fontSize: '13px', color: 'var(--color-gray-600)', letterSpacing: '2px', textTransform: 'uppercase' as const}}>Coffee Travel</span>
          </a>
          <a href="/" style={{color: 'var(--color-gray-600)', fontSize: '13px', textDecoration: 'none'}}>← Back</a>
        </div>
      </nav>

      <section style={{backgroundColor: 'var(--color-black)', padding: '100px 32px 80px'}}>
        <div style={{maxWidth: '900px', margin: '0 auto'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px'}}>
            <div style={{height: '1px', width: '32px', backgroundColor: 'var(--color-gold)'}}></div>
            <span style={{color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const}}>{destination.region}</span>
          </div>
          <h1 style={{fontFamily: 'var(--font-heading)', fontSize: '56px', fontWeight: 800, color: 'var(--color-white)', letterSpacing: '-2px', marginBottom: '16px'}}>
            {destination.title_en}
          </h1>
          <p style={{color: 'rgba(255,255,255,0.6)', fontSize: '20px', lineHeight: 1.6, maxWidth: '640px'}}>
            {destination.excerpt_en}
          </p>
        </div>
      </section>

      <section style={{backgroundColor: 'var(--color-black-muted)', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{textAlign: 'center' as const}}>
          <div style={{fontSize: '48px', marginBottom: '12px'}}>🏔️</div>
          <p style={{color: 'rgba(255,255,255,0.3)', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' as const}}>Photo coming soon</p>
        </div>
      </section>

      <section style={{padding: '80px 32px', maxWidth: '900px', margin: '0 auto'}}>
        <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '64px'}}>
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px'}}>
              <div style={{height: '1px', width: '32px', backgroundColor: 'var(--color-gold)'}}></div>
              <span style={{color: 'var(--color-gold)', fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const}}>About</span>
            </div>
            <p style={{color: 'var(--color-gray-600)', fontSize: '16px', lineHeight: 1.8}}>
              {destination.description_en || destination.excerpt_en || 'Full description coming soon.'}
            </p>
          </div>

          <div>
            <div style={{backgroundColor: 'var(--color-black)', borderRadius: '12px', padding: '28px', border: '1px solid rgba(255,255,255,0.08)'}}>
              <h3 style={{fontFamily: 'var(--font-heading)', color: 'var(--color-gold)', fontSize: '14px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '20px'}}>Details</h3>
              <div style={{display: 'flex', flexDirection: 'column' as const, gap: '16px'}}>
                <div>
                  <p style={{color: 'rgba(255,255,255,0.3)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '4px'}}>Region</p>
                  <p style={{color: 'var(--color-white)', fontSize: '14px', fontWeight: 600}}>{destination.region || '—'}</p>
                </div>
                <div>
                  <p style={{color: 'rgba(255,255,255,0.3)', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '4px'}}>Status</p>
                  <span style={{backgroundColor: '#1f3f1f', color: '#4caf50', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600}}>
                    {destination.status}
                  </span>
                </div>
              </div>
            </div>
            <button style={{width: '100%', backgroundColor: 'var(--color-gold)', color: 'var(--color-black)', padding: '16px', borderRadius: '4px', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' as const, marginTop: '16px'}}>
              Book Experience
            </button>
          </div>
        </div>
      </section>

      <footer style={{backgroundColor: 'var(--color-black)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 32px', textAlign: 'center' as const}}>
        <p style={{color: 'rgba(255,255,255,0.3)', fontSize: '12px'}}>© 2025 Alan Coffee Travel Platform</p>
      </footer>

    </main>
  )
}