# `getAssignment` API Endpoint — Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Read `src/backend/AGENTS.md` (backend conventions, §0.1 trailing-underscore handler pattern, §8 date handling, §3 logging).
3. Read `src/frontend/AGENTS.md` §4.3 (prohibited types in `google.script.run`).
4. Treat those documents as the source of truth for product behaviour, contracts, and rules.
5. Use this action plan to sequence delivery and testing; do not restate or redefine material already settled in the spec.

## Scope and assumptions

### Scope

- New typed error class `AssignmentNotFoundError` at
  `src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js`.
- Controller change in `ABClassController._loadFullAssignmentDocument` to throw the new typed
  error in place of the current generic `Error` on the not-found path.
- New `getAssignment_` trailing-underscore handler in `src/backend/z_Api/assignmentAssessment.js`.
- New `getAssignment` entry in `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js`.
- Backend API tests for the new handler, plus a controller-level test for the new typed error.
- Canonical-doc update for the new error type in
  `docs/developer/backend/backend-logging-and-error-handling.md` (reconcile planned-only entry).

### Out of scope

- Frontend service module, Zod schema, or React hooks for consuming this endpoint.
- Any UI/page changes.
- Any mutation, creation, or deletion of assignments.
- Changes to `AssignmentController`, `Assignment` model, or persistence layer.
- Differentiating `loadClass` failure paths from other `INTERNAL_ERROR` cases.
- Stripping transient fields other than `progressTracker` at the API boundary.
- Differentiating the controller's logging severity between `AssignmentNotFoundError` and
  other `rehydrateAssignment` failures.

### Assumptions

1. `ABClassController.loadClass` returns an object with a `classId` property that `rehydrateAssignment` can consume.
2. `_loadFullAssignmentDocument` will throw the new `AssignmentNotFoundError` (not a generic `Error`) on the not-found path. The API handler detects not-found via an `instanceof` check.
3. `Assignment.toJSON()` already converts `dueDate` and `lastUpdated` to ISO strings; `DateUtils.normaliseDateFields` provides defence-in-depth — but the handler must still be tested with a mock that returns live `Date` objects to prove the wiring is intact.
4. `Assignment.toJSON()` already excludes `progressTracker` per its JSDoc; the handler's `delete response.progressTracker` is defence-in-depth and must still be tested with a mock that includes the field.
5. `hasControlCharacters_` is available as a global in the GAS concatenated runtime (from `assignmentDefinitionValidation.js`).

---

## Global constraints and quality gates

### Engineering constraints

