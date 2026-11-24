---
name: "opencode-models"
description: "Use when the user asks which of their own OpenCode models to use — 'which of my models is smartest', 'compare my OpenCode models', 'what should I use to draft/write/analyse X', 'is Grok better than Argon', 'should I switch model for this'. Reads `opencode models`, ranks them against Artificial Analysis (intelligence vs cost) and the arena.ai text arena (human preference, incl. Creative Writing), screenshots the scatter filtered to just their models, and prints a chat-ready table plus the inline image."
---

# Which of my OpenCode models should I use?

Answers "out of the models this install actually offers, which one is best for
*this* job" with leaderboard data instead of vibes.

## Quick start

```bash
~/.agents/skills/opencode-models/scripts/run.sh --task writing
```

Prints a markdown block: verdict, table, unranked models, top of the chat
leaderboard, and an inline image of the Artificial Analysis scatter narrowed to
the user's models. Print it as-is.

| Flag | Effect |
|---|---|
| `--task writing` | prose/CV weighting: arena **Creative Writing** leads |
| `--task reasoning` | default: AA intelligence leads |
| `--task both` | balanced |
| `--provider opencode-go` | one provider (comma-separated list works) |
| `--models a,b` | explicit subset |
| `--all` | include local/modal endpoints (excluded by default) |
| `--refresh` | ignore the 12 h cache |
| `--headless` | hide the browser window |
| `--no-shot` | table only, skip the browser screenshot pass |
| `--arena-file f.json` | arena rows the agent fetched via browse |
| `--top N` | table length (default 12) |

## Arena rows come from the user's browser, not the script

Artificial Analysis is open; **arena.ai is behind Cloudflare and rejects every
automation-owned Chrome profile**, so the script cannot fetch it. Without this
step the arena column is simply absent — the run still works.

When the task is writing, or the user asks about chat preference, fetch it
yourself first:

1. Open `https://arena.ai/leaderboard/chat/text` in the OpenCode `browse` tools
   (the user's real browser passes the check).
2. For prose work, click the **Creative Writing** category button before scraping.
3. Run this in the page and save the result to `/tmp/opencode/arena-rows.json`:

```js
[...document.querySelectorAll('table tr')].map((tr) => {
  const c = [...tr.querySelectorAll('td')].map((td) => td.innerText.trim());
  if (c.length < 4 || !/^\d+$/.test(c[0])) return null;
  return {
    rank: Number(c[0]),
    name: c[2].split('\n')[0],
    maker: c[2].split('\n')[1] || '',
    score: Number((c[3].match(/\d+/) || [0])[0]),
    cost: Number((c[5] || '').replace(/[^0-9.]/g, '')) || null,
  };
}).filter(Boolean)
```

4. Then `run.sh --task writing --arena-file /tmp/opencode/arena-rows.json`.

If you cannot reach the site at all, say so and present the AA half only — never
invent an arena rank.

## Prices are not your prices

The `$/task` column is Artificial Analysis's cost of running its whole ~100-task
index at **API list prices**. On an OpenCode Go subscription that is not what you
pay: the real limit is the request quota, and models differ by orders of
magnitude (Kimi K3.1 Pro ~147 requests / 5 h vs DeepSeek V4.1 Flash ~43,000).

`reference/opencode-go-quotas.json` holds a dated snapshot of the **Go** plan
(not Go Plus); the report shows it as "Go: req/5h" when it recognises a model.
Treat it as "how much headroom do I get", not as a price. If the user compares a
cheap-per-token model against an expensive one, say plainly that quota, not
dollars, is their constraint. Do not build a second cost chart.

## How to answer

1. Pick the task mode from what they are doing: drafting a document is `writing`;
   debugging or analysis is `reasoning`.
2. Repeat the verdict line, the table, and the image **inline** (the script prints
   the `![...](...)` line — show it, don't describe the chart instead).
3. Say which column drove the pick. A model can top intelligence and sit
   mid-table on human preference; that gap is the interesting part.
4. Name the leaders that are *not* in their list, so they can judge whether
   switching is worth it.
5. Never rank an unbenchmarked model, never invent a score.

## Rules that keep the answer honest

- **AA's index is not a writing score.** For CVs, bios and emails, arena's
  Creative Writing tab leads and should drive the verdict.
- **Effort variants.** An id with no effort suffix is matched to the highest AA
  variant; say so ("Argon is only benchmarked at high").
- **Unmatched is a result.** Free/contributor/preview tiers often have no public
  benchmarks — list them as unranked rather than guessing from the family name.
- **`$/task` is an index run**, never a per-message estimate.

## Mechanics

```
scripts/collect.mjs   # opencode models -> AA scrape -> match -> filter chart -> PNG + JSON
scripts/report.mjs    # JSON -> markdown (verdict, table, unranked, chart embed)
scripts/run.sh        # both, in order
reference/sources.md          # AA vs arena, columns, naming quirks
reference/overrides.json      # alias fixes the matcher cannot bridge
reference/opencode-go-quotas.json  # dated Go-plan request quotas
```

Data and screenshots land in `~/.cache/opencode-models/<date>/` with a
`latest.json` pointer. Nothing is written into the skills repo.

The AA half launches an isolated Windows-headed Chrome through
`../playwright-windows/scripts/win-chrome.mjs` (throwaway profile, closed on
exit). It never touches the user's own sessions.

## Troubleshooting

- **Empty table / 0 rows** — the site changed its markup; check the `<table>`
  still exists and adjust `scrapeAA` in `collect.mjs`.
- **Chart shows 700 models** — the filter popover moved; the table is unaffected.
  Fix `filterChart`.
- **Everything unranked** — `opencode models` names drifted from benchmark names;
  add an entry to `reference/overrides.json`.
- **"Just a moment…"** — that is Cloudflare on arena.ai. Use browse, as above.
