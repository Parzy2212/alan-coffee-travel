'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getInvitationDetails, acceptInvitation, roleLabel, isExpired, type InvitationDetails } from '@/lib/invitations'
import { RoleBadge } from '@/components/shop/RoleBadge'

const GOLD = '#c9a84c'

const CARD: React.CSSProperties = {
  width: '100%', maxWidth: 440,
  backgroundColor: '#111',
  border: '1px solid rgba(201,168,76,0.15)',
  borderRadius: 20, padding: '40px 36px',
}

type PageState = 'loading' | 'invalid' | 'expired' | 'accepted' | 'mismatch' | 'ready' | 'accepting' | 'done'

export default function AcceptInvitePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [token,       setToken]       = useState('')
  const [inv,         setInv]         = useState<InvitationDetails | null>(null)
  const [pageState,   setPageState]   = useState<PageState>('loading')
  const [error,       setError]       = useState('')

  // Read token from URL on client
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token') ?? ''
    setToken(t)
  }, [])

  // Load invitation details once we have the token
  useEffect(() => {
    if (!token) return
    getInvitationDetails(token).then(details => {
      setInv(details)
      if (!details.found) { setPageState('invalid'); return }
      if (details.status === 'accepted') { setPageState('accepted'); return }
      if (details.status === 'revoked' || details.status === 'expired') { setPageState('expired'); return }
      if (details.expires_at && isExpired(details.expires_at)) { setPageState('expired'); return }
      setPageState('ready')
    })
  }, [token])

  // Once auth is known and invitation is ready, check email match
  useEffect(() => {
    if (pageState !== 'ready' || authLoading) return
    if (!user || !inv?.email) return
    if (user.email?.toLowerCase() !== inv.email.toLowerCase()) {
      setPageState('mismatch')
    }
  }, [pageState, user, inv, authLoading])

  const handleAccept = async () => {
    if (!user || !token) return
    setPageState('accepting')
    const result = await acceptInvitation(token, user.id)
    if (!result.success) {
      setError(result.error ?? 'เกิดข้อผิดพลาด')
      setPageState('ready')
      return
    }
    setPageState('done')
    setTimeout(() => router.replace('/cafe'), 2000)
  }

  const Logo = () => (
    <div style={{ textAlign: 'center', marginBottom: 40 }}>
      <a href="/" style={{ textDecoration: 'none' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: GOLD, fontFamily: 'var(--font-heading)', letterSpacing: '-0.5px' }}>
          ALAN <span style={{ color: 'rgba(201,168,76,0.5)', fontSize: 13, letterSpacing: '3px', fontWeight: 600 }}>CafeOS</span>
        </div>
      </a>
    </div>
  )

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <main style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Logo />
      <div style={CARD}>{children}</div>
      <a href="/" style={{ marginTop: 24, color: 'rgba(255,255,255,0.2)', fontSize: 12, textDecoration: 'none' }}>← กลับหน้าหลัก</a>
    </main>
  )

  // ── States ──────────────────────────────────────────────────────────────────

  if (pageState === 'loading' || (pageState === 'ready' && authLoading)) {
    return (
      <Wrapper>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>กำลังโหลด...</div>
        </div>
      </Wrapper>
    )
  }

  if (pageState === 'invalid') {
    return (
      <Wrapper>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 10 }}>ลิงก์ไม่ถูกต้อง</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.7 }}>ลิงก์คำเชิญนี้ไม่พบในระบบ กรุณาขอลิงก์ใหม่จากเจ้าของร้าน</div>
        </div>
      </Wrapper>
    )
  }

  if (pageState === 'expired') {
    return (
      <Wrapper>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏰</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 10 }}>คำเชิญหมดอายุแล้ว</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.7 }}>
            คำเชิญนี้{inv?.status === 'revoked' ? 'ถูกยกเลิก' : 'หมดอายุ'}แล้ว<br />กรุณาขอลิงก์ใหม่จากเจ้าของร้าน
          </div>
        </div>
      </Wrapper>
    )
  }

  if (pageState === 'accepted') {
    return (
      <Wrapper>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 10 }}>ยอมรับคำเชิญแล้ว</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>คำเชิญนี้ถูกยอมรับไปแล้ว</div>
          <a href="/cafe" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 10, backgroundColor: GOLD, color: '#000', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>ไปยังแดชบอร์ด</a>
        </div>
      </Wrapper>
    )
  }

  if (pageState === 'done') {
    return (
      <Wrapper>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#4cba7f', marginBottom: 10 }}>ยินดีต้อนรับเข้าสู่ {inv?.shop_name}!</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>กำลังพาไปยังแดชบอร์ด...</div>
        </div>
      </Wrapper>
    )
  }

  // Invitation info card (used in both logged-in and not-logged-in states)
  const InvCard = () => (
    <div style={{ backgroundColor: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12, padding: '16px 18px', marginBottom: 24 }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 8 }}>คำเชิญจาก {inv?.inviter_name}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: 'white', marginBottom: 8 }}>{inv?.shop_name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: inv?.message ? 10 : 0 }}>
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>ในฐานะ</span>
        <RoleBadge role={inv?.role ?? ''} />
      </div>
      {inv?.message && (
        <div style={{ marginTop: 10, padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6, fontStyle: 'italic' }}>
          &ldquo;{inv.message}&rdquo;
        </div>
      )}
    </div>
  )

  // NOT logged in — show login/signup options
  if (!user) {
    const q = `?invite=${encodeURIComponent(token)}`
    return (
      <Wrapper>
        <h1 style={{ color: 'white', fontWeight: 800, fontSize: 22, marginBottom: 6, fontFamily: 'var(--font-heading)' }}>คุณได้รับคำเชิญ</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24 }}>สมัครหรือเข้าสู่ระบบเพื่อเข้าร่วมทีม</p>
        <InvCard />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href={`/signup${q}`} style={{ display: 'block', padding: '13px', borderRadius: 10, backgroundColor: GOLD, color: '#000', fontSize: 15, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
            สมัครบัญชีใหม่
          </a>
          <a href={`/login${q}`} style={{ display: 'block', padding: '13px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>
            เข้าสู่ระบบ
          </a>
        </div>
        <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center' }}>
          คำเชิญนี้ส่งมาที่ <span style={{ color: 'rgba(255,255,255,0.5)' }}>{inv?.email}</span>
        </div>
      </Wrapper>
    )
  }

  // Email mismatch
  if (pageState === 'mismatch') {
    return (
      <Wrapper>
        <InvCard />
        <div style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ color: '#ff6b6b', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>อีเมลไม่ตรงกัน</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6 }}>
            คำเชิญนี้ส่งมาที่ <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{inv?.email}</strong><br />
            แต่คุณกำลังใช้งานด้วย <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{user.email}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={async () => { const { authClient } = await import('@/lib/supabase-auth'); await authClient.auth.signOut(); window.location.reload() }}
            style={{ padding: '12px', borderRadius: 10, border: 'none', backgroundColor: GOLD, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ออกจากระบบเพื่อใช้บัญชีอื่น
          </button>
          <a href="/cafe" style={{ display: 'block', padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: 14, textDecoration: 'none', textAlign: 'center' }}>
            ไปยังแดชบอร์ดของฉัน
          </a>
        </div>
      </Wrapper>
    )
  }

  // Logged in, email matches — show Accept button
  return (
    <Wrapper>
      <h1 style={{ color: 'white', fontWeight: 800, fontSize: 22, marginBottom: 6, fontFamily: 'var(--font-heading)' }}>คุณได้รับคำเชิญ</h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24 }}>
        เข้าร่วมในฐานะ {roleLabel(inv?.role ?? '')} ที่ {inv?.shop_name}
      </p>
      <InvCard />
      <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          ตอบรับในฐานะ <span style={{ color: 'rgba(255,255,255,0.7)' }}>{user.email}</span>
        </div>
      </div>
      {error && <div style={{ backgroundColor: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ff6b6b', fontSize: 13, marginBottom: 16 }}>{error}</div>}
      <button
        onClick={handleAccept}
        disabled={pageState === 'accepting'}
        style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', backgroundColor: pageState === 'accepting' ? 'rgba(201,168,76,0.4)' : GOLD, color: '#000', fontSize: 15, fontWeight: 700, cursor: pageState === 'accepting' ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
      >
        {pageState === 'accepting' ? 'กำลังตอบรับ...' : 'ตอบรับคำเชิญ'}
      </button>
    </Wrapper>
  )
}
