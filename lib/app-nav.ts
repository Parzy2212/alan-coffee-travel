// The one menu for the shop app (/cafe, /shop/*, POS ☰). Approved map 2026-11-11.
// Hidden until fixed (not listed): customers & loyalty, finance, Alan AI, audit log,
// Telegram/LINE, /shop/settings general, payment methods, printer, billing.

export type AppNavItem = {
  href: string
  label: string
  icon: string
  soloHidden?: boolean
}

export type AppNavGroup = { label: string; module?: boolean; items: AppNavItem[] }

export const APP_NAV: AppNavGroup[] = [
  { label: 'ขาย', items: [
    { href: '/pos', label: 'หน้าขาย', icon: '🛒' },
  ]},
  { label: 'ภาพรวม', items: [
    { href: '/cafe?tab=dashboard', label: 'ภาพรวมวันนี้', icon: '📊' },
    { href: '/owner',              label: 'ภาพรวม (มือถือ)', icon: '📱' },
  ]},
  { label: 'เมนู', items: [
    { href: '/cafe?tab=menu',       label: 'เมนู',     icon: '🍽️' },
    { href: '/cafe?tab=categories', label: 'หมวดหมู่', icon: '🗂️' },
  ]},
  { label: 'สต็อก', items: [
    { href: '/cafe?tab=stock',    label: 'วัตถุดิบ',             icon: '📦' },
    { href: '/cafe?tab=purchase', label: 'รับของเข้า / การซื้อ', icon: '🧾' },
  ]},
  { label: 'ทีมงาน', items: [
    { href: '/shop/team',           label: 'บัญชีและสิทธิ์', icon: '👥', soloHidden: true },
    { href: '/shop/team/employees', label: 'PIN หน้าขาย',   icon: '🏷️' },
  ]},
  { label: 'ตั้งค่า', items: [
    { href: '/cafe?tab=settings',       label: 'ข้อมูลร้าน & การรับเงิน', icon: '⚙️' },
    { href: '/shop/settings/receipt',   label: 'ใบเสร็จ',                icon: '🧾' },
    { href: '/shop/settings/currency',  label: 'สกุลเงิน',               icon: '💱' },
    { href: '/account/profile',         label: 'บัญชีของฉัน',            icon: '👤' },
  ]},
  { label: 'โมดูลเสริม', module: true, items: [
    { href: '/queue',                label: 'จอคิว TV',          icon: '📺' },
    { href: '/cafe?tab=staff',       label: 'พนักงาน & ลงเวลา', icon: '⏱️', soloHidden: true },
    { href: '/cafe?tab=schedule',    label: 'ตารางงาน',         icon: '📅', soloHidden: true },
    { href: '/staff',                label: 'จอลงเวลา (Kiosk)', icon: '🪪', soloHidden: true },
    { href: '/cafe?tab=recipe-cost', label: 'ต้นทุนสูตร',       icon: '🧮' },
    { href: '/cafe/templates',       label: 'ตั้งร้านด่วน',      icon: '⚡' },
    { href: '/cafe/health-check',    label: 'ตรวจความพร้อม',    icon: '✅' },
  ]},
]

export function cafeTabOf(href: string): string | null {
  const m = href.match(/^\/cafe\?tab=([a-z-]+)$/)
  return m ? m[1] : null
}

export const CAFE_TABS: string[] = APP_NAV.flatMap(g => g.items).map(i => cafeTabOf(i.href)).filter((t): t is string => !!t)

export function cafeTabLabel(tab: string): string | undefined {
  return APP_NAV.flatMap(g => g.items).find(i => cafeTabOf(i.href) === tab)?.label
}
