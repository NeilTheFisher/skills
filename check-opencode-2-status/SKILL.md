---
name: check-opencode-2-status
description: >
  Check whether OpenCode v2 is supported yet, and the status of the subagent
  resume / cancellation / steering work and the T3 Code OpenCode-v2 support PRs.
  Use when the user asks "is OpenCode 2 ready yet", "can I upgrade to opencode 2",
  "did the opencode v2 PRs merge", "is subagent resume working", "do I still need
  OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS", or wants a status digest of the
  OpenCode v2 tracking PRs/issues. Invoke as /check-opencode-2-status.
---

# check-opencode-2-status

A one-shot status digest for the "should I upgrade to OpenCode 2?" question. OpenCode v2
and T3 Code's support for it move independently, so this checks both sides plus the local
install.

## Run it

```bash
~/.agents/skills/check-opencode-2-status/scripts/check.sh
```

Needs `gh` (authenticated) and `jq`. Read-only — it only queries GitHub and reads local
files.

## What it tracks (and why)

**OpenCode side** — `anomalyco/opencode`:
- **#36423** — the original "no resume or steering for v2 subagents" regression. Resume was
  restored (v2 `subagent` sessions resume via the `sessionID` parameter); the issue is now
  narrowed to **cancellation**. If this closes, cancellation landed.
- **#32425** — interrupt a running subagent: steer / cancel / abort (open).
- **#34947** — dispatch controls on the `task` tool (open).
- **#41914** — `/tasks` view to list and manage parallel background subagents (open).

**T3 Code side** — `pingdotgg/t3code`:
- **#14239** — detect OpenCode 1.x vs 2.x per instance and route by it. **MERGED 2026-10-01.**
- **#14269** — run turns, text, reasoning, tools on OpenCode 2. **MERGED 2026-10-01.**
- **#13008 / #13452 / #13958** — community v2 support PRs; **#12643** — draft.
- The T3 Code PR half is done, so the **model manifest is now the only remaining gate**:
  `apps/server/src/provider/model-manifest.json` declares `>=2.0.0` as `broken` with
  `recommendedRange >=1.14.19 <2.0.0`. While upstream (and the fork) still carry that,
  T3 Code actively refuses a v2 binary and shows the "use 1.14.19" downgrade banner.

## How to read the result

- **Upgrade only when the model manifest stops marking `>=2.0.0` broken.** The T3 Code
  PRs (#14239 → #14269) merged 2026-10-01, and the OpenCode side is already fine for
  resume — the manifest is the single remaining gate.
- **`OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=1` is a v1 flag.** Keep it while on v1.x
  (it gates the background `task` tool and is still required). On v2 it is unnecessary —
  background subagents are native to the `subagent` tool.
- Note the naming trap: the local `opencode-2` wrapper is a *second v1 account* (separate
  `XDG_DATA_HOME`), not OpenCode v2. See `docs/opencode-2.md` in the t3code-web-setup repo.

## Maintaining this skill

The tracked numbers are plain constants near the top of `scripts/check.sh` and repeated in
the link list. When an item merges or a new tracking issue appears, update the script and
the lists above in the same commit.
