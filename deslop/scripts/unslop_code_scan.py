#!/usr/bin/env python3
"""
unslop_code_scan.py - scan source code for the mechanical "tells" that give away
AI-written code, across languages.

Plain Python, standard library only. The patterns and their severity come from a Reddit
analysis (11,906 on-topic posts + 11,306 comments across 55 AI / coding / SaaS subreddits,
2020 to 2026) of what developers actually name as a giveaway that code was written by an
LLM. Every candidate was classified by an LLM into a fixed taxonomy of 19 tells, then each
top tell was adversarially verified by re-reading the quotes. Severity follows the verified
share, so the report tells you where to spend effort.

What it can and cannot see. The loudest tells in the data are about shape and substance:
boilerplate / tutorial-shaped code (verified 18.6%, the #1 tell), hallucinated APIs (11.2%),
over-engineering (7.8%), ignoring the surrounding codebase (3.5%), mixed skill level (1.9%).
A regex cannot judge any of those; they are documented in references/tells.md for a human or
a compiler. This scanner catches the mechanical, surface tells: leftover chat/assistant text,
placeholder comments, emoji, swallowed errors, narrating comments, and generic placeholder
names.

Two axes, not one. Severity is how loudly a finding reads as an AI tell (how conclusive it is
when present). Class is whether it is a bug or a cosmetic. They are independent: a swallowed
error is a quiet tell but a real bug; an emoji is a loud tell but harmless. Fix every bug-class
finding because it is wrong, not because it looks AI-written; treat the cosmetic ones as the
lighter pass.

The highest-impact bug, hallucinated APIs, is invisible to this scanner. Catch it the way only
code allows: build it, type-check it, run it, resolve every import and call against real docs.
The scanner is the cheap second pass, never the first.

Language coverage. Some tells are language-universal because they live in comments or strings:
emoji, leftover chat artifacts, placeholder/ellipsis comments, narrating comments. Others key
on syntax and are language-specific. Swallowed errors are matched for Python / JS / TS / Java /
C# / Ruby try-catch and for Go's single-line empty `if err != nil {}`; Rust's `.unwrap()` /
`let _ =` and Go's `_`-discard are too overloaded to flag by regex without noise, so they are a
human pass (see references/tells.md). Generic-name detection keys on def / function / func /
fn / fun / sub.

Usage:
    python3 unslop_code_scan.py <path>                 # scan a dir or file
    python3 unslop_code_scan.py <path> --severity high # only the strongest signals
    python3 unslop_code_scan.py <path> --json          # machine-readable (for CI)
    python3 unslop_code_scan.py <path> --max 8         # cap examples shown per rule
    python3 unslop_code_scan.py --git HEAD              # flag tells in latest commit message
    python3 unslop_code_scan.py --git HEAD~3..HEAD      # flag tells in last 3 commit messages

A line containing  unslop-ignore  is skipped, for a pattern you are using on purpose.
Exit code is the number of HIGH-severity findings (0 = none), so CI can gate on it.
"""
import os, re, sys, json, argparse

EXTS = {".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rs", ".rb", ".php",
        ".c", ".h", ".cpp", ".cc", ".hpp", ".cs", ".kt", ".kts", ".swift", ".scala",
        ".m", ".mm", ".sh", ".bash", ".lua", ".dart", ".vue", ".svelte", ".sql", ".r"}
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next", "out", "vendor", "target",
             "coverage", ".venv", "venv", "__pycache__", ".idea", ".gradle", "bin", "obj"}
W = {"high": 3, "medium": 2, "low": 1}
CMT = r"(?://|#|/\*|\*|--|<!--)"
EMOJI = ("\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F0FF"
         "\U00002B00-\U00002BFF\U0001F900-\U0001F9FF\U00002764")

