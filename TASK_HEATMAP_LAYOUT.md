# Task Heatmap Layout Specification

## Purpose

This document defines the explicit layout, component hierarchy, workflow surfaces, and user-visible states for the **Task Heatmap** view.

Use it alongside:

- `SPEC.md` — domain rules, contracts, and scope boundaries
- `ACTION_PLAN.md` — implementation sequencing

This document is intentionally UI-focused. It does not replace the underlying feature spec, backend contracts, or implementation plan.

## Scope of this document

This document covers:

1. The page hierarchy for the Task Heatmap view within ClassPage
2. The major visible regions inside the surface
3. The preferred UI components for each region
4. The user-visible states of the main surface
5. Responsive, accessibility, and motion expectations

This document does **not** redefine:

- Backend contracts already settled in `SPEC.md`
- Rollout or sequencing decisions already settled in `ACTION_PLAN.md`
- Shared frontend policies already defined in canonical developer docs

## Design principles

1. Keep the owning page (ClassPage) thin — Task Heatmap is a view, not a new route.
2. Preserve the existing navigation model (state-driven, no routing library).
3. Use Ant Design Table's native grouped-header support — no custom header hacks.
4. Keep colour coding supplemented with numeric values for accessibility.
5. Maintain layout stability during filter/sort operations.

## Ant Design references consulted

