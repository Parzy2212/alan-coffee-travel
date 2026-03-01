/** Strip diacritical marks and lowercase */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Alias groups — any term in a group expands to all others.
 * Keys and values should already be normalized.
 */
const ALIAS_GROUPS: string[][] = [
  ['waterfall', 'nam tok', 'namtok', '\u0e19\u0e49\u0e33\u0e15\u0e01', 'tad', 'tat', 'falls'],
  ['temple', 'wat', '\u0e27\u0e31\u0e14', 'vat', 'pagoda', 'stupa', 'that'],
  ['cave', 'tham', '\u0e16\u0e49\u0e33'],
  ['mountain', 'phou', 'phu', '\u0e20\u0e39', 'hill', 'peak'],
  ['river', 'nam', 'mekong', 'mekhong', '\u0e41\u0e21\u0e48\u0e19\u0e49\u0e33', 'kong', 'stream'],
  ['lake', 'nong', '\u0e2b\u0e19\u0e2d\u0e07', 'reservoir'],
  ['forest', 'pa', '\u0e1b\u0e48\u0e32', 'jungle', 'wood'],
  ['market', 'talat', '\u0e15\u0e25\u0e32\u0e14'],
  ['village', 'ban', '\u0e1a\u0e49\u0e32\u0e19', 'baan'],
  ['beach', 'hat', '\u0e2b\u0e32\u0e14', 'sand'],
  ['plain', 'thung', '\u0e17\u0e38\u0e48\u0e07', 'plateau', 'field'],
  ['garden', 'suan', '\u0e2a\u0e27\u0e19', 'park'],
]

/** Build a lookup: normalized term → all synonyms in its group */
const ALIAS_MAP = new Map<string, string[]>()
for (const group of ALIAS_GROUPS) {
  const normalized = group.map(normalize)
  for (const term of normalized) {
    ALIAS_MAP.set(term, normalized)
  }
}

/** Expand a raw query string into all synonym variants */
function expandQuery(query: string): string[] {
  const nq = normalize(query)
  const expanded = new Set<string>([nq])

  // Check each alias key — if query contains or equals it, add the whole group
  for (const [key, synonyms] of ALIAS_MAP) {
    if (nq.includes(key) || key.includes(nq)) {
      synonyms.forEach(s => expanded.add(s))
    }
  }

  return Array.from(expanded).filter(Boolean)
}

/** Iterative Levenshtein distance */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  // Prune: if length difference alone exceeds any reasonable threshold, skip
  if (Math.abs(m - n) > 4) return 99
  const prev = Array.from({ length: n + 1 }, (_, i) => i)
  const curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    prev.splice(0, n + 1, ...curr)
  }
  return prev[n]
}

/** Max allowed edit distance based on term length */
function editThreshold(len: number): number {
  if (len <= 2) return 0
  if (len <= 4) return 1
  if (len <= 7) return 2
  return 3
}

/** True if any of the expanded query terms matches the field */
function fieldMatches(field: string | null | undefined, terms: string[]): boolean {
  if (!field) return false
  const nf = normalize(field)
  const words = nf.split(/[\s,\-\/().]+/).filter(w => w.length > 1)

  for (const term of terms) {
    if (!term) continue

    // 1. Direct substring (handles partial word matches, e.g. "phouv" in "phouvong")
    if (nf.includes(term)) return true

    // 2. Fuzzy match against individual tokens in the field
    const maxDist = editThreshold(term.length)
    if (maxDist > 0) {
      for (const word of words) {
        if (levenshtein(term, word) <= maxDist) return true
      }
    }
  }

  return false
}

export type SearchableDestination = {
  title_en?: string | null
  title_lo?: string | null
  excerpt_en?: string | null
  excerpt_lo?: string | null
  description_en?: string | null
  region?: string | null
  district?: string | null
}

/** Main entry point — returns true if the destination matches the query */
export function matchesSearch(dest: SearchableDestination, query: string): boolean {
  if (!query.trim()) return true
  const terms = expandQuery(query)
  return (
    fieldMatches(dest.title_en, terms) ||
    fieldMatches(dest.title_lo, terms) ||
    fieldMatches(dest.excerpt_en, terms) ||
    fieldMatches(dest.excerpt_lo, terms) ||
    fieldMatches(dest.description_en, terms) ||
    fieldMatches(dest.region, terms) ||
    fieldMatches(dest.district, terms)
  )
}
