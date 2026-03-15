import { NextResponse } from 'next/server'

export const runtime = 'edge'

const ACCOUNT_ID = '197da65d91ae42c6ac792a77ba8e08ba'
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const CF_AI_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`

export async function POST(request: Request) {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  if (!apiToken) return NextResponse.json({ error: 'CLOUDFLARE_API_TOKEN is not configured.' }, { status: 500 })

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

  let res: Response
  let rawBody: string
  try {
    res = await fetch(CF_AI_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ messages }),
    })
    rawBody = await res.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cf-ai] fetch failed:', msg)
    return NextResponse.json({ error: `Network error calling Cloudflare AI: ${msg}` }, { status: 502 })
  }

  console.log('[cf-ai] status:', res.status, 'body:', rawBody.slice(0, 300))

  if (!res.ok) {
    let parsed: unknown
    try { parsed = JSON.parse(rawBody) } catch { parsed = rawBody }
    return NextResponse.json({ error: parsed, status: res.status }, { status: res.status })
  }

  const cfData = JSON.parse(rawBody)
  const text = cfData?.result?.response ?? ''

  // Shape response like Anthropic format so frontend (data.content[0].text) works unchanged
  return NextResponse.json({
    content: [{ type: 'text', text }],
    model: MODEL,
    role: 'assistant',
  })
}
