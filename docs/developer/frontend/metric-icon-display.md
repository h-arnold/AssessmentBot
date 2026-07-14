# Metric Icon Display

This document records the icon-rendering conventions used for metric column headers and labels in `src/frontend/src/features/classPage/`.

Use it alongside:

- `docs/developer/frontend/metric-display-precision.md`
- `docs/developer/frontend/frontend-spacing-and-padding-standards.md`
- `src/frontend/AGENTS.md`

## 1. Purpose

`MetricIconLabel` renders a Lucide icon as a column header label in the heatmap table (`TaskHeatmapTable`) and the student averages table (`studentAveragesTableColumns`). It is also used in `RecentAssignmentCard` for the same purpose.

The component wraps a Lucide icon in an Ant Design `Tooltip` so that:

- the icon provides an accessible `aria-label` via its `title` prop
- the `Tooltip` provides a visible hover affordance showing the label text

## 2. Direct `createElement` rendering (bypassing `LucideIcon`)

`MetricIconLabel` renders Lucide icons directly via `createElement` rather than using the project's shared `LucideIcon` component (`src/frontend/src/components/icons/LucideIcon.tsx`).

The `LucideIcon` wrapper routes icons through Ant Design's `Icon` component, which injects `svgBaseProps` (`width: '1em'`, `height: '1em'`, `fill: 'currentColor'`) into the inner component's props. Even though `LucideIcon` overrides `fill` with `'none'`, the antd injection of `width`/`height` as `'1em'` strings conflicts with the numeric `size` prop, causing the stroke to render at the wrong visual weight. Rendering directly via `createElement` avoids this interference.

The component passes explicit `size: 20` and `strokeWidth: 1.5` props for consistent visual appearance across metric icons. The `aria-label` prop sets the accessible label directly on the SVG element.

## 3. Theme-aware colouring

Icon colour is derived from Ant Design's design-token system:

```tsx
const { token } = theme.useToken();
// token.colorText provides the theme-aware text colour
```

The token is applied to the wrapper `<span>` via inline `color: token.colorText`. This automatically adapts to dark mode — when Ant Design detects dark mode, `token.colorText` resolves to a light colour appropriate for dark backgrounds.

The wrapper `<span>` uses the following styles:

```tsx
<span style={{
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  color: token.colorText,
}}>
```

The `width: 100%` ensures the icon fills the column header width, letting the column-level alignment (`align: 'center'` on the Ant Design `Table.Column`) centre the icon correctly.

## 4. Size and stroke width conventions

| Property      | Value | Rationale                                                                                                   |
| ------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| `size`        | `20`  | Fits within 24px column headers with comfortable padding.                                                   |
| `strokeWidth` | `1.5` | Thinner than the Lucide default of `2`, producing a lighter visual weight suited to compact column headers. |

These values are passed directly to `createElement(icon, { size: 20, strokeWidth: 1.5, ... })` and are baked into the component — they are not configurable via props.

## 5. Relationship to heatmap table columns

`MetricIconLabel` is used as the `title` property of Ant Design `Table.Column` definitions in two places:

- **Heatmap task-column sub-headers** (`TaskHeatmapTable.tsx`, line 234): each metric column within a task group renders `MetricIconLabel` as its column title.
- **Student averages table** (`studentAveragesTableColumns.tsx`, line 107): each metric column header renders `MetricIconLabel`.

In both cases, the `icon` and `label` come from `METRIC_DISPLAY_META`, a map that centralises metric display metadata (icon, label, display title) for each metric key.

The icon renders inside a column header that also includes an Ant Design `Table.Column` `filterDropdown` and a column sorter. The `width: 100%` on the icon's wrapper span keeps the icon centred inside the `align: 'center'` column layout.

## 6. Test coverage

The component's test suite (`MetricIconLabel.spec.tsx`) verifies:

- SVG rendering with correct `aria-label`
- Tooltip display on hover
- Wrapper span layout styles (`display: inline-flex`)
- Theme-derived colour (non-empty, not hardcoded black)
- SVG `width="20"`, `height="20"`, and `stroke-width="1.5"` attributes

## 7. Related docs

- Metric score decimal-place convention: `docs/developer/frontend/metric-display-precision.md`
- Spacing and padding rules: `docs/developer/frontend/frontend-spacing-and-padding-standards.md`
- Shared helpers and abstraction standards: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
