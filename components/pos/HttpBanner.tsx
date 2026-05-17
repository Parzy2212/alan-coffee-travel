'use client'

import { useState, useEffect } from 'react'

const ALWAYS_HTTP_KEY = 'pos_always_use_http'
const DISMISS_KEY     = 'pos_https_banner_dismissed'
const YELLOW = '#f59e0b'

function isLocalHost(host: string): boolean {
  return /^(localhost(:[0-9]+)?|127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(host)
}

export function HttpBanner() {
  const [show, setShow]         = useState(false)
  const [httpUrl, setHttpUrl]   = useState('')
  const [isLocal, setIsLocal]   = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.protocol !== 'https:') return

    const host    = window.location.host
    const local   = isLocalHost(host)
    const httpHref = window.location.href.replace('https://', 'http://')
    setHttpUrl(httpHref)
    setIsLocal(local)

    // Auto-redirect only for local hosts — for production domains (Cloudflare),
    // "always HTTP" doesn't work because Cloudflare re-forces HTTPS at the CDN edge.
    if (local && localStorage.getItem(ALWAYS_HTTP_KEY) === 'true') {
      window.location.replace(httpHref)
      return
    }

    if (localStorage.getItem(DISMISS_KEY) === 'true') return
    setShow(true)
  }, [])

  if (!show) return null

  function switchToHttp() { window.location.href = httpUrl }
  function alwaysHttp()   { localStorage.setItem(ALWAYS_HTTP_KEY, 'true'); window.location.replace(httpUrl) }
  function dismiss()      { localStorage.setItem(DISMISS_KEY, 'true'); setShow(false) }

  // Production domain (Cloudflare/Vercel): redirect won't work — give local-IP instructions instead
  if (!isLocal) {
    return (
      <div style={{
        backgroundColor: `${YELLOW}12`,
        border: `1px solid ${YELLOW}40`,
        borderLeft: `3px solid ${YELLOW}`,
        padding: '10px 16px',
        display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0,
        fontSize: 12,
      }}>
        <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>⚠️</span>
        <div style={{ flex: 1, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
          <span style={{ color: YELLOW, fontWeight: 700 }}>Print server blocked by HTTPS.</span>
          {' '}Cloudflare forces HTTPS on this domain, so the local print server cannot connect.
          {' '}Open the POS using your computer&apos;s local IP address instead:
          <br />
          <span style={{ fontFamily: 'monospace', color: YELLOW, fontSize: 11 }}>
            http://192.168.x.x/pos
          </span>
          {' '}(find your IP in Windows: ipconfig)
        </div>
        <button
          onClick={dismiss}
          style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.25)',
            fontSize: 18, cursor: 'pointer', lineHeight: 1,
            padding: '0 2px', flexShrink: 0,
          }}
        >×</button>
      </div>
    )
  }

  // Local host (localhost / 192.168.x / 10.x): redirect to HTTP works
  return (
    <div style={{
      backgroundColor: `${YELLOW}12`,
      border: `1px solid ${YELLOW}40`,
      borderLeft: `3px solid ${YELLOW}`,
      padding: '9px 16px',
      display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      fontSize: 12,
    }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
      <div style={{ flex: 1, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
        <span style={{ color: YELLOW, fontWeight: 700 }}>Print server blocked.</span>
        {' '}Running on HTTPS prevents the local print server from connecting.
        Switch to HTTP to enable printing.
      </div>
      <button
        onClick={switchToHttp}
        style={{
          padding: '5px 14px', borderRadius: 7,
          border: `1px solid ${YELLOW}55`,
          backgroundColor: `${YELLOW}18`, color: YELLOW,
          fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Switch to HTTP →
      </button>
      <button
        onClick={alwaysHttp}
        title="Auto-switch to HTTP every time you open POS"
        style={{
          padding: '5px 12px', borderRadius: 7,
          border: '1px solid rgba(255,255,255,0.1)',
          backgroundColor: 'transparent', color: 'rgba(255,255,255,0.35)',
          fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Always HTTP
      </button>
      <button
        onClick={dismiss}
        style={{
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.25)',
          fontSize: 18, cursor: 'pointer', lineHeight: 1,
          padding: '0 2px', flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}
