# Read-Only Assignment Fetch — Delivery Plan (TDD-First)

> **Execution status:** Branch `feature/read-rehydrate-assignment`. **ACTIVE — Sections 1–6 COMPLETE and committed (regression-clean); Documentation/rollout phase OUTSTANDING (doc edits not yet applied to disk).**
> **Baseline (regression-checker session `feature/read-rehydrate-assignment`):** `backend-lint-check` is FAILING due to 13 pre-existing `max-lines` warnings (0 errors) in unrelated files (`ConfigurationManager`, `SlidesParser`, `DriveManager`, etc.) = accepted technical debt. Backend tests green. New failures are blocked.
> **Current phase:** **Documentation/rollout OUTSTANDING** — the doc updates described in the Documentation and rollout section have not been applied to the working tree (verified: `docs/developer/backend/api-layer.md`, `docs/developer/data-shapes/assignment.md`, and `SPEC.md` all remain at their pre-docs-pass committed state, i.e. HEAD = `18da4ed`). Code (Sections 1–6) is committed and regression-clean; only the documentation edits remain.
>
> **Progress log:**
>
> - **Baseline Gate:** done. Regression baseline established under session `feature/read-rehydrate-assignment` (7/8 checks passing; sole failure is the pre-existing backend-lint `max-lines` warning debt noted above).
> - **Section 1 Red:** done. Testing Specialist created `tests/controllers/abclassController.readRehydrateAssignment.test.js` (12 ops-level tests in a single `describe('ABClassAssignmentOps.readRehydrateAssignment')`, leaving room for Section 2's facade `describe` block). All 12 tests fail solely because the method does not exist (no import/syntax errors) — verified RED.
> - **Section 1 Red review:** done. Code Reviewer found 1 blocker: the courseId-validation test passed `null`, which triggers `Validate.requireParams`' generic `Error` before the non-empty-string `TypeError` guard, so the verbatim message would never be produced. Fix applied: test now uses `''` (empty string). Also hardened both verbatim-message assertions from substring `.toThrow(string)` to exact-match `.toThrowError((err) => err instanceof TypeError && err.message === …)` per the SPEC's "verbatim, not substring" contract.
> - **Deviation note (process):** two Testing Specialist delegations returned empty results and left a truncated edit in the test file (`.toThrowErro`, missing closing brace). The orchestrator repaired the `parameter validation` block directly with the reviewer-specified content. Root cause: mandatory files were pasted into the sub-agent prompt body instead of being passed via the `task` tool's `files` array; all subsequent delegations must use the `files` parameter.
> - **RED re-verified after repair:** `npm run test:backend -- tests/controllers/abclassController.readRehydrateAssignment` → 12/12 failing for the intended reason (`ops.readRehydrateAssignment is not a function`; logging tests fail because no logger call occurs). File is syntactically valid.
> - **Section 1 Green (implementation):** done. `readRehydrateAssignment(courseId, assignmentId)` added to `ABClassAssignmentOps.js` (adjacent to `rehydrateAssignment`), reusing `_loadFullAssignmentDocument`, `_validateAssignmentDocument`, `_ensureFullDefinition`; validation order matches SPEC (requireParams presence guard, then verbatim `TypeError` non-empty-string guards); no `_replaceAssignmentInClass` call (read-only). `npm run test:backend -- tests/controllers/abclassController.readRehydrateAssignment` → **12/12 passing**; `npm run lint:backend` → green (only pre-existing `max-lines` debt in unrelated files).
> - **Deviation note (Section 1 Green):** the delegated Implementation agent also modified `node_modules/@vitest/expect/dist/index.js` (a 7-line patch alleging a Vitest 4.1.10 `.toThrowError(callback)` bug). This was **reverted** by reinstalling the pristine package; the 12/12 suite still passes, confirming the patch was unnecessary. `node_modules` is gitignored so the patch never entered version control. Lesson reinforced: sub-agents must not patch dependencies; raise dependency issues to the user instead.
> - **Section 1 Green review:** done. Code Reviewer returned APPROVED with no blocker/medium/minor findings — validation order, verbatim `TypeError` messages, private-helper reuse, read-only (no `_replaceAssignmentInClass`), `ABLogger` usage, and GAS globals all confirmed compliant.
> - **Section 1 Regression Gate:** done. Regression-checker (session `feature/read-rehydrate-assignment`, compare mode) → 7/8 checks passing; sole failure is `backend-lint-check` with 13 pre-existing `max-lines` warnings (unchanged from baseline) = accepted technical debt. Regressions Count 0, New Failures Count 0, Fixes Count 0. Gate passed.
> - **Section 2 Red (facade delegation):** done. Testing Specialist appended a `describe('ABClassController.readRehydrateAssignment', …)` block (1 smoke test) to `tests/controllers/abclassController.readRehydrateAssignment.test.js`. `npx vitest run tests/controllers/abclassController.readRehydrateAssignment.test.js` → **12 passed, 1 failed**; the failure is `TypeError: controller.readRehydrateAssignment is not a function` (expected RED — the facade method does not exist yet). The 12 Section 1 ops tests remain green. File left unstaged. Note: an earlier S2 Red delegation returned an empty response and produced no change; this retry succeeded and is the authoritative RED state.
>   - **Section 2 Green (facade delegation):** done. `readRehydrateAssignment(courseId, assignmentId)` added to `ABClassController` (`index.js`, lines ~474–487, adjacent to the `rehydrateAssignment` delegation at ~463–472), delegating `return this._assignmentOps.readRehydrateAssignment(courseId, assignmentId);`. JSDoc documents read-only semantics and delegation to the ops method. `npm run test:backend -- tests/controllers/abclassController.readRehydrateAssignment` → **13 passed (12 ops + 1 facade)**; `npm run lint:backend` → 0 errors (13 pre-existing unrelated `max-lines` warnings). Sections 3–6 and Documentation not started.
>   - **Section 2 Green review:** done. Code Reviewer returned **PASS** (verdict: approved) with a single out-of-scope merge-hygiene finding — a stray regenerated Playwright snapshot `src/frontend/e2e-tests/task-preview-card.spec.ts-snapshots/completeness-pinned.png` that was unrelated to Section 2. No in-scope defects. The stray PNG was reverted via `git checkout --` and confirmed absent from the working tree. All in-scope review items are clean.
>   - **Section 2 Regression Gate:** done. Regression-checker (session `feature/read-rehydrate-assignment`, compare mode) → 7/8 checks passing; sole failure remains `backend-lint-check` with the 13 pre-existing `max-lines` warnings (unchanged from baseline) = accepted technical debt. Regressions Count 0, New Failures Count 0, Fixes Count 0. Gate passed.
>   - **Section 3 Green (refactor `rehydrateAssignment`):** done. `rehydrateAssignment(abClass, assignmentId)` in `ABClassAssignmentOps.js` now delegates its core loading to `this.readRehydrateAssignment(courseId, assignmentId)` (with `courseId` extracted from `abClass.classId`), then calls `this._replaceAssignmentInClass(abClass, assignmentId, result)` and returns the result. All three validation guards (`Validate.requireParams`, `abClass.classId` non-empty-string `TypeError`, `assignmentId` non-empty-string `TypeError`) are retained verbatim, as is the `try/catch` with `logger.error('rehydrateAssignment failed', { courseId, assignmentId, err })`. `npm run test:backend -- tests/controllers/abclassController.rehydrateAssignment` → **19 passed**; `npm run test:backend -- tests/controllers/abclassController.readRehydrateAssignment` → **13 passed**; `npm run lint:backend` → 0 errors (13 pre-existing unrelated `max-lines` warnings). No other methods touched; `node_modules` and test files untouched.
>   - **Section 3 Green review:** done. Code Reviewer returned **PASS-with-notes**: no blocker/medium/minor/nitpick code defects. Ruling on the double-log nuance: on a load/hydrate error path, `rehydrateAssignment` now also triggers `readRehydrateAssignment`'s own `logger.error('readRehydrateAssignment failed', …)` in addition to its own `rehydrateAssignment failed` log — this is an ACCEPTABLE, structurally inevitable consequence of the SPEC-mandated delegated design (each method owns its error boundary per backend logging policy §5; removing either try/catch would violate a hard Section 1/3 constraint). The public `rehydrateAssignment failed` log is byte-for-byte preserved. Non-blocking doc suggestion I-1 (record this trade-off in the plan) is captured below.
>   - **Implementation note (I-1, double-log trade-off):** the refactored `rehydrateAssignment` produces TWO error-log calls on the load/hydrate failure path (`readRehydrateAssignment failed` from the delegate, then `rehydrateAssignment failed` from the caller). This is expected and accepted; it must NOT be flagged as a regression by future de-sloppification passes. It does not change `rehydrateAssignment`'s public error contract (types, messages, return value) and is tolerated by the regression suite (which uses `toHaveBeenCalled()`, not `toHaveBeenCalledTimes(1)`).
>   - **Section 3 Regression Gate:** done. Regression-checker (session `feature/read-rehydrate-assignment`, compare mode) → `backend-lint-check` unchanged from baseline (13 pre-existing `max-lines` warnings, 0 errors) = accepted technical debt; backend/test coverage and builder checks passing. The `frontend-e2e-check` reported 1 new failure in `task-heatmap.spec.ts` ("band filter hides non-matching rows"). This feature touches only backend `ABClassAssignmentOps.js` and has no code path to the frontend task-heatmap, so a causal link is impossible; a targeted re-run of `task-heatmap.spec.ts` returned **9 passed** (including the previously-failing test), confirming the original failure was a flake/environmental, NOT a regression introduced by this section. Gate passed (0 feature regressions).

> - **Section 4 Green (handler update):** done. `getAssignment_` in `src/backend/z_Api/assignmentAssessment.js` now calls `abClassController.readRehydrateAssignment(courseId, assignmentId)` (single call) instead of `loadClass` + `rehydrateAssignment`; the `ABClassController` is still instantiated; JSDoc updated (identity-threading `@remarks` bullet removed, `@throws` drops the `loadClass`-failure case and references `readRehydrateAssignment`, the `AssignmentNotFoundError`-detection/`deepConvertDates`/`progressTracker` bullets retained); `startAssessmentRun_`, the `module.exports` block, and all test files untouched. `npm run lint:backend` → 0 errors (13 pre-existing unrelated `max-lines` warnings). `tests/api/assignmentReadApi.test.js` → 8 passed / 7 failed; the 7 failures (7, 8, 8b, 9, 10, 11, 12) are the **expected Section 4→5 red handoff**.
> - **Section 4 Green review:** done. Code Reviewer returned **PASS** — all 7 acceptance criteria confirmed (single `readRehydrateAssignment` call present; `loadClass`/`rehydrateAssignment` removed from handler body; controller still instantiated; transport-boundary logic preserved; JSDoc updated correctly; no other methods/`module.exports` touched); 0 new lint errors. The 7 API-test failures are the agreed red handoff, not defects. Informational: `docs/developer/backend/api-layer.md` `getAssignment` entry is still stale (references `loadClass`/`rehydrateAssignment` + `normaliseDateFields`) — that is the Documentation and rollout phase, not a code defect.
> - **Commit note:** per user directive and `AGENTS.md` §3.11, the Section 4 handler change is held uncommitted alongside the Section 5 test fix; the combined S4+S5 change is committed once Section 5 is green and reviewed clean (avoids pushing a red test suite).

> - **Section 5 Green (API-layer test update):** done. `tests/api/assignmentReadApi.test.js` rewritten: `installABClassControllerStub` now exposes a single `readRehydrateAssignment` spy (the dead `loadClass`/`rehydrateAssignment` spies removed from constructor wiring and return shape); tests 7–11 rewired to the new delegation path; test 12 repurposed from the obsolete `loadClass`-error path to assert a `TypeError` from `readRehydrateAssignment` propagates verbatim (distinct from test 11's generic `Error` propagation); file header and helper JSDoc updated. `npm run test:backend -- tests/api/assignmentReadApi.test.js` → **15/15 passing**; grep confirms zero remaining `loadClass`/`rehydrateAssignment` references in the file; `npm run lint:backend` → 0 errors. Full backend suite 1920/1920 green. No production code changed.
> - **Section 5 Green review:** done. Code Reviewer returned **PASS** (verdict: approved) — all 7 acceptance criteria confirmed; zero stale references; suite green; 0 lint errors. Two non-blocking nitpicks (stale `normaliseDateFields` wording in a Test 8 comment, and a stray `test 7d` reference in a Test 7 comment) were fixed directly. Informational: `docs/developer/backend/api-layer.md` `getAssignment` entry remains stale — Documentation and rollout phase.
> - **Commit note (update):** per user directive, the combined Section 4 (handler) + Section 5 (tests) change is committed now that Section 5 is green and reviewed clean. Section 6 (regression) and Documentation/rollout remain outstanding.

> - **Section 6 Regression Gate:** done. `npm run regression-checker` (session `feature/read-rehydrate-assignment`, compare mode) → **Regressions Count 0, New Failures Count 0**; Overall Status FAILING only due to the pre-existing `backend-lint-check` `max-lines` warning debt (13 pre-existing warnings, 0 errors) = accepted technical debt. backend-test-coverage-check PASS (full backend suite green), frontend-e2e-check PASS (no flake this run), all other checks PASS. **Unchanged-callers inspection:** `src/backend/y_controllers/AssignmentController.js` `processSelectedAssignment` (line 139 `abClassController.loadClass(courseId)`, line 143 `rehydrateAssignment`) and `ensureDefinitionFromInputs` (line 428 `abClassController.loadClass(courseId)`) both confirmed intact and unchanged; grep across `src/backend` shows the only `abClassController.loadClass`/`rehydrateAssignment` callers are these two out-of-scope assessment-run/definition functions — `getAssignment_` no longer references them. Section 6 acceptance criteria 1-5 satisfied. No code changed.

> - **Documentation and rollout phase:** **OUTSTANDING — NOT applied to disk.** Verified that `docs/developer/backend/api-layer.md`, `docs/developer/data-shapes/assignment.md`, and `SPEC.md` are all at their pre-docs-pass committed state (HEAD = `18da4ed`); `git diff HEAD` for these files is empty and `grep` confirms the old `loadClass`/`rehydrateAssignment`/`normaliseDateFields` wording is still present. The intended edits (and the documentation Code Review that was run against the intended in-memory content) are recorded here so the next session can apply them:
>   - `getAssignment_` JSDoc (already updated in the Section 4 commit `18da4ed`).
>   - `readRehydrateAssignment` JSDoc on `ABClassAssignmentOps.js` and the `ABClassController/index.js` facade; `rehydrateAssignment` JSDoc delegation note (already in the Section 1/2/3 commits).
>   - `docs/developer/backend/api-layer.md` `getAssignment` entry: source line → `readRehydrateAssignment` (no `loadClass`); validation paragraph must drop the class-existence check (assignment existence only, via `AssignmentNotFoundError`); handler-behaviour paragraph describes the single `readRehydrateAssignment` call with `DateUtils.deepConvertDates(response)`; reconcile the `normaliseDateFields` → `deepConvertDates` drift; logging paragraph must match the four actual `getAssignment_` log statements (`info` "getAssignment: loading full assignment", `info` "getAssignment: rehydrated assignment", `warn` "getAssignment: assignment not found", `error` "getAssignment failed"); error-codes line drops `loadClass`/`ClassNotFoundError`.
>   - `docs/developer/data-shapes/assignment.md` `getAssignment` (read) entry: Controller row = `ABClassController.readRehydrateAssignment()`; delete the identity-threading note; rewrite the key-domain-validation entry to attribute full-definition hydration to `readRehydrateAssignment` (no class-existence check); add `readRehydrateAssignment` to the File Index `index.js` line.
>   - `SPEC.md` §"Planned data-shape changes": flip status from `Not implemented` to `implemented`; reword the plan item at line ~296 from "at docs-pass time" to "completed during docs pass".
>   - A documentation Code Review (run against the intended content) returned **APPROVED (clean)** with one informational note (File Index completeness), which is captured in the intended `assignment.md` File Index edit above. No production code changes are required for this phase.

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Treat the SPEC as the source of truth for product behaviour, contracts, and naming.
3. Use this action plan to sequence delivery and testing; do not restate or redefine material already settled in the spec.

## Scope and assumptions

### Scope

- New `readRehydrateAssignment(courseId, assignmentId)` method in `ABClassAssignmentOps`
- New `readRehydrateAssignment` facade delegation method in `ABClassController`
- Refactoring of existing `rehydrateAssignment` to delegate to the new read-only method
- Update of `getAssignment_` transport handler to use the new read-only path
- Update of existing API-layer tests (`tests/api/assignmentReadApi.test.js`)
- New backend tests for the new method and the refactored method
- Update of `docs/developer/backend/api-layer.md` `getAssignment` entry (incl. reconciling the pre-existing `normaliseDateFields` → `deepConvertDates` drift) and the canonical data-shape contract `docs/developer/data-shapes/assignment.md` `getAssignment` (read) entry per `SPEC.md` §"Planned data-shape changes"

### Out of scope

- Changing `loadClass` or its roster-refresh contract
- Changing the assessment run's use of `loadClass`
- Adding a `refreshRoster` parameter to any existing method
- Frontend changes (no transport contract changes)
- E2E test changes

### Assumptions

1. The assignment document in the dedicated collection (keyed by `courseId + assignmentId`) contains all data needed for a fully hydrated assignment response.
2. `_ensureFullDefinition` resolves partial definitions identically whether called from `rehydrateAssignment` or `readRehydrateAssignment`.
3. The existing `rehydrateAssignment` regression suite (`tests/controllers/abclassController.rehydrateAssignment.test.js`) will catch any behavioural regression from the refactoring.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- Production backend files must remain GAS-first; use only guarded `module.exports` for Node test access.
- New methods must follow the `ABLogger` logging pattern, not direct `console.*`.

### TDD workflow (mandatory per section)

For each section below, delegate sub-agents via the `task` tool with the `files` array to inject required documentation directly into the subagent prompt:

1. **Red**: write failing tests for the section's acceptance criteria (delegate to `Testing Specialist`).
2. **Green**: implement the smallest change needed to pass (delegate to `Implementation`).
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

When sub-agents are used, pass mandatory documentation via the `files` parameter of the `task` tool — the `task-files` plugin reads and injects file contents automatically. Sub-agents must not re-read injected files. If any mandatory file is missing from the `files` array, return the work to the same sub-agent and block progression until corrected.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Backend tests: `npm run test:backend -- <target>`

### Data-shape planning gate

A planned data-shape change is recorded in `SPEC.md` §"Planned data-shape changes": a documentation-only text update to `docs/developer/data-shapes/assignment.md` (the response shape itself is unchanged; only the canonical doc's controller-row, identity-threading contract note, and key-domain-validation entry text must be updated). The entry is marked `Not implemented` until the Documentation and rollout section reconciles it. No production data shape changes; this gate is satisfied by the Documentation and rollout section's criterion 5 and required check 4.

---

## Section 1 — Implement `readRehydrateAssignment` core method in `ABClassAssignmentOps`

### Objective

Add a new public method `readRehydrateAssignment(courseId, assignmentId)` to `ABClassAssignmentOps` that loads and hydrates an assignment directly from its dedicated collection, without requiring an ABClass instance. This is the read-only counterpart of `rehydrateAssignment` — it performs only the load/hydrate steps and skips the in-place class mutation.

### Constraints

- File: `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js` (304 lines)
- Projected LOC increase: ~40 lines → ~344 lines total (under 550 threshold)
- Must follow the same validation, logging, and error-handling patterns as the existing `rehydrateAssignment`
- Must use `ABLogger` for logging (not `console.*`)
- Must export the new method via the existing guarded `module.exports` block
- Must validate `courseId` and `assignmentId` as non-empty strings (matching the existing `rehydrateAssignment` pattern)
- Must use `Validate.requireParams` for parameter presence, following existing convention

### Delegation files (injected automatically by the `task-files` plugin)

Testing Specialist receives these files via the `files` array (not read manually):

- `SPEC.md`
- `docs/developer/backend/backend-testing.md`
- `docs/developer/backend/backend-logging-and-error-handling.md`
- `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`
- `src/backend/Utils/Validate.js`

Implementation receives these files via the `files` array:

- `SPEC.md`
- `docs/developer/backend/backend-logging-and-error-handling.md`
- `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`

Code Reviewer receives these files via the `files` array:

- `SPEC.md`
- `docs/developer/backend/backend-logging-and-error-handling.md`
- `docs/developer/backend/backend-testing.md`

### Shared helper plan

None. The new method uses only existing private helpers (`_loadFullAssignmentDocument`, `_validateAssignmentDocument`, `_ensureFullDefinition`) — no new abstractions needed. `_hydrationLevel = 'full'` assignment follows the existing pattern.

### Acceptance criteria

1. `readRehydrateAssignment(courseId, assignmentId)` exists as a public method on `ABClassAssignmentOps`.
2. For valid `courseId` and `assignmentId`, it returns a fully hydrated `Assignment` instance.
3. The returned assignment has `_hydrationLevel === 'full'` and a resolved `assignmentDefinition` (full definition, not partial with tasks as an array).
4. When no document exists, it throws `AssignmentNotFoundError`.
5. When the document is corrupt (missing required fields), it throws an appropriate `Error`.
6. When `courseId` or `assignmentId` is missing/null/empty, it throws `TypeError` with the exact messages defined in the spec's §"Core behavioural model" §`readRehydrateAssignment` step 1:
   - `readRehydrateAssignment: expected courseId to be a non-empty string` (for `courseId`)
   - `readRehydrateAssignment: expected assignmentId to be a non-empty string` (for `assignmentId`)
     These messages are the contract. Tests must assert the full string verbatim (not via substring match). The exact-message decision is fixed in `SPEC.md`; no Red→Green coordination is needed between Testing Specialist and Implementation — both follow the spec.
7. All operations are logged via `ABLogger` at appropriate levels.

### Required test cases (Red first)

Test file ownership: Section 1 **creates** the test file `tests/controllers/abclassController.readRehydrateAssignment.test.js` containing the ops-level unit tests below. The naming follows the existing loc convention `tests/controllers/abclassController.<methodName>.test.js` (e.g. the sibling `tests/controllers/abclassController.rehydrateAssignment.test.js`). Section 2 will **append** its facade-delegation smoke test to this same file; Section 1's delegate must therefore create the file with the `describe` blocks scoped to the ops method, leaving room for a sibling `describe` block added by Section 2. No other section writes to this file.

Backend unit tests for `readRehydrateAssignment`:

1. **Happy path:** given valid `courseId` and `assignmentId`, the method loads the document, creates an Assignment, resolves the full definition, sets hydration level, and returns it.
2. **Document not found:** throws `AssignmentNotFoundError`.
3. **Corrupt document — missing courseId:** throws `Error` about corrupt data.
4. **Corrupt document — missing assignmentDefinition:** throws `Error` about corrupt data.
5. **Invalid arguments — null courseId:** throws `TypeError` with the exact message `readRehydrateAssignment: expected courseId to be a non-empty string` (assert verbatim, not substring).
6. **Invalid arguments — empty string assignmentId:** throws `TypeError` with the exact message `readRehydrateAssignment: expected assignmentId to be a non-empty string` (assert verbatim, not substring).
7. **Definition resolution:** when the stored definition is partial (tasks is an array), `_ensureFullDefinition` resolves it to the full definition from the registry.
8. **Logging:** verify `ABLogger.info` is called on success and `ABLogger.error` on failure. Note (see `SPEC.md` §"Documentation and rollout notes" — "Shared helper log-wording decision (I1)"): the shared private helper `_loadFullAssignmentDocument` retains its existing `logger.info('rehydrateAssignment: loading full assignment', …)` wording as-is; the new method does not alter this helper's log statement, so Section 1 tests should not assert against the inner helper's log message (only that `ABLogger.info` was called). The misleading prefix is accepted as a known-stale-but-descriptive log message; reviewers should not flag it without further contextualisation work that is out of scope here.

### Section checks

- `npm run test:backend -- tests/controllers/abclassController.readRehydrateAssignment` (green — includes tests 1–8 of this section)
- `npm run lint:backend` (green on changed file)
- Node exports block includes `readRehydrateAssignment`.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** none expected.
- **Follow-up implications for later sections:** Section 2 (facade) and Section 3 (refactoring) depend on this method being complete.

---

## Section 2 — Add `readRehydrateAssignment` facade delegation in `ABClassController`

### Objective

Add a thin public delegation method on the `ABClassController` facade that mirrors the existing `rehydrateAssignment` delegation pattern. This exposes the core method to callers without them needing to reach into `ABClassAssignmentOps` directly.

### Constraints

- File: `src/backend/y_controllers/ABClassController/index.js` (588 lines)
- Projected LOC increase: ~8 lines → ~596 lines (over 550 threshold, but it is already a facade — no split needed; the addition is trivial)
- Must follow the same delegation pattern as `rehydrateAssignment` (line 470–472): one-line delegation to `this._assignmentOps`
- Must be placed adjacent to the existing `rehydrateAssignment` delegation in the public delegation section (around line 472)

### Delegation files (injected automatically by the `task-files` plugin)

Implementation receives these files via the `files` array:

- `SPEC.md`
- `src/backend/y_controllers/ABClassController/index.js`

Code Reviewer receives these files via the `files` array:

- `SPEC.md`
- `docs/developer/backend/backend-logging-and-error-handling.md`

### Shared helper plan

None. This is a thin delegation — no new abstractions.

### Acceptance criteria

1. `ABClassController.prototype.readRehydrateAssignment(courseId, assignmentId)` exists and delegates to `this._assignmentOps.readRehydrateAssignment(courseId, assignmentId)`.
2. The delegation signature matches the ops method exactly.
3. The method is placed in the public delegation section adjacent to the existing `rehydrateAssignment` delegation.
4. **Coverage decision (explicit):** the facade method is covered by a single smoke assertion created in this section (see §"Required test cases" below). Section 5's API-layer tests do _not_ exercise this facade path because `installABClassControllerStub` replaces the entire `ABClassController` constructor (per `tests/api/assignmentReadApi.test.js` lines 41–50), so Section 5 assertions only prove the handler calls `readRehydrateAssignment` on the _stub_, not that the _real_ facade delegates to `_assignmentOps`. The standalone smoke test created in this section is the only direct coverage of the facade delegation.

### Required test cases (Red first)

This section **owns** the facade-delegation smoke test (it is not created in Section 1). Test file path: `tests/controllers/abclassController.readRehydrateAssignment.test.js` — the file Section 1 created for the ops-level unit tests. Section 2's Testing Specialist **appends** a new `describe` block to this existing file; do not create a new file and do not overwrite or remove Section 1's ops tests. Keep the existing file header (`describe('ABClassController.readRehydrateAssignment …')` or similar) intact and add the facade `describe` block as a top-level sibling.

1. **Facade delegation smoke test (Red in this section, Green in this section):** assert `new ABClassController().readRehydrateAssignment(courseId, assignmentId)` calls `instance._assignmentOps.readRehydrateAssignment` with the identical `(courseId, assignmentId)` arguments. Assert via a mocked `_assignmentOps` returning a sentinel assignment. The test is Red before the facade method exists (Section 2 starting state) and Green after the facade method lands (Section 2 ending state). This is the only test added in this section.

### Section checks

- `npm run test:backend -- tests/controllers/abclassController.readRehydrateAssignment` (green — the facade smoke test passes once the facade method is implemented)
- `npm run lint:backend` (green on changed file)
- Verify manual inspection: method placement adjacent to existing `rehydrateAssignment` delegation.
- Confirm the facade-delegation smoke test is green after this section lands.

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** none expected.
- **Follow-up implications for later sections:** Section 3 and Section 4 depend on this method being available on the facade.

---

## Section 3 — Refactor existing `rehydrateAssignment` to delegate to `readRehydrateAssignment`

### Objective

Refactor the existing `rehydrateAssignment(abClass, assignmentId)` method in `ABClassAssignmentOps` to delegate the core loading logic to the new `readRehydrateAssignment`, preserving identical behaviour and error contracts.

### Constraints

- File: `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`
- The refactored method must produce **byte-for-byte identical** behaviour to the current implementation — same error messages, same error types, same logging, same return value.
- All three existing validation guards must be retained at the top of the method:
  1. `Validate.requireParams({ abClass, assignmentId }, 'rehydrateAssignment')`
  2. `abClass.classId` non-empty string guard
  3. `assignmentId` non-empty string guard
- After validation, the method extracts `courseId` from `abClass.classId`, calls `this.readRehydrateAssignment(courseId, assignmentId)`, then calls `this._replaceAssignmentInClass(abClass, assignmentId, result)` on the returned assignment.
- The `try/catch` with `logger.error` must remain around the core logic.

### Delegation files (injected automatically by the `task-files` plugin)

Testing Specialist receives these files via the `files` array:

- `SPEC.md`
- `docs/developer/backend/backend-testing.md`
- `docs/developer/backend/backend-logging-and-error-handling.md`
- `tests/controllers/abclassController.rehydrateAssignment.test.js`
- `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`

Implementation receives these files via the `files` array:

- `SPEC.md`
- `docs/developer/backend/backend-logging-and-error-handling.md`
- `src/backend/y_controllers/ABClassController/ABClassAssignmentOps.js`

Code Reviewer receives these files via the `files` array:

- `SPEC.md`
- `docs/developer/backend/backend-logging-and-error-handling.md`
- `docs/developer/backend/backend-testing.md`

### Shared helper plan

None. This is a purely internal refactoring of an existing method.

### Acceptance criteria

1. The refactored `rehydrateAssignment` produces identical return values, throws identical error types with identical messages, and emits identical log calls as the current implementation.
2. The existing test suite `tests/controllers/abclassController.rehydrateAssignment.test.js` passes without modification.
3. The method body is shorter and delegates core loading to `readRehydrateAssignment`.

### Required test cases (Red first)

**No new tests required.** The existing `tests/controllers/abclassController.rehydrateAssignment.test.js` (430 lines) is the regression suite. Run it before and after the refactoring to confirm behavioural equivalence.

If any existing test fails, the refactoring is incorrect and must be revised until all existing tests pass.

### Section checks

- `npm run test:backend -- tests/controllers/abclassController.rehydrateAssignment` (all existing tests green)
- `npm run lint:backend` (green on changed file)

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** none expected.
- **Follow-up implications for later sections:** Section 4 depends on `readRehydrateAssignment` being fully functional (verified through Section 1 tests and the Section 3 regression suite).

---

## Section 4 — Update `getAssignment_` transport handler to use read-only path

### Objective

Replace the `loadClass` + `rehydrateAssignment` call chain in `getAssignment_` with a single call to `abClassController.readRehydrateAssignment(courseId, assignmentId)`. All transport-boundary logic (parameter validation, date conversion, `progressTracker` stripping, error handling) remains unchanged.

### Constraints

- File: `src/backend/z_Api/assignmentAssessment.js` (154 lines)
- Minimal change: replace lines ~124–125 (the try block body) with the new single call
- The `courseId` and `assignmentId` are already validated by the transport boundary before the try block
- All existing transport-boundary logic must be preserved:
  - `DateUtils.deepConvertDates(response)` for date serialisation
  - `delete response.progressTracker` for defence-in-depth
  - `AssignmentNotFoundError` → return `null`
  - `ApiValidationError` for parameter shape violations
- Update the JSDoc on `getAssignment_`:
  - **Remove only the identity-threading `@remarks` bullet** — specifically the bullet beginning "The same `abClass` instance returned by `loadClass` is threaded through to `rehydrateAssignment` …" (approximately lines 90–94 of `assignmentAssessment.js`). This rationale no longer applies because `loadClass` and `_replaceAssignmentInClass` are no longer called from this handler.
  - **Leave in place** the unrelated `@remarks` bullet about `AssignmentNotFoundError` not-found detection (the bullet beginning "Not-found detection uses an `instanceof AssignmentNotFoundError` check …" — approximately lines 75–79). That bullet remains accurate because `_loadFullAssignmentDocument` (still called transitively by `readRehydrateAssignment` via the ops chain) continues to throw the typed error.
  - **Leave in place** the `@remarks` bullets about `DateUtils.deepConvertDates()` and `progressTracker` stripping — both remain accurate.
  - **Correct the `@throws` clause**: drop the `loadClass`-failure case (`If loadClass fails (class not found)`), keeping the corrupt-document and `readRehydrateAssignment`-error cases.

### Delegation files (injected automatically by the `task-files` plugin)

Implementation receives these files via the `files` array:

- `SPEC.md`
- `src/backend/z_Api/assignmentAssessment.js`

Code Reviewer receives these files via the `files` array:

- `SPEC.md`
- `docs/developer/backend/backend-logging-and-error-handling.md`
- `docs/developer/backend/api-layer.md`

### Shared helper plan

None. The change is a call-site replacement within an existing handler. The file `src/backend/z_Api/assignmentAssessment.js` also defines `startAssessmentRun_` and exposes it via the same trailing `module.exports` block at the file's end; the Section 4 change is local to `getAssignment_`'s try block and must not touch `startAssessmentRun_`, its JSDoc, or the shared `module.exports` export list.

### Acceptance criteria

1. `getAssignment_` calls `abClassController.readRehydrateAssignment(courseId, assignmentId)` instead of `loadClass` + `rehydrateAssignment`.
2. The `loadClass` call is removed from `getAssignment_`.
3. The `ABClassController` instantiation is still created (for calling `readRehydrateAssignment`), but `loadClass` is no longer called on it.
4. All transport-boundary logic (parameter validation, date conversion, `progressTracker` strip, null-on-not-found, error propagation) functions identically.
5. JSDoc is updated per the section's JSDoc constraints: only the identity-threading `@remarks` bullet is removed; the `AssignmentNotFoundError` detection bullet, the `deepConvertDates` bullet, and the `progressTracker` bullet remain; the `@throws` clause drops the `loadClass`-failure case and correctly references `readRehydrateAssignment`.

### Required test cases (Red first)

No new tests are _created_ in this section, because the existing `tests/api/assignmentReadApi.test.js` suite will be updated in Section 5. However:

1. After the code change, run `tests/api/assignmentReadApi.test.js` with the **current** stubs — tests 7, 8, 8b, 9, 10, 11, 12 will fail because the stub exposes `loadClass`/`rehydrateAssignment` but the handler now calls `readRehydrateAssignment`. These failures are **expected** and confirm the handler has been correctly updated. Section 5 then updates the stubs.

### Section completion and handoff state (important — read before treating Section 4 as complete)

Section 4 is intentionally a **handler-only** change section. Its acceptance criteria (1–5 above) and its section checks (lint + manual verification of the removed `loadClass` call + JSDoc) are satisfied by the handler change alone. The wider test suite is expected to be **red** at the end of Section 4 — specifically, `tests/api/assignmentReadApi.test.js` tests 7, 8, 8b, 9, 10, 11, 12 will fail as described in §"Required test cases" item 1.

**Completion rule:** Section 4 is considered "complete" when its own section checks pass (lint green, manual verification done, JSDoc updated). Section 4 is **not** a stopping point for the orchestrator — Section 5 must immediately follow because the broken `assignmentReadApi.test.js` suite is the expected red handoff state of this section. The orchestrator must not mark the feature as shippable, run Section 6 regression, or hand off to the docs agent until Section 5 has restored `assignmentReadApi.test.js` to green.

This explicit red-state handoff is the agreed contract for the Section 4→5 boundary; the two sections remain separate because they edit distinct concerns (the production handler vs. the test stub wiring) and are separable for reviewer purposes (Code Review reviews Section 4; Testing Specialist reviews Section 5).

### Section checks

- `npm run lint:backend` (green on changed file)
- Manual verification: `loadClass` is no longer referenced in `getAssignment_` handler body
- JSDoc `@remarks` paragraph is removed; `@throws` clause updated

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** none expected.
- **Follow-up implications for later sections:** Section 5 (test updates) must immediately follow to restore the test suite to green.

---

## Section 5 — Update existing API-layer tests (`tests/api/assignmentReadApi.test.js`)

### Objective

Update the `tests/api/assignmentReadApi.test.js` test suite to match the new delegation path. The shared stub helper must expose `readRehydrateAssignment`, and all tests that depend on the stub must be updated. One test (test 12) must be removed because its premise (loadClass error propagation) no longer exists.

### Constraints

- File: `tests/api/assignmentReadApi.test.js` (465 lines)
- The updated suite must pass with the updated `getAssignment_` handler from Section 4
- All existing assertions about response shape, date conversion, error handling, and logging that remain relevant must continue to pass
- File header and helper JSDoc comments must be updated to reference `readRehydrateAssignment` instead of `loadClass`/`rehydrateAssignment`

### Delegation files (injected automatically by the `task-files` plugin)

Testing Specialist receives these files via the `files` array:

- `SPEC.md`
- `docs/developer/backend/backend-testing.md`
- `docs/developer/backend/backend-logging-and-error-handling.md`
- `tests/api/assignmentReadApi.test.js`
- `src/backend/z_Api/assignmentAssessment.js`

Implementation receives these files via the `files` array:

- `SPEC.md`
- `tests/api/assignmentReadApi.test.js`

Code Reviewer receives these files via the `files` array:

- `SPEC.md`
- `docs/developer/backend/backend-logging-and-error-handling.md`
- `docs/developer/backend/backend-testing.md`
- `docs/developer/backend/api-layer.md`

### Shared helper plan

None. Test-only changes; no shared-helper impact.

### Acceptance criteria

1. `installABClassControllerStub()` exposes a `readRehydrateAssignment` spy. **Remove the existing `loadClass` and `rehydrateAssignment` spies** from the helper (in both the constructor body that wires `this.loadClass`/`this.rehydrateAssignment` and the helper's return shape) — no remaining test in the file references them after the Section 5 rewrites, and leaving them installed would introduce dead test wiring that would trip de-sloppification reviews (see `AGENTS.md` §"Core principles" — avoid defensive guards that hide wiring issues; `src/backend/AGENTS.md` §5 — do not add defensive guards). The helper's return shape changes from `{ loadClass, rehydrateAssignment }` to `{ readRehydrateAssignment }`. Tests 1–6 only need a stubbed `ABClassController` constructor so the module loads (any no-op stub is sufficient — the spy is not asserted). Tests 7–11 are rewired to `readRehydrateAssignment`; test 12 is removed/replaced per criterion 4.
2. **Test 7** delegation assertion: asserts `readRehydrateAssignment` was called with `('course-001', 'assign-001')` instead of `loadClass` + `rehydrateAssignment(mockABClass, 'assign-001')`.
3. **Tests 8, 8b, 9, 10, 11**: stub wiring swapped from `loadClass`/`rehydrateAssignment` to `readRehydrateAssignment`; their existing assertions (date normalisation, `progressTracker` stripping, null-on-not-found, error propagation) remain valid and unchanged.
4. **Test 12** (`propagates errors from loadClass`): **removed** (the `loadClass` failure path no longer exists). It should not be replaced with a near-duplicate of test 11 — test 11 already asserts non-`AssignmentNotFoundError` error propagation through `readRehydrateAssignment` after step 3 rewires it. Either delete test 12 outright, or repurpose the slot for a distinct error path not otherwise covered (e.g. a `TypeError` thrown by `readRehydrateAssignment` on invalid identifiers, propagating to `getAssignment_` without being converted to `ApiValidationError`). Do not write a test that merely duplicates test 11's purpose on the new stub.
5. **File header** (lines 1–16): updated to reference `readRehydrateAssignment` instead of `loadClass`/`rehydrateAssignment`.
6. **Helper JSDoc** (lines 35–39): updated to reference the `readRehydrateAssignment` spy.
7. All tests pass: `npm run test:backend -- tests/api/assignmentReadApi` (green).

### Required test cases (Red first)

**Red phase (inherited from Section 4's handoff):** the red state of `tests/api/assignmentReadApi.test.js` (tests 7, 8, 8b, 9, 10, 11, 12 failing because the handler now calls `readRehydrateAssignment` but the stub doesn't expose it) is the expected state handed off by Section 4. Section 5 does **not** need to introduce a fresh red phase — it begins from the broken state left by Section 4 and turns it green via the stub rewrite below. The Testing Specialist should run `npm run test:backend -- tests/api/assignmentReadApi` once at the start of Section 5 and confirm tests 7, 8, 8b, 9, 10, 11, 12 fail in the expected way before making any edits; if they do not fail in the expected way, Section 4 was not completed correctly and the orchestrator must return to Section 4.

**Green phase changes:**

1. Update `installABClassControllerStub`: **remove** the `loadClass` and `rehydrateAssignment` spies (constructor-wiring and the helper's return shape), and add a `readRehydrateAssignment` spy. The helper now returns `{ readRehydrateAssignment }`.
2. Test 7: rewrite to stub `readRehydrateAssignment` and assert the call with `('course-001', 'assign-001')`. Remove assertions about `loadClass` and `rehydrateAssignment` from this test.
3. Tests 8, 8b, 9, 10, 11: swap stub wiring from `loadClass`/`rehydrateAssignment` to `readRehydrateAssignment`. Preserve the existing per-test `require('../../src/backend/Utils/ErrorTypes/AssignmentNotFoundError.js')` pattern where `AssignmentNotFoundError` instances are constructed (tests 10 and the not-found `require` site), exactly as in the current file — this per-test `require` pattern is intentional (avoids leaking the typed error across test isolation boundaries) and must not be hoisted to a top-level import.
4. Test 12: remove the existing `propagates errors from loadClass` test. Per criterion 4 above: do **not** replace it with a near-duplicate of test 11. Either delete the slot, or repurpose the slot for a distinct error path (e.g. `TypeError` from `readRehydrateAssignment` propagated verbatim through `getAssignment_`, since the handler's `catch` block only special-cases `AssignmentNotFoundError`).
5. Update file header and helper JSDoc comments to reference only `readRehydrateAssignment`.

### Section checks

- `npm run test:backend -- tests/api/assignmentReadApi` (all tests green)
- `npm run lint:backend` (not needed for test-only changes but good practice)
- Confirm `installABClassControllerStub`'s return shape is exactly `{ readRehydrateAssignment }` (no inert `loadClass`/`rehydrateAssignment` spies remain).

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during implementation.
- **Deviations from plan:** none expected.
- **Follow-up implications for later sections:** Section 6 runs the full suite as regression hardening.

---

## Section 6 — Regression and contract hardening

### Objective

Run the full backend test suite to confirm no regressions across all touched and adjacent areas. Verify that the `rehydrateAssignment` refactoring passes its existing regression suite unchanged.

### Constraints

- Must run before considering the feature complete.
- All existing tests in touched areas must pass.

### Acceptance criteria

1. `npm run test:backend -- tests/controllers/abclassController.rehydrateAssignment` — all existing tests pass (confirms refactoring preserved behaviour).
2. `npm run test:backend -- tests/controllers/abclassController.readRehydrateAssignment` — new tests pass (the test file is created by Section 1 and extended by Section 2; at Section 6 it must contain both the ops-level unit tests and the facade-delegation smoke test).
3. `npm run test:backend -- tests/api/assignmentReadApi` — all tests pass (confirms handler + stub update are correct).
4. `npm run lint:backend` — no errors on any changed file.
5. **Unchanged-callers verification (SPEC handoff obligation):** confirm by file inspection that the other two `loadClass` callers in `src/backend/y_controllers/AssignmentController.js` remain unchanged:
   - Inside the `processSelectedAssignment` function (currently around line 139): `const abClass = abClassController.loadClass(courseId);`
   - Inside the `ensureDefinitionFromInputs` function (currently around line 428): `const abClass = abClassController.loadClass(courseId);`
     Locate the call sites by the **enclosing function name** (`processSelectedAssignment`, `ensureDefinitionFromInputs`), then confirm each still contains `abClassController.loadClass(courseId)`. Line numbers are approximate (per N1: line numbers may drift between this plan being written and the regression pass; the function-name anchor is authoritative). These call sites have no targeted test gate (they are out of scope for behavioural change per the spec's out-of-scope list). Verification is by **reading the file after implementation**; if either call site has been touched, raise it as a deviation and revert the unintended change.

### Required test cases/checks

1. Run touched backend controller and API suites:
   - `npm run test:backend -- tests/controllers/`
   - `npm run test:backend -- tests/api/`
2. Run backend lint: `npm run lint:backend`
3. Confirm the `files` array was populated for every delegated handoff (the `task-files` plugin injects them automatically).
4. **Perform the unchanged-`loadClass`-callers file inspection** (not merely verify it is documented): open `src/backend/y_controllers/AssignmentController.js`, locate the two call sites inside `processSelectedAssignment` and `ensureDefinitionFromInputs` by enclosing function name, confirm each still calls `abClassController.loadClass(courseId)`, and record the result (unchanged / deviation found and reverted) in the implementation notes for this section. This is an inspection-only gate carried out by the implementation agent (or reviewer) directly; no automated test is generated for it because the call sites are out of behavioural scope.

### Section checks

- All commands listed above return green.

### Implementation notes / deviations / follow-up

- **Implementation notes:** summarise what was done during regression phase.
- **Deviations from plan:** note any additional work discovered or done.

---

## Documentation and rollout

### Objective

Update JSDoc and ensure consistency between the implemented code and documentation, including the canonical API contract document.

### Constraints

- Only modify documents relevant to touched areas.
- No frontend doc changes needed.
- Documentation tasks for `docs/developer/backend/api-layer.md` are mandatory (not optional) because this feature materially rewrites the `getAssignment` handler's controller-delegation chain and error semantics.
- Documentation tasks for `docs/developer/data-shapes/assignment.md` are mandatory (not optional) because the canonical transport-shape contract for `getAssignment` is registered there; per `docs/developer/data-shapes/INDEX.md`, the contract file is the single source of truth for the contract and must be updated concurrently with the code change. See `SPEC.md` §"Planned data-shape changes" for the planned `Not implemented` entry that the docs pass must flip to implemented.
- All line / paragraph references below are approximate (per N1: line numbers drift between plan-writing and docs-pass; the docs agent must locate entries by heading/text and re-confirm line numbers before editing).

### Acceptance criteria

1. `getAssignment_` JSDoc: only the stale identity-threading `@remarks` bullet is removed; the `AssignmentNotFoundError`-detection, `deepConvertDates`, and `progressTracker` bullets remain; the `@throws` clause drops the `loadClass`-failure case and correctly references `readRehydrateAssignment`.
2. `readRehydrateAssignment` JSDoc added on both `ABClassAssignmentOps` and `ABClassController` methods, documenting their read-only semantics (no roster refresh, no database write, no `ABClass` mutation).
3. `rehydrateAssignment` JSDoc updated to note the internal delegation to `readRehydrateAssignment` (optional, but recommended).
4. **Canonical API contract document (`docs/developer/backend/api-layer.md`) updated** in the `getAssignment` entry (currently lines ~403–410 — locate by the entry heading starting `- getAssignment — reads a single fully-hydrated assignment`):
   a. **Source line rewritten** to reference `ABClassController.readRehydrateAssignment()` (the controller path is now the facade delegation to ops, with no `loadClass` call).
   b. **Handler-behaviour paragraph rewritten** to remove the `loadClass` / identity-threading description and the `abClass` parameter; describe the single call to `readRehydrateAssignment(courseId, assignmentId)`.
   c. **Pre-existing date-conversion drift reconciled (SPEC §"Pre-existing doc/code drift in api-layer.md"):** the existing handler-behaviour paragraph claim that the handler "applies `DateUtils.normaliseDateFields(response, ['dueDate', 'updatedAt', 'createdAt'])`" must be replaced with `DateUtils.deepConvertDates(response)`, matching production code (`src/backend/z_Api/assignmentAssessment.js`, the `DateUtils.deepConvertDates(response)` line inside `getAssignment_`) and the existing API-layer test assertions (tests 8 and 8b).
   d. **Error-codes line updated** to drop the `INTERNAL_ERROR`-via-`loadClass`/`ClassNotFoundError` enumeration. The post-change `INTERNAL_ERROR` enumeration is scoped to corrupt assignment document, partial-definition rejection, or any other `readRehydrateAssignment` failure. The `AssignmentNotFoundError` → `null` case remains unchanged.
   e. **Logging line verified** — the four log points (`info` before loading, `info` after successful rehydration, `warn` for not-found, `error` for other failures) remain structurally identical; if Section 4 changes any log message wording, update the logging paragraph to match.
5. **Canonical transport-shape contract document (`docs/developer/data-shapes/assignment.md`) updated** — implements the `SPEC.md` §"Planned data-shape changes" entry:
   a. **Aspect-table "Controller" row (currently line ~93 of `assignment.md`, locate by the `getAssignment` (read) section heading):** replace `ABClassController.loadClass()` + `ABClassController.rehydrateAssignment()` with `ABClassController.readRehydrateAssignment()` (no `loadClass`). This is a documentation-only text change; the response shape rows are unchanged.
   b. **Identity-threading contract note (currently line ~128 of `assignment.md`, locate by the note text "threads the same `abClass` instance through `loadClass` and `rehydrateAssignment`"):** delete — the new path does not mutate an `ABClass` instance, so the threading rationale no longer applies.
   c. _*Key-domain-validation entry (currently line ~371 of `assignment.md`, locate by the entry "* `ABClassController.rehydrateAssignment()` ensures the assignment's embedded definition is fully hydrated before `getAssignment` can succeed_"):** rewrite to state that `ABClassController.readRehydrateAssignment()` performs the full-definition hydration for `getAssignment`; `rehydrateAssignment` continues to perform it for the assessment-run flow.
   d. **Status flip:** as the docs pass edits each of the three sub-items, the `SPEC.md` §"Planned data-shape changes" entry must be flipped from `Not implemented` to implemented (i.e. remove the `Not implemented` marker) — the docs agent owns this reconciliation.

### Required checks

1. Verify JSDoc on changed methods is accurate and complete (criteria 1–3).
2. Verify `docs/developer/backend/api-layer.md` `getAssignment` entry matches the implemented handler behaviour and the date-conversion drift is reconciled (criterion 4).
3. Verify `docs/developer/data-shapes/assignment.md` `getAssignment` (read) entry matches the implemented controller path (criterion 5); the response-shape rows are unchanged.
4. **Reconcile the planned data-shape entry:** confirm `SPEC.md` §"Planned data-shape changes" entry's `Not implemented` marker has been removed/flipped to implemented after criterion 5 lands. If the marker remains, return to the Docs agent with the finding.
5. Confirm `SPEC.md` is consistent with the implemented code (no drift).
6. Reconcile any planned shared-helper entries in canonical docs — none planned for this feature.
7. Confirm the `files` array was populated for every delegated handoff (the `task-files` plugin injects them automatically).

### Delegation files (injected automatically by the `task-files` plugin)

Docs receives these files via the `files` array:

- `SPEC.md` (including §"Planned data-shape changes" and §"Documentation and rollout notes")
- `src/backend/z_Api/assignmentAssessment.js`
- `docs/developer/backend/api-layer.md` (the document to be updated for criterion 4)
- `docs/developer/data-shapes/assignment.md` (the document to be updated for criterion 5; the docs agent must also update the spec's planned-entry status per criterion 5d)

Code Reviewer receives these files via the `files` array:

- `SPEC.md`
- `docs/developer/backend/api-layer.md` (so reviewer can verify the canonical doc now matches the code)
- `docs/developer/data-shapes/assignment.md` (so reviewer can verify the canonical transport-shape contract now matches the implemented controller path)

### Implementation notes / deviations / follow-up

- **Implementation notes:** to be filled during documentation phase.
- **Deviations from plan:** none expected.

---

## Suggested implementation order

1. Section 1 — Implement `readRehydrateAssignment` core method (enabling work)
2. Section 2 — Add facade delegation (enabling for callers)
3. Section 3 — Refactor `rehydrateAssignment` (depends on Section 1)
4. Section 4 — Update `getAssignment_` handler (depends on Sections 1 and 2)
5. Section 5 — Update existing API-layer tests (depends on Section 4, expected to fail after Section 4 and turn green here)
6. Section 6 — Regression and contract hardening (final gate)
7. Documentation and rollout
