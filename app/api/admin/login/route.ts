import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Same derivation as middleware.ts — SHA-256(password + ":alan-admin")
function computeToken(password: string): string {
  return crypto
    .createHash('sha256')
    .update(`${password}:alan-admin`)
    .digest('hex')
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

    const sessionToken = computeToken(adminPassword)

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
