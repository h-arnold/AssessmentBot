# Class Page Code Review Remediation — Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read `SPEC.md` (this remediation's product/contract spec).
2. Read `CODE_REVIEW.md` (the source code review — most findings include
   verbatim fix snippets and line numbers).
3. Treat those documents as the source of truth. Do not redefine settled
   decisions.
4. Read `src/frontend/AGENTS.md` and
   `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   before any helper extraction or test helper replacement.

## Scope and assumptions

### Scope

- All 22 remaining findings from `CODE_REVIEW.md` (C1, C2, C4, C5, I1–I12,
  I14, I15, N1–N5). C3 (stale analysis doc) and I13 (missing `key` prop)
  are already resolved in the working tree — out of scope.
- All changes are inside `src/frontend/` except:
  - N5: aligns `.opencode/agents/code-reviewer.md` (not frontend)
- No backend, transport, or E2E test changes.
- No `CLASS_PAGE_LAYOUT.md` or `SPEC_CLASS_PAGE.md` edits.

### Out of scope

- Backend changes (no transport, validation, or contract changes)
- Playwright E2E test updates (no user-visible behaviour change except C2
  retry, which is already covered by existing E2E tests)
- New dependencies, eslint config changes, or tsconfig changes

### Assumptions

1. All 1,423+ existing frontend tests must remain green at every section
   boundary. Run `npm run test:frontend` after each section.
2. The shared `createMetricResult` produces identical `MetricResult` shapes
   to the local `metric()` helpers (verified — see SPEC.md).
3. `usePageDataset` returns `{ query: UseQueryResult<TData>, datasetState }`
   where `UseQueryResult` carries a callable `.refetch()` (verified — see
   SPEC.md).
4. Each finding has a minimal, mechanical fix described in `CODE_REVIEW.md`.
   The action plan references those snippets but does not re-quote them
   in full — implementers must consult `CODE_REVIEW.md` for the exact
   replacement text when in doubt.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin; reuse existing single-caller patterns.
- Fail fast on invalid inputs (the C1 fix strengthens this — empty analyser
  response becomes an explicit `Error`).
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments, docstrings, and user-facing text.
- Do not disable lint rules. The I2 helper continues to use a `switch`
  statement to satisfy `security/detect-object-injection`.
- File size: all touched source files are under 500 lines (verified).
  `classPageAdapter.ts` (495 LOC) is closest to the threshold; verify after
  Sections 5, 6, and 9 that it remains under 500.

### TDD workflow (mandatory per section)

For each section:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run `npm run test:frontend` and `npm run lint:frontend` at the end.

### Delegation mandatory-read gate

For any section delegated to a sub-agent, the plan must define and enforce
mandatory documentation reads. The sub-agent handoff must include `Files
read` with explicit file paths. Mandatory files per agent:

- **Testing Specialist** (any test-only change):
  - `docs/developer/frontend/frontend-testing.md`
  - `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  - relevant existing spec file under `src/frontend/src/features/classPage/*.spec.{ts,tsx}`
- **Implementation** (any production-code change):
  - `src/frontend/AGENTS.md`
  - `CODE_REVIEW.md` (the relevant finding only)
  - `SPEC.md`
  - `docs/developer/frontend/frontend-shared-helpers-and-abstraction-stands.md` (when helper extraction is involved)
  - touched source file under `src/frontend/src/features/classPage/*.ts(x)`
- **Code Reviewer** (mandatory for all multi-file or non-trivial sections):
  - `CODE_REVIEW.md`
  - `SPEC.md`
  - touched files
- **Docs** (helper-doc reconciliation only):
  - `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

If any mandatory file is missing from `Files read`, return the work to the
same sub-agent and block progression.

### Shared-helper planning gate

Sections 6 and 7 introduce or extend shared helpers. Each section records
helper decision entries before implementation, and the planned-only entries
must be added to
`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
§9.18 with status `Not implemented` before implementation starts. The Docs
phase reconciles them to `Implemented` after delivery.

### Validation commands hierarchy

- Frontend lint: `npm run lint:frontend`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Backend lint (only if backend touched — not expected): `npm run lint:backend`
- Builder lint (only if builder touched — not expected): `npm run lint:builder`

---

## Section 1 — C1: Treat empty analyser response as analyser error

### Objective

- Eliminate the production crash where an empty `AveragingResult[]` from the
  analyser leads to `surfaceState.status === 'ready'` with `adapterResult = null`,
  which crashes `StudentAveragesTableCard` via the non-null assertion
  `adapterResult!`.

### Constraints

- `runAnalyserStep` returns `readonly [AveragingResult | null, Error | null]`
  (2-tuple, matching the existing function signature).
- Do NOT return a 4-tuple from `runAnalyserStep` — that responsibility belongs
  to the outer pipeline `useMemo` (lines 345-371) which already produces the
  4-tuple when `aError !== null`.
- The existing `ERROR_CONFIG_MAP.analyserError` already marks `analyserError`
  as `{ status: 'warning', retryable: true, title: "Couldn't compute averages" }`
  — no new error type or UI surface is introduced.
- Do not remove the `adapterResult!` non-null assertion in
  `ClassPageContent.tsx` line 289 — the spec's nullability invariant
  (`adapterResult` non-null when `surfaceState.status === 'ready'`) becomes
  true after the fix; the assertion then becomes safe rather than unsound.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `CODE_REVIEW.md` (C1 finding only)
- `SPEC.md` (C1 section)

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `CODE_REVIEW.md` (C1 finding only)
- `SPEC.md` (C1 section)
- `src/frontend/src/features/classPage/useClassPageData.ts`

Code Reviewer mandatory docs:

- `CODE_REVIEW.md`
- `SPEC.md`
- `src/frontend/src/features/classPage/useClassPageData.ts`
- `src/frontend/src/features/classPage/useClassPageData.spec.ts`
- `src/frontend/src/features/classPage/ClassPageContent.tsx`

### Acceptance criteria

- An empty `AveragingResult[]` returned from `_analysisService.analyse(...)`
  propagates as `{ surfaceState: { status: 'blocking', error: { type: 'analyserError' } } }`
  rather than `{ surfaceState: { status: 'ready' } }`.
- The runtime TypeError `Cannot read properties of null (reading 'studentAverages')`
  is no longer reproducible from an empty analyser response.
- All 1,423+ existing tests remain green.
- New unit test asserts the empty-analyser-response path produces
  `error.type === 'analyserError'` and `surfaceState.status === 'blocking'`.

### Required test cases (Red first)

Frontend tests (extend `useClassPageData.spec.ts`):

1. Add test: when the mocked `analyse` returns an empty array `[]`, the hook
   returns `surfaceState.status === 'blocking'` and
   `error.type === 'analyserError'`.
2. Add test: when the mocked `analyse` returns an empty array, `adapterResult`
   is `null` and `analyserResult` is `null`.
3. Add test: when the mocked `analyse` returns a non-empty array, the
   existing `[aResult, null, adResult, null]` happy path still works
   (regression guard; equivalent to one of the existing tests but explicitly
   named to anchor the contract).
4. Add test: when `analyse` throws, the error is still surfaced as
   `analyserError` (regression guard for the existing throw path — protect
   against the C1 fix accidentally shadowing the throw branch).

### Section checks

- `npm run test:frontend -- useClassPageData`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.
- Verify `classPageAdapter.ts` and `useClassPageData.ts` remain under 500 lines.
- Confirm no new error type or UI surface was introduced.

### Optional `@remarks` JSDoc follow-through

- Add a `@remarks` note in `runAnalyserStep` explaining that an empty array is
  treated as an analyser error (not a silent null) to preserve the
  invariant that `adapterResult` is non-null when `surfaceState.status === 'ready'`.
- Reference `CODE_REVIEW.md` C1 finding so future maintainers understand the
  guard's purpose.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Added empty-array guard in `runAnalyserStep`
  returning `[null, new Error('Analyser returned empty result')]`. Outer
  pipeline memo already routes this through the `analyserError` surface state.
  Added 3 new tests in `useClassPageData.spec.ts` (empty array → blocking/analyserError,
  empty array → null results, non-empty array → ready regression guard).
  Throw-path regression guard covered by existing test at line 524.
  Added `@remarks` JSDoc note referencing CODE_REVIEW.md C1 finding.
