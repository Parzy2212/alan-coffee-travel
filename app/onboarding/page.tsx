'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { WelcomeSplash } from '@/components/onboarding/WelcomeSplash'
import { PersonaSelect, type Persona } from '@/components/onboarding/PersonaSelect'
import { ShopIdentity } from '@/components/onboarding/ShopIdentity'
import { SampleMenu, SAMPLE_ITEMS, type CustomItem } from '@/components/onboarding/SampleMenu'
import { PrinterSetup, type PrinterPath } from '@/components/onboarding/PrinterSetup'
import { Celebration } from '@/components/onboarding/Celebration'

// ─── Keyframes injected once ────────────────────────────────────────────────
const STYLES = `
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(36px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-36px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes checkIn {
    from { transform: scale(0); }
    to   { transform: scale(1); }
  }
  @keyframes celebCheck {
    from { opacity: 0; transform: scale(0.6); }
    to   { opacity: 1; transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    @keyframes slideInRight { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideInLeft  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes checkIn      { from {} to {} }
    @keyframes celebCheck   { from { opacity: 0; } to { opacity: 1; } }
  }
  input[type=number]::-webkit-outer-spin-button,
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; }
`

// Step 0 = welcome splash, 1–4 = wizard steps, 5 = celebration
type Screen = 0 | 1 | 2 | 3 | 4 | 5

const STEP_LABELS = ['คุณเป็นใคร?', 'ข้อมูลร้าน', 'เมนูเริ่มต้น', 'เครื่องพิมพ์']

