# Task Heatmap Specification

## Status

- Draft v2.0 — revised on the adjudicated architecture basis (see `HEATMAP_ARCHITECTURE_CRITIQUE.md` and `FILTERING_ARCHITECTURE_VERDICT.md`).
- v1.0 (the `FilterVisitor`/`FilterEngine`/`HeatmapTransform` design) is superseded. The data-filtering and analysis foundation below reuses the **existing** general-purpose pipeline rather than introducing a parallel engine.
- This feature is the v1 anchor for a broader, multi-axis analysis future (cohorts, topics, time ranges, student characteristics, cross-`ABClass` collections). The architecture is chosen so that future axes are _additive extensions_ of the existing infrastructure, not a rewrite.

## Purpose

This document defines the intended behaviour for the **Task Heatmap** — a reusable view that displays per-student, per-task assessment scores as a colour-coded table with a 2-row grouped header.

The feature will be used to:

- Show teachers a visual heatmap of student performance across tasks within a single assignment.
- Provide at-a-glance identification of strong/weak areas via colour coding.
- Serve as the first consumer of a general filtering + analysis layer that will later support multi-class, cohort, topic, time-range, and student-characteristic analysis **without re-architecting**.

This feature is **not** intended to:

- Replace the existing Student Averages table (which shows cross-assignment averages).
- Provide deep-dive assessment reasoning or feedback text.
- Support bulk operations or inline editing.
- Handle cross-class aggregation in v1 (the foundation supports it; the v1 surface does not expose it).

## Agreed product decisions

1. **Entry point:** Click a "Recent Assignment" card on ClassPage → navigate to Task Heatmap for that assignment.
2. **Navigation pattern:** Full page view within ClassPage (consistent with ClassPage ↔ ClassesPage pattern), driven by view state — no routing library.
3. **Scope:** Single assignment × single class for v1.
4. **Missing data:** Students who have not submitted a task show `'N'` (grey cell) — all students in the roster appear.
5. **Data shape:** `MetricResult` objects (the canonical discriminated union), reused unchanged.
6. **Cell rendering:** Extend `MetricPill` with a compact mode for the dense heatmap layout.
7. **Column sorting:** All columns sortable (student name, all metric sub-columns).
8. **Column filtering:** All metric sub-columns filterable by band (`red`/`gold`/`green`/`default`/`volcano`) — implemented as an Ant Design `Table` column-filter concern over derived `MetricResult`s, **not** as a data-layer filter.
9. **Breadcrumb:** Add "Task Heatmap" to the trail: Classes > [ClassName] > Task Heatmap.
10. **Accessibility:** Follow Ant Design principles; show numeric values in cells; add `aria-label`s.
11. **Icons:** Use lucide icons for metric column sub-headers: `ListTodo` (completeness), `Target` (accuracy), `SpellCheck` (SPaG).
12. **Filtering/analysis foundation:** Reuse the existing `AnalysisFilter` + `AveragingAnalyser` pipeline. For v1, single-assignment selection is performed at the **adapter** by deriving the assignment's `taskKey`s from `classFull`; the shared cross-assignment `analyserResult` (and its `perStudentTaskMetrics`) is reused unchanged, so Student Averages is unaffected. The `assignmentIds` filter field and analyser-level multi-assignment selection are **deferred** (see deferral note): the granular accumulator key `${definitionKey}::${taskId}` omits `assignmentId`, so multi-assignment selection requires re-keying `perStudentTaskAccums` by assignment first. The heatmap is a **projection** of analyser output, not a re-ingestion of `ClassFull`.

## Existing system constraints

### Backend or API constraints already in place

