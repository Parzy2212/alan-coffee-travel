'use client'

const PINNED_KEY   = 'pos_pinned_recipes'
const TIPS_KEY     = 'alan_show_tips'

export function getPinnedRecipes(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PINNED_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch { return [] }
}

export function setPinnedRecipes(ids: string[]): void {
  try { localStorage.setItem(PINNED_KEY, JSON.stringify(ids)) } catch {}
}

export function togglePinnedRecipe(id: string): string[] {
  const cur  = getPinnedRecipes()
  const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
  setPinnedRecipes(next)
  return next
}

export function isShowTips(): boolean {
  if (typeof window === 'undefined') return true
  try { return localStorage.getItem(TIPS_KEY) !== 'false' } catch { return true }
}

export function setShowTips(v: boolean): void {
  try { localStorage.setItem(TIPS_KEY, String(v)) } catch {}
}
