const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const apiKey      = Deno.env.get('OPENROUTER_API_KEY')
    if (!apiKey) return json({ ok: false, error: 'OPENROUTER_API_KEY not set' }, 500)

    const H = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }

    async function rpc(name: string, params: Record<string, unknown> = {}) {
      const r = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: H, body: JSON.stringify(params),
      })
      return r.json()
    }

    const today      = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Vientiane' })
    const monthStart = today.slice(0, 7) + '-01'

    // Expire old active quests past their expiry
    await fetch(`${supabaseUrl}/rest/v1/alan_quests?status=eq.active&expires_at=lt.${new Date().toISOString()}`, {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'expired' }),
    })

    // Fetch all data in parallel
    const [menu, stock, cashBalance, budgets, cfSummary] = await Promise.all([
      rpc('get_menu_performance', { p_days: 7 }),
      rpc('get_stock_detail'),
      rpc('get_current_cash_balance'),
      rpc('get_budget_summary'),
      rpc('get_cash_flow_summary', { p_start: monthStart, p_end: today }),
    ])

    type MenuRow  = { product_name: string; total_qty: number; total_sales: number; margin_pct: number; avg_price?: number }
    type StockRow = { name: string; unit: string; current_qty: number; reorder_point: number | null; days_until_empty: number | null; supplier?: string }
    type BudgetRow = { category: string; monthly_budget_lak: number; spent_this_month: number }
    type CFRow = { total_income: number; total_expense: number; net: number }

    const menuArr   = Array.isArray(menu)    ? menu    as MenuRow[]   : []
    const stockArr  = Array.isArray(stock)   ? stock   as StockRow[]  : []
    const budgetArr = Array.isArray(budgets) ? budgets as BudgetRow[] : []

    const cashBal   = Number(cashBalance) || 0
    const cfRow     = Array.isArray(cfSummary) ? (cfSummary as CFRow[])[0] : cfSummary as CFRow | null

    const mktBudget    = budgetArr.find(b => b.category === 'การตลาด')
    const mktRemaining = mktBudget ? Math.max(0, mktBudget.monthly_budget_lak - mktBudget.spent_this_month) : 0

    // Identify quest triggers
    const slowRotation  = menuArr.filter(m => m.total_qty < 5)
    const lowMarginMenu = menuArr.filter(m => (m.margin_pct ?? 100) < 30)
    const top5          = menuArr.slice(0, 5)
    const bottom5       = [...menuArr].reverse().slice(0, 5)
    const criticalStock = stockArr.filter(s => s.days_until_empty != null && s.days_until_empty <= 3)
    const nearReorder   = stockArr.filter(s => s.reorder_point != null && s.current_qty <= s.reorder_point)
    const surplusStock  = stockArr.filter(s => s.reorder_point != null && s.current_qty > s.reorder_point * 3)

    const dataCtx = `
FINANCIAL CONSTRAINTS (HARD — never exceed):
- เงินสดในมือ: ${cashBal.toLocaleString()} LAK
- งบการตลาดคงเหลือ: ${mktRemaining.toLocaleString()} LAK
- รายรับเดือนนี้: ${(cfRow?.total_income ?? 0).toLocaleString()} LAK
- กำไรสุทธิเดือนนี้: ${(cfRow?.net ?? 0).toLocaleString()} LAK

MENU PERFORMANCE (7 วัน):
Top 5 ขายดี: ${top5.map(m => `${m.product_name}(${m.total_qty}แก้ว,margin ${m.margin_pct?.toFixed(0)}%)`).join(', ')}
Bottom 5 ขายน้อย: ${bottom5.map(m => `${m.product_name}(${m.total_qty}แก้ว)`).join(', ')}
เมนูขายช้า (<5 แก้ว/7วัน): ${slowRotation.length} เมนู — ${slowRotation.slice(0, 5).map(m => m.product_name).join(', ')}
Margin <30%: ${lowMarginMenu.map(m => `${m.product_name}(${m.margin_pct?.toFixed(0)}%)`).join(', ') || 'ไม่มี'}

STOCK:
วิกฤต (≤3วัน): ${criticalStock.map(s => `${s.name}(~${s.days_until_empty}วัน)`).join(', ') || 'ไม่มี'}
ใกล้ reorder: ${nearReorder.slice(0, 5).map(s => `${s.name}(${s.current_qty}${s.unit})`).join(', ') || 'ไม่มี'}
สต็อกล้นเกิน (>3x reorder): ${surplusStock.slice(0, 3).map(s => `${s.name}(${s.current_qty}${s.unit})`).join(', ') || 'ไม่มี'}
`.trim()

    const systemPrompt = `You are Alan, a senior cafe consultant. Generate 4-5 actionable quests for the cafe team.

${dataCtx}

Rules:
1. required_investment_lak MUST be ≤ available cash (${cashBal.toLocaleString()} LAK)
2. Marketing quests: required_investment_lak ≤ marketing budget (${mktRemaining.toLocaleString()} LAK)
3. If cash critically low (<1M LAK), only free quests (required_investment_lak = 0)
4. Each quest must be specific — name exact menu items, exact times, exact numbers
5. daily quests expire tonight; weekly quests expire in 7 days
6. Use Thai language only

Return ONLY a JSON array, no other text:
[
  {
    "type": "daily",
    "category": "inventory",
    "title": "ชื่อเควส ≤40 ตัวอักษร",
    "description": "ทำไมเควสนี้สำคัญ ≤80 ตัวอักษร",
    "action_steps": ["ขั้นตอน 1", "ขั้นตอน 2", "ขั้นตอน 3"],
    "estimated_reward_lak": 50000,
    "estimated_outcome": "ผลลัพธ์ที่วัดได้ ≤50 ตัวอักษร",
    "required_investment_lak": 0,
    "difficulty": "easy"
  }
]

Category examples:
- inventory: ใช้วัตถุดิบที่กำลังจะหมด, ลดของเสีย
- marketing: Happy Hour, โปรโมชัน, โซเชียลมีเดีย
- upsell: Combo, Add-on, Upgrade
- customer: Win-back ลูกค้า, loyalty
- staff: Training, efficiency
- cost: ลด food cost, เจรจาซัพพลายเออร์`

    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',
        messages: [{ role: 'user', content: systemPrompt }],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    })

    const orData = await orRes.json() as { choices?: { message?: { content?: string } }[] }
    const rawContent = orData.choices?.[0]?.message?.content ?? ''

    type QuestInput = {
      type?: string; category?: string; title?: string; description?: string
      action_steps?: string[]; estimated_reward_lak?: number; estimated_outcome?: string
      required_investment_lak?: number; difficulty?: string
    }

    let quests: QuestInput[] = []
    try {
      const match = rawContent.match(/\[[\s\S]*\]/)
      if (match) quests = JSON.parse(match[0])
    } catch {
      return json({ ok: false, error: 'Failed to parse LLM response', raw: rawContent.slice(0, 500) })
    }

    if (!Array.isArray(quests) || quests.length === 0) {
      return json({ ok: false, error: 'No quests generated', raw: rawContent.slice(0, 500) })
    }

    // Delete today's active quests before inserting new ones (idempotent)
    await fetch(`${supabaseUrl}/rest/v1/alan_quests?status=eq.active`, {
      method: 'DELETE', headers: H,
    })

    const nowIso    = new Date().toISOString()
    const todayEnd  = today + 'T23:59:59+07:00'
    const weekEnd   = new Date(Date.now() + 7 * 86400000).toISOString()

    const rows = quests.map(q => ({
      type:                    (q.type === 'weekly' ? 'weekly' : 'daily') as string,
      category:                ['inventory','marketing','upsell','customer','staff','cost'].includes(q.category ?? '')
        ? q.category! : 'inventory',
      title:                   q.title?.slice(0, 100)             ?? 'เควสวันนี้',
      description:             q.description?.slice(0, 300)       ?? '',
      action_steps:            Array.isArray(q.action_steps) ? q.action_steps : [],
      estimated_reward_lak:    Number(q.estimated_reward_lak      ?? 0),
      estimated_outcome:       q.estimated_outcome                ?? null,
      required_investment_lak: Math.min(Number(q.required_investment_lak ?? 0), cashBal),
      difficulty:              ['easy','medium','hard'].includes(q.difficulty ?? '') ? q.difficulty! : 'medium',
      expires_at:              q.type === 'weekly' ? weekEnd : todayEnd,
      status:                  'active',
      created_at:              nowIso,
    }))

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/alan_quests`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify(rows),
    })

    if (!insertRes.ok) {
      const errBody = await insertRes.text()
      return json({ ok: false, error: `Insert failed: ${errBody}` }, 500)
    }

    // Check Telegram setting
    const settingsRows: { key: string; value: string }[] = await (
      await fetch(`${supabaseUrl}/rest/v1/site_settings?key=eq.telegram_enabled&select=key,value`, { headers: H })
    ).json()
    const tgEnabled = settingsRows.find(r => r.key === 'telegram_enabled')?.value === 'true'

    if (tgEnabled) {
      const questSummary = quests.slice(0, 3).map((q, i) =>
        `${i + 1}. ${q.title ?? ''} (${q.difficulty ?? ''}) +${Number(q.estimated_reward_lak ?? 0).toLocaleString()}₭`
      ).join('\n')

      await fetch(`${supabaseUrl}/functions/v1/telegram-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify({
          message: `📋 <b>Alan AI — เควสวันนี้ (${today})</b>\n\n${questSummary}\n\n👉 เปิด Cafe OS → Alan AI → 🎯 เควส`,
          type: 'quest',
        }),
      }).catch(() => null)
    }

    return json({ ok: true, count: quests.length, date: today })
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500)
  }
})
