'use client'
import { tr } from '@/lib/translations'
import type { Lang } from '@/contexts/LanguageContext'

const CREAM = '#f6f2e8'
const GOLD = '#c9a84c'
const BG_VOID = '#0a0a0a'

const linkStyle: React.CSSProperties = {
  fontSize: 14, color: `rgba(246,242,232,0.62)`, textDecoration: 'none', transition: 'color 0.15s',
}
const overlineStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)', fontSize: 11, letterSpacing: '0.14em',
  textTransform: 'uppercase' as const, color: GOLD,
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={linkStyle}
      onMouseEnter={e => { e.currentTarget.style.color = GOLD }}
      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(246,242,232,0.62)' }}
    >
      {children}
    </a>
  )
}

const SOCIAL_ICON_PATHS: Record<string, string> = {
  // Minimal single-path glyphs (not text) so the visible content is a graphic,
  // not a mismatched abbreviation — avoids WCAG 2.5.3 label-in-name conflicts.
  Facebook: 'M13.5 3H11c-1.933 0-3.5 1.567-3.5 3.5V9H5v3h2.5v6h3v-6h2.5l.5-3h-3V6.5c0-.5.25-.75.75-.75h1.75V3z',
  Instagram: 'M8 3h5c2.76 0 5 2.24 5 5v5c0 2.76-2.24 5-5 5H8c-2.76 0-5-2.24-5-5V8c0-2.76 2.24-5 5-5zm0 1.8A3.2 3.2 0 0 0 4.8 8v5A3.2 3.2 0 0 0 8 16.2h5A3.2 3.2 0 0 0 16.2 13V8A3.2 3.2 0 0 0 13 4.8H8zm2.5 2.2a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 1.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm4.15-2.65a.85.85 0 1 1 0 1.7.85.85 0 0 1 0-1.7z',
  WhatsApp: 'M10 3a7 7 0 0 0-5.95 10.66L3 17l3.44-1.02A7 7 0 1 0 10 3zm0 1.5a5.5 5.5 0 0 1 4.7 8.36l-.16.27.45 1.62-1.66-.49-.26.15A5.5 5.5 0 1 1 10 4.5zm-2.1 2.4c-.15 0-.4.06-.6.3-.2.24-.78.75-.78 1.84 0 1.08.8 2.13.9 2.28.12.15 1.55 2.45 3.8 3.34 1.87.75 2.25.6 2.66.56.4-.04 1.3-.53 1.48-1.04.18-.51.18-.95.13-1.04-.05-.1-.2-.15-.4-.25-.2-.1-1.3-.64-1.5-.72-.2-.07-.35-.1-.5.1-.14.2-.57.72-.7.87-.13.15-.26.16-.47.06-.2-.1-.87-.32-1.66-1.02-.6-.55-1.02-1.22-1.14-1.42-.12-.2-.01-.32.09-.42.1-.1.2-.25.3-.37.1-.13.13-.22.2-.36.06-.15.03-.28-.02-.38-.05-.1-.5-1.22-.7-1.66-.18-.42-.36-.37-.5-.38h-.42z',
}

function SocialIcon({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      aria-label={label}
      style={{
        width: 36, height: 36, borderRadius: 999, border: '1px solid rgba(246,242,232,0.16)',
        display: 'grid', placeItems: 'center', color: 'rgba(246,242,232,0.62)',
        textDecoration: 'none', transition: 'border-color 0.15s, color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(246,242,232,0.16)'; e.currentTarget.style.color = 'rgba(246,242,232,0.62)' }}
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d={SOCIAL_ICON_PATHS[label]} />
      </svg>
    </a>
  )
}

/**
 * Single shared footer for the whole travel site — replaces the 8 hand-rolled
 * copies that used to live in each page. Background is locked to #0a0a0a
 * (BG_VOID) per Claude Design's 2d spec, no more #111/#1a1a1a in footers.
 * All clickable text stays at rgba(246,242,232,0.62) minimum (never .40 —
 * that step is reserved for non-clickable muted copy) so link contrast holds
 * up on its own without relying on hover.
 *
 * `paddingBottom` defaults to 40 — pass 116 on pages that also render a
 * fixed mobile sticky CTA bar (guide profile, experience detail) so the bar
 * doesn't cover the footer's bottom row on small screens.
 */
export default function Footer({ lang, paddingBottom = 40 }: { lang: Lang; paddingBottom?: number }) {
  return (
    <footer style={{ backgroundColor: BG_VOID, padding: `52px 20px ${paddingBottom}px` }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="footer-unified-grid">
          {/* Brand column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 34, height: 34, borderRadius: 999, border: `2px solid ${GOLD}`, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, color: GOLD, fontFamily: 'var(--font-heading)' }}>A</div>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.02em', color: CREAM, fontFamily: 'var(--font-heading)' }}>ALAN</div>
            </div>
            <div style={{ fontSize: 14, color: 'rgba(246,242,232,0.62)', lineHeight: 1.65, maxWidth: 300 }}>
              {tr('footer_tagline', lang)}
            </div>
            <div style={{ display: 'flex', gap: 9, paddingTop: 4 }}>
              <SocialIcon href="#" label="Facebook" />
              <SocialIcon href="#" label="Instagram" />
              <SocialIcon href="https://wa.me/8562094366635" label="WhatsApp" />
            </div>
          </div>

          {/* Explore column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={overlineStyle}>{tr('footer_nav', lang)}</div>
            <FooterLink href="/destinations">{tr('nav_destinations', lang)}</FooterLink>
            <FooterLink href="/guides">{tr('nav_guides', lang)}</FooterLink>
            <FooterLink href="/experiences">{tr('nav_experiences', lang)}</FooterLink>
            <FooterLink href="/map">{tr('nav_map', lang)}</FooterLink>
          </div>

          {/* About column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={overlineStyle}>{tr('footer_company', lang)}</div>
            <FooterLink href="/about">{tr('nav_about', lang)}</FooterLink>
            <FooterLink href="/contact">{tr('nav_contact', lang)}</FooterLink>
            <FooterLink href="/become-a-guide">{tr('bag_apply', lang)}</FooterLink>
          </div>

          {/* Contact column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={overlineStyle}>{tr('nav_contact', lang)}</div>
            <div style={{ fontSize: 14, color: 'rgba(246,242,232,0.62)', lineHeight: 1.6 }}>{tr('footer_location', lang)}</div>
            <a href="tel:+8562094366635" style={{ ...linkStyle, fontFamily: 'var(--font-mono, monospace)' }}>📞 +856 20 94 366 635</a>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(246,242,232,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '20px 0 26px', flexWrap: 'wrap' as const }}>
          <div style={{ fontSize: 13, color: 'rgba(246,242,232,0.62)' }}>{tr('footer_copy', lang)}</div>
        </div>
      </div>
    </footer>
  )
}
