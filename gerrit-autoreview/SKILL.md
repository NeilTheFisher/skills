---
name: gerrit-autoreview
description: Start a polling loop that watches Gerrit for new patchsets on a project and auto-reviews each one with the gerrit-review workflow. Use when the user says "start auto-reviewing gerrit changes", "watch gerrit and review new CRs", or invokes /gerrit-autoreview. Stop with "stop auto-reviewing".
---

# Gerrit Auto-Review

Continuously watch a Gerrit project for new patchsets and review each one automatically. Uses polling (the account lacks the Stream Events capability; if it is ever granted, switch to `gerrit stream-events -s patchset-created` filtered by project).

## Each cycle

1. **Poll** (dedupes against `~/.cache/gerrit-autoreview/<project>.seen`; first ever run just seeds the baseline):

   ```bash
   bash ~/.claude/skills/gerrit-autoreview/scripts/poll-new-changes.sh
   # optional args: [project] [host] [extra-query, e.g. '-owner:nfisher']
   ```

   Output lines: `<change> <patchset> <ref> <owner> <subject>`. No output = nothing new.

2. **Review each new patchset** using the gerrit-review skill's workflow: fetch the ref, `git branch -f change-<n>-<ps> FETCH_HEAD` (never checkout in the main repo), add/reuse a sibling worktree, then spawn one review agent per change (in parallel if several) telling it to review the worktree's top commit (`HEAD^..HEAD`) for correctness bugs, following the /code-review skill's approach. Skip changes owned by the user themselves unless asked otherwise.

3. **Report** findings to the user per change: change number, subject, owner, and the verified findings (or "clean"). Do NOT post anything to Gerrit; findings stay local unless the user explicitly asks to publish them via `gerrit review`.

4. **Schedule the next cycle** with ScheduleWakeup: delay 300s when changes were found, 600s when quiet, prompt `/gerrit-autoreview`, reason "polling Gerrit for new patchsets". If the user asks to stop, call ScheduleWakeup with `stop: true`.

## Notes

- Review worktrees accumulate; after reporting, remove each change's worktree and branch (`git worktree remove`, `git branch -D`) unless findings were reported, in which case leave it for the user to inspect and say so.
- If SSH fails (VPN down, host unreachable), report once and schedule a longer retry (900s); do not spam retries.
- Never review the same change/patchset twice; the seen-file is the source of truth. A new patchset on a previously reviewed change IS reviewed again.
