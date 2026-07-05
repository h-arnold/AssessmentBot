# Comprehensive Code Review — `feat/ClassPage` Branch

**Review timestamp:** 2026-07-04
**Branch:** `feat/ClassPage` (vs current working tree)
**Scope:** 48 files changed, 7,341 additions, 102 deletions
**Reviewers:** De-sloppification agent + 4 code-review agents (bug, standards, KISS/DRY, performance)

---

## Automated Checks

| Check                 | Result                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint (frontend)       | **0 errors**, 16 warnings (2 in `classPageModel.ts` — magic number `2` as Map values; 14 pre-existing in `averagingAnalyser.accumulation.spec.ts`) |
| Lint (backend)        | **0 errors**, 14 pre-existing warnings                                                                                                             |
| Lint (builder)        | **0 errors**                                                                                                                                       |
| TypeScript (`tsc -b`) | **Clean**                                                                                                                                          |
| Tests                 | **121 test files, 1,423 tests passed, 0 failures**                                                                                                 |

---

## How to read this document

Each finding is assigned a severity:

- **Critical** — must be addressed before the feature is considered clean
- **Improvement** — should be addressed; non-blocking but important
- **Nitpick** — minor; address opportunistically

The first number in parentheses cross-references the agent that identified it:
(B) = Bug review, (S) = Standards review, (K) = KISS/DRY review, (P) = Performance review, (D) = De-sloppification review.

---

## Critical Findings

### C1 — Null `adapterResult` crashes when analyser returns empty array (B)

**File:** `src/frontend/src/features/classPage/useClassPageData.ts`, line 208
**Also:** `src/frontend/src/features/classPage/ClassPageContent.tsx`, line 2055 (non-null assertion)

**What happens:**

The pipeline guard at line 354 (`shouldRunPipeline`) passes, allowing the analyser to run. On line 358, `runAnalyserStep` is called, which calls `_analysisService.analyse(...)`. The `analyse()` method returns `DataAnalysisResponse = AveragingResult[]`. On line 208:

```typescript
return [response[0] ?? null, null];
```

If `analyse()` returns an **empty array** (possible when the filter `classIds: [classId]` matches no classes, or if a rare analyser edge case produces an empty result), `response[0]` is `undefined`, and `aResult` becomes `null`. No exception is thrown, so `aError` is also `null`.

Because there is no error, the pipeline proceeds to `runAdapterStep(aResult, classFull)` on line 364. Inside `runAdapterStep` (line 228), `analyserResult === null` → returns `[null, null]`.

The memo returns `[null, null, null, null]` — no analyser result, no adapter result, no errors.

The `surfaceState` computation (line 377) then finds:

- No query errors (classFull is valid)
- No dataset errors (dataset is ready + trustworthy)
- `computeServiceError(adapterError, analyserError)` → `null` (both null)
- Not loading (query and dataset are ready)

So **`surfaceState` becomes `{ status: 'ready' }`**, despite `adapterResult` being `null`.

Then in `ClassPageContent.tsx` line 2055:

```typescript
adapterResult={adapterResult!}
```

The non-null assertion suppresses TypeScript, but at runtime `adapterResult` is `null`. When `StudentAveragesTableCard` tries to access `adapterResult.studentAverages`, it crashes with:

> `TypeError: Cannot read properties of null (reading 'studentAverages')`

**Why this matters:** This violates the documented invariant that `adapterResult` is non-null when `surfaceState.status === 'ready'`. It causes a hard crash for the user instead of a graceful error state.

**Fix:** The pipeline should treat an empty analyser response as an analyser error. In `runAnalyserStep`, after line 208, add a check:

```typescript
if (aResult === null) {
  return [null, new Error('Analyser returned empty result'), null, null];
}
```

---

### C2 — Retry button only refetches class query; dataset errors never retried (B)

**File:** `src/frontend/src/features/classPage/useClassPageData.ts`, lines 442–457

**What happens:**

The `refetch` callback is defined as:

```typescript
const { refetch: queryRefetch } = classFullQuery;
const refetch: () => void = useCallback((): void => {
  queryRefetch();
}, [queryRefetch]);
```

This **only** refetches `classFullQuery` (the `getABClass` query). It does **not** refetch the `assignmentDefinitionPartials` dataset query.

The `ERROR_CONFIG_MAP` in `ClassPageContent.tsx` (line 1861) marks the following errors as `retryable: true`:

