# Source inventory and landmines

Verified 2026-11-24 for the dzhng `skills/review/` move, the `unslop-ui` 1.0.1 merge and
`bro-skill`; 2026-11-13 for the animatic pair; 2026-11-17 for `caldoai`'s `prune-tests`;
2026-11-09 for the mattpocock entries; the cloudflare and ffmpeg sections date from
2026-10-01 unless noted.
Re-verify before trusting any of it.

## Sources

| Tier | Source | Skills | Update command |
|---|---|---|---|
| Locked | `mattpocock/skills` | 10 (see below) | `npx skills update -g` |
| Locked | `cursor/plugins` | `fix-merge-conflicts`, `thermo-nuclear-code-quality-review` | `npx skills update -g` |
| Locked | `vercel-labs/agent-skills` | `web-design-guidelines` | `npx skills update -g` |
| Locked | `Shawnchee/frontend-god-mode` | `frontend-god-mode` | `npx skills update -g` |
| **Untracked-vendored** | `cloudflare/skills` | 13 | manual copy, see below |
| **Untracked-vendored** | `mattpocock/skills` branch `animatic-skill` | 2 (`animatic`, `setup-animatic`) | manual copy from the branch, see below |
| **Untracked-vendored** | `react-doctor` npm package | 1 (`react-doctor`) | manual copy of `dist/skills/react-doctor`, see below |
| **Untracked-vendored** | `dzhng/skills` | 4 (`ratchet-files`, `refactor-change`, `find-state-machines`, `find-overengineering`) | manual copy, see below |
| **Untracked-vendored** | `kajisho5/ffmpeg-skill` | 1 (`ffmpeg-skill`, v2.17.1) | manual copy of the runtime payload, see below |
| **Untracked-vendored** | `EL4CTEO/shrink-anything` | 1 (`shrink-anything`) | manual copy of `skills/shrink-anything`, see below |
| **Untracked-vendored** | `luchasarie/bro-skill` | 1 (`bro-skill`, frontmatter name `bro`) | manual copy; the folder keeps the upstream repo name |
| Locked | `caldoai/skills` | 2 (`untangle-codebase`, `prune-tests`) | `npx skills update -g` |
| Locked | `janestreet/agent_skills` | 1 (`socratic-tutor`) | `npx skills update -g` |
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

### dzhng/skills — untracked, four skills

`ratchet-files` and `refactor-change` (the 2026-11 rename of `refactor-clean`) live under
upstream `skills/review/`; `find-state-machines` and `find-overengineering` are their two
single-file dependencies. No lock entries, so `npx skills update` never touches them. Sync:

```bash
git clone --depth 1 https://github.com/dzhng/skills.git /tmp/dzhng-skills
for s in ratchet-files refactor-change find-state-machines find-overengineering; do
  rm -rf ~/.agents/skills/"$s"
  cp -a "/tmp/dzhng-skills/skills/review/$s" ~/.agents/skills/"$s"
done
```

**Re-apply after every sync:** nothing. Upstream now writes `ratchet-files`' description
as a `>-` block scalar, so the old unquoted-colon YAML break is fixed, and it links
`../refactor-change/SKILL.md`, which the loop installs. Keep `find-state-machines` and
`find-overengineering` installed: `refactor-change` links both.

`refactor-codebase` is a separate new upstream skill (a whole-codebase sweep, user-invoked
via `disable-model-invocation: true`). It additionally needs `code-review`, `audit-tests`
and `review`, none of which are installed; do not add it without them or its links dangle.

Interesting uninstalled siblings: `audit-performance`, `audit-choices`, `audit-tests`,
`code-review`, `review`, `write-spec`, `implement-spec`, `retro`, `refactor-codebase`, `eli5`.

### luchasarie/bro-skill — untracked, folder name differs from skill name

Vendored from `luchasarie/bro-skill`. The folder deliberately keeps the upstream repo name
(`bro-skill`) while frontmatter says `name: bro`, so the command stays `/bro`;
`install.sh` and the README use the `bro-skill` paths. The directory/name mismatch is an
accepted exception to the usual rule, not a stale rename. No lock entry.

### EL4CTEO/shrink-anything — untracked, vendored 2026-11-23

`shrink-anything` is the agent skill shipped alongside the CLI of the same name
(Rust binary, npm `@el4cteo/shrink-anything`). It is the loop from the public
announcement: scan for dead code, files, dependencies and assets; cut only what
the project's own check still passes; put back the cut that broke it; hand the
judgement calls (duplicates, public names) to the agent. No lock entry, so
`npx skills update` never touches it. Sync:

