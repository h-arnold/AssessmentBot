# Section 6 (Task Heatmap E2E) — GREEN-PHASE CODE REVIEW

**Reviewer:** Code Reviewer (GREEN-phase verification)
**Scope:** `src/frontend/e2e-tests/task-heatmap.spec.ts`, `.../helpers/task-heatmap-end-to-end-helpers.ts`, production sources `TaskHeatmapPage.tsx`, `TaskHeatmapTable.tsx`, `ClassPage.tsx`, `ClassPageContent.tsx`, `RecentAssignmentCard.tsx`, `RecentAssignmentsSection.tsx`, `StudentAveragesTableCard.tsx`, `classPageAdapter.ts`, and `shared/endToEndRuntimeMocks.ts`.

**Verdict:** CLEAN — all 7 tests pass for the right reasons; the GREEN-phase spec tweaks are correct and intent-preserving; no Critical/Major/Minor issues requiring change.

---

## 1. Empirical verification

- `npm run test:frontend:e2e -- e2e-tests/task-heatmap.spec.ts` → **7 passed (14.9s)**.
- Repeated runs for the two most fragile cases (loading-skeleton + direction-agnostic sort) with `--repeat-each=5 --workers=1` → **10/10 passed**. No flakiness.

## 2. GREEN-phase tweak analysis (intent-preserving?)

### 2.1 Strict-mode scoping on the class-name/heading check

Final assertions:

- `page.getByRole('heading', { name: HEATMAP_ASSIGNMENT_DISPLAY_TITLE })` → matches `Typography.Title level={4}` in `TaskHeatmapPage.tsx:96` (assignment name = `primaryTitle` = `HEATMAP_ASSIGNMENT_DISPLAY_TITLE`).
- `page.getByRole('heading', { name: HEATMAP_CLASS_NAME })` → matches `Typography.Title level={2}` in `ClassPage.tsx:138` (renders `className`, gated on `status !== 'loading'`; on the heatmap view `status === 'ready'` so it is present).

Both are genuine `heading` roles and there is exactly one of each on the heatmap surface (antd `Card` `title` props render as `div`, not headings, so no second match → no strict-mode violation). These assertions are NOT false positives; they verify real, user-visible headings. **Correct and intent-preserving.**

### 2.2 `tbody tr.ant-table-row` row targeting (sort test)

`task-heatmap.spec.ts:102-106` and `:115-119` target `.locator('tbody tr.ant-table-row').first().locator('td').first()` — robustly scopes to the first _data_ row, excluding header rows. This is the correct, stable locator and is not over-loose. **Correct.**

### 2.3 Direction-agnostic sort (sort test)

The test captures the first-row student name at default (pre-sorted ascending via `rows.toSorted(compareHeatmapStudentName)` + `defaultSortOrder: 'ascend'`), clicks the Student Name header, and asserts the new first-row name **differs**.

Why this still meaningfully exercises the feature:

- If the `sorter` were not wired (no `sorter` prop / missing `compareHeatmapStudentName`), the click would do nothing → order unchanged → assertion FAILS. So a missing sorter is caught.
- If the comparator were a no-op (always returns `0`), ascending and descending yield identical order → assertion FAILS. So a broken comparator is caught.
- An Ant Design single-column sort toggles ascend→descend on click; with 10 distinctly-named students the first row genuinely changes. Verified empirically across 10 repeats.

Exact ordering correctness (`compareHeatmapStudentName` locale-aware + `studentId` tie-break) is independently pinned by the Vitest unit test `classPageModel.spec.ts`. The E2E's role (per `frontend-playwright-e2e.md`) is to verify the _user-visible interaction_ (the header click re-sorts), which it does. The direction-agnostic form is strictly more robust than asserting a hard-coded order. **Intent-preserving, not weakened.**

### 2.4 Loading-test completion (deferred class)

Final test (`task-heatmap.spec.ts:140-162`) uses `createHeatmapScenario({ deferredClass: true })`, asserts the heatmap `table` has count `0` and a `.ant-skeleton` is visible while pending, then `releaseNextDeferredSuccess(page)`, expects `Recent Assignments` to appear, clicks the card, and asserts the table is visible and skeletons are gone.