- `getABClass` returns `ClassFull` with `assignments[].submissions[].items[taskId].assessments.{completeness|accuracy|spag}.{score}` (`src/backend/...` per `classDetailService.zod.ts`).
- Partial hydration includes scores but omits reasoning text — sufficient for the heatmap.
- **No new backend endpoint is required for v1 or for the multi-class future** — the analyser is a pure frontend service. A backend **model** change IS required, however: `AssignmentDefinition.toPartialJSON()` must emit `taskId` + `taskTitle` per task (see "Backend changes required to support agreed behaviour" below). The consumer-facing partial-shape contracts (`AssignmentDefinitionPartialSchema.tasks`, embedded `classFull.assignments[].assignmentDefinition.tasks` — both are the same `TaskPartial[]`) and the warm-up responses are updated atomically with the model change. This makes the `AssignmentDefinitionPartials` `tasks` shape description in the next subsection a **target-state** description (post-`ACTION_PLAN.md` §7), not the current-state description — see "Recommended data shapes" and `ACTION_PLAN.md` §7 for the transitional work.

### Current data-shape constraints

- `ClassFull` is deeply nested: assignments → submissions → items → assessments.
- Assessment scores are `number | 'N'` (0–5 scale, `'N'` for not attempted).
- `MetricResult` discriminated union: `{ state: 'computed'|'notAttempted'|'error', value, totalWeight, applicableDataPoints, totalDataPoints }` (`dataAnalysis.zod.ts:82-112`).

### Frontend or consumer architecture constraints

- **One shared filter contract already exists:** `AnalysisFilterSchema` (`dataAnalysis.zod.ts:19-43`) with `classIds`, `dateRange`, `topicKeys`, `assignmentDefinitionKeys`, `criterionWeightings`. It is already **multi-class** (`AveragingAnalyserInput.classes: z.array(ClassFullSchema)`, `dataAnalysis.zod.ts:59`) and extensible via additional Zod fields.
- **One shared filter executor already exists:** `filterAssignments(cls, input)` (`averagingAnalyser.filters.ts:18-49`) builds `Set`s once and applies per-class predicates.
- **One shared analyser already exists:** `AveragingAnalyser.analyse` maps over `sortedClasses` (`averagingAnalyser.ts:69-71`). Its registry (`DataAnalysisService`, `dataAnalysisService.ts:21,32`) is typed `Map<string, AveragingAnalyser>` and emits `DataAnalysisResponse = AveragingResult[]` — i.e. **per-class results**.
- **The granular data the heatmap needs already exists internally:** `accumulateDataPoints` builds `perStudentTaskAccums: Map<string, Map<string, DataPointAccumulator>>` (`averagingAnalyser.accumulation.ts:268`), keyed by `studentId` (outer) and `${definitionKey}::${taskId}` (inner), populated by the _same_ `accumulateMetricsToTarget` path as every other scope (`criterionAccumulation.ts:172-181`). It currently is consumed as the rollup input for `buildPerTaskRows`/`buildPerStudentRows` (`averagingAnalyser.rows.ts`) but is not re-exposed at the per-(student, task) granularity.
- **One conversion path already exists:** `accumToMetric` (`averagingAnalyser.accumulation.ts:40-68`). The heatmap must reuse it — never re-implement "raw score → MetricResult".
- **Band filtering already has a proven UI pattern:** `studentAveragesTableColumns.tsx:110-116` applies `resolveMetricTone` inside an Ant Design `Table` `onFilter` predicate over `MetricResult`. The heatmap mirrors this exactly.
- **The ClassPage pipeline already runs the analyser:** `useClassPageData` calls `_analysisService.analyse({ filter: { classIds: [classId] }, ... })` (`useClassPageData.ts:117-124`) and owns the surface-state machine (`useClassPageData.ts:297-349`). The heatmap reuses this result rather than re-running analysis.

## Domain and contract recommendations

### Why this approach is preferable

