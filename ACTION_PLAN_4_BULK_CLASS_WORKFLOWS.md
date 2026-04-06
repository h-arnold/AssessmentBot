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

- Workstream 1 already hardened backend mutation validation for `active` updates on missing classes; keep this behaviour covered and do not regress it while implementing bulk flows.
- There is no shared mutation engine yet.
- Existing nearby mutation patterns collapse mutation failure and refresh failure into a single generic error state.
- The shared Classes harness exists; Workstream 4 should extend its queue/helpers to prove submitted-row-order aggregation for bulk journeys.

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
- Selection resets on Classes-tab entry and re-entry.
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

> **🟢 GREEN PHASE COMPLETE — PENDING REVIEW**

| Step                          | Status     |
| ----------------------------- | ---------- |
| Red tests added               | ✅ done    |
| Red review clean              | ✅ done    |
| Green implementation complete | ✅ done    |
| Green review clean            | ⬜ pending |
| Checks passed                 | ✅ done    |
| Action plan updated           | ✅ done    |
| Commit created                | ⬜ pending |
| Push completed                | ⬜ pending |

Acceptance:

- Bulk create only targets `notCreated` rows.
- Create uses `cohortKey`, `yearGroupKey`, and `courseLength`, defaulting `courseLength` to `1`.
- Delete copy explicitly states that full and partial records are removed.
- Active/inactive flows reject ineligible rows before opening.
- Backend-authoritative validation remains enforced so active/inactive updates cannot create missing classes.
- After destructive mutation refreshes, removed/invisible row keys are cleared from selection.

Tests:

- `src/frontend/src/features/classes/bulkCreate.spec.tsx`
- `src/frontend/src/features/classes/bulkDelete.spec.tsx`
- `src/frontend/src/features/classes/bulkActiveState.spec.tsx`
- `src/frontend/src/features/classes/ClassesPanel.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-bulk-core.spec.ts`

**Implementation notes — 4.2**

The current branch does not carry the workstream-3 Classes shell/table baseline that 4.2 depends on (the `ClassesTab` shell, the classes data table, and the row-selection slice). Rather than blocking, a minimal prerequisite shell/table/selection slice will be implemented inside 4.2 — strictly scoped to what is needed to make the bulk-create, bulk-delete, and active-state flows testable. No workstream-3 acceptance criteria will be addressed here; only the structural surface required by the 4.2 tests.

**Green implementation notes — 4.2**

New production files created:

- `src/frontend/src/features/classes/bulkCreateFlow.ts` — exports `ClassStatus`, `ClassTableRow`, `BulkCreateOptions`, `filterBulkCreateRows`, and `bulkCreate`. `bulkCreate` dispatches `upsertABClass` via `callApi` through the shared `runBatchMutation` engine; maps `cohortKey → cohort`, `yearGroupKey → yearGroup`, defaults `courseLength` to `1`.
- `src/frontend/src/features/classes/bulkActiveStateFlow.ts` — exports `ClassTableRow` (re-exported from `bulkCreateFlow`) and `filterEligibleForActiveState`. Rejects rows with `status === 'notCreated'`, `active === null`, or `active === targetState`.
- `src/frontend/src/features/classes/BulkDeleteModal.tsx` — exports `BulkDeleteModalProperties` and `BulkDeleteModal`. Wraps Ant Design `Modal` with `okText="Delete"` / `cancelText="Cancel"` copy that explicitly mentions both full and partial record removal.
- `src/frontend/src/features/classes/ClassesPanel.tsx` — minimal prerequisite Classes panel. Fetches class partials via `getClassPartialsQueryOptions`, derives `ClassTableRow[]` with `useMemo` (no `setState` in effects — local deletions and active-state overrides tracked with separate `Set`/`Map` state). Renders an Ant Design `Table` with `aria-label="Classes table"` (via `components.table` override), `hideSelectAll: true` row selection, and conditionally visible bulk-action buttons (`Bulk create`, `Bulk delete`, `Set active`, `Set inactive`). Action buttons are hidden while the delete modal is open to prevent a `/delete/i` regex collision in E2E tests. After mutations, local state is updated optimistically without waiting for a query refetch.