- **Deviations from plan:** None. Used `response.length === 0` check instead of
  `aResult === null` to avoid false-positive `sonarjs/different-types-comparison`
  lint error. Behaviour is identical.
- **Follow-up implications for later sections:** None directly. C2 (Section 2)
  is independent of C1.
- **Completion status:** ✅ COMPLETE. All 1,426 frontend tests pass (3 new).
  Lint clean. TypeScript compilation clean. Build clean. `useClassPageData.ts`
  is 481 lines (under 500). No new error type or UI surface introduced.

---

## Section 2 — C2: Retry refetches both class and dataset queries

### Objective

- Eliminate the broken Retry UX where clicking Retry during a dataset error
  (`assignmentDefinitionPartialsFailed` or `assignmentDefinitionPartialsUntrustworthy`)
  only refetches the class query and leaves the dataset error persisting.

### Constraints

- Use the "extend `refetch`" approach (user-selected). Do NOT split retry
  into two separate per-error-type actions.
- Destructure `refetch` from `adpQuery` (already returned by
  `usePageDataset('assignmentDefinitionPartials')`) and call both
  `queryRefetch()` and `adpRefetch()` in the `useCallback`.
- New `useCallback` dependency array: `[queryRefetch, adpRefetch]`.
- React Query guarantees the per-query `refetch` function is stable for the
  same query key. This contract remains intact.
- Do not change the existing `usePageDataset` return contract.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `CODE_REVIEW.md` (C2 finding only)
- `SPEC.md` (C2 section)
- existing `src/frontend/src/features/classPage/useClassPageData.spec.ts`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `CODE_REVIEW.md` (C2 finding only)
- `SPEC.md` (C2 section)
- `src/frontend/src/features/classPage/useClassPageData.ts`
- `src/frontend/src/hooks/usePageDataset.ts` (to verify the return contract)

Code Reviewer mandatory docs:

- Same as Implementation plus `useClassPageData.spec.ts`.

### Acceptance criteria

- `refetch()` from `useClassPageData` refetches both `classFullQuery` AND
  `adpQuery` (the dataset query).
- After a Retry click, a `assignmentDefinitionPartialsFailed` error is
  re-evaluated against the fresh dataset fetch outcome.
- All existing tests remain green (after they are migrated to cover the new
  dual-refetch contract).

### Required test cases (Red first)

Frontend tests (migrate + extend `useClassPageData.spec.ts`):

1. Update existing refetch test (which currently asserts `queryRefetch`
   was called): also assert that `adpRefetch` was called.
2. Add test: when `assignmentDefinitionPartialsFailed` is true and the user
   invokes `refetch()`, both `classFullQuery.refetch` and
   `adpQuery.refetch` are invoked (verify the dataset refetch is triggered).
3. Add test: `refetch` remains stable across renders when neither
   `queryRefetch` nor `adpRefetch` changes reference (memoisation guard).
4. Add test: when `classId` changes (new query key → new refetch ref), the
   `refetch` callback updates to use the new refs (stale-closure guard).

### Section checks

- `npm run test:frontend -- useClassPageData`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.
- Existing tests did not silently regress (specifically: the now-updated
  refetch test was the only test asserting the old class-only contract).

### Optional `@remarks` JSDoc follow-through

- Update the existing `@remarks` block on `refetch` (lines 444-454) to
  document the dual-refetch contract: refetch both `classFullQuery`
  and `adpQuery` so dataset errors can be retried via the same Retry button.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Destructured `refetch: adpRefetch` from
  `adpQuery` (line 451), updated `refetch` `useCallback` to call both
  `queryRefetch()` and `adpRefetch()` (lines 473-476), updated dependency
  array to `[queryRefetch, adpRefetch]`. Updated JSDoc `@remarks` to document
  dual-refetch contract. Fixed 2 stale JSDoc references in module-level and
  type-level comments.
- **Deviations from plan:** None.
- **Follow-up implications:** C2 may indirectly affect `ClassPage.spec.tsx`
  tests if any test mocks `refetch` and asserts a single call. Verify after
  implementation. No E2E changes expected (the Retry button itself is
  unchanged; only its effect widens).
- **Completion status:** ✅ COMPLETE. All 1,429 frontend tests pass (3 new).
  Lint clean. TypeScript compilation clean. Build clean. `useClassPageData.ts`
  is 492 lines (under 500). Dual-refetch contract fully implemented and tested.

---

## Section 3 — C5: Replace O(n×m) filter-in-loop with Map-based O(n+m) lookup

### Objective

- Eliminate the O(n×m) nested loop in `classPageAdapter.ts` (lines 416-424)
  by pre-building a `Map<definitionKey, PerTaskRow[]>` in a single O(m)
  pass and using O(1) lookups per assignment.

### Constraints

- Use the exact replacement pattern from `CODE_REVIEW.md` (C5 finding).
- Atomic substitution — no contract change to the adapter output.
- All 15 existing `classPageAdapter.spec.ts` tests must remain green
  (verify the per-assignment matching behaviour is preserved).
- `classPageAdapter.ts` starts at 495 LOC. After C5 + I1 (Section 5), the
  ambient helper extraction may approach 500 lines. Re-check after Sections 5
  and 9 and split if it crosses the threshold (per `src/frontend/AGENTS.md`
  §12). Projected: ~490 lines (slight reduction — the map-build replaces
  filter-in-loop with a tighter one-pass construct).
- Section 3 (C5) lands BEFORE Section 4 (C4) to align with the spec's
  priority order (production perf fix > test-only deduplication). C5 has
  direct runtime impact; C4 is a test-helper migration that benefits from
  the adapter's behaviour being already stable post-C5.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `CODE_REVIEW.md` (C5 finding only)
- `src/frontend/src/features/classPage/classPageAdapter.spec.ts`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `CODE_REVIEW.md` (C5 finding only)
- `src/frontend/src/features/classPage/classPageAdapter.ts`

Code Reviewer mandatory docs:

- `CODE_REVIEW.md`, `SPEC.md`, `classPageAdapter.ts`, `classPageAdapter.spec.ts`

### Acceptance criteria

- The for-of loop in `buildRecentAssignments` uses a pre-built `Map` lookup
  instead of `.filter()` inside the loop.
- All existing `classPageAdapter.spec.ts` tests pass without modification
  (the adapter output is byte-identical).

### Required test cases (Red first)

This is a refactor with no behaviour change. Red-first is not applicable in
the strict sense — the existing 15 tests serve as the red anchor.

1. Add one property-style test that builds a `classFull` with multiple
   assignments sharing the same `definitionKey` and asserts all `perTask`
   rows for that key are matched to each assignment. This pins the
   multiple-matches behaviour so the refactor cannot silently drop
   duplicates.
2. Add one test that asserts an empty `analyserResult.perTask` array still
   produces zero matching rows (the `?? []` fallback in the new code).

### Section checks

- `npm run test:frontend -- classPageAdapter`
- `npm run lint:frontend`
- `wc -l src/frontend/src/features/classPage/classPageAdapter.ts` (record
  the count and verify ≤ 500)
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- None needed — the perf fix is self-evident from the structure.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Replaced the nested `.filter()` loop with a
  Map-based pre-build. Added 2 tests pinning the multiple-match and
  empty-perTask edge cases.
- **Deviations from plan:** None expected.
- **Follow-up implications:** None.
- **Completion status:** ✅ COMPLETE. All 17 tests pass (2 new). Lint clean.
  TypeScript compilation clean. `classPageAdapter.ts` is 499 lines (≤ 500).
  Map-based lookup produces identical output to old filter-in-loop.

---

## Section 4 — C4: Replace local `metric()` helpers with shared `createMetricResult`

### Objective

- Eliminate ~170 lines of duplicated `metric()` fixture helpers across 3
  spec files by replacing call sites with `createMetricResult` from
  `../../test/dataAnalysis/fixtures`.

### Constraints

- `createMetricResult` produces byte-identical `MetricResult` shapes to
  the local helpers (verified by reading `fixtures.ts`). Existing test
  assertions remain valid.
