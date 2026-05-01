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

    // Check enabled setting
    const settingsRows: { key: string; value: string }[] = await (
      await fetch(
        `${supabaseUrl}/rest/v1/site_settings?key=in.(alan_insights_enabled,telegram_enabled)&select=key,value`,
        { headers: H }
      )
    ).json()
    const cfg: Record<string, string> = {}
    for (const r of settingsRows) cfg[r.key] = r.value
    if (cfg.alan_insights_enabled === 'false') return json({ ok: false, reason: 'disabled' })

    async function rpc(name: string, params: Record<string, unknown> = {}) {
      const r = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: H, body: JSON.stringify(params),
      })
      return r.json()
    }

    // Gather data in parallel
    const today     = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Vientiane' })
    const monthStart = today.slice(0, 7) + '-01'

    const [stats, menu, stock, cashBalance, cfSummary, budgets] = await Promise.all([
      rpc('get_dashboard_stats'),
      rpc('get_menu_performance', { p_days: 30 }),
      rpc('get_stock_detail'),
      rpc('get_current_cash_balance'),
      rpc('get_cash_flow_summary', { p_start: monthStart, p_end: today }),
      rpc('get_budget_summary'),
    ])

    const menuArr   = Array.isArray(menu)    ? menu    : []
    const stockArr  = Array.isArray(stock)   ? stock   : []
    const budgetArr = Array.isArray(budgets) ? budgets : []

    type MenuRow  = { product_name: string; total_qty: number; total_sales: number; margin_pct: number }
    type StockRow = { name: string; unit: string; current_qty: number; reorder_point: number | null; days_until_empty: number | null }
    type BudgetRow = { category: string; monthly_budget_lak: number; spent_this_month: number }
    type CFRow = { total_income: number; total_expense: number; net: number }

    const cfRow = Array.isArray(cfSummary) ? (cfSummary as CFRow[])[0] : (cfSummary as CFRow | null)

    const lowMargin    = (menuArr as MenuRow[]).filter(m => (m.margin_pct ?? 100) < 30)
    const lowStock     = (stockArr as StockRow[]).filter(s => s.reorder_point != null && s.current_qty <= s.reorder_point)
    const criticalStock = (stockArr as StockRow[]).filter(s => s.days_until_empty != null && s.days_until_empty <= 3)
    const top5         = (menuArr as MenuRow[]).slice(0, 5)
    const bottom5      = [...(menuArr as MenuRow[])].reverse().slice(0, 5)
    const noSales7     = (menuArr as MenuRow[]).filter(m => m.total_qty === 0)

    const mktBudget    = (budgetArr as BudgetRow[]).find(b => b.category === 'การตลาด')
    const mktRemaining = mktBudget ? Math.max(0, mktBudget.monthly_budget_lak - mktBudget.spent_this_month) : 0
    const cashBal      = Number(cashBalance) || 0

    const vsYesterday = (stats?.yesterday_sales ?? 0) > 0
      ? (((stats.today_sales - stats.yesterday_sales) / stats.yesterday_sales) * 100).toFixed(1) + '%'
      : 'N/A'

    const dataCtx = `
FINANCIAL CONSTRAINTS (HARD LIMITS — MUST RESPECT):
- เงินสดในมือ: ${cashBal.toLocaleString()} LAK
- รายรับเดือนนี้: ${(cfRow?.total_income ?? 0).toLocaleString()} LAK
- รายจ่ายเดือนนี้: ${(cfRow?.total_expense ?? 0).toLocaleString()} LAK
- กำไรสุทธิเดือนนี้: ${(cfRow?.net ?? 0).toLocaleString()} LAK
- งบการตลาดคงเหลือ: ${mktRemaining.toLocaleString()} LAK

SALES:
- วันนี้: ${(stats?.today_sales ?? 0).toLocaleString()} LAK (${vsYesterday} vs เมื่อวาน)
- ออเดอร์วันนี้: ${stats?.today_orders ?? 0} รายการ

TOP 5 เมนูขายดี (30 วัน):
${top5.map((m: MenuRow) => `- ${m.product_name}: ${m.total_qty}แก้ว | margin ${m.margin_pct?.toFixed(1)}%`).join('\n')}

BOTTOM 5 ขายน้อย:
${bottom5.map((m: MenuRow) => `- ${m.product_name}: ${m.total_qty}แก้ว`).join('\n')}

เมนูไม่มียอดขาย 30 วัน: ${noSales7.length} เมนู

เมนู margin <30%: ${lowMargin.length > 0 ? lowMargin.map((m: MenuRow) => `${m.product_name} (${m.margin_pct?.toFixed(1)}%)`).join(', ') : 'ไม่มี'}

สต็อกวิกฤต (≤3 วัน): ${criticalStock.length > 0 ? criticalStock.map((s: StockRow) => `${s.name} (~${s.days_until_empty}วัน)`).join(', ') : 'ไม่มี'}

สต็อกต่ำกว่า reorder point: ${lowStock.length} รายการ
${lowStock.slice(0, 5).map((s: StockRow) => `- ${s.name}: ${s.current_qty}${s.unit}`).join('\n')}
`.trim()

    const systemPrompt = `คุณคือ Alan นักที่ปรึกษาธุรกิจร้านกาแฟ ประสบการณ์ 20 ปีใน F&B เอเชียตะวันออกเฉียงใต้

กฎที่ต้องปฏิบัติตามอย่างเคร่งครัด:
1. ห้ามแนะนำใช้เงินเกิน "เงินสดในมือ" โดยเด็ดขาด
2. ถ้า required_investment > 0 ต้องน้อยกว่า available cash
3. ถ้าสต็อกวิกฤต ต้องเป็น high priority
4. ถ้างบการตลาด = 0 ให้แนะนำวิธีฟรีเท่านั้น
5. ทุก observation และ recommendation ต้องอ้างอิงข้อมูลจริงที่ให้มา

ส่งกลับเป็น JSON array เท่านั้น (ไม่มีข้อความอื่น) ของ 2-3 insights:

[
  {
    "type": "sales|stock|cash|margin|marketing|staff",
    "priority": "high|medium|low",
    "observation": "สิ่งที่พบ ≤60 คำ อ้างอิงตัวเลขจริง",
    "recommendation": "คำแนะนำที่ทำได้จริง ≤60 คำ",
    "required_investment": 0,
    "expected_outcome": "ผลลัพธ์ที่คาดหวัง ≤30 คำ",
    "action_steps": ["ขั้นตอน 1", "ขั้นตอน 2", "ขั้นตอน 3"]
  }
]

ข้อมูลธุรกิจวันนี้:
${dataCtx}`

    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',
        messages: [{ role: 'user', content: systemPrompt }],
        max_tokens: 1500,
        temperature: 0.25,
      }),
    })

    const orData = await orRes.json() as { choices?: { message?: { content?: string } }[] }
    const rawContent = orData.choices?.[0]?.message?.content ?? ''

    type InsightInput = {
      type?: string; priority?: string; observation?: string; recommendation?: string
      required_investment?: number; expected_outcome?: string; action_steps?: string[]
    }
    let insights: InsightInput[] = []
    try {
      const match = rawContent.match(/\[[\s\S]*\]/)
      if (match) insights = JSON.parse(match[0])
    } catch {
      insights = [{
        type: 'general', priority: 'medium',
        observation: 'Alan AI วิเคราะห์ข้อมูลร้านเรียบร้อยแล้ว',
        recommendation: rawContent.slice(0, 150) || 'ตรวจสอบข้อมูลในระบบและวางแผนสัปดาห์นี้',
        required_investment: 0,
        expected_outcome: 'ปรับปรุงประสิทธิภาพร้าน',
        action_steps: ['เปิดดู dashboard ประจำวัน', 'ตรวจสต็อกวัตถุดิบ'],
      }]
    }

    // Delete today's 'new' insights before re-inserting
    await fetch(`${supabaseUrl}/rest/v1/alan_insights?date=eq.${today}&status=eq.new`, {
      method: 'DELETE', headers: H,
    })

    // Insert new insights
    await fetch(`${supabaseUrl}/rest/v1/alan_insights`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify(insights.map(ins => ({
        date: today,
        type:                 ins.type                ?? 'general',
        priority:             ins.priority            ?? 'medium',
        observation:          ins.observation         ?? '',
        recommendation:       ins.recommendation      ?? '',
        required_investment:  Number(ins.required_investment ?? 0),
        expected_outcome:     ins.expected_outcome    ?? null,
        action_steps:         ins.action_steps        ?? [],
        status: 'new',
      }))),
    })

    // Send top insight to Telegram
    const topInsight = insights.find(i => i.priority === 'high') ?? insights[0]
    if (topInsight && cfg.telegram_enabled === 'true') {
      const tgMsg =
        `🤖 <b>Alan AI — Insight ประจำวัน</b>\n\n` +
        `🔍 ${topInsight.observation ?? ''}\n\n` +
        `💡 ${topInsight.recommendation ?? ''}\n` +
        `💰 ลงทุน: ${Number(topInsight.required_investment ?? 0).toLocaleString()} ₭\n` +
        `📈 ${topInsight.expected_outcome ?? ''}`

      await fetch(`${supabaseUrl}/functions/v1/telegram-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify({ message: tgMsg, type: 'insight' }),
      }).catch(() => null)
    }

    return json({ ok: true, count: insights.length, date: today })
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500)
  }
})
