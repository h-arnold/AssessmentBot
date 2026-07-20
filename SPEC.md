# Task Preview Card — Real-Data Wiring Specification

## Status

- Draft v1.6 — sixth review pass (planner-reviewer Improvements I1–I2
  and Nitpicks N1–N2 addressed on the prior pass: §"E2E plumbing updates"
  reframed the `getAssignment` payload as a fresh construction rather than
  a `buildItem` extension — `buildItem` serves the `ClassFull` partial
  path (`StudentSubmissionPartialSchema`) and is NOT reused; the new
  prose enumerates the full `StudentSubmissionSchema` +
  `StudentSubmissionItemSchema` required fields (`studentName`,
  `assignmentId`, `documentId`, `createdAt`, `updatedAt`, `id`,
  `feedback`) plus the `assignmentDefinition` sub-shape; IMAGE `content`
  must be a non-empty renderable source so `ImageRenderer` produces an
  `<img>`; the inline `scenario.getAssignment` snippet now shows the
  two-entry array matching the ACTION_PLAN).
- Draft v1.5 — fifth review pass (E2E per-task artifact-type distribution
  now explicit; `artifact` requirements cover full `BaseTaskArtifactFields`;
  `assessments[key]` requires both `score` and `reasoning`; item 4
  reworded from "popover header shows `taskId`" to "`TaskPreviewData.taskId`
  field stabilises across popover states" since `TaskPreviewCard` does not
  render `data.taskId`).
- Draft v1.4 — fourth review pass (Critical C1 / Improvements I1–I3 /
  Nitpicks N1–N2: E2E plumbing updates + `task-preview-card.spec.ts`
  adaptation requirements added; `taskId` behavioural change surfaced as
  minor user-visible side-effect under product decision 4;
  `cellPreviewLookup` `?? null` coercion clarified; `keep local` phrasing
  aligned).

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

   **Minor user-visible side-effect of the wiring (locked by `ACTION_PLAN`
   Section 3 test 13).** The `taskId` field in `TaskPreviewData` is now
   stable across loading / no-submission / populated states and carries
   the heatmap column's real `taskColumn.taskId` (e.g. `task_001`),
   sourced from `assembleTaskPreviewData`'s caller-supplied `taskId`
   parameter. The fixture adapter previously returned the fixture-specific
   identifier (e.g. `t_preview_image_001`) and ignored the caller's
   `_taskId` parameter (`taskPreviewFixtures.ts` lines 102–124); under
   real-data wiring this is intentionally changed so the field is stable.
   `TaskPreviewCard` is unchanged and does not render `data.taskId`
   visibly in the card body — its header aria-label is
   `${label} score: ${score}` (TaskPreviewCard.tsx line 210). The cell
   `aria-label` on the heatmap cells (the popover trigger) is formatted
   `${record.studentName}, ${taskColumn.taskId}, ${displayTitle}:
${score}` and was already keyed on `taskColumn.taskId` before this
   change, so the visible change does not surface on the cell aria-labels
   either. The behavioural change is solely in the `TaskPreviewData.taskId`
   field's value, which downstream consumers (currently none render it)
   will see stabilise across the popover's three states — locked by
   action-plan Section 3 test 13.

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

1. **`studentId` alignment.** `AssignmentFull.submissions[].studentId` is the
   same identifier as `ClassFull.students[].id` (which `adaptMetricsToHeatmap`
   maps to `HeatmapRow.studentId` in `services/dataAnalysis/heatmapAdapter.ts`
   line 220). This invariant is enforced by the backend (assignments are
   scoped to the same class). The `ACTION_PLAN` must include a joined-fixture
   test in `buildCellPreviewLookup.spec.ts` that validates a submission whose
   `studentId` matches a class-roster student resolves to the correct
   `CellPreviewData`.

