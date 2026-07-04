# Class Page Code Review Remediation Specification

## Status

- Draft v1.0

## Purpose

This document defines the intended behaviour changes for remediation of findings
from the 2026-07-04 comprehensive code review of the `feat/ClassPage` branch.

The changes will fix:

- a production crash trigger (C1)
- a broken retry UX (C2)
- duplicated code across source and test files (C4, I1–I5)
- an algorithmic performance regression (C5)
- stale test annotations and dead test files (I6, I14, I15)
- type-safety gaps and perf micro-inefficiencies (I7, I8, I9, I10, I11, I12)
- minor hygiene issues (N1–N5)

This document is **not** intended to:

- redesign the Class page surface or workflow
- add new features
- alter backend contracts or the transport boundary
- expand scope beyond the findings in `CODE_REVIEW.md`

## Agreed product decisions

1. **C2 fix approach**: Extend the single `refetch` callback to refetch both the
   class query and the dataset query. One Retry button retries everything. Do
   not split retry into two separate per-error-type actions in v1.

2. **Scope**: All 22 remaining unresolved findings from `CODE_REVIEW.md` are in
   scope (C3 and I13 are already resolved in the working tree).

3. **No layout spec**: None of these changes alter the Class page's component
   hierarchy, visible regions, workflow surfaces, or user-visible states. The
   existing `CLASS_PAGE_LAYOUT.md` and `SPEC_CLASS_PAGE.md` remain authoritative
   for product behaviour.

4. **British English** in all comments, JSDoc, and user-facing strings (existing
   policy, reaffirmed).

5. **No new dependencies**.

6. **Test suite must remain green** through all changes. Run
   `npm run test:frontend` and `npm run lint:frontend` after each section;
   1,423+ tests must pass with no regressions.

## Existing system constraints

### Backend or API constraints already in place

- No backend changes are required. The transport boundary (`src/frontend/src/services/apiService.ts`) is not touched.

### Current data-shape constraints

- `AveragingResult = AveragingResult[]` — the analyser returns an array (C1)
- `ClassPageAdapterResult` contains `recentAssignments`, `studentAverages`, `classMetrics` (C4/C5 context)
- `MetricResult` is a discriminated union with states `'computed'`, `'notAttempted'`, `'error'` (C4 context)
- `usePageDataset` returns `{ query: UseQueryResult<TData>, datasetState: PageDatasetState }` — the dataset query has a `.refetch()` method (C2 context)
- `StudentAverageRowModel.metrics` has keys `completeness`, `accuracy`, `spag`, `average` (I2 context)
- `StudentAverageRowModel` has fields `studentName: string` and `studentId: string` (I4 context)
- `RecentAssignmentCardModel.metrics` has keys `completeness`, `accuracy`, `spag`, `average` (I5 context)

### Frontend or consumer architecture constraints

- All source files are under 500 lines; no file separation is required
- `classPageAdapter.ts` is at 495 lines (closest to the threshold)
- Feature-local helpers stay in `src/frontend/src/features/classPage/`
- Shared test helpers for `MetricResult` already exist at
  `src/frontend/src/test/dataAnalysis/fixtures.ts` (`createMetricResult`)
- Zod-first validation policy remains in force
- Direct imports (no barrel files)
- `security/detect-object-injection` lint rule requires switch-statement accessors for computed property access (affects I2 approach)

## Feature architecture

### Placement

All changes stay within `src/frontend/src/features/classPage/`, except:

- I3: `DEFAULT_SORT` import path change from component to model
- I4: student-name comparator import path change from model to columns
- N1: JSX type import removal (if verified) across 7 files
- N5: agent model alignment in `.opencode/` (not frontend)

No new files are needed except a possible `classPage/helpers.ts` for the shared
`getStudentMetric` accessor (I2). The `findFirstDuplicate` generic helper (I1)
remains private inside `classPageAdapter.ts` — it has exactly two call sites
within the same file.

### Out of scope for this surface

- New classPage subfolders, barrel files, or reorganisation
- Changes to `CLASS_PAGE_LAYOUT.md` or `SPEC_CLASS_PAGE.md`
- Playwright E2E test changes (no user-visible behaviour change except C2 retry)

## Domain and contract recommendations

### Why this approach is preferable

- Each finding has a minimal fix described in `CODE_REVIEW.md` — no speculative
  re-architecture is needed
- The shared `createMetricResult` helper already exists and is in active use
  — switching the three spec files to it eliminates 170 lines of duplicated code
  without creating new infrastructure
