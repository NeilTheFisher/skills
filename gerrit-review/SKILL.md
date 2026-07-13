---
name: gerrit-review
description: Fetch a Gerrit change into a local branch and worktree (without checking it out in the main repo) and review it with /code-review. Use when the user pastes a Gerrit change URL or number and wants it reviewed, says "review this gerrit change" / "review change 83559", or describes a change to find ("review Bob's latest change", "review the open change about gallery upload").
---

# Gerrit Review

Fetch a Gerrit change, create a branch WITHOUT checking it out (never touch the user's working tree), add a worktree for it, and run /code-review inside that worktree so review agents can read real files, not just a diff.

## Workflow

Run all git commands with `-C <repo>` where `<repo>` is the repo matching the change's project (check `git remote get-url origin` against the project path in the URL; default to the current working directory's repo).

1. **Resolve the change ref.**

   If given a URL, change number, or number/patchset (looks up latest patchset via ls-remote when omitted):

   ```bash
   read -r REF CHANGE PS < <(bash ~/.claude/skills/gerrit-review/scripts/resolve-change.sh "<input>")
   ```

   If given a description instead ("Bob's latest change", "the change about X"), query Gerrit over SSH. Derive host/port/project from `git remote get-url origin`. `currentPatchSet.ref` is the fetch ref directly:

   ```bash
   ssh -p 29418 nfisher@yul01dvlscm01.summit-tech.org gerrit query --format=JSON --current-patch-set \
     'project:summit/web/bin/spotlight/director status:open owner:<username>' limit:5
   ```

   Useful operators: `owner:`, `message:"..."`, `status:open`, `branch:`, `age:<2d`, `topic:`. Results are newest-first. If more than one change plausibly matches, list them (number, subject, owner) and ask the user which to review rather than guessing.

2. **Fetch and branch** (no checkout):

   ```bash
   git fetch origin "$REF"
   git branch -f "change-$CHANGE-$PS" FETCH_HEAD
   ```

3. **Add a worktree** as a sibling of the repo:

   ```bash
   git worktree add "../<repo-basename>-change-$CHANGE" "change-$CHANGE-$PS"
   ```

   If the worktree path already exists from an earlier patchset, `git -C <worktree> checkout change-$CHANGE-$PS` inside it instead of adding a new one.

4. **Determine the review scope.** A Gerrit patchset is one commit; the review scope is that commit unless the user asks for the whole stack:

   ```bash
   git log --oneline "change-$CHANGE-$PS" -5   # show the user where the change sits
   ```

5. **Invoke the code-review skill** from inside the worktree at the user's requested effort (default: the skill's default). Tell it the scope is the top commit of the current branch (`HEAD^..HEAD`), not the full diff against the main branch, unless the change sits on a stack the user also wants reviewed.

6. **After the review**, remind the user of cleanup:

   ```bash
   git worktree remove ../<repo-basename>-change-$CHANGE && git branch -D change-$CHANGE-$PS
   ```

   Do not clean up automatically; the user may want to poke at the code.

## Notes

- Never `git checkout` or otherwise modify the main repo's working tree; it is often dirty.
- If `git fetch` fails with auth/host errors, the SSH remote needs the user's agent; report the error rather than retrying with variations.
- Multiple changes can be reviewed in parallel; each gets its own branch and worktree.