2. **`taskId` alignment (bare-key, not composite).**
   `StudentSubmissionItem.taskId` matches `HeatmapTaskColumn.taskId`, and both
   are the **bare** `taskId` from the task definition (the leading segment
   before `::` in the heatmap's composite `taskKey`). The heatmap's internal
   matching uses the composite `${definitionKey}::${taskId}` (`heatmapAdapter.ts`
   line 106), but the `CellPreviewLookup` inner key intentionally uses the bare
   `taskId` only — because `StudentSubmissionItem.taskId` is declared as a
   bare string in `assignmentAssessment.zod.ts` line 86 (`z.string()`) and the
   `AssignmentFull` payload does not carry the `definitionKey` on each
   submission item. The two heatmap columns (`HeatmapTaskColumn.taskId`) must
   therefore continue to be sourced from the bare `taskId` segment of
   `assignmentDefinitionPartials[].tasks[].taskId` (already the case in
   `heatmapAdapter.ts` line 108).

   This is a single-assignment-scoped design: if multi-assignment selection
   is added later, two assignments sharing the same bare `taskId` under
   different definition keys would collide in the outer-map inner-map
   structure, so the lookup shape must be revisited at that time (multi-
   assignment selection is explicitly out of scope, §"Out of scope").

   The `ACTION_PLAN` must include both a positive joined-fixture test
   (submission `taskId` matches a heatmap column `taskId`) and a negative
   test asserting a submission whose `taskId` does not match any heatmap
   column produces an `undefined` lookup entry (graceful empty), so the
   failure mode on identifier drift is documented at the test level.

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
- `assignmentQuery.refetch()` is called unconditionally — rely on React
  Query v5's deduplication behaviour when the query is already pending
  (refetch on a pending query coalesces with the in-flight request rather
  than issuing a duplicate). The action plan must lock this with a
  Red-phase test asserting Refresh clicked while `isPending === true`
  does not throw and does not issue a second network request beyond what
  React Query's deduplication already performs.

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
   iv. Set `innerMap.set(item.taskId, cellPreviewData)` (bare `taskId`,
   first-wins per iii; the inner key is deliberately **not** the composite
   `${definitionKey}::${taskId}` because `StudentSubmissionItem.taskId`
   carries no `definitionKey` — see Assumption 2).
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
- Planned helper entry recorded in
  `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  §9.18.16 (item 24) with status `Not implemented`.

## Assembly mapping: `CellPreviewData` → `TaskPreviewData`

A new named function `assembleTaskPreviewData` constructs a `TaskPreviewData`
from the lookup result and the analyser's `MetricResult`, plus the current
metric key. This is the single point where the wider `CellPreviewData`
types are narrowed to the `TaskPreviewCard` contract. **`TaskPreviewData`
and `TaskPreviewCard` are unchanged.** Planned helper entry recorded in
`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
§9.18.16 (item 25) with status `Not implemented`.

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

### `taskId` propagation

- `taskId` is the parameter value passed by the caller (`taskColumn.taskId`)
  — it is **never** derived from `cellData`. This is intentional: `CellPreviewData`
  is keyed on `taskId` in the lookup (so it is not self-describing), and the
  caller always knows which column it is rendering. `assembleTaskPreviewData`
  must forward `taskId` unchanged even when `cellData` is `null`, so the
  popover header behaviour is stable across the loading / no-submission /
  populated states. The action plan must lock this with a Red-phase test that
  asserts `assembleTaskPreviewData(null, <any metric>, <any key>, 'task-7').taskId === 'task-7'`.

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
  §9.18.16 (item 26) with status `Not implemented`.

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

### New: Task Preview Skeleton (inline in `TaskHeatmapTable`)

- Ant Design `Skeleton` with card-like shape: `Skeleton.Input` for title
  (~200px), `Skeleton` paragraph (3 rows), and `Skeleton.Input` block for
  artifact image placeholder.
- Wrapped in `role="status"` and `aria-busy="true"`.
- Placed inline in `TaskHeatmapTable.tsx` as a small, feature-local,
  non-exported component (KISS — single call-site, no reuse path; kept
  local per shared-helper standards `keep local` decision). The skeleton
  hard-codes its shape dimensions locally with a comment cross-referencing
  `TaskPreviewCard`'s `CARD_MAX_WIDTH = 400` and `CARD_BODY_MAX_HEIGHT =
480` private constants. `TaskPreviewCard.tsx` is therefore a mandatory
  read for the implementation agent in Section 5 of the action plan, so
  the implementation agent can keep the skeleton shape aligned even though
  the constants are not refactored into a shared export.

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

- `cellPreviewLookup.get(studentId)?.get(taskId)` returns `undefined`,
  coerced to `null` via `?? null` before being passed to
  `assembleTaskPreviewData` (whose `cellData` parameter is typed
  `CellPreviewData | null`, not `CellPreviewData | null | undefined`).
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
- Creating `TASK_PREVIEW_CARD_LAYOUT.md` (the layout doc does not exist on
  this branch and is not created in this cycle; dangling references to it
  are cleaned up — see "Documentation and rollout notes" below).

## Documentation and rollout notes

- The canonical shared-helpers doc
  (`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
  §9.18.16) entries 24, 25, 26 are updated from `Not implemented` to
  `Implemented` during the documentation pass.
