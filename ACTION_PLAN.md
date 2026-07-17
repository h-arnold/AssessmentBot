# Task Preview Card — Real-Data Wiring: Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md` (Task Preview Card real-data wiring, v1.2).
2. Read `docs/developer/frontend/frontend-loading-and-width-standards.md`.
3. Read `docs/developer/frontend/frontend-react-query-and-prefetch.md`.
4. Read `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18.16.
5. Read `docs/developer/frontend/frontend-logging-and-error-handling.md`.
6. Treat those documents as the source of truth for product behaviour, contracts, and layout rules.

## Scope and assumptions

### Scope

- Three new pure helper modules: `buildCellPreviewLookup`, `spreadsheetToMarkdownTable`, `assembleTaskPreviewData`.
- `useQuery(getAssignmentQueryOptions(...))` added to `TaskHeatmapPage`.
- `TaskHeatmapTable` receives three new required props and replaces fixture-based popover content with real data.
- Popover skeleton and error `Alert` states.
- Refresh button in `TaskHeatmapPage` wraps the parent `refetch` to also refetch the assignment query.
- Deletion of 5 fixture-related files (3 JSON, `taskPreviewFixtures.ts`, `taskPreviewFixtures.spec.ts`).
- Removal of stale `@remarks` block from `TaskPreviewCard.tsx`.

### Out of scope

- Changing `useClassPageData` or the ClassPage prefetch policy.
- Adding a dedicated spreadsheet renderer component.
- Popover-level retry button.
- Creating `TASK_PREVIEW_CARD_LAYOUT.md`.

### Assumptions

1. `AssignmentFull.submissions[].studentId` matches `ClassFull.students[].id` (and therefore `HeatmapRow.studentId`); `StudentSubmissionItem.taskId` matches `HeatmapTaskColumn.taskId`. These backend invariants are covered by a joined-fixture test in Section 1.
2. `getAssignmentQueryOptions` with `retry: false` and `staleTime: 300_000` is the correct query configuration (matches existing prefetch usage).

---

## Global constraints and quality gates

### Engineering constraints

- Keep new helpers pure (no React, no Ant Design, no I/O).
- Keep component changes minimal and localised.
- Fail fast on invalid inputs; do not silently swallow errors.
- Use British English in comments and documentation.
- All frontend-to-backend calls route through existing `callApi` (no new transport).

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate

When a section is delegated to sub-agents (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`):

1. List required documentation file paths under that phase before delegation.
2. Require the sub-agent handoff to include `Files read` with explicit file paths.
3. Verify every mandatory file is listed before accepting the handoff.
4. If any mandatory file is missing, return the work to the same sub-agent and block progression.

### Shared-helper planning gate

Three new helpers are planned in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18.16 with status `Not implemented`. During the documentation pass (Section 8), update their status to `Implemented`.

### Validation commands hierarchy

- Backend lint: `npm run lint:backend`
- Frontend lint: `npm run lint:frontend`
- Frontend unit tests: `npm run test:frontend -- <target>`
- Frontend test watch (development): `npm run test:frontend:watch -- <target>`

---

## Section 1 — `buildCellPreviewLookup` pure helper

### Objective

Create a pure function that transforms `AssignmentFull` into a
`Map<studentId, Map<taskId, CellPreviewData>>` keyed lookup for O(1) popover
data retrieval.

### Constraints

- Pure function — no React, Ant Design, or I/O imports.
- Accepts `AssignmentFull` (non-null; the caller guards against `null`).
- Returns `Map<string, Map<string, CellPreviewData>>`.
- `CellPreviewData` interface and `CellPreviewLookup` type alias
  (`ReadonlyMap<string, ReadonlyMap<string, CellPreviewData>>`) are exported
  from this module.
