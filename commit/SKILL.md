---
name: commit
description: >
  Stage relevant changes and create a git commit with a terse, why-focused
  1-line message, no co-author trailer. Use when the user says "commit this",
  "commit these changes", or invokes /commit. Supports args for amend, split,
  push, and custom messages.
---

Default behavior (no args): stage the relevant tracked files (never `git add -A`
or `git add .` blindly — review `git status` first and skip anything that looks
like a secret or unrelated in-progress work), then create ONE commit with a
single-sentence message focused on why, not what. Never add a `Co-Authored-By`
trailer or any other self-attribution. Never sign commits with `-c
commit.gpgsign=false` or skip hooks. Do not restate the diff in the message —
one line only.

When the commit does warrant bullet points (the user asked for them, or the
change covers several distinct fixes), put a blank line after the first line,
then one `-` point per fix on its own line. Keep the points in plain language
describing the user-visible fix; avoid code jargon and volatile references
(identifiers, CSS selectors, commit hashes) that go stale.

## Args

- No args: stage + commit as above.
- `"<custom message>"`: use the given message verbatim instead of generating one, still 1 line unless the user's text has multiple lines.
- `--amend`: amend the previous commit instead of creating a new one. Only do this if the previous commit has not been pushed (check `git log @{u}..HEAD` or equivalent) — if it has been pushed, warn the user and ask before amending.
- `--split`: the diff covers multiple unrelated concerns — break it into multiple logical commits (stage hunks/files per concern with `git add <path>` or `git add -p`) instead of one commit. Explain the split briefly before committing.
- `--push`: after committing, push the current branch. **Be careful here — this is no longer purely local, it affects shared/remote state.** Confirm the target branch and remote with the user first if there's any ambiguity (e.g. first push of a new branch, or pushing to a shared/protected branch), and never force-push under this flag.

Args can combine (e.g. `--split --push`).

## Notes

- Always run `git status` and `git diff` (staged + unstaged) before composing the message.
- Match the repo's existing commit message style (check `git log` for tone/format).
- If there's nothing to commit, say so — don't create an empty commit.
- If a pre-commit hook fails, fix the issue and create a NEW commit — never `--no-verify`.
