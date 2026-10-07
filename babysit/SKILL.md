---
name: babysit
description: >
  Babysit a pull request / merge request / change request until it is ready:
  act only on feedback newer than your last push, verify each finding against
  the source, fix the real ones, dismiss false positives with a written reason,
  keep CI green, and stop when reviewers are green on the latest commit. Use
  when the user says "babysit", "watch the PR", "get this merged", or "address
  the review comments". Takes an optional PR/MR/CR URL or number.
---

# Babysit a change request

Loop until the reviewers are green on the latest commit:

1. Wait for CI. Fix real failures; re-run infra flakes.
2. Triage new comments — only those newer than your last push. Open the cited
   file/line and reproduce the failure yourself before changing anything.
   Reading the comment is not verification.
3. Fix real, in-scope findings minimally; batch everything into one push.
4. Reply to every thread: `Fixed in <sha>: …` or `Not applicable: <reason>`.
   No filler comments.
5. Push, then repeat.

Rules:

- Don't scope creep. Dedupe — several bots often flag the same line.
- Bots are advisory; a human finding is decisive. Never dismiss one silently.
- Use the platform's own watcher (T3 Code: `watch_pull_request`); never write a
  poll/sleep loop.
- Stop when CI is green and no unresolved actionable threads remain on the head
  SHA — but the merge is the maintainer's call, not bot-green. An unsolicited
  feature needs prior maintainer approval.
- If a competing change makes this one obsolete, stop and report.
