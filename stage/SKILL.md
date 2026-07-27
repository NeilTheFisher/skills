---
name: stage
description: >
  Review and stage changes without committing. Shows git status/diff, stages
  the relevant files, and stops for explicit go-ahead before any commit is
  made. Use when the user wants to prepare a commit cautiously, says "stage
  this" / "stage these changes", or invokes /stage.
---

Run `git status` and `git diff` to see the full picture of unstaged and
untracked changes. Stage the relevant files with `git add <path>` (never `-A`
or `.` blindly) — skip anything that looks like a secret (.env, credentials)
or like unrelated in-progress work, and flag it to the user instead of
silently ignoring it.

After staging, show the user a short summary of what's staged (`git status`
and/or `git diff --stat --cached`) and stop. Do not run `git commit` yourself
under this skill — wait for the user to explicitly say to commit (at which
point defer to the `/commit` skill's rules: 1-line why-focused message, no
co-author trailer).
