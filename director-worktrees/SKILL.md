---
name: director-worktrees
description: Work on a Summit Director branch in a git worktree instead of the main checkout, then build, lint, and test it there. Use when the user asks to "do this in a worktree", "branch/work on this without touching my working tree", "test my change/branch", or when the main checkout of director-api, director, or router is dirty, mid-feature, or being driven by a running container. Covers creating the worktree from origin/develop, the worktree-specific husky/commit-msg hook breakage, running director-api tests against the worktree in an ephemeral container, and optionally previewing the branch in a second container in the browser. Not for reviewing a Gerrit CR's code (use gerrit-review).
---

# Director Worktrees

Work on a branch in a **sibling worktree** so the main checkout stays untouched. Applies
to `director-api` (Elysia/Bun), `director` (legacy PHP), and `router` (Node/yarn), under
`~/repos/summittech/` (adjust if your checkouts live elsewhere).

> **Treat this as a starting point, not a fixed script. Adjust it to the repo and task.**
> Only the `director-api` path is verified; `director` and `router` differ (container,
> package manager, DB). When you run it elsewhere, fix or extend this skill so the next
> run is shorter.

## Why a worktree

The running containers bind-mount the **main** checkout: `director_api_v2` mounts
`../director-api:/app` (compose project in `~/repos/summittech/director`), and
`director_web` / `director_api` mount the `director` checkout. So
`docker exec <container> ...` always tests main, never a branch, and main is often dirty
or on someone else's feature branch. Never edit or `git checkout` in it.

## Create the worktree

```bash
REPO=~/repos/summittech/director-api        # or .../director, .../router
WT=~/repos/summittech/director-api-<slug>
git -C "$REPO" fetch origin develop
git -C "$REPO" worktree add -b <type>/<slug> "$WT" origin/develop
```

Use a sibling path, never inside the repo. One concern per branch.

## director-api: deps and hooks

