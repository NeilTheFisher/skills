# Evidence

Set the window and repository once:

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
SINCE=$(date -d '60 days ago' +%F)
```

## Agent-authored PRs

```bash
gh pr list --state merged --limit 300 --search "merged:>=$SINCE" \
  --json number,title,author,body,labels,files,mergedAt \
| jq '[.[] | select(
    (.author.is_bot or (.author.login | test("claude|codex|copilot|devin|cursor"; "i")))
    or (.body | test("Generated with .?Claude Code|Co-authored-by: Claude|Co-authored-by: Codex"; "i"))
    or ([.labels[].name] | join(",") | test("ai|agent|bot"; "i"))
  )]'
```

No matches: report that, then treat every PR in the window as evidence.

## What went wrong on each PR

```bash
# Review comments, with the file and line they sit on
gh api "repos/$REPO/pulls/N/comments" --paginate \
  --jq '.[] | {path, line, user: .user.login, body}'

# Reviews and conversation
gh pr view N --json reviews,comments,author,mergedAt,files

# CI failures
gh pr checks N
```

Reverts, and fix PRs that land soon after:

```bash
gh pr list --state merged --limit 300 --search "revert in:title" \
  --json number,title,body,mergedAt,files

gh pr list --state merged --limit 300 --search "merged:>=$SINCE" \
  --json number,title,mergedAt,files
```

A fix PR counts when it merges within 14 days of the original and its `files`
intersect the original's. Pair them with `jq`; do not eyeball 300 PRs.

## Rules-file history

```bash
git log --since="$SINCE" -p --reverse --
  CLAUDE.md AGENTS.md GEMINI.md \
  .cursor/rules .github/copilot-instructions.md
```

For each added line, find the commit and the PR that introduced it:

```bash
git log -S"<the added line>" --oneline -- CLAUDE.md
gh api "repos/$REPO/commits/<sha>/pulls" --jq '.[] | "#\(.number) \(.title)"'
```

A line with no PR behind it was a guess; a line whose PR turns out to be a
revert of an earlier line is a prose fix that failed.

## No PRs, or no auth

Without `gh` (solo repo, no remote), use `git log --since="$SINCE" --stat`,
`git show` for reverts and re-touches of the same file, and the same
rules-file history above. Ask for the window's incident notes if the history
does not explain a rule line.
