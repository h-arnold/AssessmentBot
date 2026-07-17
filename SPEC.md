# Task Preview Card — Real-Data Wiring Specification

## Status

- Draft v1.2 — second review pass (C1–C3, I1–I3, N1–N2 addressed)

## Purpose

This document defines the intended behaviour for wiring the Task Preview Card
popover to real assignment data rather than static fixtures, and for ensuring
the full `Assignment` object is fetched when needed by the heatmap page.

The feature will be used to:

- show the actual student response artifact and LLM reasoning for each
  heatmap cell, sourced from the backend's full assignment payload
- fetch the assignment payload on-demand when the heatmap page opens and the
  data was not already pre-fetched
- replace the v1 fixture adapter and its three JSON fixture files

This feature is **not** intended to:

- change the visual layout of the Task Preview Card, the heatmap table, or
  the popover trigger
- change the metric-score display (the score pill still derives from the
  analyser's `MetricResult`)
- change the ClassPage prefetch policy (the top-3 fire-and-forget prefetch
  in `useClassPageData` is preserved unchanged)
- change the `TaskPreviewData` interface or the `TaskPreviewCard` component
  contract

## Agreed product decisions

1. **Keyed lookup (`studentId` × `taskId`).** The `AssignmentFull` payload is
   transformed into a `Map<studentId, Map<taskId, CellPreviewData>>` structure.
   Popover data retrieval on hover is O(1) via two `Map.get` calls. This
   avoids the row-index alignment problem that a positional 2D array would
   have with the table's name-sorted render order.

2. **Artifact and reasoning shown regardless of analyser state.** When the
   analyser reports `notAttempted` for a metric but the `AssignmentFull` has a
   submission with artifact and reasoning, the Task Preview Card shows the
   artifact and reasoning anyway. The metric-score pill in the card header
   continues to reflect the analyser's `MetricResult`. This keeps the popover
   useful for detailed inspection even when the analyser could not compute a
   score.

3. **Skeleton in popover during assignment loading.** While the `AssignmentFull`
   query is pending (`isPending`), the popover still opens on hover/click but
   shows a shape-matched `Skeleton` card. Once data arrives, real content
   replaces the skeleton.

4. **Metric score authority.** The `metricScore` and `metricState` in
   `TaskPreviewData` continue to derive from the analyser's `MetricResult` (the
   heatmap cell data). The `AssignmentFull` provides `artifactType`,
   `artifactContent`, and `reasoning` only.

5. **Existing pre-fetch is not widened.** The ClassPage top-3 `prefetchQuery`
   in `useClassPageData` stays as-is. For assignments outside the top 3, the
   `useQuery` in `TaskHeatmapPage` fetches on demand (React Query returns
   cached data if available — from the pre-fetch or a previous heatmap view).

6. **Fixtures deleted.** The three JSON fixture files, the `taskPreviewFixtures.ts`
   adapter module, and its spec file are removed. All fixture imports in
   `TaskHeatmapTable.tsx` are replaced by the real-data wiring.

7. **Refresh refetches the assignment query.** The Refresh button in
   `TaskHeatmapPage` wraps the parent's `refetch` callback to also call
   `assignmentQuery.refetch()`, ensuring the popover error state is recoverable
   within the session.

## Assumptions

1. **Identifier alignment.** `AssignmentFull.submissions[].studentId` is the same
   identifier as `ClassFull.students[].id` (which becomes
   `HeatmapRow.studentId`), and `StudentSubmissionItem.taskId` matches
   `HeatmapTaskColumn.taskId`. These invariants are enforced by the backend
   (assignments and submissions are always scoped to the same class, and
   task IDs originate from the same definition). The `ACTION_PLAN` must
   include a joined-fixture test in `buildCellPreviewLookup.spec.ts` (or the
   `TaskHeatmapTable` render spec) that validates a submission whose
   `studentId`/`taskId` match a class-roster student and a definition task
   resolves to the correct `CellPreviewData`.

## Existing system constraints

### Backend or API constraints already in place

- `getAssignment({ courseId, assignmentId })` returns `AssignmentFull | null`
  via `callApi` → `assignmentAssessmentService.getAssignment`.
- The backend `Assignment.toJSON()` contract produces the shape validated by
  `AssignmentFullSchema` in `assignmentAssessment.zod.ts`.
