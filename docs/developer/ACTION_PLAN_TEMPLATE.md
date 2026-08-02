# Feature Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Read any related frontend layout spec or other companion planning doc.
3. Treat those documents as the source of truth for product behaviour, contracts, and layout rules.
4. Use this action plan to sequence delivery and testing; do not restate or redefine material already settled in the spec or layout docs.

## Scope and assumptions

### Scope

- Describe what is in scope for this feature.
- List any explicitly included areas (models, controllers, UI, API, etc.).

### Out of scope

- Note any areas deliberately excluded from the current delivery.

### Assumptions

1. State any assumptions that will guide decisions or design (e.g. contract shape, persistence choices, etc.).
2. Use numbered list format for clarity.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section’s acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation file-injection gate (mandatory for sub-agent execution)

**The `files` array is MANDATORY for every delegated handoff — the `task` tool schema marks `files` as required, so the model must emit it on every task call; pass `files: []` when no file injection is needed.** Assemble the `files` array **before** writing the prompt body, and **never paste full file contents into the prompt body** (the body carries only instructions, acceptance criteria, and non-file context; the actual contents arrive via `files`). **Do not include any `AGENTS.md` file (root or module-specific) in the `files` array** — OpenCode auto-injects those when an agent browses to the relevant directory.

For each delegated phase (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`, `De-Sloppification`, or planning agents when used):

1. Complete the agent's `files` array in the **Delegation files** subsection with the exact real file paths required by that phase.
2. Pass that `files` array verbatim to the `task` tool's `files` parameter on every handoff to that agent.
3. Verify every mandatory file is present in the `files` array before sending the handoff (pre-flight check: if the array would be empty for a workflow handoff, stop and do not send the call).
4. If any mandatory file is missing from the `files` array, return the work to the same sub-agent and block progression to the next phase.

### Shared-helper planning gate (mandatory when helper changes are expected)

When a section is likely to introduce helper reuse, helper extension, or new shared helpers:

1. record helper decisions in that section before implementation
2. include: decision (`reuse` | `extend` | `new` | `keep local`), owning path, and call-site rationale
3. add planned helper entries to the relevant canonical docs with status `Not implemented`
4. during documentation pass, reconcile planned entries against actual implementation and update status/details accordingly

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Frontend lint: `npm run lint:frontend`
- Builder lint (if touched): `npm run lint:builder`
- Backend tests: `npm run test:backend -- <target>`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Frontend e2e tests (if UX changes): `npm run test:frontend:e2e -- <target>`

---

## Section 1 — [Name of section]

### Objective

- State the high‑level goal of this section.

### Constraints

- List relevant architectural or behavioural constraints.

### Delegation files (injected automatically by the `task-files` plugin)

For every delegated agent in this section, specify the exact `files` array that must be passed to that agent on every handoff. Populate each array with the real file paths for this section (replacing the `...` placeholders below). Do NOT copy placeholder paths verbatim — substitute the actual paths used by this section.

Inventory every file the agent needs, in this order for every agent:

1. `ACTION_PLAN.md` (this file) — always.
2. `SPEC.md` — always.
3. `LAYOUT_SPEC.md` — only if this section has a layout spec.
4. Every source and/or test file this section adds or changes.

Pass the exact contents of each agent's `files` array verbatim to the `task` tool's `files` parameter. Do NOT paste any file contents into the handoff prompt body — the plugin injects them. Do NOT include any `AGENTS.md` file — OpenCode auto-injects those.

Testing Specialist `files` array (paths only, modelled below):

```json
[
  "ACTION_PLAN.md",
  "SPEC.md",
  "LAYOUT_SPEC.md",
  "src/backend/path/to/model_test.js",
  "src/backend/path/to/controller_test.js"
]
```

Implementation `files` array (paths only, modelled below):

```json
[
  "ACTION_PLAN.md",
  "SPEC.md",
  "LAYOUT_SPEC.md",
  "src/backend/path/to/model.js",
  "src/backend/path/to/controller.js"
]
```

Code Reviewer `files` array (paths only, modelled below — include every file the implementation and/or tests touched):

```json
[
  "ACTION_PLAN.md",
  "SPEC.md",
  "LAYOUT_SPEC.md",
  "src/backend/path/to/model.js",
  "src/backend/path/to/controller.js",
  "src/backend/path/to/model_test.js"
]
```

Other delegated agents (if used) `files` array (paths only, modelled below — adapt names to the agent):

```json
[
  "ACTION_PLAN.md",
  "SPEC.md",
  "LAYOUT_SPEC.md",
  "<file path 1>",
  "<file path 2>"
]
```

Fill every placeholder (`<file path N>`) with a real repository path before delegating. Leave no placeholder unused when a section has matching files.

### Shared helper plan (when helper changes are expected)

Helper decision entries:

1. Helper: `[name or contract]`
   - Decision: `[reuse | extend | new | keep local]`
   - Owning module/path: `[...]`
   - Call-site rationale: `[...]`
   - Relevant canonical doc target: `[...]`
   - Planned doc status: `Not implemented`
2. ...

### Acceptance criteria

- Bullet the concrete observable outcomes that must be satisfied.

### Required test cases (Red first)

Backend model tests:

1. ...
2. ...

Backend controller tests:

1. ...

API layer tests:

1. ...

Frontend tests:

1. ...

### Section checks

- `npm test -- tests/...`
- Confirm the `files` array was populated (paths only) for every delegated handoff (the `task-files` plugin injects them automatically) and that no file contents were pasted into the prompt body.
- Shared-helper planning entries are present when helper changes are expected.
- Planned helper entries were added to relevant canonical docs with status `Not implemented` before implementation starts.

### Optional `@remarks` JSDoc follow-through

- Use this section only when the implementation is likely to need `@remarks` documentation on classes, functions, methods, hooks, schemas, mappers, or components.
- Record any places where a future developer may need help understanding:
  - why something was implemented in a particular way
  - key gotchas or failure modes to avoid
  - non-obvious interactions with other parts of the codebase
- Prefer this when the reasoning would not be obvious from the final code alone, especially if it is currently captured only in the action plan and would otherwise be lost when the plan is deleted.
- If no such documentation is needed for the section, write `None`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** describe actual changes made when done.
- **Deviations from plan:** note any departures from the original section design.
- **Follow-up implications for later sections:** record effects for downstream work.

---

_(Repeat above section template for each logical chunk of work, renumbering sections.)_

---

## Regression and contract hardening

### Objective

- Describe regression goals for the feature and any contract verifications.

### Constraints

- Prefer focused test runs before broader validation.

### Acceptance criteria

- List tests and lints that must pass before considering feature complete.

### Required test cases/checks

1. Run touched backend model/controller/API suites.
2. Run touched frontend service/UI suites.
3. Run backend frontend lint commands.
4. Run any required e2e tests.
5. Confirm the `files` array was populated (paths only) for every delegated regression handoff (the `task-files` plugin injects them automatically) and that no file contents were pasted into the prompt body.

### Section checks

- Run the commands listed above and ensure green results.

### Implementation notes / deviations / follow-up

- **Implementation notes:** summarise what was done during regression phase.
- **Deviations from plan:** note any additional work discovered or done.

---

## Documentation and rollout notes

### Objective

- Update docs to match implemented feature and highlight any caveats.

### Constraints

- Only modify documents relevant to the touched areas.

### Acceptance criteria

- Documentation accurately reflects data shapes, API methods, or UI changes.
- Any deviations or caveats are documented.

### Required checks

1. Verify docs mention persistence/transport strategies.
2. Verify API docs list new endpoints/methods.
3. Confirm notes/deviations fields are filled during implementation.
4. Confirm the `files` array was populated (paths only) for every delegated docs/review handoff (the `task-files` plugin injects them automatically) and that no file contents were pasted into the prompt body.
5. Reconcile planned shared-helper entries in canonical docs: keep `Not implemented` where still pending, and update implemented entries where delivered.

### Optional `@remarks` JSDoc review

- Confirm whether any non-obvious design decisions, gotchas, or cross-component interactions discovered during implementation should be preserved in `@remarks` documentation.
- If earlier sections planned `@remarks`, verify that the relevant code now contains them before deleting the action plan.
- If no `@remarks` are needed, record `None`.

### Implementation notes / deviations / follow-up

- ...

---

## Suggested implementation order

1. Section 1 (initial setup, data contract, etc.)
2. Section 2 (persistence or core logic)
3. ...

_(Adjust order as appropriate for the feature.)_
