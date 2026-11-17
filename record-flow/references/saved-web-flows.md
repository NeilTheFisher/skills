# Saved web flows (agent-browser)

A Playwright recording is one way to replay a task. The other is a *saved flow*:
record the task once, then replay its HTTP requests with new parameters, falling
back to the page only when the request stops working.

Use saved flows for a repeated read-only lookup an agent needs cheaply. Use a
Playwright spec from `record-flow` for a test: a spec asserts, runs in CI, and
fails loudly when the app changes.

## When it fits

- The site has no API you can call directly, or auth exists only in the browser.
- The task returns data: a price, an order status, a dashboard number, a list.
- It runs repeatedly with different inputs (an order id, a product, a date).
- Paying for a full page snapshot on every run is the bottleneck.

Not for writes you are not prepared to confirm, flows that depend on random UI
state, or anything that must fail CI when the site changes.

## Record, save, run

Install once with `npm i -g agent-browser && agent-browser install`, or run it
through `npx -y agent-browser@latest` against the system Chrome.

```bash
agent-browser --capture flow open https://example.com
# do the task once: type the search, click the result
agent-browser flow steps
agent-browser flow save price --param q="<the value you typed>" --description "Product price"
agent-browser flow list
agent-browser flow run price --param q="<new value>" --fields title,price --limit 5
```

`flow save` keeps first-party JSON (including SSR-embedded JSON), turns values
you typed into params, and reports the writes it found. `flow run` tries direct
HTTP, then the same request from the page, then a replay of the recorded
commands, and starts the next run at the tier that worked. `--fields` trims the
result, `--where` filters items, `--limit` caps them, and `--allow-write
all|<id,...>` sends writes. Any other write asks for confirmation.

`agent-browser skills get core --ref commands` is the version-matched manual for
the full flag set.

## What to know before trusting it

- Experimental. A changed site, an answer that differs each run, or a response
  with a different shape marks the flow unverified (`drifted`); re-record it.
- A saved flow keeps no cookies or tokens. The HTTP tier uses the live session's
  cookies, so an authenticated flow needs a session that is already signed in.
  With no browser, it falls back to the page or fails `auth_expired`.
- Every tier compares the response shape against the recording, but a 200 with
  plausible wrong data is not a test failure. Read `verified` and the tier.
- A flow recorded against a public site only sends to public addresses; one
  recorded against localhost or a private address only sends to local ones.
- Writes go out once per run. `outcome_unknown` means check the site before
  rerunning; do not replay a write blindly.

## The other exit

For an assertion, a committed artifact, or CI, record a Playwright spec with
`record-flow` instead. The same task can have both: a spec for regressions and a
saved flow for cheap repeated lookups.

If the lookup stabilizes and you want a code artifact outside agent-browser,
`agent-browser skills get derive-client` turns a recorded HAR into a standalone
client or CLI that calls the site's internal API directly.
