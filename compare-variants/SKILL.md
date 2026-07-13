---
name: compare-variants
description: Build N alternative implementations of a UI/design change, screenshot each, open the screenshots in the user's VS Code Insiders window (code-insiders -r), let the user pick, then apply the winning variant as a git patch. Use when the user wants to see multiple design/implementation possibilities side by side before committing to one, or says "show me variants", "let me compare options", or "do each and I'll decide".
---

# Compare Variants

Present real, working alternatives instead of describing them. Each variant is
built on the same baseline, screenshotted, saved as a git patch, and shown to
the user in their editor. The winner is re-applied; the rest are discarded.

## Workflow

1. **Establish the baseline.** The affected files must be resettable with
   `git checkout -- <files>` (commit or note any uncommitted changes first).
   If a shared prerequisite fix exists (e.g. a bug fix all variants need),
   re-apply it into EVERY variant so the winning patch includes it.

2. **For each variant (A, B, C ...):**
   - Reset the affected files: `git checkout -- <files>`
   - Implement the variant (re-applying any shared fix)
   - Syntax check (`node --check`, `php -l`, etc.)
   - Save the patch:
     `git diff <files> > <scratchpad>/variant-<letter>.patch`
   - Hard-reload the page via chrome-devtools MCP
     (`npx mcporter call chrome-devtools.navigate_page type=reload ignoreCache=true`)
   - Screenshot as PNG (not low-quality JPEG) with a descriptive name:
     `npx mcporter call chrome-devtools.take_screenshot format=png filePath=<scratchpad>/variant-<letter>-<slug>.png`
   - If the variant is about interaction (menus, modals), capture it in the
     open/active state; take a second screenshot of secondary views if the
     variant moves content elsewhere.

3. **Open all screenshots in the user's editor in one call** (`-r` reuses the
   current window):

   ```bash
   code-insiders -r variant-a-x.png variant-b-y.png variant-c-z.png
   ```

4. **Ask the user to pick** with AskUserQuestion: one option per variant, each
   label naming the variant letter and idea, each description giving the
   one-line tradeoff. Mention which variant is currently live in the browser
   so they can feel the interactions too. Expect tweak requests, not just a
   pick.

5. **Apply the winner:**
   ```bash
   git checkout -- <files>
   git apply <scratchpad>/variant-<letter>.patch
   ```
   Then apply any tweaks the user asked for, re-verify in the browser, and
   screenshot once more for confirmation.

## Rules

- Never leave the working tree on a losing variant; always end with the
  winner (plus tweaks) applied and verified.
- Patches live in the session scratchpad; they are throwaway artifacts, not
  deliverables.
- Variants must be functionally equivalent (same behavior reachable), only
  the presentation/structure differs; say so explicitly if one variant drops
  or relocates functionality.
- If `code-insiders` is unavailable, fall back to `code -r`, then to sharing
  the screenshot paths.
