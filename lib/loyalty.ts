import type { VipTier, LoyaltySettings } from './customers'

// ── Default settings (match loyalty_settings table defaults) ──────────────────

export const DEFAULT_SETTINGS: Omit<LoyaltySettings, 'shop_id'> = {
  enabled:                   true,
  points_per_lak:            0.0001,      // 1 point per 10,000 LAK
  vip_silver_threshold:      500,
  vip_gold_threshold:        2000,
  vip_platinum_threshold:    5000,
  silver_discount_percent:   0,
  gold_discount_percent:     5,
  platinum_discount_percent: 10,
  birthday_discount_percent: 20,
}

// ── VIP metadata ──────────────────────────────────────────────────────────────

export type TierMeta = { label: string; icon: string; color: string }

export const TIER_META: Record<VipTier, TierMeta> = {
  regular:  { label: 'Regular',  icon: '',   color: 'rgba(255,255,255,0.4)' },
  silver:   { label: 'Silver',   icon: '⭐', color: '#c0c0c0' },
  gold:     { label: 'Gold',     icon: '👑', color: '#c9a84c' },
  platinum: { label: 'Platinum', icon: '💎', color: '#a0c4ff' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isBirthdayToday(birthday: string | null): boolean {
  if (!birthday) return false
  try {
    const today = new Date()
    const bday  = new Date(birthday)
    return bday.getMonth() === today.getMonth() && bday.getDate() === today.getDate()
  } catch { return false }
}

export function computePointsEarned(totalLak: number, settings?: Partial<LoyaltySettings> | null): number {
  const rate = settings?.points_per_lak ?? DEFAULT_SETTINGS.points_per_lak
  return Math.max(0, Math.floor(totalLak * rate))
}

export function getVipDiscountPct(tier: VipTier, settings?: Partial<LoyaltySettings> | null): number {
  if (tier === 'platinum') return settings?.platinum_discount_percent ?? DEFAULT_SETTINGS.platinum_discount_percent
  if (tier === 'gold')     return settings?.gold_discount_percent     ?? DEFAULT_SETTINGS.gold_discount_percent
  if (tier === 'silver')   return settings?.silver_discount_percent   ?? DEFAULT_SETTINGS.silver_discount_percent
  return 0
}

export function computeVipDiscount(subtotal: number, tier: VipTier, settings?: Partial<LoyaltySettings> | null): number {
  const pct = getVipDiscountPct(tier, settings)
  return pct > 0 ? Math.round(subtotal * pct / 100) : 0
}

export function resolveVipTier(points: number, settings?: Partial<LoyaltySettings> | null): VipTier {
  const s = settings ?? DEFAULT_SETTINGS
  if (points >= (s.vip_platinum_threshold ?? 5000)) return 'platinum'
  if (points >= (s.vip_gold_threshold     ?? 2000)) return 'gold'
  if (points >= (s.vip_silver_threshold   ?? 500))  return 'silver'
  return 'regular'
}

export function formatPoints(pts: number): string {
  return pts.toLocaleString('en-US') + ' pts'
}

export function fmtLastVisit(iso: string | null): string {
  if (!iso) return 'ไม่เคยมา'
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'วันนี้'
    if (days === 1) return 'เมื่อวาน'
    if (days < 7)  return `${days} วันที่แล้ว`
    if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ที่แล้ว`
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  } catch { return iso }
}
