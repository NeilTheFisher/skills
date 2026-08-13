# The AI-written-code tells: full catalog

Each entry has the data evidence, a real quote from the Reddit threads, the code-level
signature the scanner keys on, and the fix. Ordered by the **verified share** of the comments
that name a specific tell. Source: 11,906 on-topic posts + 11,306 comments across 55 AI,
coding, and SaaS subreddits, 2020 to 2026, classified by an LLM into a fixed taxonomy of
19 tells and then adversarially verified quote by quote.

Two numbers matter. **Raw** is the share the LLM classifier assigned. **Verified** is what
survived re-reading the actual quotes, discounted by precision. Trust verified over raw.

Every entry tagged with its class: **bug** (code is wrong), **substance** (wrong for the job),
or **cosmetic** (reads as AI but nothing breaks).

## Part A: tells the scanner catches

### 1. Over-commenting / narrating comments
**Class.** Cosmetic. **Verified:** 8.5% (raw 18.2%, precision ~47.5%)
**Quote:** "2.5 pro legit will add comments like `// include weights` before a line that simply adds weights into a json object."
**Fix.** Comment why, not what. Delete any comment that restates the code next to it.

### 2. Emoji in code
**Class.** Cosmetic. **Verified:** 3.9%, precision ~77%
**Quote:** "Full of emojis + randomly bolded words = AI slop."
**Fix.** Remove emoji from source. Mark intentional ones with `unslop-ignore`.

### 3. Catch-all / swallowed errors
**Class.** Bug. **Verified:** 3.1%
**Quote:** "they throw their own exception then catch it and convert it into a generic 'something went wrong' error."
**Fix.** Catch specific exceptions and handle them. Let unexpected failures surface.

### 4. Generic placeholder names
**Class.** Cosmetic (often flags a substance problem underneath). **Verified:** 1.9%, precision ~100%
**Quote:** "a function called `process_data()` that somehow does 11 different things."
**Fix.** Name the function for its actual job. If you cannot, the function is doing too much.

### 5. Placeholder / ellipsis comments left in
**Class.** Bug. **Verified:** 1.6%, precision ~100%
**Quote:** "it either gives you the exact same response or says `//// rest of the code goes.`"
**Fix.** Write the real code the comment is standing in for.

### 6. Leftover chat / assistant artifacts
**Class.** Cosmetic. **Verified:** 1.2%
**Quote:** "All of the em dashes, the markdown format, the same sentence structure... no human would actually add."
**Fix.** Delete every line that is the assistant talking, including the polite preamble and the closing offer.

### 7. Over-verbose identifiers
**Class.** Cosmetic. **Verified:** 0.4%, precision ~16.7%
**Quote:** "None of this `inputProcessingAndFormatting()` crap."
**Fix.** Trim the name to the precise noun or verb. Descriptive is good; a sentence is not.

## Part B: tells a regex cannot see (human or compiler pass required)

These are the LOUDEST tells in the data. The scanner will not flag them.

### 8. Boilerplate / tutorial-shaped code **(the #1 tell)**
**Class.** Substance. **Verified:** 18.6%, precision ~90%
**Quote:** "If you just ask it to make your app and press generate it's normally one page placeholder no backend and a bunch of dummy data."
**Fix.** Build the actual thing with real data and real backend. The tutorial shape is the loudest tell.

### 9. Hallucinated APIs and made-up libraries
**Class.** Bug. **Verified:** 11.2%, precision ~62.5%
**Quote:** "hallucinated library methods that compile but don't exist at runtime."
**Fix.** Run it. Check every import and method against real docs. A compiler catches this; a regex never will.

### 10. Over-engineering
**Class.** Substance. **Verified:** 7.8%, precision ~60.6%
**Quote:** "Giant functions, hidden side effects, random abstractions that nobody would consciously design."
**Fix.** Ask whether a simple if/else would do. Delete the abstraction with one caller.

### 11. "You can just tell" (the umbrella)
**Class.** Not a single tell; the feeling. **Verified:** 17.8%
**Quote:** "You can spot the vibe coders in the comments."
**Fix.** Not actionable on its own. Use the rest of the catalog.

### 12. Style that ignores the surrounding codebase
**Class.** Substance. **Verified:** 3.5%, precision ~64.3%
**Quote:** "a PR that should be 50 LoC because it follows naturally from the existing codebase patterns vs a PR that is 2000 LoC that ignores the codebase conventions."
**Fix.** Make the code follow the conventions already in the repo. Give the model the existing code, not a blank slate.

### 13. Too clean, no human mess
**Class.** Meta-signal. **Verified:** 2.3%, precision ~42.9%
**Quote:** "AI generated code often looks clean. Passes linting, decent structure."
**Fix.** None for the author. For the reviewer: do not let a clean surface end the review.

### 14. Mixed skill level
**Class.** Substance. **Verified:** 1.9%, precision ~50%
**Quote:** "use programming practices that were outdated 10 years ago or even mix practices from the 90s with cutting edge practices from 2025."
**Fix.** If you cannot explain a line, do not ship it.

## Part C: cleared by the data (do not chase)

- **Left-in debug logging**: rejected outright, precision ~0%.
- **Reinventing the wheel**: inflated, precision ~16.7%.
- **Over-defensive validation**: inflated, precision ~40%.

## The over-correction trap

Telling a model "write clean code" backfires: it adds defensive checks for cases that cannot
occur, a type on every local, a comment on every block. Performed seniority is its own tell.
Match the level the surrounding code operates at. Add nothing the neighboring code would not have.

## Language coverage

Universal tells (in comments/strings, caught everywhere): emoji, chat artifacts, placeholder
comments, narrating comments. Syntax-keyed tells are language-specific (see scanner docs).
