#!/usr/bin/env python3
"""Extract conversation transcripts from Claude Code, OpenCode or Codex session stores.

Usage:
  extract.py list opencode [--dir DIR] [--limit N]
  extract.py list claude   [--dir DIR] [--limit N]
  extract.py list codex    [--dir DIR] [--limit N]
  extract.py dump opencode SESSION_ID [--out FILE]
  extract.py dump claude   SESSION_ID [--dir DIR] [--out FILE]
  extract.py dump codex    SESSION_ID [--out FILE]

`list` prints one session per line: id | title | directory | updated (newest first).
`dump` writes a markdown transcript (default /tmp/resume-from-<id>.md) and prints the path.
Codex dumps also write any pasted images to /tmp/resume-from-<id>-images/ and reference
them inline, so they can be opened with the Read tool.
"""

from __future__ import annotations

import argparse
import base64
import datetime
import json
import os
import sqlite3
import sys
from pathlib import Path

OPENCODE_DB = Path.home() / ".local/share/opencode/opencode.db"
CLAUDE_PROJECTS = Path.home() / ".claude/projects"
CODEX_SESSIONS = Path.home() / ".codex/sessions"


def ts(ms_or_s: float) -> str:
    value = ms_or_s / 1000 if ms_or_s > 1e11 else ms_or_s
    return datetime.datetime.fromtimestamp(value).strftime("%Y-%m-%d %H:%M")


# ---------------- OpenCode (SQLite) ----------------

def opencode_list(directory: str | None, limit: int) -> None:
    db = sqlite3.connect(f"file:{OPENCODE_DB}?mode=ro", uri=True)
    query = "select id, title, directory, time_updated from session"
    params: list[str] = []
    if directory:
        query += " where directory = ?"
        params.append(directory)
    query += " order by time_updated desc limit ?"
    for sid, title, sdir, updated in db.execute(query, [*params, limit]):
        print(f"{sid} | {title} | {sdir} | {ts(updated)}")


def opencode_dump(session_id: str, out: Path) -> None:
    db = sqlite3.connect(f"file:{OPENCODE_DB}?mode=ro", uri=True)
    parts: dict[str, list[dict]] = {}
    for mid, data in db.execute(
        "select message_id, data from part where session_id=? order by time_created",
        (session_id,),
    ):
        parts.setdefault(mid, []).append(json.loads(data))

    with out.open("w") as f:
        for mid, data in db.execute(
            "select id, data from message where session_id=? order by time_created",
            (session_id,),
        ):
            message = json.loads(data)
            f.write(f"\n\n===== {message.get('role', '?').upper()} =====\n")
            for part in parts.get(mid, []):
                kind = part.get("type")
                if kind == "text":
                    f.write(part.get("text", "") + "\n")
                elif kind == "tool":
                    state = part.get("state", {})
                    args = json.dumps(state.get("input", {}))[:400]
                    f.write(f"[tool:{part.get('tool')}] {args}\n")
                elif kind == "file":
                    f.write(f"[attachment: {part.get('filename')}]\n")
    print(out)


# ---------------- Claude Code (JSONL) ----------------

def claude_project_dir(directory: str) -> Path:
    # Claude munges the cwd into a directory name: "/" and "." become "-"
    return CLAUDE_PROJECTS / directory.replace("/", "-").replace(".", "-")


def claude_first_user_text(path: Path) -> str:
    try:
        with path.open() as f:
            for line in f:
                entry = json.loads(line)
                if entry.get("type") == "user":
                    content = entry.get("message", {}).get("content", "")
                    if isinstance(content, list):
                        content = " ".join(
                            c.get("text", "") for c in content if isinstance(c, dict)
                        )
                    text = " ".join(str(content).split())
                    if text and not text.startswith("<"):
                        return text[:80]
    except (OSError, json.JSONDecodeError):
        pass
    return "(no user text found)"


