/**
 * Alan Cafe OS — POS/back-office design tokens (black-gold theme).
 *
 * v1 collected 2026-08-31 by scanning every actual hex/rgba/fontSize/gap
 * value used across app/pos, app/cafe, app/staff, app/queue, app/owner,
 * app/shop, app/account and their components/* — NOT invented values.
 *
 * v2 (2026-09-02) applies Claude Design's "Design Tokens v2" canvas
 * (artifact ef83b998): collapses the old 6-step pure-white text scale into
 * 5 steps on a warm cream base (#f6f2e8, replacing #ffffff), adds a new
 * STATE_* token group (hover/pressed/disabled/focus/selected), and switches
 * FONT_BODY/FONT_HEADING from Inter to IBM Plex Sans Thai (native Thai/Lao
 * + Latin support in one family). BG scale, status colors, font-size scale,
 * spacing, and radius are unchanged from v1 — re-verified against the same
 * canvas, no drift.
 *
 * This file does NOT change any existing screen on its own — nothing
 * currently imports it. Existing files keep their local GOLD/CARD/BORDER
 * constants for now; swapping them over is a separate follow-up refactor.
 * New screens built from the Turn 1/Turn 2 designs should import from here.
 */

// ─── Brand gold (already the canonical values in app/globals.css) ─────────

export const GOLD       = '#c9a84c' // primary brand accent — 85 raw occurrences, fully consistent everywhere
export const GOLD_LIGHT = '#e8c97a' // hover / highlight state
export const GOLD_DARK  = '#a07830' // pressed / active state
export const GOLD_DIM   = '#c9a84c88' // gold at ~53% alpha, used for tinted fills (e.g. active nav pill)

// ─── Dark surface scale ────────────────────────────────────────────────────
// POS/back-office screens are dark-mode only; app/globals.css only defines
// --color-black (#0f0f0f) and --color-black-soft (#1a1a1a) for the whole
// site, so most of this scale did not exist as a shared token before now —
// every file rolled its own near-black hex.
//
// Legacy near-duplicates folded into this scale (found via grep, not used
// below): #141414 (OwnerClient CARD), #181818, #0d0d0d, #151515, #131313.

export const BG_VOID     = '#0a0a0a' // outermost app/page background
export const BG_BASE     = '#0f0f0f' // secondary base layer (= --color-black)
export const BG_SURFACE  = '#111111' // large panels, sidebars (e.g. queue TV sidebar)
export const BG_CARD     = '#161616' // default card background (components/cafe/shared.tsx CARD)
export const BG_CARD_ALT = '#1a1a1a' // alt card / input background (= --color-black-soft)
export const BG_ELEVATED = '#1e1e1e' // hover / elevated state on top of a card

// ─── Borders ────────────────────────────────────────────────────────────────
// Legacy near-duplicates found for the gold border alone: rgba(201,168,76,0.14)
// (OwnerClient), 0.15 (shared.tsx — picked as canonical), 0.18 (StaffClient).

export const BORDER_GOLD    = 'rgba(201,168,76,0.15)' // card/section borders on dark surfaces
export const BORDER_DEFAULT = 'rgba(255,255,255,0.1)' // neutral input/divider border — most common (121 occurrences)
export const BORDER_SUBTLE  = 'rgba(255,255,255,0.06)' // faint divider, e.g. between list rows

// ─── Text on dark backgrounds — v2 (5-step, warm cream base) ───────────────
// v1 had 6 steps of white-opacity text collapsed from 30+ distinct raw
// values; v2 re-bases everything on a warm cream (#f6f2e8) instead of pure
// white — softer, warmer against the gold accent, less "cold SaaS." Old v1
// exports (TEXT_PRIMARY..TEXT_DISABLED, HOVER_OVERLAY) are kept below,
// unchanged, for any code still reading them — TEXT_1..TEXT_5 are the ones
// to use going forward.

export const CREAM = '#f6f2e8' // warm white base — replaces #ffffff everywhere in v2

export const TEXT_1 = CREAM                        // headings, money, item names — collapsed from #fff/.95/.9
export const TEXT_2 = 'rgba(246,242,232,0.62)'      // body copy, descriptions — collapsed from .55–.7 (8 values)
export const TEXT_3 = 'rgba(246,242,232,0.40)'      // labels, column headers, meta — collapsed from .35–.45 (201 occurrences)
export const TEXT_4 = 'rgba(246,242,232,0.26)'      // placeholder, secondary/deemphasized text — collapsed from .2–.3 (6 values)
export const TEXT_5 = 'rgba(246,242,232,0.16)'      // disabled text, text-level dividers — collapsed from .1–.2

