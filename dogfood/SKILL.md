---
name: dogfood
description: Systematic exploratory QA testing of web applications — find bugs, capture evidence, and generate structured reports
version: 1.0.0
metadata:
  gauss:
    tags: [qa, testing, browser, web, dogfood]
    related_skills: []
---

# Dogfood: Systematic Web Application QA Testing

## Overview

This skill guides you through systematic exploratory QA testing of web applications using the browser toolset. You will navigate the application, interact with elements, capture evidence of issues, and produce a structured bug report.

## Prerequisites

- Browser toolset must be available on the `playwright` MCP server (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_evaluate`, `browser_console_messages`, `browser_navigate_back`, `browser_press_key`, `browser_take_screenshot`, `browser_close`). Verify with `bunx mcporter list playwright --brief` before starting.
- A target URL and testing scope from the user

## Inputs

The user provides:
1. **Target URL** — the entry point for testing
2. **Scope** — what areas/features to focus on (or "full site" for comprehensive testing)
3. **Output directory** (optional) — where to save screenshots and the report (default: `./dogfood-output`)

## Workflow

Follow this 5-phase systematic workflow:

### Phase 1: Plan

1. Create the output directory structure:
   ```
   {output_dir}/
   ├── screenshots/       # Evidence screenshots
   └── report.md          # Final report (generated in Phase 5)
   ```
2. Identify the testing scope based on user input.
3. Build a rough sitemap by planning which pages and features to test:
   - Landing/home page
   - Navigation links (header, footer, sidebar)
   - Key user flows (sign up, login, search, checkout, etc.)
   - Forms and interactive elements
   - Edge cases (empty states, error pages, 404s)

### Phase 2: Explore

For each page or feature in your plan:

1. **Navigate** to the page:
   ```
   browser_navigate(url="https://example.com/page")
   ```

2. **Take a snapshot** to understand the DOM structure:
   ```
   browser_snapshot()
   ```

3. **Check the console** for JavaScript errors:
   ```
   browser_console_messages(clear=true)
   ```
   Do this after every navigation and after every significant interaction. Silent JS errors are high-value findings.

4. **Take a screenshot** to visually assess the page and identify interactive elements:
   ```
   browser_take_screenshot()
   ```
   There is no `browser_vision` tool — read the returned PNG directly instead of
   delegating to a vision helper. Element refs come from `browser_snapshot()`, which
   labels interactives as `@eN`; pass those refs to later browser commands.

5. **Test interactive elements** systematically:
   - Click buttons and links: `browser_click(ref="@eN")`
   - Fill forms: `browser_type(ref="@eN", text="test input")`
   - Test keyboard navigation: `browser_press_key(key="Tab")`, `browser_press_key(key="Enter")`
   - Scroll through content: there is no `browser_scroll` tool — use
     `browser_evaluate(ref="@eN", function="() => window.scrollBy(0, 800)")`
   - Test form validation with invalid inputs
   - Test empty submissions

6. **After each interaction**, check for:
   - Console errors: `browser_console_messages()`
   - Visual changes: `browser_take_screenshot()` and compare against the prior capture
   - Expected vs actual behavior

### Phase 3: Collect Evidence

For every issue found:

1. **Take a screenshot** showing the issue:
   ```
   browser_take_screenshot()
   ```
   Save the `screenshot_path` from the response — you will reference it in the report.

2. **Record the details**:
   - URL where the issue occurs
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Console errors (if any)
   - Screenshot path

3. **Classify the issue** using the issue taxonomy (see `references/issue-taxonomy.md`):
   - Severity: Critical / High / Medium / Low
   - Category: Functional / Visual / Accessibility / Console / UX / Content

### Phase 4: Categorize

1. Review all collected issues.
2. De-duplicate — merge issues that are the same bug manifesting in different places.
3. Assign final severity and category to each issue.
4. Sort by severity (Critical first, then High, Medium, Low).
5. Count issues by severity and category for the executive summary.

### Phase 5: Report

Generate the final report using the template at `templates/dogfood-report-template.md`.

The report must include:
1. **Executive summary** with total issue count, breakdown by severity, and testing scope
2. **Per-issue sections** with:
   - Issue number and title
   - Severity and category badges
   - URL where observed
   - Description of the issue
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshot references (use `MEDIA:<screenshot_path>` for inline images)
   - Console errors if relevant
3. **Summary table** of all issues
4. **Testing notes** — what was tested, what was not, any blockers

Save the report to `{output_dir}/report.md`.

## Tools Reference

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Go to a URL |
| `browser_snapshot` | Get DOM text snapshot (accessibility tree); source of `@eN` refs |
| `browser_click` | Click an element by ref (`@eN`) or text |
| `browser_type` | Type into an input field |
| `browser_evaluate` | Run JS in the page — use this to scroll, since there is no scroll tool |
| `browser_navigate_back` | Go back in browser history |
| `browser_press_key` | Press a keyboard key |
| `browser_take_screenshot` | Capture a PNG; returns `screenshot_path` |
| `browser_console_messages` | Get JS console output and errors |
| `browser_close` | Close the browser session |

All of these live on the `playwright` MCP server. Reach them through MCPorter, never
as direct tool calls:

```bash
bunx mcporter list playwright --brief          # discover exact signatures
bunx mcporter call playwright.browser_navigate url=https://example.com
```

## Tips

- **Always check `browser_console_messages()` after navigating and after significant interactions.** Silent JS errors are among the most valuable findings.
- **Re-run `browser_snapshot()` when refs go stale.** Refs are positional; after any navigation or DOM change, take a fresh snapshot rather than reusing old `@eN` values.
- **Test with both valid and invalid inputs** — form validation bugs are common.
- **Scroll through long pages** — content below the fold may have rendering issues.
- **Test navigation flows** — click through multi-step processes end-to-end.
- **Check responsive behavior** by noting any layout issues visible in screenshots.
- **Don't forget edge cases**: empty states, very long text, special characters, rapid clicking.
- When reporting screenshots to the user, include `MEDIA:<screenshot_path>` so they can see the evidence inline.
