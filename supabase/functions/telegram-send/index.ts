// Sends a message to the shop's Telegram chat. Only two callers are accepted:
//   * the database (notify_telegram, migration 062), with the x-notify-secret header
//     = the TELEGRAM_SEND_SECRET function secret (same value as Vault "telegram_send_secret")
//   * a signed-in user who is an active member of the shop (shop_users), with their
//     own session token. The public anon key alone is refused (401/403).
// Deployed with --no-verify-jwt: the database call carries no JWT, and this code
// does the checking itself.

const SHOP_ID = '9afdd9eb-728d-4e36-8077-492c92dbef30'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // every header supabase-js sends (its own list: @supabase/supabase-js/cors); one missing = the
  // browser's preflight fails and functions.invoke never reaches this function
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
}

function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

  // ---- who is calling ----
  const secret = Deno.env.get('TELEGRAM_SEND_SECRET') ?? ''
  const given  = req.headers.get('x-notify-secret') ?? ''
  let allowed = secret.length >= 32 && given !== '' && sameSecret(given, secret)

  if (!allowed) {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return json({ ok: false, error: 'sign in required' }, 401)
    // the anon key is a valid JWT but has no user: /auth/v1/user refuses it
    const u = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } })
    if (!u.ok) return json({ ok: false, error: 'sign in required' }, 401)
    const user = await u.json() as { id?: string }
    if (!user.id) return json({ ok: false, error: 'sign in required' }, 401)
    const m = await fetch(
      `${supabaseUrl}/rest/v1/shop_users?shop_id=eq.${SHOP_ID}&user_id=eq.${user.id}&active=is.true&select=user_id&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    )
    if (!m.ok) return json({ ok: false, error: `member check failed: ${m.status}` }, 500)
    allowed = ((await m.json()) as unknown[]).length > 0
    if (!allowed) return json({ ok: false, error: 'not a member of the shop' }, 403)
  }

  try {
    const body = await req.json() as { message: string; type?: string }
    if (typeof body.message !== 'string' || !body.message.trim()) {
      return json({ ok: false, reason: 'empty message' }, 400)
    }

    // The token is hidden from the public key, so it is read with the
    // project's own service key (provided to Edge Functions by Supabase).
    const res = await fetch(
      `${supabaseUrl}/rest/v1/site_settings?key=in.(telegram_bot_token,telegram_chat_id,telegram_enabled)&select=key,value`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    )
    if (!res.ok) {
      return json({ ok: false, error: `settings read failed: ${res.status}` }, 500)
    }
    const rows: { key: string; value: string }[] = await res.json()
    const s: Record<string, string> = {}
    for (const r of rows) s[r.key] = r.value

    if (s.telegram_enabled !== 'true') {
      return json({ ok: false, reason: 'disabled' })
    }
    const token  = s.telegram_bot_token ?? ''
    const chatId = s.telegram_chat_id   ?? ''

    if (!token || !chatId) {
      return json({ ok: false, reason: 'missing token or chat_id' })
    }

    const send = async (html: boolean) => {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text:    html ? body.message : body.message.replace(/<\/?b>/g, ''),
          ...(html ? { parse_mode: 'HTML' } : {}),
        }),
      })
      return await r.json() as { ok: boolean; description?: string }
    }

    let tgData: { ok: boolean; description?: string }
    try {
      tgData = await send(true)
      // free text such as "A & B" or "<10k" breaks HTML parsing: send it as plain text instead of losing it
      if (!tgData.ok && /parse entities/i.test(tgData.description ?? '')) {
        tgData = await send(false)
      }
    } catch {
      // a network error message would contain the request URL, which holds the bot token
      return json({ ok: false, error: 'could not reach Telegram' }, 502)
    }

    if (!tgData.ok) {
      return json({ ok: false, error: tgData.description ?? 'Telegram API error' })
    }

    return json({ ok: true })
  } catch {
    return json({ ok: false, error: 'telegram-send failed' }, 500)
  }
})