// ─── Page ────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [user, authLoading, router])

  // ── Screen state ────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')

  const goTo = (next: Screen) => {
    setDirection(next > screen ? 'forward' : 'back')
    setScreen(next)
  }

  // ── Wizard state ────────────────────────────────────────────────────────
  const [persona, setPersona] = useState<Persona>('owner')
  const [shopName, setShopName] = useState('Alan Coffee & Travel')
  const [city, setCity] = useState('Vientiane')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(['1', '2', '3']))
  const [customItems, setCustomItems] = useState<CustomItem[]>([])
  const [printerPath, setPrinterPath] = useState<PrinterPath | null>(null)

  // ── Save state ──────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Final save ──────────────────────────────────────────────────────────
  const saveAndFinish = async () => {
    setSaving(true)
    setSaveError(null)

    try {
      const { authClient } = await import('@/lib/supabase-auth')
      const { data: { user: currentUser } } = await authClient.auth.getUser()

      if (!currentUser) {
        router.replace('/login')
        return
      }

      // Build slug from shop name
      const baseSlug = shopName.trim().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 40) || 'my-cafe'

      // Idempotent re-run check: does the CURRENT USER already own a shop with this slug?
      // (e.g. they refreshed mid-wizard and are redoing onboarding) — only ever matches
      // a shop this user already owns, never an unrelated shop that happens to share a slug.
      const { data: ownedShops } = await authClient
        .from('shop_users')
        .select('shop_id')
        .eq('user_id', currentUser.id)
        .eq('role', 'owner')

      let shopId: string | null = null
      if (ownedShops && ownedShops.length > 0) {
        const { data: matchingShop } = await authClient
          .from('shops')
          .select('id')
          .eq('slug', baseSlug)
          .in('id', ownedShops.map(s => s.shop_id))
          .maybeSingle()
        if (matchingShop?.id) shopId = matchingShop.id
      }

      let slug = baseSlug

      if (shopId) {
        await authClient.from('shops').update({ name: shopName.trim(), city }).eq('id', shopId)
      } else {
        // Never attach to someone else's shop just because the slug collides —
        // disambiguate and create a fresh shop instead.
        const { data: collision } = await authClient
          .from('shops')
          .select('id')
          .eq('slug', slug)
          .maybeSingle()
        if (collision?.id) {
          slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`
        }

        const { data: newShop, error: shopErr } = await authClient
          .from('shops')
          .insert({
            slug,
            name: shopName.trim(),
            owner_email: currentUser.email,
            city,
            country: 'Laos',
            currency: 'LAK',
            language: 'th',
            plan: 'free',
            status: 'active',
          })
          .select('id')
          .single()

        if (shopErr) throw shopErr
        shopId = newShop.id
      }

      // Link user to shop as owner
      await authClient.from('shop_users').upsert({
        shop_id: shopId,
        user_id: currentUser.id,
        email: currentUser.email!,
        role: 'owner',
        full_name: currentUser.user_metadata?.full_name ?? null,
        accepted_at: new Date().toISOString(),
        active: true,
      }, { onConflict: 'shop_id,email' })

      // Insert selected menu items (non-fatal if table not ready yet)
      const allItems = [
        ...SAMPLE_ITEMS.filter(item => selectedIds.has(item.id)),
        ...customItems,
      ]

      if (allItems.length > 0) {
        const { error: menuErr } = await authClient.from('recipes').insert(
          allItems.map(item => ({
            product_name: item.name,
            price_lak: item.price,
            is_active: true,
            shop_id: shopId,
          }))
        )
        if (menuErr) console.error('[Onboarding] recipes insert error (non-fatal):', menuErr)
      }

      console.log('[Onboarding] Setup complete → shop:', slug, '| menu items:', allItems.length)
      router.replace('/cafe')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[Onboarding] saveAndFinish error:', msg)
      setSaveError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      setSaving(false)
    }
  }

  // Defined before any early return (Rules of Hooks). Screen 0 always advances to 1.
  const handleWelcomeComplete = useCallback(() => {
    setDirection('forward')
    setScreen(1)
  }, [])

  // ─── Loading / auth gate ─────────────────────────────────────────────────
  if (authLoading) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>กำลังโหลด...</div>
      </main>
    )
  }

  // ─── Screen 0: Welcome splash (fullscreen, no chrome) ────────────────────
  if (screen === 0) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <WelcomeSplash onComplete={handleWelcomeComplete} />
      </main>
    )
  }

  // ─── Screen 5: Celebration (fullscreen, centered) ────────────────────────
  if (screen === 5) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <style>{STYLES}</style>
        <Celebration
          shopName={shopName}
          menuCount={selectedIds.size + customItems.length}
          printerSetup={printerPath === 'setup'}
          onDone={saveAndFinish}
          saving={saving}
          error={saveError}
          onRetry={saveAndFinish}
        />
      </main>
    )
  }

  // ─── Screens 1–4: Wizard card layout ─────────────────────────────────────
  const stepIndex = (screen as number) - 1  // 0..3
  const progressPct = (stepIndex + 1) / 4 * 100

  return (
    <main style={{
      minHeight: '100vh', backgroundColor: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <style>{STYLES}</style>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 24, flexShrink: 0 }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, color: '#c9a84c', letterSpacing: '-0.3px' }}>
            ALAN
          </span>
          <span style={{ color: 'rgba(201,168,76,0.4)', fontSize: 11, letterSpacing: '3px', fontWeight: 600, marginLeft: 6 }}>
            CafeOS
          </span>
        </a>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 480, marginBottom: 20, flexShrink: 0 }}>
        <div style={{ height: 4, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99, backgroundColor: '#c9a84c',
            width: `${progressPct}%`, transition: 'width 0.4s ease-out',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{STEP_LABELS[stepIndex]}</span>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>{screen}/4</span>
        </div>
      </div>

      {/* Card with slide transition */}
      <div
        key={screen}
        style={{
          width: '100%', maxWidth: 480,
          backgroundColor: '#111',
          border: '1px solid rgba(201,168,76,0.12)',
          borderRadius: 20, padding: '32px 28px',
          animation: `${direction === 'forward' ? 'slideInRight' : 'slideInLeft'} 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both`,
        }}
      >
        {screen === 1 && (
          <PersonaSelect
            value={persona}
            onChange={setPersona}
            onNext={() => goTo(2)}
          />
        )}

        {screen === 2 && (
          <ShopIdentity
            shopName={shopName}
            onShopNameChange={setShopName}
            city={city}
            onCityChange={setCity}
            onNext={() => goTo(3)}
            onBack={() => goTo(1)}
          />
        )}

        {screen === 3 && (
          <SampleMenu
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            customItems={customItems}
            onCustomItemsChange={setCustomItems}
            onNext={() => goTo(4)}
            onSkip={() => {
              setSelectedIds(new Set())
              setCustomItems([])
              goTo(4)
            }}
            onBack={() => goTo(2)}
          />
        )}

        {screen === 4 && (
          <PrinterSetup
            printerPath={printerPath}
            onPathChange={setPrinterPath}
            shopName={shopName}
            onNext={() => goTo(5)}
            onBack={() => goTo(3)}
          />
        )}
      </div>
    </main>
  )
}