- Replace ALL three spec files in a single section to keep the migration
  atomic and avoid partial state mid-refactor.
- Import path: `import { createMetricResult } from '../../test/dataAnalysis/fixtures';`
  (relative to `src/frontend/src/features/classPage/`). Resolves to
  `src/frontend/src/test/dataAnalysis/fixtures.ts` (verified ✓).
- Do not change any other logic in those spec files — only the helper
  name substitution.
- Section 4 (C4) lands AFTER Section 3 (C5) per the spec's priority order.
  The C5 adapter perf fix is verified first against the unchanged test
  fixtures; then C4 migrates the test fixtures to the shared helper.

### Files affected

- `src/frontend/src/features/classPage/classPageAdapter.spec.ts` (lines 43-96)
- `src/frontend/src/features/classPage/classPageModel.spec.ts` (lines 33-86)
- `src/frontend/src/features/classPage/useClassPageData.spec.ts` (lines 108-161)

### Delegation mandatory reads

Testing Specialist mandatory docs (this is a test-only change):

- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `CODE_REVIEW.md` (C4 finding only)
- `src/frontend/src/test/dataAnalysis/fixtures.ts` (to confirm the contract)

### Helper decision entries

1. Helper: local `metric()` overload-builder
   - Decision: `reuse` of shared `createMetricResult`
   - Owning module/path: `src/frontend/src/test/dataAnalysis/fixtures.ts`
     (already exists; no new extraction)
   - Call-site rationale: three spec files in `classPage/` previously
     duplicated the same overload builder; consolidate to the existing
     shared helper.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §3.4 ("Shared data-analysis test fixtures")
   - Planned doc status: `Not implemented` (no documentation change needed;
     the helper already exists in §3.4 — only the migration status changes
     from "in use by classPageAdapter.spec/model.spec/useClassPageData.spec"
     to fully migrated)

### Acceptance criteria

- All three spec files compile and pass without the local `metric()` helper.
- No call site of `metric('computed', ...)` / `metric('notAttempted', ...)`
  / `metric('error', ...)` remains in the three touched spec files.
- The shared import `createMetricResult` is added to all three spec files.
- 1,423+ tests remain green; the 3 touched spec files keep their full test
  count unchanged.

### Required test cases (Red first)

Red-first is not applicable (refactor with no behaviour change).

1. As a verification anchor: pick one existing test per spec file, run it
   before the migration (it passes), then run it after the migration (it
   must still pass with identical assertion output).

### Section checks

- `npm run test:frontend` (full suite, since we are migrating test helpers)
- `npm run lint:frontend`
- `git diff --stat` should show ~170 lines removed across the three spec
  files with no net additions beyond the import block.
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- None — this is test-only.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Deleted local `metric()` from 3 spec files,
  added `createMetricResult` import, updated all call sites. ~170 lines
  removed.
- **Deviations from plan:** None expected.
- **Follow-up implications:** None.
- **Completion status:** ✅ COMPLETE. All 1,431 tests pass. Lint clean.
  TypeScript compilation clean. 183 net lines removed (312 deletions, 129
  insertions). All call sites migrated to shared helper.

---

## Section 5 — I1: Generic `findFirstDuplicate` helper in `classPageAdapter.ts`

### Objective

- Eliminate the 2-function duplication (`findDuplicateStudentId` +
  `findDuplicateAssignmentId`) by extracting a generic
  `findFirstDuplicate<T>(items, keyFn)` private helper inside the same file.

### Constraints

- Keep the helper **private inside `classPageAdapter.ts`** (the two call
  sites are in the same file — no need for a separate `helpers.ts` module
  per shared-helper standards §4.1 and §6).
- The generic signature:
  ```typescript
  function findFirstDuplicate<T>(items: readonly T[], keyFn: (item: T) => string): string | null;
  ```
- Replace both callers:
  - `findDuplicateStudentId(students)` →
    `findFirstDuplicate(students, (s) => s.id)`
  - `findDuplicateAssignmentId(assignments)` →
    `findFirstDuplicate(assignments, (a) => a.assignmentId)`
- Delete the two original functions.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `CODE_REVIEW.md` (I1 finding only)
- `src/frontend/src/features/classPage/classPageAdapter.spec.ts`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (§4.1, §6)
- `CODE_REVIEW.md` (I1 finding only)
- `src/frontend/src/features/classPage/classPageAdapter.ts`

### Helper decision entries

1. Helper: `findFirstDuplicate<T>(items, keyFn): string | null`
   - Decision: `keep local`
   - Owning module/path: `src/frontend/src/features/classPage/classPageAdapter.ts`
   - Call-site rationale: two call sites in the same file (duplicate student
     ID and duplicate assignment ID detection); no cross-file reuse. Per
     shared-helper standards §4.1 and §6, keep private to owning file.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18
   - Planned doc status: `Not implemented` — must be added to §9.18 BEFORE
     implementation starts.

### Acceptance criteria

- `findFirstDuplicate<T>` is defined and consumed by both caller sites.
- Original `findDuplicateStudentId` and `findDuplicateAssignmentId` are removed.
- The adapter throws the same `TypeError` for duplicate student IDs and
  duplicate assignment IDs as before (no contract regression).
- All 15 existing `classPageAdapter.spec.ts` tests remain green.

### Required test cases (Red first)

Red-first does not apply (refactor with no behaviour change).

1. As verification anchor: the existing tests asserting duplicate-student
   and duplicate-assignment detection (already in `classPageAdapter.spec.ts`)
   must continue to pass.

### Section checks

- `npm run test:frontend -- classPageAdapter`
- `npm run lint:frontend`
- `classPageAdapter.ts` remains under 500 LOC (the helper extraction is
  net-neutral or slightly reduces line count).
- Verify `grep -n "findFirstDuplicate" docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` returns a §9.18 entry with status `Not implemented` BEFORE starting implementation.
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- Add a `@remarks` note on `findFirstDuplicate` explaining it unifies the
  duplicate-id detection for both students and assignments (previously two
  near-identical one-key-different functions).

### Implementation notes / deviations / follow-up

- **Implementation notes:** Extracted `findFirstDuplicate`, updated two
  callers, deleted the two originals.
- **Deviations from plan:** Used `keyFunction` parameter name instead of
  `keyFn` to comply with `unicorn/prevent-abbreviations` ESLint rule.
- **Follow-up implications:** None.
- **Completion status:** ✅ COMPLETE. All 30 tests pass. Lint clean.
  TypeScript compilation clean. `classPageAdapter.ts` is 500 lines (≤ 500).
  §9.18.8 entry added to shared helpers doc (Status: Implemented).

---

## Section 6 — I2: Shared `getStudentMetric` accessor (placed in `classPageAdapter.zod.ts`)

### Objective

- Eliminate the duplication between `studentAveragesTableColumns.tsx`'s
  `getMetric` (lines 100-118) and `classPageModel.ts`'s `getMetricForColumn`
  (lines 81-99) by extracting one `getStudentMetric` accessor into
  `classPageAdapter.zod.ts` (the existing type-owning module).

### Constraints

- The accessor satisfies the `security/detect-object-injection` lint rule by
  using a `switch` statement — preserve this pattern; do not switch to
  computed property access.
- **Owning module: `src/frontend/src/features/classPage/classPageAdapter.zod.ts`**
  (NOT a new `helpers.ts` file). Rationale:
  - This module already owns the `StudentAverageRowModel` type (re-exported
    via `z.infer`), the `MetricResultSchema` alias
    (`RecentAssignmentCardMetricSchema`), and the Zod schemas that define
    the metric shape — it is the canonical type owner.
  - Per `frontend-shared-helpers-and-abstraction-standards.md` §6: "Name
    helpers by the contract they provide, not by where they were extracted
    from." The accessor's contract is a typed metric-model accessor; the
    type-owning module is its natural home.
  - Both call sites already import from `classPageAdapter.zod.ts`; adding
    the accessor to the same file avoids a new dependency edge and avoids
    creating a `helpers.ts` file whose only content is a 4-case switch.