- Reasoning is extracted per `HEATMAP_METRIC_KEYS` (`completeness`, `accuracy`, `spag`) reading `item.assessments[key]?.reasoning ?? null`.
- If multiple items in a submission share the same `taskId`, the first encountered wins.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md` (multi-dimensional lookup design section)
- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricDisplayMeta.ts`
- `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`
- `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md` (multi-dimensional lookup design section)
- `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts`
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricDisplayMeta.ts`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §4 (extraction rules)

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

1. Helper: `buildCellPreviewLookup`
   - Decision: `new` (recorded at §9.18.16 item 24)
   - Owning module/path: `src/frontend/src/features/classPage/buildCellPreviewLookup.ts`
   - Call-site rationale: called by `TaskHeatmapPage` via `useMemo`; consumed by `TaskHeatmapTable` cell renders
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18.16
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Given a valid `AssignmentFull` with submissions, returns a Map keyed by `studentId` → `taskId` → `CellPreviewData`.
- Missing student returns `undefined` from outer Map.
- Missing task returns `undefined` from inner Map.
- `CellPreviewData.artifactType` matches `item.artifact.type`.
- `CellPreviewData.artifactContent` matches `item.artifact.content`.
- `CellPreviewData.reasoning.completeness` matches `item.assessments.completeness?.reasoning ?? null`.
- Same pattern for `accuracy` and `spag`.
- Multiple items with the same `taskId` in one submission: first-wins.
- Empty `submissions` array returns an empty Map.

### Required test cases (Red first)

1. Single submission, single task, TEXT artifact, all three assessments
   present → correct `CellPreviewData` with `artifactType: 'TEXT'` and
   `artifactContent` as the string.
   1a. Same structure with TABLE artifact → `artifactType: 'TABLE'`.
   1b. Same structure with IMAGE artifact → `artifactType: 'IMAGE'`.
2. Single submission, single task, only completeness assessed → `accuracy`/`spag` reasoning are `null`.
3. Multiple submissions for different students → correct student-level keys.
4. Submission with multiple items (different `taskId`s) → both tasks in inner Map.
5. Submission with duplicate `taskId` items → first encountered wins.
6. **Joined-fixture test**: realistic `AssignmentFull` fixture where `submission.studentId` and `item.taskId` match entries in a `ClassFull`-derived heatmap (validating the identifier-space alignment assumption per SPEC §"Assumptions").
7. Empty `submissions` array → empty Map.
8. Submission with `SPREADSHEET` artifact → `artifactType` is `'SPREADSHEET'`, `artifactContent` is the 2D array.

### Section checks

- `npm run test:frontend -- buildCellPreviewLookup`
- `npm run lint:frontend`
- Planned helper entry in canonical doc present with `Not implemented`.

---

## Section 2 — `spreadsheetToMarkdownTable` pure helper

### Objective

Create a pure function that converts a spreadsheet 2D array
(`Array<Array<string | number | null>> | null`) to a GitHub-flavoured markdown
table string, for rendering via the existing `MarkdownRenderer`.

### Constraints

- Pure function — no React, Ant Design, or I/O imports.
- Accepts `Array<Array<string | number | null>>`.
- Returns a GitHub-flavoured markdown table string (pipe-delimited, header
  separator row).
- Empty array `[]` returns `''`.
- Null cells render as empty strings.
- The pipe delimiter (`|`) is escaped as `\|` inside cell values; no other
  escaping is applied.

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md` (SPREADSHEET → markdown helper section)
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md` (SPREADSHEET → markdown helper section)
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §4

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

1. Helper: `spreadsheetToMarkdownTable`
   - Decision: `new` (recorded at §9.18.16 item 26)
   - Owning module/path: `src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts`
   - Call-site rationale: called by `assembleTaskPreviewData` when artifact type is `SPREADSHEET`
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18.16
   - Planned doc status: `Not implemented`

### Acceptance criteria

- Empty array `[]` → `''`.
- Single header row with one data row → correct markdown table.
- Multiple data rows with mixed types (string, number, null) → null cells
  rendered as empty, numbers as strings.
- Cell content containing `|` → pipe is escaped as `\|`.

### Required test cases (Red first)

1. Empty array → `''`.
2. `[['A', 'B'], [1, 2]]` → markdown table with header row and one data row.
3. `[['Name', 'Score']]` → header-only markdown table (no data rows).
4. `[['Name', 'Score'], ['Alice', 95], ['Bob', null]]` → null cell rendered
   as empty.
5. Cell with pipe character → correctly escaped as `\|` in output.

### Section checks

- `npm run test:frontend -- spreadsheetToMarkdownTable`
- `npm run lint:frontend`

---

## Section 3 — `assembleTaskPreviewData` mapping helper

### Objective

Create a pure function that assembles a `TaskPreviewData` from a
`CellPreviewData` (or `null`), the analyser's `MetricResult`, the metric key,
and the task ID. This is the single point where wider backend types are
narrowed to the `TaskPreviewCard` contract.

### Constraints

- Pure function — no React, Ant Design, or I/O imports.
- Signature:
  ```ts
  function assembleTaskPreviewData(
    cellData: CellPreviewData | null,
    metricResult: MetricResult,
    metricKey: HeatmapMetricKey,
    taskId: string
  ): TaskPreviewData;
  ```
- Artifact type coercion per SPEC coercion table.
- Reasoning extraction: `cellData?.reasoning[metricKey] ?? ''`.
- `metricScore` and `metricState` pass through from `metricResult`.
- `metricKey` is passed through unchanged into `TaskPreviewData.metricKey`.
- `taskId` passed through from the `taskColumn.taskId` argument.
- SPREADSHEET → delegates to `spreadsheetToMarkdownTable`.
- `null` cellData → empty defaults (`artifactType: 'TEXT'`, `artifactContent: ''`, `reasoning: ''`).

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md` (Assembly mapping section)
- `src/frontend/src/features/classPage/TaskPreviewCard.tsx` (TaskPreviewData interface)
- `src/frontend/src/services/dataAnalysis/metricDisplay/metricDisplayMeta.ts`
- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md` (Assembly mapping section)
- `src/frontend/src/features/classPage/TaskPreviewCard.tsx`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §4

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`

