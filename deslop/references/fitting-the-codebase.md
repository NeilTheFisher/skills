# Fitting the codebase (a method, not a style guide)

This file does not give you a coding style to copy. The point of the data is that AI code
reads as AI precisely because it reaches for the most common pattern in its training set
instead of the one your project actually uses. Any fixed style, applied by default, is just a
different average. So this is a way to make code fit the project, which is the one property
that stops it reading as machine-generated.

## Start from the codebase, always

The input that does the most work is the repo itself. Before generating, give the model the
files it will sit next to: the module it is extending, the nearest sibling that already does
something similar, the project's conventions (how errors are handled, how things are logged,
how modules are structured, the naming vocabulary). A change that follows the existing patterns
is small and invisible. A change that ignores them is the 2000-line PR that should have been 50.

If there is genuinely no precedent in the repo, make one deliberate decision and write it down
(a short conventions note the model can read), rather than letting each file invent its own
approach.

## The requirement, not the demo

State what the code actually has to do, including the cases that matter, before generating.
Boilerplate / tutorial-shaped code is the loudest tell because the model defaults to the
sample-app shape when the requirement is vague. Name the real inputs, the real failure modes,
the real integration.

## Verify what a regex cannot

- **Does it call anything that does not exist?** Run it. Check every import and method against
  the real docs. Use the tools the language gives you: `tsc --noEmit`, `mypy`, `go build ./...`,
  `cargo check`, `python -m py_compile`.
- **Does it match how this repo already does things?** Read the diff against the neighboring
  code. A new logging approach, a new error pattern, a new structure mid-file is the
  style-mismatch tell.

## The surface tells are the cheap part

The scanner handles the mechanical layer: emoji, chat artifacts, placeholder comments,
swallowed errors, narrating comments, generic names. Strip those, but do not mistake stripping
them for the job. A file with no emoji and a clean lint that is still tutorial-shaped, calls a
made-up API, and ignores the repo is still AI slop.

## Do not over-correct

Telling the model to "not look AI" backfires: it over-produces defensive checks, extra types,
extra comments. Match the level the surrounding code operates at. Add nothing the neighboring
code would not have.

## The escape hatch

A pattern chosen on purpose is not a tell. When a flagged line is a real decision, keep it
and mark it `unslop-ignore` so the audit stays honest.

## The one-line version

Feed the model the surrounding code and tell it to match, then run the result and check every
call is real. Everything else is detail.
