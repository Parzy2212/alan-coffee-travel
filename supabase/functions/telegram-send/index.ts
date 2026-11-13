const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
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

  try {
    const body = await req.json() as { message: string; type?: string }
    if (typeof body.message !== 'string' || !body.message.trim()) {
      return json({ ok: false, reason: 'empty message' }, 400)
    }

    // The token is hidden from the public key, so it is read with the
    // project's own service key (provided to Edge Functions by Supabase).
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