- The not-`TASK_PREVIEW_CARD_LAYOUT.md` doc does not exist on this branch
  and is not created in this cycle. Seven source/spec files carry stale
  `@see` / `(see …)` references to it; all seven must be cleaned up in the
  documentation pass so the repo stays self-consistent:
  - `src/frontend/src/features/classPage/TaskHeatmapPage.tsx` (lines 9–11)
  - `src/frontend/src/features/classPage/TaskHeatmapTable.tsx` (lines 15–17)
  - `src/frontend/src/features/classPage/TaskHeatmapTable.spec.tsx` (lines 9–12)
  - `src/frontend/src/features/classPage/ClassPageHeatmapView.spec.tsx` (lines 15–17)
  - `src/frontend/src/features/classPage/TaskPreviewCard.tsx` (lines 63, 71)
  - `src/frontend/src/components/ImageRenderer/ImageRenderer.tsx` (line 9) —
    file is outside `features/classPage/`; included here because its
    `@see`/`(see …)` points at a non-existent doc and leaving it dangling
    would be inconsistent.
  - `src/frontend/e2e-tests/task-preview-card.spec.ts` (line 15) — E2E spec
    file; included because the same dangling-`@see` consistency rule applies,
    and the docs-pass owner will already be in the area touching the
    classPage feature's documentation.

## E2E plumbing updates

The existing E2E suite `src/frontend/e2e-tests/task-preview-card.spec.ts`
asserts popover content that today is supplied by the fixture adapter the
spec is deleting. The runtime-mock plumbing must be extended before the
fixture adapter is removed:

- `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts` — the
  `allMethods` array (around lines 476–490) does **not** include
  `'getAssignment'`; this method must be added so `installRuntimeMock`
  intercepts the new `useQuery(getAssignmentQueryOptions(...))` `queryFn`
  the wiring introduces. The `RuntimeScenario` type (around lines 50–63)
  gains an optional `getAssignment?: ReadonlyArray<ResponseItem>` field.
  Without this, the popover would either hang on an un-mocked
  `google.script.run` call, reject unhandled, or render the new error
  `Alert` ("Couldn't load task details") instead of the real artifact.