- The method is already registered in `ALLOWLISTED_METHOD_HANDLERS`.

### Current data-shape constraints

- `AssignmentFull.submissions[]` is a flat array of `StudentSubmission`, each
  with `items: Record<string, StudentSubmissionItem>` (keyed by item id, not
  task id).
- `StudentSubmissionItem.taskId` maps an item to a task.
- `StudentSubmissionItem.artifact` is a discriminated union on `type`:
  `TEXT | TABLE | IMAGE | SPREADSHEET | base`.
- `StudentSubmissionItem.assessments` is `Record<string, Assessment>` where
  the keys are metric names (`completeness`, `accuracy`, `spag`) and each
  `Assessment` has `score` (number) and `reasoning` (string).

### Frontend or consumer architecture constraints

- The shared `getAssignmentQueryOptions(courseId, assignmentId)` already exists
  in `src/frontend/src/query/sharedQueries.ts` with `staleTime: 300_000` and
  `retry: false`. The `queryKey` is `['assignment', courseId, assignmentId]`.
- `TaskHeatmapPage` is a child of `ClassPageContent` (ready branch), receiving
  `classFull`, `analyserResult`, `assignmentId`,
  `assignmentDefinitionPartials`, `onBack`, and `refetch` as props.
- `TaskHeatmapTable` receives `heatmapResult: HeatmapResult` as its sole
  required prop and renders cell popovers internally.
- All frontend-to-backend calls must route through `callApi`.

## Data loading and orchestration

### Required datasets or dependencies

- `AssignmentFull` — fetched via `useQuery(getAssignmentQueryOptions(classFull.classId, assignmentId))` in `TaskHeatmapPage`.
- `HeatmapResult` — already computed by `adaptMetricsToHeatmap` in `TaskHeatmapPage` (unchanged).

### Query or transport additions

- A new `useQuery` in `TaskHeatmapPage` using the existing shared
  `getAssignmentQueryOptions`. No new query-key factory, service method, or
  transport wrapper is needed.

### Loading state definition

- `isAssignmentLoading` is defined as `assignmentQuery.isPending` (not
  `isFetching`). During a background refetch the cached
  `cellPreviewLookup` remains non-null, so real content stays visible
  — consistent with
  `docs/developer/frontend/frontend-loading-and-width-standards.md` §4.

### Refresh behaviour

- The Refresh button in `TaskHeatmapPage` currently calls the parent `refetch`
  (which refetches `classFullQuery` and `adpQuery`). This is extended so
  `TaskHeatmapPage` also calls `assignmentQuery.refetch()`. The parent
  `refetch` is not modified; the wrapping happens locally in
  `TaskHeatmapPage`.

### Error handling

#### Assignment query pending (`isPending`)

- The heatmap table renders normally (metric scores already available).
- Cell popovers trigger and show a shape-matched `Task Preview Skeleton`
  (Ant Design `Skeleton` with card-like shape) wrapped in `role="status"`
  and `aria-busy="true"`.

#### Assignment query success (data available)

- `cellPreviewLookup` is derived from `assignmentQuery.data`.
- Popover content uses real `TaskPreviewCard` with data assembled from the
  lookup and the analyser's `MetricResult` via `assembleTaskPreviewData`.

#### Assignment query error

- `cellPreviewLookup` remains `null`.
- Popover shows a compact Ant Design `Alert type="error"` with non-technical
  message: `"Couldn't load task details"`.
- Logged once via `logFrontendError('TaskHeatmapPage', error)` guarded with
  its own `useRef` (separate from the existing generic-error guard) against
  React StrictMode double-fire.
- Heatmap table and all other regions remain fully usable.

#### Assignment query returns `null` (not found on backend)

- Same treatment as the error state: popover shows the compact error `Alert`.
- Logged once via
  `logFrontendEvent('warn', { context: 'TaskHeatmapPage', errorMessage: 'Assignment not found in AssignmentFull payload' })`
  with its own `useRef` guard.
- This is an unexpected condition (the assignment exists in
  `classFull.assignments`), so it is logged as a warning.

## Multi-dimensional lookup design

### Shape

