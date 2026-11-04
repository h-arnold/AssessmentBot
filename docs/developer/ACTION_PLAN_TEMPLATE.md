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
5. **Docs sync (optional)**: when the section changes documented behaviour, public APIs, module or developer documentation, data shapes or commands, run the docs sync pass before the section regression gate. Record the outcome (files updated or pages created), or why it was skipped.
6. **Plan compaction**: after the section is verified and before the regression gate, compact the completed section to a summary that retains contracts, decisions, constraints and follow-ups relevant to future sections. Preserve other sections, the deferred-findings ledger and the `Implementation notes / deviations / follow-up` subsection. Runs in parallel with step 5; see the action-plan implementer workflow (§2.5) for the full retention and removal rules.

### Delegation mandatory reads (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define the mandatory documentation reads for that phase.

For each delegated phase (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`, `De-Sloppification`, or planning agents when used):

1. list required documentation file paths under that phase before delegation, written as
   `@`-prefixed paths (e.g. `@SPEC.md`, `@src/backend/Services/AssessmentService.js`).
   The `.opencode/plugins/at-mention-inject/` plugin attaches each `@path` token's contents
   to the sub-agent prompt — never paste file contents into the prompt body

Injection is the delivery mechanism, so no read-evidence report is required from the sub-agent.

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

### Delegation mandatory reads (when sub-agents are used)

List every mandatory file as an `@`-prefixed path (e.g. `@SPEC.md`,
`@src/backend/...`) so the `at-mention-inject` plugin attaches the file contents
to the delegation prompt automatically; do not paste file contents into the prompt body.

Testing Specialist mandatory docs:

- ...

Implementation mandatory docs:

- ...

Code Reviewer mandatory docs:

- ...

Other delegated agents (if used) mandatory docs:

- ...

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
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Shared-helper planning entries are present when helper changes are expected.
- Planned helper entries were added to relevant canonical docs with status `Not implemented` before implementation starts.
- Docs sync outcome or skip reason recorded in the section's `Implementation notes`.
- Completed section compacted; future-relevant detail retained in the section's **Retained for later sections** block.

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
4. Reconcile planned shared-helper entries in canonical docs: keep `Not implemented` where still pending, and update implemented entries where delivered.

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

---

## Deferred and Out-of-Scope Findings

Record findings triaged as out of scope or ambiguous during delivery here. Do not action them unless the user approves and the disposition is recorded as `approved`; approved items move into a section or unit and follow the normal loop.

| Finding | Severity | Scope rationale | Evidence | Disposition                           | User decision |
| ------- | -------- | --------------- | -------- | ------------------------------------- | ------------- |
| ...     | Any      | ...             | ...      | asked, noted, disregarded or approved | ...           |

`Disposition` is one of `asked`, `noted`, `disregarded` or `approved`. `User decision` records the user's answer and date once given, and stays empty while the disposition is `asked`. Record an ambiguous finding as `asked` before handing it back. The exception is an ambiguous nitpick: log it in the `Nitpicks` table of the deferred-findings log and add a pointer row here. Default an out-of-scope Critical or Material finding to `noted` and an out-of-scope minor or nitpick finding to `disregarded`; an ambiguous finding defaults to `asked` regardless of severity. Only a user-authorised item becomes `approved`.

Nitpicks are logged separately in `.opencode/scratchpad/<branch-slug>-deferred-findings.md`, where the branch slug is the branch name with `/` replaced by `-`. That ignored working file holds two headed tables: `Deferred and out-of-scope findings` (Finding | Severity | Scope rationale | Evidence | Disposition | User decision) and `Nitpicks` (Finding | Location | Evidence | Deferred at (section and phase) | Disposition). Link it here for traceability, and do not list individual nitpicks in this plan.

The orchestrating agent or `action-plan-implementer` creates this section at the end of `ACTION_PLAN.md` if an in-flight plan lacks it, before recording the first row. Before the plan is deleted or superseded, its open rows are mirrored into the deferred-findings log.
