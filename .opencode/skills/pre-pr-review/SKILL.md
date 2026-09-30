---
name: pre-pr-review
description: Pre-PR code review orchestrator. Runs the regression checker first and blocks on any regressions, then runs a set of code review focuses in parallel (repo rule compliance, KISS/DRY, de-sloppification, performance/Big-O, logging rules, plus optional layer-scoped focuses), synthesises them into a single PR_REVIEW.md at the repo root, walks through each finding with the user via the ask-user-a-question tool to capture a decision, records those decisions in detail in the review document, and raises GitHub Issues for deferred findings (combined where similar or overlapping) once all decisions are recorded.
license: MIT
compatibility: Mistral Vibe CLI
user-invocable: true
allowed-tools:
  - bash
  - read_file
  - write_file
  - task
---

# Pre-PR Review

Use this skill before opening a pull request. It produces a single synthesised review document at the
repo root named `PR_REVIEW.md`.

The skill does **not** run automated checks itself beyond the regression gate. Every review agent is
explicitly told not to run lint, type-check, or tests — those are expected to already pass and are
verified by the regression checker up front.

## What it does

1. Runs the regression checker and blocks if the branch has regressed against the baseline.
2. Captures the diff between the current branch and `main`.
3. Launches the review focuses in parallel.
4. Synthesises the results into `PR_REVIEW.md` at the repo root.
5. Walks through each finding to capture decisions, then creates GitHub Issues for any deferred
   findings (combined where similar or overlapping).

## Quick start

From the repository root, invoke the skill directly (e.g. `pre-pr-review`). No arguments are required;
the branch name and `main` are detected automatically.

## Core principles

- Delegate outcomes, not implementation. Review sub-agents contain their own methodology.
- Sub-agents cannot spawn sub-agents. The skill coordinates all parallel calls.
- Only task-specific files are handed to a sub-agent, as `@`-prefixed worktree-relative
  paths in the prompt body (e.g. `@src/backend/foo.js`); opencode injects the line-numbered
  contents of each `@path` token into the sub-agent's context automatically. Agents still
  read their own standards (AGENTS.md, module docs) per their own instructions.
- British English in all outputs and the synthesised document.
- Stay within scope: no auto-fix, no commit/push, no CI wiring.

## Step 1 — Regression gate

Run the regression checker from the repo root with a long timeout (test suites can take minutes):

```bash
npm run regression-checker
```

> **Timeout:** Always set a 600000 ms (10 minute) timeout when invoking this via the `bash` tool.

Read the resulting `comparison.txt` (or `baseline.txt` on the first run) from the report directory
(default `.ts-regression-checker/reports/<branch-name>/`). Inspect:

- `overallStatus`
- `regressionsCount` / `newFailuresCount`

**If regressions are present:**

- Stop immediately. Do not start the review.
- Report the regressions (failed checks, new failures) to the user and instruct them to fix those
  first, then re-run this skill.
- The regression checker is the source of truth for whether the branch is healthy enough to review.

**If clean:** proceed to Step 2.

See `regression-checker/SKILL.md` for full report-artefact details and validation notes.

## Step 2 — Diff and scope

Capture the change set between the current branch and `main`:

```bash
git diff main...HEAD --stat
git diff main...HEAD
```

Save the full diff and the `--stat` summary to the scratchpad. Build the changed-file list and
classify which layers are touched:

- Frontend: any path under `src/frontend/`
- Backend: any path under `src/backend/`
- Builder: any path under `scripts/builder/`

This classification drives which optional focuses run (Step 3).

## Step 3 — Parallel review agents

Launch every focus as a separate `task` agent in a **single message** (multiple tool calls) so they
run in parallel. The skill owns all coordination; never instruct a sub-agent to spawn other agents.

For every focus, the handoff prompt MUST include:

- The actual changed files (and changed test files) for that focus, as `@`-prefixed
  worktree-relative paths in the prompt body (e.g. `@src/frontend/.../Xyz.tsx`), so opencode
  injects their line-numbered contents. Do not paste file contents into the prompt body.
- The explicit constraint: _"Do NOT run lint, type-check, or tests. All automated checks are expected
  to pass already and are verified by the regression gate before this review began."_
  - The instruction to focus primarily on the diff findings, but also to report incidental issues
    discovered while inspecting the changed files (e.g. in surrounding code read for context). Incidental
    findings should be clearly separated from diff findings and labelled as incidental so the orchestrator
    can surface them in `PR_REVIEW.md` for the user to triage. Every claim needs file:line evidence.
- The requested outcome: a structured review (Critical / Improvement / Nitpick) for that focus only.

### Core focuses (always run)

1. **Repo rule compliance** → `code-reviewer`
   - Focus on AGENTS.md rules, module-specific checklists, and the universal/module standards in the
     code-reviewer instructions.
