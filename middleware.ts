import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Compute SHA-256(password + ":alan-admin") using Web Crypto (Edge-compatible)
async function computeToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}:alan-admin`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /admin routes — let /admin/login through
  if (!pathname.startsWith('/admin') || pathname.startsWith('/admin/login')) {
    return NextResponse.next()
  }

  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    // No password configured — block access entirely
    return NextResponse.redirect(new URL('/admin/login?error=config', request.url))
  }

  const sessionCookie = request.cookies.get('admin_session')?.value
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const expectedToken = await computeToken(adminPassword)
  if (sessionCookie !== expectedToken) {
    // Invalid or tampered cookie — clear it and redirect
    const response = NextResponse.redirect(new URL('/admin/login', request.url))
    response.cookies.delete('admin_session')
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
