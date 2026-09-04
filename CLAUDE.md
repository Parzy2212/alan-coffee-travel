# Alan Coffee & Travel — CLAUDE.md

> One repo, two products: **Alan Coffee & Travel** (travel website) and **Alan Cafe OS** (POS system).
> Last updated: 2026-09-04

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

## CRITICAL: `shop_users` multi-tenancy incident chain (2026-09-03/04)

Four separate, connected problems surfaced in one night while setting up a Claude test
account for visual QA. Read this before touching `shop_users`, onboarding, or Team/Employees
pages again — the failure modes are non-obvious and each one masked the next.

**1. Onboarding slug-collision vulnerability — fixed, commit `527959b`.**
`app/onboarding/page.tsx`'s `saveAndFinish()` looked up a shop by a slug derived from the
entered shop name, and if *any* existing shop already had that slug, silently upserted the
signer-upper as `role: 'owner'` on that shop — no check that they had any prior relationship
to it. Since the default onboarding shop name is "Alan Coffee & Travel" (slug
`alan-coffee-travel`), any new signup that kept the default name got owner access to the real
shop. Fix: check the *current user's own* `shop_users` rows for that slug first (preserves
idempotent re-runs); on a genuine collision, append a random suffix and create a new shop
instead of attaching to someone else's. **Confirmed via live testing that no one had actually
exploited this**: writes to `shop_users` were separately broken the whole time (see #2), so
the vulnerable code path could never have completed successfully in practice.

**2. `shop_users` RLS infinite recursion — fixed via manual SQL in Supabase dashboard
(`docs/fix-shop-users-rls-recursion.sql`, not a code commit).**
4 of the table's 7 policies (`shop_users_insert_owner`, `shop_users_manager_update`,
`shop_users_owner_delete`, `shop_users_update_owner`) checked "is this user an owner/manager"
by subquerying `shop_users` from *within* a `shop_users` policy — Postgres has to apply the
table's own RLS to evaluate that inner query, which re-triggers the same policy, forever
(`42P17: infinite recursion detected in policy for relation "shop_users"`). Every INSERT/
UPDATE/DELETE against `shop_users` failed with a 500 — including the onboarding wizard's own
`shop_users` upsert, which is why **no test account's shop link ever actually got created all
night**, no matter which signup path was tried. The 3 SELECT/self-scoped policies
(`shop_users_self_read`, `shop_users_self_insert`, `shop_users_same_shop_read`, the last of
which already called a `SECURITY DEFINER` function `user_shop_ids()`) were never affected —
this is why reads always looked fine while writes silently died. Fix: new `SECURITY DEFINER`
helper `user_shop_ids_by_role(roles text[])`, and the 4 broken policies rewritten to call it
instead of the raw self-subquery. Verified live: `shop_users` INSERT went from 500 → 201.

**3. Team/Employees pages hang forever on the loading skeleton if `useShop()` resolves
`shopId: null` — fixed, commit `904e407`.**
Pre-existing frontend bug, unrelated to #1/#2 except that #2 is what finally surfaced it.
`app/shop/team/page.tsx` and `app/shop/team/employees/page.tsx` each gate their *own*
`load()` behind `if (shopId) load()` inside a `useEffect`, and only ever set their own
`loading` state to `false` at the end of `load()`. `useShop()` itself correctly resolves
`loading: false` even when no owner row is found — but since `load()` never runs in that
case, the page's own `loading` flag never flips, so the skeleton renders forever with zero
error, no matter how long you wait. Fixed by watching `shopLoading` explicitly and showing a
clear "ไม่พบร้านที่คุณเป็นเจ้าของ" error state when `shopId` is genuinely null after loading, instead
of hanging silently.

**4. The real owner's (`sulutxai@gmail.com`, `user_id`
`e103ceaf-ced6-4bba-a54f-887f6e2c15e7`) own `shop_users` row was missing entirely — recovered
via manual SQL (`docs/restore-real-owner-shop-users.sql`, not a code commit) —
**root cause NOT conclusively identified**.
Discovered because #3's new error state finally surfaced it, on the real account, right after
#2's fix went live — which raised an obvious and reasonable suspicion that a prior "remove the
test account's owner access" step (done earlier the same night per user instruction) had
deleted the wrong row. That specific hypothesis was checked and ruled out: reviewing the
actual action log for that step showed no DELETE was ever issued — the test account already
had zero `shop_users` rows before that step was reached, so there was nothing to remove and
nothing was removed. Beyond ruling that out, the true root cause is unknown. One consistent-
but-unconfirmed theory: `/pos` and `/cafe` render correctly for accounts with **zero**
`shop_users` rows (proven during this session's test-account work), meaning core POS/menu
data isn't actually gated by this table — `shop_users` may be newer than the real shop's
original setup (both created 2026-05-05) and could plausibly have never been backfilled for
this account. Recovered by inserting `(shop_id: 9afdd9eb-728d-4e36-8077-492c92dbef30, user_id:
e103ceaf-ced6-4bba-a54f-887f6e2c15e7, email: sulutxai@gmail.com, role: 'owner', active: true)`
directly. **Follow-up still needed**: confirm `/shop/team`'s member list is now clean (no
unfamiliar accounts) — this was the original reason RLS needed fixing at all, and hadn't been
confirmed as of this writing.

**Lessons for next time:**
- Never test account/shop creation flows against the real production Supabase project without
  first confirming the flow can't attach to or affect existing real data by name/slug
  collision — a throwaway "test" shop name is not automatically an isolated shop.
- A `500` from PostgREST on a table you didn't expect to be touched is worth investigating
  immediately, not working around — it blocked write paths across totally unrelated features
  (onboarding, Team invites) that all happened to share one table.
- `.maybeSingle()` / any "resolves to null on no-match" pattern needs an explicit UI state for
  the null case wherever it gates a whole page — silent infinite loading is worse than an
  error message, because it looks like "still working" instead of "broken."
- No Supabase MCP tool was available this session despite being expected to be installed —
  all diagnosis this incident required manual back-and-forth (user reading Dashboard policy
  screens/running SQL, Claude reading screenshots and drafting SQL). Confirm MCP connectivity
  status early in future sessions that touch RLS/schema.

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