2. **KISS & DRY** → `code-reviewer`
   - Focus on simplicity, SOLID, duplication-versus-wrong-abstraction (WET), and speculative abstraction.
3. **De-Sloppification** → `de-sloppification`
   - Full slop hunt on the changed code per its own workflow.
4. **Performance (Big-O)** → `code-reviewer`
   - Focus on algorithmic complexity of hot paths and routines. Identify loops, nested iteration, and
     data-structure choices that could be faster; express cost in Big-O notation and name the routine.
5. **Logging rules compliance** → `code-reviewer`
   - Focus on the logging and error-handling policy for the touched modules (backend
     `docs/developer/backend/backend-logging-and-error-handling.md`, frontend
     `docs/developer/frontend/frontend-logging-and-error-handling.md`). Check no `console.*`, correct
     log boundaries, no double-logging, and rethrow-at-boundary discipline.

### Optional focuses (run only when the layer is in the diff)

Enable each only if its layer appears in the Step 2 classification.

- **Frontend layout / design principles / accessibility** → `code-reviewer` (frontend only)
  - References: `docs/developer/frontend/frontend-spacing-and-padding-standards.md`,
    `docs/developer/frontend/frontend-loading-and-width-standards.md`,
    `docs/developer/frontend/frontend-shell-navigation-and-motion.md`,
    `docs/developer/frontend/frontend-modal-patterns.md`.
  - Check 8px grid spacing, width-token ownership, loading/busy accessibility semantics
    (`role="status"`, `aria-busy`, `aria-live`), keyboard activation, and motion conventions.
- **Frontend data shape / schema consistency** → `code-reviewer` (frontend only)
  - Consistency of view-model/prop shapes and API boundary contracts in the changed frontend code.
- **Backend data shape / schema consistency** → `code-reviewer` (backend only)
  - Consistency of entities, `toJSON`/`fromJSON` shapes, and `appsscript.json` scope/service changes.
- **Security & secrets** → `code-reviewer`
  - Hardcoded credentials/keys, `PropertiesService`/`ScriptApp` misuse, unsafe HtmlService output,
    and injection-prone string building.
- **Test-coverage gaps** → `code-reviewer`
  - Changed logic with no corresponding test, per `docs/developer/backend/backend-testing.md` and
    `docs/developer/frontend/frontend-testing.md`. Flag untested paths; do not write tests.
- **Error-handling robustness** → `code-reviewer`
  - Broad `catch`/swallow, missing rethrow at boundaries, and missing `Validate.requireParams` on
    public backend methods.
- **Data-shape docs consistency** → `code-reviewer`
  - **Trigger:** run if the diff touches any file under `docs/developer/data-shapes/`, or any
    validation schema (e.g. `*.zod.ts`, `*Schema*`, `*Validation*`), API contract (transport
    handlers, API request/response shapes, boundary types), or data persistence model (entities,
    `toJSON`/`fromJSON`, storage layer, model files) — on either the frontend or backend.
  - Inspect the diff against the canonical data-shape specifications in `docs/developer/data-shapes/`.
  - Check that the data-shape docs have been updated to reflect the changes — they should have been,
    per the data-shapes-agent workflow mandated in `AGENTS.md` section 4 and the implementation
    ACTION_PLAN.md.
  - Cross-reference code vs docs: do the schemas in code match the documented contracts in
    `docs/developer/data-shapes/`? Note any discrepancies (field names, types, optionality,
    constraints, serialisation format).
  - Flag issues highlighted by the docs that are not addressed in the code (e.g. documented
    invariants that the code does not enforce, documented constraints that are absent, or
    documented shape changes that were not implemented).
  - Also flag reverse problems: code changes that introduce new schema or persistence behaviour
    that is not yet documented.
  - Report incidental findings from reading the data-shape docs (e.g. stale content, contradictions
    between docs, missing entries for existing code constructs). Clearly label these as incidental.

## Step 4 — Synthesise into PR_REVIEW.md

Write the synthesised document to `PR_REVIEW.md` at the repository root. Structure:

```markdown
# Pre-PR Review — <branch-name>

- **Base branch:** main
- **Generated:** <ISO timestamp>
- **Regression gate:** PASS (no regressions) | BLOCKED (see regressions above)
- **Changed files:** <count> (<diff --stat summary pasted here>)

## Verdict

**Pass / Needs Improvement / Fail** — one sentence rationale. Fail if any focus reported a Critical.

## Focus areas

### Repo rule compliance

<verbatim Critical/Improvement/Nitpick items from the agent, with file:line evidence>

### KISS & DRY

...

### De-Sloppification

...

### Performance (Big-O)

...

### Logging rules compliance

...

### Frontend layout / design / accessibility (optional)

...

### Frontend data shape / schema consistency (optional)

...

### Backend data shape / schema consistency (optional)

...

### Security & secrets (optional)

...

### Test-coverage gaps (optional)

...

### Error-handling robustness (optional)

...

### Data-shape docs consistency (optional)

...
```