A single `releaseNextDeferredSuccess` is sufficient: the scenario queues two `deferredSuccess` entries (one per StrictMode replay of `getABClass`), but the first resolved `getABClass` drives the `surfaceState` to `ready`; the second (pending) call is harmless because state is already set. Empirically stable across 5 repeats. **Correct and intent-preserving.**

## 3. Partial population / fixture correctness

- `getABClassPartials` entry carries `classId`, `className`, `cohortKey`, `courseLength`, `yearGroupKey` (`00000000-0000-0000-0000-000000000002`), `classOwner`, `teachers`, `active` — shape-consistent with `createClassesScenario`'s partials, so the year-group panel renders and the card is clickable (`classCard.getByRole('button', { name: 'View' })` succeeds).
- `getYearGroups` returns `{ key: '...0002', name: '7' }` matching the partial's `yearGroupKey` → correct panel placement.
- `getABClass` payload (`buildClassFullDocument`) provides a valid `ClassFull` document that flows through `getABClass` schema parse to `ready` (proven by the passing suite). `documentType: 'SLIDES'`, `artifact: { taskId, role, uid, type }`, `assessments: { completeness/accuracy/spag: { score } }`, `dueDate: null`, `_updateCounter`, etc. are all present and consistent.
- `emptySubmissions` strips submission metrics to `'N'` → every cell `notAttempted` → `hasNoSubmissions` caption path (`TaskHeatmapTable.tsx:216`) triggers. `zeroTasks` emits `tasks: []` → `taskColumns: []` → zero task columnheaders. Both verified by passing tests.
- `HEATMAP_ASSIGNMENT_DISPLAY_TITLE = '7. Video Plan'` equals `assignment.assignmentDefinition.primaryTitle`, which is what `RecentAssignmentCard` renders as its `Card` `title` (`classPageAdapter.ts:330`) and what `TaskHeatmapPage` renders as the `h4` — so the card-click and header assertions align with real DOM text.

## 4. Coverage integrity (all 6 required cases + zero-tasks variant)

1. Opens heatmap from recent assignment card — grouped header + green `aria-label` cell. ✅
2. Band filter hides non-matching rows (Green on Task 1 Completeness hides `N` Student One, keeps green Student Two). ✅
3. Student-name sort reorders via `compareHeatmapStudentName`. ✅
4. Back returns to overview (`Recent Assignments` + `Student Averages` re-visible). ✅
5. Loading skeleton → ready (deferred `getABClass`). ✅
6. Empty-state: no submissions (full roster `Student One` + "No submissions yet") and zero tasks (no `task_\d` columnheaders). ✅

`applyColumnFilterOption` (unchanged signature, accepts `Locator`) is safe and correctly exercised with `table.getByRole('columnheader', { name: 'Completeness' }).first()` (the first task group's Completeness), matching the plan's "strict: first group header" intent.

## 5. StrictMode / flakiness / anti-patterns

- No `waitForTimeout` anywhere. ✅
- No ambiguous strict-mode role matches (heading assertions each resolve to exactly one element). ✅
- `toHaveCount(0)` usages are scoped to a specific table/locator or the `.ant-skeleton` collection — legitimate absent-state assertions, not global counts. ✅
- Runtime-scenario queues: `getABClass` and `getYearGroups` are doubled for StrictMode; the single-entry reference-data queues are correct because those warm-up calls are deduplicated (React Query) and only fire once — proven by the stable green runs. No StrictMode "Unexpected call index" failures observed.

## 6. Out-of-scope

Pre-existing LSP `readonly-assignment` noise in `endToEndRuntimeMocks.ts` was ignored per instructions; it does not affect the E2E behaviour and the `applyColumnFilterOption` overload used by this suite is correct and safe.

---

## Conclusion

**CLEAN.** The GREEN-phase adjustments (heading scoping, `tbody tr.ant-table-row` targeting, direction-agnostic sort, loading-test completion) are all correct, robust, and preserve the original verification intent. The `getABClassPartials`/`getYearGroups`/fixture shapes render the class card and heatmap correctly. All seven tests pass deterministically. No in-scope issues remain.