Modified files:

- `src/frontend/src/services/classPartials.zod.ts` — `courseLength` changed from `z.number()` to `z.number().nullable()` to accommodate `notCreated` class partials (all AB-specific fields null) returned by the backend.
- `src/frontend/src/pages/ClassesPage.tsx` — wires `ClassesPanel` as the page body.
- `src/frontend/src/pages/SettingsPage.tsx` — replaces the `SettingsPlaceholderPanel` for the `classes` tab with `ClassesPanel`; extracts a `renderSettingsTabChildren` helper to avoid a nested-ternary lint error.
- `src/frontend/src/features/classes/bulkCreate.spec.tsx` — changed `const callApiMock = vi.fn()` to `const callApiMock = vi.hoisted(() => vi.fn())` to fix a Vitest temporal-dead-zone error caused by the static `import { bulkCreate } from './bulkCreateFlow'` at the top of the file triggering the `vi.mock` factory before `callApiMock` was initialised. The test logic is unchanged.
- `src/frontend/src/pages/SettingsPage.spec.tsx` — added `vi.mock('../features/classes/ClassesPanel', ...)` so the Classes tab renders without a `QueryClientProvider`.
- `src/frontend/src/pages/pages.spec.tsx` — added `vi.mock('../features/classes/ClassesPanel', ...)` for the same reason.
- `src/frontend/src/navigation/appNavigation.spec.tsx` — added `vi.mock('../features/classes/ClassesPanel', ...)` for the same reason.

Checks that passed:

- `npm run frontend:test -- src/features/classes/batchMutationEngine.spec.ts src/features/classes/bulkCreate.spec.tsx src/features/classes/bulkDelete.spec.tsx src/features/classes/bulkActiveState.spec.tsx` — 28 tests pass
- `npm run frontend:test` (full suite) — 231/231 pass
- `npm run frontend:lint` — no errors
- `npm exec tsc -- -b src/frontend/tsconfig.json` — no errors
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-bulk-core.spec.ts` — 11/11 pass

**4.2 Green-phase review findings and resolution**

Blocking finding resolved:

1. **Coverage threshold failure** (`ClassesPanel.tsx` under-tested): `npm run frontend:test:coverage` was failing the 85% enforced thresholds (functions at 82.32%, branches at 78.81%) because `ClassesPanel.tsx` had only 28.57% statement coverage and 10.71% function coverage.

   Resolution: added `src/frontend/src/features/classes/ClassesPanel.spec.tsx` (25 tests) covering:
   - `ClassesTableElement` aria-label rendering
   - `classPartialToRow` and `deriveStatus` for all three status variants (`notCreated`, `linked`, `partial`)
   - `className` fallback to `classId` when null
   - Active-column renderer for `null` (`—`), `true` (`Active`), and `false` (`Inactive`)
   - Bulk-action button visibility rules for all four action types
   - `handleDeleteConfirm` flow: modal open, API call, row removal, selection cleared
   - Cancel flow: action bar reappears, row stays, no API call
   - `handleActivate` flow: `updateABClass` with `active: true`, column updates to `Active`
   - `handleDeactivate` flow: `updateABClass` with `active: false`, column updates to `Inactive`

   Post-fix coverage: 94.87% statements, 88.98% branches, 96.13% functions — all above 85% threshold.

2. **Noisy `getABClassPartials` mock errors in App.spec.tsx**: tests that navigate to the Classes page (e.g., breadcrumb/rapid-switching tests using `installPendingApiHandlerMock`) triggered unhandled transport errors because `ClassesPanel` calls `useQuery` for class partials regardless of auth state.

   Resolution: extended `installPendingApiHandlerMock` to also mock `[classPartialsMethodName]: 'pending'`. The existing assertion `expect(transport.getCallCount(classPartialsMethodName)).toBe(0)` in the "does not start class-partials warm-up" test is unaffected because that test uses the default (dashboard) page where `ClassesPanel` never renders. The explicit `[classPartialsMethodName]: 'pending'` entry in `installApiHandlerMock` call at line 622 (kept as-is) continues to assert the warm-up call count is 1.

Post-review checks passed:

- `npm run frontend:test -- src/features/classes/batchMutationEngine.spec.ts src/features/classes/bulkCreate.spec.tsx src/features/classes/bulkDelete.spec.tsx src/features/classes/bulkActiveState.spec.tsx src/features/classes/ClassesPanel.spec.tsx` — 53 tests pass
- `npm run frontend:test` (full suite) — 256/256 pass
- `npm run frontend:test:coverage` — passes all thresholds (94.87% / 88.98% / 96.13%)
- `npm run frontend:lint` — no errors
- `npm exec tsc -- -b src/frontend/tsconfig.json` — no errors

Changed test files:

- `src/frontend/src/features/classes/bulkCreate.spec.tsx` — **new file**; covers `filterBulkCreateRows` (notCreated-only filtering), `bulkCreate` payload construction (cohortKey→cohort, yearGroupKey→yearGroup, courseLength with default 1), out-of-order promise resolution, single-row rejection, and empty-list short-circuit. Mocks `callApi` via `vi.mock('../../services/apiService', ...)`.
- `src/frontend/src/features/classes/bulkDelete.spec.tsx` — **new file**; covers `BulkDeleteModal` rendering with explicit "full" and "partial" record copy, row count display, confirm/cancel callback wiring, and `open: false` hides dialog. Imports `BulkDeleteModalProperties` and `ClassTableRow` from the production modules to be created.
- `src/frontend/src/features/classes/bulkActiveState.spec.tsx` — **new file**; covers `filterEligibleForActiveState` rejecting notCreated rows, rejecting rows already at target state, filtering in the activate direction, filtering in the deactivate direction, rejecting null-active rows, and empty-list base case. Imports `ClassTableRow` from `bulkActiveStateFlow`.
- `src/frontend/e2e-tests/classes-crud-bulk-core.spec.ts` — **new file**; Playwright E2E tests covering classes table display, bulk create button visibility (notCreated rows only — fixture `notCreatedClassFixture` supplies a full ClassPartial transport shape with null AB-specific fields), bulk delete confirmation copy (full + partial), confirming bulk delete removes rows, set-active-absent for already-active rows, set-inactive-absent for already-inactive rows, set-active-absent for notCreated rows (distinct ineligible scenario exercising the notCreated branch of `filterEligibleForActiveState`). Uses `googleScriptRunApiHandlerFactorySource` init-script pattern.

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

Corrected E2E scenarios (post-review):

- `'bulk create button is visible when notCreated rows are selected'`: uses `classPartials: [notCreatedClassFixture]` — a full ClassPartial transport shape where `cohort`, `yearGroup`, `courseLength`, and `active` are all null, signalling a row the implementation will classify as `notCreated`. Replacing the original empty `classPartials: []` which could not render any rows.
- `'set active button is absent when only notCreated rows are selected'`: replaced the previous duplicate `activeClassFixture` scenario with `notCreatedClassFixture` so this test exercises the distinct ineligible-notCreated branch of `filterEligibleForActiveState`, rather than repeating the already-active scenario already covered by `'set active button is absent when only already-active rows are selected'`.

Red-phase review fix (resolved):

- `'rejects rows that are already at the target active state'` in `bulkActiveState.spec.tsx` had a contradictory fixture where `r2` was `active: false` while the target state was `true`, making `r2` eligible for activation and invalidating the zero-length assertion. Fixed by setting all three rows to `active: true` so all are already at the target state.

Minimal production surface implied by these tests (to be created in the green phase):

- `src/frontend/src/features/classes/bulkCreateFlow.ts` — exports `ClassTableRow` type, `ClassStatus` type, `filterBulkCreateRows`, `bulkCreate`
- `src/frontend/src/features/classes/BulkDeleteModal.tsx` — exports `BulkDeleteModalProperties` type, `BulkDeleteModal` component
- `src/frontend/src/features/classes/bulkActiveStateFlow.ts` — exports `ClassTableRow` type (shared with bulkCreateFlow), `filterEligibleForActiveState`
- A minimal `ClassesPage`/`ClassesTab` update with a table (`aria-label="Classes table"`), row checkboxes, and bulk-action buttons that respond to selection state

### 4.3 Bulk cohort, year-group, and course-length flows

> **✅ COMPLETE**

| Step                          | Status                                               |
| ----------------------------- | ---------------------------------------------------- |
| Red tests added               | ✅ done                                              |
| Red review clean              | ✅ done                                              |
| Green implementation complete | ✅ done                                              |
| Green review clean            | ✅ done                                              |
| Checks passed                 | ✅ done                                              |
| Action plan updated           | ✅ done                                              |
| Commit created                | ✅ done (`194a2aa475cbbf80946e45a267d69f7ac55298b6`) |
| Push completed                | ✅ done (`origin/feat/ws4-bulk-class-workflows`)     |

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

**Implementation notes — 4.3**

Changed production files:

- `src/frontend/src/features/classes/bulkSetCohortFlow.ts` — new shared cohort-update helper; filters eligible existing rows, exposes active-cohort-only select options, and dispatches keyed `updateABClass` mutations through `runBatchMutation(...)`.
- `src/frontend/src/features/classes/bulkSetYearGroupFlow.ts` — new keyed year-group update helper; reuses the shared batch engine and preserves stable key values in selector options and mutation payloads.
- `src/frontend/src/features/classes/bulkSetCourseLengthFlow.ts` — new course-length update helper; validates integer `>= 1` via Zod before dispatching per-row updates through the shared batch engine.
- `src/frontend/src/features/classes/bulkEditValidation.zod.ts` — new shared Zod validation module for reference-data keys and course-length validation copy.
- `src/frontend/src/features/classes/BulkSetSelectModal.tsx` — new reusable select-driven modal for cohort and year-group updates.
- `src/frontend/src/features/classes/BulkSetCourseLengthModal.tsx` — new course-length modal using Ant `InputNumber` and shared validation.
- `src/frontend/src/features/classes/ClassesManagementPanel.tsx` — wires the three new modals/actions into the merged WS3 shell, threads keyed row data into the WS4 adapter, and now handles settled batch results for metadata, delete, and active-state flows so partial/full failures are visible instead of being treated as success.
- `src/frontend/src/features/classes/ClassesToolbar.tsx` — adds `Set cohort`, `Set year group`, and `Set course length` actions with existing-row-only eligibility (`active`/`inactive` only).
- `src/frontend/src/features/classes/classesManagementViewModel.ts` — carries `cohortKey` and `yearGroupKey` through the merged table row view-model so bulk edits can submit stable keys.
- `src/frontend/src/features/classes/useClassesManagement.ts` — exposes `cohorts` and `yearGroups` to the panel so the new bulk-edit modals can render current selector options.
- `src/frontend/src/features/classes/BulkDeleteModal.tsx` — extended with `confirmLoading` so delete failure handling can keep the surface consistent while requests are in flight.

Changed test files:

- `src/frontend/src/features/classes/bulkSetCohort.spec.tsx` — new RED/GREEN unit coverage for eligibility, active-cohort option filtering, keyed payloads, and single-row reuse of the batch path.
- `src/frontend/src/features/classes/bulkSetYearGroup.spec.tsx` — new RED/GREEN unit coverage for eligibility, keyed selector options, keyed payloads, and single-row reuse.
- `src/frontend/src/features/classes/bulkSetCourseLength.spec.tsx` — new RED/GREEN unit coverage for eligibility, integer `>= 1` validation, keyed batch dispatch, and single-row reuse.
- `src/frontend/src/features/classes/ClassesToolbar.spec.tsx` — extended to lock the new edit-action eligibility for orphaned, notCreated, active, inactive, and mixed active+inactive selections.
- `src/frontend/src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx` — new integration coverage proving metadata partial failures keep the modal open, refresh successful rows, and reselect only failed rows.
- `src/frontend/src/features/classes/ClassesManagementPanel.spec.tsx` — extended to cover top-level failure feedback for delete, set-active, and set-inactive partial/full failures.
- `src/frontend/e2e-tests/classes-crud-bulk-cohort.spec.ts` — new browser journey coverage for cohort modal eligibility, active-only cohort options, and partial-failure reselection/refresh behaviour.
- `src/frontend/e2e-tests/classes-crud-bulk-year-group.spec.ts` — new browser journey coverage for year-group modal eligibility, keyed option usage, and partial-failure reselection/refresh behaviour.
- `src/frontend/e2e-tests/classes-crud-bulk-course-length.spec.ts` — new browser journey coverage for course-length modal eligibility, validation, and partial-failure reselection/refresh behaviour.
- `src/frontend/e2e-tests/classes-crud-bulk-core.spec.ts` — extended core-flow browser coverage for partial delete failure and adjacent active-state failure handling.
- `src/frontend/e2e-tests/classes-crud.shared.ts` — extended shared Classes CRUD harness to queue `updateABClass` responses for browser-side failure-path journeys.

Red-phase review findings / resolutions:

- **[blocking — resolved]** Initial RED suite only proved single-row eligibility. Added mixed active+inactive coverage in both unit and browser tests so an implementation that blocked inactive rows or mixed existing selections could not pass.
- **[blocking — resolved]** Course-length validation copy conflicted between unit and browser tests. Aligned both on the canonical message `Course length must be an integer greater than or equal to 1.`.
- Final RED review — CLEAN.

Green-phase review findings / resolutions:

- **[blocking — resolved]** Metadata bulk-edit handlers originally treated settled batch failures as success because they ignored `runBatchMutation(...)` rejected-row results. Fixed by keeping metadata modals open on partial/full failure, refreshing class partials, and reselecting only failed rows.
- **[blocking — resolved]** The same settled-result bug still affected adjacent delete and active-state flows. Generalised top-level settled-result handling so delete, set-active, and set-inactive now refresh, preserve failed-row selection, and surface visible warning/error alerts instead of silently clearing state.
- Final green review — CLEAN (no remaining blockers).

Checks that passed:

- `npm run frontend:test -- src/features/classes/bulkSetCohort.spec.tsx src/features/classes/bulkSetYearGroup.spec.tsx src/features/classes/bulkSetCourseLength.spec.tsx src/features/classes/ClassesToolbar.spec.tsx`
- `npm run frontend:test -- src/features/classes/ClassesManagementPanel.spec.tsx src/features/classes/ClassesManagementPanel.bulkMetadataFailure.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-bulk-core.spec.ts e2e-tests/classes-crud-bulk-cohort.spec.ts e2e-tests/classes-crud-bulk-year-group.spec.ts e2e-tests/classes-crud-bulk-course-length.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