Paste each agent's items verbatim (with their file:line evidence). Keep the agent's separation between
diff findings and incidental findings intact — render incidental items in their own subsection
(e.g. `#### Incidental (triage)`) so the user can distinguish blocking PR issues from separate
cleanup opportunities. Omit a section only if that focus did not run (optional focus not in scope);
label omitted optional sections with `_(not in scope for this diff)_`.

## Step 5 — Decision pass with the user

Before finalising, walk through **every** finding in the synthesised `PR_REVIEW.md` with the user. For
each finding, capture the user's decision on whether and how to address it. Where appropriate, ask for
the chosen approach (e.g. fix now, defer, wontfix, or a specific remediation strategy) so the outcome is
unambiguous.

Guidance:

- Work through findings **strictly one item at a time** in order of severity (Critical → Improvement →
  Nitpick), including incidental items. Do not present or ask about the next finding until the current
  one has been decided.
- **Explain in chat, ask with the tool.** Put the full explanation of the finding — what it is, its
  `file:line` evidence, the options, and their trade-offs — in the chat message, then use the **ask user
  a question** tool **only** to capture the choice. Do not attempt to compress a complex issue into the
  tool's option labels or character limits; the tool is for selecting an option, not for conveying the
  detail. The chat explanation is the source of detail.
- Record each decision in full detail — do not reduce it to a single word. Capture the chosen option and
  any specifics the user provides about _how_ the issue should be addressed (e.g. the intended fix, the
  trade-offs considered, or why a finding is being rejected).
- **Deferral means a GitHub Issue.** When presenting the defer option, state explicitly that choosing it
  assumes a GitHub Issue will be created recording the deferred work. Do not create the Issue during the
  decision pass; collect all deferrals first so similar or overlapping findings can be combined into a
  single Issue in Step 7.

## Step 6 — Record decisions in PR_REVIEW.md

Append a **Decisions** section to `PR_REVIEW.md` that documents, in detail, every decision captured in
Step 5. Each decision MUST be written so that another engineer can pick up the document later and act on
it without further context from the conversation. For each finding include:

- The finding reference (focus area + severity + `file:line`).
- The decision (e.g. Fix now / Defer / Wontfix). A **Defer** decision implies a GitHub Issue will be
  raised (see Step 7); note any intended Issue scope and which other findings it might be combined with.
- The detailed rationale and, where applicable, the agreed approach for addressing it.

Structure:

```markdown
## Decisions

### Repo rule compliance

- **[Critical] `src/backend/foo.js:42`** — Decision: Defer (GitHub Issue). Approach: extract the
  duplicated validation into `Validate.requireParams` and add a unit test; deferred because it is not on
  the hot path. Rationale: user wants the PR to ship first. To be combined with the KISS & DRY finding at
  `src/backend/foo.js:90` into a single follow-up Issue.
- **[Nitpick] `src/frontend/Bar.tsx:88`** — Decision: Wontfix. Rationale: intentional deviation agreed
  with design; documented so a future reviewer does not re-raise it.

...
```

## Step 7 — Create GitHub Issues for deferred findings

Only after **all** decisions have been recorded in `PR_REVIEW.md` (Step 6), create the GitHub Issues for
findings decided as **Defer**.

- Review the full set of deferrals together and combine similar or overlapping findings into a single
  Issue rather than raising one Issue per finding, so related work is not scattered.
- Create each Issue with `gh issue create`, using a title that names the affected area/behaviour and a
  body that includes the finding details, `file:line` evidence, the agreed approach/rationale, and a
  link back to `PR_REVIEW.md`.
- After creating the Issues, update each corresponding **Defer** entry in the Decisions section with its
  GitHub Issue number/URL so the document and tracker stay in sync.
- If no findings were deferred, skip this step.

## Step 8 — Return to the user

Print a brief summary:

- The overall verdict (Pass / Needs Improvement / Fail).
- Regression gate result.
- The list of focuses run.
- The GitHub Issues created for deferred findings (numbers/URLs), if any.
- The path to `PR_REVIEW.md` (now including the recorded decisions).

Do not mark the review complete while any Critical item remains unaddressed; instead report the
Critical items so the user can address them and re-run the skill.

## Notes

- Keep the regression checker as the single source of truth for branch health. Never bypass the gate.
- Parallelise all review agents in one message to keep the review fast.
- The skill synthesises; it does not re-litigate individual findings. Trust agent evidence.
- A **Defer** decision always implies a GitHub Issue. Deferrals are collected across all findings and
  Issues are only created in Step 7, after every decision is recorded, so overlapping findings can be
  merged into one Issue.
- In the decision pass, explain each finding fully in chat and use the ask user a question tool only to
  capture the selection; handle exactly one finding per exchange.
