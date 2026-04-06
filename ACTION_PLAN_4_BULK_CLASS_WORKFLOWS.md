# Workstream 4: Bulk Class Workflows

## Scope

- Shared Classes batch mutation engine
- Bulk create, delete, and active/inactive
- Bulk cohort, year-group, and course-length updates
- Mutation summary persistence
- Refresh-failure handling after successful mutation

## Touched code

- `src/backend/z_Api/abclassMutations.js`
- `src/backend/y_controllers/ABClassController.js`
- New `src/frontend/src/features/classes/**`
- `src/frontend/src/services/apiService.ts`
- `src/frontend/src/query/sharedQueries.ts`
- `src/frontend/src/test/googleScriptRunHarness.ts`

## Exploration findings to account for

- `updateABClass` still behaves like an upsert for missing classes.
- There is no shared mutation engine yet.
- Existing nearby mutation patterns collapse mutation failure and refresh failure into a single generic error state.
- The harness is not yet proving submitted-row-order aggregation.

## Work packages

### 4.1 Shared batch mutation engine

> **✅ COMPLETE**

| Step                          | Status  |
| ----------------------------- | ------- |
| Red tests added               | ✅ done |
| Red review clean              | ✅ done |
| Green implementation complete | ✅ done |
| Green review clean            | ✅ done |
| Checks passed                 | ✅ done |
| Action plan updated           | ✅ done |
| Commit created                | ✅ done |
| Push completed                | ✅ done |

Acceptance:

- One shared engine dispatches one request per selected row in parallel.
- Result aggregation preserves submitted-row order, not promise-resolution order.
- Failed rows remain selected when still present.
- Single-row edits use the same path as bulk edits.
- No feature-specific retry loop is added on top of `callApi(...)`.

Tests:

- `src/frontend/src/features/classes/batchMutationEngine.spec.ts`

**Implementation notes — 4.1**

Changed test files:

- `tests/controllers/abclass-upsert-update.test.js` — renamed describe block (removed `Section 3 RED` label); replaced the test encoding create-on-missing update behaviour (`'updateABClass uses upsert-on-update behaviour when the class is missing'`) with `'updateABClass throws when the class does not exist rather than creating it'`, which asserts `updateABClass` throws and does not call `fetchCourse`, `insertOne`, or `updateOne` when the class document is absent.
- `tests/api/abclassMutations.test.js` — renamed describe block (removed `Section 3` label); no functional changes required.
- `src/frontend/src/features/classes/batchMutationEngine.spec.ts` — **new file**; covers parallel dispatch, submitted-row-order aggregation (proven by out-of-order promise resolution), mixed succeeded/failed row ordering, single-row-uses-same-path, exactly-once-per-row (no retry loop), and empty-list base case.

Failing evidence (red phase):

Backend — `npm test -- tests/controllers/abclass-upsert-update.test.js tests/api/abclassMutations.test.js`:

```
FAIL tests/controllers/abclass-upsert-update.test.js
  × updateABClass throws when the class does not exist rather than creating it
    AssertionError: expected [Function] to throw an error
    — production code calls this.initialise(...) instead of throwing
1 failed | 32 passed
```

Frontend — `npm run frontend:test -- src/features/classes/batchMutationEngine.spec.ts`:

```
FAIL src/features/classes/batchMutationEngine.spec.ts
  Error: Failed to resolve import "./batchMutationEngine" from
  "src/features/classes/batchMutationEngine.spec.ts". Does the file exist?
1 test file failed (module not found — production module not yet created)
```

