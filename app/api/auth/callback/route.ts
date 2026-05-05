import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// OAuth callback handler (used for Google login, magic links, etc.)
// The auth client handles the token exchange client-side via detectSessionInUrl.
// This route just ensures the redirect path lands on the app.
export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const next = searchParams.get('next') ?? '/cafe'
  return NextResponse.redirect(`${origin}${next}`)
}
