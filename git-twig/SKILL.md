---
name: git-twig
description: Create and manage ordinary linked Git worktrees with git twig, using native copy-on-write to reduce disk use. Use when a task needs an isolated checkout or branch.
---

# git twig

Use `git twig new` in place of `git worktree add`. The resulting checkout is a
normal linked worktree: use ordinary Git commands inside it.

## CLI reference

```text
git twig new [<git-worktree options>] <path> [<commit>]
git twig list [--porcelain [-z]]
git twig remove <path>
git twig move <path> <new-path>
git twig lock [--reason <text>] <path>
git twig unlock <path>
git twig prune [--dry-run] [--verbose] [--expire <time>]
git twig repair [<path>...]

git twig skill
git twig -h
git twig --version
```

- `new`: create an ordinary linked worktree. Supported requests use native CoW;
  other requests use Git's normal checkout.
- `list`: show worktrees in human-readable form. `--porcelain` is Git's stable
  machine-readable format; `-z` uses NUL separators for safe path parsing.
- `remove`: remove a worktree and its registration. Check for changes and ask
  before removing it; do not force removal.
- `move`: move a worktree and update its registration. Ask before moving it.
- `lock`: protect a worktree's registration from pruning, moving or removal,
  for example while an external drive is disconnected. It does not lock files
  or prevent concurrent agent edits.
- `unlock`: remove that protection. Ask before changing a user's lock.
- `prune`: remove stale registrations for worktrees whose directories no longer
  exist, not the working directories themselves. Preview with `--dry-run` and
  ask before pruning.
- `repair`: repair links between the repository and worktrees after directories
  were moved manually. It does not repair file contents or merge conflicts.
  Ask before changing registrations.
- `skill`: print these bundled agent instructions, even outside a repository.
- `-h` and `--version`: print usage or the installed version. Short command help
  such as `git twig new --help` also works outside a repository. Git itself turns
  top-level `git twig --help` into a manual lookup; Homebrew installs that manual,
  while Cargo users can use `git twig -h` or `git-twig --help`.

Standard Git worktree options are passed through. Use `git worktree <command> -h`
for the full options of a delegated command (`new` uses Git\'s `add` options).
Do not invent additional Twig
commands or flags.

## Create a workspace

From the directory containing a source checkout named `main/`:

```sh
git -C main twig new -b feat/x ../feat-x HEAD
cd feat-x
```

`-C main` selects the source checkout; `../feat-x` is resolved relative to it.
The fast copy only applies to that checkout\'s current `HEAD`, not an arbitrary
older commit or another checkout\'s branch. Other revisions use stock Git.

For a detached checkout:

```sh
git twig new --detach ../experiment HEAD
```

Use an explicit `-b` or `--detach` to enable the CoW path. Choose a new destination;
never overwrite an existing directory. Run tests and make commits in the new
worktree as usual. `git twig list` lists worktrees. Add `--porcelain` only when
parsing the output in a script.

## Know what is copied

- Only committed tracked files are included. Local edits and untracked/ignored
  files are excluded; tracked secrets are copied like any other tracked file.
  Install dependencies when needed.
- Native CoW needs macOS/APFS or Linux on Btrfs or reflink-enabled XFS. Source,
  destination and Git metadata must share a clone-capable filesystem. Creating at the source\'s HEAD
  is the optimized case. Other requests use stock Git.
- CoW shares file data, not writes. It is not a sandbox and is not always faster.
- To inspect backend selection, set `TWIG_TRACE=1` on the create command.

## Cleanup safely

Ask before removing a worktree or discarding changes. Check `git status` first;
never force removal, prune registrations or delete retained staging blindly.
After approval, use `git twig remove <path>`.

Staging lives under the common Git directory in `twigs/staging`. A successful
create removes only its own staging. Failed/interrupted attempts retain diagnostic
state; inspect `git twig list` and the reported staging paths, since a partial
worktree may already be registered. Do not retry into it or delete it automatically.
Older sibling staging folders are not swept or deleted by new commands.