- **One filter system, not two.** Selection is a value in the existing `AnalysisFilter`; a new axis (cohort, topic, time, student characteristic) is one optional Zod field + one `Set.has` clause in `filterAssignments`. No parallel `FilterEngine`.
- **One metric-computation path, not two.** The heatmap consumes `perStudentTaskMetrics` produced by the authoritative `accumToMetric` chain. There is no second implementation of `MetricResult` derivation to drift.
- **Band filters are a UI concern, not a data concern.** They operate over _derived_ `MetricResult` values and belong in the Ant Design `Table` column filter, exactly as the Student Averages table already does.
- **Selection before computation, projection after.** `AnalysisFilter` selects; `AveragingAnalyser` computes; a pure adapter projects. The adapter neither selects nor re-computes.
- **Multi-class by extension.** Because `classes` is already an array and `perStudentTaskMetrics` is emitted per `AveragingResult`, analysing across multiple `ABClass` collections means passing more classes into the same `analyse()` call and merging per-class results in the adapter. No rewrite of accumulation logic.

### Recommended data shapes

#### PerStudentTaskMetric (new canonical field on `AveragingResult`)

```ts
// Added to dataAnalysis.zod.ts — emitted per class, populated in analyseClass
// from perStudentTaskAccums via accumToMetric.
export const PerStudentTaskMetricSchema = z.strictObject({
  classId: z.string(),                 // disambiguates across merged ABClass collections
  studentId: z.string(),
  taskKey: z.string(),                 // `${definitionKey}::${taskId}`
  completeness: MetricResultSchema,
  accuracy: MetricResultSchema,
  spag: MetricResultSchema,
  overall: MetricResultSchema,
});

// AveragingResultSchema gains:
perStudentTaskMetrics: z.array(PerStudentTaskMetricSchema).optional(),
```

`classId` is included deliberately so the same granular model serves both v1 (single class) and the future cross-`ABClass` cohort view without key collisions.

#### Heatmap view model (adapter-local output type, NOT a new Zod trust-boundary family)

```ts
// Defined in the heatmap adapter module; inferred from MetricResult.
// No Zod re-declaration of MetricResult — reuse the canonical schema.
export interface HeatmapCell {
  completeness: MetricResult;
  accuracy: MetricResult;
  spag: MetricResult;
}

export interface HeatmapRow {
  studentId: string;
  studentName: string;
  cells: HeatmapCell[];
}

export interface HeatmapResult {
  assignmentId: string;
  assignmentName: string;
  className: string;
  rows: HeatmapRow[];
  taskColumns: Array<{ taskKey: string; taskId: string; taskTitle: string | null }>;
}
```

`PerStudentTaskMetric.overall` is retained (the accumulator already populates it, `criterionAccumulation.ts:172-181`) for future/other consumers; the v1 heatmap view model uses only the three criteria. `taskKey` is `${definitionKey}::${taskId}` (no `assignmentId` in v1 — see the multi-assignment deferral note).

Rationale: the heatmap view model is an internal projection. Re-declaring `MetricResult`-shaped Zod families (`TaskHeatmapCell`/`Row`/`Result`) would duplicate the canonical invariant and create drift. The adapter infers its types from `MetricResult` and validates only at the existing analyser boundary (`AveragingResultSchema`).

### Naming recommendation

Prefer:

- `perStudentTaskMetrics` — the granular analyser output field.
- `adaptMetricsToHeatmap` — the pure projection adapter.
- `assignmentIds` — the (deferred) `AnalysisFilter` field selecting one or more assignments.
- `HeatmapResult` / `HeatmapRow` / `HeatmapCell` — adapter-local view-model types.

Avoid:

- `FilterVisitor`, `FilterEngine`, `AssignmentFilterVisitor` — parallel filter system the codebase already supersedes.
- `HeatmapTransform` — implies re-ingesting `ClassFull`; the real work is projection of existing analyser output.
- `TaskHeatmapCell`/`TaskHeatmapRow`/`TaskHeatmapResult` as **Zod** families — redundant with `PerStudentTaskMetric` + `MetricResult`.

### Validation recommendation

#### Frontend