/** @deprecated v1 pure-white scale — use TEXT_1 instead */
export const TEXT_PRIMARY   = '#ffffff'
/** @deprecated v1 pure-white scale — use TEXT_2 instead */
export const TEXT_SECONDARY = 'rgba(255,255,255,0.6)'
/** @deprecated v1 pure-white scale — use TEXT_3 instead */
export const TEXT_TERTIARY  = 'rgba(255,255,255,0.4)'
/** @deprecated v1 pure-white scale — use TEXT_3 instead */
export const TEXT_MUTED     = 'rgba(255,255,255,0.35)'
/** @deprecated v1 pure-white scale — use TEXT_4 instead */
export const TEXT_FAINT     = 'rgba(255,255,255,0.25)'
/** @deprecated v1 pure-white scale — use TEXT_5 instead */
export const TEXT_DISABLED  = 'rgba(255,255,255,0.2)'

export const HOVER_OVERLAY = 'rgba(255,255,255,0.04)' // hover/active background wash on dark rows (118 occurrences) — unchanged in v2, kept white (not cream) since it's a background wash, not text

// ─── State tokens — new in v2 ───────────────────────────────────────────────
// Previously ad hoc per-component; now a named group so hover/pressed/focus/
// selected states are consistent across every new screen.

export const STATE_HOVER             = 'rgba(255,255,255,0.04)' // same value as HOVER_OVERLAY — background wash on hover
export const STATE_PRESSED           = 'rgba(0,0,0,0.30)'       // background wash on press/active
export const STATE_DISABLED_OPACITY  = 0.45                     // opacity multiplier applied to disabled controls
export const STATE_FOCUS_RING        = `2px solid ${GOLD}`      // focus-visible outline — pair with 2px offset; never leave the browser's default blue ring
export const STATE_SELECTED_BG       = 'rgba(201,168,76,0.12)'  // selected row/tab/option background
export const STATE_SELECTED_BORDER   = 'rgba(201,168,76,0.45)'  // selected row/tab/option border

// ─── Status colors ──────────────────────────────────────────────────────────
// SUCCESS is fully consistent (#4cba7f, 50 occurrences, no conflicting value
// anywhere). DANGER and WARNING each have two competing values in the wild —
// picked the majority one as canonical; the other is flagged as legacy so a
// future pass knows which files to reconcile.

export const SUCCESS = '#4cba7f' // consistent everywhere already

export const DANGER        = '#ff6b6b' // canonical — used in 22 files / 46 occurrences (POSClient, components/shop/*, HealthCheck, Owner, import, templates)
export const DANGER_LEGACY = '#ff4d4d' // minority value — used in components/cafe/shared.tsx, CafeClient, StaffClient, StockTab, shop/audit-log, shop/team (7 files / 13 occurrences)

export const WARNING        = '#f59e0b' // canonical — standard amber, used in POSClient, HealthCheck, Owner, HttpBanner, TestModeBanner
export const WARNING_LEGACY = '#ff9933' // minority value — used in components/cafe/shared.tsx, CafeClient, StaffClient, StockTab

// Intentional exception to the black-gold palette — NOT a stray/off-brand
// value to be cleaned up. Confirmed 2026-08-31: keep this blue for cold-drink
// iconography rather than forcing it into gold/neutral. Used in
// CafeClient.tsx (~1430) and RecipeCostTab.tsx for "cold drink / ice" icons.
export const COLOR_ACCENT_COLD = '#4a9eff'

// ─── Typography ─────────────────────────────────────────────────────────────
// v2: FONT_HEADING/FONT_BODY switch from Inter to IBM Plex Sans Thai — one
// family covering Thai/Lao/Latin natively instead of falling back to the
// separate --font-thai/--font-lao CSS vars the rest of the site uses. Not
// yet loaded via next/font/google anywhere — the screen(s) that first
// import this token file need to add that font loading themselves (see
// app/layout.tsx for the existing next/font pattern to follow). Falls back
// to the site's existing --font-body var so nothing breaks before that
// font is actually loaded.

