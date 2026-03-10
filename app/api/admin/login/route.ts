import { NextResponse } from 'next/server'

export const runtime = 'edge'

// Same derivation as middleware.ts — SHA-256(password + ":alan-admin")
async function computeToken(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(`${password}:alan-admin`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json()

    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) {
      return NextResponse.json(
        { error: 'Admin password not configured on server.' },
        { status: 500 }
      )
    }

    if (!password || password !== adminPassword) {
      // Small delay to slow brute-force attempts
      await new Promise(r => setTimeout(r, 400))
      return NextResponse.json(
        { error: 'Incorrect password.' },
        { status: 401 }
      )
    }

    const sessionToken = await computeToken(adminPassword)

    const response = NextResponse.json({ success: true })
    response.cookies.set('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours in seconds
      path: '/',
    })
    return response
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
