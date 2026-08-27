# Alan Coffee & Travel — CLAUDE.md

> One repo, two products: **Alan Coffee & Travel** (travel website) and **Alan Cafe OS** (POS system).
> Last updated: 2026-08-27

---

## มาตรฐานคุณภาพงาน (อ่านทุกครั้งก่อนเริ่มงาน)

**ห้ามรายงานว่า "เสร็จแล้ว/แก้แล้ว" โดยไม่ได้พิสูจน์จริง** — ต้องทดสอบจริงเสมอก่อนสรุปผล
(เช่น เปิด browser ดูจริง รัน build จริง เช็ค cache/service worker ที่อาจหลอกผลลัพธ์)
ถ้าพิสูจน์ไม่ได้ด้วยเหตุผลอะไรก็ตาม ต้องบอกตรงๆ ว่า "ยังไม่ได้ทดสอบ" ไม่ใช่สมมติว่าถูก

**ก่อนสรุปงานทุกครั้ง ถามตัวเองว่า:** "ถ้าเป็นวิศวกรอาวุโสที่ละเอียดมากๆ มาดูงานนี้
เขาจะเช็คอะไรที่ฉันยังไม่ได้เช็ค" — คิดถึง edge case ที่ไม่มีใครพูดถึงตรงๆ
(เช่น หน้าจอเล็กมาก, ไม่มีอินเทอร์เน็ต, ข้อมูลว่างเปล่า, ผู้ใช้กดซ้ำเร็วๆ)

**แยกแยะ 2 อย่างให้ชัดในทุกงาน:**
1. สิ่งที่จำเป็นแต่ไม่มีใครขอ → เสนอให้ผู้ใช้ตัดสินใจ ก่อนลงมือทำเอง (ห้ามเงียบๆ เพิ่มเอง)
2. สิ่งที่ดูเหมือนจำเป็นแต่จริงๆ ไม่ใช่ (scope creep) → พูดตรงๆ ว่า "ไม่จำเป็นตอนนี้"
   แทนที่จะทำเผื่อไว้เกินขอบเขตงาน

**ทดสอบแบบ adversarial กับตัวเอง** — พยายามหาทางทำให้สิ่งที่เพิ่งแก้พังให้ได้ก่อนบอกว่าเสร็จ
ไม่ใช่แค่ทดสอบเคสที่คาดว่าจะผ่านอยู่แล้ว

**ก่อนรายงานว่า "เสร็จแล้ว" ทุกครั้งที่แก้โค้ดเสร็จ** ให้เรียก subagent `quality-reviewer`
(`.claude/agents/quality-reviewer.md`) ตรวจ diff แบบไม่มีอคติก่อนเสมอ โดยอัตโนมัติ ไม่ต้องรอสั่ง —
ส่ง context ของ request เดิมให้มันด้วย (มันเริ่มจาก context ว่างเปล่า อ่านแค่ git diff ไม่รู้ว่าขออะไรไว้)

---

## Stack

- **Next.js 15.3.9** — App Router, TypeScript, Tailwind CSS v4 (`@import "tailwindcss"`)
- **Supabase** — anon key only in `.env.local`; cannot run DDL from this client
- **Deployment (travel site)** — Vercel: https://alan-coffee-travel.vercel.app
- **Deployment (POS)** — Netlify (planned, not yet deployed)
- **Dev environment** — Windows 11; use Unix shell syntax in Bash tool

---

## CRITICAL: Cloudflare / Next.js Constraint

