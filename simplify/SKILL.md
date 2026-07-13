---
name: simplify
description: Simplify complex code by spawning sub-agents to analyze, refactor, and verify improvements. Use when user says "simplify", "/simplify", "make this simpler", "refactor for clarity", "reduce complexity", or wants to streamline code. Works with any code type - functions, classes, modules, or entire files.
---

# Simplify

Break down complex code into simpler, more maintainable pieces. Spawn sub-agents to handle analysis, refactoring, and verification in parallel.

## When to Use

- Code is hard to read or understand at a glance
- Functions are too long (>20-30 lines) or do too many things
- Deep nesting (callback hell, nested ifs, arrow code)
- Complex conditionals with multiple boolean operators
- Duplicated logic that could be unified
- User explicitly asks to "simplify", "clean up", or "refactor"

## Workflow

### 1. Analyze (Read-Only)

First, understand what the code does without changing it:

- Identify the core purpose
- Map inputs and outputs
- Note side effects and dependencies
- Flag risky areas (mutations, async, error handling)
- Measure complexity (nesting depth, line count, cyclomatic complexity)

### 2. Plan

Create a simplification strategy:

- Break into smaller, named functions with single responsibilities
- Extract conditionals into descriptive boolean variables or helper functions
- Replace loops with array methods (map/filter/reduce) where clearer
- Flatten nested structures using early returns or guard clauses
- Remove dead code, unused variables, and redundant comments
- Identify opportunities for standard library usage vs custom code

### 3. Execute (Spawn Sub-Agents)

For each distinct simplification task, spawn a sub-agent:

```
Task: Simplify [specific function/module]
Context: [relevant surrounding code]
Constraints:
- Preserve all existing behavior
- Maintain type signatures (if typed)
- Keep error handling equivalent
- Don't change public APIs without approval
- Add tests if none exist for the changed code
```

Run independent simplifications in parallel. For dependent changes, sequence them.

### 4. Verify

After changes:

- Run existing tests (must pass)
- Run type checker (must pass)
- Run linter (must pass)
- Review for behavior preservation
- Check that new code is actually simpler (shorter, flatter, clearer names)

## Simplification Patterns

### Extract Function

```typescript
// Before
if (user && user.profile && user.profile.settings && user.profile.settings.notifications && user.profile.settings.notifications.email) {
  sendEmail(user.profile.settings.notifications.email);
}

// After
const getUserEmail = (user) => user?.profile?.settings?.notifications?.email;
const email = getUserEmail(user);
if (email) sendEmail(email);
```

### Early Returns

```typescript
// Before
function processData(data) {
  if (data) {
    if (data.items) {
      if (data.items.length > 0) {
        return data.items.map(transform);
      }
    }
  }
  return [];
}

// After
function processData(data) {
  if (!data?.items?.length) return [];
  return data.items.map(transform);
}
```

### Descriptive Conditionals

```typescript
// Before
if (x > 0 && y > 0 && x < 100 && y < 100 && !(x === y)) {
  // ...
}

// After
const isValidCoordinate = (n) => n > 0 && n < 100;
const isDistinctPair = (a, b) => a !== b;
if (isValidCoordinate(x) && isValidCoordinate(y) && isDistinctPair(x, y)) {
  // ...
}
```

## Rules

- **Behavior preservation is non-negotiable** — if unsure, ask before changing
- **Prefer clarity over cleverness** — explicit is better than implicit
- **One level of abstraction per function** — don't mix high-level orchestration with low-level details
- **Names are documentation** — extract concepts into well-named variables/functions
- **Delete code aggressively** — unused code, commented-out code, redundant comments
- **Keep public APIs stable** — internal refactoring shouldn't break consumers
- **Test coverage required** — if simplifying untested code, write tests first or verify extremely carefully

## Anti-Patterns to Avoid

- Don't just shorten variable names (makes code cryptic)
- Don't merge unrelated concepts to save lines
- Don't remove error handling to make code "cleaner"
- Don't introduce abstractions that only hide simple operations
- Don't optimize for line count at the expense of readability

## Sub-Agent Spawning

When spawning sub-agents for simplification:

1. Give each agent a focused scope (one function or one concern)
2. Provide full context needed to understand the code
3. Specify constraints explicitly
4. Have agents report what they changed and why
5. Review all changes before applying

For large files, spawn agents per logical section. For complex refactorings, have one agent do the extraction and another verify the result.
