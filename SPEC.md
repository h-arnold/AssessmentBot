# Sticky Table Scroll and Frozen Student-Name Columns Specification

## Status

- Draft v1.0 — planned for GitHub issue h-arnold/AssessmentBot#344 ("Keep horizontal scrollbar at the bottom of the screen").
- Covers the Student Averages table and the Task Heatmap table on every current surface that renders them.

## Purpose

This document defines the intended behaviour for keeping a wide student table's horizontal scrollbar reachable at the bottom of the viewport and keeping the student-name columns visible during horizontal scrolling.

The feature will be used to:

- let a teacher pan across a wide table without first scrolling to the table's end;
- keep each student's identity visible while comparing metric and task columns;
- give the Student Averages table and the Task Heatmap the same scrolling behaviour on every surface that renders them.

This feature is **not** intended to:

- change how scores are calculated, sorted, filtered, or displayed;
- introduce internal vertical table scrolling or a fixed-height table region;
- change row counts, page sizes, or pagination behaviour;
- change backend, transport, persistence, validation, or data shapes;
- alter tables that do not display student names;
- restyle the application's global scrollbars.

## Agreed product decisions

1. **Scroll model.** Each affected table uses the Ant Design `Table` `sticky` behaviour. The document continues to scroll vertically; no table gains a fixed-height internal vertical scroll region.
2. **Sticky header accepted.** The table header pins to the top of the viewport while the table is being read. The application header scrolls with the document, so the header offset is `0`.
3. **Surface scope.** The behaviour applies to:
   - Student Averages on the Class page;
   - the Task Heatmap embedded in the Class page assignment view;
   - the Task Heatmap on the standalone Heatmaps page.
4. **Frozen name columns.** Forename and Surname are fixed at the start of both tables and remain visible during horizontal scrolling. Their widths and order are unchanged (`104px` and `96px`).
5. **No non-fixed variant.** Both current consumers require fixed name columns, so the shared column builder always emits fixed columns and no longer offers a configurable non-fixed mode.
6. **No dynamic row-count adaptation.** The number of visible rows is not adjusted to fit the viewport.
7. **Existing table controls unchanged.** Search, sorting, metric range filters, cell previews, pagination, and empty states keep their current behaviour.
8. **Split-header structure accepted.** Ant Design renders a sticky table as a separate header table and body table. Column headers stay in the accessibility tree in the header table. When an `aria-label` is supplied, Ant Design 6.6.7 copies it onto both tables, so the accessible name resolves to two table elements; the Task Heatmap table is affected, while the Student Averages table remains unnamed because it supplies no label. This is Ant Design's standard fixed-header posture and is accepted for this change. Every locator that resolves the Task Heatmap table by accessible name, and every column-header locator scoped through either table's table role locator, is migrated to wrapper-, holder-, or structurally scoped locators.

## Existing system constraints

### Backend or API constraints already in place

- No backend or API change is required. All affected surfaces render from data already loaded by the existing services.

### Current data-shape constraints

- No validation schema, persistence model, API contract, or transport shape changes.

### Frontend or consumer architecture constraints

- The frontend uses Ant Design `6.6.7`, which provides the `Table` `sticky` prop.
- Enabling `sticky` switches Ant Design from a single-table render to a split render: a `.ant-table-header.ant-table-sticky-holder` element containing its own `<table>`, a `.ant-table-body` element containing the body `<table>`, and a `.ant-table-sticky-scroll` element for the sticky bar. `scroll.x`, which both tables already set, supplies the horizontal scroll region and lets the sticky bar render when the content overflows. When the table supplies an `aria-label`, Ant Design 6.6.7 propagates that label to both the header and body tables, so the accessible name resolves to two table elements. The Task Heatmap table supplies `aria-label="Task Heatmap"`; the Student Averages table supplies no label, so both of its tables are unnamed.
- The sticky bar and the pinned header are positioned against the nearest scrolling ancestor. The document must remain the scroll container for both tables; no ancestor between either table and the document may introduce an `overflow` scroll container or a clipping container (`overflow: hidden` or `clip`). A clipping ancestor becomes the sticky containing block and silently disables pinning. A mid-tree scroll container becomes the sticky containing block, so the header and bar pin to that container's edges while Ant Design still decides bar visibility against the window viewport, producing a pinning and visibility mismatch. The document must therefore remain the only scroll container.
- Both tables already set `scroll={{ x: 'max-content' }}`, which supplies the horizontal overflow and is required for fixed columns.
- The Student Averages table currently requests non-fixed name columns. The Task Heatmap table currently requests fixed name columns.
- Both heatmap surfaces render the same table component, so the embedded and standalone heatmaps share one implementation path.
- The application header participates in normal document flow; it is not fixed. Header and scroll offsets therefore default to `0`.
- The fluid-width exception for heatmap pages and panels stays in force: the table keeps its own horizontal scrolling, and the page must not gain document-level horizontal overflow.
- The Task Heatmap feature must not import from the Class page feature. The shared student-name column module is the permitted common owner.