- `classQueryError` ✓ — refetching the class query may resolve this
- `analyserError` ✓ — refetching the class query triggers re-analysis, can resolve this
- `assignmentDefinitionPartialsFailed` ✗ — refetching the class query does nothing; the dataset query needs its own refetch
- `assignmentDefinitionPartialsUntrustworthy` ✗ — same as above; the dataset query needs its own refetch

For dataset errors, clicking **Retry** triggers a class query refetch while the dataset error persists. The surface state remains `blocking` with the same error. The user sees a brief flicker (as React Query transitions through pending state) and returns to the same error page. The Retry button appears to do nothing.

**Fix:** Either extend `refetch` to also refetch the dataset query, or split `refetch` into two separate actions (one for class query, one for dataset query) and show the appropriate retry button based on the current error type.

---

### C3 — Stale AI-generated analysis document committed as permanent project file (D)

**File:** `CLASS_PAGE_QUERY_ANALYSIS.md` (new file)

**Evidence:** The file opens with "Based on my analysis of the codebase, here's how the class page fetches and manages class data:" — unmistakably an LLM analysis output, not developer documentation. The file re-describes the architecture of `useClassPageData.ts`, React Query keys, retry configuration, and the retry button implementation in prose form, duplicating what the implementation's own JSDoc already covers.

**Why it matters:**

- It is **dead/stale code** — an agent-workflow artefact that should have been read during planning and discarded, not committed
- It **duplicates** the architecture explanation already present in the implementation's JSDoc and in `ACTION_PLAN.md`
- Generated-code tell: the conversational first-person style ("After my analysis", "Based on my analysis") is a classic LLM completion pattern
- It will inevitably rot: when `useClassPageData.ts` changes, nobody will update this file

**Fix:** **Delete the file.** All information it contains is already in `useClassPageData.ts` JSDoc, `ACTION_PLAN.md`, and the shared-helper documentation.

**Validator:** `rm CLASS_PAGE_QUERY_ANALYSIS.md`

---

### C4 — Copy-pasted `metric()` fixture helper across three spec files (D)

**Files:**

- `src/frontend/src/features/classPage/classPageAdapter.spec.ts` (lines 3400–3453)
- `src/frontend/src/features/classPage/classPageModel.spec.ts` (lines 5114–5167)
- `src/frontend/src/features/classPage/useClassPageData.spec.ts` (lines 6486–6539)

**Evidence:** All three files define an identically-structured `metric()` function with three JS overload signatures (`'computed'`, `'notAttempted'`, `'error'`) and the same `switch` body producing the same shapes. The shared `createMetricResult` in `src/frontend/src/test/dataAnalysis/fixtures.ts` already provides this exact capability and is used by other in-scope test files (`studentAveragesTableColumns.spec.tsx`, `RecentAssignmentCard.spec.tsx`, `StudentAveragesTableCard.spec.tsx`, `RecentAssignmentsSection.spec.tsx`) which import `createComputedMetricResult` etc.

**Why it matters:**

- **~170 lines of identical code** across three files
- **Generated-code tell** — the three overload signatures per file are a classic LLM pattern of re-deriving a helper from scratch in each test file rather than checking for shared fixtures
- Violates `src/frontend/AGENTS.md` which requires checking shared helpers before creating new abstractions

**Fix:** Delete the `metric()` function from all three spec files and replace all call sites with `createMetricResult('computed', { value: ... })` / `createMetricResult('notAttempted')` / `createMetricResult('error')` from `../../test/dataAnalysis/fixtures`.

**Validator:** After replacement, run `npm run test:frontend` — all 1,423 tests must still pass.

---

### C5 — O(n×m) nested loop via `.filter()` inside `for...of` (P)

**File:** `src/frontend/src/features/classPage/classPageAdapter.ts`, lines 416–424

```typescript
for (const assignment of classFull.assignments) {
  // ...
  const matchingPerTask = analyserResult.perTask.filter(
    (row) => row.definitionKey === assignment.assignmentDefinition.definitionKey
  );
  // ...
}
```

**Complexity analysis:** For each assignment (`n`), the code iterates over the entire `perTask` array (`m`) via `.filter()`. This is **O(n × m)**. A class with 30 assignments (each having ~10 tasks) does approximately 30 × 300 = 9,000 comparisons. A class with 100 assignments and 1,000 perTask entries would do 100,000 comparisons.

**Fix:** Pre-build a `Map<definitionKey, PerTaskRow[]>` in a single O(m) pass, then use O(1) lookups per assignment:

