# Skills Repo

<!-- Repo: git clone git@github.com:NeilTheFisher/skills.git → lives at ~/.claude/skills -->

This repo (`NeilTheFisher/skills`) is the single shared skills directory. It is
the git root that Claude (`~/.claude/skills`), Codex (`~/.codex/skills`), and
opencode (`~/.config/opencode/skills`) all point at via symlink, so every
skill added here is automatically available to all three agents. Do not mirror
or copy skills into per-agent directories.

## Installing a new skill

By default `npx skills ...` scatters the skill across ~50 agent directories
(`--agent '*'` with `--copy` copies real files everywhere). To keep the repo
as the single source of truth, ALWAYS restrict the install to Claude:

```bash
npx skills add <owner>/<repo>@<skill> -g --agent claude --copy -y
```

The skill then lands at `~/.claude/skills/<skill>/` and is shared to Codex and
opencode via their symlinks. Do NOT use `--agent '*'` or `--all`.

If a previous wide install already scattered copies, remove every copy outside
`~/.claude/skills/` (resolve paths with `readlink -f` so symlinked codex/opencode
dirs are skipped), strip the stale entry from `~/.agents/.skill-lock.json`, and
clean up any empty agent home dirs / `skills/` dirs the CLI created.

## Skills NOT tracked by the CLI

The Cloudflare family (`agents-sdk`, `cloudflare`, `cloudflare-one`,
`cloudflare-one-migrations`, `cloudflare-email-service`, `durable-objects`,
`sandbox-next`, `sandbox-stable`, `sandbox-migrate-to-next`, `turnstile-spin`,
`web-perf`, `workers-best-practices`, `wrangler`) was installed by hand and has
no `.skill-lock.json` entry, so `npx skills update` will never touch it. Sync it
manually from `https://github.com/cloudflare/skills`:

```bash
git clone --depth 1 https://github.com/cloudflare/skills.git /tmp/cf-skills
for s in agents-sdk cloudflare cloudflare-one cloudflare-one-migrations \
         cloudflare-email-service durable-objects sandbox-migrate-to-next \
         sandbox-next sandbox-stable turnstile-spin web-perf \
         workers-best-practices wrangler; do
  rm -rf "$s" && cp -a "/tmp/cf-skills/skills/$s" "$s"
done
```

Two local edits must be re-applied after every sync:

- `sandbox-next/SKILL.md` and `sandbox-migrate-to-next/SKILL.md` — upstream commit
  `41e0d19` collapsed ~15 distinct `1-0-preview/*` routes into a single generic
  `sandbox/index.md`. Restore the per-topic routes.
- `browser-harness/SKILL.md` is vendored from `~/Developer/browser-harness`
  (`github.com/browser-use/browser-harness`, MIT) and carries a local header.

`deslop` is likewise local-only (deliberately removed from the lock file). Its
upstream `cursor/plugins` copy is a 22-line stub; never run `skills update`
against it.

## Committing

After adding or editing a skill, keep the git worktree clean:

```bash
git add <skill>/ && git commit -m "<plain sentence describing the change>" && git push origin master
```

Example commit messages: `Add agent-reach skill for multi-platform internet research`