- Review findings / resolutions (green phase — blocking, resolved):
  - **[blocking — resolved]** `batchMutationEngine.ts` file-level design note incorrectly stated `Promise.allSettled` is used. Updated comment to accurately describe the actual implementation: each row promise is normalised with `.then`/`.catch` in the same `map` call, and the resulting normalised promises are collected with `Promise.all` to preserve submitted-row order without index-based array access. `Promise.allSettled` is intentionally avoided to prevent the `security/detect-object-injection` lint rule from triggering.
  - **[blocking — resolved]** `ABClassController.js` JSDoc on `updateABClass` still described the removed upsert-on-missing behaviour ("If the class does not yet exist, initialises it first using the supplied patch fields"). Updated JSDoc to reflect the new contract: states that it throws a `RangeError` when the class does not exist and adds `@throws {RangeError}` tag.
  - Reviewer considered the red phase clean with no blocking issues.
  - **[green-phase improvement — resolved]** Backend `updateABClass` missing-class throw assertion tightened: test now asserts `toThrow(new RangeError("updateABClass: class 'class-001' does not exist"))` matching the exact error shape produced by the production change.
  - **[green-phase improvement — resolved]** Frontend test command path in Section checks corrected: stripped `src/frontend/` prefix so paths resolve relative to `src/frontend/` as Vitest expects.
  - **[non-blocking — resolved]** `batchMutationEngine.spec.ts` `any` casts replaced with typed `FulfilledRowResult` and `RejectedRowResult` generic helpers imported from the new production module.
  - **[non-blocking — resolved]** Stale red-phase comment in `batchMutationEngine.spec.ts` line 7 ("Import from a module that does not yet exist — all tests will fail in red phase.") removed; the production module exists and all tests pass.
- Green implementation notes:
  - `src/backend/y_controllers/ABClassController.js` — `updateABClass`: replaced the upsert-on-missing branch with `throw new RangeError("updateABClass: class '${classId}' does not exist")`.
  - `src/frontend/src/features/classes/batchMutationEngine.ts` — **new file**; exports `runBatchMutation<TRow, TData>` and the `FulfilledRowResult`, `RejectedRowResult`, `RowMutationResult` types. Uses `rows.map(row => mutateFunction(row).then(...).catch(...))` + `Promise.all` — avoids `Promise.allSettled` to eliminate index-based array access that would trigger `security/detect-object-injection`.
  - `src/frontend/src/features/classes/batchMutationEngine.spec.ts` — updated header comment; added typed imports; replaced three `any` casts.
  - `tests/controllers/abclass-upsert-update.test.js` — tightened throw assertion.
  - `ACTION_PLAN_4_BULK_CLASS_WORKFLOWS.md` — corrected Section checks frontend test path; updated status table; recorded green implementation notes.
- Final code review — CLEAN (no blocking or non-blocking findings):
  - Reviewer confirmed all green-phase resolutions are correctly applied and no new issues were introduced.
  - Checks that passed:
    - `npm test -- tests/controllers/abclass-upsert-update.test.js tests/api/abclassMutations.test.js` — all tests pass
    - `npm run frontend:test -- src/features/classes/batchMutationEngine.spec.ts` — all tests pass
    - `npm run frontend:lint` — no lint errors
    - `npm exec tsc -- -b src/frontend/tsconfig.json` — no type errors
- Delivery evidence:
  - Branch: `feat/ws4-bulk-class-workflows`
  - Commit SHA: `275eabbdf3c7fd3f615105cc63f9c72087a31d55`
  - Commit message: `feat(ws4): implement shared batch mutation engine and missing-class update contract`
  - Push: succeeded — upstream `origin/feat/ws4-bulk-class-workflows`

### 4.2 Bulk create, delete, and active-state flows

> **🔴 RED PHASE IN PROGRESS**

| Step                          | Status     |
| ----------------------------- | ---------- |
| Red tests added               | ✅ done    |
| Red review clean              | ⬜ pending |
| Green implementation complete | ⬜ pending |
| Green review clean            | ⬜ pending |
| Checks passed                 | ⬜ pending |
| Action plan updated           | ⬜ pending |
| Commit created                | ⬜ pending |
| Push completed                | ⬜ pending |

Acceptance:

- Bulk create only targets `notCreated` rows.
- Create uses `cohortKey`, `yearGroupKey`, and `courseLength`, defaulting `courseLength` to `1`.
- Delete copy explicitly states that full and partial records are removed.
- Active/inactive flows reject ineligible rows before opening.

Tests:

- `src/frontend/src/features/classes/bulkCreate.spec.tsx`
- `src/frontend/src/features/classes/bulkDelete.spec.tsx`
- `src/frontend/src/features/classes/bulkActiveState.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-bulk-core.spec.ts`

**Implementation notes — 4.2**

The current branch does not carry the workstream-3 Classes shell/table baseline that 4.2 depends on (the `ClassesTab` shell, the classes data table, and the row-selection slice). Rather than blocking, a minimal prerequisite shell/table/selection slice will be implemented inside 4.2 — strictly scoped to what is needed to make the bulk-create, bulk-delete, and active-state flows testable. No workstream-3 acceptance criteria will be addressed here; only the structural surface required by the 4.2 tests.

**Red-phase checklist — 4.2**

Changed test files:

- `src/frontend/src/features/classes/bulkCreate.spec.tsx` — **new file**; covers `filterBulkCreateRows` (notCreated-only filtering), `bulkCreate` payload construction (cohortKey→cohort, yearGroupKey→yearGroup, courseLength with default 1), out-of-order promise resolution, single-row rejection, and empty-list short-circuit. Mocks `callApi` via `vi.mock('../../services/apiService', ...)`.
- `src/frontend/src/features/classes/bulkDelete.spec.tsx` — **new file**; covers `BulkDeleteModal` rendering with explicit "full" and "partial" record copy, row count display, confirm/cancel callback wiring, and `open: false` hides dialog. Imports `BulkDeleteModalProperties` and `ClassTableRow` from the production modules to be created.
- `src/frontend/src/features/classes/bulkActiveState.spec.tsx` — **new file**; covers `filterEligibleForActiveState` rejecting notCreated rows, rejecting rows already at target state, filtering in the activate direction, filtering in the deactivate direction, rejecting null-active rows, and empty-list base case. Imports `ClassTableRow` from `bulkActiveStateFlow`.
- `src/frontend/e2e-tests/classes-crud-bulk-core.spec.ts` — **new file**; Playwright E2E tests covering classes table display, bulk create button visibility (notCreated rows only), bulk delete confirmation copy (full + partial), confirming bulk delete removes rows, and bulk active-state button eligibility. Uses `googleScriptRunApiHandlerFactorySource` init-script pattern.

Failing evidence (red phase):

Frontend unit tests — `npm run frontend:test -- src/features/classes/bulkCreate.spec.tsx src/features/classes/bulkDelete.spec.tsx src/features/classes/bulkActiveState.spec.tsx`:

```
FAIL  src/features/classes/bulkActiveState.spec.tsx
Error: Failed to resolve import "./bulkActiveStateFlow" from "src/features/classes/bulkActiveState.spec.tsx". Does the file exist?

FAIL  src/features/classes/bulkCreate.spec.tsx
Error: Failed to resolve import "./bulkCreateFlow" from "src/features/classes/bulkCreate.spec.tsx". Does the file exist?

FAIL  src/features/classes/bulkDelete.spec.tsx
Error: Failed to resolve import "./BulkDeleteModal" from "src/features/classes/bulkDelete.spec.tsx". Does the file exist?

Test Files  3 failed (3)
     Tests  no tests
```

E2E tests — `npm run frontend:test:e2e -- e2e-tests/classes-crud-bulk-core.spec.ts`:

```
11 failed — all with:
  Error: browserType.launch: Target page, context or browser has been closed
  [pid=N][err] chrome-headless-shell: error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file
```

Note: the E2E environment constraint (missing `libglib-2.0.so.0` system library) is a pre-existing infrastructure limitation affecting the entire E2E suite (confirmed by running `e2e-tests/auth-status.spec.ts` — also 5 failed). Once the system dependency is resolved, the E2E tests will fail because the Classes table/bulk-action UI does not yet exist (correct red-phase failure). The test content is correct.