```typescript
const perTaskByDefinitionKey = new Map<string, AveragingResult['perTask']>();
for (const row of analyserResult.perTask) {
  const existing = perTaskByDefinitionKey.get(row.definitionKey);
  if (existing) {
    existing.push(row);
  } else {
    perTaskByDefinitionKey.set(row.definitionKey, [row]);
  }
}

for (const assignment of classFull.assignments) {
  validateUpdatedAt(rawUpdatedAt, assignment.assignmentId);
  const matchingPerTask =
    perTaskByDefinitionKey.get(assignment.assignmentDefinition.definitionKey) ?? [];
  recentAssignments.push(buildRecentAssignment(assignment, matchingPerTask, rawUpdatedAt));
}
```

This reduces overall complexity from **O(n × m) to O(n + m)**.

---

## Improvement Findings

### I1 — Duplicated duplicate-detection logic (K)

**File:** `src/frontend/src/features/classPage/classPageAdapter.ts`, lines 107–133

`findDuplicateStudentId` (line 107) and `findDuplicateAssignmentId` (line 124) contain identical logic — the only difference is the key-accessor (`s.id` vs `a.assignmentId`):

```typescript
function findDuplicateStudentId(students: ClassFull['students']): string | null {
  const seen = new Set<string>();
  for (const s of students) {
    if (seen.has(s.id)) return s.id;
    seen.add(s.id);
  }
  return null;
}

function findDuplicateAssignmentId(assignments: ClassFull['assignments']): string | null {
  const seen = new Set<string>();
  for (const a of assignments) {
    if (seen.has(a.assignmentId)) return a.assignmentId;
    seen.add(a.assignmentId);
  }
  return null;
}
```

**Fix:** Extract to a generic helper:

```typescript
function findFirstDuplicate<T>(items: readonly T[], keyFn: (item: T) => string): string | null {
  const seen = new Set<string>();
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return null;
}
```

Then replace both callers:

- `findDuplicateStudentId(students)` → `findFirstDuplicate(students, s => s.id)`
- `findDuplicateAssignmentId(assignments)` → `findFirstDuplicate(assignments, a => a.assignmentId)`

---

### I2 — Duplicated `getMetric` switch-statement across two files (K)

**Files:**

- `src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`, lines 100–118 (`getMetric`)
- `src/frontend/src/features/classPage/classPageModel.ts`, lines 79–97 (`getMetricForColumn`)

Both files contain an identical 4-case `switch` statement that accesses `metrics.completeness` / `metrics.accuracy` / `metrics.spag` / `metrics.average` from a `StudentAverageRowModel`. The only difference is the function name and parameter type annotation.

Both exist solely to satisfy the `security/detect-object-injection` lint rule.

**Fix:** Extract one shared accessor to a common location (either `classPageAdapter.zod.ts` or a new `classPage/helpers.ts`):

```typescript
export function getStudentMetric(
  metrics: StudentAverageRowModel['metrics'],
  key: 'completeness' | 'accuracy' | 'spag' | 'average'
): MetricResult {
  switch (key) {
    case 'completeness':
      return metrics.completeness;
    case 'accuracy':
      return metrics.accuracy;
    case 'spag':
      return metrics.spag;
    case 'average':
      return metrics.average;
  }
}
```

---

### I3 — Duplicated `DEFAULT_SORT` constant (K)

**Files:**

- `src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`, line 3224
- `src/frontend/src/features/classPage/classPageModel.ts`, line 134

`DEFAULT_SORT` is defined with the same shape and values in both files. The model (`classPageModel.ts`) is the canonical owner of the sort contract.

**Fix:** `StudentAveragesTableCard.tsx` should import the default from the model rather than redefine it:

```typescript
import { DEFAULT_SORT } from './classPageModel';
```

This prevents divergence between initial UI state and reset-on-clear-sort behaviour.

---

### I4 — Duplicated student-name sort logic in two files (K)

**Files:**

- `src/frontend/src/features/classPage/classPageModel.ts`, lines 182–189
- `src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`, lines 181–189

The same locale-aware, case-insensitive, `studentId`-tie-breaking student name sort appears in both:

1. The model's `buildClassPageViewModel` (`toSorted` call, line 182)
2. The column definition's `sorter.compare` (`buildStudentAveragesTableColumns`, line 178)

The current approach risks the table column's click-to-sort producing a different order than the model's initial sort, since the implementations could drift.

**Fix:** The model should export a reusable comparator:

```typescript
export function compareStudentNames(a: StudentAverageRowModel, b: StudentAverageRowModel): number {
  return (
    a.studentName.localeCompare(b.studentName, undefined, { sensitivity: 'base' }) ||
    a.studentId.localeCompare(b.studentId)
  );
}
```

Then `studentAveragesTableColumns.tsx` imports and uses it.

---

### I5 — Repetitive JSX in RecentAssignmentCard.tsx (K)

**File:** `src/frontend/src/features/classPage/RecentAssignmentCard.tsx`, lines 2452–2471

The four metric pills (Completeness, Accuracy, SpAG, Average) are rendered with nearly identical JSX:

```tsx
<Flex vertical align="start">
  <Typography.Text>Completeness</Typography.Text>
  <MetricPill metric={card.metrics.completeness} />
</Flex>
<Flex vertical align="start">
  <Typography.Text>Accuracy</Typography.Text>
  <MetricPill metric={card.metrics.accuracy} />
</Flex>
<Flex vertical align="center">
  <Typography.Text>Average</Typography.Text>
  <MetricPill metric={card.metrics.average} emphasised />
</Flex>
```

**Fix:** Collapse to a descriptor-driven map:

```typescript
const METRIC_ENTRIES = [
  { key: 'completeness' as const, label: 'Completeness' },
  { key: 'accuracy' as const, label: 'Accuracy' },
  { key: 'spag' as const, label: 'SpAG' },
  { key: 'average' as const, label: 'Average', emphasised: true },
];

// In JSX:
<Flex justify="space-around" style={{ marginTop: 12 }}>
  {METRIC_ENTRIES.map(({ key, label, emphasised }) => (
    <Flex key={key} vertical align={emphasised ? 'center' : 'start'}>
      <Typography.Text>{label}</Typography.Text>
      <MetricPill metric={card.metrics[key]} emphasised={emphasised} />
    </Flex>
  ))}
</Flex>
```

This reduces ~20 lines of JSX to ~6 and eliminates copy-paste error surface.

---

### I6 — Stale test description referencing `Input.Search` (S)

**File:** `src/frontend/src/features/classPage/StudentAveragesTableCard.spec.tsx`, line ~3122

The test name `'Input.Search does not render enterButton (filters apply on keystroke)'` and related comments reference `Input.Search`. The actual implementation uses `Space.Compact` + plain `Input` as a documented v6.3.1 workaround (see `StudentAveragesTableCard.tsx` `@remarks`). The test assertions are correct, but the naming is stale.

**Fix:** Update test name and comments to reference `Input` / `Space.Compact`.

---

### I7 — `handleTableChange` parameters typed as `unknown` (S)

**File:** `src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`, lines 3296–3301

```typescript
const handleTableChange = useCallback(
  (_pagination: unknown, _filters: unknown, sorter: unknown) => { ... },
  []
);
```

While the function internally normalises and checks the `sorter` shape, using `unknown` does not provide the type safety that Ant Design's `SorterResult<StudentAverageRowModel>` type would offer.

**Fix:** Import proper Ant Design types from `antd/es/table/interface`.

---

### I8 — Inline magic numbers in ClassPageContent.tsx skeleton (K)

**File:** `src/frontend/src/features/classPage/ClassPageContent.tsx`, lines 1907–1923

The `ClassPageLoading` skeleton hard-codes 12 magic dimensions:

| Value | Purpose                         |
| ----- | ------------------------------- |
| `300` | Heading skeleton width          |
| `16`  | Card section top margin         |
| `80`  | Section title skeleton width    |
| `22`  | Section title skeleton height   |
| `12`  | Card row top margin             |
| `280` | Individual card skeleton width  |
| `140` | Individual card skeleton height |
| `16`  | Table section top margin        |
| `6`   | Table paragraph rows count      |

The `RECENT_ASSIGNMENT_CARD_WIDTH_PX = 320` constant in `RecentAssignmentCard.tsx` sets a good precedent.

**Fix:** Extract to named constants.

---

### I9 — Redundant `new Date()` in sort comparator (P)

**File:** `src/frontend/src/features/classPage/classPageAdapter.ts`, lines 430–432

```typescript
recentAssignments.sort(
  (a, b) => new Date(b.lastAssessedAt).getTime() - new Date(a.lastAssessedAt).getTime()
);
```