### Shared helper plan

1. Helper: `assembleTaskPreviewData`
   - Decision: `new` (recorded at §9.18.16 item 25)
   - Owning module/path: `src/frontend/src/features/classPage/assembleTaskPreviewData.ts`
   - Call-site rationale: single mapping point for all artifact type coercions
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18.16
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `TEXT` artifact → `artifactType: 'TEXT'`, `artifactContent` as string.
- `TABLE` artifact → `artifactType: 'TABLE'`, `artifactContent` as string.
- `IMAGE` artifact → `artifactType: 'IMAGE'`, `artifactContent` as string.
- `SPREADSHEET` artifact → `artifactType: 'TABLE'`, `artifactContent` from
  `spreadsheetToMarkdownTable`.
- `base` artifact → `artifactType: 'TEXT'`, `artifactContent: ''`.
- `null` cellData → `artifactType: 'TEXT'`, `artifactContent: ''`,
  `reasoning: ''`.
- `metricScore` and `metricState` equal `metricResult.value` and
  `metricResult.state`.
- `taskId` passed through unchanged.
- Reasoning is empty string when assessment is absent for the metric key.

### Required test cases (Red first)

1. TEXT artifact, computed metric → correct `TaskPreviewData`.
2. TABLE artifact → correct `TaskPreviewData`.
3. IMAGE artifact → correct `TaskPreviewData`.
4. SPREADSHEET artifact → `artifactType: 'TABLE'`, content is markdown.
5. `base` artifact → `artifactType: 'TEXT'`, `artifactContent: ''`.
6. `null` cellData → empty defaults.
7. `notAttempted` metric → `metricState: 'notAttempted'`, `metricScore: 'N'`.
8. `error` metric → `metricState: 'error'`, `metricScore: 'E'`.
9. Assessment present for the metric key → returned `reasoning` matches
   `cellData.reasoning[metricKey]`.
10. Assessment missing for specific metric key → `reasoning: ''`.
11. `metricKey` is passed through unchanged into `TaskPreviewData.metricKey` for
    each of `completeness`, `accuracy`, and `spag`.

### Section checks

- `npm run test:frontend -- assembleTaskPreviewData`
- `npm run lint:frontend`

---

