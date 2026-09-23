---
name: deslop
description: >-
  Removes surface tells that make code read as AI-written and flags structural
  tells a linter misses (boilerplate, hallucinated APIs, over-engineering, code
  that ignores the surrounding repo). Grounded in a Reddit analysis of 11,906
  posts and 11,306 comments across 55 subreddits.
---

# deslop - remove AI-written-code tells

This skill removes surface cues (chat artifacts, placeholder comments, emoji, swallowed
errors, narrating comments, generic names) and points at structural tells no regex can
catch. It does not enforce a style. Whether the code is correct and well-factored is
still your call.

Every rule weighted by verified share of Reddit comments that named it across 55 AI,
coding, and SaaS subreddits.

## How this differs from a linter

A linter enforces style; a formatter makes everything uniform (itself a tell). This
skill finds the specific giveaways developers cite, ranked by frequency. The highest-
ranked tells are structural - no regex can catch them.

## The over-correction trap

Told to "write clean code," a model over-corrects: defensive checks for impossible cases,
a type on every local, a comment on every block, an abstraction for one caller. Performed
seniority is its own tell. Match the level the surrounding code operates at. Add nothing
the neighboring code would not have.

## Mode 1: Build (prevent slop)

Before generating, establish:

- **The surrounding code.** Give the model the files it will sit next to. This single
  input does more than every other rule combined. The most repeated fix in the data:
  "make it follow the existing code instead of guessing the average."
- **The real requirement.** What the code actually does, including failure modes. Vague
  requirements get the sample-app shape.
- **Calls that exist.** Check every import against real docs. Hallucinated APIs break
  in production.
- **The right level.** A simple if/else is fine.

See `references/fitting-the-codebase.md` for the full method.

## Non-code text (commit messages, PR descriptions)

The scanner's `--git` flag can flag tells in commit messages, but **do not auto-fix
commit history**. When `--git` finds issues, report them to the user and let them decide
whether to amend. The model must also apply these rules to all prose it writes (PR
descriptions, comments) before committing — no em dashes, no curly apostrophes, no
emoji, no narrating.

## Mode 2: Audit (remove slop)

**1. Build, type-check, lint.** This catches hallucinated APIs - the #2 tell. No regex
can see them.

**2. Run the scanner** for surface tells:

```bash
python3 scripts/unslop_code_scan.py <path>
python3 scripts/unslop_code_scan.py <path> --severity high
python3 scripts/unslop_code_scan.py <path> --json
```

Covers Python, JS/TS, Java, Go, Rust, Ruby, PHP, C/C++, C#. Exit code = high-severity count.

Optionally scan recent commit messages (opt-in, flag only — do not amend):

```bash
python3 scripts/unslop_code_scan.py --git HEAD              # latest commit
python3 scripts/unslop_code_scan.py --git HEAD~3..HEAD      # last 3 commits
```

**3. Read the diff** for structural tells: boilerplate (18.6%), over-engineering (7.8%),
code that ignores the repo (3.5%), mixed skill level (1.9%). Only a human can judge these.

Lines containing `unslop-ignore` are skipped. Use when a flagged construct is intentional.

## The tells

### Scanner catches

| Severity | Class | Tell | Share |
|----------|-------|------|-------|
| MEDIUM | cosmetic | Narrating / step-by-step comments | 8.5% |
| MEDIUM | cosmetic | Emoji in code | 3.9% |
| MEDIUM | cosmetic | Curly apostrophes / em dashes | project convention |
| MEDIUM | bug | Catch-all / swallowed errors | 3.1% |
| MEDIUM | cosmetic | Generic placeholder names | 1.9% |
| HIGH | bug | Placeholder stubs | 1.6% |
| HIGH | cosmetic | Leftover chat artifacts | 1.2% |
| LOW | cosmetic | Over-verbose identifiers | 0.4% |

### Scanner-blind (human/compiler required)

| Class | Tell | Share |
|-------|------|-------|
| substance | Boilerplate / tutorial-shaped code | 18.6% |
| bug | Hallucinated APIs | 11.2% |
| substance | Over-engineering | 7.8% |
| - | "You can just tell" (umbrella) | 17.8% |
| substance | Ignores surrounding codebase | 3.5% |
| - | Too clean, no human mess | 2.3% |
| substance | Mixed skill level | 1.9% |

### Cleared by the data

- Left-in debug logging - ~0% precision
- Reinventing the wheel - ~16.7% precision
- Over-defensive validation - ~40% precision

See `references/tells.md` for the full catalog.

## What "fixed" means

Code has less aesthetic latitude than prose. The question is "is it correct, and does it
match what is already in this project?" A fix that swaps the model's default for your own
invented default is not a fix. A fix that makes the line look like the code around it is.

## Reporting

Lead with the verdict and the highest-impact change. Then findings by priority with
file:line and the fix. Close with the slop score and a reminder that the structural tells
still need eyes.
