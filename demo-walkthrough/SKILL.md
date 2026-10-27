---
name: demo-walkthrough
description: >
  Produce annotated, numbered screenshots that walk someone through a web flow
  from the landing page to a downloaded file, with arrows, spotlights and
  captions drawn onto the page. Use when the user asks for "directions",
  "screenshots with arrows", a "walkthrough", a "demo", or wants to send a
  non-technical person step-by-step instructions for using a site.
---

Turn a live flow into a numbered picture sequence a stranger can follow, then
prove the flow worked end to end (including any file it downloads).

## When to use

- "Show me how to get to X on the site", "screenshots with arrows", "directions
  for the client/demo", "make me a walkthrough".
- Someone non-technical needs to repeat a task on a deployed app.
- You shipped a feature that ends in a download or a visible result and want
  proof it works as a user experiences it.

Not for: single screenshots of a page (see `dogfood` or `playwright`), or
recorded video.

## Method

1. **Pick the audience device.** If the person will open it on a phone, emulate
   the phone, not a narrow desktop window: `browser.newContext({ ...devices["iPhone 13"] })`.
   This sets viewport, DPR, `isMobile`, touch and the iPhone UA together.
2. **Prove the emulation.** After the first load, read back
   `window.innerWidth` and `devicePixelRatio`. On an iPhone 13 you must see
   `390` and `3`. If `innerWidth` is many times the device width the page is
   overflow-stretching and every screenshot will be wrong; fix the page before
   continuing (see "Layout traps").
3. **One action per step.** Five steps is the ceiling for a demo. The sequence
   that works: landing page → sign-in form → signed-in home → pick the page or
   tab → the control that produces the result.
4. **Annotate inside the page.** Use `scripts/annotate.ts`, which injects a
   fixed-position overlay: dimmed backdrop, ring on the target, arrow, numbered
   badge and a caption pill. Overlays survive the screenshot because they are
   part of the DOM. Clear them before the next step.
5. **Screenshot the viewport, not the full page.** A full-page capture makes the
   step unreadable on a phone ratio.
6. **Read every image back** before showing it. Broken targets fail silently:
   a ring can land on an off-screen duplicate.
7. **Prove the outcome independently.** If the flow ends in a download, save the
   file and validate its real format with a real reader, not by trusting that
   the click fired.

## Hard-won rules

- **Resolve to the visible element.** Apps render desktop and mobile copies of
  the same control. The hidden copy has a zero-size rect but still matches
  `querySelector`, so filter candidates by
  `getBoundingClientRect().width > 0`.
- **Logins are hydration-gated.** A submit clicked before hydration is
  swallowed. Wait for the button to lose `data-disabled`, then wait for a marker
  that only exists after auth, and retry the whole sign-in once if it never
  appears. Do not trust `waitForURL` alone: a client-side route can set the URL
  and then redirect when the guard fails.
- **Never trust a page-identity check that exists on both pages.** A login form
  exists on the login page and the screenshot can "pass" while showing it.
  Assert on something unique to the signed-in shell, and capture the heading
  text per step.
- **Playwright `:has-text()` is a Playwright selector**, not valid inside
  `page.evaluate`/`document.querySelector`. Use `all` + exact `text` matching.
- **TypeScript in `.mjs` fails.** Run the script as `.ts` under bun.
- **Do not print secrets.** Read demo credentials from env, never echo them.

## Layout traps that ruin walkthroughs

A page wider than the device gets shrink-to-fit by the browser, so every
screenshot looks like a tiny desktop page. Check
`document.documentElement.scrollWidth` against `window.innerWidth` on every step.
Usual cause: a horizontal tab strip or table inside a grid or flex child without
`min-w-0`, which makes min-content width propagate up and stretch the page.

## Showing a produced file

When the flow ends in a file, show what it contains:

1. Download it through the real UI (`page.waitForEvent("download")`), never by
   calling the API by hand; the click is half the proof.
2. Parse it with a real library. Spreadsheets: `xlsx` reads `.xlsx` and
   `XLSX.utils.sheet_to_json(..., { header: 1 })` gives you raw rows.
   Do not use LibreOffice as a validator; `soffice` fails on files it should
   accept, and it can fail on plain CSV too.
3. Render the rows as an HTML table styled like a spreadsheet (column letters,
   row numbers, sheet tab), screenshot at natural width so no column is clipped,
   and label it as the file's first N rows of however many.
4. Report the numbers that matter: rows, rows per important column, and whether
   non-ASCII text survived.

## Output shape

- Files: `step-1.png` … `step-5.png`, plus `result.png` for the artifact.
- Captions: imperative, one clause, under ~40 characters ("5 · Tap Export
  Excel").
- In the reply, put each image under its numbered instruction so the text alone
  still works if the images are lost.

## Files

- `scripts/annotate.ts` — `annotate`, `clearAnnotations`, `shot`. Copy into the
  working directory or import by absolute path.
- `scripts/steps.example.ts` — a complete five-step script to adapt: device
  context, hydration-safe sign-in, one `shot` call per step.
