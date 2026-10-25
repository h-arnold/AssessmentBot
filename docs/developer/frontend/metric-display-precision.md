# Metric Display Precision Convention

This document records the frontend convention for decimal-place precision when rendering metric scores. Maintaining this convention consistently avoids confusing mixed-precision displays.

## The Rule

| Context                            | Precision          | Rationale                                                                                                         |
| ---------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Individual student task scores** | **0 dp** (display) | Individual backend scores may be fractional; the established heatmap display intentionally presents them at 0 dp. |
| **Class / assignment averages**    | **2 dp**           | Averages are computed floats and need 2-decimal-place precision.                                                  |

These two tiers keep the heatmap matrix compact (no unnecessary `.00` noise) while providing adequate detail for aggregate metrics.

## Source Constants

| Constant                     | Value | File                                                                            | Role                                                                                                                                                                  |
| ---------------------------- | ----- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INDIVIDUAL_SCORE_PRECISION` | `0`   | `src/frontend/src/features/taskHeatmap/taskHeatmapTableColumns.tsx` (line 107)  | Controls precision for individual student task scores in both the visible heatmap score text and the cell `aria-label`, both formatted via `formatMetricDisplayText`. |
| `DEFAULT_PRECISION`          | `2`   | `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx` (line 12) | Default precision for all `MetricPill` instances. Used by average-display components.                                                                                 |

## How It Works

- `MetricPill` accepts an optional `precision` prop (default: `DEFAULT_PRECISION = 2`).
- The **heatmap** does not render `MetricPill`; `taskHeatmapTableColumns.tsx` formats its visible score text and `aria-label` at `INDIVIDUAL_SCORE_PRECISION = 0`.
- The **task-preview card** header (`TaskPreviewCard`) renders a single individual task score with the compact pill at `precision={0}`:
  ```tsx
  <MetricPill metric={metricResult} precision={0} compact />
  ```
- **Average displays** (`RecentAssignmentCard`) omit the `precision` prop and rely on the default 2 dp:
  ```tsx
  <MetricPill metric={getStudentMetric(card.metrics, key)} />
  ```

The `precision` prop is ignored for `notAttempted`, `excluded`, and `error` states (the literals `'N'` and `'E'`, and the visible label **Excluded**, are rendered as-is).

## Adding a New Metric Display

When creating a new component that renders a `MetricResult`, follow the precision tier:

1. **Individual task score display** — format at `0` dp (`formatMetricDisplayText(..., 0)`, or `precision={0}` on `MetricPill`).
2. **Aggregate / average display** — format at `2` dp (`formatMetricDisplayText(..., 2)`, or omit the `precision` prop on `MetricPill` to use the default).

Fractional individual scores are supported by the backend and accepted by the shared assessment schemas. The existing 0 dp presentation convention remains unchanged; revisit it only if product requirements change.

## Keeping `aria-label` in Sync

The heatmap builds each metric cell's `aria-label` from the same formatted score as its visible text. `taskHeatmapTableColumns.tsx` computes `const score = formatMetricDisplayText(m, INDIVIDUAL_SCORE_PRECISION)` and passes it to `buildMetricCellAccessibleLabel(...)` for both the `onCell` `aria-label` and the Popover trigger's `aria-label`.

The `aria-label` precision must match the visible score precision. If the visible precision changes, update the `formatMetricDisplayText` call sites and `INDIVIDUAL_SCORE_PRECISION` together.
