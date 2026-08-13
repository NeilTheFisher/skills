---
name: resume-from
description: >
  Resume a conversation that was started in another coding agent. Reads the
  other agent's local session store (OpenCode's SQLite db, Claude Code's
  project JSONL files, or Codex's JSONL rollouts), reconstructs the transcript,
  and continues the work with full context. Use when the user says
  "/resume-from opencode", "/resume-from claude", "/resume-from codex",
  "continue the session from opencode/claude/codex/t3", "pick up where the
  other agent left off", or references a thread they no longer have access to.
---

Recover a session from the *other* agent's on-disk store and continue it here.

Argument: the source agent — `opencode` (aliases: oc, t3, t3-code), `claude`
(aliases: cc, claude-code) or `codex` (aliases: cx, gpt). Anything after the
agent name is a hint for finding
the right session (title words, a date, "the pool game one"). If no agent is
given, infer it: whichever agent you are NOT currently running in.

## Steps

1. **List candidate sessions** for the current project directory (newest first):

   ```bash
   python3 ~/.agents/skills/resume-from/extract.py list <agent>
   ```

   Add `--all-dirs` if nothing matches (the work may have happened in another
   directory), and `--limit 50` for a wider net. Note: OpenCode sessions driven
   from the T3 Code web UI are titled `T3 Code <uuid>` — match on directory and
   recency, not title. Claude and Codex sessions are listed with a snippet of
   the first user message instead of a title. Codex rows spawned as subagents
   are tagged `[subagent <nickname>]`; the parent thread is usually the one you
   want, but a subagent transcript is where its detailed work actually happened.

2. **Pick the session.** Prefer the newest session in the current directory
   that matches the user's hint. If two or more are plausible, show the user
   the shortlist and ask which one — do not guess between similar candidates.

3. **Dump the transcript**:

   ```bash
   python3 ~/.agents/skills/resume-from/extract.py dump <agent> <session-id>
   ```

   This writes a markdown transcript to /tmp and prints the path. For Codex,
   any images the user pasted are decoded into
   `/tmp/resume-from-<id>-images/` and referenced inline as
   `[attached image: <path>]` — open those with the Read tool, since screenshots
   are often the whole point of the original report.

4. **Read the transcript** (it can be large — read in chunks). Extract:
   - the user's original goals and any constraints or preferences they stated
   - decisions made along the way and *why* (these override your defaults)
   - what was completed vs. in flight when the session ended
   - workarounds/gotchas discovered (e.g. tool X crashes, use Y instead)

5. **Reconcile with reality.** The transcript reflects the past — check the
   working tree (git status, key files) to see what actually exists now before
   acting on it.

6. **Summarize what you recovered** to the user in a few sentences (goal,
   state, next step), then continue the work from where it stopped.

## Store locations (for debugging)

- OpenCode: `~/.local/share/opencode/opencode.db` — SQLite, tables
  `session` / `message` / `part`, JSON in the `data` columns.
- Claude Code: `~/.claude/projects/<munged-cwd>/<session-id>.jsonl` — one JSON
  entry per line; `<munged-cwd>` is the project path with `/` and `.` replaced
  by `-`.
- Codex: `~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<id>.jsonl` — one
  JSON entry per line, real content under `type: "response_item"`. The `cwd`
  lives in the leading `session_meta` entry; forked/subagent rollouts *replay*
  the parent's `session_meta`, so only the first one describes the file you're
  reading, and its `session_id` points at the parent while `id` is its own.

If the extractor fails (schema drift after an agent update), fall back to
querying the store directly with `python3` + `sqlite3`/`json` and adapt; then
fix extract.py so the skill keeps working.
