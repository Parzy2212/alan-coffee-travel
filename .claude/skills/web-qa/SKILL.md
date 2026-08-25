---
name: web-qa
description: Verification checklist for any frontend change to this project (alan-coffee-travel) that will be tested and/or deployed. Covers two layers of cache that silently serve stale content during local testing (.next build cache, service worker), real mobile-viewport testing via Playwright, confirming the GitHub Actions Cloudflare Pages deploy actually succeeded, and a final check on the live production site. Use automatically whenever you're about to say a frontend fix is verified, tested, or deployed — don't wait to be asked.
user-invokable: true
---

Born from a real incident (2026-08-25): a fix was already correct in the source file, but the dev server kept serving an old compiled version because `next build` and `next dev` had left conflicting caches, AND a service worker (`sw.js`) had cached the old page on top of that. Two layers of stale content, both silent, both looking like "the fix didn't work." Do not skip any step below to save time — every step here exists because skipping it produced a false result once already.

## The sequence — do not skip or reorder

### 1. Clear `.next` before starting (or restarting) the dev server

```
rm -rf .next
npm run dev
```

Always do this if a `next build` ran anytime recently in this working tree, or if you're restarting dev after pulling/switching branches. Mixing production-build and dev-server artifacts causes silent staleness — Next.js will sometimes log `Fast Refresh had to perform a full reload` right before serving mismatched output. If you see that log line, stop, clear `.next`, and restart before trusting anything you see in the browser.

### 2. Check for a service worker and clear it

```
grep -rl "serviceWorker\|sw.js" public/ app/ 2>/dev/null
```

If a service worker is registered (this project has `public/sw.js` for the "Install Alan Cafe OS" PWA prompt), unregister it and clear its caches before every test pass — a registered service worker will keep serving the old page/JS/CSS even after a clean server restart, because it intercepts fetches at the browser level, upstream of anything the server does differently. Run this in the page:

```js
const regs = await navigator.serviceWorker.getRegistrations();
for (const r of regs) await r.unregister();
const names = await caches.keys();
for (const n of names) await caches.delete(n);
```

Do this via the Playwright MCP `browser_evaluate` tool (or equivalent JS-eval tool) against the tab under test, then reload. Skipping this step is what produced a false "not fixed" reading during the mobile-CTA fix — the code was already right.

### 3. Test both desktop and real mobile viewport, via Playwright MCP

Use the `mcp__playwright__*` tools for this, not `resize_window` on an already-navigated tab in Claude-in-Chrome — that tool silently no-ops after a page has loaded (confirmed broken on this machine 2026-08-25) and will make you believe you tested mobile when you actually screenshotted desktop layout at a smaller image size.

With Playwright:
1. `browser_resize` (or launch with a mobile viewport) to a real phone width — **390×844** (iPhone 12/13) is the project's standard test size — before navigating, or immediately after opening a fresh tab and before the first meaningful interaction.
2. `browser_navigate` to the page under test.
3. `browser_snapshot` or `browser_take_screenshot` to actually look at the rendered layout — don't infer from the DOM alone; visually confirm touch targets, overlapping elements, and hidden/visible breakpoints.
4. Repeat at a normal desktop width (1440×900) to confirm no regression on the layout you didn't mean to touch.

Both sizes, every time — a fix that only gets checked at the size it was written for is not verified, it's assumed.

### 4. After pushing, watch the GitHub Actions deploy to a real conclusion

`git push` succeeding only means GitHub received your commit — it says nothing about whether the build/deploy worked. This repo deploys via `.github/workflows/deploy.yml` (Cloudflare Pages, triggered on push to `main`). Poll until the run is actually `completed`, and report the `conclusion` (`success` or `failure`), not just that a push happened:

```
curl -s "https://api.github.com/repos/Parzy2212/alan-coffee-travel/actions/runs?branch=main&per_page=1" 
```

then poll the specific run id's URL until `status` is `completed`. If `conclusion` is `failure`, pull the job logs before saying anything else is done.

### 5. After a successful deploy, check the live site, not just localhost

Open the real production URL (not `localhost:3000`) and visually re-confirm the change is actually there. A successful Actions run means the deploy step didn't error — it does not by itself prove the CDN has finished propagating or that the build actually contained the change you think it does. Use Playwright at both viewport sizes from step 3 against the live URL, one more time, before calling the task done.

## What "done" means for a frontend task in this project

All five steps above completed, with their actual results (not assumed results) — then, per this project's `CLAUDE.md` quality standards, hand off to the `quality-reviewer` subagent before reporting to the user. If any step couldn't be completed (e.g., no way to test the live site yet because deploy is still running), say so explicitly instead of rounding up to "done."
