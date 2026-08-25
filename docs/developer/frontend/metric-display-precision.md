# Metric Display Precision Convention

This document records the frontend convention for decimal-place precision when rendering metric scores. Maintaining this convention consistently avoids confusing mixed-precision displays.

## The Rule

| Context                            | Precision          | Rationale                                                                                                 |
| ---------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| **Individual student task scores** | **0 dp** (integer) | Individual task scores are always returned as integers by the backend. Decimals would add no information. |
| **Class / assignment averages**    | **2 dp**           | Averages are computed floats and need 2-decimal-place precision.                                          |

These two tiers keep the heatmap matrix compact (no unnecessary `.00` noise) while providing adequate detail for aggregate metrics.

## Source Constants

| Constant                     | Value | File                                                                           | Role                                                                                                                                     |
| ---------------------------- | ----- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `INDIVIDUAL_SCORE_PRECISION` | `0`   | `src/frontend/src/features/taskHeatmap/TaskHeatmapTable.tsx` (line 62)         | Controls precision for individual student task scores in both the visible `MetricPill` and the `aria-label` produced by `renderScore()`. |
| `DEFAULT_PRECISION`          | `2`   | `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx` (line 8) | Default precision for all `MetricPill` instances. Used by average-display components.                                                    |

## How It Works

- `MetricPill` accepts an optional `precision` prop (default: `DEFAULT_PRECISION = 2`).
- The **heatmap** (`TaskHeatmapTable.tsx`) overrides this to `0` for individual student scores:
  ```tsx
  <MetricPill metric={m} compact precision={INDIVIDUAL_SCORE_PRECISION} />
  ```
- **Average displays** (`RecentAssignmentCard`, `StudentAveragesTableColumn`) omit the `precision` prop and rely on the default 2 dp:
  ```tsx
  <MetricPill metric={getStudentMetric(card.metrics, key)} emphasised={emphasised} />
  ```

The `precision` prop is ignored for `notAttempted` and `error` states (the literals `'N'` and `'E'` are rendered as-is).

## Adding a New Metric Display

When creating a new component that renders a `MetricResult`, follow the precision tier:

1. **Individual task score display** — pass `precision={0}` to `MetricPill`.
2. **Aggregate / average display** — omit the `precision` prop (defaults to `2`).

If the data source provides sub-integer individual scores in future, this convention should be revisited.

## Keeping `aria-label` in Sync

The heatmap builds its own `aria-label` via `renderScore()` in `TaskHeatmapTable.tsx` (line 111–119), which uses the same `INDIVIDUAL_SCORE_PRECISION` constant:

```typescript
function renderScore(metric: MetricResult): string {
  if (metric.state === 'computed') {
    return metric.value.toFixed(INDIVIDUAL_SCORE_PRECISION);
  }
  if (metric.state === 'notAttempted') {
    return 'N';
  }
  return 'E';
}
```

The `aria-label` precision must match the visible `MetricPill` precision. If the visible precision changes, update `renderScore()` and `INDIVIDUAL_SCORE_PRECISION` together.
