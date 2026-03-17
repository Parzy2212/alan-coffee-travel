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

  try {
    const apiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY not set' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      })
    }

    const { messages, context } = await req.json()

    // Convert Gemini-format messages to OpenAI format and prepend system message
    const openaiMessages = [
      { role: 'system', content: context },
      ...messages.map((m: { role: string; parts?: { text: string }[]; content?: string }) => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.content ?? m.parts?.[0]?.text ?? '',
      })),
    ]

    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',
        messages: openaiMessages,
        max_tokens: 1024,
      }),
    })

    const rawText = await orRes.text()
    console.log('OpenRouter status:', orRes.status)
    console.log('OpenRouter raw response:', rawText)

    let json: unknown
    try {
      json = JSON.parse(rawText)
    } catch {
      return new Response(JSON.stringify({ text: `[Raw response] ${rawText}` }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      })
    }

    if (!orRes.ok) {
      return new Response(JSON.stringify({ error: `OpenRouter error ${orRes.status}`, detail: json }), {
        status: orRes.status,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      })
    }

    const parsed = json as Record<string, unknown>
    const choices = parsed?.choices as { message?: { content?: string } }[] | undefined
    const text = choices?.[0]?.message?.content ?? `[Unexpected format] ${rawText}`

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    })
  }
})
