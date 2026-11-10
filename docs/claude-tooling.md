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

Already present before 2026-11-10 (not changed): Playwright MCP `@playwright/mcp@0.0.79` (`.mcp.json`), `typescript-lsp`,
`claude-code-setup`, `security-guidance` (installed, disabled), project skills in `.claude/skills/`.