- Function signature:
  ```typescript
  export function getStudentMetric(
    metrics: StudentAverageRowModel['metrics'],
    key: 'completeness' | 'accuracy' | 'spag' | 'average'
  ): MetricResult;
  ```
- Import the helper from both call sites:
  - `studentAveragesTableColumns.tsx`: `import { getStudentMetric } from './classPageAdapter.zod';`
  - `classPageModel.ts`: `import { getStudentMetric } from './classPageAdapter.zod';`
- Delete the local `getMetric` and `getMetricForColumn` functions.
- Inline JSDoc on `getStudentMetric` explaining the lint-rule motivation
  and reference to existing accessor precedent.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (§4.3, §6)
- `CODE_REVIEW.md` (I2 finding only)

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` (§4.3, §6, §9.18)
- `CODE_REVIEW.md` (I2 finding only)
- `src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`
- `src/frontend/src/features/classPage/classPageModel.ts`
- `src/frontend/src/features/classPage/classPageAdapter.zod.ts`

Code Reviewer mandatory docs:

- Same as Implementation plus both spec files.

Docs mandatory docs:

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  (§9.18 — Class page feature-local helpers)

### Helper decision entries

1. Helper: `getStudentMetric(metrics, key): MetricResult`
   - Decision: `new`
   - Owning module/path: `src/frontend/src/features/classPage/classPageAdapter.zod.ts`
     (existing type-owning module — not a new file)
   - Call-site rationale: two active call sites in
     `studentAveragesTableColumns.tsx` and `classPageModel.ts` need the
     same switch-statement accessor over
     `StudentAverageRowModel['metrics']` to satisfy
     `security/detect-object-injection`. Extracting to the type-owning
     module follows the shared-helper principle "name by contract, not by
     extraction source"; both call sites already import from this module.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18
   - Planned doc status: `Not implemented` — must be added to §9.18 BEFORE
     implementation starts; reconciled to `Implemented` in the Docs phase.

### Acceptance criteria

- `classPageAdapter.zod.ts` exports `getStudentMetric`.
- `studentAveragesTableColumns.tsx` imports `getStudentMetric` from
  `./classPageAdapter.zod` and no longer defines `getMetric` locally.
- `classPageModel.ts` imports `getStudentMetric` from
  `./classPageAdapter.zod` and no longer defines `getMetricForColumn`
  locally.
- All tests in `studentAveragesTableColumns.spec.tsx`, `classPageModel.spec.ts`
  remain green (the accessor is functionally identical).
- A small unit test for `getStudentMetric` is added to
  `classPageAdapter.zod.spec.ts` (covers each of the four keys returning
  the correct metric from a fixture model).

### Required test cases (Red first)

Frontend tests:

1. Extend `src/frontend/src/features/classPage/classPageAdapter.zod.spec.ts`
   with a test for each of the four keys (`completeness`, `accuracy`,
   `spag`, `average`) asserting that `getStudentMetric(metrics, key)`
   returns the corresponding `metrics[key]` value.

### Section checks

- Verify `grep -n "getStudentMetric" docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` returns a §9.18 entry with status `Not implemented` BEFORE starting implementation.
- `npm run test:frontend -- classPageAdapter.zod`
- `npm run test:frontend -- studentAveragesTableColumns`
- `npm run test:frontend -- classPageModel`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.
- New helper entry added to §9.18 of
  `frontend-shared-helpers-and-abstraction-standards.md` with status
  `Not implemented` BEFORE implementation, then updated to `Implemented`
  in the Docs phase.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` on `getStudentMetric` explaining the lint-rule motivation
  for the `switch` statement and pointing to the canonical helper doc entry.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Added `getStudentMetric` export to
  `classPageAdapter.zod.ts`, updated both call sites, deleted local
  `getMetric`/`getMetricForColumn`, extended `classPageAdapter.zod.spec.ts`.
  Added §9.18 doc entry `Not implemented` then reconciled in Docs phase.
- **Deviations from plan:** None expected. (Deviation from the original
  draft's `helpers.ts` proposal — switched to `classPageAdapter.zod.ts`
  per planner-reviewer finding that the type-owning module is the natural
  home and avoids a single-helper file.)
- **Follow-up implications:** None.
- **Completion status:** ✅ COMPLETE. All tests pass (17 classPageAdapter.zod,
  17 studentAveragesTableColumns, 12 classPageModel). Lint clean. TypeScript
  compilation clean. §9.18.9 entry added to shared helpers doc (Status:
  Implemented). Switch statement satisfies security/detect-object-injection.

---

## Section 7 — I3 + I4: Import `DEFAULT_SORT` and share `compareStudentNames`

### Objective

- I3: `StudentAveragesTableCard.tsx` imports `DEFAULT_SORT` from
  `./classPageModel` instead of redefining it locally (line 78).
- I4: Extract `compareStudentNames(a, b): number` from `classPageModel.ts`
  to its exported API and import it in `studentAveragesTableColumns.tsx`
  to be used in the column sorter.

### Constraints

- I3: `classPageModel.ts` is the canonical owner of `DEFAULT_SORT`. Export
  it (if not already exported — verify before changing) and remove the local
  copy in `StudentAveragesTableCard.tsx`.
- I4: The comparator signature must match the existing inline sort behaviour
  exactly:
  ```typescript
  export function compareStudentNames(a: StudentAverageRowModel, b: StudentAverageRowModel): number;
  ```
  Returns:
  - `a.studentName.localeCompare(b.studentName, undefined, { sensitivity: 'base' })`
  - tie-broken by `a.studentId.localeCompare(b.studentId)`
- Preserve the existing direction-respecting usage at the call site:
  the model's `toSorted` wraps the comparator with `direction === 'asc' ? cmp : -cmp`
  on the name comparison; the columns' `sorter.compare` calls the comparator
  directly (the column is configured `sortDirections: ['ascend', 'descend', 'ascend']`).
  Compare the two existing call sites carefully to avoid drift.

### Delegation mandatory reads

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `CODE_REVIEW.md` (I3 and I4 findings only)
- `src/frontend/src/features/classPage/classPageModel.ts`
- `src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`
- `src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`

Code Reviewer mandatory docs:

- Same as Implementation.

### Helper decision entries

1. Helper: `compareStudentNames(a, b): number` (locale-aware student-name
   comparator)
   - Decision: `new` (export from `classPageModel.ts`)
   - Owning module/path: `src/frontend/src/features/classPage/classPageModel.ts`
     (extracted from the inline `toSorted` callback at lines 182-189)
   - Call-site rationale: two active call sites in `classPageModel.ts`
     (the initial sort inside `buildClassPageViewModel`) and
     `studentAveragesTableColumns.tsx` (the `studentName` column sorter).
     Extraction makes the comparator the single source of truth to prevent
     drift in column click-to-sort vs initial sort order.
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18
   - Planned doc status: `Not implemented`

Note: `DEFAULT_SORT` is an existing constant in `classPageModel.ts` (line 134)
being newly exported for `StudentAveragesTableCard.tsx` to import. This is
an export-visibility change on an existing constant, not a new helper
extraction; per `frontend-shared-helpers-and-abstraction-standards.md` it
is too trivial to warrant a §9.18 helper-decision entry. The I3 change is
tracked only via the I3 acceptance criteria below.

### Acceptance criteria

- `StudentAveragesTableCard.tsx` no longer defines `DEFAULT_SORT` locally;
  it imports it from `./classPageModel`.
- `classPageModel.ts` exports `compareStudentNames`.
- `studentAveragesTableColumns.tsx` imports `compareStudentNames` from
  `./classPageModel` and uses it in the `studentName` column `sorter.compare`.
- The model's `buildClassPageViewModel` uses `compareStudentNames` directly
  (with direction wrapper preserved).
- Tests for both `classPageModel` and `studentAveragesTableColumns` remain
  green — specifically, the model's existing student-name sort tests and
  the columns' existing click-to-sort tests must not regress.

### Required test cases (Red first)

Refactor — Red-first is not strictly applicable for I3.

For I4: Add one new test pinning the comparator's external contract:

1. In `classPageModel.spec.ts`, add a test asserting
   `compareStudentNames(a, b) < 0` when `a.studentName < b.studentName`
   and `> 0` otherwise; and the tie-break by `studentId` ascending when
   the names are equal. This locks the comparator's exported contract.