- `src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts` —
  `createHeatmapScenario` must seed a schema-valid `AssignmentFull`
  payload for `getAssignment` (`scenario.getAssignment = [
  { kind: 'success', data: <AssignmentFull> },
  { kind: 'success', data: <AssignmentFull> }
]` — **two** identical entries so React 19 StrictMode double-effect
  does not exhaust the queue — mirroring the existing `getABClass`
  two-entry pattern). The top-level `AssignmentFullSchema` is
  `.strict()` and requires `courseId, assignmentId, assignmentName,
dueDate, updatedAt, createdAt, documentType, referenceDocumentId,
templateDocumentId, tasks, submissions, assignmentDefinition`
  (`assignmentAssessment.zod.ts` lines 155–170). The seeded payload's
  `submissions[].studentId` must match Student Two
  (`'100000000005'`) and its `items[].taskId` must match
  `'task_001'`/`'task_002'`/`'task_003'` (the existing
  `HEATMAP_TASK_IDS`) so the new `cellPreviewLookup` `studentId` ×
  `taskId` join resolves.

  **The `getAssignment` payload is a fresh construction**, NOT a
  reuse/extension of `buildItem`. The existing `buildItem`
  (lines 204–219 of `task-heatmap-end-to-end-helpers.ts`) produces
  objects inside `buildClassFullDocument`'s `submissions[]`, validated
  by the partial `StudentSubmissionPartialSchema`
  (`classDetailService.zod.ts` lines 63–88) where `artifact.type` is
  `z.string()` and most other fields are optional/nullable. The new
  `getAssignment` payload's `submissions[]` must independently satisfy
  the strict `StudentSubmissionSchema` (lines 102–110: `studentId,
studentName, assignmentId, documentId, items, createdAt, updatedAt`),
  with each `items[]` satisfying `StudentSubmissionItemSchema`
  (lines 84–96: `id, taskId, artifact, assessments, feedback`) —
  the `id` and `feedback` fields are easy to forget. The Playwright
  agent must build the `getAssignment` submissions fresh (e.g. a new
  `buildAssignmentFullDocument` helper or inline literal inside
  `createHeatmapScenario`); do NOT extend `buildItem`, which serves the
  unrelated `ClassFull` partial path.

  Artifact-type selection is **per-task** (one `StudentSubmissionItem`
  per `taskId` yields one `CellPreviewData` with one `artifactType`
  used across all three metric sub-columns of that task). The fixture
  adapter's per-`metricKey` `{image, text, table}` switch is
  structurally impossible under real-data wiring — the E2E suite must
  therefore distribute the three artifact types across the three tasks
  so each existing E2E assertion can be satisfied by hovering the
  matching `taskId`. Each artifact must satisfy
  `BaseTaskArtifactSchema` — the discriminated union extends
  `BaseTaskArtifactFields` (lines 26–34), which requires ALL of
  `taskId: string`, `role: string`, `pageId: string`,
  `documentId: string`, `uid: string`, `contentHash: string | null`,
  `metadata: Record<string, unknown>`, plus the discriminant `type`
  and a type-matching `content` field (`string | null` for
  TEXT/TABLE/IMAGE, `Array<Array<string | number | null>> | null` for
  SPREADSHEET, `unknown` for `base`). The IMAGE artifact's `content`
  MUST be a non-empty renderable image source (data URI or URL) so
  `ImageRenderer` produces an `<img>` element and the popover's
  `popover.locator('img')).toHaveCount(1)` assertion holds; the TABLE
  artifact's `content` MUST be non-empty markdown so the existing
  `<table>` structural assertion holds.

  Each `assessments[key]` must satisfy `AssessmentSchema` (lines 21–24)
  — requires both `score: number` AND `reasoning: string`. The
  ClassFull-path `buildItem` (lines 212–216) supplies only `score`; the
  fresh `getAssignment` submissions must add a non-empty `reasoning`
  for each (task, metric) pair so the popover's Reasoning section
  renders real seeded content (and the E2E popover content assertion
  can target deterministic, non-fixture text).

The E2E spec's visible-content assertions
(`src/frontend/e2e-tests/task-preview-card.spec.ts` line 132) reference the
specific fixture text `/preview cards work properly/i` from
`fixtures/textTask.json`; these assertions must be updated to match the
real `AssignmentFull` payload's artifact/reasoning content that the
scenario now seeds.

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

### E2E tests (Playwright)

