'use client'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export default function Navbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    { href: '/', label: 'Home' },
    { href: '/destinations', label: 'Destinations' },
    { href: '/guides', label: 'Guides' },
    { href: '/map', label: 'Map' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <>
      <nav style={{ backgroundColor: 'var(--color-white)', borderBottom: '1px solid var(--color-cream-border)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="nav-inner">

          {/* Logo */}
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '20px', color: 'var(--color-black)' }}>ALAN</span>
            <span style={{ width: '4px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--color-gold)', flexShrink: 0 }}></span>
            <span style={{ fontSize: '13px', color: 'var(--color-gray-600)', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Coffee & Travel</span>
          </a>

          {/* Desktop links */}
          <div className="nav-links-desktop">
            {links.map(link => (
              <a key={link.href} href={link.href} style={{
                color: isActive(link.href) ? 'var(--color-black)' : 'var(--color-gray-600)',
                fontSize: '13px',
                textDecoration: 'none',
                fontWeight: isActive(link.href) ? 700 : 500,
                borderBottom: isActive(link.href) ? '2px solid var(--color-gold)' : '2px solid transparent',
                paddingBottom: '2px',
                whiteSpace: 'nowrap' as const,
              }}>
                {link.label}
              </a>
            ))}
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a href="/contact" className="nav-contact-btn" style={{
              backgroundColor: 'var(--color-black)', color: 'var(--color-gold)',
              padding: '10px 24px', borderRadius: '4px', textDecoration: 'none',
              fontWeight: 600, fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' as const,
              whiteSpace: 'nowrap' as const,
            }}>
              Contact
            </a>

            {/* Hamburger button */}
            <button
              className="nav-hamburger"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
            >
              <span style={{ display: 'block', width: '22px', height: '2px', backgroundColor: 'var(--color-black)', transition: 'all 0.2s', transform: menuOpen ? 'rotate(45deg) translateY(7px)' : 'none' }} />
              <span style={{ display: 'block', width: '22px', height: '2px', backgroundColor: 'var(--color-black)', transition: 'all 0.2s', opacity: menuOpen ? 0 : 1 }} />
              <span style={{ display: 'block', width: '22px', height: '2px', backgroundColor: 'var(--color-black)', transition: 'all 0.2s', transform: menuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
            </button>
          </div>

        </div>
      </nav>

      {/* Mobile dropdown menu */}
      <div className={`nav-mobile-menu${menuOpen ? ' open' : ''}`}>
        {links.map(link => (
          <a
            key={link.href}
            href={link.href}
            onClick={() => setMenuOpen(false)}
            style={{
              color: isActive(link.href) ? 'var(--color-black)' : 'var(--color-gray-600)',
              fontSize: '16px',
              textDecoration: 'none',
              fontWeight: isActive(link.href) ? 700 : 500,
              padding: '14px 0',
              borderBottom: '1px solid var(--color-cream-border)',
              display: 'block',
            }}
          >
            {link.label}
          </a>
        ))}
        <div style={{ paddingTop: '16px' }}>
          <a
            href="/contact"
            onClick={() => setMenuOpen(false)}
            style={{ display: 'inline-block', backgroundColor: 'var(--color-black)', color: 'var(--color-gold)', padding: '12px 28px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600, fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' as const }}
          >
            Contact
          </a>
        </div>
      </div>
    </>
  )
}
