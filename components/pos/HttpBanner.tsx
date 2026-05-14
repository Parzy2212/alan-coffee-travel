'use client'

import { useState, useEffect } from 'react'

const ALWAYS_HTTP_KEY = 'pos_always_use_http'
const DISMISS_KEY     = 'pos_https_banner_dismissed'
const YELLOW = '#f59e0b'

export function HttpBanner() {
  const [show, setShow] = useState(false)
  const [httpUrl, setHttpUrl] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.protocol !== 'https:') return

    const httpHref = window.location.href.replace('https://', 'http://')
    setHttpUrl(httpHref)

    // Auto-redirect if user previously selected "always use HTTP"
    if (localStorage.getItem(ALWAYS_HTTP_KEY) === 'true') {
      window.location.replace(httpHref)
      return
    }

    if (localStorage.getItem(DISMISS_KEY) === 'true') return
    setShow(true)
  }, [])

  if (!show) return null

  function switchToHttp() {
    window.location.href = httpUrl
  }

  function alwaysHttp() {
    localStorage.setItem(ALWAYS_HTTP_KEY, 'true')
    window.location.replace(httpUrl)
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true')
    setShow(false)
  }

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