- `AnalysisFilter` is Zod-validated once at the `DataAnalysisService.analyse` trust boundary (already the case). The future `assignmentIds` field, when added for multi-assignment, will be validated there; it is intentionally not added in v1.
- `perStudentTaskMetrics` is validated as part of `AveragingResultSchema` (optional array).
- The `HeatmapResult` adapter output needs **no separate Zod boundary** — it is a structural projection of already-validated `MetricResult`s.
- Band-filter values are validated implicitly by the Ant Design `Table` `filters` enum (`MetricToneColor`).

#### Backend

- No changes. Existing `getABClass` response is sufficient.

### Display-resolution recommendation

- Band colours are resolved by `resolveMetricTone` (`metricTone.ts`) using its quartile formula, **not** by hardcoded thresholds. For the default 0–5 range the boundaries are `redAmber = 1.25` and `amberGreen = 3.75` (`metricTone.ts:131-133`). The earlier spec's `1.75`/`4.25` figures were incorrect and must not be copied.
- Scores displayed to 2 decimal places (`precision: 2`), matching ClassPage's existing `MetricPill` usage, in compact mode. **Compact mode** is a distinct `MetricPill` variant, separate from the existing `emphasised` variant: it renders at a reduced font size and tag size for the dense matrix while keeping `precision: 2`; it must not be conflated with `emphasised`.
- `'N'` displayed with muted styling; `'E'` displayed with `volcano` colour — both already produced by `resolveMetricTone`.

## Feature architecture

### Placement

- Task Heatmap lives as a **view** within ClassPage (not a top-level page).
- ClassPage manages view state: `selectedView: 'overview' | { type: 'heatmap', assignmentId: string }`.
- Entry point: `RecentAssignmentCard` `onClick`.

### Proposed high-level tree

```text
ClassesPage
└── ClassPage
    ├── [Overview view] (existing)
    │   ├── RecentAssignmentsSection
    │   │   └── RecentAssignmentCard (now clickable)
    │   └── StudentAveragesTableCard
    └── [Heatmap view] (new)
        └── TaskHeatmapPage
            └── TaskHeatmapTable
```

### Out of scope for this surface (v1)

- Cross-class aggregation / cohort views (foundation supports it; surface does not expose it).
- Student-level filtering, time-range filtering, topic filtering, student-characteristic filtering (each is a future `AnalysisFilter` field + filter clause).
- Multi-assignment heatmap. **Why deferred:** `perStudentTaskAccums` (and therefore `PerStudentTaskMetric.taskKey`) is keyed by `${definitionKey}::${taskId}` with no `assignmentId`. A future `assignmentIds` analyser-level filter would faithfully select assignments but silently merge per-student-task metrics across assignments that share a `definitionKey`. Enabling it requires re-keying `perStudentTaskAccums` (and `PerStudentTaskMetric.taskKey`) to include `assignmentId`, or maintaining per-assignment accumulator maps. The `assignmentIds` filter field is intentionally **not** added in v1 to avoid speculative, unused schema.
- Column reordering (drag to rearrange task columns).
- Persisting sort/filter preferences across sessions.
- Search, export, hover tooltips with full context, colour-blind pattern/texture overlays.

## Data loading and orchestration

### Required datasets or dependencies

- `ClassFull` — fetched via `getABClass(classId)` (existing `useClassPageData` query).
- `AssignmentDefinitionPartials` — warm-up-backed dataset (existing), typed `AssignmentDefinitionPartialsResponse` (`z.array` of `AssignmentDefinitionPartial`, not a map). Its `tasks` entries carry `taskId` and `taskTitle`; the heatmap column set and titles are sourced from here via `getAssignmentDefinitionPartial(partials, definitionKey)` in `assignmentDefinitionUtilities.ts`. The partial and full definition task shapes use `taskId` consistently. **Target-state note:** the `taskId` + `taskTitle` shape on the `tasks` array is the post-`ACTION_PLAN.md` §7 state; at the time this spec section was drafted, `TaskPartialSchema` (`taskPartial.zod.ts:15`) still carries `id` (no `taskTitle`). `ACTION_PLAN.md` §7 renames `id` → `taskId` and adds `taskTitle` (nullable). This subsection describes the contract after §7 lands, not the current live shape.
- `analyserResult` — already produced by `useClassPageData` (`useClassPageData.ts:117-124`).