- Keep API handler thin and delegate to existing controller methods.
- Fail fast on invalid inputs with `ApiValidationError`.
- Do not add defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- `ABLogger` is mandatory for all new backend code.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads. For each delegated phase (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`):

1. list required documentation file paths under that phase before delegation
2. require the sub-agent handoff to include `Files read` with explicit file paths
3. verify every mandatory file is listed before accepting the handoff
4. if any mandatory file is missing, return the work to the same sub-agent and block progression to the next phase

### Shared-helper planning gate (mandatory when helper changes are expected)

This work introduces one new shared helper and reuses several existing ones.

Helper decision entries:

1. Helper: `AssignmentNotFoundError` typed error class
   - Decision: `new`
   - Owning module/path: `src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js`
   - Call-site rationale: replaces substring-based not-found detection (see
     `SPEC.md` §"Agreed product decisions" #6) with a structurally testable
     `instanceof` check at the API boundary. Follows the existing
     `DefinitionStaleError.js` pattern: `(message, options)` constructor with
     `{ courseId, assignmentId, collectionName }` assigned to instance properties
     of the same names. **No `cause` parameter** — `DefinitionStaleError` does
     not have one, and the only throw site has no wrapped error to pass.
   - Relevant canonical doc target:
     `docs/developer/backend/backend-logging-and-error-handling.md` §9
   - Planned doc status: `Not implemented` (entry already recorded)

2. Helper: `ABClassController._loadFullAssignmentDocument` `throw` site
   - Decision: `extend` (one-line change to throw the new typed error)
   - Owning module/path: `src/backend/y_controllers/ABClassController.js`
   - Call-site rationale: the controller is the only place where the not-found
     error originates; the new typed error must be thrown from the source.
   - Relevant canonical doc target: none (no canonical doc change required for
     the throw site itself; the error type is documented per entry 1)
   - Planned doc status: N/A

Reused helpers (no decision needed):

- `ABClassController.loadClass` / `.rehydrateAssignment` — existing controller
- `Assignment.toJSON()` — existing model method
- `DateUtils.normaliseDateFields` — existing utility
- `Validate.requireParams` / `.validateNonEmptyString` — existing validator
- `hasControlCharacters_` — existing global helper from `assignmentDefinitionValidation.js`

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Backend tests: `npm test -- tests/api/assignmentAssessment.test.js`
- Backend tests (new): `npm test -- tests/api/assignmentReadApi.test.js`
- Backend controller tests: `npm test -- tests/controllers/abclassController.rehydrateAssignment.test.js`

---

## Section 1 — Add `AssignmentNotFoundError` and write failing backend API tests (Red)

### Objective

1. Create the new typed error class `AssignmentNotFoundError` at
   `src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js` (small, focused — the
   tests in step 2 must import it, so the symbol must exist for the import to
   resolve). This is a precondition for the Red-phase tests, not part of the
   feature under test.
2. Create a new test file `tests/api/assignmentReadApi.test.js` with failing tests
   for the `getAssignment_` handler. Tests define the transport contract before
   the handler implementation exists.
3. Update `ABClassController._loadFullAssignmentDocument` to throw the new typed
   error in place of the current generic `Error` on the not-found path. This is
   the single line that the production code needs to change for the typed-error
   approach; doing it now keeps the controller in sync with the handler tests
   in step 2.

### Constraints

- `AssignmentNotFoundError` follows the existing pattern from
  `src/backend/Utils/ErrorTypes/DefinitionStaleError.js`: `(message, options)`
  constructor with options `{ courseId, assignmentId, collectionName }` assigned
  to `this.courseId`, `this.assignmentId`, `this.collectionName`. Extend `Error`,
  set `this.name = 'AssignmentNotFoundError'`, guarded `module.exports` block
  at the end of the file. **No `cause` parameter.**
- The new error file does **not** need a dedicated unit test (no behaviour
  beyond holding metadata). It is exercised end-to-end by the handler tests.
- Tests must use Vitest (`import { describe, expect, it, vi } from 'vitest'`).
- Follow existing patterns from `tests/api/assignmentAssessment.test.js` (controller
  stubs, `ApiValidationError` imports, `module.exports` loading).
- The test file must load `getAssignment_` from
  `../../src/backend/z_Api/assignmentAssessment.js`.
- Do not modify tests in the Green phase — only write the handler.
- The controller change in `_loadFullAssignmentDocument` is a one-line `throw`
  replacement. The existing diagnostic message is preserved; only the error
  class is swapped. Do not modify the surrounding `try { ... } catch` block in
  `rehydrateAssignment`.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `tests/api/assignmentAssessment.test.js` — existing test pattern for the same module
- `tests/api/assignmentDefinitionReadApi.test.js` — pattern for a read handler that returns data
- `tests/setupGlobals.js` — Node test harness global wiring (in particular how
  `Assignment`, `ABClassController` and friends are loaded)
- `SPEC.md` — feature spec
- `src/backend/AGENTS.md` — backend conventions
- `src/backend/z_Api/assignmentAssessment.js` — target file
- `src/backend/y_controllers/ABClassController.js` — `rehydrateAssignment` and
  `_loadFullAssignmentDocument` signatures
- `src/backend/AssignmentProcessor/Assignment.js` — `Assignment.toJSON()` shape
- `src/backend/Utils/ErrorTypes/DefinitionStaleError.js` — pattern for the new
  `AssignmentNotFoundError` class
- `src/backend/Utils/DateUtils.js` — `normaliseDateFields` signature
- `docs/developer/backend/backend-testing.md` — backend testing policy

Implementation mandatory docs (for the controller one-line change and the new
error file):

- `SPEC.md`
- `src/backend/AGENTS.md` §1.1, §3, §8
- `src/backend/y_controllers/ABClassController.js` (focus on lines 460-479:
  `_loadFullAssignmentDocument`)
- `src/backend/Utils/ErrorTypes/DefinitionStaleError.js` — pattern reference
- `docs/developer/backend/backend-logging-and-error-handling.md` §9 — to see the
  planned-only `AssignmentNotFoundError` entry that this work reconciles

### Shared helper plan (when helper changes are expected)

Recorded in the global Shared-helper planning gate above. The new error class
and the `_loadFullAssignmentDocument` throw-site change are the two planned
helper changes. The planned-only entry in
`docs/developer/backend/backend-logging-and-error-handling.md` §9 must remain
marked `Not implemented` until Section 5 (Documentation) reconciles it.

### Acceptance criteria

- `src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js` exists and follows the
  `DefinitionStaleError.js` pattern.
- `ABClassController._loadFullAssignmentDocument` throws `AssignmentNotFoundError`
  (not generic `Error`) on the not-found path. Existing behaviour on all other
  paths is unchanged.
- Test file exists at `tests/api/assignmentReadApi.test.js`.
- All handler tests fail (Red phase) because `getAssignment_` is not yet exported
  from `assignmentAssessment.js`.
- Test coverage includes the following transport-contract cases:

### Required test cases (Red first)

Backend API handler tests:

1. **Module exports `getAssignment_`**: verifies the handler is exported via `module.exports`.
2. **Throws `ApiValidationError` when parameters is not a plain object**: covers `string`, `null`, `undefined`, `[]`.
3. **Throws for missing `courseId`**: `{ assignmentId: 'a1' }` → error.
4. **Throws for missing `assignmentId`**: `{ courseId: 'c1' }` → error.
5. **Throws `ApiValidationError` for unsafe characters in `courseId`**: path-traversal strings (`../`, `/`, `\\`) and control characters (e.g. `\x00` null byte, `\x1F` unit separator). Verify both validation paths are exercised.
6. **Throws `ApiValidationError` for unsafe characters in `assignmentId`**: same checks (path traversal and control characters).
7. **Delegates to `ABClassController.rehydrateAssignment` on valid input and returns Assignment shape**: stub `loadClass` to return a mock ABClass with a `classId` (capture the reference), stub `rehydrateAssignment` to return a mock Assignment (with `toJSON` returning a representative payload). Verify: (a) `loadClass` is called with the correct `courseId`, (b) `rehydrateAssignment` is called with the captured ABClass reference (identity, not structural equality) and the correct `assignmentId`, (c) returned data matches the `toJSON()` output, (d) `ABLogger.getInstance().info` is called for both the "loading" and "rehydrated" log points.
8. **Defence-in-depth: `DateUtils.normaliseDateFields` converts live `Date` objects**: stub the Assignment's `toJSON` to return `{ dueDate: new Date(...), lastUpdated: new Date(...) }` (with everything else in the representative payload). Verify the handler response contains ISO strings for both fields. This is the regression test for the `normaliseDateFields` boundary call — without it, removing the call would not be caught by test 7.
9. **Defence-in-depth: `progressTracker` is stripped at the boundary**: stub the Assignment's `toJSON` to return a payload that includes `progressTracker: { /* some singleton instance */ }`. Verify the handler response does not contain a `progressTracker` field. This is the regression test for the boundary strip.
10. **Returns `null` when `rehydrateAssignment` throws `AssignmentNotFoundError`**: stub `rehydrateAssignment` to throw a real `AssignmentNotFoundError` instance (imported from the new error file), verify the handler returns `null` (not throws), and verify `ABLogger.getInstance().warn` is called with the not-found message. **Not** implemented via substring matching.
11. **Propagates non-not-found errors from `rehydrateAssignment`**: stub `rehydrateAssignment` to throw a generic `Error` (e.g. `'Corrupt assignment data'`). Verify the handler re-throws and `ABLogger.getInstance().error` is called with the "getAssignment failed" message.
12. **Propagates errors from `loadClass`**: stub `loadClass` to throw. Verify the handler re-throws (class-not-found must not be caught as assignment-not-found) and `ABLogger.getInstance().error` is called.

Backend controller tests (one new test, added to the existing
`tests/controllers/abclassController.rehydrateAssignment.test.js`):

13. **`_loadFullAssignmentDocument` throws `AssignmentNotFoundError` on missing document**: with the `dbManager.getCollection` stubbed to return a collection whose `findOne` returns `undefined` (or `null`), verify the throw is `instanceof AssignmentNotFoundError` and carries the expected `this.courseId`, `this.assignmentId`, `this.collectionName` instance properties.

**Test harness note (applies to tests 7(d), 10, 11, 12):** `tests/setupGlobals.js` lines 68-78
install a no-op `ABLogger` stub. Tests that verify `ABLogger` calls must install their own
mock in `beforeEach`, e.g.:

```js
const abLoggerSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
globalThis.ABLogger = { getInstance: () => abLoggerSpies };
```

…and restore the original `globalThis.ABLogger` in `afterEach`. See
`docs/developer/backend/backend-testing.md` lines 15-26 for logging-fidelity expectations.

### Section checks

- `npm test -- tests/api/assignmentReadApi.test.js` — all tests should **fail** (Red phase) because `getAssignment_` is not yet exported from `assignmentAssessment.js`. Tests that depend on the new error class (10, 13) should also pass once the class file exists.
- Test file follows existing patterns (controller stubs, module-loading helper, `beforeEach`/`afterEach` cleanup, including restore of `globalThis.ABLogger` for the spy-requiring tests).
- Shared-helper planning entries for `AssignmentNotFoundError` and the controller throw-site are recorded.

### Optional `@remarks` JSDoc follow-through

None in this section (the `@remarks` follow-through for the handler lands in
Section 2; the new error class does not need `@remarks`).

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled during Red phase)
- **Deviations from plan:** (to be filled if any)
- **Follow-up implications for later sections:** Section 2 must implement `getAssignment_` to make these tests green. Section 5 (Documentation) must reconcile the planned-only entry in `backend-logging-and-error-handling.md` §9 to `Implemented`.

---

## Section 2 — Implement `getAssignment_` handler (Green)

### Objective

Add the `getAssignment_` trailing-underscore handler function to
`src/backend/z_Api/assignmentAssessment.js` and export it via `module.exports`.
All tests from Section 1 must go green.

### Constraints

- Add the handler to the existing `assignmentAssessment.js` file (do not create a
  new file).
- Insert `getAssignment_` **immediately after `startAssessmentRun_`** and before
  the `if (typeof module !== 'undefined' && module.exports)` block at the end of
  the file. Update that block to export `{ startAssessmentRun_, getAssignment_ }`.
- Follow the trailing-underscore pattern per `src/backend/AGENTS.md` §0.1.
- Update the `/* global */` comment at the top of the file to include:
  `ApiValidationError, Validate, ABClassController, DateUtils, ABLogger,
AssignmentNotFoundError, hasControlCharacters_`.
  **`Assignment` is intentionally omitted** — the handler never constructs one
  directly; it only calls `.toJSON()` on the instance returned by
  `rehydrateAssignment`. `hasControlCharacters_` is included because the handler
  uses it for unsafe-character validation, matching the pattern in
  `googleClassroomAssignments.js` which already uses this global.
- Validate parameters shape inline (matching the existing `startAssessmentRun_`
  pattern in the same file).
- Reject unsafe characters in identifiers inline (matching the
  `getGoogleClassroomAssignments_` pattern in `googleClassroomAssignments.js`).
- Catch not-found errors via `instanceof AssignmentNotFoundError`; re-throw all
  other errors. The catch wraps both `loadClass` and `rehydrateAssignment`
  calls; only the typed-error branch returns `null`.
- After `assignment.toJSON()`, defensively `delete response.progressTracker`
  before `normaliseDateFields`. Document the rationale in `@remarks`.
- Apply `DateUtils.normaliseDateFields(response, ['dueDate', 'lastUpdated'])` as
  the final boundary step before returning. This is **shallow defence-in-depth
  for root-level fields only**; nested date conversion (`createdAt`, `updatedAt`
  on `submissions`, dates on `assignmentDefinition`) relies on the corresponding
  `toJSON()` implementations being correct. The regression test in
  `tests/api/assignmentReadApi.test.js` (test 8) proves the root-level call is
  wired by mocking `toJSON()` to return live `Date` objects in
  `dueDate`/`lastUpdated`.
- Logging:
  - `info` before loading ABClass: `"getAssignment: loading full assignment"` with `{ courseId, assignmentId }`.
  - `info` after successful rehydration: `"getAssignment: rehydrated assignment"` with `{ courseId, assignmentId }`.
  - `warn` for not-found: `"getAssignment: assignment not found"` with `{ courseId, assignmentId }`.
    (`warn`, not `error` — the API returns `null` gracefully, so this is a
    notable but not failure-level event.)
  - `error` for other failures: `"getAssignment failed"` with `{ courseId, assignmentId, err }`.
- The same `abClass` instance returned by `loadClass` is passed to
  `rehydrateAssignment` (identity, not structural equality) — the controller
  mutates it via `_replaceAssignmentInClass`.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `SPEC.md` — feature spec (particularly the handler call-tree, logging
  requirements, and the "Backend changes required" section)
- `src/backend/AGENTS.md` — backend conventions (§0.1, §0.2, §3, §8)
- `src/backend/z_Api/assignmentAssessment.js` — target file for the handler
- `src/backend/z_Api/googleClassroomAssignments.js` — unsafe-character validation pattern
- `src/backend/y_controllers/ABClassController.js` — `rehydrateAssignment`
  method (lines 413–449) and `_loadFullAssignmentDocument` (lines 460–479)
- `src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js` — new error class
  (Section 1 created it)
- `src/backend/Utils/DateUtils.js` — `normaliseDateFields` signature
- `docs/developer/backend/backend-logging-and-error-handling.md` — logging and
  error policy; also confirms the new `AssignmentNotFoundError` is not mapped
  to a transport error code

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/z_Api/assignmentAssessment.js` (final state)
- `src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js` (final state)
- `src/backend/y_controllers/ABClassController.js` (final state)
- `tests/api/assignmentReadApi.test.js` (for context on tested contract)
- `docs/developer/backend/backend-logging-and-error-handling.md` (to verify the
  planned-only entry remains marked `Not implemented` until Section 5)

### Shared helper plan (when helper changes are expected)

No additional shared-helper changes in this section. The two planned helper
changes (new error class and controller throw-site) are implemented in
Section 1.

### Acceptance criteria

- `getAssignment_` function exists in `assignmentAssessment.js`, placed
  immediately after `startAssessmentRun_`.
- `module.exports` exports `{ startAssessmentRun_, getAssignment_ }`.
- The `/* global */` comment lists `AssignmentNotFoundError` and **does not**
  list `Assignment`.
- All tests from Section 1 pass: `npm test -- tests/api/assignmentReadApi.test.js`.
- Existing tests still pass: `npm test -- tests/api/assignmentAssessment.test.js`.
- Backend lint passes: `npm run lint:backend`.

### Required test cases (Red first)

N/A — tests were written in Section 1. This section makes them green.

### Section checks

- `npm test -- tests/api/assignmentReadApi.test.js` — **all tests green**.
- `npm test -- tests/api/assignmentAssessment.test.js` — **still green** (no regression).
- `npm test -- tests/api/assignmentDefinitionReadApi.test.js` — **still green** (no regression in the read-pattern family).
- `npm run lint:backend` — **clean**.
- `ABLogger` is called at the documented points (`info` for success, `warn` for
  not-found, `error` for other failures).
- `DateUtils.normaliseDateFields` is called on the response.
- The `progressTracker` strip happens before `normaliseDateFields`.
- Not-found catch is scoped to `instanceof AssignmentNotFoundError` only.

### Optional `@remarks` JSDoc follow-through

Add `@remarks` to `getAssignment_` documenting:

- Why not-found is detected via `instanceof AssignmentNotFoundError` (typed
  error, robust to message changes; structurally testable).
- Why `DateUtils.normaliseDateFields` is applied even though `toJSON()`
  already converts dates (defence-in-depth; Date objects are strictly
  prohibited in `google.script.run` transport; regression test in
  `assignmentReadApi.test.js` proves the wiring is intact for root-level fields).
  Note: this is shallow defence-in-depth — nested date conversion on
  `submissions` and `assignmentDefinition` still depends on the
  corresponding `toJSON()` implementations.
- Why `progressTracker` is stripped at the boundary (defence-in-depth;
  `Assignment.toJSON()` already omits it per its JSDoc but a future model
  change could regress; the explicit strip is the canonical boundary
  defence pattern).
- Why the same `abClass` instance is threaded through to `rehydrateAssignment`
  (the controller mutates it via `_replaceAssignmentInClass`; a fresh instance
  would silently break assignment cache state).

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled during Green phase)
- **Deviations from plan:** (to be filled if any)
- **Follow-up implications for later sections:** Section 3 must register the
  allowlist entry. Section 5 (Documentation) must reconcile the planned-only
  entry in `backend-logging-and-error-handling.md` §9 to `Implemented`.