## Section 4 — Wire `TaskHeatmapPage` with assignment `useQuery`

### Objectives

1. Add `useQuery(getAssignmentQueryOptions(classFull.classId, assignmentId))`
   to `TaskHeatmapPage`.
2. Derive `cellPreviewLookup` via `useMemo`.
3. Derive `showAssignmentError` as `assignmentQuery.isError || assignmentQuery.data === null`.
4. Pass `cellPreviewLookup`, `isAssignmentLoading`, and `showAssignmentError`
   into `TaskHeatmapTable`.
5. Wrap the Refresh button to also call `assignmentQuery.refetch()`.
6. Add error-logging effects (separate `useRef` guards for error vs not-found).

### Constraints

- `isAssignmentLoading` = `assignmentQuery.isPending` (not `isFetching`).
- Error log: `logFrontendError('TaskHeatmapPage', error)` with dedicated
  `useRef` guard.
- Not-found log: `logFrontendEvent('warn', { context: 'TaskHeatmapPage', errorMessage: 'Assignment not found in AssignmentFull payload' })` with dedicated `useRef` guard.
- The existing `adaptMetricsToHeatmap` call and its error handling are unchanged.
- File current: 212 lines. Projected after changes: ~280 lines (under 500-line threshold; no file separation needed).

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md` (Component changes / TaskHeatmapPage section)
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapPage.spec.tsx`
- `src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx`
- `src/frontend/src/query/sharedQueries.ts`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`
- `src/frontend/src/query/sharedQueries.ts`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md` §5 (view-entry prefetch)
- `docs/developer/frontend/frontend-logging-and-error-handling.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`

### Acceptance criteria

- `useQuery` is called with `courseId = classFull.classId` and
  `assignmentId`.
- `cellPreviewLookup` is derived via `useMemo`, keyed on
  `assignmentQuery.data`.
- `showAssignmentError` is `true` when `assignmentQuery.isError` is `true`.
- `showAssignmentError` is `true` when `assignmentQuery.data === null`.
- `showAssignmentError` is `false` when `assignmentQuery.data` is non-null
  and not errored.
- `cellPreviewLookup`, `isAssignmentLoading`, and `showAssignmentError` are
  passed as props into `TaskHeatmapTable`.
- Refresh button calls both `refetch` (parent) and `assignmentQuery.refetch()`.
- Error logged once via `logFrontendError` with `useRef` guard.
- Not-found logged once via `logFrontendEvent('warn', ...)` with separate
  `useRef` guard.

### Required test cases (Red first)

1. `useQuery` receives correct `courseId` and `assignmentId`.
2. While `isPending`, `cellPreviewLookup` is `null` and `isAssignmentLoading`
   is `true`.
3. On success, `cellPreviewLookup` is a non-null Map.
4. `showAssignmentError` is `true` when `isError` (fetch failure).
5. `showAssignmentError` is `true` when `data` is `null` (not found).
6. Refresh button calls both parent `refetch` and `assignmentRefetch`.
7. Error effect logs once (not twice in StrictMode).
8. Not-found effect logs once as warn.

### Section checks

- `npm run test:frontend -- TaskHeatmapPage`
- `npm run test:frontend -- ClassPageHeatmapView`
- `npm run lint:frontend`

---

## Section 5 — Wire `TaskHeatmapTable` with real data and new states

### Objectives

1. Add three required props: `cellPreviewLookup`, `isAssignmentLoading`,
   `showAssignmentError`.
2. Replace `getTaskPreviewData(taskColumn.taskId, metric, m)` call with
   `cellPreviewLookup` + `assembleTaskPreviewData`.
3. Add `TaskPreviewSkeleton` (inline or co-located component) for the
   loading state inside the popover.
4. Add compact error `Alert` for the `showAssignmentError` state.
5. Remove the import of `getTaskPreviewData` (currently from
   `taskPreviewFixtures`) from `TaskHeatmapTable`.

### Constraints

- The popover trigger (hover/click on score) remains interactive in all states.
- Skeleton: Ant Design `Skeleton` with card-like shape, wrapped in
  `role="status"` and `aria-busy="true"`.