### 4.4 Mutation summary and refresh-failure UX

> **✅ COMPLETE (reviewer-clean; commit/push pending)**

| Step                          | Status     |
| ----------------------------- | ---------- |
| Red tests added               | ✅ done    |
| Red review clean              | ✅ done    |
| Green implementation complete | ✅ done    |
| Green review clean            | ✅ done    |
| Checks passed                 | ✅ done    |
| Action plan updated           | ✅ done    |
| Commit created                | ⬜ pending |
| Push completed                | ⬜ pending |

Acceptance:

- Partial-success modals close and hand off to persistent summary alerts.
- If the mutation succeeds but required re-fetch fails, the UI reports success plus refresh-needed guidance.
- Required refresh failure suppresses stale table data.
- Google Classroom data remains outside required post-mutation refresh paths; the v1 contract keeps this dataset on Classes-tab entry prefetch only.

**Implementation notes — 4.4**

Changed production files:

- `src/frontend/src/features/classes/queryInvalidation.ts` — adds the required class-partials refresh outcome helper so successful mutations can hand refresh-failure metadata back to the UI without treating the mutation itself as failed.
- `src/frontend/src/features/classes/ClassesManagementPanel.tsx` — hands modal-scoped mutation results off to persistent summary alerts, surfaces refresh-required guidance after successful mutations whose class-partials refresh fails, suppresses stale table rendering while that guidance is active, and keeps post-mutation refreshes scoped to `classPartials` rather than Google Classroom data.
- `src/frontend/src/features/classes/useClassesManagement.ts` — preserves `refreshRequiredMessage` in the management state so refresh-failure guidance can keep stale rows hidden on subsequent renders.