---

## Section 3 — Register `getAssignment` in ALLOWLISTED_METHOD_HANDLERS (Green)

### Objective

Add the `getAssignment` entry to `ALLOWLISTED_METHOD_HANDLERS` in
`src/backend/z_Api/z_apiHandler.js` and update the Node `require` block.

### Constraints

- Add the entry immediately after `upsertAssignmentDefinition` (the last
  assignment-related write entry) and before `getGoogleClassroomAssignments` (the
  first Google Classroom read entry) for logical grouping. The grouping rationale
  is "assignment-related methods, then classroom methods, then class methods,
  then reference-data methods"; `getAssignment` belongs to the assignment cluster.
- Thin closure: `getAssignment: (parameters) => getAssignment_(parameters)`,
  structurally identical to the surrounding one-line closures.
- Update the Node-side `globalThis` assignment in the
  `if (typeof module !== 'undefined' && module.exports)` block to set
  `globalThis.getAssignment_` alongside `globalThis.startAssessmentRun_` via
  `require('./assignmentAssessment.js').getAssignment_`.
- Do not modify any other allowlist entries.
- Do not add the new error type to `_mapErrorToFailureEnvelope` — the handler
  catches `AssignmentNotFoundError` before it can reach the dispatcher's error
  envelope.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `src/backend/z_Api/z_apiHandler.js` — full file (particularly
  `ALLOWLISTED_METHOD_HANDLERS` and the Node `require` block)