A fresh worktree has no `node_modules` (bun's isolated linker puts deps per package):

```bash
cd "$WT" && bun install --frozen-lockfile --ignore-scripts
```

`--ignore-scripts` skips `husky`, and `core.hooksPath` is the relative `.husky/_`, which
doesn't exist in a new worktree, so hooks silently don't run. Fix both:

```bash
bunx husky                                     # creates $WT/.husky/_
COMMON=$(git -C "$WT" rev-parse --git-common-dir)
GITDIR=$(git -C "$WT" rev-parse --git-dir)     # .../.git/worktrees/<name>
mkdir -p "$GITDIR/hooks"
ln -sf "$COMMON/hooks/commit-msg" "$GITDIR/hooks/commit-msg"
```

The symlink is required because `.husky/commit-msg` runs `${gitdir}/hooks/commit-msg`
(empty in a worktree), so the Gerrit Change-Id hook exits 127 and **aborts the commit**.

Lint with the repo scripts (not `bun lint`, not the raw binaries): `bun lint:oxlint`,
`bun fmt`, `bun lint:oxfmt`, `bun lint:biome`.

## director / router

- `director` sets an absolute `core.hooksPath`, so its Gerrit hook works in worktrees.
  It's PHP (composer, migrations). Read the preview section below before running it in a
  container.
- `router` uses yarn and has no husky. If a worktree commit lacks a `Change-Id`, install
  the Gerrit hook into `$(git -C "$WT" rev-parse --git-path hooks)`.

## Test director-api against the worktree

Snapshot the live container's env, then run a throwaway container on the same network,
mounting main (for deps and workspace links) and overlaying only your changed files
read-only. Nothing touches the host.

```bash
docker inspect director_api_v2 --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | sed 's/^ //' > /tmp/director-api.env
IMG=$(docker inspect director_api_v2 --format '{{.Config.Image}}')
MAIN=~/repos/summittech/director-api
DEV_DOMAIN=<dns_record>.dev.plusrcs.com        # from DNS_RECORD in the repo .env

docker run --rm --network director_default \
  --user "$(id -u):$(id -g)" \
  --add-host host.docker.internal:host-gateway \
  --add-host "$DEV_DOMAIN:host-gateway" \
  --env-file /tmp/director-api.env --entrypoint sh \
  -v "$MAIN":/app \
  -v "$WT/<changed-file>:/app/<changed-file>:ro" \
  "$IMG" -c "cd /app && bun test packages/api/test/stream.test.ts"
```

- Both `--add-host` lines are required, or the parity tests can't reach the legacy API
  (`ConnectionRefused` on `/device/login`).
- Add one `-v` per changed file. `bun test <file>` applies the `bunfig.toml` mocks;
  `run test` runs everything.
- Parity tests hit the legacy PHP API (`DIRECTOR_URL`, derived from the dev domain) and
  the shared MySQL/Redis, so the legacy stack must be up.

Gotchas:

- A file bind-mount whose target doesn't exist **creates a real file in the main
  worktree**. Delete it after, or mount into an existing path.
- Probe scripts must live under `packages/api/` (isolated linker) to resolve
  `@director_v2/*`.
- `db.execute` returns `[rows, fields]`; prefer raw `sql` for probes.

Parity tests compare HTTP bodies, not side-effect rows. Verify a DB write directly:

```bash
docker exec director_mysql mysql -uadmin -padmin db_spotlight \
  -e 'select id,mcc,mnc,country from discovery_logs order by id desc limit 3'
```

## Preview a branch/CR in a browser (optional)

To verify behaviour, not just tests, run the branch in a **second** container and drive it
in a browser. Never reuse or restart the user's running container.

- Start a container from the same image, on the same network, on a **spare host port**,
  with the branch's worktree bind-mounted instead of main. Generate the mount block from
  the running container's `.Mounts` and re-point the sources at `$WT`. Prefer a standalone
  compose file in `$WT` (or `docker run`); a compose *override* would change the user's own
  `up`.
- **DB isolation is the hazard.** Entrypoints often run migrations on boot, so a second
  container pointed at the dev DB applies the branch's schema to the user's data. Use a
  throwaway MySQL/Redis seeded from dev (distinct names, separate Redis prefix) or disable
  migrations; touch the real DB only with explicit consent. A separate database *name* is
  not isolation.
- Wait for healthy, curl the login/root, then drive it in Chrome (chrome MCP) or the
  `playwright` skill.
- Clean up unconditionally: `docker rm -f` your container(s), remove only your throwaway
  volumes by name (never `docker volume prune -a`), and remove the worktree.

Director-specific local gotchas when driving that container:

- `MultipleDomains` 404s unless `Host` is `DIRECTOR_PUBLIC_IP`; use
  `http://<DNS_RECORD>.dev.plusrcs.com:<port>`, not `127.0.0.1`.
- Router socket ports (9999 private, 8888 public) aren't published, so walls/presenters
  never get `EventInfo`/`DevicesList`. Forward host → router container IP (small TCP proxy).
- Chromium HTTPS-First upgrades `http://host:port` (incl. POSTs) to https and fails, and
  `config/session.php` hardcodes `'secure' => true`, so authenticated pages can't use the
  http port. Front the container with a TLS proxy using traefik's existing Let's Encrypt
  cert (base64 `certificate`/`key` for the dev host under `myresolver` in the
  `director_letsencrypt` volume's `acme-production.json`) and send `X-Forwarded-Proto:
  https`. Browse `https://<DNS_RECORD>.dev.plusrcs.com:<proxyport>`; Secure cookies and
  `wss:` router sockets then work.

To preview a specific Gerrit CR, fetch it with `gerrit-review` first, then run this on that
worktree.

## Commit and clean up

```bash
git -C "$WT" add <files>
GIT_EDITOR=true git -C "$WT" commit -m "<conventional subject>"
```

Conventional title, one concern, no co-author trailer. Never `--no-verify`; the
pre-commit hook regenerates the OpenAPI spec. Don't push or open a PR unless asked.
Remove the worktree only when asked: `git -C "$REPO" worktree remove "$WT"`.

The hook only regenerates when something under `packages/api` is **staged**. A bare
`--amend` (e.g. the `git wip` / `git ready` aliases) prints "no staged changes ... skipping".
That's normal, not a broken hook. And a change that only touches services/repos (not
route schemas) legitimately produces no `openapi.json` diff.

## Guardrails

- Never edit, checkout, stash, or commit in the main worktree.
- Never stop, restart, or rebuild `director_api_v2`, `director_web`, or `traefik`.
- The env-file may contain secrets: keep it in `/tmp`, never echo or commit it.
