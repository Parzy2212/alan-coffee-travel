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
  **Deleted** 2026-11-11 (shortcuts + profile) after the production shortcut was made.
- "Alan POS" shortcuts (Desktop + Start menu, `https://alancoffeetravel.com/pos`) and Edge profile
  `%LOCALAPPDATA%\AlanPOS\AlanPOSProfile`, made 2026-11-11 by `create-pos-shortcut.ps1` (defaults). This is the shop's
  real POS icon. Undo: delete both shortcuts and `%LOCALAPPDATA%\AlanPOS`.
- Windows: "Let Windows manage my default printer" turned **off** (`HKCU\Software\Microsoft\Windows NT\CurrentVersion\Windows`
  `LegacyDefaultPrinterMode` = 1) and HP LaserJet Professional P1102 set back as default (owner approved). Windows had
  switched the default to the Xprinter after test prints. Undo: turn the setting back on in Printers & scanners.

Already present before 2026-11-10 (not changed): Playwright MCP `@playwright/mcp@0.0.79` (`.mcp.json`), `typescript-lsp`,
`claude-code-setup`, `security-guidance` (installed, disabled), project skills in `.claude/skills/`.

## Inventory 2026-11-13 (names only; no keys, no settings contents)

Scope words: **all** = every project on this PC, **this** = this repo only, **hq** = the `D:\alan-hq` workspace only.

### Skills

| Name | Source | Scope |
|---|---|---|
| `safe-db-migration-test`, `done-means-proven`, `web-pos-receipt-printing`, `pos-offline-sales`, `non-technical-owner`, `reusable-code-catalogue` | written by Claude from this project's lessons, 2026-11-12 (`C:\Users\Pacy\.claude\skills`) | all |
| `ponytail`, `security-audit` | personal skills folder; not written in this project, origin not recorded | all |
| `built-in-browser`, `chrome-browser`, `computer-use`, `deep-research`, `docs`, `docx`, `google-workspace`, `import-memory`, `morning`, `pdf`, `pptx`, `skill-creator`, `xlsx` (shown as `anthropic-skills:*`) | Anthropic, synced from the Claude account (`skills\synced`) | all |
| `adapt`, `animate`, `audit`, `bolder`, `clarify`, `colorize`, `critique`, `delight`, `distill`, `extract`, `frontend-design`, `harden`, `normalize`, `onboard`, `optimize`, `polish`, `quieter`, `teach-impeccable` | GitHub `pbakaus/impeccable` (see `skills-lock.json`), in `.claude/skills`, in git since 2026-03-18 | this |
| `web-qa` | written for this repo, 2026-08-25 | this |
| `edit-clip` | written for this repo, 2026-10-25 | this |
| built into Claude Code: `code-review`, `simplify`, `security-review`, `init`, `run`, `loop`, `schedule`, `update-config`, `keybindings-help`, `fewer-permission-prompts`, `claude-api`, `claude-in-chrome`, `dataviz`, `artifact-design`, `artifact-diagramming`, `artifact-capabilities`, `plugin-authoring` | Anthropic, ships with Claude Code | all |
| hq: 27 Phaser game skills (`scenes`, `sprites-and-images`, `tilemaps`, `physics-arcade`, ...) | generated from the Phaser source in an alan-hq session (`D:\alan-hq\skills-lock.json`) | hq |
| hq: 12 `remotion-*` skills | GitHub `remotion-dev/skills` | hq |
| hq: `hyperframes`, `hyperframes-cli`, `editing-videos` | in `D:\alan-hq\.claude\skills`, not in its lock file, origin not recorded | hq |

Subagents: `quality-reviewer` (this repo, `.claude/agents`); hq has `dao-secretary`, `kham-builder`, `mali-hr`, `sunny-content`, plus 3 hook scripts in `D:\alan-hq\.claude\hooks`.

### Plugins

| Name | Source | Scope |
|---|---|---|
| `modern-web-guidance` | Google Chrome marketplace (`googlechrome`) | all |
| `session-report`, `claude-md-management`, `hookify` | Anthropic `claude-plugins-official` | all |
| `typescript-lsp`, `claude-code-setup`, `security-guidance` (disabled), `claude-security`, `pr-review-toolkit` | Anthropic `claude-plugins-official` | this |
| `design` and `data` (skills `design:*`, `data:*`, and their connectors) | visible in the session but not in the local installed-plugins file; most likely enabled on the Claude account. Not verified | unknown |

### MCP servers

| Name | Source | Scope | State on 2026-11-13 |
|---|---|---|---|
| `chrome-devtools` | Google, npm `chrome-devtools-mcp` | all | working |
| `pos-browser` | same program, own Chrome profile | this (local, not in git) | working |
| `playwright` | Microsoft, npm `@playwright/mcp` (`.mcp.json`) | this | working |
| `context7` | Upstash Context7 (`.mcp.json`) | this | working |
| `supabase`, `github`, `cloudflare-builds` | official hosted servers (`.mcp.json`) | this | not signed in in this session |
| `claude-in-chrome` | Anthropic Chrome extension | all | available |
| Claude Docs, Gmail, Google Calendar, Google Drive | connectors of the Claude account | all | Docs working; the 3 Google ones not signed in |
| `design` plugin: Figma, Intercom, Linear, Notion, Slack | come with the `design` plugin | unknown | not signed in |
| `data` plugin: Amplitude, Amplitude EU, Atlassian, Hex, Definite | come with the `data` plugin | unknown | not signed in; Definite fails to connect |

`/clarify` = the `clarify` skill in `.claude/skills/clarify`, one of the 18 skills from GitHub `pbakaus/impeccable`.
