const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://alancoffeetravel.com',
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

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not set' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    })
  }

  const { messages, context } = await req.json()

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`

  const geminiRes = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: context }] },
      contents: messages,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    }),
  })

  const json = await geminiRes.json()
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
    ?? JSON.stringify(json?.error ?? json)

  return new Response(JSON.stringify({ text }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
})