### Prefetch or initialisation policy

#### Startup

- No additional prefetch. ClassPage already fetches `ClassFull` and runs the analyser.

#### Feature entry

- When the user clicks `RecentAssignmentCard`, ClassPage sets `selectedView` to the heatmap view with the chosen `assignmentId`.
- The heatmap view consumes the **already-computed** `analyserResult` (which now carries `perStudentTaskMetrics`). No second `analyse()` call is required for v1.
- `adaptMetricsToHeatmap(analyserResult: AveragingResult, classFull: ClassFull, assignmentId: string)` produces `HeatmapResult`. `analyserResult` is the single-class `AveragingResult` already produced by `useClassPageData` (not the `DataAnalysisResponse` array).
- The adapter filters `perStudentTaskMetrics` to the selected assignment's `taskKey`s and groups by `studentId`.

#### Manual refresh

- Reuse the existing ClassPage refresh (`useClassPageData.refetch`, `useClassPageData.ts:385-388`), which re-runs the query + dataset and therefore re-derives `perStudentTaskMetrics`.

### Query or transport additions

- None at the transport layer. No change to `AnalysisFilter` in v1; `assignmentIds` is a deferred addition (see multi-assignment deferral note).
- Reuse the existing `getABClass` query and `assignmentDefinitionPartials` dataset.

## Core view model or behavioural model

### Suggested shape

```ts
// PerStudentTaskMetric (canonical, on AveragingResult) — see data-shape section.
// HeatmapResult (adapter output) — see data-shape section.
```

### Derivation or merge rules

#### PerStudentTaskMetric

- One entry per `(classId, studentId, taskKey)` present in `perStudentTaskAccums`.
- Each `MetricResult` is `accumToMetric(accumulator.<criterion>)` — authoritative, identical to all other views.
- `overall` is included per (student, task) because `accumulateMetricsToTarget` already populates it on the per-student-task accumulator (`criterionAccumulation.ts:172-181`).

#### HeatmapRow

- One row per student in `ClassFull.students`.
- `cells` array derived from `perStudentTaskMetrics` for that student and the selected assignment, ordered to match `taskColumns`.
- Missing student–task combinations synthesise `notAttempted` cells (`'N'`) so the full matrix renders.

#### HeatmapResult

- `taskColumns` derived from the warm-up `assignmentDefinitionPartials` dataset, located by the selected assignment's `definitionKey` via `getAssignmentDefinitionPartial(partials, definitionKey)` (see `ACTION_PLAN.md` §7). Each column carries `taskKey` (`${definitionKey}::${taskId}`), `taskId`, and `taskTitle`, read directly from the partial's `tasks` (which carry `taskId` and `taskTitle`); the partial and full definition shapes use `taskId` consistently. The embedded `classFull.assignments[].assignmentDefinition.tasks` is NOT the column source: it carries the weight-summary shape and (for live data, pre-§7) no `taskTitle`. If the partial is missing for the `definitionKey`, or any non-empty column's `taskTitle` is `null`, `adaptMetricsToHeatmap` throws `TaskTitlesUnavailableError` (see the error-state section) — there is no `taskId`-only fallback for column headers.
  - `assignmentName` and `className` are derived from `classFull`: `assignmentName` is the `assignmentDefinition.primaryTitle` of the assignment in `classFull.assignments` whose `assignmentId` equals `assignmentId` (mirrors `classPageAdapter.ts:330`); `className` is `classFull.className`. When `classFull.className` is `null`, fall back to a static default label (reuse the `ClassPage.tsx` pattern, e.g. `pageContent.classDetail.heading`) because the view model is reused more widely.