- `src/backend/AGENTS.md` — §0.1 (allowlist pattern)
- `SPEC.md` — for the method name

Code Reviewer mandatory docs:

- `src/backend/z_Api/z_apiHandler.js` (final state)
- `src/backend/AGENTS.md` §0.1

### Shared helper plan (when helper changes are expected)

None.

### Acceptance criteria

- `getAssignment` entry exists in `ALLOWLISTED_METHOD_HANDLERS`, in the
  documented insertion position.
- Thin closure delegates to `getAssignment_(parameters)` — structurally
  identical to the surrounding one-line closures (reviewer can verify by
  grep-comparing the entry to neighbours).
- `globalThis.getAssignment_` is set via `require` in the Node test
  compatibility block, alongside `globalThis.startAssessmentRun_`.
- Backend lint passes: `npm run lint:backend`.

### Required test cases (Red first)

N/A — the handler was tested in Section 1, and the allowlist entry is a wiring
concern. The existing tests exercise the handler directly via `module.exports`;
the allowlist entry will be exercised by future E2E/integration tests.

### Section checks

- `npm run lint:backend` — **clean**.
- `npm test -- tests/api/assignmentReadApi.test.js` — **still green**.
- `npm test -- tests/api/assignmentAssessment.test.js` — **still green**.
- Structural check: the new entry matches the shape
  `(parameters) => getAssignment_(parameters)` exactly (no extra validation,
  no transformation, no error mapping).