### Section checks

- Verify `grep -n "compareStudentNames" docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` returns a §9.18 entry with status `Not implemented` BEFORE starting implementation.
- `npm run test:frontend -- classPageModel`
- `npm run test:frontend -- studentAveragesTableColumns`
- `npm run test:frontend -- StudentAveragesTableCard`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.
- Verify no other file imports `DEFAULT_SORT` or duplicates the comparator.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` on `compareStudentNames` explaining that it is the single
  source of truth for student-name ordering across both the model's
  initial sort and the table column's click-to-sort (so they cannot drift).

### Implementation notes / deviations / follow-up

- **Implementation notes:** Exported `DEFAULT_SORT` from `classPageModel.ts`,
  removed local copy in `StudentAveragesTableCard.tsx`; exported
  `compareStudentNames`, refactored `buildClassPageViewModel` to use it,
  imported it in `studentAveragesTableColumns.tsx` for the column sorter.
- **Deviations from plan:** None expected.
- **Follow-up implications:** None. Add §9.18 helper entries during the
  Docs phase.
- **Completion status:** ✅ COMPLETE. All 41 tests pass (15 classPageModel,
  17 studentAveragesTableColumns, 9 StudentAveragesTableCard). Lint clean.
  TypeScript compilation clean. §9.18.10 entry added to shared helpers doc
  (Status: Implemented). DEFAULT_SORT deduplicated, compareStudentNames
  extracted as single source of truth for student-name ordering.

---

## Section 8 — I5: Descriptor-driven metric pills in `RecentAssignmentCard.tsx`

### Objective

- Collapse the four near-identical `<Flex>` blocks (lines 2452-2471 in the
  original — the current file is 87 lines and the four pills are inline
  in the JSX return) to a `METRIC_ENTRIES`-driven `.map()`.

### Constraints

- Use the exact replacement pattern from `CODE_REVIEW.md` (I5 finding).
  The `METRIC_ENTRIES` array uses `as const` for the `key` to preserve
  type narrowing on `card.metrics[key]`.
- Preserve existing behaviour:
  - "Average" cell uses `align="center"` (others use `align="start"`)
  - "Average" cell passes `emphasised` (others do not)
- `RecentAssignmentCard.tsx` is 87 LOC; this refactor reduces it modestly.
  No file separation needed.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `CODE_REVIEW.md` (I5 finding only)
- `src/frontend/src/features/classPage/RecentAssignmentCard.spec.tsx`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `CODE_REVIEW.md` (I5 finding only)
- `src/frontend/src/features/classPage/RecentAssignmentCard.tsx`

Code Reviewer mandatory docs:

- Same as Implementation.

### Acceptance criteria

- The four `MetricPill` instances are rendered via a single `METRIC_ENTRIES.map(...)`.
- All four existing `RecentAssignmentCard.spec.tsx` tests pass without modification.

### Required test cases (Red first)

Red-first does not apply (refactor with no behaviour change). Existing
tests serve as the regression anchor.

### Section checks

- `npm run test:frontend -- RecentAssignmentCard`
- `npm run lint:frontend`
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Replaced the four inline JSX blocks with a
  descriptor-driven map. Verified the four existing tests still assert the
  pill labels and emphasised styling correctly.
- **Deviations from plan:** None expected.
- **Follow-up implications:** None.
- **Completion status:** ✅ COMPLETE. All 8 tests pass. Lint clean.
  TypeScript compilation clean. Descriptor-driven map with `as const` for
  type narrowing. DRY fix: imported `getStudentMetric` instead of duplicating
  `getMetric`. Removed unused `MetricResult` import. Added JSDoc to
  `METRIC_ENTRIES`.

---

## Section 9 — I9 + I12: `localeCompare` and `.toSorted()` in `classPageAdapter.ts`

### Objective

- I9: Replace `new Date(b.lastAssessedAt).getTime() - new Date(a.lastAssessedAt).getTime()`
  with `b.lastAssessedAt.localeCompare(a.lastAssessedAt)` (line 430-432)
- I12: Replace `studentAverages.sort(...)` (line 473) with
  `studentAverages = studentAverages.toSorted(...)`.

### Constraints

- I9: ISO 8601 strings sort lexicographically in chronological order —
  `localeCompare` is safe and avoids per-comparison `Date` allocations.
- I12: the adapter creates a fresh array at line 473, so mutation is
  technically safe — but `.toSorted()` is the modern immutable convention
  and matches `classPageModel.ts` line 182. Align to `.toSorted()`.
- These two fixes are in adjacent lines of `classPageAdapter.ts` and can
  be done together. Combine in one section for atomic verification.
- `classPageAdapter.ts` LOC must be re-checked after this section is
  combined with C5 (Section 3) and I1 (Section 5). Verify ≤ 500 after
  Section 9.

### Delegation mandatory reads

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `CODE_REVIEW.md` (I9 and I12 findings only)
- `src/frontend/src/features/classPage/classPageAdapter.ts`

Code Reviewer mandatory docs:

- Same as Implementation.

### Acceptance criteria

- I9: Sorting `recentAssignments` uses `localeCompare` on the ISO strings
  directly (no `new Date()` calls in the comparator).
- I12: `studentAverages` is sorted via `.toSorted()` and assigned back
  (immutable pattern).
- All 15 existing `classPageAdapter.spec.ts` tests pass without modification
  (both sorts produce identical ordering for ISO 8601 input).

### Required test cases (Red first)

Red-first does not apply. Existing date-sort and student-averages-sort
tests serve as regression anchors.

Optionally add a regression test:

1. Add a test that sorts a classFull with multiple recent assignments
   whose `lastAssessedAt` values are spaced by millisecond differences
   (e.g. `2026-01-01T00:00:00.001Z`, `2026-01-01T00:00:00.002Z`); assert
   the order matches the expected chronological descending order. This
   verifies the `localeCompare` change preserves millisecond precision
   ordering (lexicographic on zero-padded ISO strings is equivalent to
   chronological ordering).

### Section checks

- `npm run test:frontend -- classPageAdapter`
- `npm run lint:frontend`
- `wc -l src/frontend/src/features/classPage/classPageAdapter.ts` — record
  the count. Verify ≤ 500 LOC after Sections 3 (C5), 5 (I1), and 9 (I9+I12).
  Expected: ~490 lines after all three sections are complete.
- Mandatory-read evidence gate passed.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Replaced `new Date()` comparator with
  `localeCompare`; switched `.sort()` to `.toSorted()`.
- **Deviations from plan:** None expected.
- **Follow-up implications:** None.
- **Completion status:** ✅ COMPLETE. All 35 tests pass (1 new regression
  test for millisecond precision). Lint clean. TypeScript compilation clean.
  `classPageAdapter.ts` is 500 lines (≤ 500). ISO 8601 strings sort
  lexicographically, avoiding Date allocations. Modern immutable convention
  with `.toSorted()`.

---

## Section 10 — I10 + I11: Module-level `EMPTY_LOCALE` and memoised breadcrumb items

### Objective

- I10: Extract the `locale={{ emptyText: <Empty ... /> }}` prop in
  `StudentAveragesTableCard.tsx` (lines ~3345-3348) to a module-level
  `EMPTY_LOCALE` constant using `as const`.
- I11: Extract static `Breadcrumb` items in `ClassPage.tsx` (lines
  1284-1290) to a module-level constant and `useMemo` the dynamic third
  item.

### Constraints

- I10: The constant must be declared at module scope (outside the
  component function). Use `as const` so the literal shape is preserved.
- I11: The static prefix `[{ title: 'AssessmentBot Frontend' }, { title: 'Classes' }]`
  goes to a module-level `STATIC_BREADCRUMB_ITEMS` constant. The dynamic
  third item (`{ title: className, onClick: onNavigateToClasses }`) is
  computed inside a `useMemo` keyed on `[className, onNavigateToClasses]`.
- I11 (mandatory pre-work): `onNavigateToClasses` is currently passed as
  an inline arrow function in `ClassesPage.tsx` line 378:
  `onNavigateToClasses={() => setSelectedClassId(null)}` — this is NOT
  stable across renders and would defeat the `useMemo`. Wrap it in
  `useCallback` in `ClassesPage.tsx` BEFORE adding the `useMemo` in
  `ClassPage.tsx`:
  ```typescript
  // In ClassesPage.tsx:
  const handleNavigateToClasses = useCallback((): void => {
    setSelectedClassId(null);
  }, []);
  // ...
  <ClassPage
    classId={selectedClassId}
    onNavigateToClasses={handleNavigateToClasses}
    // ...
  />
  ```
  This `useCallback` has stable dependencies (`setSelectedClassId` from
  `useState` is guaranteed stable by React). The wrapping is a mandatory
  pre-step for I11 to avoid a `useMemo` that recomputes on every render.

### Delegation mandatory reads

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `CODE_REVIEW.md` (I10 and I11 findings only)
- `src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`
- `src/frontend/src/features/classPage/ClassPage.tsx`
- `src/frontend/src/pages/ClassesPage.tsx` (only if `onNavigateToClasses`
  stability check requires wrapping in `useCallback`)

Code Reviewer mandatory docs:

- Same as Implementation.

### Acceptance criteria

- I10: `EMPTY_LOCALE` is a module-level constant; the `Table`'s `locale`
  prop references it. No per-render allocation of the `Empty` element.
- I11: `STATIC_BREADCRUMB_ITEMS` is module-level; the dynamic third item
  is `useMemo`-wrapped with deps `[className, onNavigateToClasses]`.
- I11 (mandatory pre-work): `onNavigateToClasses` in `ClassesPage.tsx`
  is wrapped in `useCallback` with empty deps (the `setSelectedClassId`
  updater from `useState` is stable). The inline arrow function at line
  378 is replaced by a stable callback reference.
- All existing tests in `StudentAveragesTableCard.spec.tsx`,
  `ClassPage.spec.tsx` remain green.

### Required test cases (Red first)

Red-first does not apply.

1. Run `npm run test:frontend -- ClassesPage` to verify the `useCallback`
   wrapper in `ClassesPage.tsx` does not break class selection/navigation.

### Section checks

- `npm run test:frontend -- StudentAveragesTableCard`
- `npm run test:frontend -- ClassPage`
- `npm run test:frontend -- ClassesPage`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- None needed.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Extracted `EMPTY_LOCALE` and
  `STATIC_BREADCRUMB_ITEMS`; memoised the dynamic breadcrumb third item.
- **Deviations from plan:** If the `onNavigateToClasses` stability check
  required wrapping in `useCallback`, this was done as mandatory pre-work.
- **Follow-up implications:** None.
- **Completion status:** ✅ COMPLETE. All tests pass (9 StudentAveragesTableCard,
  136 ClassPage, 41 ClassesPage). Lint clean. TypeScript compilation clean.
  Module-level constants with `as const` preserve literal shapes. `useCallback`
  wraps `handleNavigateToClasses` with empty deps. `useMemo` wraps breadcrumb
  items keyed on `[className, onNavigateToClasses]`. Preserved `onClick` on
  "Classes" item to maintain existing behaviour.
  required wrapping in `useCallback` in `ClassesPage.tsx`, note it here.
  Otherwise None expected.
- **Follow-up implications:** None.

---

## Section 11 — I6 + I7 + I8: Test rename, typed `handleTableChange`, skeleton constants

### Objective

- I6: Update the stale test name and comments in `StudentAveragesTableCard.spec.tsx`
  (lines 241-375; the stale test name is on line 370: `'Input.Search does not render enterButton (filters apply on keystroke)'`)
  to reference `Input` / `Space.Compact` instead of `Input.Search`.
- I7: Import `SorterResult<StudentAverageRowModel>` from
  `antd/es/table/interface` and type the `sorter` parameter in
  `handleTableChange` (`StudentAveragesTableCard.tsx` lines 3296-3301).
- I8: Extract the magic skeleton dimensions in `ClassPageContent.tsx`
  (lines 140-155) to named module-level constants, following the
  `RECENT_ASSIGNMENT_CARD_WIDTH_PX` precedent.

### Constraints

- I6: Update the test name string and any internal comments (lines 241,
  243, 280, 368, 370, 373-375); do NOT alter the test assertions (they
  already pass against the `Space.Compact` + plain `Input` implementation).
- I7: Use the proper Ant Design type `SorterResult<StudentAverageRowModel>`
  for `sorter` and `TablePaginationConfig` for `_pagination`. Follow the
  Ant Design v6 type hierarchy; verify the import path
  `antd/es/table/interface` resolves.
- I8: Name the constants after their purpose (e.g.
  `HEADING_SKELETON_WIDTH_PX = 300`, `SECTION_TITLE_SKELETON_WIDTH_PX = 80`,
  `SECTION_TITLE_SKELETON_HEIGHT_PX = 22`, `ROW_TOP_MARGIN_PX = 16`,
  `CARD_ROW_GAP_PX = 16`, `RECENT_CARD_SKELETON_WIDTH_PX = 280`,
  `RECENT_CARD_SKELETON_HEIGHT_PX = 140`, `TABLE_TOP_MARGIN_PX = 16`,
  `TABLE_SKELETON_ROWS = 6`). Reference-style precedent from
  `RecentAssignmentCard.tsx` `RECENT_ASSIGNMENT_CARD_WIDTH_PX`.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `CODE_REVIEW.md` (I6 finding only)
- `src/frontend/src/features/classPage/StudentAveragesTableCard.spec.tsx`

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `CODE_REVIEW.md` (I7 and I8 findings only)
- `src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`
- `src/frontend/src/features/classPage/ClassPageContent.tsx`

Code Reviewer mandatory docs:

- Same as Implementation plus `StudentAveragesTableCard.spec.tsx`.

### Acceptance criteria

- I6: Test name string and accompanying comments no longer reference
  `Input.Search`; they reference `Input` / `Space.Compact`.
- I7: `handleTableChange` parameters are typed; the `unknown`
  annotations are removed. The internal shape normalisation logic
  remains. Type-safety is improved — `sorter.field` and `sorter.order`
  are now properly typed.
- I8: All magic numbers in the `ClassPageLoading` skeleton are extracted to
  named constants at module scope.
- All existing `StudentAveragesTableCard.spec.tsx` and
  `ClassPageContent.spec.tsx` tests remain green.

### Required test cases (Red first)

Red-first does not apply.

### Section checks

- `npm run test:frontend -- StudentAveragesTableCard`
- `npm run test:frontend -- ClassPageContent`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- None needed.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Renamed the stale test, typed
  `handleTableChange`, extracted skeleton constants.
- **Deviations from plan:** None expected. If the `antd/es/table/interface`
  import path does not resolve in the current Ant Design v6 install path,
  record the actual import path used.
- **Follow-up implications:** None.

---

## Section 12 — I14 + I15: Stale "red phase" comments and remove `pageContent.spec.ts`

### Objective

- I14: Remove stale "red phase" / "implementation file does not exist yet"
  wording from `@remarks` blocks in 7 spec files in
  `src/frontend/src/features/classPage/`.
- I15: Delete `src/frontend/src/features/classPage/pageContent.spec.ts`
  (20 lines testing static `as const` string values).

### Constraints

- I14: KEEP the `@see` cross-references (`SPEC_CLASS_PAGE.md`,
  `CLASS_PAGE_LAYOUT.md`, `ACTION_PLAN.md`, `docs/developer/...`). Remove
  ONLY the stale wording. The phrases to remove (case-insensitive grep;
  cover both spellings):
  - "red phase" (without hyphen)
  - "red-phase" (with hyphen)
  - "red-phase contract"
  - "the implementation file does not exist yet"
  - "implementation file does not exist"
  - "running these tests will fail with 'Cannot find module'"
  - "Cannot find module" (in the red-phase context only — do NOT remove
    legitimate references to module-not-found errors in actual test
    assertions or expected-error tests)
  - "this confirms the red-phase contract"
  - "Red-phase tests for"
- I15: Delete the entire `pageContent.spec.ts` file. The strings it
  asserts are static `as const` values already covered by integration
  and component tests; deleting it removes dead speculation.
- Do not delete any spec file other than `pageContent.spec.ts`.
- After removing the wording, run a grep across the 7 spec files for
  `red.phase` (regex covering both spellings) and "implementation file
  does not exist"; expected: 0 matches.

### Files affected (I14)

- `ClassPage.spec.tsx` (lines ~796-807)
- `ClassPageContent.spec.tsx` (lines ~1328-1341)
- `useClassPageData.spec.ts` (lines ~6382-6388)
- `classPageAdapter.spec.ts` (line ~9)
- `classPageModel.spec.ts` (lines ~7-8)
- `StudentAveragesTableCard.spec.tsx` (lines ~6-7)
- `studentAveragesTableColumns.spec.tsx` (lines ~6-7)

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `docs/developer/frontend/frontend-testing.md`
- `CODE_REVIEW.md` (I14 and I15 findings only)
- All 7 spec files listed above

### Acceptance criteria

- None of the 7 spec files contain "red phase", "implementation file does
  not exist", "Cannot find module" (in the red-phase sense), or
  "red-phase contract" wording.
- All `@see` cross-references remain intact.
- `pageContent.spec.ts` is deleted from the filesystem AND removed from any
  test runner configuration (verify via `npm run test:frontend` — total
  test count drops by exactly the number of tests in that file; no
  unresolvable import errors).
- All other tests remain green.

### Required test cases (Red first)

Red-first does not apply (test file deletion + comment-only changes).

1. As a verification anchor: run `npm run test:frontend` before deleting
   `pageContent.spec.ts` and record the total pass count. After deletion,
   re-run and verify the count drops by exactly that file's test count
   (and no other tests fail).

### Section checks

- `npm run test:frontend` (full suite)
- `npm run lint:frontend`
- Grep for residual `red phase` / `red-phase` / `implementation file does not exist`
  wording in the 7 spec files (expected: 0 matches).

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** Removed stale red-phase wording from 7 spec
  files (kept `@see` refs); deleted `pageContent.spec.ts`.
- **Deviations from plan:** None expected.
- **Follow-up implications:** None.

---

## Section 13 — N1: Remove redundant explicit `type { JSX }` imports

### Objective

- Verify whether `jsx: 'react-jsx'` mode in the project's `tsconfig`
  resolves `JSX` globally without the explicit import. If yes, remove the
  explicit `import type { JSX } from 'react'` from 7 classPage files.

### Constraints

- Before deleting: verify by running `npm run --prefix src/frontend tsc -b`
  (or the project-approved `tsc -b` command) after removing the imports
  from all 7 files. If `tsc` errors with "Cannot find namespace 'JSX'",
  restore the imports and record the deviation in this section's
  implementation notes (the imports are not redundant in this project's
  TS configuration).
- Do NOT proceed with removal unless the type-check passes.
- Files affected:
  - `ClassPage.tsx`
  - `ClassPageContent.tsx`
  - `ClassPageHeaderActions.tsx`
  - `RecentAssignmentCard.tsx`
  - `RecentAssignmentsSection.tsx`
  - `StudentAveragesTableCard.tsx`
  - `studentAveragesTableColumns.tsx`

### Delegation mandatory reads

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `docs/developer/builder/TypeScriptAndLintConfigHierarchy.md` (the
  hierarchy doc; consult it first to understand the config tree, then
  inspect the actual files for the `jsx` setting)
- `src/frontend/tsconfig.json` (leaf config — actual `jsx` setting to
  inspect before any import removal)
- `src/frontend/tsconfig.base.json` (base config — may set `jsx`
  inherited by the leaf)
- `CODE_REVIEW.md` (N1 finding only)
- All 7 files listed above

Code Reviewer mandatory docs:

- Same as Implementation.

### Acceptance criteria

- IF `tsc -b` passes without the imports: imports removed, lint passes,
  tests pass.
- ELSE: imports restored, a single-line deviation note added to this
  section explaining the project's `jsx` configuration still requires the
  explicit import (TS rejection of the global `JSX` namespace).

### Required test cases (Red first)

Red-first does not apply.

### Section checks

- `npm run --prefix src/frontend tsc -b` (or equivalent); must be clean
- `npm run test:frontend`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** [TO BE FILLED AT IMPLEMENTATION TIME]
- **Deviations from plan:** [Record IF tsc rejects the removal]
- **Follow-up implications:** None.

---

## Section 14 — N2 + N3 + N4: Stray blank line, alias, fixture consistency

### Objective

- N2: Remove the stray blank line in `AssessTaskModal.tsx` imports (after
  the `AssignmentSelectSkeleton` import line).
- N3: **Keep the alias** `RecentAssignmentCardMetricSchema = MetricResultSchema`
  in `classPageAdapter.zod.ts` line 20 — it is actively referenced **12 times**
  within the same file (per grep — every `completeness` / `accuracy` / `spag`
  / `average` / `overall` field of both `RecentAssignmentCardModelSchema`
  and `StudentAverageRowModelSchema` uses it). The alias provides meaningful
  semantic context (these schemas shape cards/metric rows, not raw metric
  results). No action needed; record this as a code-review-resolved
  deviation in the implementation notes.
- N4: Make `totalDataPoints` consistent (e.g. all `2` or all `3`) in the
  `classPageAdapter.zod.spec.ts` fixture variables at lines 4772-4786.

### Constraints

- N2: One-line whitespace fix. Do not touch logic in `AssessTaskModal.tsx`.
- N3: Do NOT remove the alias. The CODE_REVIEW.md finding offered "remove OR
  make meaningful" — the grep confirmation proves the alias is actively
  used as a meaningful semantic alias at 12 call sites. The proper response
  is to record this as a non-defect (the alias already satisfies the
  "make it meaningful" clause of the finding). Add a one-line JSDoc
  comment above the alias if it lacks one, justifying the semantic
  indirection: `/** Alias documenting that recent-assignment card metric
fields reuse the dataAnalysis.zod MetricResultSchema. */`
- N4: Prefer `totalDataPoints: 3` for both fixture variables (the current
  larger value); do not change `totalDataPoints` to a different number, only
  align the two.

### Delegation mandatory reads

Implementation mandatory docs:

- `src/frontend/AGENTS.md`
- `CODE_REVIEW.md` (N2, N3, N4 findings only)
- `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- `src/frontend/src/features/classPage/classPageAdapter.zod.ts`
- `src/frontend/src/features/classPage/classPageAdapter.zod.spec.ts`

