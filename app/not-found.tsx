import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: '404 — Page Not Found | Alan Coffee & Travel',
}

export default function NotFound() {
  return (
    <main style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(80px, 12vw, 140px) clamp(24px, 4vw, 56px)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px', height: '400px',
          background: 'radial-gradient(ellipse, rgba(201,168,76,0.07) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* 404 number */}
        <div style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(96px, 18vw, 200px)',
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: '-6px',
          color: 'rgba(201,168,76,0.12)',
          userSelect: 'none',
          marginBottom: '8px',
        }}>
          404
        </div>

        {/* Gold divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px',
          marginBottom: '36px',
        }}>
          <div style={{ height: '1px', width: '48px', backgroundColor: '#c9a84c' }} />
          <span style={{
            color: '#c9a84c', fontSize: '10px', fontWeight: 700,
            letterSpacing: '3.5px', textTransform: 'uppercase',
          }}>
            Page Not Found
          </span>
          <div style={{ height: '1px', width: '48px', backgroundColor: '#c9a84c' }} />
        </div>

        {/* English */}
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(24px, 4vw, 42px)',
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-1px',
          lineHeight: 1.15,
          marginBottom: '16px',
        }}>
          This road doesn&apos;t go anywhere.
        </h1>

        {/* Lao + Thai */}
        <p style={{
          color: 'rgba(255,255,255,0.28)',
          fontSize: 'clamp(14px, 1.8vw, 17px)',
          lineHeight: 1.8,
          marginBottom: '8px',
        }}>
          ໜ້ານີ້ບໍ່ມີຢູ່ — ກະລຸນາກັບໄປໜ້າຫຼັກ
        </p>
        <p style={{
          color: 'rgba(255,255,255,0.18)',
          fontSize: 'clamp(13px, 1.6vw, 16px)',
          lineHeight: 1.8,
          marginBottom: '52px',
        }}>
          ไม่พบหน้านี้ — กรุณากลับไปหน้าหลัก
        </p>

        {/* CTA */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'center' }}>
          <a href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            backgroundColor: '#c9a84c', color: '#0a0a0a',
            padding: '16px 40px', borderRadius: '4px',
            fontWeight: 700, fontSize: '13px', letterSpacing: '1.5px',
            textTransform: 'uppercase', textDecoration: 'none',
          }}>
            ← Back to Home
          </a>
          <a href="/destinations" style={{
            display: 'inline-flex', alignItems: 'center',
            backgroundColor: 'transparent', color: 'rgba(255,255,255,0.55)',
            padding: '16px 40px', borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.1)',
            fontWeight: 500, fontSize: '13px', textDecoration: 'none',
          }}>
            Explore Destinations
          </a>
        </div>

        {/* Footer note */}
        <p style={{
          color: 'rgba(255,255,255,0.1)',
          fontSize: '12px',
          letterSpacing: '0.5px',
          marginTop: '64px',
        }}>
          Alan Coffee & Travel · Attapeu · Southern Laos
        </p>
      </div>
    </main>
  )
}