```ts
/**
 * Per-cell preview data extracted from a single (student, task) pair in
 * the AssignmentFull payload.
 */
interface CellPreviewData {
  /** The artifact type discriminator from the backend. */
  readonly artifactType: 'TEXT' | 'TABLE' | 'IMAGE' | 'SPREADSHEET' | 'base';
  /** The artifact content (string, 2D array, null, or unknown per type). */
  readonly artifactContent: unknown;
  /** Per-metric reasoning strings (null when assessment is absent for that metric). */
  readonly reasoning: Record<HeatmapMetricKey, string | null>;
}

/**
 * Keyed lookup: outer key is studentId, inner key is taskId.
 *
 * A missing student entry or task entry means no submission exists for that
 * (student, task) pair.  O(1) retrieval via two Map.get calls.
 */
type CellPreviewLookup = ReadonlyMap<string, ReadonlyMap<string, CellPreviewData>>;
```

### Derivation rules

1. Iterate `assignment.submissions` (the backend `AssignmentFull.submissions` array):
   a. For each submission, create an inner `Map<string, CellPreviewData>`.
   b. Iterate `submission.items` object values:
   i. For each item, extract `artifactType = item.artifact.type`,
   `artifactContent = item.artifact.content`.
   ii. Build `reasoning` by iterating `HEATMAP_METRIC_KEYS`
   (`completeness`, `accuracy`, `spag`) and reading
   `item.assessments[key]?.reasoning ?? null`.
   iii. If multiple items in the same submission share the same `taskId`,
   the first encountered wins (defensive; backend data should not
   produce this).
   c. Set `outerMap.set(submission.studentId, innerMap)`.
2. Return the outer `Map`.

### Ownership

- A pure transformation function `buildCellPreviewLookup(assignment: AssignmentFull): CellPreviewLookup`
  is defined in a new feature-local module
  `src/frontend/src/features/classPage/buildCellPreviewLookup.ts`.
- The function accepts only the `AssignmentFull` (not the `HeatmapResult` —
  the lookup is keyed by `studentId` and `taskId`, not positional indices,
  so the heatmap structure is irrelevant).
- The function is called inside `TaskHeatmapPage` via `useMemo`, keyed on
  `assignmentQuery.data`.
- The resulting lookup is passed into `TaskHeatmapTable` as a new prop
  `cellPreviewLookup: CellPreviewLookup | null` (`null` while loading or on
  error).

## Assembly mapping: `CellPreviewData` → `TaskPreviewData`

A new named function `assembleTaskPreviewData` constructs a `TaskPreviewData`
from the lookup result and the analyser's `MetricResult`, plus the current
metric key. This is the single point where the wider `CellPreviewData`
types are narrowed to the `TaskPreviewCard` contract. **`TaskPreviewData`
and `TaskPreviewCard` are unchanged.**

```ts
function assembleTaskPreviewData(
  cellData: CellPreviewData | null,
  metricResult: MetricResult,
  metricKey: HeatmapMetricKey,
  taskId: string
): TaskPreviewData;
```

### Coercion rules

| CellPreviewData.artifactType | TaskPreviewData.artifactType | TaskPreviewData.artifactContent                                                                                                              |
| ---------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEXT`                       | `'TEXT'`                     | `cellData.artifactContent as string \|\| ''`                                                                                                 |
| `TABLE`                      | `'TABLE'`                    | `cellData.artifactContent as string \|\| ''`                                                                                                 |
| `IMAGE`                      | `'IMAGE'`                    | `cellData.artifactContent as string \|\| ''`                                                                                                 |
| `SPREADSHEET`                | `'TABLE'`                    | `spreadsheetToMarkdownTable((cellData.artifactContent as Array<Array<string \| number \| null>> \| null) ?? [])`                             |
| `base`                       | `'TEXT'`                     | `''` (empty — renders the empty-artifact fallback in `renderArtifact`, e.g. "No submission available" when `metricState === 'notAttempted'`) |

### Reasoning extraction

- `reasoning = cellData?.reasoning[metricKey] ?? ''`.
- An empty string triggers the existing "No reasoning available" fallback in
  `TaskPreviewCard`.

### Score and state

- `metricScore = metricResult.value` (unchanged from today's fixture adapter).
- `metricState = metricResult.state` (unchanged).
- `metricKey` is passed through directly.

### When `cellData` is `null`

- `artifactType = 'TEXT'`, `artifactContent = ''`, `reasoning = ''`.
- The existing `renderArtifact` + reasoning fallback logic handles this
  gracefully.

## SPREADSHEET → markdown helper

A new feature-local helper `spreadsheetToMarkdownTable` converts a
`Array<Array<string | number | null>>` to a GitHub-flavoured markdown table
string:

```ts
function spreadsheetToMarkdownTable(rows: Array<Array<string | number | null>>): string;
```

- First row is the header.
- Pipe-delimited columns with alignment separators.
- Null cells render as empty strings.
- Defined in a new file `src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts`.
- Planned helper entry recorded in
  `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  with status `Not implemented`.