Changed test files:

- `src/frontend/src/features/classes/queryInvalidation.spec.ts` — covers composite mutation-success/refresh-failure outcomes and user-safe refresh guidance mapping.
- `src/frontend/src/features/classes/mutationSummary.spec.tsx` — proves partial metadata failures close the modal and hand off to the persistent summary alert, plus refresh-required copy when the required refresh fails.
- `src/frontend/src/features/classes/refetchFailureState.spec.tsx` — proves refresh-required state suppresses stale table rows.
- `src/frontend/e2e-tests/classes-crud-mutation-summary.spec.ts` — covers persistent summary handoff after partial cohort updates and delete refresh-failure UX, including the contract that post-mutation refreshes do not re-fetch Google Classrooms.

Completion notes:

- Persistent mutation summary handoff is now explicit for modal-driven metadata updates.
- Refresh-required guidance is shown when the mutation succeeds but the required class-partials refresh fails.
- Stale-table suppression hides the Classes table while refresh-required guidance is active.
- No Google Classroom post-mutation refresh is triggered; only `classPartials` participates in the required refresh path.
- Final review state — CLEAN.

Checks that passed:

- `npm run frontend:test -- src/features/classes/queryInvalidation.spec.ts src/features/classes/mutationSummary.spec.tsx src/features/classes/refetchFailureState.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-mutation-summary.spec.ts`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`

## Deferred closure map (Workstream 3 -> Workstream 4)

Use this table as a completion gate so Workstream 3 deferred acceptance criteria close explicitly during Workstream 4:

| Workstream 3 deferred item                                        | Workstream 4 closure section                        |
| ----------------------------------------------------------------- | --------------------------------------------------- |
| Selection reset on Classes-tab re-entry                           | 4.1 Shared batch mutation engine                    |
| Selection clearing after destructive mutation refresh             | 4.2 Bulk create, delete, and active-state flows     |
| Non-blocking partial-refresh warning semantics                    | 4.4 Mutation summary and refresh-failure UX         |
| Success-plus-refresh-needed guidance with stale-table suppression | 4.4 Mutation summary and refresh-failure UX         |
| Playwright coverage for deferred refresh-failure UX               | 4.4 tests (`classes-crud-mutation-summary.spec.ts`) |

Tests:

- `src/frontend/src/features/classes/mutationSummary.spec.tsx`
- `src/frontend/src/features/classes/refetchFailureState.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-mutation-summary.spec.ts`

## Sequencing notes

- Rewrite backend/controller/API red tests first so they stop encoding create-on-missing update behaviour.
- Keep modal shells thin; put dispatch and result mapping in shared helpers/hooks.
- Extend the existing shared Classes CRUD harness/helpers; do not create a second harness.

## Section checks

- `npm test -- tests/controllers/abclass-upsert-update.test.js tests/controllers/abclass-delete.test.js tests/api/abclassMutations.test.js`
- `npm run frontend:test -- src/features/classes/batchMutationEngine.spec.ts src/features/classes/bulkCreate.spec.tsx src/features/classes/bulkDelete.spec.tsx src/features/classes/bulkActiveState.spec.tsx src/features/classes/bulkSetCohort.spec.tsx src/features/classes/bulkSetYearGroup.spec.tsx src/features/classes/bulkSetCourseLength.spec.tsx src/features/classes/mutationSummary.spec.tsx src/features/classes/refetchFailureState.spec.tsx`
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-bulk-core.spec.ts e2e-tests/classes-crud-bulk-cohort.spec.ts e2e-tests/classes-crud-bulk-year-group.spec.ts e2e-tests/classes-crud-bulk-course-length.spec.ts e2e-tests/classes-crud-mutation-summary.spec.ts`
- `npm run lint`
- `npm run frontend:lint`
- `npm exec tsc -- -b src/frontend/tsconfig.json`