```bash
curl -fsSL https://raw.githubusercontent.com/EL4CTEO/shrink-anything/main/skills/shrink-anything/SKILL.md \
  -o ~/.agents/skills/shrink-anything/SKILL.md
curl -fsSL https://raw.githubusercontent.com/EL4CTEO/shrink-anything/main/LICENSE \
  -o ~/.agents/skills/licenses/shrink-anything-LICENSE
```

**Re-apply after every sync:** nothing, the file is byte-identical upstream. The
skill only acts where the `shrink-anything` binary is installed (`scan`, `cut -- <check>`,
`task`, `verify`, `undo`, `report`); without it the skill has nothing to drive.

### mattpocock/skills — three more, locked by hand

Added 2026-11-05 so `improve-codebase-architecture`, `tdd`, `triage` and
`grill-with-docs` stop calling skills that were never installed; `retro` added
2026-11-23. All are byte-identical upstream copies, and all have a
`.skill-lock.json` entry, so `npx skills update -g` maintains them.

The entries were written by hand because `npx skills add` is interactive-only (no
`--skill` flag). `skillFolderHash` is **the upstream git tree SHA of the folder**,
i.e. `git rev-parse HEAD:<path>` in a clone, not a content hash and not
`git write-tree` on the installed copy:

```bash
git clone --depth 1 https://github.com/mattpocock/skills.git /tmp/mp-skills
cd /tmp/mp-skills && git rev-parse HEAD:skills/engineering/codebase-design \
  HEAD:skills/engineering/domain-modeling HEAD:skills/engineering/retro
```

To install on a fresh machine, copy the folders into `~/.agents/skills` and
write entries of that shape. Sync afterwards with `npx skills update -g`.

**Re-apply after every sync:** nothing. Check `codebase-design/DESIGN-IT-TWICE.md`
and `domain-modeling/*-FORMAT.md` still exist, since sibling skills cite those
files by name.

### mattpocock/skills `animatic-skill` branch — pinned to an unmerged PR

