# Machine Migration Log — alan-coffee-travel

**Status:** COMPLETE
**Date:** 2026-08-15

## New machine

- Hostname: `DESKTOP-VR60E0L`
- OS: Microsoft Windows 11 Pro for Workstations, 10.0.26200 (Build 26200)
- System type: x64-based PC, 32,347 MB RAM
- Windows user: `Pacy` (old machine was user `Parzy`)
- Git: `2.55.0.windows.3`
- Node: `v24.18.0`
- npm: `11.16.0`
- Repo path: `D:\alan-coffee-travel`

## Steps completed

1. **Clone** — `git clone https://github.com/Parzy2212/alan-coffee-travel.git D:/alan-coffee-travel`
   - HEAD confirmed at commit `4132736ffcc44f517285ee88f132afc05dd63d82` ("docs: add CLAUDE.md, CVE status doc, and update .gitignore")
   - Branch `main`, clean working tree, up to date with `origin/main`

2. **`.env.local`** — copied from `E:\alan-coffee-migration\.env.local` to `D:\alan-coffee-travel\.env.local`
   - Contains: `ADMIN_PASSWORD`, `MASTER_PIN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

3. **Claude memory/project folder** — copied from
   `E:\alan-coffee-migration\C--Users-Parzy-Desktop-alan-coffee-travel\`
   to
   `C:\Users\Pacy\.claude\projects\D--alan-coffee-travel\`
   - 3 session transcripts (`.jsonl`) + `memory/` (5 files: `MEMORY.md`, `project_cloudflare_migration.md`, `project_solo_operator.md`, `project-cloudflare-adapter.md`, `project-cve-patch.md`)
   - Destination path encoded from new clone location per Claude Code's project-folder naming convention

4. **`npm install`** — 649 packages installed, 650 audited, 1m
   - 35 vulnerabilities reported (4 low, 10 moderate, 19 high, 2 critical) via `npm audit` — includes the already-tracked `next@15.3.4` CVE-2025-66478 (see `docs/cve-patch-status.md`), not a new issue
   - `allow-scripts` flagged 8 packages with pending install scripts (esbuild, sharp, unrs-resolver, workerd) — not yet approved

5. **`npm run dev`** — verified working
   - Server started on `http://localhost:3000` (`Ready in 8.2s`)
   - `GET /` → 200
   - `GET /destinations` → 200, rendered real data ("1 destination" shown, card populated — not a loading skeleton)
   - Confirmed in Chrome: network request `GET https://fmsdfcsqdpdlppucuptn.supabase.co/rest/v1/destinations?select=*&status=eq.active&order=featured.desc` → **200 OK**
   - No console errors
   - (Unrelated noise seen in terminal logs during first compile: repeated "Request timed out after 3000ms / Retrying" — this is Next.js's own anonymous telemetry ping, not a Supabase or app issue)

## Known follow-ups (not blocking)

- Git identity not configured on this machine yet (`git config user.name` / `user.email` both empty) — set before making any commits
- `gh` CLI not installed
- `npm audit` vulnerabilities (2 critical, 19 high) not yet addressed — pre-existing, tracked separately
- `allow-scripts` pending approvals not yet reviewed
- Changes in this session are local only — **not pushed** to `origin/main`