## Component changes

### `TaskHeatmapPage`

- Adds `useQuery(getAssignmentQueryOptions(classFull.classId, assignmentId))`.
  Destructures `data: assignment`, `isPending: isAssignmentLoading`, `error: assignmentError`,
  `refetch: assignmentRefetch`.
- Derives `cellPreviewLookup` via `useMemo`:
  `assignment ? buildCellPreviewLookup(assignment) : null`.
  Keyed on `assignment`.
- Wraps the Refresh button callback to call **both** the parent `refetch` and
  `assignmentRefetch`.
- Passes `cellPreviewLookup` (nullable), `isAssignmentLoading`, and
  `showAssignmentError` (boolean) into `TaskHeatmapTable`.
- Owns the assignment-query error-logging effects with their own `useRef`
  guards (separate from the existing heatmap generic-error guard).

### `TaskHeatmapTable`

- Receives three new **required** props:
  - `cellPreviewLookup: CellPreviewLookup | null`
  - `isAssignmentLoading: boolean`
  - `showAssignmentError: boolean` (derived by parent from `assignmentQuery.isError || assignmentQuery.data === null`)
- In the cell `render` function, replaces the `getTaskPreviewData(...)` call:
  - If `isAssignmentLoading` → render `TaskPreviewSkeleton` inside popover.
  - If `showAssignmentError` → render compact error `Alert` inside popover.
  - Otherwise → resolve `cellData` via
    `cellPreviewLookup?.get(record.studentId)?.get(taskColumn.taskId) ?? null`,
    call `assembleTaskPreviewData(cellData, getCellMetric(record.cells[taskIndex], metric), metric, taskColumn.taskId)`,
    and render `<TaskPreviewCard data={result} />`.
- Removes import of `getTaskPreviewData` from `taskPreviewFixtures`.

### `TaskPreviewCard`

- No changes to the component or its `TaskPreviewData` interface.
- The stale `@remarks` block about "Known v1 demo artefact" (lines 23–28) is
  removed.

### New files

1. `src/frontend/src/features/classPage/buildCellPreviewLookup.ts` — pure
   transformation function.
2. `src/frontend/src/features/classPage/assembleTaskPreviewData.ts` — mapping
   from `CellPreviewData` + `MetricResult` to `TaskPreviewData`.
3. `src/frontend/src/features/classPage/spreadsheetToMarkdownTable.ts` —
   `Array<Array<string|number|null>>` → GFM markdown string.

### New: Task Preview Skeleton (inline in `TaskHeatmapTable` or co-located)

- Ant Design `Skeleton` with card-like shape: `Skeleton.Input` for title
  (~200px), `Skeleton` paragraph (3 rows), and `Skeleton.Input` block for
  artifact image placeholder.
- Wrapped in `role="status"` and `aria-busy="true"`.

### Deleted files

1. `src/frontend/src/features/classPage/taskPreviewFixtures.ts`
2. `src/frontend/src/features/classPage/taskPreviewFixtures.spec.ts`
3. `src/frontend/src/features/classPage/fixtures/imageTask.json`
4. `src/frontend/src/features/classPage/fixtures/textTask.json`
5. `src/frontend/src/features/classPage/fixtures/table_task.json`

## Error, loading, and empty-state rules

### Assignment query pending (`isPending === true`)

- Table: renders normally (metric scores from analyser).
- Popover: `TaskPreviewSkeleton` with `role="status"` and `aria-busy="true"`.
- Popover trigger remains interactive.