- Error Alert: `<Alert type="error" showIcon message="Couldn't load task details" />`.
- `cellPreviewLookup.get(record.studentId)?.get(taskColumn.taskId) ?? null`
  resolves the cell data for the popover.
- When the lookup returns `undefined`, `assembleTaskPreviewData(null, ...)`
  produces empty defaults.
- Existing column definitions, sorters, filters, and cell styling are
  unchanged.
- The new props (`cellPreviewLookup`, `isAssignmentLoading`, `showAssignmentError`)
  must be passed into `buildTaskMetricSubColumns` and added to the `columns`
  `useMemo` dependency array (TaskHeatmapTable.tsx line 329) to prevent
  stale-closure bugs — the popover `render` closure inside
  `buildTaskMetricSubColumns` reads these values.
- File current: 352 lines. Projected after changes: ~420 lines (under 500-line
  threshold; no file separation needed).

### Delegation mandatory reads

Testing Specialist mandatory docs:

- `SPEC.md` (Component changes / TaskHeatmapTable section)
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx`
- `docs/developer/frontend/frontend-loading-and-width-standards.md` §3, §8
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `SPEC.md`
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- `src/frontend/src/features/classPage/TaskPreviewCard.tsx`
- `docs/developer/frontend/frontend-loading-and-width-standards.md` §3, §8
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`

### Acceptance criteria

- `isAssignmentLoading === true` → popover renders skeleton, not real card.
- `showAssignmentError === true` → popover renders error `Alert`, not real
  card.
- `cellPreviewLookup` non-null and lookup returns data → popover renders
  `TaskPreviewCard` with real artifact and reasoning.
- Lookup returns `undefined` → popover renders `TaskPreviewCard` with empty
  content ("No submission available" / "No reasoning available").
- `getTaskPreviewData` import is removed.
- Existing table behaviours (sorting, filtering, pagination, cell styling)
  are preserved.

### Required test cases (Red first)

1. Skeleton renders in popover when `isAssignmentLoading` is `true`.
2. Error `Alert` renders in popover when `showAssignmentError` is `true`.
3. Real `TaskPreviewCard` renders when lookup returns data.
4. Empty artifact/reasoning when `cellPreviewLookup.get(studentId)?.get(taskId)`
   returns `undefined`.
5. Metric score cell display is unchanged across all states.

### Section checks

- `npm run test:frontend -- TaskHeatmapTable`
- `npm run lint:frontend`

### Optional `@remarks` JSDoc follow-through

- `TaskHeatmapTable`: document the three popover states (skeleton / error /
  real) and the lookup path in a `@remarks` block on the `render` callback
  or at the component level, so future maintainers understand the state
  branching without tracing the props.

---

## Section 6 — Delete fixtures and stale code

### Objectives

1. Delete five files:
   - `src/frontend/src/features/classPage/taskPreviewFixtures.ts`
   - `src/frontend/src/features/classPage/taskPreviewFixtures.spec.ts`
   - `src/frontend/src/features/classPage/fixtures/imageTask.json`
   - `src/frontend/src/features/classPage/fixtures/textTask.json`
   - `src/frontend/src/features/classPage/fixtures/table_task.json`
2. Remove the stale `@remarks` block ("Known v1 demo artefact") from
   `TaskPreviewCard.tsx` lines 23–28.
3. Verify no remaining imports of `getTaskPreviewData` or `taskPreviewFixtures`
   anywhere in `src/frontend/src/`.

### Constraints

- Do not modify any other files.
- The `fixtures/` directory may be removed if empty after file deletion.

### Delegation mandatory reads

Implementation mandatory docs:

- `SPEC.md` (Deleted files section)
- `src/frontend/src/features/classPage/TaskPreviewCard.tsx`

Code Reviewer mandatory docs:

- `SPEC.md`
- `src/frontend/AGENTS.md`

### Acceptance criteria

- The five listed files no longer exist on disk.
- `grep -r "taskPreviewFixtures" src/frontend/src/` returns no results.
- `grep -r "getTaskPreviewData" src/frontend/src/` returns no results.
- The `@remarks` "Known v1 demo artefact" paragraph is removed from
  `TaskPreviewCard.tsx`.