### Optional `@remarks` JSDoc follow-through

None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled)
- **Deviations from plan:** (to be filled if any)
- **Follow-up implications for later sections:** None — this section completes
  the backend wiring. Section 4 (Regression) and Section 5 (Documentation)
  remain.

---

## Regression and contract hardening

### Objective

Verify that the new endpoint does not break existing functionality and that the
transport contract is sound.

### Constraints

- Run all backend API tests to ensure no regressions.
- Run backend lint.
- Confirm that the controller's behaviour change (typed-error throw) does not
  regress any existing controller tests that exercise the not-found path
  through `rehydrateAssignment`.

### Acceptance criteria

- All existing backend API tests pass.
- Backend lint passes.
- No regressions in `startAssessmentRun_` or any other handler in
  `assignmentAssessment.js`.
- No regressions in `ABClassController` tests that exercise
  `rehydrateAssignment` (e.g. tests that previously matched on the generic
  `Error` from `_loadFullAssignmentDocument` must now match on
  `instanceof AssignmentNotFoundError`).

### Required test cases/checks

1. `npm test -- tests/api/assignmentReadApi.test.js` — green.
2. `npm test -- tests/api/assignmentAssessment.test.js` — green.
3. `npm test -- tests/api/assignmentDefinitionReadApi.test.js` — green.
4. `npm test -- tests/api/assignmentDefinitionUpsertApi.test.js` — green.
5. `npm test -- tests/api/assignmentDefinitionDeleteApi.test.js` — green.
6. `npm test -- tests/controllers/abclassController.rehydrateAssignment.test.js`
   — green. If any existing test in this file was relying on the not-found path
   throwing a generic `Error`, update it to expect `AssignmentNotFoundError`
   instead.