export const FONT_HEADING = "'IBM Plex Sans Thai', var(--font-heading), sans-serif"
export const FONT_BODY    = "'IBM Plex Sans Thai', var(--font-body, Inter, sans-serif)"
export const FONT_MONO    = "'JetBrains Mono', monospace" // receipt totals, PIN pads, numeric displays, reference numbers — was plain 'monospace' in v1

// Font-size scale. Real usage today is near-continuous (every integer 9–20px
// plus a handful of large display sizes) — this is the cleanest scale that
// covers the actual frequency peaks; treat 9/15/17/26/28/30/40/52px one-offs
// found in the codebase as strays to retire onto this scale, not additions.
export const FONT_SIZE = {
  xs: 11,      // metadata, badges (290 occurrences)
  sm: 12,      // secondary labels (343 — 2nd most common size in the app)
  base: 13,    // default body/button text (345 — most common size in the app)
  md: 14,      // form inputs, emphasized body text (201)
  lg: 16,      // subheadings, KPI sublabels (53)
  xl: 18,      // card titles (44)
  '2xl': 20,   // section headings (43)
  '3xl': 24,   // dashboard headline numbers
  '4xl': 32,   // hero/large KPI numbers
} as const

// Font-weight scale — this one was already clean in the source (only 6
// distinct values in real use).
export const FONT_WEIGHT = {
  regular:   400,
  medium:    500,
  semibold:  600, // most common for buttons/labels (186)
  bold:      700, // most common overall (283) — used for values/headings
  extrabold: 800, // hero numbers, page titles
} as const

// ─── Spacing scale (px) ─────────────────────────────────────────────────────
// Reflects actual `gap`/`padding` values in use, not a theoretical 4px grid —
// 6px and 10px are both heavily used in the real code, so both are kept as
// steps rather than forced onto 4/8/12.

export const SPACE = {
  1: 4,
  2: 6,
  3: 8,   // 121 occurrences as `gap`
  4: 10,  // 142 occurrences as `gap` — most common gap value in the app
  5: 12,
  6: 16,
  7: 20,
  8: 24,
  9: 32,
  10: 40,
} as const

// ─── Border radius scale (px) ───────────────────────────────────────────────
// 7/9/10 collapse into the 8/10/12 steps below as near-duplicates; 4 and
// 18/20 are kept as distinct real steps (small chips vs. pill buttons).

export const RADIUS = {
  sm:   6,
  md:   8,   // most common overall (174 occurrences) — default buttons/inputs
  lg:   10,
  xl:   12,  // cards
  '2xl': 14, // section cards (SectionCard in shared.tsx)
  '3xl': 16, // large modals/sheets
  pill: 999, // toggle pills, floating action buttons
} as const

// ─── Shadows ────────────────────────────────────────────────────────────────

export const SHADOW_MODAL = '0 24px 64px rgba(0,0,0,0.7)'
export const SHADOW_CARD  = '0 4px 16px rgba(0,0,0,0.5)'
export const SHADOW_POPUP = '0 8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)'

// Status glow — pattern already used ad hoc as `0 0 5px ${color}` /
// `0 0 20px ${GOLD}22` for live indicators (e.g. staff clock-in dot,
// printer status). Kept as a helper since the glow color is always one of
// the status/gold constants above, not a fixed value.
export function glow(color: string, blurPx = 6): string {
  return `0 0 ${blurPx}px ${color}`
}

// ─── Rules every new screen must follow — v2 ────────────────────────────────
// 1. Gold is a line/text/glow color, never a wide solid fill — primary
//    buttons are a gold outline on a transparent/tinted background, not a
//    solid gold button.
// 2. Primary button = gold outline, transparent fill. Secondary button =
//    solid BG_CARD_ALT (#1a1a1a) fill, no colored border.
// 3. Elevate with a border + one step brighter background (e.g. BG_CARD ->
//    BG_ELEVATED), not heavy box-shadows.
// 4. Money, dates/times, and reference numbers always use FONT_MONO.
// 5. focus-visible is always a 2px gold ring (STATE_FOCUS_RING) — never
//    leave the browser's default blue outline.
// 6. COLOR_ACCENT_COLD (#4a9eff) is reserved for "cold drink / ice" meaning
//    only — not a general-purpose blue.
