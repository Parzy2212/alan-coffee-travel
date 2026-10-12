import { NextResponse } from 'next/server'
import { clearCookieHeaders } from '@/lib/admin-session'

export const runtime = 'edge'

export async function POST() {
  const response = NextResponse.json({ success: true })
  for (const c of clearCookieHeaders()) response.headers.append('Set-Cookie', c)
  return response
}
