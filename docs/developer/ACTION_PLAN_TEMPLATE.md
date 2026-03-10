# Feature Delivery Plan (TDD-First)

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

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Builder lint (if touched): `npm run builder:lint`
- Backend tests: `npm test -- <target>`
- Frontend unit tests: `npm run frontend:test -- <target>`
- Frontend e2e tests (if UX changes): `npm run frontend:test:e2e -- <target>`

---

## Section 1 — [Name of section]

### Objective

- State the high‑level goal of this section.

### Constraints

- List relevant architectural or behavioural constraints.

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

### Implementation notes / deviations / follow-up

- ...

---

## Suggested implementation order

1. Section 1 (initial setup, data contract, etc.)
2. Section 2 (persistence or core logic)
3. ...

_(Adjust order as appropriate for the feature.)_