- Only the selected assignment's tasks appear; the adapter selects them by locating the warm-up partial via the embedded `definitionKey` (using `getAssignmentDefinitionPartial`) and reading the partial's `tasks`.

### Sort order or priority rules

1. Default: `studentName` ascending.
2. Any metric sub-column sortable ascending/descending. Deterministic comparator: `computed` rows order by numeric `value` ascending; then `notAttempted` (`'N'`); then `error` (`'E'`) at the bottom. Ties within `computed` break by `studentId` ascending.
3. Tie-break: `studentId` ascending.

## Main user-facing surface specification

### Recommended components or primitives

- Ant Design `Table` with grouped headers (2-row header via the `children` column property).
- Ant Design `Card` for the page container.
- Ant Design `Tag` via extended `MetricPill` (compact mode) for cell rendering.
- Lucide icons for metric sub-headers.

### Fields, columns, or visible sections

1. **Student Name** (sticky first column; a top-level column with no `children`, so it automatically spans both grouped-header rows).
2. **Task Name** (spans 3 sub-columns each — Completeness, Accuracy, SPaG).
3. **Metric sub-headers** (lucide icons: `ListTodo`, `Target`, `SpellCheck`).
4. **Score cells** (colour-coded via `resolveMetricTone`, compact `MetricPill`).

### Sorting, filtering, or navigation rules

- All columns sortable (default: `studentName` ascending).
- All metric sub-columns filterable by band (`red`/`gold`/`green`/`default`/`volcano`) via the Ant Design `Table` `filters`/`onFilter` pattern mirrored from `studentAveragesTableColumns.tsx:110-116`, operating over `MetricResult`.
- Multi-column sorting is supported (Student Name has sort priority 1, each metric sub-column priority 2); this is the agreed v1 behaviour and intentionally does not reset to default on a third click.

### Rendering rules

#### Loading state

- Reuse ClassPage's surface-state machine (`useClassPageData.ts:297-349`); show skeleton matching the table structure; keep layout stable during refresh.

#### Empty state

- "No submissions yet" caption shown above a fully rendered roster: the table always renders every student row and every task column; when no submissions exist, every cell is `notAttempted` (`'N'`). (Distinct variant: if the assignment has zero tasks, no task columns render.)

#### Ready state

- 2-row grouped header; colour-coded cells; sticky first column; horizontal scroll for many tasks.

## Workflow specification

### Navigate to Task Heatmap

#### Eligible inputs or preconditions

- User is on ClassPage with class data loaded and at least one recent assignment visible.

#### Inputs, fields, or confirmation copy

- Click on `RecentAssignmentCard`. No confirmation required.

#### Behaviour

- ClassPage sets `selectedView` to `{ type: 'heatmap', assignmentId }`.
- Breadcrumb updates to include "Task Heatmap".
- `TaskHeatmapPage` renders from `adaptMetricsToHeatmap(analyserResult, classFull, assignmentId)`.
- Back navigation returns to ClassPage overview.

### Return to ClassPage Overview

#### Eligible inputs or preconditions

- User is on the Task Heatmap view.

#### Inputs, fields, or confirmation copy

- Click "Back" or the breadcrumb "Classes > [ClassName]".

#### Behaviour

- ClassPage sets `selectedView` to `'overview'`; breadcrumb reverts; overview renders with existing data.

## Error, loading, and empty-state rules

### Blocking failure

- Reuse ClassPage's blocking `Alert` (query/dataset/service errors). Hide table content during blocking state.

### Partial-load or partial-success failure

- **Not applicable in v1.** The surface-state machine is only `loading | blocking | ready` (`useClassPageData.ts:87-90`) and the analyser is a pure synchronous computation, so there is no partial-load status. Submission gaps surface as `notAttempted`/`error` `MetricResult` cells, not a load warning. Deferred until a concrete per-task fetch-error trigger exists (the heatmap layout spec marks the corresponding `Alert` as not implemented in v1).

