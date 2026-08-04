---
name: opencode-subagent
description: Delegate a coding task to an opencode subagent (opencode run) in the background, capture its full log to a file, and open that log in VS Code Insiders (code-insiders -r) when it finishes. Use when the user says "/opencode-subagent", "use opencode for this", or wants to offload work to opencode to save Claude usage. Pass "no logs" in the args to skip opening the log.
---

# opencode subagent

Offload a task to `opencode run` while keeping the log reviewable in the
user's editor. opencode EDITS FILES DIRECTLY in the working tree; treat it
like an eager but unsandboxed contributor whose work must be verified.

## Workflow

1. **Compose the prompt.** Include the constraints opencode cannot infer:
   target runtime versions (e.g. "PHP 7.4: no nullsafe, no match, no
   string-keyed array spread"), module system (plain ES modules via
   importmap, no build step), house style (no .forEach, createElement-as-h,
   Valtio in-place mutation), and what must not change (ids, classes, routes,
   payload shapes). Tell it which project checks to run and to NOT commit.

2. **Write the prompt to a file first** (multiline strings inline in a
   background command silently kill the launch).

3. **Launch opencode AND open the log in ONE background bash call.** Create
    the log, open it in the editor, then run opencode into it, chained with
    `&&` in a single command so the editor is already tailing the file before
    opencode writes a byte. Do not split this into two tool calls.

    Use `--model` to select a model (e.g., `deepseek/v4-flash-free`):
    ```bash
    L=<scratchpad>/opencode-<slug>.txt; : > "$L" && { code-insiders -r "$L" || code -r "$L"; } && opencode run "$(cat <scratchpad>/prompt.txt)" --model deepseek/v4-flash-free >> "$L" 2>&1
    ```

   Use the session scratchpad and the shell tool's background mode so other
   work can continue. Skip the `code-insiders` half if the args said "no
   logs". Confirm liveness by watching the log file grow, not by ps (the
   process name may differ).

   When the run completes, write an ANSI-stripped copy and open that for
   comfortable reading:

   ```bash
   sed -e 's/\x1b\[[0-9;]*m//g' opencode-<slug>.txt > opencode-<slug>-log.txt && rm -f opencode-<slug>.txt && code-insiders -r opencode-<slug>-log.txt
   ```

   Delete the raw ANSI file once the stripped copy exists - keeping both just
   doubles the clutter. Prune stale logs from earlier sessions in the same
   command (7 days is old enough that nobody still has it open):

   ```bash
   find /tmp/claude-*/*/*/scratchpad -maxdepth 1 -name 'opencode-*.txt' -mtime +7 -delete 2>/dev/null
   ```

4. **Verify its work yourself.** opencode validates against the HOST
   toolchain, not the project's runtime. At minimum:
   - `git status` / `git diff --stat` to see what it actually touched
   - project lint with the REAL runtime (e.g. `docker exec <container>
     php -l ...`), `deno check`, `node --check`
   - a quick behavior smoke test of the affected flows
   Known failure mode: changes that lint clean but break at runtime on the
   older interpreter (e.g. PHP 8 string-keyed spread on a 7.4 container).

5. **Report** what opencode changed, what you verified, and anything you had
   to fix or revert.

## Rules

- Never let opencode commit, amend, or push; that stays with the main agent.
- If the log shows it stopped early or asked a question, rerun with a more
  specific prompt instead of hand-finishing silently.
