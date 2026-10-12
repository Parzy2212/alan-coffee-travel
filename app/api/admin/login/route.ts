import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  createAdminSession,
  isAdminAuthConfigured,
  sessionCookieHeaders,
  verifyAdminPassword,
} from '@/lib/admin-session'

export const runtime = 'edge'

// Rate-limit bucket: Cloudflare's CF-Connecting-IP only (clients can't set it behind
// Cloudflare; X-Forwarded-For can be forged). IPv6 is keyed on its /64.
// Vercel doesn't strip a client-sent CF-Connecting-IP, so there everyone shares one bucket.
function clientScope(request: Request): string {
  if (process.env.VERCEL) return 'vercel'
  const ip = (request.headers.get('cf-connecting-ip') ?? '').trim().toLowerCase()
  if (!ip) return 'local'
  if (!ip.includes(':')) return ip.slice(0, 100)
  const [head, tail = ''] = ip.split('::')
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  const full = ip.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h
  return `${full.slice(0, 4).map(x => x.replace(/^0+(?=.)/, '')).join(':')}::/64`.slice(0, 100)
}

// Records the attempt and says whether it may log in. Throws if the DB can't be reached
// (caller fails closed).
async function recordAttempt(scope: string, ok: boolean): Promise<{ allowed: boolean; retryAfter: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('admin_login_attempt: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
    throw new Error('rate limit not configured')
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await supabase.rpc('admin_login_attempt', { p_scope: scope, p_ok: ok })
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row || typeof row.allowed !== 'boolean') {
    console.error('admin_login_attempt failed:', error?.code ?? 'bad response', error?.message ?? '')
    throw new Error('rate limit unavailable')
  }
  return { allowed: row.allowed, retryAfter: Number(row.retry_after) || 0 }
}

export async function POST(request: Request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 })
  }

  let password: unknown
  try {
    password = (await request.json())?.password
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const ok = await verifyAdminPassword(password)

  let result: { allowed: boolean; retryAfter: number }
  try {
    result = await recordAttempt(clientScope(request), ok)
  } catch {
    return NextResponse.json(
      { error: 'Login is temporarily unavailable. Please try again later.' },
      { status: 503 }
    )
  }

  if (result.retryAfter > 0) {
    const minutes = Math.ceil(result.retryAfter / 60)
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${minutes} min.` },
      { status: 429, headers: { 'Retry-After': String(result.retryAfter) } }
    )
  }
  if (!result.allowed || !ok) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  for (const c of sessionCookieHeaders(await createAdminSession())) {
    response.headers.append('Set-Cookie', c)
  }
  return response
}
