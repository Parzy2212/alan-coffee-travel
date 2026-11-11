const GOLD = '#c9a84c'

export function MovedNotice({ title, reason, links }: {
  title: string
  reason: string
  links: { href: string; label: string }[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>{title}</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, maxWidth: 520 }}>{reason}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {links.map(l => (
          <a key={l.href} href={l.href} style={{
            padding: '10px 18px', borderRadius: 10, border: `1px solid ${GOLD}55`,
            backgroundColor: `${GOLD}14`, color: GOLD, fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>{l.label} →</a>
        ))}
      </div>
    </div>
  )
}
