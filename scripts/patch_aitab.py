"""Splice new AI tab section into CafeClient.tsx"""
import sys, os

target = os.path.join(os.path.dirname(__file__), '..', 'app', 'cafe', 'CafeClient.tsx')
with open(target, 'r', encoding='utf-8') as f:
    content = f.read()

START = '// ─── AI Tab'
END   = '\n// ─── Audit Tab'

start_idx = content.find(START)
end_idx   = content.find(END, start_idx)

if start_idx == -1 or end_idx == -1:
    print(f'ERROR: markers not found — start={start_idx}, end={end_idx}')
    sys.exit(1)

NEW_SECTION = r"""// ─── AI Tab ───────────────────────────────────────────────────────────────────

// Markdown inline renderer — bold (**text**) support
function renderInlineMd(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} style={{ fontWeight: 700, color: '#fff' }}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

// Block-level markdown renderer — headers, bullets, numbered lists
function renderMdContent(text: string) {
  return text.split('\n').map((line, i) => {
    const num = line.match(/^(\d+)\.\s(.+)$/)
    if (num) return (
      <div key={i} style={{ display: 'flex', gap: 8, marginLeft: 4, marginBottom: 2 }}>
        <span style={{ color: GOLD, minWidth: 22, flexShrink: 0 }}>{num[1]}.</span>
        <span>{renderInlineMd(num[2])}</span>
      </div>
    )
    if (line.startsWith('- ') || line.startsWith('* ')) return (
      <div key={i} style={{ display: 'flex', gap: 8, marginLeft: 4, marginBottom: 2 }}>
        <span style={{ color: GOLD, flexShrink: 0 }}>•</span>
        <span>{renderInlineMd(line.slice(2))}</span>
      </div>
    )
    if (line.startsWith('### ')) return (
      <div key={i} style={{ fontWeight: 700, color: GOLD, marginTop: 10, marginBottom: 4, fontSize: 13 }}>
        {renderInlineMd(line.slice(4))}
      </div>
    )
    if (line.startsWith('## ')) return (
      <div key={i} style={{ fontWeight: 700, color: GOLD, marginTop: 12, marginBottom: 5, fontSize: 14 }}>
        {renderInlineMd(line.slice(3))}
      </div>
    )
    if (line.trim() === '') return <div key={i} style={{ height: 5 }} />
    return <div key={i} style={{ marginBottom: 1 }}>{renderInlineMd(line)}</div>
  })
}

function AITab() {
  type Msg = { role: 'user' | 'assistant'; content: string; ts: number }
  const [messages,   setMessages]   = useState<Msg[]>([])
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [context,    setContext]    = useState('')
  const [ctxLoading, setCtxLoading] = useState(true)
  const [copied,     setCopied]     = useState<number | null>(null)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const briefingSent = useRef(false)

  const PRESETS = [
    '🔥 วิเคราะห์ภาพรวมวันนี้',
    '📉 อะไรที่ต้องแก้ไขด่วน?',
    '💰 จะเพิ่มรายได้ยังไง?',
    '🛒 สั่งซื้อวัตถุดิบอะไรดี?',
    '👥 ทีมงานเป็นยังไงบ้าง?',
    '📅 วางแผนสัปดาห์หน้า',
  ]

  useEffect(() => {
    async function loadCtx() {
      const now     = new Date()
      const today   = now.toLocaleDateString('en-CA',  { timeZone: 'Asia/Vientiane' })
      const timeStr = now.toLocaleTimeString('th-TH',  { timeZone: 'Asia/Vientiane', hour: '2-digit', minute: '2-digit' })
      const dayName = now.toLocaleDateString('th-TH',  { timeZone: 'Asia/Vientiane', weekday: 'long' })
      const dow     = now.toLocaleDateString('en-US',  { timeZone: 'Asia/Vientiane', weekday: 'short' })
      const isWeekend = dow === 'Sat' || dow === 'Sun'

      const [sRes, mRes, sdRes, stRes, saRes, cfRes, qRes] = await Promise.all([
        supabase.rpc('get_dashboard_stats'),
        supabase.rpc('get_menu_performance', { p_days: 30 }),
        supabase.rpc('get_stock_detail'),
        supabase.rpc('get_staff_today_status'),
        supabase.rpc('get_staff_analytics'),
        supabase.rpc('get_cashflow_summary', { p_days: 30 }),
        supabase.rpc('get_queue_performance', { p_days: 1 }),
      ])

      const stats      = sRes.data  as ExtDashStats   | null
      const menu       = (mRes.data as MenuPerf[]    ) ?? []
      const stock      = (sdRes.data as StockDetail[] ) ?? []
      const staffToday = (stRes.data as StaffToday[]  ) ?? []
      const staffAna   = (saRes.data as StaffAnalytics[]) ?? []
      const cashflow   = (cfRes.data as CashflowRow[] ) ?? []
      const queue      = qRes.data  as QueuePerf      | null

      const todaySales     = stats?.today_sales     ?? 0
      const yesterdaySales = stats?.yesterday_sales ?? 0
      const vsYesterday    = yesterdaySales > 0
        ? ((todaySales - yesterdaySales) / yesterdaySales * 100).toFixed(1)
        : 'N/A'
      const profitPct = todaySales > 0
        ? ((stats?.today_profit ?? 0) / todaySales * 100).toFixed(1)
        : '0'

      const top10      = menu.slice(0, 10)
      const bottom5    = [...menu].reverse().slice(0, 5)
      const lowStock   = stock.filter(s => s.reorder_point != null && s.current_qty <= s.reorder_point)
      const presentStaff = staffToday.filter(s => s.clock_in)
      const lateStaff    = staffToday.filter(s => s.late_minutes && s.late_minutes > 0)
      const topPerformer = [...staffAna].sort((a, b) => b.orders_served - a.orders_served)[0]
      const revenue30    = cashflow.reduce((sum, r) => sum + (r.system_sales ?? 0), 0)

      const lines = [
        `=== ALAN CAFE — BUSINESS INTELLIGENCE REPORT ===`,
        `วันที่: ${today} (${dayName})${isWeekend ? ' [วันหยุดสุดสัปดาห์]' : ' [วันธรรมดา]'}`,
        `เวลา: ${timeStr} ICT (Vientiane)`,
        ``,
        `=== ยอดขายวันนี้ ===`,
        `ยอดขาย: ${todaySales.toLocaleString()} LAK`,
        `เมื่อวาน: ${yesterdaySales.toLocaleString()} LAK (เปลี่ยนแปลง: ${vsYesterday}%)`,
        `Orders: ${stats?.today_orders ?? 0} รายการ | Items: ${stats?.today_items ?? 0}`,
        `กำไรขั้นต้น: ${(stats?.today_profit ?? 0).toLocaleString()} LAK (${profitPct}%)`,
        ``,
        `=== เมนูขายดีสุด 30 วัน — Top 10 ===`,
        ...top10.map((m, i) =>
          `${i + 1}. ${m.product_name}: ${m.total_qty}แก้ว | ${m.total_sales.toLocaleString()}LAK | Margin ${m.margin_pct?.toFixed(1) ?? 'N/A'}%`
        ),
        ``,
        `=== เมนูขายน้อย — Bottom 5 (ผู้สมัครถูกตัดออก) ===`,
        ...bottom5.map((m, i) =>
          `${i + 1}. ${m.product_name}: ${m.total_qty}แก้ว | ${m.total_sales.toLocaleString()}LAK | Margin ${m.margin_pct?.toFixed(1) ?? 'N/A'}%`
        ),
        ``,
        `=== สต็อกวิกฤต (ต่ำกว่า Reorder Point) ===`,
        lowStock.length > 0
          ? lowStock.map(s =>
              `- ${s.name}: ${s.current_qty}${s.unit} / reorder:${s.reorder_point} | หมดใน ~${s.days_until_empty ?? '?'} วัน | ซัพพลายเออร์: ${s.supplier ?? 'ไม่มี'}`
            ).join('\n')
          : 'สต็อกทุกรายการอยู่ในระดับปกติ',
        ``,
        `=== พนักงานวันนี้ ===`,
        `เข้างาน: ${presentStaff.length} / ${staffToday.length} คน`,
        lateStaff.length > 0
          ? `มาสาย: ${lateStaff.map(s => `${s.name_th ?? s.name} (${s.late_minutes}นาที)`).join(', ')}`
          : 'ไม่มีพนักงานมาสาย',
        topPerformer
          ? `Top performer 30วัน: ${topPerformer.name_th ?? topPerformer.name} — ${topPerformer.orders_served} orders, ${topPerformer.punctuality_pct?.toFixed(0)}% punctuality`
          : '',
        ``,
        `=== คิว ===`,
        queue
          ? `Peak hour: ${queue.peak_hour}:00 | Orders/ชั่วโมง: ${queue.orders_per_hour?.toFixed(1)}`
          : 'ไม่มีข้อมูลคิววันนี้',
        ``,
        `=== Finance 30 วัน ===`,
        `รายได้รวม 30วัน: ${revenue30.toLocaleString()} LAK`,
        `รายได้เฉลี่ย/วัน: ${Math.round(revenue30 / 30).toLocaleString()} LAK`,
      ]

      setContext(lines.filter(l => l !== undefined).join('\n'))
      setCtxLoading(false)
    }
    void loadCtx()
  }, [])

  // Proactive morning briefing — fires once after context loads
  useEffect(() => {
    if (!ctxLoading && !briefingSent.current) {
      briefingSent.current = true
      void ask('สวัสดีครับ! ช่วยสรุปสถานการณ์ Alan Cafe วันนี้แบบครบถ้วน — ยอดขาย สต็อกวิกฤต และ 3 สิ่งที่ต้องทำด่วนวันนี้')
    }
  }, [ctxLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function ask(question: string) {
    if (!question.trim() || loading) return
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(m => [...m, { role: 'user', content: question, ts: Date.now() }])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context, history }),
      })
      const json = await res.json()
      const answer = json.content?.[0]?.text
        ?? (typeof json.error === 'string' ? json.error : JSON.stringify(json.error))
        ?? 'เกิดข้อผิดพลาด'
      setMessages(m => [...m, { role: 'assistant', content: answer, ts: Date.now() }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'ไม่สามารถเชื่อมต่อ Alan AI ได้ กรุณาลองใหม่', ts: Date.now() }])
    }
    setLoading(false)
  }

  function copyMsg(content: string, idx: number) {
    navigator.clipboard.writeText(content).catch(() => null)
    setCopied(idx)
    setTimeout(() => setCopied(null), 1500)
  }

  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', gap: 14 }}>

      {/* Status + clear bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderRadius: 9, backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: ctxLoading ? ORANGE : GREEN, flexShrink: 0, boxShadow: `0 0 5px ${ctxLoading ? ORANGE : GREEN}` }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {ctxLoading ? 'กำลังโหลดข้อมูลธุรกิจ...' : 'Alan AI พร้อม — ข้อมูล real-time 7 แหล่งโหลดแล้ว'}
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); briefingSent.current = false }}
            style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px' }}
          >
            ล้างประวัติ ✕
          </button>
        )}
      </div>

      {/* Preset smart questions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PRESETS.map(p => (
          <button
            key={p}
            onClick={() => void ask(p)}
            disabled={loading || ctxLoading}
            style={{
              padding: '7px 13px', borderRadius: 99, border: `1px solid ${GOLD}44`,
              backgroundColor: `${GOLD}10`, color: GOLD, fontSize: 12, fontWeight: 600,
              cursor: loading || ctxLoading ? 'not-allowed' : 'pointer',
              opacity: ctxLoading ? 0.5 : 1, transition: 'opacity .15s',
            }}
          >{p}</button>
        ))}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            {/* Avatar */}
            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, backgroundColor: m.role === 'user' ? `${GOLD}22` : '#1a1a1a', border: `1px solid ${m.role === 'user' ? GOLD + '66' : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
              {m.role === 'user' ? '👤' : '🤖'}
            </div>
            {/* Bubble column */}
            <div style={{ maxWidth: '78%' }}>
              {/* Name + timestamp */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: m.role === 'user' ? GOLD : 'rgba(255,255,255,0.5)' }}>
                  {m.role === 'user' ? 'คุณ' : 'Alan AI'}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>{fmtTime(m.ts)}</span>
              </div>
              {/* Bubble */}
              <div style={{ padding: '11px 15px', borderRadius: m.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px', backgroundColor: m.role === 'user' ? `${GOLD}14` : CARD, border: `1px solid ${m.role === 'user' ? GOLD + '33' : BORDER}`, fontSize: 13, lineHeight: 1.8, color: m.role === 'user' ? GOLD : 'rgba(255,255,255,0.85)' }}>
                {m.role === 'assistant' ? renderMdContent(m.content) : m.content}
              </div>
              {/* Copy button — assistant only */}
              {m.role === 'assistant' && (
                <button
                  onClick={() => copyMsg(m.content, i)}
                  style={{ marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                >
                  {copied === i ? '✓ คัดลอกแล้ว' : '📋 คัดลอก'}
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: '#1a1a1a', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>🤖</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Alan AI</div>
              <div style={{ padding: '12px 16px', borderRadius: '4px 14px 14px 14px', backgroundColor: CARD, border: `1px solid ${BORDER}`, display: 'flex', gap: 6, alignItems: 'center' }}>
                {[0, 1, 2].map(j => (
                  <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: GOLD, animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite` }} />
                ))}
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>Alan กำลังคิด...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(input) } }}
          placeholder={ctxLoading ? 'กำลังโหลดข้อมูลธุรกิจ...' : 'ถาม Alan เกี่ยวกับธุรกิจร้านคุณ...'}
          disabled={loading || ctxLoading}
          style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: `1px solid ${GOLD}44`, backgroundColor: CARD, color: '#fff', fontSize: 14, outline: 'none' }}
        />
        <button
          onClick={() => void ask(input)}
          disabled={loading || !input.trim() || ctxLoading}
          style={{ padding: '12px 22px', borderRadius: 10, border: 'none', backgroundColor: GOLD, color: '#000', fontWeight: 700, fontSize: 14, cursor: loading || !input.trim() || ctxLoading ? 'not-allowed' : 'pointer', opacity: loading || !input.trim() || ctxLoading ? 0.6 : 1 }}
        >
          ถาม
        </button>
      </div>
    </div>
  )
}"""

content = content[:start_idx] + NEW_SECTION + content[end_idx:]
with open(target, 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Done. Spliced {len(NEW_SECTION)} chars at position {start_idx}')