### Empty states

#### No submissions

- Fully rendered roster with `'N'` cells and a "No submissions yet" caption (not a replacement for the table); if the assignment has zero tasks, no task columns render.

#### Assignment not found

- Effectively unreachable in v1 (the `assignmentId` always originates from a validated clicked card). If it ever occurs, auto-navigate back to ClassPage overview with **no in-view error message**: `adaptMetricsToHeatmap` throws, `TaskHeatmapPage` catches it, logs via the frontend logger (`src/frontend/src/logging/frontendLogger.ts`, context `'TaskHeatmapPage'`), and calls `onBack` (see `ACTION_PLAN.md` Section 5). Do not render an in-view `Alert`.

#### Task titles unavailable (v1 behaviour change)

- When the warm-up `assignmentDefinitionPartials` dataset is missing the partial for the assignment's `definitionKey`, OR the located partial contains a `tasks` entry whose `taskTitle` is `null` (e.g. legacy data with no title), the heatmap renders an **in-view Ant Design `Alert`** (`type="error"`, message "Task titles are currently unavailable.", description "Please try reloading the page.") in place of the table region, and does **not** auto-navigate. This is distinct from "Assignment not found" above: a missing title is a data-completeness defect the user must see, whereas an unknown `assignmentId` is unreachable in v1 and is best handled by silently returning to the overview.
- `adaptMetricsToHeatmap` throws `TaskTitlesUnavailableError` **before** `taskColumns` is built (`buildTaskColumns` runs after the partial lookup); `TaskHeatmapPage` distinguishes this error type from the unknown-`assignmentId` case in its catch, renders the `Alert` in place of the table region (the header `Card` with assignment name + class name + Back stays visible; no `TaskHeatmapTable` mounts; no Student Name column renders; Back and Refresh remain functional), and does **not** call `onBack`. There is no `taskId`-only fallback for column headers.
- If the assignment has zero tasks (the located `partial.tasks: []`), this is the normal zero-tasks empty state — `taskColumns: []`, no error is shown (see "No submissions" above). Note that a missing partial is NOT the zero-tasks empty state (it is the `TaskTitlesUnavailableError` case above).

## Accessibility and usability notes

- All cells show numeric values (not colour alone).
- `aria-label` on each cell: "[Student Name], [Task ID], [Metric]: [Score]" (the task is identified by `taskId`; `taskTitle` is shown in the column header when the partial provides one — see `TASK_HEATMAP_LAYOUT.md`).
- Keyboard navigation via Ant Design `Table` (arrow keys).
- Focus visible on interactive elements.
- Reduced motion: no cell animation on filter/sort.

## Backend changes required to support agreed behaviour

`AssignmentDefinition.toPartialJSON()` (backend `Models/AssignmentDefinition.js`) must emit each task as `{ taskId: task.id, taskWeighting, taskTitle: task.taskTitle }` — adding `taskTitle` to the partial task shape and renaming the identifier field from `id` to `taskId` so the partial and full definition task shapes are consistent. This flows to both `getAssignmentDefinitionPartials` and the embedded `assignmentDefinition` in `getABClass`, and to registry persistence (no new endpoint is required). The `getABClass` response shape and the pure frontend `DataAnalysisService` remain otherwise sufficient for v1 and the multi-class future.

## Planning handoff notes