- [Table](https://ant.design/components/table) — grouped headers via `children`, fixed columns, sorting, filtering
- [Card](https://ant.design/components/card) — page container
- [Tag](https://ant.design/components/tag) — cell rendering (via MetricPill)
- [Breadcrumb](https://ant.design/components/breadcrumb) — navigation trail
- [Empty](https://ant.design/components/empty) — empty state
- [Skeleton](https://ant.design/components/skeleton) — loading state
- [Alert](https://ant.design/components/alert) — error state
- [Flex](https://ant.design/components/flex) — layout composition
- [Space](https://ant.design/components/space) — spacing
- [Input](https://ant.design/components/input) — search by student name (deferred from v1 — see SPEC.md)
- [Tooltip](https://ant.design/components/tooltip) — cell hover details (future)

## Surface hierarchy

```text
ClassesPage
└── ClassPage
    └── TaskHeatmapPage (new view)
        ├── Header region (assignment name, back button)
        ├── Control region (refresh)
        └── Table region (heatmap table)
```

This is the only supported entry point: clicking a RecentAssignmentCard on ClassPage.

## No extra navigation layers

The Task Heatmap view should avoid nested tabs, nested routes, or accordions-as-navigation.

Rationale:

- The view has a single purpose: display the heatmap table
- Adding navigation layers would weaken clarity for a focused view
- Implementation simplicity: state-driven view switch in ClassPage is sufficient

## Recommended page skeleton

```text
TaskHeatmapPage
└── Flex (vertical, gap: 16)
    ├── Breadcrumb (updated trail)
    ├── Card (header region)
    │   ├── Flex (justify: space-between)
    │   │   ├── Typography.Title (assignment name)
    │   │   └── Button (back to ClassPage)
    │   └── Typography.Text (className, secondary)
    ├── Card (control region)
    │   ├── Flex (justify: space-between)
    │   │   └── Button (refresh)
    │   └── (future: search by student name; metric band filters live in column headers)
    └── Card (table region)
        └── Table (heatmap with grouped headers)
```

## Recommended top-level UI components

### 1. `Card` (header)

Use `Card` for:

- Displaying assignment name and class name
- Providing back navigation button

Reason:

- Consistent with existing ClassPage card pattern
- Provides clear visual separation for header content

### 2. `Card` (control)

Use `Card` for:

- Refresh button (v1)
- Future: search by student name (deferred from v1 per `SPEC.md`)

Reason:

- Groups interactive controls in a distinct region
- Consistent with StudentAveragesTableCard pattern

### 3. `Card` (table)

Use `Card` for:

- Containing the heatmap table
- Providing visual boundary for the data surface

Reason:

- Consistent with existing card-based layout
- Supports loading/empty/error states within the card

## Region-by-region design

Each major visible region of the heatmap view is specified below.

## 1. Header region

### Components

- `Card` (size="small")
- `Typography.Title` (level 4)
- `Typography.Text` (secondary)
- `Button` (type="text", icon: ArrowLeftOutlined)

### Content

- Assignment name (from `HeatmapResult.assignmentName`)
- Class name (from `HeatmapResult.className`)
- Back button (returns to ClassPage overview)

### States

The header region renders only when the heatmap view is mounted (i.e. `surfaceState.status === 'ready'`). Loading and blocking states are owned by the ClassPage surface-state machine upstream.

1. **Ready**
   - Assignment name as title
   - Class name as secondary text
   - Back button functional
2. **Error (assignment not found)** — Effectively unreachable in v1: the `assignmentId` always originates from a clicked `RecentAssignmentCard`, validated by ClassPage against the loaded class. If it ever occurred, follow `SPEC.md`: auto-navigate back to ClassPage overview. Do not render an in-view error message. Handler: `TaskHeatmapPage` wraps `adaptMetricsToHeatmap` in a `try`/`catch`, logs the error via the frontend logger (`src/frontend/src/logging/frontendLogger.ts`, context `'TaskHeatmapPage'`), and calls `onBack` (see `ACTION_PLAN.md` Section 5); no in-view `Alert` is rendered.
3. **Error (task titles unavailable)** — A data-completeness defect, reachable in v1: the warm-up `assignmentDefinitionPartials` dataset is missing the partial for the assignment's `definitionKey`, or a task has no `taskTitle`. `adaptMetricsToHeatmap` throws `TaskTitlesUnavailableError` **before** `taskColumns` is built (see `SPEC.md` error-state section). Handler: `TaskHeatmapPage` distinguishes this error from "assignment not found" in its catch and renders the header `Card` unchanged (assignment name + class name + Back), then **replaces the control-region and table-region `Card`s with a single Ant Design `Alert`** (`type="error"`, `showIcon`, `message="Task titles are currently unavailable."`, `description="Please try reloading the page."`). No `TaskHeatmapTable` mounts, no Student Name column renders, and `onBack` is NOT invoked automatically. Back and Refresh remain functional (Back returns to the overview; Refresh re-runs `useClassPageData.refetch`). This is distinct from "assignment not found", which silently returns to the overview. The earlier wording "the table region stays visible" is superseded: `taskColumns` is never built when this error throws, so there is no table to render — the `Alert` replaces the table region entirely.

### Notes

- Back button triggers the ClassPage view-state setter (e.g. `setSelectedView('overview')`)
- Header region is always visible, even during table loading

## 2. Control region

### Components

- `Card` (size="small")
- `Flex` (justify: "space-between", align: "center")
- `Button` (refresh icon)

### Content

- Refresh button: re-runs the shared ClassPage pipeline (`useClassPageData.refetch`), re-deriving `analyserResult` and therefore `HeatmapResult`
- (Metric band filters already live in the column headers in v1; search by student name is deferred — see `SPEC.md`)

### States

1. **Ready**
   - Refresh button enabled
2. **Loading**
   - Refresh button shows loading spinner
3. **Error**
   - Refresh button enabled (retry)

### Notes

- Search by student name is **deferred** from v1 (see `SPEC.md`); the control region contains only the refresh action in v1.
- Refresh re-runs the shared ClassPage pipeline (`useClassPageData.refetch`), which re-derives `analyserResult` and therefore `HeatmapResult`.

## 3. Table region (heatmap)

### Components

- `Card` (size="small")
- `Table` (Ant Design, grouped headers)

### Core features to use

- `rowKey`: `studentId`
- `fixed: 'start'` on student name column
- `children` property for 2-row grouped header
- `sorter` on all columns — Student Name uses `compareHeatmapStudentName` (a `HeatmapRow`-compatible wrapper around `compareStudentNames`); each metric sub-column uses a SPEC-ordered comparator (computed by numeric `value` ascending; then `notAttempted`; then `error`; tie-break `studentId` ascending)
- `filters` / `onFilter` on all metric columns
- `scroll={{ x: 'max-content' }}` for horizontal scroll
- `pagination={false}` (all rows visible)
- `bordered` for grid lines

### Recommended columns

```text
[Student Name]  [Task 1]                    [Task 2]                    ...
                [Completeness] [Accuracy] [SPaG] [Completeness] [Accuracy] [SPaG] ...
```

Column structure:

1. **Student Name**
   - `fixed: 'start'` with an explicit `width` (e.g. 200) for reliable sticky rendering
   - Spans both grouped-header rows automatically as a top-level column (no `children`); use `fixed: 'start'` + explicit `width` for stickiness
   - `sorter: { compare: compareHeatmapStudentName, multiple: 1 }` where `compareHeatmapStudentName` mirrors the locale-aware logic of `compareStudentNames` (from `./classPageModel`) via a `HeatmapRow`-compatible comparator or thin wrapper — do **not** import the `StudentAverageRowModel`-typed `compareStudentNames` directly, as the row shape differs
   - `defaultSortOrder: 'ascend'`

2. **Task Name** (repeated for each task)
   - `children: [Completeness, Accuracy, SPaG]`
   - `title: taskId` (taskTitle is `null` in v1 per `SPEC.md`; the header falls back to the task identifier)

3. **Metric sub-header** (under each task)
   - `title:` Lucide icon + metric name (e.g., `<ListTodo /> Completeness`)
   - `sorter: { compare: compareHeatmapMetric, multiple: 2 }` where `compareHeatmapMetric` implements the SPEC ordering (computed by numeric `value` ascending; then `notAttempted`; then `error`; tie-break `studentId` ascending)
   - `filters: METRIC_COLUMN_FILTERS` (red/gold/green/default/volcano)
   - `onFilter:` resolveMetricTone-based predicate
   - `render:` Compact MetricPill

### Cell rendering

Each cell uses the extended `MetricPill` with `compact={true}`:

```tsx
<MetricPill metric={metricResult} compact={true} />
```

Compact mode:

- Smaller font size (12px vs 14px)
- Reduced padding (2px 4px vs 4px 8px)
- Same colour logic via `resolveMetricTone`
- Shows numeric value to 2 decimal places (`precision: 2`, matching ClassPage), 'N' for `notAttempted`, or 'E' for `error`
- `compact` is a new `MetricPill` variant to be added before `TaskHeatmapTable` (per `SPEC.md`); it does not yet exist on `MetricPill`

### States

1. **Initial load / blocking** — Handled by the ClassPage surface-state machine **before** the heatmap view mounts. ClassPage renders the skeleton (matching this table structure) or a blocking `Alert` while `surfaceState.status` is `loading`/`blocking`; the heatmap view mounts only when `surfaceState.status === 'ready'` and `analyserResult` exists. Do **not** re-implement a first-load skeleton inside the view.

2. **Ready with data**
   - 2-row grouped header
   - Colour-coded cells
   - Sticky first column
   - Horizontal scroll for many tasks

3. **Ready with no data**
   - "No submissions yet" caption shown above the fully rendered roster (every student row and task column; all cells `'N'`) — not a replacement for the table; if the assignment has zero tasks, no task columns render
   - Show class roster with 'N' for all cells

4. **Partial-load warning** — **Not implemented in v1.** The pipeline is a pure synchronous computation; submission gaps surface as `notAttempted`/`error` `MetricResult` cells, not a load warning, and the surface-state machine has no partial status. Deferred until a concrete per-task fetch-error trigger exists.

5. **Blocking failure**
   - Alert with retry button
   - Table hidden

### Notes

- Data source: the table consumes `HeatmapResult`, produced by `adaptMetricsToHeatmap` from the existing `analyserResult` (`AveragingResult`) already computed by `useClassPageData`. Selection of the single assignment is performed in the adapter by deriving `taskKey`s from `classFull`; there is no separate data fetch and no `HeatmapTransform` re-walk of `ClassFull` (see `SPEC.md`).
- Cell `aria-label`: "[Student Name], [Task ID], [Metric]: [Score]"
- Keyboard navigation via Ant Design Table (arrow keys)
- Focus visible on interactive elements
- Reduced motion: no cell animation on filter/sort

## Data-heavy regions

### Recommended components

- `Table` (Ant Design) — grouped headers, fixed columns, sorting, filtering
- `Tag` (via MetricPill) — colour-coded cells
- `Empty` — no-data state
- `Skeleton` — loading state

### Core features to use

- `rowKey="studentId"` — unique row identifier
- `fixed: 'start'` on student name column (with explicit `width`, e.g. 200) — sticky first column
- `children` on task columns — 2-row grouped header
- `sorter` on all columns — sortable (Student Name: `compareHeatmapStudentName`, a `HeatmapRow`-compatible wrapper around `compareStudentNames`; metric sub-columns: SPEC-ordered comparator)
- `filters` / `onFilter` on metric columns — filterable
- `scroll={{ x: 'max-content' }}` — horizontal scroll
- `pagination={false}` — all rows visible
- `bordered` — grid lines

### Recommended columns

1. **Student Name**
   - dataIndex: `'studentName'`
   - fixed: `'start'`
   - Spans both grouped-header rows automatically as a top-level column (no `children`)
   - sorter: { compare: compareHeatmapStudentName, multiple: 1 } (mirror the locale-aware logic of `compareStudentNames` from `./classPageModel` via a `HeatmapRow`-compatible comparator — not a direct import)
   - defaultSortOrder: `'ascend'`

2. **Task columns** (repeated per task)
   - title: taskId (taskTitle is null in v1; see SPEC.md)
   - children:
     - Completeness (icon: ListTodo)
     - Accuracy (icon: Target)
     - SPaG (icon: SpellCheck)

### States

1. **Initial load in progress** — Owned by the ClassPage surface-state machine (see Table region). The heatmap view mounts only in `ready`; no in-view skeleton.

2. **Ready with data**
   - Full table with grouped headers
   - Colour-coded cells
   - Sticky first column
   - Sort/filter controls active

3. **Ready with no data**
   - Fully rendered roster: every student row and task column, all cells `'N'`
   - "No submissions yet" caption above the table (not a replacement for it)
   - Distinct variant: if the assignment has zero tasks, no task columns render

4. **Partial-load warning** — Not implemented in v1 (see Table region note).

5. **Blocking failure**
   - Error alert with retry
   - Table hidden

### Notes

- Rows sorted by studentName (default) or any column (user-controlled)
- Filtered rows maintain sort order
- Cell hover: future Tooltip with full context (deferred from v1)

## Responsive behaviour

- **Narrow widths:** Horizontal scroll via `scroll={{ x: 'max-content' }}`
- **Sticky first column:** Student names remain visible during horizontal scroll
- **Column collapse:** No column collapse — all columns visible, scroll horizontally
- **Minimum action visibility:** Back button and Refresh always visible

## Accessibility and motion

### Focus management

- Tab order: Back button → Table → Refresh button
- Table supports arrow key navigation (Ant Design built-in)

### Keyboard interaction

- Enter/Space on Back button: navigate to ClassPage overview
- Arrow keys in Table: navigate cells
- Enter on column header: toggle sort

### Screen reader labelling

- Each cell: `aria-label="[Student Name], [Task ID], [Metric]: [Score]"`
- Table: `aria-label="Task Heatmap"`
- Back button: `aria-label="Back to Class overview"`

### Reduced motion

- No cell animation on filter/sort
- No transition on colour changes
- Respect `prefers-reduced-motion` media query

## Implementation guardrails

- Do not introduce alternative entry points (only via RecentAssignmentCard)
- Do not duplicate domain rules here (keep in SPEC.md)
- Do not add bespoke layout abstractions (use Ant Design primitives)
- Do not hide error states inside transient surfaces
- Keep layout decisions aligned with existing ClassPage patterns

## Resolved decisions

These were open during drafting and are now settled (see `SPEC.md` → Resolved decisions):

1. **Column reordering** — Not supported in v1; task columns render in stable assignment order.
2. **Persisting sort/filter preferences across sessions** — Not supported in v1.
3. **Compact `MetricPill` precision** — 2 decimal places (`precision: 2`), matching ClassPage.
