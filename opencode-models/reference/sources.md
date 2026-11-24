# Where the numbers come from

Two sources, deliberately. They answer different questions, and picking the wrong
one gives bad advice.

## Artificial Analysis — "how good is it at thinking?"

- Leaderboard table: `https://artificialanalysis.ai/leaderboards/models`
  (a real `<table>`: model, creator, **Artificial Analysis Intelligence Index**,
  cost per task, minutes per task, first-answer latency).
- Scatter chart: `https://artificialanalysis.ai/models` →
  `#intelligence-index-vs-cost-per-task-chart`, with a filter popover that can be
  narrowed to an arbitrary set of models (this is what the screenshot does).

**Cost per task is not a chat message.** It is the cost of running AA's whole
~100-task Intelligence Index. A single CV draft costs pennies on any of these
models. Use it to compare *relative* expense, never to estimate a conversation.

**The index measures reasoning and knowledge**, across maths, science, coding and
long-context tasks. It says nothing about prose. A model can top the index and
still write like a press release.

## Arena — "which one do people actually prefer talking to?"

- `https://arena.ai/leaderboard/chat/text` — blind human preference votes
  (rank, score with confidence interval, vote count, cost per task).
- Category tabs include **Creative Writing**, **Instruction Following**,
  Multi-Turn and Hard Prompts. Writing work should read the Creative Writing tab,
  not Overall.

This is the better signal for anything whose quality a human judges by reading:
CVs, bios, cover letters, emails. It is a *worse* signal for "can it do the
arithmetic in my spreadsheet".

The site returns **403 to plain HTTP fetches** and renders client-side, so a
browser is mandatory — there is no cheap `curl` path.

## Picking between them

| Job | Weight | Why |
|---|---|---|
| CV, bio, cover letter, prose | Arena (Creative Writing) | humans judge the output by reading it |
| Analysis, maths, debugging, code | AA intelligence | verifiable right/wrong answers |
| Structural rewrite of existing text | both | arena for voice, AA for instruction-following rigour |
| Cheap bulk work | neither — sort by cost and take "good enough" | | |

A model can win one and lose the other. That gap is information, not noise: it
usually means "pleasant to read, shallow reasoning" or the reverse. Say which
column drove the recommendation.

## Naming quirks (both sites rename things)

- AA suffixes effort variants: `(low) (medium) (high) (xhigh) (max)`. An OpenCode
  id with no suffix is matched to the **highest** variant, and the report says so.
- AA does not always publish every effort level: `Gemini 4 Argon` exists only as
  `(high)`.
- Vendor prefixes get glued on in arena cells (`GoogleGemini 4 Carbon (High)`),
  which is why the parser takes the first line of the cell only.
- Renames: `hy4` → `Tencent Hy4`, `Beam Free` → `Beam 1.0`,
  `GPT-6 Luna` → `GPT-6 Luna (max)`.
- Benchmark date stamps (`0902`, `1017`, `0813`) are stripped before matching.
- Free, contributor and preview tiers are frequently **not** benchmarked. Report
  them as unranked instead of inventing a number.

## Freshness

Both tables are cached for 12 hours in `~/.cache/opencode-models/`. Pass
`--refresh` when a model just launched or the ranking looks stale.
