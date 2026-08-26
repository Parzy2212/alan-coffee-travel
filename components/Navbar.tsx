'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useLang, type Lang } from '@/contexts/LanguageContext'
import { tr } from '@/lib/translations'

const LANG_OPTIONS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'lo', label: 'ລາວ' },
  { code: 'th', label: 'ไทย' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { lang, setLang } = useLang()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { href: '/',             labelKey: 'nav_home'         },
    { href: '/destinations', labelKey: 'nav_destinations' },
    { href: '/guides',       labelKey: 'nav_guides'       },
    { href: '/experiences',  labelKey: 'nav_experiences'  },
    { href: '/map',          labelKey: 'nav_map'          },
    { href: '/about',        labelKey: 'nav_about'        },
    { href: '/contact',      labelKey: 'nav_contact'      },
  ] as const

  const isActive = (href: string) => pathname === href

  return (
    <>
      <nav className={scrolled ? 'nav-scrolled' : ''} style={{ backgroundColor: 'var(--color-white)', borderBottom: '1px solid var(--color-cream-border)', position: 'sticky', top: 0, zIndex: 50, transition: 'box-shadow 0.2s' }}>
        <div className="nav-inner">

          {/* Logo */}
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '20px', color: 'var(--color-black)' }}>ALAN</span>
            <span style={{ width: '4px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--color-gold)', flexShrink: 0 }} />
            <span className="nav-logo-tagline" style={{ fontSize: '13px', color: 'var(--color-gray-600)', letterSpacing: '2px', textTransform: 'uppercase' as const }}>Coffee & Travel</span>
          </a>

          {/* Desktop links */}
          <div className="nav-links-desktop">
            {links.map(link => (
              <a key={link.href} href={link.href} className="nav-link" style={{
                color: isActive(link.href) ? 'var(--color-black)' : 'var(--color-gray-600)',
                fontSize: '13px',
                textDecoration: 'none',
                fontWeight: isActive(link.href) ? 700 : 500,
                borderBottom: isActive(link.href) ? '2px solid var(--color-gold)' : '2px solid transparent',
                paddingBottom: '2px',
                whiteSpace: 'nowrap' as const,
              }}>
                {tr(link.labelKey, lang)}
              </a>
            ))}
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

            {/* Language switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginRight: '4px' }}>
              {LANG_OPTIONS.map((opt, i) => (
                <button
                  key={opt.code}
                  onClick={() => setLang(opt.code)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    minWidth: '44px',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: lang === opt.code ? 700 : 400,
                    color: lang === opt.code ? 'var(--color-gold)' : 'var(--color-gray-400)',
                    borderRight: i < LANG_OPTIONS.length - 1 ? '1px solid var(--color-cream-border)' : 'none',
                    lineHeight: 1,
                    letterSpacing: '0.5px',
                    transition: 'color 0.15s',
                    fontFamily: 'var(--font-lao)',
                  }}
                  aria-label={`Switch to ${opt.label}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <a href="/pos-product" className="nav-cafeos-btn" style={{
              border: '1px solid rgba(201,168,76,0.35)',
              color: 'var(--color-gold)',
              padding: '7px 13px',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '11px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase' as const,
              whiteSpace: 'nowrap' as const,
            }}>
              CafeOS
            </a>

            <a href="/contact" className="nav-contact-btn" style={{
              backgroundColor: 'var(--color-black)', color: 'var(--color-gold)',
              padding: '10px 24px', borderRadius: '4px', textDecoration: 'none',
              fontWeight: 600, fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase' as const,
              whiteSpace: 'nowrap' as const,
            }}>
              {tr('nav_contact', lang)}
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
            {tr(link.labelKey, lang)}
          </a>
        ))}

        {/* Mobile language switcher */}
        <div style={{ display: 'flex', gap: '8px', padding: '16px 0 8px' }}>
          {LANG_OPTIONS.map(opt => (
            <button
              key={opt.code}
              onClick={() => { setLang(opt.code); setMenuOpen(false) }}
              style={{
                background: lang === opt.code ? 'var(--color-gold)' : 'var(--color-cream-dark)',
                border: 'none',
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 16px',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 700,
                color: lang === opt.code ? '#0a0a0a' : 'var(--color-gray-600)',
                fontFamily: 'var(--font-lao)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ paddingTop: '8px', display: 'flex', gap: '10px', flexWrap: 'wrap' as const }}>
          <a
            href="/contact"
            onClick={() => setMenuOpen(false)}
            style={{ display: 'inline-block', backgroundColor: 'var(--color-black)', color: 'var(--color-gold)', padding: '12px 28px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600, fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' as const }}
          >
            {tr('nav_contact', lang)}
          </a>
          <a
            href="/pos-product"
            onClick={() => setMenuOpen(false)}
            style={{ display: 'inline-block', border: '1px solid rgba(201,168,76,0.4)', color: 'var(--color-gold)', padding: '12px 20px', borderRadius: '4px', textDecoration: 'none', fontWeight: 700, fontSize: '12px', letterSpacing: '1.5px', textTransform: 'uppercase' as const }}
          >
            CafeOS
          </a>
        </div>
      </div>
    </>
  )
}
