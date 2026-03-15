import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set', keyFound: false })
  }

  const requestBody = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    messages: [{ role: 'user', content: 'say hello' }],
  }

  let responseStatus: number
  let responseBody: string

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    responseStatus = res.status
    responseBody = await res.text()
  } catch (err) {
    return NextResponse.json({
      keyFound: true,
      keyPrefix: apiKey.slice(0, 14) + '…',
      fetchError: err instanceof Error ? err.message : String(err),
    })
  }

  let parsed: unknown
  try { parsed = JSON.parse(responseBody) } catch { parsed = responseBody }

  return NextResponse.json({
    keyFound: true,
    keyPrefix: apiKey.slice(0, 14) + '…',
    status: responseStatus,
    response: parsed,
  })
}
