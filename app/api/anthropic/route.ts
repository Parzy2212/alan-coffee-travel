import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY is not configured.' }, { status: 500 })

  let body: { question?: string; context?: string; history?: { role: string; content: string }[] }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const { question, context = '', history = [] } = body
  if (!question) return NextResponse.json({ error: 'question is required.' }, { status: 400 })

  const systemPrompt = `You are an expert business analyst AI for Alan Cafe, a specialty coffee shop in Vientiane, Laos.

About Alan Cafe:
- Specialty coffee shop in Laos serving coffee, drinks, and food
- Uses a custom Cafe OS system for POS, inventory, staff management, CRM, and finance
- You have access to real business data: sales figures, menu performance, stock levels, staff attendance, customer loyalty points, purchase logs, and cashflow
- The cafe operates in the Lao market with local customers and expats

Your role:
- Analyze the real business data provided and give specific, actionable insights
- Always reference actual numbers from the data — never be vague or generic
- Give recommendations tailored to running a cafe in Laos (local suppliers, pricing for Lao market, seasonal patterns, etc.)
- Respond in the same language the user writes in: Thai if they write Thai, Lao if they write Lao, English if they write English
- Be concise and direct. Use bullet points when listing multiple items
- If data shows a problem, name it clearly and suggest a concrete fix

Current business data:
${context}`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ]

  const requestBody = {
    model: 'llama-3.3-70b-versatile',
    messages,
    max_tokens: 1024,
    temperature: 0.7,
  }

  let res: Response
  let rawBody: string
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })
    rawBody = await res.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[groq] fetch failed:', msg)
    return NextResponse.json({ error: `Network error calling Groq: ${msg}` }, { status: 502 })
  }

  console.log('[groq] status:', res.status, 'body:', rawBody.slice(0, 300))

  if (!res.ok) {
    let parsed: unknown
    try { parsed = JSON.parse(rawBody) } catch { parsed = rawBody }
    return NextResponse.json(
      { error: parsed, status: res.status },
      { status: res.status }
    )
  }

  const groqData = JSON.parse(rawBody)
  const text = groqData?.choices?.[0]?.message?.content ?? ''

  // Shape response like Anthropic format so frontend (data.content[0].text) works unchanged
  return NextResponse.json({
    content: [{ type: 'text', text }],
    model: 'llama-3.3-70b-versatile',
    role: 'assistant',
  })
}