- Feature-local KISS/DRY deduplication (I1–I5) stays within the owning feature,
  consistent with `frontend-shared-helpers-and-abstraction-standards.md` §4.4
- The O(n×m) to O(n+m) perf fix (C5) is a mechanical single-pass transformation
  with no contract changes

### Naming recommendation

- `findFirstDuplicate<T>(items: readonly T[], keyFn: (item: T) => string): string | null`
  replaces `findDuplicateStudentId` and `findDuplicateAssignmentId` (I1)
- `getStudentMetric(metrics, key)` replaces both `getMetric` and
  `getMetricForColumn` (I2)
- `compareStudentNames(a, b): number` replaces the duplicated inline sort in
  `classPageModel.ts` and `studentAveragesTableColumns.tsx` (I4)

### Validation recommendation

No new Zod schemas are required. Existing schemas (`classPageAdapter.zod.ts`,
`dataAnalysis.zod`) cover all types affected by these changes.

## Data loading and orchestration

### C1 — Analyser empty-array guard

**Change:** In `runAnalyserStep` (lines 190-212 of `useClassPageData.ts`), the
function currently does:

```typescript
return [response[0] ?? null, null];
```

After computing `aResult = response[0] ?? null`, the function must check whether
`aResult` is null (i.e. the analyser returned an empty array) and surface an
error instead of a silent null result:

```typescript
const aResult: AveragingResult | null = response[0] ?? null;
if (aResult === null) {
  return [null, new Error('Analyser returned empty result')];
}
return [aResult, null];
```

Note: `runAnalyserStep` returns `readonly [AveragingResult | null, Error | null]`
(a 2-tuple, matching the existing function signature). The 4-tuple
`[null, aError, null, null]` is produced by the outer pipeline `useMemo` at
lines 358-368 when it observes `aError !== null`. The 4-tuple form proposed in
`CODE_REVIEW.md` is incorrect for `runAnalyserStep`; the fix must return a
2-tuple from this inner function.

**Why:** An empty analyser response currently produces:

1. `runAnalyserStep` returns `[null, null]` (no result, no error)
2. The outer pipeline memo calls `runAdapterStep(null, classFull)` which returns
   `[null, null]` (no result, no error)
3. The pipeline memo returns `[null, null, null, null]`
4. `surfaceState` does not see `classQueryError`, `datasetError`, or
   `serviceError` (both errors are null), so it returns
   `{ status: 'ready' }}`
5. `ClassPageReady` passes `adapterResult!` (which is `null` at runtime)
   to `StudentAveragesTableCard`, crashing the page with
   `TypeError: Cannot read properties of null (reading 'studentAverages')`

With the fix, an empty `AveragingResult` becomes an `analyserError`, which
surfaces as `{ status: 'blocking', error: { type: 'analyserError' } }`. This
reuses the existing `ERROR_CONFIG_MAP.analyserError` config (already marked
`retryable: true`) — no new error type or UI surface is needed.

### C2 — Refetch both class and dataset queries