def claude_list(directory: str | None, limit: int) -> None:
    roots = (
        [claude_project_dir(directory)]
        if directory
        else [p for p in CLAUDE_PROJECTS.iterdir() if p.is_dir()]
    )
    sessions: list[tuple[float, str, str, Path]] = []
    for root in roots:
        if not root.is_dir():
            continue
        for path in root.glob("*.jsonl"):
            sessions.append((path.stat().st_mtime, path.stem, root.name, path))
    sessions.sort(reverse=True)
    for mtime, sid, project, path in sessions[:limit]:
        print(f"{sid} | {claude_first_user_text(path)} | {project} | {ts(mtime)}")


def claude_dump(session_id: str, directory: str | None, out: Path) -> None:
    candidates = (
        [claude_project_dir(directory) / f"{session_id}.jsonl"]
        if directory
        else list(CLAUDE_PROJECTS.glob(f"*/{session_id}.jsonl"))
    )
    path = next((c for c in candidates if c.is_file()), None)
    if not path:
        sys.exit(f"session {session_id} not found under {CLAUDE_PROJECTS}")

    with out.open("w") as f:
        for line in path.open():
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            kind = entry.get("type")
            if kind not in ("user", "assistant"):
                continue
            content = entry.get("message", {}).get("content", "")
            f.write(f"\n\n===== {kind.upper()} =====\n")
            if isinstance(content, str):
                f.write(content + "\n")
                continue
            for block in content:
                if not isinstance(block, dict):
                    continue
                btype = block.get("type")
                if btype == "text":
                    f.write(block.get("text", "") + "\n")
                elif btype == "tool_use":
                    args = json.dumps(block.get("input", {}))[:400]
                    f.write(f"[tool:{block.get('name')}] {args}\n")
                elif btype == "tool_result":
                    text = block.get("content", "")
                    if isinstance(text, list):
                        text = " ".join(
                            c.get("text", "") for c in text if isinstance(c, dict)
                        )
                    f.write(f"[tool result] {str(text)[:300]}\n")
    print(out)


# ---------------- Codex (JSONL rollouts) ----------------

# Codex prepends synthetic context to the first user turn; these aren't real messages.
CODEX_BOILERPLATE_PREFIXES = (
    "<recommended_plugins>",
    "<environment_context>",
    "<user_instructions>",
    "# AGENTS.md instructions",
)


def codex_is_boilerplate(text: str) -> bool:
    stripped = text.lstrip()
    return not stripped or stripped.startswith(CODEX_BOILERPLATE_PREFIXES)


def codex_title_text(message: str) -> str:
    """Sessions restored by T3 Code open with a recovery preamble; use the real prompt."""
    if message.lstrip().startswith("[Recovered conversation history"):
        _, sep, rest = message.partition("\nUser:")
        if sep:
            message = rest
    return " ".join(message.split())


def codex_rollouts() -> list[Path]:
    if not CODEX_SESSIONS.is_dir():
        return []
    return list(CODEX_SESSIONS.rglob("rollout-*.jsonl"))


def codex_meta(path: Path) -> dict:
    """Read session_meta plus the first real user message from a rollout."""
    meta: dict = {"id": path.stem.split("-", 1)[1][20:], "cwd": "?", "title": None}
    have_meta = False
    try:
        with path.open() as f:
            for line in f:
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                payload = entry.get("payload") or {}
                if entry.get("type") == "session_meta" and not have_meta:
                    # Forked rollouts replay the parent's session_meta, so only trust the
                    # first one. `id` is this rollout's own thread; `session_id` may be a parent.
                    have_meta = True
                    meta["id"] = payload.get("id") or payload.get("session_id") or meta["id"]
                    meta["cwd"] = payload.get("cwd", "?")
                    meta["subagent"] = payload.get("thread_source") == "subagent"
                    meta["nickname"] = payload.get("agent_nickname")
                elif meta["title"] is None and payload.get("type") == "user_message":
                    text = codex_title_text(str(payload.get("message", "")))
                    if not codex_is_boilerplate(text):
                        meta["title"] = text[:80]
    except OSError:
        pass
    meta["title"] = meta["title"] or "(no user text found)"
    return meta


