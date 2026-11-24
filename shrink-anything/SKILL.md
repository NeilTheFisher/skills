---
name: shrink-anything
description: Make a codebase smaller without changing what it does - remove dead code, dead files, unused dependencies and duplicated code in any mix of languages, keeping each cut only if the project's own tests still pass. Use when the user wants less code, a lighter app or bundle, fewer dependencies, a cleanup after AI-generated or legacy code, or asks what in the repo is unused.
---

# shrink-anything

The `shrink-anything` CLI finds what can go, deletes what it can prove dead, and runs the project's check after every cut.
You handle what needs judgment. (The same steps are MCP tools: `shrink_scan`, `shrink_cut`, `shrink_task`, `shrink_verify`, `shrink_undo`, `shrink_report`, `shrink_status`.)

## Loop

1. **Find the check**: the command that fails when the project is broken (`npm test`, `pytest`, `cargo test`, `go test ./...`).
   It must pass before you start. A weak check proves little: prefer the full test suite, and add the type-check or build
   when there is one (`shrink-anything cut -- "npm run build && npm test"`).
2. **Scan**: `shrink-anything scan` (add `--all` for every candidate and why). Changes nothing.
3. **Cut**: `shrink-anything cut -- <check>`. It removes the safe candidates in a batch, runs the check, bisects to the cut
   that breaks it and puts only that one back. Cutting can orphan more code, so it repeats.
   Add `--size dist` (or a binary) to weigh a build output before and after.
4. **The rest is yours**: read `.shrink/TASK.md`.
   - *Duplicates*: keep one copy, make the others use it.
   - *Probably dead*: nothing mentions it, but something could reach it without naming it (a framework convention, reflection,
     a public API). Look for that way in. Delete only if there is none; otherwise leave it and say why.
5. **Verify** after each group of edits: `shrink-anything verify`. If it fails, fix the edit or put it back.
6. **Report**: `shrink-anything report`. Tell the user lines, files, dependencies and tokens before and after,
   and how to undo (`shrink-anything undo`, or `--all`).

## Don't

- Don't edit, delete or skip a test to make the check pass. `verify` fails when fewer tests run than before the first cut.
- Don't rewrite code for style. The goal is fewer lines doing the same thing, with the smallest diff.
- Don't use `--aggressive` on a library without asking: its public names are someone else's to call.
- Don't trust a cut the check can't see. If the project has no tests for an area, say so instead of deleting from it.
