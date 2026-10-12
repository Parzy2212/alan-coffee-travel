import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { clearCookieHeaders, isAdminAuthConfigured, readAdminCookies, verifyAdminSession } from '@/lib/admin-session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /pos on HTTPS over a local network address → redirect to HTTP.
  // Chrome blocks mixed-content: an HTTPS page cannot call http://127.0.0.1:12345.
  //
  // This redirect only fires for LOCAL access (localhost, 192.168.x, 10.x, etc.)
  // because those are the only cases where the middleware can safely force HTTP.
  //
  // CLOUDFLARE / VERCEL (production) — NOT handled here because:
  //   - The host is "alancoffeetravel.com", which is not a local IP.
  //   - Cloudflare "Always Use HTTPS" re-redirects any HTTP → HTTPS at the CDN edge,
  //     making a server-side HTTP redirect ineffective.
  //   - Solution for Cloudflare: disable "Always Use HTTPS" for /pos via a Page Rule,
  //     OR have employees access the POS via local IP (http://192.168.x.x/pos).
  //   - The client-side HttpBanner component handles the production HTTPS warning.
  if (pathname.startsWith('/pos') && !process.env.VERCEL) {
    const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '')
    const host  = request.headers.get('host') ?? ''
    const isLocal = /^(localhost(:[0-9]+)?|127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(host)
    if (proto === 'https' && isLocal) {
      const url = request.nextUrl.clone()
      url.protocol = 'http:'
      return NextResponse.redirect(url, { status: 301 })
    }
  }

  // Only protect /admin routes — let /admin/login through
  if (!pathname.startsWith('/admin') || pathname.startsWith('/admin/login')) {
    return NextResponse.next()
  }

  if (!isAdminAuthConfigured()) {
    return NextResponse.redirect(new URL('/admin/login?error=config', request.url))
  }

  const cookieHeader = request.headers.get('cookie')
  if (readAdminCookies(cookieHeader).length === 0) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  if (!(await verifyAdminSession(cookieHeader))) {
    // Invalid, expired or tampered cookie — clear it and redirect
    const response = NextResponse.redirect(new URL('/admin/login', request.url))
    for (const c of clearCookieHeaders()) response.headers.append('Set-Cookie', c)
    return response
  }

  return NextResponse.next()
}

export const config = {
  // /admin — cookie-based admin auth (handled above)
  // /cafe /pos /queue /staff /onboarding — Supabase Auth (client-side guard in AuthGuard)
  // /dashboard — redirect to /cafe (client-side)
  matcher: ['/admin/:path*', '/pos', '/pos/:path*'],
}