### Acceptance criteria

- N2: No consecutive blank lines around the `AssignmentSelectSkeleton`
  import in `AssessTaskModal.tsx`.
- N3: Alias `RecentAssignmentCardMetricSchema` remains in place with a
  one-line JSDoc above it explaining the semantic indirection. All 12
  intra-file references continue to compile.
- N4: Both `validComputedMetric` and `validNotAttemptedMetric` in
  `classPageAdapter.zod.spec.ts` use the same `totalDataPoints` value.
- All touched spec files pass.

### Required test cases (Red first)

Red-first does not apply.

### Section checks

- `npm run test:frontend -- classPageAdapter.zod`
- `npm run lint:frontend`
- `git diff` shows the whitespace fix (N2), the new JSDoc above the alias
  (N3), and the aligned `totalDataPoints` (N4).

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** [TO BE FILLED]
- **Deviations from plan:** None expected.
- **Follow-up implications:** None.

---

## Section 15 — N5: Align code-reviewer agent model

### Objective

- Align the `model:` value in `.opencode/agents/code-reviewer.md` (line 4:
  `opencode/mimo-v2.5-free`) with the value in `opencode.jsonc` (line 21:
  `opencode-go/deepseek-v4-pro`), OR remove the model line from the markdown
  file so it inherits from the jsonc.