- **Ordering:** populate `perStudentTaskMetrics` on `AveragingResult` **before** writing `adaptMetricsToHeatmap` **before** the `TaskHeatmapTable`. `AnalysisFilter`/`filterAssignments` are unchanged in v1 (no `assignmentIds`); any future filter-axis extension is sequenced after the multi-assignment re-keying work. **See also `ACTION_PLAN.md` §§7–8:** a blocking bug discovered after Sections 1–5b were implemented required re-sourcing the heatmap column set and titles from the warm-up partial (via `getAssignmentDefinitionPartial`) instead of the embedded `assignmentDefinition.tasks`. Section 7 (rename `TaskPartial.id` → `taskId` + add `taskTitle` + helper) precedes Section 8 (adapter rewrite + prop-thread + `TaskTitlesUnavailableError`); the two are paired so the tree never breaks between them. Read `ACTION_PLAN.md` §"Suggested implementation order" for the authoritative sequencing.
- **MetricPill compact mode** must land before `TaskHeatmapTable`.
- **ClassPage view-state and breadcrumb wiring** must land before navigation is exercised.
- **A frontend layout spec is still required** (new view, new grouped-header table). The existing `TASK_HEATMAP_LAYOUT.md` must be reconciled with this architecture: its data-source section should describe projection from `perStudentTaskMetrics` rather than a `HeatmapTransform` re-walk of `ClassFull`.
- **Multi-class extension hook:** new analysis axes are added as `AnalysisFilter` fields + `filterAssignments` clauses; cross-`ABClass` views are adapter merges of per-class `perStudentTaskMetrics`. Do not reintroduce a parallel filter engine.

## Testing expectations

- Unit tests for `perStudentTaskMetrics` population in `analyseClass` (including `overall` and `notAttempted`/`error` states). `filterAssignments` is intentionally **unchanged** in v1; the future `assignmentIds` clause is deferred with the multi-assignment work (see deferral note).
- Unit tests for `adaptMetricsToHeatmap` (matrix build, missing student–task synthesis, assignment filtering, task ordering).
- Unit tests for extended `MetricPill` (compact mode).
- Unit/component tests for `TaskHeatmapTable` (grouped header, sorting, band filtering via `onFilter`).
- Integration test confirming the heatmap reuses `useClassPageData`'s `analyserResult` (no duplicate `analyse()` for v1).
- E2E tests for navigation flow (ClassPage → Task Heatmap → back).

## Documentation and rollout notes

- Update `TASK_HEATMAP_LAYOUT.md` data-source section to the projection model.
- Add a note to the data-analysis docs recording that `perStudentTaskMetrics` is the canonical granular output and that band filters are a UI concern.
- (Out of scope) `SPEC_CLASS_PAGE.md` and `CLASS_PAGE_LAYOUT.md` are referenced by existing class-page code JSDoc but do not currently exist in the repo; updating them is pre-existing documentation debt and is **not** part of this feature's rollout.

## V1 scope recommendation

### Include in v1

- Single-assignment selection at the adapter (derive the assignment's `taskKey`s from `classFull`); `AnalysisFilter`/`filterAssignments` unchanged in v1.
- `perStudentTaskMetrics` field on `AveragingResultSchema`, populated in `analyseClass`.
- `adaptMetricsToHeatmap` pure adapter (~150–250 lines).
- Reuse of `useClassPageData`'s `analyserResult` (no parallel hook needed for v1).
- Extended `MetricPill` with compact mode.
- `TaskHeatmapTable` with grouped headers, sorting, and band filtering.
- ClassPage navigation wiring, breadcrumb updates, view state.
- Accessibility and loading/empty/error states via the existing surface-state machine.

### Defer from v1

- Cross-class / cohort heatmap (foundation ready; adapter merge deferred).
- Student-level, time-range, topic, and student-characteristic filtering (each = `AnalysisFilter` field + clause).
- Multi-assignment heatmap.
- Search, export, hover tooltips, colour-blind pattern/texture overlays.

## Resolved decisions

The following were open during drafting and are now settled:

1. **Column reordering** — Not supported in v1; task columns render in stable assignment order.
2. **Persisting sort/filter preferences across sessions** — Not supported in v1.
3. **Compact `MetricPill` precision** — Render to **2 decimal places** (`precision: 2`), matching ClassPage's existing `MetricPill` usage (not whole numbers).
