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

  try {
    const apiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY not set' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      })
    }

    const { messages, context } = await req.json()

    // Fetch live financial constraints from DB — independent of client context
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const H = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }

    let constraintBlock = ''
    try {
      const [balRes, budRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/rpc/get_current_cash_balance`, { method: 'POST', headers: H, body: '{}' }),
        fetch(`${supabaseUrl}/rest/v1/rpc/get_budget_summary`,        { method: 'POST', headers: H, body: '{}' }),
      ])
      const cashBalance: number = await balRes.json()
      const budgets: { category: string; monthly_budget_lak: number; spent_this_month: number }[] = await budRes.json()

      const mktBudget = Array.isArray(budgets) ? budgets.find(b => b.category === 'การตลาด') : null
      const mktRemaining = mktBudget ? Math.max(0, mktBudget.monthly_budget_lak - mktBudget.spent_this_month) : null

      constraintBlock = `
=== ⚠️ FINANCIAL CONSTRAINTS — VERIFIED FROM DATABASE (REAL-TIME) ===
เงินสดในมือ (ห้ามแนะนำใช้มากกว่านี้): ${Number(cashBalance || 0).toLocaleString()} LAK
งบการตลาดคงเหลือ: ${mktRemaining != null ? mktRemaining.toLocaleString() + ' LAK' : 'ไม่มีข้อมูล'}
${Number(cashBalance || 0) < 1000000 ? '⚠️ เงินสดต่ำมาก — แนะนำเฉพาะวิธีฟรีหรือต้นทุนต่ำ' : ''}
===`
    } catch {
      // Constraint fetch failed — continue without it
    }

    const constraintRules = `
⚠️ CONSTRAINT RULES (NON-NEGOTIABLE):
1. NEVER recommend spending more than the cash balance shown above
2. If cash is critically low (<1M LAK), suggest only free strategies
3. Always state the cost of any recommendation explicitly
4. If a recommendation costs nothing, say "ไม่มีค่าใช้จ่าย"
5. Reference specific numbers from the data — never give generic advice`

    // Prepend constraints to the system context
    const fullContext = constraintBlock
      ? `${constraintRules}\n\n${constraintBlock}\n\n${context}`
      : context

    const openaiMessages = [
      { role: 'system', content: fullContext },
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