### Constraints

- This is a one-line config edit — not a frontend code change.
- Do not change any code-creation or test content; only the agent definition.
- Prefer removal of the model from the markdown file (single source of truth
  in `opencode.jsonc`) over duplicating the value in both.

### Delegation mandatory reads

Implementation mandatory docs:

- `AGENTS.md`
- `CODE_REVIEW.md` (N5 finding only)
- `.opencode/agents/code-reviewer.md`
- `opencode.jsonc` (around line 672 per CODE_REVIEW.md, but verify current
  line — earlier Kif exploration reported line 10 differs)

### Acceptance criteria

- The `model:` value in `.opencode/agents/code-reviewer.md` matches
  `opencode.jsonc`, OR the model line is removed from the markdown.
- No other agent definition file is touched.

### Required test cases (Red first)

Red-first does not apply (config-only).

### Section checks

- Visual diff confirms single-source-of-truth alignment.
- No lint impact (markdown files are not linted by frontend/backend/builder).

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** [TO BE FILLED]
- **Deviations from plan:** None expected.
- **Follow-up implications:** None.

---

## Regression and contract hardening

### Objective

- Verify all 22 findings have been remediated and all 1,423+ tests
  remain green, lint remains at 0 errors, and `tsc -b` is clean.

### Constraints