## Behaviour contract

### Sticky horizontal scrollbar

The table's horizontal scroll region is the `.ant-table-body` element that owns the table's local horizontal overflow. The sticky header element and the pagination row sit outside this scroll region.

1. The sticky bar is rendered only when the table has horizontal overflow (the scroll region's `scrollWidth` exceeds its `clientWidth`).
2. The sticky bar is visible only while the scroll region's top is above the viewport bottom and its bottom is more than one native scrollbar height below the viewport bottom.
3. The bar starts hidden until Ant Design's first scheduled visibility check has run, so presence must be polled rather than asserted synchronously.
4. While visible, the sticky bar is pinned to the viewport bottom with a zero bottom offset and spans the scroll region's visible width.
5. The sticky bar is hidden when:
   - the table has no horizontal overflow;
   - the table scroll region is entirely below the viewport;
   - the table scroll region is entirely above the viewport;
   - the table scroll region's bottom edge is within one native scrollbar height of the viewport bottom, so the table's own horizontal scrollbar is visible.
6. Dragging the sticky bar scrolls the table's scroll region horizontally, and the bar's thumb position stays synchronised with the scroll region.
7. The table's own horizontal scrollbar remains available at the table's end; the sticky bar supplements it rather than replacing it.
8. The sticky bar is `.ant-table-sticky-scroll`; its thumb is `.ant-table-sticky-scroll-bar` and is proportionally narrower than the track when the table is wider.

### Sticky header

1. While the table is read and its header would pass the top of the viewport, the header pins to the viewport top with a zero top offset.
2. Header grouping, column titles, sort controls, and filter controls keep their current content and behaviour while pinned.
3. The header unpins at the table container's bottom edge; it never detaches from the table's own vertical span. The container extends past the scroll region by the sticky bar's height while the bar is rendered, so unpin assertions allow that tolerance.
4. The header renders in the separate `.ant-table-header.ant-table-sticky-holder` table. Header cells remain in the accessibility tree with their existing names and roles, but they are no longer contained by the table that holds the rows. When the source table supplies an `aria-label`, both the header and body tables carry it, so the label resolves to two table elements.

### Rendered DOM structure

```text
.ant-table-wrapper
└── .ant-table
    └── .ant-table-container
        ├── .ant-table-header.ant-table-sticky-holder
        │   └── header <table> (carries any supplied aria-label)
        ├── .ant-table-body (horizontal scroll region)
        │   └── body <table> (carries any supplied aria-label, rows and cells)
        └── .ant-table-sticky-scroll
            └── .ant-table-sticky-scroll-bar
```

The tree omits Ant Design's Spin wrappers (`.ant-spin-nested-loading` and `.ant-spin-container`) between `.ant-table-wrapper` and `.ant-table`; use descendant queries rather than direct-child assumptions. The pagination row renders outside the table container. The sticky bar is absent until Ant Design's first visibility check runs and is permanently absent when the table has no horizontal overflow. Tests and future layout work must use this structure rather than the previous single-table structure.

### Frozen student-name columns

1. Forename and Surname render as fixed start columns in both tables.
2. During horizontal scrolling, their header and body cells stay at the table's start edge while metric and task columns move.
3. Column widths, order, renderers, and sorters are unchanged.
4. Fixed columns do not widen the document or change the table's total scroll width.

## Feature architecture

### Placement

- Shared Forename/Surname column construction stays in `features/shared/studentNameTableColumns.tsx`. It is the permitted common owner for both tables and the standing requirement for every table that displays a student name.
- The Student Averages table stays in `features/classPage/StudentAveragesTableCard.tsx`.
- The Task Heatmap table stays in `features/taskHeatmap/TaskHeatmapTable.tsx` and is consumed by `TaskHeatmapPage` (Class page assignment view) and `HeatmapBuilderSurface` (standalone Heatmaps page).
- No new table wrapper component, hook, or CSS module is introduced. The behaviour is expressed through Ant Design `Table` props.

### Proposed high-level tree

```text
Class page
├── Class overview
│   └── Student Averages card
│       └── Table (sticky, fixed name columns)
└── Assignment heatmap view
    └── Task Heatmap card
        └── TaskHeatmapTable (sticky, fixed name columns)

Heatmaps page
└── Heatmap builder card
    └── TaskHeatmapTable (sticky, fixed name columns)
```

### Out of scope for this surface

- A fixed-height table region or internal vertical scrolling.
- A new shared table component or a bespoke scrollbar component.
- Changes to the Classes, Assignments, Settings, or Reference Data tables.
- Global scrollbar styling or theme changes.

## Data loading and orchestration

### Required datasets or dependencies

- None added. Every affected table consumes data it already receives.

### Prefetch or initialisation policy

#### Startup

- Unchanged.

#### Feature entry

- Unchanged.

#### Manual refresh

- Unchanged.

### Query or transport additions

- None.

## Core behavioural model

The table is illustrative; the normative rule is the complement of the visible rule. Hidden conditions take precedence over the visible row. The bar is hidden whenever the table has no horizontal overflow, the scroll region's top is at or below the viewport bottom, or the scroll region's bottom is at or above the viewport bottom plus one scrollbar height.

| Horizontal overflow | Table scroll region position                                | Sticky bar |
| ------------------- | ----------------------------------------------------------- | ---------- |
| No                  | Any                                                         | Hidden     |
| Yes                 | Entirely below the viewport                                 | Hidden     |
| Yes                 | Entirely above the viewport                                 | Hidden     |
| Yes                 | Partially visible in the upper viewport, bottom above it    | Hidden     |
| Yes                 | Crosses the viewport bottom (top above it, bottom below it) | Visible    |
| Yes                 | Bottom edge within one scrollbar height of viewport bottom  | Hidden     |

The sticky header has one condition: the table's header has passed the viewport top while the table container's bottom remains below the pinned header.

## Main user-facing surface specification

### Recommended components or primitives

- Ant Design `Table` with `sticky` enabled and `scroll` already set.
- Existing `Card` and `Typography` containers on each surface.
- Existing column header controls (sorting and metric range filters).

### Fields, columns, or visible sections

1. Student Averages: Forename, Surname, Completeness, Accuracy, SPaG, Average.
2. Task Heatmap: Forename, Surname, then task groups, each with Completeness, Accuracy, and SPaG sub-columns.

No columns are added, removed, reordered, or resized.

### Sorting, filtering, or navigation rules

- No change to sorting, filtering, search, or pagination.
- The pinned header keeps sort and filter controls operable.

### Rendering rules

#### Wide table with horizontal overflow

- The sticky bar is available at the viewport bottom while the table scroll region crosses the bottom edge.
- The header pins while scrolling.
- Forename and Surname stay visible at the start edge.

#### Table without horizontal overflow

- No sticky bar is shown.
- The header still pins when its natural position passes the viewport top and the table scroll region's bottom remains below it. Header pinning does not depend on horizontal overflow.
- Fixed name columns have no visible effect without horizontal overflow.

#### Table fully visible within the viewport

- No sticky bar is shown.
- The header does not pin because it never passes the viewport top.

## Workflow specification

### Horizontal navigation across a wide table

#### Eligible inputs or preconditions

- The table has horizontal overflow.
- The table scroll region crosses the bottom edge of the viewport.

#### Inputs, fields, or confirmation copy

- None. The sticky bar is a direct-manipulation affordance.

#### Behaviour

- The bar appears at the viewport bottom as the table scroll region crosses the bottom edge.
- Dragging the bar pans the table horizontally.
- The bar's thumb and the table's scroll position remain synchronised in both directions.
- Forename and Surname remain visible throughout the pan.
- When the table scroll region's bottom edge comes within one scrollbar height of the viewport bottom, the bar disappears and the table's own horizontal scrollbar is available at the table's end.

### Vertical reading with a pinned header

#### Eligible inputs or preconditions

- The table's header would pass the viewport top while rows remain below.

#### Inputs, fields, or confirmation copy

- None.

#### Behaviour

- The header pins at the viewport top.
- Sort and filter controls keep their current interaction and focus behaviour.
- The header unpins at the table container's bottom edge, allowing for the sticky bar's height while it is rendered.

## Error, loading, and empty-state rules

### Blocking failure

- Unchanged. The table is not rendered when the existing surface-level blocking state applies.

### Partial-load or partial-success failure

- Unchanged. Existing warning banners, status cells, and preview statuses keep their behaviour.

### Empty states

#### No submissions (Task Heatmap)

- Unchanged; the existing status paragraph remains above the table.

#### No matching search results (Student Averages)

- Unchanged; the existing empty locale remains on the table.

## Accessibility and usability notes

- The table's own scroll region remains available; the sticky bar is a pointer affordance and does not replace it.
- No new keyboard shortcut is introduced. Keyboard users keep the existing table and control behaviour.
- Fixed name columns remain in the accessibility tree with their existing header names and cell values.
- Header controls keep their accessible names and focus order while pinned.
- The split-header structure means the table holding the rows no longer contains column headers. Header cells remain exposed in the separate header table, which carries the same `aria-label` when one is supplied, so the accessible name resolves to two tables. This is Ant Design's standard fixed-header posture and is recorded as accepted in the agreed product decisions.
- The sticky bar's height comes from Ant Design's table tokens; no new spacing value is introduced.
- No new animation is added. Existing Ant Design transitions are unchanged, so reduced-motion behaviour is unchanged.

## Backend changes required to support agreed behaviour

None.

## Planning handoff notes

- Implement the scroll model with the Ant Design `Table` `sticky` prop on both table components. Do not add `scroll.y`, height measurements, or a fixed-height container.
- Leave header and scroll offsets at their Ant Design defaults (`0`). If the application shell later gains a fixed header or footer, the offsets must be revisited in the same change that introduces it.
- Both heatmap surfaces are covered by `TaskHeatmapTable`; do not add a second heatmap code path.
- Simplify the shared student-name column builder so both columns are always fixed; update both call sites and the canonical shared-helper document.
- A dedicated layout specification is required because the change alters visible scrolling behaviour and viewport-pinned regions.
- Expect and plan the split-header DOM change. Tests that probe `.ant-table-content` must move to `.ant-table-body`. Tests that resolve either table by accessible name (`getByRole('table', { name: 'Task Heatmap' })`, `getByLabelText`, or `queryByLabelText`) become ambiguous and must be replaced with structural bases. Wrapper or Card scoping alone does not disambiguate `table` or `row` roles, because both halves are inside the same wrapper.
  - Row and cell assertions base on the body table under `.ant-table-body`.
  - Column-header assertions base on the header table under `.ant-table-header.ant-table-sticky-holder`.
  - Wrapper scoping is valid only for roles that occur once per column, such as a named column header.
- The Student Averages table remains unnamed in both halves of the split render, so its locators must use the surrounding Card to find the wrapper and then the body or header structural base rather than an accessible name.
- Browser coverage must choose a narrow viewport height below the table scroll region's rendered height, measured at runtime, and scroll each table until it crosses the viewport bottom edge. The table's document top offset includes the surrounding page title, navigation cards, and selection or summary regions. The headless Playwright Chromium project hides native scrollbars, so Ant Design's cached scrollbar measurement is 0. Assert the hidden state by scrolling the scroll region's bottom edge to or above the viewport bottom; do not assert a one-scrollbar-height boundary unless the case launches a browser with visible scrollbars. No canonical-fixture generator change is expected.
- Browser end-to-end tests must prove the bar's viewport-bottom geometry, header pinning, fixed-column stability, and the absence of document-level horizontal overflow on all three surfaces. Poll for the bar's presence; do not assert it synchronously or exactly at the visibility boundary.
- No data-shape documentation update is required.

## Testing expectations

- Frontend unit/component coverage:
  - the shared column builder emits `fixed: 'start'` for Forename and Surname for both row types;
  - both table components render a sticky header holder when their table is in sticky mode;
  - column-header, row, and cell assertions are re-scoped in `TaskHeatmapPage.spec.tsx`, `HeatmapBuilderSurface.spec.tsx`, `ClassPageHeatmapView.spec.tsx`, and the heatmap half of `studentNameTableColumns.spec.tsx`, because `getByRole('table', { name: 'Task Heatmap' })` and `getByLabelText('Task Heatmap')` resolve to both the header and body tables after the split. In `studentNameTableColumns.spec.tsx`, anchor structural `col` and row probes to the body table so the header colgroup is not measured by mistake. The class-side table in that spec is rendered without `sticky` or `scroll`, so its half remains a single table;
  - the other `TaskHeatmapTable.*.spec.tsx` suites use unscoped column-header and button locators, which keep resolving because header cells remain in the accessibility tree. Do not re-scope them unless the implementation changes their DOM beyond this plan;
  - `StudentAveragesTableCard.spec.tsx` and the `studentAveragesTableColumns.*.spec.tsx` suites use container-query and unscoped locators and survive the split. Add the sticky-header-holder assertion for the Student Averages table to `StudentAveragesTableCard.spec.tsx`;
  - run a one-off locator audit for any remaining co-located table spec and re-scope only locators that become ambiguous. The audit must include position-based unscoped row locators, such as `getByRole('row').filter({ hasText: ... })`, because they now also match header-table rows and work only through their content filter.
- Browser end-to-end coverage on all three surfaces at a narrow viewport:
  - the sticky bar appears and is pinned to the viewport bottom while the table scroll region crosses the bottom edge;
  - dragging or scrolling horizontally moves the table and keeps the bar synchronised;
  - Forename and Surname keep their viewport position while metric columns move;
  - the header pins at the viewport top;
  - while the header is pinned, a sort or filter control still opens and applies on at least one surface;
  - the sticky bar is hidden once the table scroll region's bottom edge is at or above the viewport bottom, so the table's own horizontal scrollbar is reachable;
  - the document has no horizontal overflow.
- Browser end-to-end coverage at a wide viewport:
  - the sticky bar is absent on the Student Averages table and on both heatmap surfaces, none of which has horizontal overflow at that width;
  - the document has no horizontal overflow.
- Browser fixture basis:
  - the coverage reuses the existing `createHeatmapScenario` fixture (10 students, 3 tasks). Its roster and per-student score evidence are committed local literals; its class metadata snapshot and definition partials select from the committed `small` canonical corpus;
  - the local roster and score literals are accepted because the behaviour under test is table geometry and scrolling, not analysis scoring, and the fixture is already committed and in active use. No synthetic generator change is planned. The fixture's 10 rows offer enough content to exceed a narrow viewport height once the scroll region is measured at runtime;
  - invalid or boundary states are not needed for this feature.
- Regression coverage:
  - every E2E spec on the three surfaces that resolves a table by accessible name or scopes headers, rows, or cells through a table role locator must be re-scoped. Verified examples include `heatmaps.spec.ts`, `heatmaps-layout.spec.ts`, `class-page-baseline-mode.spec.ts`, `task-heatmap.spec.ts`, `task-heatmap-summary.spec.ts`, `task-heatmap-re-run-assessment.spec.ts`, `task-preview-card.spec.ts`, `task-preview-source-link.spec.ts`, `task-preview-source-link.visual.spec.ts`, `assessment-error-previews.spec.ts`, `assessment-error-merged-previews.spec.ts`, `legacy-assignment-results.spec.ts`, `navigation-screenshots.spec.ts`, `metric-range-filter.spec.ts`, `post-analysis-metadata.feedback.spec.ts`, `post-analysis-metadata.persistence.spec.ts`, and the helpers `task-preview-source-link-helpers.ts` and `assessment-error-preview-journeys.ts`;
  - `heatmaps-layout.spec.ts` also migrates its `.ant-table-content` probe to `.ant-table-body`, including its card-ancestor XPath probe (a class-contains match on `ant-card`), which must start from a wrapper-scoped base locator rather than the ambiguous table name;
  - `task-preview-source-link-helpers.ts`'s `revealMetricCellForPointer` keeps its window-scroll reveal as a no-op: the document does not overflow, so the helper must not be changed into document-level horizontal panning. Correct its stale docblock claim in the same change;
  - in `task-heatmap.spec.ts` and `metric-range-filter.spec.ts`, `getByRole('table').last()` still resolves to the Student Averages body table, so row and cell assertions keep working. `metric-range-filter.spec.ts`'s nested `columnheader` locator fails because headers move to the header table. Both specs migrate to wrapper-scoped locators for robustness.

## Documentation and rollout notes

- Update `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §3.6 to record that both tables always receive fixed name columns and that the builder option was removed, and add a one-line §9 register entry recording the same decision.
- Update `docs/developer/frontend/frontend-loading-and-width-standards.md`: keep §7.1 for the heatmap fluid-width exception and add a sibling subsection for student tables that records the sticky bar and sticky header for both the heatmap and the Student Averages table while each table keeps its own horizontal scrolling.
- Add the sticky-table locator convention to `docs/developer/frontend/frontend-playwright-e2e.md` for the browser suites and to `docs/developer/frontend/frontend-testing.md` for the Vitest suites: a sticky table splits into a header holder and a body table, so tests base row and cell queries on `.ant-table-body` and header queries on `.ant-table-header.ant-table-sticky-holder`, and never resolve the table by accessible name.
- No migration, data reset, or rollout dependency.

## V1 scope recommendation

### Include in v1

- Ant Design sticky table scrolling for Student Averages, the embedded Task Heatmap, and the standalone Task Heatmap.
- Fixed Forename and Surname columns in both tables.
- Unit, component, and browser coverage for the new scrolling behaviour.

### Defer from v1

- Dynamic row-count adaptation.
- Internal vertical table scrolling.
- Custom scrollbar styling or theming.
- Changes to any table that does not display student names.
