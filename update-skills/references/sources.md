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
| **Untracked-vendored** | `dzhng/skills` | 2 (`ratchet-files`, `refactor-clean`) | manual copy, see below |
| **Untracked-vendored** | `kajisho5/ffmpeg-skill` | 1 (`ffmpeg-skill`, v2.17.1) | manual copy of the runtime payload, see below |
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

### dzhng/skills — untracked, two skills so far

`ratchet-files` (upstream `skills/engineering/ratchet-files`) and
`refactor-clean` (upstream `skills/engineering/refactor-clean`), added 2026-10-19.
No lock entry, so `npx skills update` never touches them. Sync:

```bash
git clone --depth 1 https://github.com/dzhng/skills.git /tmp/dzhng-skills
for s in ratchet-files refactor-clean; do
  rm -rf ~/.agents/skills/"$s"
  cp -a "/tmp/dzhng-skills/skills/engineering/$s" ~/.agents/skills/"$s"
done
```

**Re-apply after every sync:**

1. `ratchet-files/SKILL.md` frontmatter `description:` has colons and is unquoted
   upstream, which makes YAML parsers skip the skill. Wrap it in double quotes.
2. `ratchet-files/SKILL.md` links `../refactor-clean/SKILL.md`. Keep both skills
   installed together, or de-link it when dropping `refactor-clean`.

Interesting uninstalled siblings in that repo: `audit-performance`, `audit-choices`,
`audit-tests`, `code-review`, `review`, `write-spec`, `implement-spec`, `retro`.

### kajisho5/ffmpeg-skill — copy the payload, not the repo

Added 2026-10-25 at upstream `36d023e` (v2.17.1). The repository is a skill plus an npm
package, an MCP server, demos and 13 MB of `docs/demos/*.gif`; the installable skill is
`bin/install.js`'s PAYLOAD list. Copy that:

```bash
git clone --depth 1 https://github.com/kajisho5/ffmpeg-skill.git /tmp/ffmpeg-skill
rm -rf ~/.agents/skills/ffmpeg-skill
mkdir -p ~/.agents/skills/ffmpeg-skill/docs
cd ~/.agents/skills/ffmpeg-skill
cp -a /tmp/ffmpeg-skill/{SKILL.md,LICENSE,package.json,scripts,templates,references,mcp} .
cp -a /tmp/ffmpeg-skill/docs/contract.md docs/
find . -name __pycache__ -type d -prune -exec rm -rf {} +
```

**Re-apply after every sync:**

1. `docs/contract.md` is not documentation: `scripts/` and `references/gotchas.md` cite it by
   path and `SKILL.md` tells the agent to trust the contract. Keep `docs/contract.md`;
   `docs/design-decisions.md`, `docs/roadmap.md` and `docs/demos.md` are safe to skip.
2. `npx skills update -g` must not touch it — there is no lock entry, same as the cloudflare
   and dzhng sets. A `docs/demos/` directory reappearing means someone copied the whole repo.
3. Upstream releases fast (6 versions in the days before install). Check `package.json`'s
   version before trusting a flag from the changelog.

**Machine note:** Ubuntu 22.04 ships FFmpeg 4.4.2, which predates the CVE-2026-8461 fix and
lacks `libsvtav1`. A BtbN static GPL build shadows it from `/usr/local/bin`, so `doctor`
reports `ok` with no security advisories and only the optional transcription engines missing.
Refresh it without touching the distro package (nothing on this box depends on apt's ffmpeg):

```bash
curl -sL -o /tmp/ff.tar.xz https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-linux64-gpl-8.1.tar.xz
tar -xJf /tmp/ff.tar.xz -C /tmp
sudo install -m 755 /tmp/ffmpeg-n8.1-latest-linux64-gpl-8.1/bin/{ffmpeg,ffprobe,ffplay} /usr/local/bin/
```

`~/.local/bin/whisper-cli` is a shim over the local transcription server on `:8178` (see
`~/docs/local-transcription.md`), so `doctor` reports whisper.cpp present and `--transcribe`
works without a second model. Bark returns no word timings: the shim splits the text into cues
and snaps their boundaries into the audio's pauses, so cue timing is close but word times inside
a cue are estimates — re-check any `--filler` cut. Orukeet's own words pass through when that
backend is selected.

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