**Change:** The `refetch` callback in `useClassPageData.ts` (lines 442–457)
currently calls only `queryRefetch()` (the class query's refetch). Extend it to
also refetch the `assignmentDefinitionPartials` dataset query.

**Mechanism:** Destructure `refetch` from `adpQuery` (the `usePageDataset`
return's `query` property, which is a `UseQueryResult` carrying `.refetch()`)
and call both in the callback:

```
const { query: adpQuery } = usePageDataset('assignmentDefinitionPartials');
// ...
const { refetch: adpRefetch } = adpQuery;
const refetch = useCallback(() => {
  queryRefetch();
  adpRefetch();
}, [queryRefetch, adpRefetch]);
```

**Why:** The `ERROR_CONFIG_MAP` marks `assignmentDefinitionPartialsFailed` and
`assignmentDefinitionPartialsUntrustworthy` as `retryable: true`, but clicking
Retry currently only refetches the class query, leaving the dataset error
persisting. This makes the Retry button appear broken for dataset errors.

**Test impact:** `useClassPageData.spec.ts` must be updated to assert that
`refetch()` invokes both `queryRefetch` AND `adpRefetch`. Existing refetch
tests that only assert the class-query refetch must be extended (or migrated)
to cover the new dual-refetch contract. The `adpQuery.refetch` mock must be
spied on alongside the existing `classFullQuery.refetch` spy.

### Query or transport additions

None. No new API calls, query keys, or transport changes.

## Core view model or behavioural model

No view-model contract changes. The `ClassPageAdapterResult` shape,
`ClassPageViewModel` shape, and `ClassPageSurfaceState` discriminated union
remain unchanged. The C1 fix works within the existing `analyserError` state.

## Error, loading, and empty-state rules

### C1 change summary

| Before (bug)                                   | After (fix)                                               |
| ---------------------------------------------- | --------------------------------------------------------- |
| Empty `AveragingResult` → `adapterResult=null` | Empty `AveragingResult` → `status: 'blocking'`,           |
| + `status: 'ready'` → crash                    | `error.type: 'analyserError'` → `ClassPageBlocking` shown |

No change to `ERROR_CONFIG_MAP` — `analyserError` already has
`{ status: 'warning', title: "Couldn't compute averages", retryable: true }`.

The retryable flag already covers the new empty-response case: the user sees the
existing "Couldn't compute averages" Result with Retry + Back to Classes
buttons.

### C2 change summary

| Before (bug)                               | After (fix)                                               |
| ------------------------------------------ | --------------------------------------------------------- |
| Retry refetches only class query           | Retry refetches both class + dataset queries              |
| Dataset errors → Retry does nothing useful | Dataset errors → Retry potentially resolves the condition |

## Remaining Findings — Code-Level Only

The following findings are purely mechanical code improvements with no
behavioural, contract, or state-machine changes. They are listed here for
completeness but do not require spec-level decision recording.

### C4 — Replace local `metric()` helpers with shared `createMetricResult`

- **Files:** `classPageAdapter.spec.ts`, `classPageModel.spec.ts`,
  `useClassPageData.spec.ts`
- **Action:** Delete the local `metric()` function from each and replace all
  call sites with `createMetricResult` from `../../test/dataAnalysis/fixtures`
- **No behavioural change** — `createMetricResult('computed', { value: ... })`,
  `createMetricResult('notAttempted')`, `createMetricResult('error')` produce
  identical shapes

### C5 — O(n×m) to O(n+m) in `classPageAdapter.ts`

- **Action:** Pre-build a `Map<definitionKey, PerTaskRow[]>` in a single O(m)
  pass, then use O(1) lookups per assignment (see CODE_REVIEW.md for the
  exact replacement code)

### I1 — Generic `findFirstDuplicate` in `classPageAdapter.ts`

- **Action:** Extract to a private generic helper inside the same file, replace
  both `findDuplicateStudentId` and `findDuplicateAssignmentId` callers

### I2 — Shared `getStudentMetric` accessor

- **Action:** Extract the switch-statement from `studentAveragesTableColumns.tsx`
  (`getMetric`) into a function exported from a new `classPage/helpers.ts` (or
  from `classPageAdapter.zod.ts`). Replace both `getMetric` (columns) and
  `getMetricForColumn` (model) with the shared import.

### I3 — Import `DEFAULT_SORT` from model

- **Action:** `StudentAveragesTableCard.tsx` imports `DEFAULT_SORT` from
  `./classPageModel` instead of redefining it locally

### I4 — Shared `compareStudentNames` comparator

- **Action:** Export from `classPageModel.ts`; `studentAveragesTableColumns.tsx`
  imports and uses it in the sorter. The model's own `toSorted` call already
  uses the same logic; the comparator becomes the single source of truth.

### I5 — Descriptor-driven metric pills in `RecentAssignmentCard.tsx`

- **Action:** Replace the four repeated `<Flex>` blocks with a `METRIC_ENTRIES`
  array mapped in JSX (see CODE_REVIEW.md for the exact replacement)

### I6 — Stale test name referencing `Input.Search`

- **Action:** Update test name and comments in
  `StudentAveragesTableCard.spec.tsx` to reference `Input` / `Space.Compact`

### I7 — `handleTableChange` typed parameters

- **Action:** Import `SorterResult<StudentAverageRowModel>` from
  `antd/es/table/interface` and type the `sorter` parameter accordingly

### I8 — Named skeleton dimension constants

- **Action:** Extract magic numbers in `ClassPageContent.tsx` lines 140–155 to
  named constants (consistent with `RECENT_ASSIGNMENT_CARD_WIDTH_PX` precedent)

### I9 — Replace `new Date()` in sort with `localeCompare`

- **Action:** `recentAssignments.sort((a, b) => b.lastAssessedAt.localeCompare(a.lastAssessedAt))`
  instead of `new Date(b.lastAssessedAt).getTime() - new Date(a.lastAssessedAt).getTime()`

### I10 — Module-level `EMPTY_LOCALE` constant

- **Action:** Extract the `locale` prop object in `StudentAveragesTableCard.tsx`
  to a module-level constant

### I11 — Memoised `breadcrumbItems` in `ClassPage.tsx`

- **Action:** Extract static items to a module-level constant and `useMemo` the
  dynamic third item

### I12 — Replace `.sort()` with `.toSorted()`

- **Action:** `studentAverages.sort(...)` → `studentAverages = studentAverages.toSorted(...)`
  (line 473 of `classPageAdapter.ts`)

### I14 — Remove stale "red phase" `@remarks`

- **Files:** All 7 spec files listed in CODE_REVIEW.md
- **Action:** Remove wording like "the implementation file does not exist yet",
  "red phase", etc. from `@remarks` blocks. Keep `@see` cross-references.

### I15 — Remove `pageContent.spec.ts`

- **Action:** Delete `src/frontend/src/features/classPage/pageContent.spec.ts`
  (20 lines testing static `as const` string values)

### N1 — Remove explicit `type { JSX } from 'react'` if redundant

- **Action:** Verify whether `jsx: 'react-jsx'` resolves `JSX` globally; if so,
  remove the explicit `type { JSX }` imports from 7 files

### N2 — Stray blank line in `AssessTaskModal.tsx`

- **Action:** Remove the stray blank line

### N3 — Unnecessary alias in `classPageAdapter.zod.ts`

- **Action:** Remove `const RecentAssignmentCardMetricSchema = MetricResultSchema;`
  alias or make it meaningful

### N4 — Consistent `totalDataPoints` in test fixtures

- **Action:** Make `totalDataPoints` consistent in
  `classPageAdapter.zod.spec.ts` fixtures

### N5 — Align code-reviewer agent model

- **Action:** Align `.opencode/agents/code-reviewer.md` model line with
  `opencode.jsonc` or remove the model from the markdown file

## Testing expectations

- **Frontend unit tests**: Run `npm run test:frontend` — all 1,423+ tests must
  pass after each section. C1 and C2 require test updates (new test cases for
  the empty-analyser-response guard and the extended refetch callback). C4
  requires test migration (switching from local `metric()` to
  `createMetricResult` — existing test assertions should remain valid since
  `createMetricResult` produces identical shapes). I6 requires test name
  updates. All other changes are production-code only and must not break
  existing tests.
- **Lint**: Run `npm run lint:frontend` — 0 errors must be maintained.
- **No E2E changes**: No user-visible behaviour change except C2 (the retry
  button now actually retries dataset errors), which is covered by existing
  Playwright tests.

## Documentation and rollout notes

- Update `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  §9.18 (Class page feature-local helpers) with entries for the new I1–I5
  helper resolutions
- No `SPEC_CLASS_PAGE.md` or `CLASS_PAGE_LAYOUT.md` changes needed
- I14 `@remarks` cleanup affects spec-file-level comments only; no defensive
  documentation impact

## V1 scope recommendation

### Include in v1

All 22 remaining findings as listed in this spec, in the priority order:

1. C1 (null adapterResult crash fix)
2. C2 (refetch both queries)
3. C5 (O(n×m) → O(n+m) perf fix)
4. C4 (test fixture deduplication)
5. I1–I5 (KISS/DRY source deduplication)
6. I9–I12 (performance micro-optimisations)
7. I14 (stale "red phase" comments)
8. I15 (remove `pageContent.spec.ts`)
9. I6, I7, I8 (remaining improvements)
10. N1–N5 (nitpicks)

### Defer from v1

- None

## Open questions

None. All ambiguities have been resolved through the clarification loop.

## Planning handoff notes

- The action plan must order sections so C1 and C2 land before any refactoring
  — they are the only production-impact bugs
- C4 (test fixture deduplication) and test-file changes (I6, I14, I15) must
  be done with `npm run test:frontend` verification after each section
- I2 (shared `getStudentMetric`) introduces a new helper file
  (`classPage/helpers.ts`); the action plan must record it in the shared-helper
  docs as a planned-only entry before implementation
- I4 (shared `compareStudentNames`) and I3 (import `DEFAULT_SORT`) are
  intra-feature imports; no new files needed
- No file splitting is required (all files under 500 lines, `classPageAdapter.ts`
  at 495 after C5 and I1 keep it under threshold)
