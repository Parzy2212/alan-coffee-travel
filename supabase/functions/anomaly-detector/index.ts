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
    const H = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' }

    async function rpc(name: string, params: Record<string, unknown> = {}) {
      const r = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: H, body: JSON.stringify(params),
      })
      return r.json()
    }

    async function query(table: string, params: string) {
      const r = await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, { headers: H })
      return r.json()
    }

    const nowVN  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Vientiane' }))
    const today  = nowVN.toISOString().slice(0, 10)
    const hour   = nowVN.getHours()

    const alerts: {
      type: string; severity: string; message: string; data: Record<string, unknown>
    }[] = []

    // ─── 1. Hourly sales anomaly ─────────────────────────────────────────────
    try {
      type HourRow = { hour: number; sales: number; order_count: number }
      const todayHourly: HourRow[] = await rpc('get_hourly_sales', { p_date: today })
      if (Array.isArray(todayHourly) && todayHourly.length > 0) {
        // Average same hour over last 7 days
        const past7Days: HourRow[][] = await Promise.all(
          Array.from({ length: 7 }, (_, i) => {
            const d = new Date(nowVN)
            d.setDate(d.getDate() - i - 1)
            return rpc('get_hourly_sales', { p_date: d.toISOString().slice(0, 10) })
          })
        )
        const hourAvgs: Record<number, number> = {}
        for (let h = 0; h <= 23; h++) {
          const vals = past7Days
            .filter(Array.isArray)
            .map(day => (day as HourRow[]).find(r => r.hour === h)?.sales ?? 0)
          hourAvgs[h] = vals.reduce((s, v) => s + v, 0) / vals.length
        }

        // Check last 2 hours
        let lowHours = 0
        for (let h = Math.max(0, hour - 2); h <= hour; h++) {
          const actual = todayHourly.find(r => r.hour === h)?.sales ?? 0
          const avg    = hourAvgs[h] ?? 0
          if (avg > 10000 && actual < avg * 0.5) lowHours++
        }
        if (lowHours >= 2) {
          const currentSales = todayHourly.find(r => r.hour === hour)?.sales ?? 0
          const avgNow       = hourAvgs[hour] ?? 0
          alerts.push({
            type: 'low_sales',
            severity: 'high',
            message: `⚠️ ยอดขายต่ำผิดปกติ: ชั่วโมงที่ ${hour}:00 — ${currentSales.toLocaleString()} ₭ vs เฉลี่ย ${Math.round(avgNow).toLocaleString()} ₭ (${lowHours} ชั่วโมงติดต่อกัน)`,
            data: { hour, current_sales: currentSales, avg_sales: avgNow, low_hours: lowHours },
          })
        }
      }
    } catch { /* sales anomaly failed — skip */ }

    // ─── 2. Large single order ───────────────────────────────────────────────
    try {
      type OrderRow = { id: string; total_lak: number; created_at: string }
      const todayOrders: OrderRow[] = await query(
        'orders',
        `date=eq.${today}&select=id,total_lak,created_at&order=total_lak.desc&limit=100`
      )
      if (Array.isArray(todayOrders) && todayOrders.length > 0) {
        const amounts = todayOrders.map(o => o.total_lak)
        const avg     = amounts.reduce((s, v) => s + v, 0) / amounts.length
        const big     = todayOrders.filter(o => o.total_lak > avg * 3)
        for (const o of big) {
          alerts.push({
            type: 'large_order',
            severity: 'medium',
            message: `💰 ออเดอร์ใหญ่ผิดปกติ: ${o.total_lak.toLocaleString()} ₭ (เฉลี่ย ${Math.round(avg).toLocaleString()} ₭)`,
            data: { order_id: o.id, amount: o.total_lak, avg_amount: avg },
          })
        }
      }
    } catch { /* large order check failed — skip */ }

    // ─── 3. Menu dropout ────────────────────────────────────────────────────
    try {
      type MenuRow = { product_name: string; total_qty: number }
      const [perf30, perf3]: [MenuRow[], MenuRow[]] = await Promise.all([
        rpc('get_menu_performance', { p_days: 30 }),
        rpc('get_menu_performance', { p_days: 3 }),
      ])
      if (Array.isArray(perf30) && Array.isArray(perf3)) {
        const top5 = (perf30 as MenuRow[]).slice(0, 5).map(m => m.product_name)
        const perf3Map: Record<string, number> = {}
        ;(perf3 as MenuRow[]).forEach(m => { perf3Map[m.product_name] = m.total_qty })

        for (const name of top5) {
          if ((perf3Map[name] ?? 0) === 0) {
            alerts.push({
              type: 'menu_dropout',
              severity: 'high',
              message: `📉 เมนูยอดฮิตเริ่มขายไม่ได้: "${name}" อยู่ใน Top 5 แต่ไม่มียอดขาย 3 วันที่ผ่านมา`,
              data: { menu: name, sales_30d: (perf30 as MenuRow[]).find(m => m.product_name === name)?.total_qty ?? 0, sales_3d: 0 },
            })
          }
        }
      }
    } catch { /* menu dropout check failed — skip */ }

    // ─── 4. Staff late repeatedly ────────────────────────────────────────────
    try {
      type AttRow = { staff_id: string; staff_name: string; late_minutes: number; report_date: string }
      const recent: AttRow[] = await query(
        'attendance',
        `report_date=gte.${new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)}&late_minutes=gte.10&select=staff_id,staff_name,late_minutes,report_date&limit=200`
      )
      if (Array.isArray(recent)) {
        const lateCounts: Record<string, { name: string; count: number }> = {}
        for (const row of recent as AttRow[]) {
          const k = row.staff_id
          if (!lateCounts[k]) lateCounts[k] = { name: row.staff_name, count: 0 }
          lateCounts[k].count++
        }
        for (const [, v] of Object.entries(lateCounts)) {
          if (v.count >= 3) {
            alerts.push({
              type: 'staff_late',
              severity: v.count >= 5 ? 'high' : 'medium',
              message: `⏰ พนักงาน "${v.name}" มาสายบ่อย: ${v.count} วันใน 7 วันที่ผ่านมา`,
              data: { staff_name: v.name, late_count: v.count },
            })
          }
        }
      }
    } catch { /* staff late check failed — skip */ }

    if (alerts.length === 0) return json({ ok: true, alerts: 0 })

    // Deduplicate: skip alerts with same type+message created in last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString()
    const existing: { type: string; message: string }[] = await query(
      'alerts',
      `created_at=gte.${twoHoursAgo}&status=eq.active&select=type,message&limit=100`
    ).catch(() => [])
    const existingKeys = new Set((Array.isArray(existing) ? existing : []).map(r => `${r.type}|${r.message}`))

    const newAlerts = alerts.filter(a => !existingKeys.has(`${a.type}|${a.message}`))
    if (newAlerts.length === 0) return json({ ok: true, alerts: 0, reason: 'all deduplicated' })

    // Insert alerts
    await fetch(`${supabaseUrl}/rest/v1/alerts`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify(newAlerts),
    })

    // Check Telegram
    const settingsRows: { key: string; value: string }[] = await (
      await fetch(`${supabaseUrl}/rest/v1/site_settings?key=eq.telegram_enabled&select=key,value`, { headers: H })
    ).json().catch(() => [])
    const tgEnabled = Array.isArray(settingsRows) && settingsRows.find(r => r.key === 'telegram_enabled')?.value === 'true'

    if (tgEnabled) {
      for (const alert of newAlerts) {
        const sev = alert.severity === 'critical' || alert.severity === 'high' ? '🚨' : alert.severity === 'medium' ? '⚠️' : 'ℹ️'
        await fetch(`${supabaseUrl}/functions/v1/telegram-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` },
          body: JSON.stringify({ message: `${sev} <b>Alan Anomaly Alert</b>\n\n${alert.message}`, type: 'alert' }),
        }).catch(() => null)
      }
    }

    return json({ ok: true, alerts: newAlerts.length })
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500)
  }
})