**Analysis:** `Array.sort()` calls the comparator O(n log₂ n) times. Each call constructs two `new Date()` objects parsing ISO 8601 strings. For 30 assignments, this is ~300 `Date` allocations. ISO 8601 strings (`YYYY-MM-DDTHH:mm:ss.sssZ`) sort lexicographically in chronological order — the format was designed for this.

**Fix:** Use direct string comparison:

```typescript
recentAssignments.sort((a, b) => b.lastAssessedAt.localeCompare(a.lastAssessedAt));
```

---

### I10 — `locale` prop recreates object on every render (P)

**File:** `src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`, lines 3345–3348

```typescript
locale={{
  emptyText: <Empty description="No students match your search" />,
}}
```

Every render creates a new object literal and a new `<Empty>` React element. Ant Design's `Table` may re-evaluate its internal rendering of the empty state due to the changed reference.

**Fix:** Extract to a module-level constant:

```typescript
const EMPTY_LOCALE = {
  emptyText: <Empty description="No students match your search" />,
} as const;
```

---

### I11 — `Breadcrumb items` array recreated on every render (P)

**File:** `src/frontend/src/features/classPage/ClassPage.tsx`, lines 1284–1290

```typescript
<Breadcrumb
  items={[
    { title: 'AssessmentBot Frontend' },
    { title: 'Classes', onClick: onNavigateToClasses },
    { title: className },
  ]}
/>
```

**Fix:** Extract static items to a module-level constant and `useMemo` for the dynamic third item:

```typescript
const STATIC_BREADCRUMB_ITEMS = [
  { title: 'AssessmentBot Frontend' },
  { title: 'Classes' },
] as const;

// In component:
const breadcrumbItems = useMemo(
  () => [...STATIC_BREADCRUMB_ITEMS, { title: className, onClick: onNavigateToClasses }],
  [className, onNavigateToClasses]
);
```

---

### I12 — Mutating `.sort()` vs immutable `.toSorted()` (P)

**File:** `src/frontend/src/features/classPage/classPageAdapter.ts`, line 473

```typescript
studentAverages.sort((a, b) => { ... });  // mutates in place
```

Compare with `classPageModel.ts` line 182:

```typescript
studentAverages = studentAverages.toSorted((a, b) => { ... });  // immutable
```

While the adapter creates a fresh array so mutation is technically safe, the inconsistency creates a maintenance hazard.

**Fix:** Replace `.sort()` with `.toSorted()`.

---

### I13 — Missing `key` prop on `<ClassPage>` in `ClassesPage.tsx` (B)

**File:** `src/frontend/src/pages/ClassesPage.tsx`, line 376

```typescript
<ClassPage
  classId={selectedClassId}
  onNavigateToClasses={() => setSelectedClassId(null)}
/>
```

Currently safe because `selectedClassId` always goes through `null` between class changes. However, if a future feature adds class-to-class navigation without going through `null`, React would reuse the `ClassPage` component with stale internal state.

**Fix:** Add `key={selectedClassId}`.

---

### I14 — Stale "red phase" comments in test files (D)

**Files:**

- `src/frontend/src/features/classPage/ClassPage.spec.tsx` (lines 796–807)
- `src/frontend/src/features/classPage/ClassPageContent.spec.tsx` (lines 1328–1341)
- `src/frontend/src/features/classPage/useClassPageData.spec.ts` (lines 6382–6388)
- `src/frontend/src/features/classPage/classPageAdapter.spec.ts` (line 9)
- `src/frontend/src/features/classPage/classPageModel.spec.ts` (lines 7–8)
- `src/frontend/src/features/classPage/StudentAveragesTableCard.spec.tsx` (lines 6–7)
- `src/frontend/src/features/classPage/studentAveragesTableColumns.spec.tsx` (lines 6–7)

These `@remarks` blocks say "the implementation file does not exist yet" — but the implementation files do exist, committed alongside these tests in the same diff. The comments are now false.

**Fix:** Remove the stale "red phase" wording from all `@remarks` blocks. Keep the `@see` cross-references.

---

### I15 — `pageContent.spec.ts` tests static const values (D)

**File:** `src/frontend/src/features/classPage/pageContent.spec.ts`

This file tests that `pageContent.classDetail.heading === 'Class Overview'` etc. These are static TypeScript `as const` values — if they were wrong, TypeScript and consuming component tests would catch it. The file adds no behavioural coverage.

**Fix:** Remove the file. The string values are already verified by integration/component tests.

---

### I16 — `@ant-design/v5-patch-for-react-19` not introduced (S)

