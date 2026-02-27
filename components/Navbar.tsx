'use client'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()

  const links = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ]

  return (
    <nav style={{backgroundColor: 'var(--color-white)', borderBottom: '1px solid var(--color-cream-border)', position: 'sticky', top: 0, zIndex: 50}}>
      <div style={{maxWidth: '1280px', margin: '0 auto', padding: '0 32px', height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>

        <a href="/" style={{display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none'}}>
          <span style={{fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '20px', color: 'var(--color-black)'}}>ALAN</span>
          <span style={{width: '4px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--color-gold)'}}></span>
          <span style={{fontSize: '13px', color: 'var(--color-gray-600)', letterSpacing: '2px', textTransform: 'uppercase' as const}}>Coffee & Travel</span>
        </a>

        <div style={{display: 'flex', gap: '36px', alignItems: 'center'}}>
          {links.map(link => (
            <a key={link.href} href={link.href} style={{
              color: pathname === link.href ? 'var(--color-black)' : 'var(--color-gray-600)',
              fontSize: '13px',
              textDecoration: 'none',
              fontWeight: pathname === link.href ? 700 : 500,
              borderBottom: pathname === link.href ? '2px solid var(--color-gold)' : '2px solid transparent',
              paddingBottom: '2px',
            }}>
              {link.label}
            </a>
          ))}
        </div>

        <a href="/contact" style={{backgroundColor: 'var(--color-black)', color: 'var(--color-gold)', padding: '10px 24px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600, fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' as const}}>
          Contact
        </a>

      </div>
    </nav>
  )
}