7. `npm run lint:backend` — clean.

### Section checks

- Run the commands listed above and ensure green results.

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled)
- **Deviations from plan:** (to be filled if any)

---

## Documentation and rollout notes

### Objective

Update relevant documentation to reflect the new endpoint, the new typed error,
and the controller change. Reconcile planned-only entries in canonical docs.

### Constraints

- Only modify documents relevant to the touched areas.
- Use British English.

### Acceptance criteria

- `SPEC.md` status updated to `Implemented v1.0` (replacing `Draft v1.0`) with
  a one-line note: `Implemented 2026-06-15. See ACTION_PLAN.md for delivery
history.` (Adjust the date to the actual implementation date; the format
  string is the only required change.)
- The new `AssignmentNotFoundError` entry in
  `docs/developer/backend/backend-logging-and-error-handling.md` §9 is updated
  from `Planned: Not implemented` to a plain entry that matches the style of
  `AbortRequestError` / `PersistError` (i.e. remove the `Planned:` prefix and
  the `Not implemented` marker; the entry should describe the actual
  behaviour, throw site, and metadata).
- If `docs/developer/DATA_SHAPES.md` exists and documents Assignment data
  shapes, verify it remains accurate (no changes expected — the endpoint
  returns the existing `Assignment.toJSON()` shape).