Minimal production surface implied by these tests (to be created in the green phase):

- `src/frontend/src/features/classes/bulkCreateFlow.ts` — exports `ClassTableRow` type, `ClassStatus` type, `filterBulkCreateRows`, `bulkCreate`
- `src/frontend/src/features/classes/BulkDeleteModal.tsx` — exports `BulkDeleteModalProperties` type, `BulkDeleteModal` component
- `src/frontend/src/features/classes/bulkActiveStateFlow.ts` — exports `ClassTableRow` type (shared with bulkCreateFlow), `filterEligibleForActiveState`
- A minimal `ClassesPage`/`ClassesTab` update with a table (`aria-label="Classes table"`), row checkboxes, and bulk-action buttons that respond to selection state

### 4.3 Bulk cohort, year-group, and course-length flows

| Step                          | Status     |
| ----------------------------- | ---------- |
| Red tests added               | ⬜ pending |
| Red review clean              | ⬜ pending |
| Green implementation complete | ⬜ pending |
| Green review clean            | ⬜ pending |
| Checks passed                 | ⬜ pending |
| Action plan updated           | ⬜ pending |
| Commit created                | ⬜ pending |
| Push completed                | ⬜ pending |

Acceptance:

- Cohort selector exposes active cohorts only.
- Year-group flow uses keyed options and payloads.
- Course-length flow validates integer `>= 1`.
- All three reuse the shared batch mutation engine and summary handoff.

Tests:

- `src/frontend/src/features/classes/bulkSetCohort.spec.tsx`
- `src/frontend/src/features/classes/bulkSetYearGroup.spec.tsx`
- `src/frontend/src/features/classes/bulkSetCourseLength.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-bulk-cohort.spec.ts e2e-tests/classes-crud-bulk-year-group.spec.ts e2e-tests/classes-crud-bulk-course-length.spec.ts`

### 4.4 Mutation summary and refresh-failure UX

| Step                          | Status     |
| ----------------------------- | ---------- |
| Red tests added               | ⬜ pending |
| Red review clean              | ⬜ pending |
| Green implementation complete | ⬜ pending |
| Green review clean            | ⬜ pending |
| Checks passed                 | ⬜ pending |
| Action plan updated           | ⬜ pending |
| Commit created                | ⬜ pending |
| Push completed                | ⬜ pending |

Acceptance:

- Partial-success modals stay open briefly, then hand off to persistent summary alerts.
- If the mutation succeeds but required re-fetch fails, the UI reports success plus refresh-needed guidance.
- Required refresh failure suppresses stale table data.

Tests:

- `src/frontend/src/features/classes/mutationSummary.spec.tsx`
- `src/frontend/src/features/classes/refetchFailureState.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-mutation-summary.spec.ts`

## Sequencing notes

- Rewrite backend/controller/API red tests first so they stop encoding create-on-missing update behaviour.
- Keep modal shells thin; put dispatch and result mapping in shared helpers/hooks.

## Section checks

- `npm test -- tests/controllers/abclass-upsert-update.test.js tests/controllers/abclass-delete.test.js tests/api/abclassMutations.test.js`
- `npm run frontend:test -- src/features/classes/batchMutationEngine.spec.ts src/features/classes/bulkCreate.spec.tsx src/features/classes/bulkDelete.spec.tsx src/features/classes/bulkActiveState.spec.tsx src/features/classes/bulkSetCohort.spec.tsx src/features/classes/bulkSetYearGroup.spec.tsx src/features/classes/bulkSetCourseLength.spec.tsx src/features/classes/mutationSummary.spec.tsx src/features/classes/refetchFailureState.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-bulk-core.spec.ts e2e-tests/classes-crud-bulk-cohort.spec.ts e2e-tests/classes-crud-bulk-year-group.spec.ts e2e-tests/classes-crud-bulk-course-length.spec.ts e2e-tests/classes-crud-mutation-summary.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`