Verified: the patch package is correctly not imported anywhere in the new code. This is consistent with the project policy of not introducing unnecessary dependencies.

---

## Nitpick Findings

### N1 — Explicit `type { JSX } from 'react'` imports (D)

**Files:** `ClassPage.tsx`, `ClassPageContent.tsx`, `ClassPageHeaderActions.tsx`, `RecentAssignmentCard.tsx`, `RecentAssignmentsSection.tsx`, `StudentAveragesTableCard.tsx`, `studentAveragesTableColumns.tsx`

Each file imports `type { JSX } from 'react'`. Verify whether TypeScript's `jsx: 'react-jsx'` mode resolves `JSX` globally without the import. If it does, remove the explicit imports.

---

### N2 — Stray blank line in `AssessTaskModal.tsx` imports (D)

**File:** `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx` (diff line 7715)

After adding `import { AssignmentSelectSkeleton } from './AssignmentSelectSkeleton';`, there is a stray blank line (two consecutive blank lines before the deleted `LOADING_SPINNER_STYLE` constant).

---

### N3 — Unnecessary alias in `classPageAdapter.zod.ts` (K)

**File:** `src/frontend/src/features/classPage/classPageAdapter.zod.ts`, line 20

```typescript
const RecentAssignmentCardMetricSchema = MetricResultSchema;
```

This alias adds a layer of indirection with zero benefit. Either remove the alias or make the name meaningful.

---

### N4 — Inconsistent `totalDataPoints` in test fixtures (S)

**File:** `src/frontend/src/features/classPage/classPageAdapter.zod.spec.ts` (lines 4772–4786)

The `validComputedMetric` fixture uses `totalDataPoints: 2` while `validNotAttemptedMetric` uses `totalDataPoints: 3`. These arbitrary values don't affect test validity but the inconsistency could confuse future readers. Consider making them consistent.

---

### N5 — Model mismatch in `.opencode/agents/code-reviewer.md` vs `opencode.jsonc` (D)

**File:** `.opencode/agents/code-reviewer.md` line 21: `model: opencode/mimo-v2.5-free`
**File:** `opencode.jsonc` line 672: `model: opencode-go/deepseek-v4-pro`

The `.opencode/agents/code-reviewer.md` markdown frontmatter sets model to `opencode/mimo-v2.5-free` while `opencode.jsonc` sets it to `opencode-go/deepseek-v4-pro`. The jsonc takes precedence but the markdown's model line is now stale/misleading.

**Fix:** Align them or remove the model from the markdown file.

---

## Policy Compliance (No Issues Found)

The following were verified and found compliant:

- **Zod-first validation** (`classPageAdapter.zod.ts` derives all types via `z.infer`) ✓
- **Direct imports, no barrel files** ✓
- **No backend runtime imports from frontend** ✓
- **Feature-local helpers kept local** per shared-helper standards §4.4 ✓
- **`Result` instead of `Alert` for full-page blocking states** — explicitly documented as an accepted deviation in `frontend-loading-and-width-standards.md` §2.2 ✓
- **British English** in all user-facing strings, JSDoc, and comments ✓
- **`no-unreachable: 'off'` in frontend ESLint** — documented rationale present, consistent with `tsconfig.base.json`'s `allowUnreachableCode: false` ✓
- **No `console.*` calls** in any production classPage source file ✓
- **Export functions as functions** (not `const arrow`) ✓
- **File length** — all 11 new source files are under 500 lines ✓

---

## Priority Recommendation

1. **Fix C1** (null `adapterResult` crash) — production crash for end users
2. **Fix C2** (Retry not retrying dataset errors) — broken UX pattern
3. **Delete C3** (`CLASS_PAGE_QUERY_ANALYSIS.md`) — stale committed artefact
4. **Fix C5** (O(n×m) loop in adapter) — performance at scale
5. **Fix C4** (duplicated `metric()` fixture) — test maintainability
6. Address I1–I5 (KISS/DRY improvements) in a refactoring pass
7. Address I9–I11 (performance micro-optimisations)
8. Address I13 (missing `key` prop)
9. Address I14 (stale "red phase" comments) and I15 (remove `pageContent.spec.ts`)
10. Remaining items as bandwidth allows

---

## Validation Commands

After addressing findings, run:

```bash
npm run lint:frontend   # Verify ESLint
npm run test:frontend   # Verify all 1,423+ tests still pass
npm run lint:backend    # Verify backend lint
npm run lint:builder    # Verify builder lint
```