### Assignment query error or not-found

- `showAssignmentError` is `true`.
- Popover: compact Ant Design `Alert type="error" message="Couldn't load task details"`.
- Error logged once (with separate `useRef` guards for error vs not-found).
- Table and all other regions: unaffected.

### Assignment query success; no submission for (student, task) pair

- `cellPreviewLookup.get(studentId)?.get(taskId)` returns `undefined`.
- `assembleTaskPreviewData(null, metricResult, metricKey, taskId)` produces
  `TaskPreviewData` with empty artifact content and empty reasoning.
- `TaskPreviewCard.renderArtifact` shows "No submission available".
- Reasoning shows "No reasoning available".

### Assignment query success; submission exists but assessment missing for metric

- `cellData.reasoning[metricKey]` is `null`.
- `assembleTaskPreviewData` sets `reasoning: ''`.
- "No reasoning available" fallback applies.
- Artifact renders normally.

## Accessibility

- The skeleton popover content is wrapped in `role="status"` and
  `aria-busy="true"`.
- The error `Alert` uses Ant Design's built-in `role="alert"` semantics.
- The existing cell `aria-label` (`"StudentName, taskId, Metric: score"`) is
  unchanged.

## Out of scope

- Changing the ClassPage top-3 prefetch policy.
- Adding the assignment query to startup warm-up.
- Changing the `AssignmentFull` backend contract or serialisation.
- Adding a dedicated spreadsheet renderer component (v1 coerces to markdown
  table via `MarkdownRenderer`).
- Adding retry UI to the popover error state (the page-level Refresh button
  covers recovery).
- Multi-assignment heatmap selection.

## Testing expectations

### Unit tests (Vitest)

- `buildCellPreviewLookup`: test with mock `AssignmentFull` — verify correct
  `studentId` → `taskId` mapping, missing students/tasks, artifact type
  forwarding, reasoning extraction per metric key, multiple items per
  submission (first-wins), empty submissions array. Must include a
  **joined-fixture test** that validates a submission whose `studentId` and
  `taskId` match entries in a realistic `ClassFull`-derived heatmap to
  confirm the identifier-space alignment assumption.
- `assembleTaskPreviewData`: test all artifact type coercions — TEXT, TABLE,
  IMAGE pass through unchanged; SPREADSHEET input yields `artifactType: 'TABLE'`
  (via markdown conversion); `base` input yields `artifactType: 'TEXT'`,
  `artifactContent: ''`; `null` cellData yields empty defaults. Also test
  reasoning extraction per metric key and score/state pass-through from
  `MetricResult`.
- `spreadsheetToMarkdownTable`: test header row, data rows, null cells, empty
  array, single row, pipe-escaping in cell content.
- `TaskHeatmapTable`: verify skeleton renders when `isAssignmentLoading` is
  `true`; verify error `Alert` when `showAssignmentError` is `true`; verify
  real `TaskPreviewCard` with lookup data; verify empty artifact/reasoning
  when `cellPreviewLookup.get(studentId)?.get(taskId)` returns `undefined`.
- `TaskHeatmapPage`: verify `useQuery` is called with correct
  `courseId`/`assignmentId`; verify `cellPreviewLookup` is derived from query
  data; verify refresh wraps `assignmentRefetch`; verify `showAssignmentError`
  is `true` both when `assignmentQuery.isError` is `true` (fetch error) and
  when `assignmentQuery.data` is `null` (not found).

### Regression

- All existing specs under `src/frontend/src/features/classPage/` must remain
  green.
- `useClassPageData.spec.ts` must remain green (no changes to that hook).

## V1 scope recommendation

### Include in v1

- `useQuery` in `TaskHeatmapPage` for on-demand assignment fetch.
- `buildCellPreviewLookup`, `assembleTaskPreviewData`, and
  `spreadsheetToMarkdownTable` helpers.
- Skeleton popover state during loading.
- Error `Alert` in popover.
- Refresh wrapping to refetch assignment query.
- Deletion of fixture files, fixture adapter, and fixture spec.

### Defer from v1

- Dedicated spreadsheet renderer component (v1 uses markdown table).
- Popover-level retry button.
- Assignment query retry on failure (`retry: false` stays as-is, matching the
  existing query options).

## Open questions

None.
