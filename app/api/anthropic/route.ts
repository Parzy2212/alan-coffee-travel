import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 })

  let body: { question?: string; context?: string; history?: { role: string; content: string }[] }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const { question, context = '', history = [] } = body
  if (!question) return NextResponse.json({ error: 'question is required.' }, { status: 400 })

  const systemInstruction = `You are an expert business analyst AI for Alan Cafe, a specialty coffee shop in Vientiane, Laos.

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

  // Build Gemini contents array from history + current question
  const contents = [
    ...history
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    { role: 'user', parts: [{ text: question }] },
  ]

  const requestBody = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
    },
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  const rawBody = await res.text()

  if (!res.ok) {
    return NextResponse.json(
      { error: rawBody, status: res.status },
      { status: res.status }
    )
  }

  const geminiData = JSON.parse(rawBody)

  // Extract text from Gemini response and shape it like Anthropic's format
  // so the frontend (which reads data.content[0].text) works unchanged
  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  return NextResponse.json({
    content: [{ type: 'text', text }],
    model: 'gemini-2.0-flash',
    role: 'assistant',
  })
}
