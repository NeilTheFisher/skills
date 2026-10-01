# Source inventory and landmines

Verified 2026-10-01. Re-verify before trusting any of it.

## Sources

| Tier | Source | Skills | Update command |
|---|---|---|---|
| Locked | `mattpocock/skills` | 7 (see below) | `npx skills update -g` |
| Locked | `cursor/plugins` | `fix-merge-conflicts`, `thermo-nuclear-code-quality-review` | `npx skills update -g` |
| Locked | `vercel-labs/agent-skills` | `web-design-guidelines` | `npx skills update -g` |
| Locked | `Shawnchee/frontend-god-mode` | `frontend-god-mode` | `npx skills update -g` |
| **Untracked-vendored** | `cloudflare/skills` | 13 | manual copy, see below |
| Local | — | ~25 | never auto-update |

### cloudflare/skills — untracked, rots silently

`agents-sdk`, `cloudflare`, `cloudflare-one`, `cloudflare-one-migrations`,
`cloudflare-email-service`, `durable-objects`, `sandbox-migrate-to-next`, `sandbox-next`,
`sandbox-stable`, `turnstile-spin`, `web-perf`, `workers-best-practices`, `wrangler`.

No lock entry, so `npx skills update` never touches these. Manual sync:

```bash
git clone --depth 1 https://github.com/cloudflare/skills.git /tmp/cf-skills
cd ~/.agents/skills
for s in agents-sdk cloudflare cloudflare-one cloudflare-one-migrations \
         cloudflare-email-service durable-objects sandbox-migrate-to-next \
         sandbox-next sandbox-stable turnstile-spin web-perf \
         workers-best-practices wrangler; do
  rm -rf "$s" && cp -a "/tmp/cf-skills/skills/$s" "$s"
done
```

**Re-apply after every sync:**

1. `sandbox-next/SKILL.md` + `sandbox-migrate-to-next/SKILL.md` — upstream `41e0d19`
   collapsed ~15 distinct `1-0-preview/*` routes into one generic `sandbox/index.md`.
   Restore per-topic routes; ours are better than upstream's.
2. `cloudflare/SKILL.md` links `../nextjs-on-cloudflare/SKILL.md`, a skill not installed
   here. Either install it or de-link.

Upstream ships 3 uninstalled skills: `basin` (R2 Iceberg rebrand of pipelines /
r2-data-catalog / r2-sql), `k2`, `nextjs-on-cloudflare`.

## Landmines

### deslop is local-only and MUST stay out of the lock file

Upstream `cursor/plugins` ships a 22-line stub; ours is 561 lines with a 269-line scanner.
It was removed from `.skill-lock.json` deliberately — `npx skills ls -g` must report it
`Source: local`. If a future update re-adds it, remove it again before updating.

### mattpocock renames

Six skills were renamed upstream 2026-05→10. Current local names: `diagnosing-bugs`
(was `diagnose`), `to-spec` (was `to-prd`), `to-tickets` (was `to-issues`), `ask-matt`
(was `zoom-out`), `wait-what` (was `caveman`), `writing-for-agents` (was `write-a-skill`).

Upstream renamed the directories but left stale `name:` fields in frontmatter — the CLI
then reported old names against new paths. Fixed locally on 2026-10-01; check for
recurrence after any sync.

`grill-me` and `grill-with-docs` are 3-line shims that hard-require `grilling`. Installing
either without `grilling` breaks them.

Upstream renamed the `CONTEXT.md` convention to `GLOSSARY.md`. Applied in
`~/repos/personal/trading-bot` on 2026-10-01. Any other repo using the old name will be
silently ignored by updated skills.

Not installed, available upstream: `code-review`, `codebase-design`, `domain-modeling`,
`implement`, `implement-spec`, `pr`, `research`, `retro`, `wayfinder`, `wizard`,
`handoff`, `teach`, `to-questionnaire`, and misc `git-guardrails-claude-code`,
`migrate-to-shoehorn`, `scaffold-exercises`, `setup-pre-commit`.

### browser-harness is vendored, not a symlink

`browser-harness/SKILL.md` was a git symlink (mode `120000`) to
`/home/nfisher/Developer/browser-harness/SKILL.md` — dangling on any other clone.
Converted to a real file 2026-10-01. Refresh with:

```bash
cp ~/Developer/browser-harness/SKILL.md ~/.agents/skills/browser-harness/SKILL.md
```

That re-copy drops the local header and the upstream-PR-safety edit; re-apply both.

### Skills that are intentionally broken

`playwright-interactive` depends on `js_repl`, removed from Codex. Kept as reference with
a warning banner. `playwright` is the working path.

### In-repo conventions

- `AGENTS.md` documents the install and Cloudflare-sync procedure. Update it when tiers change.
- The `skills:start` block in `~/.config/opencode/AGENTS.md` is hand-maintained, not
  generated. It was wrong for months (advertised 11 nonexistent skills, omitted ~45 real
  ones); regenerated 2026-10-01 from on-disk frontmatter.
- `safe-restart-check` is project-scoped to `~/repos/t3code-web-setup`, not this repo.
