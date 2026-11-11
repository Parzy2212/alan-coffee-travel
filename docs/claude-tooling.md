# Claude Code tooling for this repo

Everything Claude Code added to help with POS work: what, version, where it came from, and how to remove it.

| Added | What | Version | Source | Scope | Remove |
|---|---|---|---|---|---|
| 2026-11-10 | `claude-security` plugin: in-session security scan + verified findings + patch suggestions (agents, local Python helpers; no network calls, no keys) | 0.12.0 | Anthropic, `claude-plugins-official` marketplace | project (`.claude/settings.json`) | `claude plugin uninstall claude-security@claude-plugins-official --scope project` |
| 2026-11-10 | `pr-review-toolkit` plugin: review agents (silent-failure-hunter, type-design-analyzer, pr-test-analyzer, comment-analyzer, code-simplifier, code-reviewer); prompts only | 1.0.1 | Anthropic, `claude-plugins-official` marketplace | project | `claude plugin uninstall pr-review-toolkit@claude-plugins-official --scope project` |
| 2026-11-10 | `pos-browser` MCP server: Chrome with its own persistent profile, so the owner logs in to `/pos` once and Claude can screenshot and click through it | `chrome-devtools-mcp@1.12.0` (pinned) | Google, npm `chrome-devtools-mcp` (already used here, unpinned, as `chrome-devtools`) | local (`~/.claude.json`, this project only; not in git) | `claude mcp remove pos-browser -s local`, then delete `C:\Users\Pacy\.alan-pos-browser` |

`pos-browser` flags: `--user-data-dir C:\Users\Pacy\.alan-pos-browser\profile` (keeps the login; without it 1.12 starts a throwaway
profile every time), `--usage-statistics=false` and `--performance-crux=false` (both default to on and send data to Google).
The profile holds a live login to the POS: don't copy it anywhere, and delete the folder to log out.

2026-11-11:
- `chrome-devtools` MCP (user scope, all projects): pinned `@latest` → `chrome-devtools-mcp@1.12.0`, added
  `--usage-statistics=false --performance-crux=false` (owner approved). Undo: `claude mcp remove chrome-devtools -s user`
  and re-add with the old args.
- Supabase MCP (`.mcp.json`, already configured `read_only=true`, `project_ref` = this shop only): OAuth login by the
  owner (approved). OAuth scopes requested by Supabase include `secrets:read`; Claude does not call secret/key tools
  (CLAUDE.md service-role rule). Undo: `/mcp` → supabase → clear authentication, or revoke the app in Supabase account
  settings.
- Printer tests on this PC (Xprinter XP-T80A, USB `0483:5743`, Windows built-in USB printing class only, no vendor driver):
  temporary Chrome policy `WebUsbAllowDevicesForUrls` in `HKCU\Software\Policies\{Google\Chrome,Chromium}` for
  `http://localhost:8099` → **removed** the same day (keys deleted). No driver or program installed.

- Xprinter receipt driver (official, `Xprinter.receipt.driver.2025.10.22.01.exe` from xprintertech.com, signed by Zhuhai
  Hena), installed by the owner: queue **Xprinter XP-80** on `USB002`. This is the chosen print path (see
  `docs/pos-printer-setup-th.md`). Undo: Printers & scanners → Xprinter XP-80 → Remove; Settings → Apps → uninstall the driver.
- "Alan POS TEST" shortcuts (Desktop + Start menu) and Edge profile `%LOCALAPPDATA%\AlanPOS\AlanPOSTESTProfile`, made by
  `docs/pos-setup/create-pos-shortcut.ps1 -Url http://localhost:3000/pos -Name 'Alan POS TEST'` for local testing.
  Delete both after the production "Alan POS" shortcut is made.
- Windows: "Let Windows manage my default printer" turned **off** (`HKCU\Software\Microsoft\Windows NT\CurrentVersion\Windows`
  `LegacyDefaultPrinterMode` = 1) and HP LaserJet Professional P1102 set back as default (owner approved). Windows had
  switched the default to the Xprinter after test prints. Undo: turn the setting back on in Printers & scanners.

Already present before 2026-11-10 (not changed): Playwright MCP `@playwright/mcp@0.0.79` (`.mcp.json`), `typescript-lsp`,
`claude-code-setup`, `security-guidance` (installed, disabled), project skills in `.claude/skills/`.