RULES = [
    {"id": "chat-artifact", "label": "Leftover chat / assistant / markdown artifact in the code", "sev": "high", "class": "cosmetic",
     "share": "verified 1.2%, but unmistakable when present",
     "fix": "Delete the assistant's voice before committing: code fences, 'Here's the updated code', 'As an AI', 'Good catch!', a trailing 'Note:'.",
     "pats": [r"^\s*```", r"\bhere'?s the (updated|complete|full|fixed|revised|new) (code|version|implementation|file)\b",
              r"\bas an? (ai|a\.i\.) (language )?model\b", r"\bas a large language model\b",
              r"\b(good|great) catch!", r"\byou'?re absolutely right\b",
              r"^\s*" + CMT + r"\s*(note|remember|important|keep in mind|tip)\s*:",
              r"\b(certainly|sure)! here('?s| is)\b", r"\bi'?ll (add|update|fix|implement) .{0,40}\bnow\b",
              r"\bi hope this helps\b", r"\blet me know if you'?d?\s*(like|need|want)\b"]},
    {"id": "placeholder-comment", "label": "Placeholder / ellipsis comment left in", "sev": "high", "class": "bug",
     "share": "verified 1.6%, precision ~100%",
     "fix": "Write the actual code. These '... rest of the code' stubs mean the file is unfinished.",
     "pats": [r"" + CMT + r"\s*\.{2,}\s*(rest|the rest|your|remaining|existing|previous|other)\b",
              r"" + CMT + r"\s*(rest|remainder) of (your |the |my )?(code|implementation|logic|function|file)\b",
              r"" + CMT + r"\s*(your|the) (code|logic|implementation|stuff) (goes )?here\b",
              r"" + CMT + r"\s*(add|insert|implement|put) (your )?(code|logic|implementation) here\b",
              r"" + CMT + r"\s*(implementation|code|logic) (goes |go )?here\b",
              r"" + CMT + r"\s*existing code (here|unchanged|stays|remains)\b",
              r"" + CMT + r"\s*\.\.\. ?\((?:rest|your|the|existing)[^)]*\)",
              r"" + CMT + r"\s*TODO:?\s*(implement|add|fill in|finish)\b"]},
    {"id": "emoji-in-code", "label": "Emoji in code, comments, strings, logs", "sev": "medium", "class": "cosmetic",
     "share": "verified 3.9%, precision ~77%",
     "fix": "Remove emoji from source. They survive from the model's chat output and read as vibe-coded.",
     "pats": [r"[" + EMOJI + r"]"]},
    {"id": "typographic-punctuation", "label": "Curly apostrophe or em dash in source", "sev": "medium", "class": "cosmetic",
     "share": "project convention",
     "fix": "Replace curly apostrophes with ASCII apostrophes and em dashes with hyphens.",
     "pats": [r"[\u2018\u2019]", r"\u2014"]},
    {"id": "swallowed-errors", "label": "Catch-all / swallowed errors", "sev": "medium", "class": "bug",
     "share": "verified 3.1%",
     "fix": "Catch specific exceptions and handle them. A bare except or empty catch eats the one clue you needed.",
     "pats": [r"^\s*except\s*:", r"^\s*except\s+(Exception|BaseException)\s*:\s*(pass|\.\.\.|$)",
              r"\bcatch\s*\([^)]*\)\s*\{\s*\}", r"\bcatch\s*\{\s*\}",
              r"\brescue\s*=>\s*\w+\s*$", r"\bcatch\s*\([^)]*\)\s*\{\s*//",
              r"\bif\s+err\s*!=\s*nil\s*\{\s*\}", r"\bif\s+err\s*!=\s*nil\s*\{\s*//"]},
    {"id": "narrating-comment", "label": "Narrating comment that restates the obvious", "sev": "medium", "class": "cosmetic",
     "share": "verified 8.5% (over-commenting subset)",
     "fix": "Cut comments that say what the next line plainly does. Comment why, not what.",
     "pats": [r"" + CMT + r"\s*(step\s*\d+\b|now we\b|first,|next,|then,|finally,)",
              r"" + CMT + r"\s*(increment|decrement|initialize|declare|define|create|instantiate|loop (over|through)|iterate over|return the|set the|get the|assign|call the)\b",
              r"" + CMT + r"\s*this (function|method|line|loop|variable|class|block) (does|is|will|handles|returns|creates)\b",
              r"" + CMT + r"\s*(import|importing) (the |required )?(libraries|modules|dependencies)\b"]},
    {"id": "generic-naming", "label": "Generic placeholder function name", "sev": "medium", "class": "cosmetic",
     "share": "verified 1.9%, precision ~100%",
     "fix": "Name it for what it actually does. process_data() that does 11 things is the AI tell.",
     "pats": [r"\b(def|function|func|fn|fun|sub)\s+(process_?[Dd]ata|handle_?[Dd]ata|do_?[Ss]tuff|do_?[Ss]omething|my_?[Ff]unction|process_?[Ii]tem|process_?[Ii]nput|main_?[Ff]unction)\b",
              r"\b(process_?[Dd]ata|handle_?[Dd]ata|do_?[Ss]tuff|do_?[Ss]omething)\s*\("]},
    {"id": "verbose-naming", "label": "Over-verbose, robotically self-documenting identifier", "sev": "low", "class": "cosmetic",
     "share": "verified 0.4%", "cs": True,
     "fix": "A name that is a whole sentence (getUserDataFromApiResponseHandler) reads as machine-generated. Trim it.",
     "pats": [r"\b[a-z]+([A-Z][a-z0-9]+){4,}\b", r"\b[a-z]+(_[a-z0-9]+){5,}\b"]},
    {"id": "boilerplate-marker", "label": "Boilerplate / dummy-data marker", "sev": "low", "class": "cosmetic",
     "share": "weak proxy for the #1 tell (tutorial-shaped code)",
     "fix": "Replace generated dummy data with the real thing.",
     "pats": [r"\blorem ipsum\b", r"\b(your|my)[-_]?api[-_]?key\b", r"\bYOUR_API_KEY\b", r"\bexample\.com\b",
              r"\b(John|Jane) (Doe|Smith)\b", r"['\"]sk-(xxx|your|placeholder|123)",
              r"(console\.log|print|println|fmt\.Print\w*|System\.out\.print\w*)\s*\(\s*['\"](✅|🚀|Successfully|Done!|Here we go)"]},
]

