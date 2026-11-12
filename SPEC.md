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

## Existing system constraints

### Backend or API constraints already in place

- No backend or API change is required. All affected surfaces render from data already loaded by the existing services.

### Current data-shape constraints

- No validation schema, persistence model, API contract, or transport shape changes.

### Frontend or consumer architecture constraints

- The frontend uses Ant Design `6.6.7`, which provides the `Table` `sticky` prop.
- Ant Design's sticky bar is positioned against the nearest scrolling ancestor. The document must remain the scroll container for both tables; no ancestor between either table and the document may introduce an `overflow` scroll container.
- Both tables already set `scroll={{ x: 'max-content' }}`, which supplies the horizontal overflow and is required for fixed columns.
- The Student Averages table currently requests non-fixed name columns. The Task Heatmap table currently requests fixed name columns.
- Both heatmap surfaces render the same table component, so the embedded and standalone heatmaps share one implementation path.
- The application header participates in normal document flow; it is not fixed. Header and scroll offsets therefore default to `0`.
- The fluid-width exception for heatmap pages and panels stays in force: the table keeps its own horizontal scrolling, and the page must not gain document-level horizontal overflow.
- The Task Heatmap feature must not import from the Class page feature. The shared student-name column module is the permitted common owner.

## Behaviour contract

### Sticky horizontal scrollbar

The table's horizontal scroll region is the element that owns the table's local horizontal overflow.

1. The sticky bar is rendered only when the table has horizontal overflow (the scroll region's `scrollWidth` exceeds its `clientWidth`).
2. The sticky bar is visible only while the table's vertical span crosses the bottom edge of the viewport: the table's top is above the viewport bottom and the table's bottom is below the viewport bottom.
3. While visible, the sticky bar is pinned to the viewport bottom with a zero bottom offset and spans the table scroll region's visible width.
4. The sticky bar is hidden when:
   - the table has no horizontal overflow;
   - the table is entirely below the viewport;
   - the table's bottom edge is at or above the viewport bottom, so the table's own horizontal scrollbar is visible.
5. Dragging the sticky bar scrolls the table's scroll region horizontally, and the bar's thumb position stays synchronised with the scroll region.
6. The table's own horizontal scrollbar remains available at the table's end; the sticky bar supplements it rather than replacing it.

### Sticky header

1. While the table is read and its header would pass the top of the viewport, the header pins to the viewport top with a zero top offset.
2. Header grouping, column titles, sort controls, and filter controls keep their current content and behaviour while pinned.
3. The header unpins at the table's bottom edge; it never detaches from the table's own vertical span.
4. The pinned header does not change the table's accessible structure or remove header cells from the accessibility tree.

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

The table scroll region has two independent conditions: horizontal overflow and its vertical position relative to the viewport.

| Horizontal overflow | Table vertical position                                     | Sticky bar |
| ------------------- | ----------------------------------------------------------- | ---------- |
| No                  | Any                                                         | Hidden     |
| Yes                 | Entirely below the viewport                                 | Hidden     |
| Yes                 | Crosses the viewport bottom (top above it, bottom below it) | Visible    |
| Yes                 | Bottom edge at or above the viewport bottom                 | Hidden     |

The sticky header has one condition: the table's header has passed the viewport top while the table's bottom remains below the pinned header.

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

- The sticky bar is available at the viewport bottom while the table crosses the bottom edge.
- The header pins while scrolling.
- Forename and Surname stay visible at the start edge.

#### Table fully visible or without horizontal overflow

- No sticky bar is shown.
- The header does not pin.
- The layout is visually unchanged apart from the frozen name columns, which have no visible effect without horizontal overflow.

## Workflow specification

### Horizontal navigation across a wide table

#### Eligible inputs or preconditions

- The table has horizontal overflow.
- The table crosses the bottom edge of the viewport.

#### Inputs, fields, or confirmation copy

- None. The sticky bar is a direct-manipulation affordance.

#### Behaviour

- The bar appears at the viewport bottom as the table crosses the bottom edge.
- Dragging the bar pans the table horizontally.
- The bar's thumb and the table's scroll position remain synchronised in both directions.
- Forename and Surname remain visible throughout the pan.
- When the table's bottom edge reaches the viewport bottom, the bar disappears and the table's own horizontal scrollbar is available at the table's end.

### Vertical reading with a pinned header

#### Eligible inputs or preconditions

- The table's header would pass the viewport top while rows remain below.

#### Inputs, fields, or confirmation copy

- None.

#### Behaviour

- The header pins at the viewport top.
- Sort and filter controls keep their current interaction and focus behaviour.
- The header unpins at the table's bottom edge.

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
- Browser end-to-end tests must prove the bar's viewport-bottom geometry, header pinning, fixed-column stability, and the absence of document-level horizontal overflow on all three surfaces.
- No data-shape documentation update is required.

## Testing expectations

- Frontend unit/component coverage:
  - the shared column builder emits `fixed: 'start'` for Forename and Surname for both row types;
  - both table components render a sticky header holder when their table is in sticky mode;
  - existing sorting, filtering, search, and cell-rendering tests remain green after the shared-option removal.
- Browser end-to-end coverage on all three surfaces at a narrow viewport:
  - the sticky bar is present and pinned to the viewport bottom while the table crosses the bottom edge;
  - dragging or scrolling horizontally moves the table and keeps the bar synchronised;
  - Forename and Surname keep their viewport position while metric columns move;
  - the header pins at the viewport top;
  - the document has no horizontal overflow.
- Regression coverage:
  - existing `heatmaps-layout`, `task-heatmap`, and `task-preview-source-link.visual` expectations remain valid.

## Documentation and rollout notes

- Update `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §3.6 to record that both tables always receive fixed name columns and that the builder option was removed.
- Update `docs/developer/frontend/frontend-loading-and-width-standards.md` §7.1 to record the sticky bar and sticky header while the heatmap table keeps its own horizontal scrolling.
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