- `src/frontend/e2e-tests/task-preview-card.spec.ts` is updated so the four
  existing popover tests (IMAGE / TEXT / TABLE hover, pinned-popover click)
  exercise the real-data wiring instead of the deleted fixture adapter.
  Concretely:
  - `installRuntimeMock` is extended to intercept `'getAssignment'` (the new
    `useQuery` in `TaskHeatmapPage` calls `getAssignment({ courseId,
assignmentId })` via `callApi`).
  - `createHeatmapScenario` seeds a schema-valid `AssignmentFull` `getAssignment`
    payload whose `submissions[].studentId === '100000000005'` (Student Two)
    and whose `items` carry `taskId` values matching the existing
    `'task_001'` / `'task_002'` / `'task_003'` heatmap columns, plus a
    second identical `getAssignment` success entry so StrictMode
    double-effect does not exhaust the queue.
  - Artifact types are distributed **per task** (`task_001 → 'IMAGE'`,
    `task_002 → 'TEXT'`, `task_003 → 'TABLE'`), not per metric —
    reflecting the real-data wiring where one `StudentSubmissionItem`
    per `taskId` yields one `CellPreviewData` with one `artifactType`
    used for all three metric sub-columns of that task. The fixture
    adapter's per-`metricKey` `{image, text, table}` switch is
    structurally impossible under real-data wiring.
  - Each artifact supplies the full `BaseTaskArtifactFields`
    (`taskId, role, pageId, documentId, uid, contentHash, metadata`)
    plus the discriminant `type` and type-matching `content`. Each
    `assessments[key]` supplies both `score` and a non-empty `reasoning`
    per `AssessmentSchema`.
  - **Hover-target updates.** The four existing tests change their cell
    locators so each test hits the task carrying the matching artifact
    type:
    - IMAGE / completeness hover test — keep
      `'Student Two, task_001, Completeness: 5'` (task_001 IMAGE, score 5
      per `HEATMAP_SUBMISSION_SCORES['100000000005'].task_001.completeness`).
    - TEXT / accuracy hover test — change target from
      `'Student Two, task_001, Accuracy: 3'` to
      `'Student Two, task_002, Accuracy: 4'` so the test exercises
      `task_002` (TEXT-seeded). Replace the popover-content assertion at
      `task-preview-card.spec.ts` line 132 (currently
      `/preview cards work properly/i`, sourced from deleted
      `fixtures/textTask.json`) with an assertion against the
      deterministic `reasoning` string the seeded `AssignmentFull`
      provides at `task_002.accuracy.reasoning`.
    - TABLE / spag hover test — change target from
      `'Student Two, task_001, SPaG: 4'` to
      `'Student Two, task_003, SPaG: 5'` so the test exercises
      `task_003` (TABLE-seeded). Keep the `popover.locator('table')`
      structural assertion.
    - Pinned-popover click test — keep
      `'Student Two, task_001, Completeness: 5'` (task_001 IMAGE,
      unchanged).
  - The popover header aria-label assertion in `assertPopoverStructure`
    (`[aria-label^="${metricLabel} score:"]`) and the cell `aria-label`
    `${studentName}, ${taskId}, ${metricLabel}: ${score}` format are
    unchanged (the aria-labels were already keyed on `taskColumn.taskId`,
    not on the fixture adapter's internal `t_preview_*` identifiers —
    only the `taskId` value slot changes for the rewritten hover tests).
- No new E2E test files are created; the four existing `Task Preview Card
popover` tests are kept and adapted.

## V1 scope recommendation

### Include in v1

- `useQuery` in `TaskHeatmapPage` for on-demand assignment fetch.
- `buildCellPreviewLookup`, `assembleTaskPreviewData`, and
  `spreadsheetToMarkdownTable` helpers.
- Skeleton popover state during loading.
- Error `Alert` in popover.
- Refresh wrapping to refetch assignment query.
- Deletion of fixture files, fixture adapter, and fixture spec.
- E2E plumbing updates (`installRuntimeMock` `getAssignment` interception,
  `createHeatmapScenario` `AssignmentFull` seeding) and `task-preview-card.spec.ts`
  visible-content assertion updates so the existing four popover tests exercise
  real-data wiring instead of the deleted fixture adapter.

### Defer from v1

- Dedicated spreadsheet renderer component (v1 uses markdown table).
- Popover-level retry button.
- Assignment query retry on failure (`retry: false` stays as-is, matching the
  existing query options).

## Open questions

None.