- No new API method documentation file is required at this stage
  (frontend-facing docs will be created when the frontend pages are built).

### Required checks

1. Verify `SPEC.md` accurately reflects the implemented behaviour.
2. Verify the planned-only entry in `backend-logging-and-error-handling.md` §9
   has been reconciled: marker removed, description updated to match the
   actual class.
3. Confirm no documentation regressions in canonical docs.
4. Confirm that the canonical doc still lists `AssignmentNotFoundError` under
   the "internal error types not mapped at the transport boundary" category
   (not under the `_mapErrorToFailureEnvelope` list).

### Optional `@remarks` JSDoc review

- Confirm the `@remarks` added to `getAssignment_` in Section 2 are present and
  accurate.
- Verify that the not-found typed-error rationale, the date-normalisation
  rationale, the `progressTracker`-strip rationale, and the abClass-identity
  rationale are all documented.
- The new `AssignmentNotFoundError` class does not need `@remarks` (it is a
  metadata-only value class with no behaviour).

### Implementation notes / deviations / follow-up

- **Implementation notes:** (to be filled)
- **Deviations from plan:** (to be filled if any)

---

## Suggested implementation order

1. **Section 1** — Add `AssignmentNotFoundError` and write failing tests (Red)
2. **Section 2** — Implement `getAssignment_` handler (Green + Refactor)
3. **Section 3** — Register allowlist entry (Green)
4. **Section 4** — Run regression suite
5. **Section 5** — Update canonical docs and SPEC.md status