def compile_rules(min_sev):
    order = ["high", "medium", "low"]
    floor = order.index(min_sev) if min_sev else len(order) - 1
    out = []
    for r in RULES:
        if order.index(r["sev"]) > floor:
            continue
        r = dict(r)
        flags = 0 if r.get("cs") else re.IGNORECASE
        r["rx"] = [re.compile(p, flags) for p in r["pats"]]
        out.append(r)
    return out

def iter_files(path):
    if os.path.isfile(path):
        yield path; return
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f.endswith(".min.js") or f.endswith(".min.css") or f.endswith(".map"):
                continue
            if os.path.splitext(f)[1].lower() in EXTS:
                yield os.path.join(root, f)

def scan_lines(lines, rules, label):
    """Scan a list of (line_number, text) tuples against compiled rules."""
    findings = []
    for i, line in lines:
        if "unslop-ignore" in line.lower():
            continue
        for r in rules:
            for rx in r["rx"]:
                m = rx.search(line)
                if m:
                    findings.append({"rule": r["id"], "label": r["label"], "sev": r["sev"],
                                     "class": r["class"], "share": r["share"], "fix": r["fix"],
                                     "file": label, "line": i,
                                     "match": m.group(0).strip()[:50], "snippet": line.strip()[:160]})
                    break
    return findings

def scan(path, min_sev):
    rules = compile_rules(min_sev)
    findings = []
    for fp in iter_files(path):
        try:
            with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                lines = fh.readlines()
        except Exception:
            continue
        if len(lines) == 1 and len(lines[0]) > 5000:
            continue
        numbered = [(i, line) for i, line in enumerate(lines, 1)]
        findings.extend(scan_lines(numbered, rules, fp))
    return findings

def scan_git(rev_range, min_sev):
    """Scan commit messages from a git rev range."""
    import subprocess
    try:
        out = subprocess.check_output(
            ["git", "log", "--format=%B", rev_range],
            text=True, stderr=subprocess.PIPE)
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"git log failed: {e}", file=sys.stderr); sys.exit(2)
    rules = compile_rules(min_sev)
    lines = [(i, line) for i, line in enumerate(out.splitlines(), 1) if line.strip()]
    return scan_lines(lines, rules, f"git:{rev_range}")