def codex_list(directory: str | None, limit: int) -> None:
    sessions: list[tuple[float, Path, dict]] = []
    for path in codex_rollouts():
        meta = codex_meta(path)
        if directory and meta["cwd"] != directory:
            continue
        sessions.append((path.stat().st_mtime, path, meta))
    sessions.sort(key=lambda s: s[0], reverse=True)
    for mtime, _path, meta in sessions[:limit]:
        tag = f" [subagent {meta.get('nickname') or '?'}]" if meta.get("subagent") else ""
        print(f"{meta['id']} | {meta['title']}{tag} | {meta['cwd']} | {ts(mtime)}")


def codex_find(session_id: str) -> Path:
    for path in codex_rollouts():
        if session_id in path.name or codex_meta(path)["id"] == session_id:
            return path
    sys.exit(f"codex session {session_id} not found under {CODEX_SESSIONS}")


def codex_dump(session_id: str, out: Path) -> None:
    path = codex_find(session_id)
    image_dir = out.with_name(out.stem + "-images")
    images = 0

    def write_content(f, content: list, prefix: str = "") -> None:
        nonlocal images
        for block in content if isinstance(content, list) else []:
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype in ("input_text", "output_text", "text"):
                text = block.get("text", "")
                if prefix == "USER" and codex_is_boilerplate(text):
                    continue
                f.write(text + "\n")
            elif btype == "input_image":
                url = block.get("image_url", "")
                if "," not in url:
                    continue
                images += 1
                image_dir.mkdir(exist_ok=True)
                dest = image_dir / f"image{images}.png"
                try:
                    dest.write_bytes(base64.b64decode(url.split(",", 1)[1]))
                except (ValueError, OSError):
                    continue
                f.write(f"[attached image: {dest}]\n")

    with out.open("w") as f:
        for line in path.open():
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            payload = entry.get("payload") or {}
            if entry.get("type") != "response_item":
                continue
            itype = payload.get("type")
            if itype == "message":
                role = payload.get("role", "?")
                if role == "developer":
                    continue  # system prompt / permissions boilerplate
                f.write(f"\n\n===== {role.upper()} =====\n")
                write_content(f, payload.get("content", []), role.upper())
            elif itype in ("custom_tool_call", "function_call"):
                args = str(payload.get("input") or payload.get("arguments") or "")[:400]
                f.write(f"[tool:{payload.get('name')}] {args}\n")
            elif itype in ("custom_tool_call_output", "function_call_output"):
                output = payload.get("output", "")
                if isinstance(output, list):
                    output = " ".join(
                        b.get("text", "") for b in output if isinstance(b, dict)
                    )
                f.write(f"[tool result] {str(output)[:300]}\n")
            elif itype == "agent_message":
                f.write(f"\n\n===== SUBAGENT {payload.get('author', '?')} =====\n")
                write_content(f, payload.get("content", []))
    print(out)
    if images:
        print(f"{images} image(s) written to {image_dir}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["list", "dump"])
    parser.add_argument("agent", choices=["opencode", "claude", "codex"])
    parser.add_argument("session_id", nargs="?")
    parser.add_argument("--dir", default=None, help="project directory filter (defaults to cwd for list)")
    parser.add_argument("--all-dirs", action="store_true", help="list sessions from every project")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    directory = args.dir
    if directory is None and not args.all_dirs:
        directory = os.getcwd()

    if args.mode == "list":
        if args.agent == "opencode":
            opencode_list(directory, args.limit)
        elif args.agent == "codex":
            codex_list(directory, args.limit)
        else:
            claude_list(directory, args.limit)
        return

    if not args.session_id:
        sys.exit("dump requires SESSION_ID")
    out = Path(args.out or f"/tmp/resume-from-{args.session_id}.md")
    if args.agent == "opencode":
        opencode_dump(args.session_id, out)
    elif args.agent == "codex":
        codex_dump(args.session_id, out)
    else:
        claude_dump(args.session_id, directory if args.dir else None, out)


if __name__ == "__main__":
    main()
