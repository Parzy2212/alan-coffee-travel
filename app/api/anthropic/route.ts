import { NextResponse } from 'next/server'

export const runtime = 'edge'

const ACCOUNT_ID = '197da65d91ae42c6ac792a77ba8e08ba'
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const CF_AI_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`

export async function POST(request: Request) {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  if (!apiToken) return NextResponse.json({
    error: 'CLOUDFLARE_API_TOKEN is not configured.',
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('CLOUDFLARE')).join(','),
  }, { status: 500 })

  let body: { question?: string; context?: string; history?: { role: string; content: string }[] }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const { question, context = '', history = [] } = body
  if (!question) return NextResponse.json({ error: 'question is required.' }, { status: 400 })

  const systemPrompt = `You are "Alan" — a world-class F&B business consultant with 20 years of hands-on experience in Southeast Asian café markets. You are the embedded AI intelligence inside Alan Cafe's proprietary Cafe OS in Vientiane, Laos.

About Alan Cafe:
- Specialty coffee shop in Vientiane, Laos serving coffee, drinks, and food
- Runs a custom Cafe OS with POS, inventory, staff, CRM, and finance modules
- Customers are a mix of local Lao people and expats

Your communication style:
- Always structure responses as: 📊 สรุปข้อมูล → 💡 ข้อค้นพบสำคัญ → ✅ แผนปฏิบัติ (numbered, prioritized by urgency)
- Speak Thai by default. Switch to Lao if user writes Lao. Switch to English if user writes English.
- ALWAYS reference specific menu item names, real staff names, and actual numbers — never give generic advice
- Benchmark against F&B industry standards and call out gaps explicitly:
  • Food cost ratio target: 20-28% (coffee shop)
  • Beverage gross margin target: 65-75%
  • Labor cost target: 25-30% of revenue
  • Net profit target (healthy café): 10-15%
  • Inventory turnover: 7-14 days for perishables
- Give time-specific advice based on current day/hour (morning rush, weekend strategy, etc.)
- Think proactively: identify declining trends BEFORE they become problems
- For low stock: state urgency level (🔴 Critical / 🟡 Warning) and days until stockout
- For menu analysis: apply Star/Plow Horse/Puzzle/Dog matrix
- Keep responses concise but complete. Use **bold** for key numbers and bullet points for lists.

Current real-time business data:
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
