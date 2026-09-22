# Task Heatmap Zero-Weight Indicators Layout Specification

## Purpose

This document defines the user-visible task-heatmap treatment for task groups
whose effective weighting is zero.

Use it alongside:

- `SPEC.md`
- `ACTION_PLAN.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`
- `docs/developer/frontend/metric-display-precision.md`

It is UI-focused and does not redefine analysis, weighting, or validation
contracts from `SPEC.md`.

## Scope of this document

This document covers:

1. zero-weight task-group headers in the embedded and merged task heatmaps;
2. the tooltip and keyboard treatment for those headers; and
3. the non-interactive column-group marker that distinguishes excluded task
   groups while preserving conditional score formatting.

This document does **not** cover:

- task/assignment weighting editing;
- page structure, navigation, table selection, previews, filtering workflow, or
  responsive column hiding;
- the display of the aggregate `Excluded` metric state outside the heatmap; or
- changes to score bands, score precision, or conditional-format colours.

## Design principles

1. Preserve score-band backgrounds as the primary visual encoding of assessed
   performance.
2. Treat zero weighting as intentional explanatory context, not an error,
   warning, disabled state, or loss of assessed evidence.
3. Make the explanation available by pointer and keyboard without adding an
   action to the task header.
4. Reuse Ant Design Table grouped columns and Tooltip rather than introducing a
   bespoke overlay or parallel heatmap surface.

## Ant Design references consulted

- [Table](https://ant.design/components/table): grouped `columns.children`,
  custom `title`, `className`, and `onHeaderCell` support the existing grouped
  task headers and scoped header/cell styling.
- [Tooltip](https://ant.design/components/tooltip): `title` provides the
  explanation; `trigger={['hover', 'focus']}` provides pointer and keyboard
  access when its child accepts focus and pointer handlers.

## Surface hierarchy

```text
TaskHeatmapTable
├── Sticky student-name columns
└── Task column groups
    └── TaskHeatmapColumn.averageContribution
        └── Zero-effective-weight task group
        ├── Focusable Tooltip-wrapped task title
        ├── Completeness metric column
        ├── Accuracy metric column
        └── SPaG metric column
```

This is the only supported presentation for the zero-weight indicator. Do not
add a badge, modal, popover workflow, side-panel legend, or a second navigation
layer.

## No extra navigation layers

The existing grouped heatmap header remains the only location for the task
weighting explanation.

Rationale:

- the explanation is most useful beside the affected task title;
- a legend or separate panel would detach the state from the scores it affects;
- the indicator is explanatory only and must not introduce a new task action.

## Region-by-region design

## 1. Zero-weight task-group header

### Components

- Ant Design `Table` grouped column title.
- Ant Design `Tooltip` wrapping a native focusable header-label element.

### Content

- The existing task title, or the existing task-ID fallback when the title is
  unavailable.
- Exact Tooltip content:
  **“Zero weighting — scores are shown but do not contribute to averages.”**

### States

1. **Positive effective weighting**
   - Render the current plain task-group header.
   - Do not render a Tooltip, focusable explanatory label, or accent border.
2. **Zero effective weighting**
   - Retain the current visible task title and header hierarchy.
   - Wrap the title in a Tooltip with `hover` and `focus` triggers.
   - Make the tooltip target focusable but non-actionable. It must not open task
     previews, toggle filters, change sort order, or handle Enter/Space as an
     action.
   - Expose the full task title and the same explanation through the target's
     accessible name.
3. **Long or truncated title**
   - The current header title is plain, untruncated text and has no existing
     title Tooltip; preserve that behaviour.
   - Do not add title truncation or a second Tooltip as part of this feature.
   - The focusable label's accessible name must combine the full task title and
     the zero-weight explanation.

### Notes

- Each zero-weight task group deliberately adds one keyboard tab stop so a
  keyboard-only user can open the explanation Tooltip.
- Tooltip focus must return naturally to the header label; no focus trap,
  focus restoration code, or animation override is required.

## 2. Zero-weight task-group border marker

### Components

- Existing Ant Design `Table` column-group/header and column cell DOM.
- A feature-scoped, theme-aware CSS class supplied through the existing column
  configuration; no new layout component is required.

### Ready state

- Render the 2px vertical accent as a theme-aware inset box-shadow, not a CSS
  border, on the left edge of the first metric sub-column and the right edge of
  the last metric sub-column. This preserves existing table geometry.
- Apply corresponding inset edges to the grouped task header so the marker
  visually encloses the whole three-column task group.
- Use one theme-aware neutral accent token or existing theme-derived CSS custom
  property. Do not hard-code a light grey, a score-band colour, or a warning or
  error colour.
- Apply no fill, opacity, or foreground-colour change to task score cells.

### States

1. **Zero-weight group with numeric, N, or E task cells**
   - Keep every cell's existing conditional-format background, metric pill,
     text colour, and score precision.
   - Show the border marker regardless of an individual cell's metric state.
2. **Positive-weight group**
   - Render no zero-weight border marker.
3. **Merged heatmap**
   - Apply the marker per task group after the existing assignment-tier grouping
     is built. It must surround only the zero-effective-weight task group and
     not its containing assignment tier.
   - Resolve the group state from the adapter-supplied
     `TaskHeatmapColumn.averageContribution`, never from a displayed score or
     assignment-tier identity. A merged task key is definition-scoped, so its
     collapsed assignment instances share one unambiguous effective weighting.
4. **Horizontal scrolling or sticky student columns**
   - The border remains aligned with the task group while scrolling.
   - It must not overlay, clip, or alter the sticky Forename/Surname columns.

### Notes

- The border is decorative/explanatory and has no click, hover, filter, sort,
  or preview behaviour.
- It must meet contrast requirements against both light and dark themes and
  must remain distinguishable from ordinary Table grid borders.

## Data-heavy region

### Recommended components

- Existing Ant Design `Table` with grouped task columns.
- Existing metric-pill and conditional-format rendering.
- Ant Design `Tooltip` only for zero-weight grouped titles.

### Core features to use

- Preserve the existing student row key, sticky name columns, adaptive
  assignment tiers, filters, sorters, and no-submissions caption.
- Determine zero-effective-weight status from
  `TaskHeatmapColumn.averageContribution`; do not infer it from a displayed
  numeric, `N`, `E`, or `Excluded` metric.
- Scope styling through the existing Table column configuration rather than
  querying or mutating rendered DOM nodes.

## Responsive behaviour

- Retain the existing horizontally scrollable heatmap behaviour; do not stack
  or collapse task metric columns because of zero weighting.
- The header tooltip uses Ant Design's automatic overflow adjustment.
- The 2px border does not change column widths, cell padding, row height, or
  the existing compact heatmap density.

## Accessibility and motion

- Use `Tooltip` with `trigger={['hover', 'focus']}` and a native element that
  accepts the required focus and pointer handlers.
- The focusable title's accessible name must combine the full task title with:
  “Zero weighting — scores are shown but do not contribute to averages.”
- Do not rely on the border alone to convey zero weighting.
- The border is static: no animation, flashing, colour transition, or
  reduced-motion exception is permitted.

## Implementation guardrails

- Do not change conditional formatting, score bands, metric precision, or
  metric-pill colour resolution to implement the marker.
- Do not use a light-grey column fill, disabled opacity, or a warning/error
  palette for zero weighting.
- Do not add non-zero-weight Tooltip wrappers or empty focusable header labels.
- Keep all spacing and padding unchanged unless an existing canonical token is
  required for the border implementation.
