import { NextResponse } from 'next/server'

export const runtime = 'edge'

// ─── Cookie / auth helpers (same as admin db route) ───────────────────────────

function getSessionCookie(request: Request): string | undefined {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === 'admin_session') return v.join('=')
  }
  return undefined
}

async function computeExpectedToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}:alan-admin`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Auth check
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 })
  const sessionCookie = getSessionCookie(request)
  if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const expectedToken = await computeExpectedToken(adminPassword)
  if (sessionCookie !== expectedToken) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // 2. Anthropic API key
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 500 })

  // 3. Parse body
  let body: { question?: string; context?: string; history?: { role: string; content: string }[] }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const { question, context = '', history = [] } = body
  if (!question) return NextResponse.json({ error: 'question is required.' }, { status: 400 })

  const systemPrompt = `คุณคือ AI ที่ปรึกษาธุรกิจสำหรับร้าน Alan Coffee & Travel ในเวียงจันทน์ สปป.ลาว
คุณได้รับข้อมูลธุรกิจแบบ real-time และให้คำวิเคราะห์และคำแนะนำที่เป็นประโยชน์
ตอบเป็นภาษาไทย สั้น กระชับ ตรงประเด็น ใช้ bullet points เมื่อเหมาะสม
ถ้าข้อมูลมีเลข ให้วิเคราะห์เชิงลึกและเสนอแนวทางปฏิบัติได้เลย

ข้อมูลธุรกิจปัจจุบัน:
${context}`

  const messages = [
    ...history
      .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
        m.role === 'user' || m.role === 'assistant'),
    { role: 'user' as const, content: question },
  ]

  // 4. Call Anthropic
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    return NextResponse.json({ error: errText }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
