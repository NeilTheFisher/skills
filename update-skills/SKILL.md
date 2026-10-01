---
name: update-skills
description: Audit and update the vendored skills in ~/.agents/skills against their upstream repos (mattpocock/skills, cloudflare/skills, cursor/plugins, vercel-labs/agent-skills), then fix locally-authored skills for stale tools, dead references, and broken frontmatter. Use when asked to update skills, check skills for updates, sync vendored skills, refresh the skills repo, or audit skills for staleness. Also run before `npx skills update`, which can silently destroy local work.
---

# update-skills

Refresh the skills repo without losing local work. Run this instead of `npx skills update`.

`npx skills update` is unsafe here: it overwrites by lock-file path, so it deletes local
edits, resurrects skills that were renamed or removed upstream, and never touches skills
with no lock entry. This skill audits first, then applies changes deliberately.

Repo: `~/.agents/skills` (git, remote `github.com/NeilTheFisher/skills`), symlinked as
`~/.claude/skills`, `~/.codex/skills`, `~/.config/opencode/skills`.

Full per-source inventory, landmine list, and worked examples: `references/sources.md`

## 1. Snapshot before anything

```bash
cd ~/.agents/skills
git status --short                       # must be clean; if not, ask before proceeding
tar czf /tmp/skills-pre-update.tar.gz --exclude=.git .
python3 -c "import json;print(sorted(json.load(open('/home/nfisher/.agents/.skill-lock.json'))['skills']))"
ls -d */ | sed 's|/||' | sort > /tmp/skills-on-disk.txt
```

Record which skills have a lock entry — that set is exactly what `npx skills update`
would overwrite. Anything without an entry it will silently ignore.

## 2. Split skills into three tiers

| Tier | Meaning | Update path |
|---|---|---|
| **Locked** | In `.skill-lock.json` | `npx skills update`, but verify first |
| **Untracked-vendored** | Copied from upstream, no lock entry | Manual copy from a clone |
| **Local** | Hand-written | Never auto-update; audit for staleness only |

Untracked-vendored is the dangerous tier: nothing updates it, so it rots silently.
Find them by diffing on-disk skills against lock keys.

## 3. Audit each upstream

Clone to `/tmp`, then diff whole skill *folders* (references/ and scripts/ matter as much
as SKILL.md). Classify every difference — this classification is the whole point:

- **BEHAVIOUR CHANGE** — real upstream change; needs a decision
- **COSMETIC** — safe to take
- **LOCAL-MODIFICATION** — *we* diverged; upstream update would destroy local work

Flag LOCAL-MODIFICATION loudly before any update. Upstream being unchanged is a finding,
not a non-result.

Also check for: skills **renamed or deleted** upstream, **new** upstream skills, and
**renamed conventions** (e.g. a doc filename every skill now expects under a new name).

## 4. Report before applying

Present findings as: skill | upstream newer? | files changed | classification, plus
explicit warnings for local modifications, renames, and new skills. Ask which to apply.
Never apply a full sync without confirmation when it deletes reference material.

## 5. Apply deliberately

- Renames: `git mv` the directory **and** fix the `name:` field in frontmatter — upstream
  often renames the folder but leaves `name:` stale, which makes the CLI report the old
  name against the new path.
- Deletions: verify the skill was deleted *upstream*, not just by us.
- Lock file: after any rename/delete, remove the stale entry. Otherwise the next
  `npx skills update` resurrects the old name.
- Untracked-vendored: `rm -rf` then `cp -a` from the clone, then re-apply local edits.
- New dependencies between skills: if skill A became a shim requiring new skill B,
  install B in the same pass or A breaks.

## 6. Verify

```bash
cd ~/.agents/skills
# every frontmatter parses and name matches directory
for f in */SKILL.md; do python3 -c "
import yaml,re,pathlib
p=pathlib.Path('$f'); t=p.read_text(errors='replace')
m=re.match(r'^---\n(.*?)\n---',t,re.S)
d=yaml.safe_load(m.group(1)) or {}
assert d.get('name'), 'no name'
" || echo "FAIL $f"; done

# no broken internal links (skip fenced code blocks and blockquotes)
# shellcheck every bundled script; actually execute --help on scanners

npx skills ls -g | grep -iE "yaml|parse error|skipped"   # must be empty
npx skills ls -g | grep -c "skills/"                      # sanity count
git status --short                                          # only intended changes
```

Unquoted `:` inside a `description:` breaks YAML and makes the CLI skip the skill
entirely. Quote any description containing a colon.

## 7. Commit

One line, why-focused, no body. Then push.

```bash
GIT_EDITOR=true git commit -m "<reason for the change>"
GIT_EDITOR=true git push origin master
```

## Auditing local skills for staleness

Check these classes; each has bitten this repo before:

- **Wrong model/tool ids.** Verify with `command -v`, `opencode models`,
  `bunx mcporter list <server> --brief`, `gh issue/pr view`. Never trust a remembered id.
- **Tools that no longer exist.** Compare every claimed tool against the real server
  listing; renamed tools look plausible and fail silently.
- **Facts that expired.** PR/issue status, version pins, dated claims. Re-query live.
- **Contradictions with `~/.config/opencode/AGENTS.md`.** The global rules win; fix the skill.
- **Absolute paths and dangling symlinks.** `git ls-files -s` shows mode `120000` for
  symlinks — those break on any other clone. Vendor the file instead.
- **One-way sync hazards.** Before scripting a copy that overwrites, diff what each side
  holds; check for keys present on the destination but not the source.
- **Scattered copies.** Real copies in other agent home dirs diverge silently. Prefer
  symlinks to this repo; check `find ~ -maxdepth 4 -type d -name skills`.
- **Stale skill catalogs.** Regenerate the `skills:start` block in AGENTS.md from what is
  actually on disk; verify every listed name exists.

## Rules

- Never run bare `npx skills update` on this repo.
- Never delete a skill that holds hard-won environment data (package ids, API keys paths,
  device quirks) just because it looks unused — ask first, and say what would be lost.
- Ask before any change that deletes reference material.
- Prefer progressive disclosure in SKILL.md: keep it a lean router, push detail into
  `references/`, keep scripts where they cost no context until executed.
