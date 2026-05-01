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
    const body = await req.json() as {
      message: string
      type?: string
      _token?: string   // override for test button (unsaved settings)
      _chat_id?: string
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Resolve token & chat_id: body override (test button) > DB settings
    let token  = body._token  ?? ''
    let chatId = body._chat_id ?? ''

    if (!token || !chatId) {
      // Read from site_settings
      const res = await fetch(
        `${supabaseUrl}/rest/v1/site_settings?key=in.(telegram_bot_token,telegram_chat_id,telegram_enabled)&select=key,value`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      )
      const rows: { key: string; value: string }[] = await res.json()
      const s: Record<string, string> = {}
      for (const r of rows) s[r.key] = r.value

      if (s.telegram_enabled !== 'true') {
        return json({ ok: false, reason: 'disabled' })
      }
      token  = token  || s.telegram_bot_token  || ''
      chatId = chatId || s.telegram_chat_id    || ''
    }

    if (!token || !chatId) {
      return json({ ok: false, reason: 'missing token or chat_id' })
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    chatId,
        text:       body.message,
        parse_mode: 'HTML',
      }),
    })

    const tgData = await tgRes.json() as { ok: boolean; description?: string }

    if (!tgData.ok) {
      return json({ ok: false, error: tgData.description ?? 'Telegram API error' })
    }

    return json({ ok: true })
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500)
  }
})
