import type { Lang } from '@/contexts/LanguageContext'

type MenuItem = {
  product_name: string
  product_name_th?: string | null
  product_name_lo?: string | null
}

export function getMenuName(item: MenuItem, lang: Lang): string {
  if (lang === 'th' && item.product_name_th) return item.product_name_th
  if (lang === 'lo' && item.product_name_lo) return item.product_name_lo
  return item.product_name
}