def verdict(by_sev, weighted):
    if by_sev.get("high", 0) >= 3 or weighted >= 15:
        return "STRONG AI-written-code tells"
    if by_sev.get("high", 0) >= 1 or weighted >= 6:
        return "Some AI tells present"
    if weighted > 0:
        return "Mostly clean, minor tells"
    return "Clean, no surface tells detected"

def main():
    ap = argparse.ArgumentParser(description="Scan source code for AI-written-code tells.")
    ap.add_argument("path", nargs="?", default=None)
    ap.add_argument("--git", metavar="REV", help="flag tells in commit messages from git rev range (e.g. HEAD, HEAD~3..HEAD)")
    ap.add_argument("--severity", choices=["high", "medium", "low"], default="low",
                    help="minimum severity to report (default: low = everything)")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--max", type=int, default=10, help="max examples shown per rule (text mode)")
    args = ap.parse_args()

    if not args.path and not args.git:
        ap.error("provide a path or --git REV")

    if args.git:
        findings = scan_git(args.git, args.severity)
        label = f"git:{args.git}"
        files_scanned = 0
    else:
        if not os.path.exists(args.path):
            print(f"path not found: {args.path}", file=sys.stderr); sys.exit(2)
        findings = scan(args.path, args.severity)
        label = args.path
        files_scanned = sum(1 for _ in iter_files(args.path))
    by_sev, by_class, by_rule = {}, {}, {}
    for f in findings:
        by_sev[f["sev"]] = by_sev.get(f["sev"], 0) + 1
        by_class[f["class"]] = by_class.get(f["class"], 0) + 1
        by_rule.setdefault(f["rule"], []).append(f)
    weighted = sum(W[s] * n for s, n in by_sev.items())

    if args.json:
        print(json.dumps({"path": label, "files_scanned": files_scanned, "counts": by_sev,
                          "class_counts": by_class, "slop_score": weighted,
                          "verdict": verdict(by_sev, weighted), "findings": findings}, indent=2))
        sys.exit(by_sev.get("high", 0))

    sev_order = {"high": 0, "medium": 1, "low": 2}
    rule_ids = sorted(by_rule, key=lambda rid: (sev_order[by_rule[rid][0]["sev"]], -len(by_rule[rid])))
    print(f"\n  unslop-code scan: {label}")
    print(f"  files scanned: {files_scanned}   findings: {len(findings)}   slop score: {weighted}")
    print(f"  verdict: {verdict(by_sev, weighted)}")
    print(f"  high: {by_sev.get('high',0)}   medium: {by_sev.get('medium',0)}   low: {by_sev.get('low',0)}")
    print(f"  bug-class: {by_class.get('bug',0)} (wrong code, fix regardless of severity)   "
          f"cosmetic: {by_class.get('cosmetic',0)} (surface giveaways)\n")
    if not findings:
        print("  No surface tells flagged. The loudest tells are structural and a regex cannot see\n"
              "  them: boilerplate / tutorial-shaped code, hallucinated APIs, over-engineering, and\n"
              "  code that ignores the surrounding repo. Hallucinated APIs are a bug, not a style\n"
              "  issue: build it, type-check it, run it, resolve every import. Then read the diff for\n"
              "  the rest by hand against references/tells.md.\n")
        return
    for rid in rule_ids:
        items = by_rule[rid]
        f0 = items[0]
        print(f"  [{f0['sev'].upper()} \u00b7 {f0['class']}] {f0['label']}  ({len(items)} hit{'s' if len(items)!=1 else ''})  [{f0['share']}]")
        print(f"        fix: {f0['fix']}")
        for it in items[:args.max]:
            print(f"        {it['file']}:{it['line']}  ({it['match']})  {it['snippet']}")
        if len(items) > args.max:
            print(f"        ... +{len(items) - args.max} more")
        print()
    top = [by_rule[rid][0]['label'] for rid in rule_ids[:3]]
    print("  Top things to change: " + "; ".join(top))
    print("  Fix the bug-class findings first; they are wrong, not just AI-looking.")
    print("  The big tells (boilerplate, hallucinated APIs, over-engineering) the regex cannot see:")
    print("  build / type-check / run for the hallucinated calls, read the diff for the rest. See references/tells.md.\n")
    sys.exit(by_sev.get("high", 0))

if __name__ == "__main__":
    main()
