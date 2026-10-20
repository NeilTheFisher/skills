---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round, with the question tool, recommended answer first. Then wait for the user's answers before the next round.

Ask the frontier with the **question tool**, never as prose in the reply. One
round = one question-tool call carrying every frontier question as its own item.
Rules for the call:

- `header` is a short title (max ~30 chars), `question` is the full body with the
  choices spelled out.
- Put your recommendation **first** in `options` and mark it `(Recommended)` in
  the label; the tool appends a free-form "type your own answer" automatically.
- Use `multiple: true` only when several options can genuinely be chosen at once.
- Assume the answer arrives; do not also restate the options in prose.

Anything that is not a decision (context, findings, a plan sketch) goes in the
reply text around the tool call, not inside the questions.

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.