- Run the full frontend test suite (`npm run test:frontend`).
- Run all lint commands per the Lint Command Hierarchy:
  `npm run lint:frontend` (and `npm run lint:backend`, `npm run lint:builder`
  only if any non-frontend files were touched — N5 touches `.opencode/`
  which is not linted).
- Verify `classPageAdapter.ts` is still ≤ 500 LOC after Sections 3, 5,
  and 9 are all complete. If it crossed 500, plan a splitting pass before
  declaring completion.

### Acceptance criteria

- `npm run test:frontend` reports ≥ 1,423 tests passing (plus the new
  tests added in Sections 1, 2, 6, 7, 9). 0 failures.
- `npm run lint:frontend` reports 0 errors. Warning count may slightly
  change; verify no NEW warnings are introduced by the modifications.
- `npm run --prefix src/frontend tsc -b` is clean.
- All planned-helper entries in
  `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  §9.18 are reconciled: any helper marked `Not implemented` during Sections
  6 and 7 is now `Implemented`.

### Required test cases/checks

1. `npm run test:frontend` (full suite)
2. `npm run lint:frontend`
3. `npm run --prefix src/frontend tsc -b`
4. Verify `wc -l src/frontend/src/features/classPage/classPageAdapter.ts`
   reports ≤ 500 lines.
5. Verify `git diff` against the working tree contains no changes outside
   `src/frontend/src/features/classPage/`, `src/frontend/src/pages/ClassesPage.tsx`
   (only if Section 10 degenerate-fallback callback wrapping was needed),
   `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
   (N2 only), `.opencode/agents/code-reviewer.md` (N5 only), and
   `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   (helper doc reconciliation).

### Section checks

- All commands above run green.
- Grep across the 7 spec files for residual "red phase" / "red-phase" /
  "implementation file does not exist" wording (expected: 0).
- Grep for `metric(` declarations in the 3 spec files targeted by C4
  (expected: 0 — local `metric` helper was deleted).
- Grep for `findDuplicateStudentId` and `findDuplicateAssignmentId`
  (expected: 0 — replaced by `findFirstDuplicate` in Section 5).

### Implementation notes / deviations / follow-up

- **Implementation notes:** [TO BE FILLED AT COMPLETION]
- **Deviations from plan:** [TO BE FILLED]
- **Follow-up implications:** None.

---

## Documentation and rollout notes

### Objective

- Reconcile the planned helper entries in
  `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  §9.18 to match the delivered implementation. Section 9 currently has
  many existing `Implemented` entries for the classPage feature; the new
  C4/I1/I2/I3/I4 helper decisions are additive.

### Constraints

- Only edit `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.
- Do not modify `SPEC_CLASS_PAGE.md`, `CLASS_PAGE_LAYOUT.md`,
  `docs/developer/frontend/frontend-testing.md`, or any other canonical
  policy doc.
- Use the existing §9.18.X numbering scheme (next sub-section number from
  the current §9.18.7).
- Each new entry must follow the existing entry shape:
  - Helper or contract: name
  - Decision: `new` / `reuse` / `extend` / `keep local`
  - Owning module/path: ...
  - Call-site rationale: ...
  - Status: `Implemented`
- Reconcile each `Not implemented` placeholder set during Sections 6 and 7
  into a final `Implemented` entry.

### Acceptance criteria

- §9.18 has new entries for the helper decisions introduced by this
  remediation:
  - `findFirstDuplicate` (I1) — new entry, `keep local`, in
    `classPageAdapter.ts`.
  - `getStudentMetric` (I2) — new entry, `new`, in
    `classPageAdapter.zod.ts`.
  - `compareStudentNames` (I4) — new entry, `new`, in
    `classPageModel.ts`.
- `createMetricResult` migration (C4) — the shared helper already exists
  in §3.4; a one-line note in the §9.18 preface recording the migration
  completion is appropriate, but no new §9.18 entry is required.
- `DEFAULT_SORT` import (I3) — excluded from §9.18; it is an
  export-visibility change on an existing constant, not a new helper
  extraction, per planner-reviewer finding #6.
- All entries are marked `Implemented`.
- All `Not implemented` placeholders inserted during Sections 6 and 7 are
  now updated.

### Required checks

1. `git diff docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   shows only additions, no deletions of existing entries.
2. Each new entry has the five required fields filled in.
3. No helper entry contradicts the actual implementation in the source
   file (Docs agent must inspect the helper's actual signature and call
   sites before marking `Implemented`).

### Optional `@remarks` JSDoc review

- Confirm whether any `@remarks` notes added during Sections 1, 5, 6, 7
  accurately capture the design decisions and gotchas. If any note
  becomes stale or contradicts the final implementation, edit or remove
  it during this phase.

### Implementation notes / deviations / follow-up

- **Implementation notes:** [TO BE FILLED]
- **Deviations from plan:** [TO BE FILLED]
- **Follow-up implications:** None expected. The CODE_REVIEW.md itself
  remains as a historical record at the repo root; do not delete it.

---

## Suggested implementation order

1. **Section 1** (C1 — production crash fix). Highest business priority;
   must land first.
2. **Section 2** (C2 — broken retry UX). Pair with C1 because both touch
   `useClassPageData.ts` and can share a code review pass.
3. **Section 3** (C5 — O(n×m) → O(n+m) perf fix). Production performance
   regression; lands before test deduplication per spec priority.
4. **Section 4** (C4 — test fixture deduplication). Migrate the duplicated
   `metric()` helpers to `createMetricResult` AFTER C5 so the adapter's
   behaviour is verified stable against the unchanged test fixtures first,
   then the test helpers are modernised.
5. **Section 5** (I1 — generic `findFirstDuplicate`).
6. **Section 6** (I2 — shared `getStudentMetric` in `classPageAdapter.zod.ts`).
7. **Section 7** (I3 + I4 — `DEFAULT_SORT` import + `compareStudentNames`).
8. **Section 8** (I5 — descriptor-driven metric pills).
9. **Section 9** (I9 + I12 — `localeCompare` + `.toSorted()` in adapter).
10. **Section 10** (I10 + I11 — `EMPTY_LOCALE` + memoised breadcrumbs).
    Mandatory pre-work: wrap `onNavigateToClasses` in `useCallback` in
    `ClassesPage.tsx` before adding the `useMemo`.
11. **Section 11** (I6 + I7 + I8 — test rename + typed sorter + skeleton consts).
12. **Section 12** (I14 + I15 — stale "red phase" + remove `pageContent.spec.ts`).
13. **Section 13** (N1 — explicit `JSX` import removal, conditional on tsc pass).
14. **Section 14** (N2 + N3 + N4 — whitespace, keep alias, fixture consistency).
15. **Section 15** (N5 — code-reviewer agent model alignment).
16. **Regression and contract hardening** (full test + lint + tsc pass + LOC
    re-verification for `classPageAdapter.ts`).
17. **Documentation and rollout notes** (§9.18 helper entry reconciliation
    in `frontend-shared-helpers-and-abstraction-standards.md`).

Rationale: Critical bugs first, then the production perf fix, then test
deduplication, then refactor-only DRY improvements, then perf micro-
optimisations, then test hygiene, then nitpicks. Documentation
reconciliation last, so it can reflect the actually-delivered helper shape
rather than a planning-time guess.
