---
name: the-perfect-typescript-codebase
description: Build a new TypeScript project to one opinionated standard, where every rule is enforced by a command instead of remembered by an agent. Use when starting a TypeScript project from scratch, scaffolding the conventions before the first feature, or asking what a great TypeScript codebase looks like.
disable-model-invocation: true
argument-hint: "[optional stack hints, e.g. 'node cli', 'react + vite', 'cloudflare worker']"
---

Build the platonic ideal of a TypeScript codebase, and make it executable.

A standard written only in prose decays the moment nobody reads it. So the ideal is
not a list of opinions: it is a handful of configs that fail when the standard is
broken, plus one command that runs them all. Anything a tool cannot check is either
deleted or written down once in `AGENTS.md`.

## 1. Work in this order

Configs first, code second, and prove each config bites before writing a feature.

1. Scaffold the toolchain (step 2) and the single `check` command (step 3).
2. Set the compiler (step 4) and the module boundaries (step 5).
3. Prove the checks bite (step 8). Broken things must fail before anything real exists.
4. Write `AGENTS.md` with the commands and only the rules no tool enforces.
5. Build the first feature with `tdd`, through the public surface only.

**Done when** `check` passes on an empty project, and every deliberate violation in
step 8 is caught.

## 2. Toolchain defaults

Pick these unless the project already argues for something else. State the choice in
`AGENTS.md`; do not offer alternatives in passing.

| Concern | Default | Why |
| --- | --- | --- |
| Package manager | `pnpm`, pinned in `packageManager` | Fast, strict about undeclared deps, works with corepack |
| Runtime | Current Node LTS, pinned in `.nvmrc` and `engines` | One version everywhere, no surprise syntax |
| Tests | `vitest` | Fast, TS-native, no config to speak of |
| Lint | `typescript-eslint` with type-aware rules | Only type-aware lint catches floating promises and bad `any` flows |
| Format | `oxfmt` (or `prettier`) | Formatting is not a decision anyone should make twice |
| Boundaries | `dependency-cruiser` | Encodes the package boundary, so the agent cannot deep-import |
| Schemas | `zod` (or `valibot`) at every external boundary | External data is `unknown` until parsed |

Formatting and lint never overlap: formatter owns whitespace, linter owns semantics.

## 3. One command

There is exactly one thing to run, locally and in CI:

```json
{
  "scripts": {
    "check": "pnpm typecheck && pnpm lint && pnpm test && pnpm build",
    "typecheck": "tsc --noEmit",
    "lint": "oxlint --deny-warnings && dependency-cruiser src",
    "test": "vitest run"
  }
}
```

CI calls `pnpm check` and nothing else. Pre-commit calls `pnpm check`. Docs say
`pnpm check`. If a check is not in that command, it does not happen.

Keep it under a minute on a fresh clone; if it is slower, split `test` into `test:unit`
and `test:integration` rather than letting people skip it.

## 4. The compiler is the first linter

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "es2023",
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

`erasableSyntaxOnly` also rules out `enum`, parameter properties, and namespaces, so
every file runs under a type-stripping runtime and there is one way to write a module.

## 5. Shape: packages are deep modules

For the vocabulary (deep module, interface, seam, depth), call the Skill tool with
`codebase-design` and use its language.

```
src/
  packages/
    orders/
      index.ts      entry point, public
      client.ts     second entry point, also public
      lib/          implementation, private
      tests/        behaviour tests, through the entry points
```

Four boundary rules, all errors in `.dependency-cruiser.cjs`:

1. Outside a package you may import only its entry points (its root files), never a
   subfolder.
2. A package's own files import each other freely.
3. Tests import entry points, and their own `tests/` fixtures, never subfolders.
4. No dependency cycles.

Layout by domain, not by layer. A change should touch one package, and that package
should sit next to the thing that changes with it. Barrel files that re-export a whole
subtree are a shallow module in disguise: expose several small entry points instead.

## 6. Types

- Parse at the edge, then trust the type inside. One schema per boundary, and the type
  comes from it: `type Order = z.infer<typeof OrderSchema>`. Never hand-write a second
  copy of the same shape.
- `unknown` for external input, never `any`. `any` is a lint error, not a preference.
- No `as` except `as const`, or immediately after a parse that already proved the type.
  No `!` non-null assertions. Narrow with a guard or a discriminated union.
- State is a discriminated union, not three booleans and four optionals.
- `satisfies` to check a value against a type without widening it.
- Export a return type on every exported function; let locals infer. The interface is
  the contract, the body is free to change.
- Derive, don't copy: `typeof`, `ReturnType`, `Parameters`, `Awaited`.
- Named exports only. Default exports break rename, auto-import, and grep.
- No `enum`, no `namespace`, no decorators that need emit.

## 7. Runtime

- Errors are `Error` with a message that says what failed and `{ cause }` chained.
  Never throw strings or plain objects.
- `catch` only to add information or to recover. Otherwise let it propagate; a
  swallowed error is a bug that reports itself later and worse.
- No floating promises (typed lint catches it). `Promise.all` for independent work;
  sequential awaits get a comment saying why they must be sequential.
- No module-level mutable state and no import-time side effects. Pass dependencies as
  arguments; that is what makes a module deep rather than a global with an interface.
- Read `process.env` in one config module, parse it with a schema, and export the typed
  result. Nothing else reads the environment.

## 8. Prove the checks bite

Before the first feature, break each thing on purpose, watch `check` fail, then revert:

- `const x: any = 1` → lint fails.
- `import { x } from '../other/lib/x'` → dependency-cruiser fails.
- A test importing another package's `lib/` → dependency-cruiser fails.
- `void somePromise()` → typed lint fails.
- Remove an index guard → `tsc` fails.

A check nobody has seen fail is a check that may not be wired up.

## 9. Tests

- One behaviour per test, named after the behaviour, so it fails only when that
  behaviour regresses. That is the only reason a test should exist.
- Through the entry point, never internals. A test that needs a private detail is
  telling you the interface is wrong.
- No snapshots as proof, no sleeps, no network. Inject a fake at the boundary.
- Every bug fix starts with a failing test (`tdd`). Prune tests that guard nothing
  (`prune-tests`).

## 10. Files and docs

- Small enough to read in one pass. Split by concept, never to hit a line count, and
  keep the split enforced (`ratchet-files`).
- File name is the concept, one exported concept per file.
- `AGENTS.md` holds: install, `pnpm check`, the layout in five lines, and the few rules
  no tool can enforce. Nothing else. Prose that repeats a lint rule is a second source
  of truth that will drift.
- Domain vocabulary goes in `GLOSSARY.md` (`domain-modeling`), decisions that need
  defending go in an ADR.

## Existing codebase

Do not rewrite it into the ideal. Install the checks first: they start red only where
the code is already wrong, which is the work list. Then fix by blast radius:

1. Compiler flags: mechanical, highest value, no judgement.
2. Boundaries: dependency-cruiser, then restructure imports.
3. Type-aware lint debt: fix, `--deny-warnings`, keep it green.
4. Tests around the code that actually breaks.

From then on, new code must not add violations. For a codebase that needs real
restructuring rather than conformance, use `untangle-codebase`.

**Done when** a new agent can add a feature touching one package without opening
another package's `lib/`, `check` is the only command anyone runs, and every ideal in
this file either fails a command or is written down once.