`animatic` (model-invoked) and `setup-animatic` (user-invoked) make a narrated video of
still frames: Playwright frames, TTS, ffmpeg, one command. Added 2026-11-13 at branch
`animatic-skill` `7100905`, PR [mattpocock/skills#1422](https://github.com/mattpocock/skills/pull/1422)
still open, so neither is on `main` and no lock entry is possible: `npx skills add
--skill=` resolves against `main` only, and a hand-written folder hash for a branch would
make `npx skills update -g` fail. Vendored by hand instead:

```bash
git clone --depth 1 --branch animatic-skill https://github.com/mattpocock/skills.git /tmp/mp-animatic
for s in animatic setup-animatic; do
  rm -rf ~/.agents/skills/"$s"
  cp -a /tmp/mp-animatic/skills/in-progress/"$s" ~/.agents/skills/"$s"
done
```

**Re-apply after every sync:**

1. To bump, change the branch's HEAD; when PR 1422 merges, replace this section with lock
   entries and move both folders to the top of the lock file (`skillFolderHash` =
   `git rev-parse HEAD:skills/in-progress/animatic`, per the mattpocock note above).
2. `setup-animatic/SKILL.md` sets `disable-model-invocation: true` on purpose: it is
   `/setup-animatic`, never auto-invoked, and it must sit beside `animatic` because
   `animatic/SKILL.md` links `../setup-animatic/{VOICE,RENDERER}.md`. Install or drop the
   pair together.
3. Runtime deps are per-machine, not per-skill: `ffmpeg` and `node` 18+, and the voice
   either a keyed API / `edge-tts` / `kokoro` (`setup-animatic` writes the choice into each
   repo's `docs/agents/animatic.md`). The scripts install their own Playwright and Kokoro
   into `~/.cache/animatic` on first `build`; a bare `npx` Chromium does not cover it.
4. `docs/agents/animatic.md` (branch `animatic-config`) is the seed the setup skill writes
   into a repo. It is not a skill and is not installed here.

### react-doctor — the package ships it, the repo links must follow

Added 2026-11-11 from the `react-doctor` npm package (currently 0.9.23), whose
`dist/skills/react-doctor/` is the installable skill. The first copy took only
`SKILL.md`, which left `references/explain.md` dangling, so keep the whole folder:

```bash
cd /tmp && npm pack react-doctor@latest && tar -xzf react-doctor-*.tgz
rm -rf ~/.agents/skills/react-doctor
cp -a package/dist/skills/react-doctor ~/.agents/skills/react-doctor
```

No lock entry, so `npx skills update -g` never touches it. The package version
moves with the CLI's releases; re-diff `SKILL.md` against the tarball before
assuming a local copy is current.

### caldoai/skills — untangle-codebase, prune-tests

`untangle-codebase` added 2026-11-05; `prune-tests` added 2026-11-17 (both Maze,
MIT — one `licenses/caldo-LICENSE` covers the source). Locked, so
`npx skills update -g` maintains them; each entry's `skillFolderHash` is the
**upstream** tree SHA (`git rev-parse HEAD:skills/<skill>`), not the hash of the
installed copy. That is deliberate: it keeps `update` from firing and overwriting
the local step-5 edit below while upstream is unchanged. When upstream does
change, take the update and then re-apply:

1. `untangle-codebase`, step 5 ("Check, and repeat until done") is rewritten locally: every
   subagent runs in the background, and a refactoring subagent must deslop/simplify its own
   changes and run the project's own lint/test/build before reporting back. Upstream assumes
   foreground subagents, which blocks the session — keep the local wording.
2. `untangle-codebase` overlaps `improve-codebase-architecture` (deepening candidates),
   `refactor-clean` (sediment) and `thermo-nuclear-code-quality-review` (structural review).
   It is the only one that runs a whole-repo sweep to completion, so keep the distinction in
   mind rather than letting the four converge.
3. `prune-tests` is vendored verbatim — no local edits, so an update needs no re-apply. It
   is single-file and covers the test suite only: `tdd` writes tests, `prune-tests` deletes
   the ones that guard no behavior, and `review-changes` still owns correctness review.

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

## Modification state

The tier table says where a skill came from; this says whether the installed copy is safe to
re-copy. Keep it current when applying updates.

| State | Skills | Re-copy rule |
|---|---|---|
| **VERBATIM** — byte-identical to upstream | chisle, chisle-audit, chisle-help, chisle-review, codebase-design, domain-modeling, fix-merge-conflicts, frontend-god-mode, grill-me, grill-with-docs, improve-codebase-architecture, prototype, prune-tests, retro, socratic-tutor, setup-matt-pocock-skills, tdd, thermo-nuclear-code-quality-review, triage, web-design-guidelines; animatic, setup-animatic, react-doctor, shrink-anything, agents-sdk, cloudflare-email-service, cloudflare-one, cloudflare-one-migrations, durable-objects, sandbox-stable, turnstile-spin, workers-best-practices, wrangler; ratchet-files, refactor-change, find-state-machines, find-overengineering | safe: `rm -rf` + `cp -a`, then refresh the lock hash |
| **LOCAL-EDIT** — re-apply the note after every sync | `chrome-devtools-axi` (`bunx` not `npx -y`); `untangle-codebase` (step-5 background subagents/deslop); `sandbox-next` + `sandbox-migrate-to-next` (per-topic `1-0-preview/*` routes); `web-perf` (`bunx chrome-devtools-axi` preference merged into the MCP workflow); `unslop-ui` (user-invoked flags, `scripts/`, `tokens.md`/`unslop-fallback.md`); `cloudflare` (~29 `references/*` dirs, de-linked `nextjs-on-cloudflare`) | never take a full sync blindly |
| **DESLOPPED / REWRITTEN** — started upstream, replaced locally | `deslop` (561-line local scanner vs the 22-line upstream stub) | never re-copy; `npx skills ls -g` must report `Source: local` |
| **LOCAL** — hand-written, no upstream | the remaining hand-written skills; the harness generates the catalog from their frontmatter | never auto-update |

Lock hashes refreshed 2026-11-24 for `grill-me`, `grill-with-docs`, `prototype` and
`triage`; their content was already identical to upstream.

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

Not installed, available upstream: `code-review`, `implement`, `implement-spec`, `pr`,
`research`, `retro`, `wayfinder`, `wizard`, `handoff`, `teach`, `to-questionnaire`, and
misc `git-guardrails-claude-code`, `migrate-to-shoehorn`, `scaffold-exercises`,
`setup-pre-commit`.

### browser-harness was removed (2026-11-17)

The vendored `browser-harness` skill, its `~/Developer/browser-harness` clone and
the editable `harness` uv tool are gone; the user had never used it. If it is
ever restored, vendor `SKILL.md` as a real file (not a symlink), re-apply the
local preference header, and re-clone the upstream for `domain-skills/`.

### Skills that are intentionally broken

`playwright-interactive` depends on `js_repl`, removed from Codex. Kept as reference with
a warning banner. `playwright` is the working path.

### In-repo conventions

- `AGENTS.md` documents the install and Cloudflare-sync procedure. Update it when tiers change.
- The harness generates the skill catalog from on-disk frontmatter; `AGENTS.md` no longer
  embeds one (it was hand-maintained and drifted).
- `safe-restart-check` is project-scoped to `~/repos/t3code-web-setup`, not this repo.