- `npm run lint:frontend` passes.
- All existing classPage specs pass.

### Section checks

- `grep -r "taskPreviewFixtures" src/frontend/src/` → empty.
- `grep -r "getTaskPreviewData" src/frontend/src/` → empty.
- `npm run test:frontend -- classPage`
- `npm run lint:frontend`

---

## Regression and contract hardening

### Objective

Verify that all existing tests remain green and no regressions are introduced
by the wiring changes.

### Constraints

- Run focused test suites first, then broader validation.

### Acceptance criteria

- All classPage spec files pass.
- `useClassPageData.spec.ts` passes (no changes to that hook).
- `TaskHeatmapTable.spec.tsx` passes (updated for new props).
- `TaskHeatmapPage.spec.tsx` passes (updated for new useQuery).
- `ClassPageHeatmapView.spec.tsx` passes.
- `TaskPreviewCard.spec.tsx` passes.
- Frontend lint passes.
- No new TypeScript errors.

### Required test cases / checks

1. `npm run test:frontend -- classPage` (all classPage specs).
2. `npm run test:frontend -- buildCellPreviewLookup`
3. `npm run test:frontend -- spreadsheetToMarkdownTable`
4. `npm run test:frontend -- assembleTaskPreviewData`
5. `npm run lint:frontend`

### Section checks

- Run the commands above and ensure all are green.

---

## Documentation and rollout notes

### Objective

Update canonical documentation to reflect the implemented helpers and
address stale references.

### Constraints

- Only modify documents relevant to the touched areas.

### Docs delegation mandatory reads

Docs mandatory docs:

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.18.16
- `src/frontend/src/features/classPage/buildCellPreviewLookup.ts`
- `src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts`
- `src/frontend/src/features/classPage/assembleTaskPreviewData.ts`
- `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`
- `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- `ACTION_PLAN.md` (this document)

### Acceptance criteria

1. Three planned helper entries in
   `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   §9.18.16 updated from `Not implemented` to `Implemented` with short
   implementation notes.
2. Dangling `@see TASK_PREVIEW_CARD_LAYOUT.md` references in
   `TaskHeatmapPage.tsx` (lines 10–11) and `TaskHeatmapTable.tsx` (lines
   16–17) are removed (the layout doc does not exist and is not created in
   this cycle).
3. Any other stale `@see` or `@link` references to deleted
   `taskPreviewFixtures` are removed.

### Required checks

1. Verify §9.18.16 entries show `Implemented`.
2. Verify `TASK_PREVIEW_CARD_LAYOUT.md` reference is removed from
   `TaskHeatmapPage.tsx` and `TaskHeatmapTable.tsx`.
3. Verify `taskPreviewFixtures` references are absent from all `@see`/`@link`
   tags.
4. `npm run lint:frontend` passes.

### Optional `@remarks` JSDoc review

- Confirm the stale `@remarks` block in `TaskPreviewCard.tsx` (Section 6) was
  removed.
- Confirm the new `@remarks` on `TaskHeatmapTable`'s popover state branching
  (Section 5) is present.
- Confirm `buildCellPreviewLookup`, `assembleTaskPreviewData`, and
  `spreadsheetToMarkdownTable` have adequate JSDoc describing their
  contracts.

---

## Suggested implementation order

1. Section 1 — `buildCellPreviewLookup` (pure helper, no dependencies)
2. Section 2 — `spreadsheetToMarkdownTable` (pure helper, no dependencies)
3. Section 3 — `assembleTaskPreviewData` (depends on Sections 1 and 2 for
   types and the spreadsheet converter)
4. Section 4 — Wire `TaskHeatmapPage` (depends on Section 1 for
   `buildCellPreviewLookup`)
5. Section 5 — Wire `TaskHeatmapTable` (depends on Sections 1–4 for all
   contracts and data flow)
6. Section 6 — Delete fixtures (depends on Section 5 for import removal)
7. Regression and contract hardening
8. Documentation and rollout