- Still uses `@cloudflare/next-on-pages@1.13.16` (deprecated)
- **Must migrate to `@opennextjs/cloudflare` BEFORE a *major* Next.js upgrade** — two PRs attempting that were closed (#2, #3). A minor/patch bump within 15.x does NOT require this migration first — confirmed twice (15.3.8, then 15.3.9), both times building successfully with `@cloudflare/next-on-pages@1.13.16` in a `node:20` container matching CI, and confirmed for real on the actual production deploy (see CVE line below).
- `export const runtime = 'edge'` is present in ~11-14 files (all `/api/*` routes, plus `destinations/[slug]`, `guides/[slug]`, `experiences/[slug]`). **This is fine — the rule banning it here was based on a mistaken premise, corrected 2026-08-27.** Per `nextjs.org/blog/CVE-2025-66478`: *"Next.js 13.x, Next.js 14.x stable, Pages Router applications, and the Edge Runtime are not affected."* The real risk is the Next.js version + App Router/RSC, not the runtime — no action needed on these files for this CVE family.
- **PATCHED 2026-08-27**: `main` is on Next.js **15.3.9** (via PR #17, squash-merged), closing out:
  - **CVE-2025-66478** (RCE, CVSS 10.0), **CVE-2025-55183** (source code exposure), **CVE-2025-55184** (DoS, High) — all fixed at 15.3.8 (`nextjs.org/blog/security-update-2025-12-11`; 15.3.6 alone only fixed the RCE, not the two later ones)
  - **CVE-2026-23864** (DoS in `react-server-dom-*`, CVSS 7.5, affects React 19.0.x-19.2.x — this app runs React 19.2.8) — fixed at 15.3.9 (`vercel.com/changelog/summary-of-cve-2026-23864`)
  - Verified on the real deployed build, not just assumed: the GitHub Actions `deploy.yml` build log for the merge commit shows `▲ Next.js 15.3.9` printed during `next build`.
  - Partial mitigation was already live before the patch and remains as defense-in-depth: Cloudflare's free "Cloudflare managed ruleset" (Security → Settings → Web application exploits) has **Block** rules tagged `cve-2025-55182` (the upstream RCE CVE) and `cve-2025-55183`. No rule for `cve-2025-55184` or `cve-2026-23864` as of this writing.
  - **Known small gap, low priority cleanup**: `eslint-config-next` is still pinned at `15.3.4` (only `next` itself was bumped, on purpose, to keep the PR minimal). No practical impact right now because the build's lint step (`ESLint: nextVitals is not iterable`) was already broken before this bump on 15.3.4 too — pre-existing, unrelated. Bump `eslint-config-next` to match `next` next time someone's in this area.
  - If a newer patch than 15.3.9 comes out for the 15.3.x line later, re-run the same process: check `npm view next versions` / the official advisory pages, don't assume 15.3.9 stays current forever.

---

## Project 1: Alan Coffee & Travel (Travel Website)

### Architecture

| Type | Routes |
|---|---|
| Server components (SSR) | `/`, `/about`, `/destinations/[slug]` |
| Client components | `/destinations`, `/guides`, `/map`, `/admin`, `/contact` |

- **Navbar** (`components/Navbar.tsx`) — sticky, white bg, gold underline on active link, hamburger at **< 1024px** (tablets get hamburger too, NOT 768px)
- **Map page** uses its own top nav bar (not Navbar) + full-screen Leaflet map loaded dynamically

### Design System (`app/globals.css`)

- Fonts: Plus Jakarta Sans (heading), Inter (body)
- Colors: `--color-black #0f0f0f`, `--color-gold #c9a84c`, `--color-cream #faf8f4`
- Breakpoints: mobile 0–767 / tablet 768–1023 / desktop 1024+
- Key utility classes: `hero-section`, `hero-h1`, `hero-h1-lg`, `page-h1`, `page-h2`, `section-pad`, `prose-section`, `px-page`
- Grid classes: `grid-3` (1→2→3 col), `grid-4` (2→4), `grid-2` (1→2), `grid-detail` (1→1.8fr/1fr)
- Skeleton: `.skeleton` class with shimmer animation (dark theme, rgba white shimmers)
- Map layout: `map-layout` height `calc(100vh - 180px)` on desktop

### Database Tables (Supabase)

**destinations**: `id, slug, title_en, title_lo, excerpt_en, description_en, region, district, status, featured, transport_price, has_guide, location_lat, location_lng, image_urls (TEXT[]), assessment_status, rating_experience/accessibility/authenticity/tranquility/traveler_value (SMALLINT)`

**guides**: `id, name, photo_url, province, districts[], languages[], specialties[], bio, phone, facebook, experience_years, is_verified, status`

**guide_destinations**: links guides ↔ destinations

### GeoJSON (public/)

- `/lao_admin1.geojson` — 18 provinces
- `/lao_admin2.geojson` — all districts (filtered by `adm1_name`)
- `DISTRICT_MAP` corrects Attapeu slug names

### Features Done

- Destination list/detail pages with skeleton loading + error state + "Try Again"
- Guide list page with skeleton loading
- Map page: all 18 provinces glow gold + clickable
- 5-dimension rating system (DB columns + admin UI + detail page display)
- Assessment status field in admin
- "← All Destinations" breadcrumb on detail page
- "Book Experience" button links to `/contact`
- Admin: password-protected, reads `image_urls` from DB
- Solo Operator Mode (035): `components/TodayStatsBar.tsx`, `lib/solo-mode.ts`, `lib/today-stats.ts`, `app/owner/OwnerClient.tsx`

### Known Bugs / Incomplete Features

| # | Issue | Status |
|---|---|---|
| 1 | **Image upload UI** in admin — uploads to Supabase Storage (`destination-images`, `site-assets` buckets via anon client) | Implemented (`app/admin/page.tsx`) |
| 2 | **Admin district dropdown** — `PROVINCE_DISTRICTS` in `app/admin/page.tsx` covers all 18 provinces (extracted from `lao_admin2.geojson`), cascading district selection | Implemented |
| 3 | **i18n (EN/LO/TH) rolled back** — caused by `localStorage` throwing `SecurityError` on iOS Safari Private mode, AND Supabase client calling `localStorage` during init. Fix when ready: wrap all `localStorage` calls in `try/catch`; init Supabase with `{auth:{persistSession:false, autoRefreshToken:false, detectSessionInUrl:false}}` | Rolled back, needs redo |
| 4 | **CVE-2025-66478 / CVE-2025-55183 / CVE-2025-55184 / CVE-2026-23864** (Next.js/RSC RCE + DoS + source-exposure CVEs) — see "CRITICAL: Cloudflare / Next.js Constraint" above | **Patched 2026-08-27** — `main` on Next.js 15.3.9 |
| 5 | **Map basemap tiles** — both `components/DestinationMap.tsx` (destination detail pages) and `app/map/page.tsx` (main Interactive Map) use Esri's free no-signup `World_Dark_Gray_Base` REST endpoint (`server.arcgisonline.com`) after CARTO retired their anonymous tier (same failure mode: every tile silently became an "API KEY REQUIRED" watermark that looked like a broken map, not a missing key — this actually recurred once already: `app/map/page.tsx` was missed in the original DestinationMap.tsx migration and was still on the broken CARTO URL until it was caught and fixed). Esri's endpoint is also a free/no-key tier oriented at light/eval use, not a guaranteed indefinite commercial SLA — if it ever gets rate-limited or retired the same way, watch for the map looking "blank/broken" again on *both* components. | Working, same class of risk as before |

---

## Project 2: Alan Cafe OS (POS System)

### Location in Repo

- `app/pos/` — main POS app
- `app/pos-product/` — product management
- `components/pos/` — all POS components
- `print-server/` — Node.js thermal receipt server (runs separately on Windows)
- `app/staff/`, `app/queue/`, `app/shop/`, `app/cafe/`, `app/owner/` — related pages

### Features Done

- **Main POS layout**: 60/40 grid with off-canvas drawer; responsive for 1366×768
- **Held orders**: park and resume orders
- **Thermal receipt printing**: Xprinter XP-T80A via Node.js print server on USB (scans USB001–USB020); `print-server/` runs independently on the Windows machine
- **Staff tab** and **Schedule tab**
- **2-step menu delete**: archive first → then permanent delete
- **Unified DB schema**: `recipe_ingredients`, `recipe_bases`, `recipe_base_ingredients`
- **Confirm button + auto-skip progress bar**
- **Offline banner** (dismiss + localhost-aware detection)
- **Nested scroll + dvh** layout fixes for 1366×768

### Features In Progress / Not Started

| Feature | Status |
|---|---|
| AI Analyst ("Alan AI") | Not started |
| n8n / LINE automation | Not started |
| Audit Log viewer | Not started |
| Anomaly Alerts | Not started |
| Leave Request system | Not started |
| i18n switching (EN/LO/TH) | Not started |
| Deploy to Netlify | Not started |

### Print Server

- Path: `print-server/`
- Runs as a standalone Node.js process on the Windows machine (not part of Next.js)
- Has a tray app: `print-server/tray/`
- Printer: Xprinter XP-T80A (USB), scans USB001–USB020 to find XP-80C

---

## Key Conventions

- **No emojis in code** unless explicitly requested (existing UI emojis are fine)
- **Minimal solutions** — don't over-engineer; no abstractions beyond what the task requires
- **No comments** unless the WHY is non-obvious
- **Premium aesthetic**: black (`#0f0f0f`) + gold (`#c9a84c`) throughout
- **Supabase anon key only** — never run DDL, never expose service key

---

## Env Files

- `.env.local` — Supabase URL + anon key (not committed to git)
- Copy manually to new machine or SSD

---

## Important File Locations (for machine migration)

- Env: `C:\Users\Parzy\Desktop\alan-coffee-travel\.env.local`
- Claude auto-memory: `C:\Users\Parzy\.claude\projects\C--Users-Parzy-Desktop-alan-coffee-travel\memory\`
- Claude global memory index: `C:\Users\Parzy\.claude\projects\C--Users-Parzy-Desktop-alan-coffee-travel\memory\MEMORY.md`
