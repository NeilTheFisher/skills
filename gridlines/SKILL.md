---
name: gridlines
description: Draw vertical guide lines down a UI, find every element that sits off its line, and fix the padding and optical alignment. Use when asked to align, audit, or clean up a sidebar, header, toolbar, list, form, table or card grid; when something looks "almost aligned" or "off by a pixel"; or when the user invokes /gridlines. Not for general visual-design critique — use frontend-god-mode for taste, typography and overall direction.
---

# Gridlines

Alignment is not a feeling. A screen has a handful of vertical lines — page gutter, container padding, icon edge, text edge, trailing actions — and every element either sits on one of them or is deliberately off it. The job is to find the lines, measure what misses, and fix the thing that owns the measurement.

The failure that matters is the near miss. A block 12px off reads as a deliberate indent. A block 2px off reads as a mistake, and the eye finds it before it can name it. Hunt the 1–4px errors first.

## The Four Laws

**1. One icon column, one text line.**
Every icon in a group shares one left edge and one size; every label shares one left edge. Reason: the eye reads the icon-to-text gap, not the icon, so two icon columns turn every row into a different indent and the list stops scanning as a list. Pick one icon box (16 or 20px), one gap (8px), and let text start at `padding + icon + gap` everywhere.

**2. Headers sit on the icon edge.**
Section headers align to the icon's left edge, not the label's. Reason: a header labels the whole group, so it belongs at the group's outermost edge. Aligned to the text it looks nested inside the group it introduces, and the hierarchy inverts.

**3. Toolbars share one centre line.**
Every control in a toolbar shares one horizontal centre — and the bar's contents share one vertical centre. Reason: boxes are easy to centre, glyphs are not. A 24px icon and a 16px chevron with identical box centres still look off, because optical mass is not box mass. Centre the ink, not the border box.

**4. Fix the container, not the item.**
When one row is 2px off, change the parent's padding, gap, grid track or alignment — not that row's margin. Reason: an item-level nudge fixes today's screenshot and re-breaks on the next row, the next state, and the next breakpoint. A container fix propagates, and it is the only version that stays true when content changes.

## Why Every Rule Has A Reason

You will meet cases this file does not list. Rules without reasons fail there; rules with reasons generalise. When a case is not covered, ask what the line is *for* — grouping, scanning, optical weight — and derive the answer. Never apply a rule that fights its own reason (centring a value column because "toolbars share a centre line" is a misread, not a fix).

## Workflow

**1. Set the region.** One component at a time: sidebar, toolbar, list, card. Full pages are audited by region, never as a whole.

**2. Find the guides.** Get a 1x-DPR screenshot or the live DOM. Collect the dominant left edges: page gutter, container padding, icon column, text column, trailing actions. Expect three to five. More than six means the region has no system yet — establish one before nudging.

**3. Measure, don't eyeball.** Run `scripts/gridlines.js` in the page (see below). It clusters edges into columns, flags elements within 6px of a column but not on it, and checks icon-to-text gaps per row and toolbar centres.

**4. Classify every miss.**
- Container-level → parent padding/gap/grid is wrong. Fix there.
- Item-level → the item carries a stray margin, width or `justify-content`. Remove it.
- Optical-level → geometry is right, the ink is not. Nudge ≤1px, last, and comment why.
- Deliberate → full-bleed media, centred empty states, right-aligned numbers. Leave them, and say so.

**5. Fix at the right level.** Token or parent first. Only then optical nudges. Never both at once — you cannot tell which one worked.

**6. Verify with the same guides.** Re-run the script or overlay the same lines. The report must be empty of near misses before you call it done.

## Using The Script

`scripts/gridlines.js` defines `window.__gridlines(options)` and returns a JSON report; it also draws the guides.

In a browser you control (Playwright, chrome-devtools-axi, or the page console):

```js
// Playwright
await page.addScriptTag({ path: '<skill>/scripts/gridlines.js' });
const report = await page.evaluate(() => window.__gridlines({ root: '.sidebar' }));
await page.evaluate(() => window.__gridlinesGuides());
await page.screenshot({ path: 'gridlines.png' });
```

```js
// Console
__gridlines({ root: '.sidebar' });   // report
__gridlinesGuides();                 // draw lines
__gridlinesClear();                  // remove them
```

Options: `root` (CSS selector, default `body`), `tolerance` (px treated as the same column, default 1), `nearMiss` (px window for a near miss, default 6), `minColumn` (elements needed to count as a guide, default 3).

The report has `columns` (each guide, its left edge, how many elements sit on it), `nearMisses` (element, nearest guide, delta, selector), `iconGaps` (the modal icon-to-text gap and every row that deviates), and `centres` (toolbar groups whose vertical centres disagree). Screenshot the overlay and read it before changing code — the lines tell you which law is broken.

## Output

Report findings as a table, worst first, with the fix level named:

```
sidebar row 3        text left 45px, guide 44px (Δ1)   container: padding 12→11
sidebar header       left 12px, guide 12px ✓            —
toolbar (top bar)    icon centres 15.5 / 16 / 14.5px    item: remove 1px top margin
card grid            gutter 24px vs inner 20px          container: unify to 20px
```

## Common Cases

- **Sidebar row** — padding `P`, icon box 16, gap 8 → label at `P+24`. Header at `P`.
- **List with trailing meta** — meta right edge is a guide too. Use one, not "whatever fits".
- **Toolbar** — equal gaps between ink centres, not between boxes. Mixed icon sizes get equal optical area.
- **Form** — labels, inputs and help text share one left edge; the error icon does not push the text.
- **Card grid** — the page gutter and the card's inner padding are separate systems. Equal numbers are a coincidence, not a rule.
- **Numbers** — right-align or use tabular figures; left-aligned proportional digits wobble every row.

## Do Not

- Nudge one item when its parent owns the measurement.
- Align across unrelated groups (page gutter ≠ card padding ≠ table cell padding).
- Centre text inside a left-aligned list to "balance" it.
- Fix a 1px miss with a 6px change; that is a different layout, not an alignment.
- Claim a screen is aligned from a screenshot alone when the DOM is available.

## Credit

Distilled from [@pritamux](https://x.com/pritamux)'s `/gridlines` skill and [@karrisaarinen](https://x.com/karrisaarinen)'s breakdown of the Linear sidebar's alignment.
