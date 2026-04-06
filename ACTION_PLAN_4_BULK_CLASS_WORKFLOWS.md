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

Acceptance:

- One shared engine dispatches one request per selected row in parallel.
- Result aggregation preserves submitted-row order, not promise-resolution order.
- Failed rows remain selected when still present.
- Single-row edits use the same path as bulk edits.
- Selection resets on Classes-tab entry and re-entry.
- No feature-specific retry loop is added on top of `callApi(...)`.

Tests:

- `src/frontend/src/features/classes/batchMutationEngine.spec.ts`

### 4.2 Bulk create, delete, and active-state flows

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
- `npm run frontend:test:e2e -- e2e-tests/classes-crud-bulk-core.spec.ts`

### 4.3 Bulk cohort, year-group, and course-length flows

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

Acceptance:

- Partial-success modals stay open briefly, then hand off to persistent summary alerts.
- If the mutation succeeds but required re-fetch fails, the UI reports success plus refresh-needed guidance.
- Required refresh failure suppresses stale table data.
- Google Classroom data remains outside required post-mutation refresh paths; the v1 contract keeps this dataset on Classes-tab entry prefetch only.

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
