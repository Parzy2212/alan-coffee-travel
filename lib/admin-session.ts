// Admin session cookie: v1.<iat>.<exp>.<nonce>.<sig>, sig = HMAC-SHA256 over "v1.<iat>.<exp>.<nonce>".
// Web Crypto only (runs in edge middleware, edge routes and `next dev`).
// The HMAC key mixes ADMIN_SESSION_SECRET with a hash of ADMIN_PASSWORD, so changing
// either one invalidates every session.

export const ADMIN_COOKIE = 'admin_session'
export const ADMIN_SESSION_TTL = 12 * 60 * 60

// /admin pages (middleware) and the write API; nothing else needs the cookie.
const COOKIE_PATHS = ['/admin', '/api/admin/db']
// Cookies issued before v1 used path=/; cleared wherever we clear ours.
const LEGACY_COOKIE_PATH = '/'

const MAX_PASSWORD_LENGTH = 256
const CLOCK_SKEW = 60
const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function getKey(): Promise<CryptoKey | null> {
  const secret = process.env.ADMIN_SESSION_SECRET
  const password = process.env.ADMIN_PASSWORD
  if (!secret || !password) return null
  const pwHash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(password)))
  return crypto.subtle.importKey(
    'raw',
    enc.encode(`${secret}:${b64url(pwHash)}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_PASSWORD)
}

export async function verifyAdminPassword(input: unknown): Promise<boolean> {
  const key = await getKey()
  const password = process.env.ADMIN_PASSWORD
  if (!key || !password) return false
  if (typeof input !== 'string' || !input || input.length > MAX_PASSWORD_LENGTH) return false
  const expected = await crypto.subtle.sign('HMAC', key, enc.encode(`pw:${password}`))
  return crypto.subtle.verify('HMAC', key, expected, enc.encode(`pw:${input}`))
}

export async function createAdminSession(): Promise<string> {
  const key = await getKey()
  if (!key) throw new Error('Admin auth not configured.')
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + ADMIN_SESSION_TTL
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)))
  const msg = `v1.${iat}.${exp}.${nonce}`
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg)))
  return `${msg}.${b64url(sig)}`
}

async function verifyOne(key: CryptoKey, token: string, now: number): Promise<boolean> {
  const parts = token.split('.')
  if (parts.length !== 5) return false
  const [ver, iatS, expS, nonce, sig] = parts
  if (ver !== 'v1' || !/^\d{1,12}$/.test(iatS) || !/^\d{1,12}$/.test(expS)) return false
  if (!/^[A-Za-z0-9_-]{22}$/.test(nonce) || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return false
  const ok = await crypto.subtle.verify(
    'HMAC', key, fromB64url(sig), enc.encode(`v1.${iatS}.${expS}.${nonce}`),
  )
  if (!ok) return false
  const iat = Number(iatS)
  const exp = Number(expS)
  return exp > now && iat <= now + CLOCK_SKEW && exp - iat <= ADMIN_SESSION_TTL
}

// Every admin_session value in the Cookie header (a stale path=/ cookie can sit next to ours).
export function readAdminCookies(cookieHeader: string | null): string[] {
  const out: string[] = []
  for (const part of (cookieHeader ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === ADMIN_COOKIE) out.push(part.slice(i + 1).trim())
  }
  return out
}

export async function verifyAdminSession(cookieHeader: string | null): Promise<boolean> {
  const key = await getKey()
  if (!key) return false
  const now = Math.floor(Date.now() / 1000)
  for (const token of readAdminCookies(cookieHeader).slice(0, 5)) {
    if (await verifyOne(key, token, now)) return true
  }
  return false
}

function serialize(value: string, maxAge: number, path: string): string {
  return `${ADMIN_COOKIE}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`
}

export function sessionCookieHeaders(value: string): string[] {
  return [
    ...COOKIE_PATHS.map(p => serialize(value, ADMIN_SESSION_TTL, p)),
    serialize('', 0, LEGACY_COOKIE_PATH),
  ]
}

export function clearCookieHeaders(): string[] {
  return [...COOKIE_PATHS, LEGACY_COOKIE_PATH].map(p => serialize('', 0, p))
}
