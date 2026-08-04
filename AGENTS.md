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

## Committing

After adding or editing a skill, keep the git worktree clean:

```bash
git add <skill>/ && git commit -m "<plain sentence describing the change>" && git push origin master
```

Example commit messages: `Add agent-reach skill for multi-platform internet research`