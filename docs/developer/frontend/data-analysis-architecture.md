# Data Analysis Architecture

## Status

**Implemented.** This document records the delivered architecture for the
zero-weight assessment remediation in GitHub issue #307. It describes the
frontend analysis pipeline as shipped. There are no backend, API, persistence,
route, or transport changes in this work.

## Purpose

The data-analysis domain must preserve two independent facts about an assessed
observation:

1. its **display evidence** (the score a teacher should see); and
2. its **average contribution** (whether and how it changes an aggregate).

A zero effective weight changes the second fact only; it does not turn an
assessed numeric score into `N` or `E`.

This architecture mirrors the agreed behaviour in [`SPEC.md`](../../../SPEC.md).
The canonical contract is
[`frontend-data-analysis-response.md`](../data-shapes/frontend-data-analysis-response.md).

## Boundaries and ownership

| Layer                                                                                                                                                                                       | Owned responsibility                                                              | Must not own                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| Assignment-definition partials                                                                                                                                                              | Authoritative live assignment and task weightings                                 | Analysis display state                         |
| `resolveAssignmentDefinition.ts`                                                                                                                                                            | Resolve live assignment/task weighting inputs                                     | UI metadata or metric-state presentation       |
| `averagingAnalyser.accumulation.ts` (orchestration facade) plus the extracted `accumulatorRegistry`, `criterionAccumulation`, `metricResolution`, `taskProjection`, and `composite` modules | Preserve display evidence and accumulate positive-weight contributions separately | React, Ant Design, persistence, or transport   |
| `averagingAnalyser.rows.ts` / `rollupMetric.ts`                                                                                                                                             | Build task, student, and class rows; apply aggregate-state precedence             | Re-resolving assignment-definition data        |
| `dataAnalysis.zod.ts`                                                                                                                                                                       | Validate public analyser input and output                                         | Heatmap layout decisions                       |
| `heatmapAdapter*.ts`                                                                                                                                                                        | Project analyser results and live definitions into heatmap view models            | Duplicate accumulation or weighting resolution |
| `metricDisplay/`                                                                                                                                                                            | Shared metric state labels, tones, filtering, and ordering                        | Feature-specific table layout                  |
| `features/taskHeatmap/`                                                                                                                                                                     | Render adapter-provided data, including zero-weight explanation and marker        | Infer contribution from a displayed score      |

## Effective weighting and dual accumulation

For each observation, the analyser resolves:

```text
effectiveWeight = live assignment weighting × live task weighting
includedInAverage = effectiveWeight > 0
```

`resolveAssignmentDefinition.ts` supplies the live assignment weighting, and a
missing assignment or task weighting resolves to `1` before the product is
calculated.

Each criterion's `MetricAccumulator` (defined in `averagingAnalyser.types.ts`,
created by `averagingAnalyser.accumulatorRegistry.ts`) retains two accumulators:

- **display accumulator** (`displaySum`, `displayCount`, `displayNCount`,
  `displayTotalDataPoints`): consumes every assessed numeric score regardless of
  effective weighting. For multiple zero-weight numeric observations resolving
  to one task result, it returns their unweighted arithmetic mean.
- **contribution accumulator** (`weightedSum`, `totalWeight`,
  `applicableDataPoints`, `totalDataPoints`, `nCount`): consumes only
  observations with a positive effective weight. It supplies aggregate
  numerator, denominator, and genuine positive-weight `N` handling.

`averagingAnalyser.criterionAccumulation.ts` updates both accumulators.
`averagingAnalyser.accumulation.ts` is the thin assignment-processing facade; it
resolves each task's effective weight and records the definition-scoped
`averageContribution` metadata via `ensureAverageContribution`.

Raw `N` remains a property of the source assessment. It retains its existing
positive-weight aggregation semantics and is never manufactured because a
weight is zero. A numeric zero-weight observation contributes neither a
numerator nor denominator and cannot create a not-attempted penalty.

## Public result rules

`MetricResult` has four states: `computed`, `notAttempted`, `excluded`, and
`error`. The shared four-state union is `MetricResultSchema`; task-level shapes
use the narrower, private `TaskDisplayMetricSchema` (computed, notAttempted,
error), both in `dataAnalysis.zod.ts`.

- Task-level displays use their display evidence and therefore keep numeric
  zero-weight scores and genuine raw `N` values visible.
- Aggregate rows use contribution evidence only.
- An aggregate with observations but no positive-weight contribution resolves
  to `excluded` unless all observations are errors.
- Aggregate precedence is: all errors → `error`; any computed contribution →
  `computed`; any positive-weight raw `N` → `notAttempted`; otherwise →
  `excluded`.

`resolveAggregateMetric` (`averagingAnalyser.metricResolution.ts`) applies this
precedence to accumulator state. `resolveDisplayMetric` in the same module
produces the task-level display metric and never returns `excluded`;
`averagingAnalyser.taskProjection.ts` additionally throws if `excluded` ever
reaches task projection.

Task-level shapes (`PerStudentTaskMetric` and `PerTaskRow`) and heatmap task
column descriptors expose:

```ts
averageContribution: {
  effectiveWeight: number;
  includedInAverage: boolean;
}
```

The field is derived from live definition data. It is never inferred from a
metric value. `includedInAverage` is true exactly when `effectiveWeight > 0`.

## Presentation flow

1. `heatmapAdapter.ts` and `heatmapAdapter.merged.ts` attach the authoritative
   `averageContribution` metadata to each task-column descriptor.
2. `TaskHeatmapTable` consumes this metadata without resolving definition data
   itself.
3. `features/taskHeatmap/taskHeatmapZeroWeightHeader.tsx` selects the
   zero-effective-weight header presentation: a non-actionable, focusable
   Tooltip on the task title plus the group-edge classes
   (`.task-heatmap-zero-weight-group`, `-first`, `-last`), defined as
   theme-aware inset 2px box-shadows in `src/frontend/src/index.css` and applied
   by `taskHeatmapTableColumns.tsx`. Score-band backgrounds are unchanged.
4. Shared metric-display modules give aggregate `excluded` a distinct label,
   accessible name, neutral tone, filter option, and state sort rank.
5. Class page aggregate consumers pass `excluded` through their adapter and
   render it through the shared metric-display vocabulary; the Student Averages
   table and Recent Assignment cards are the visible aggregate surfaces. The
   card adapter's per-assignment roll-up is contribution-aware and must resolve
   an all-zero-weight assignment to `excluded`, rather than throw.
6. The Class-page adapter's existing synthesised no-data `N` is a local
   presentation placeholder, not a data-analysis metric. Its narrow adapter
   validation union permits only that zero-data shape without weakening the
   shared raw-`N` contract or reclassifying it as `excluded`.

The complete user-interface contract is in
[`TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md`](../../../TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md).

## Delivered modular boundaries

Dual accumulation was added after extracting coherent, analyser-local
responsibilities out of the former 509-line `averagingAnalyser.accumulation.ts`.
The delivered analyser package is:

| Module                                       | Responsibility                                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `averagingAnalyser.accumulation.ts`          | Assignment-processing orchestration facade; resolves effective weights and records definition-scoped contribution metadata.            |
| `averagingAnalyser.accumulatorRegistry.ts`   | Accumulator factories and registry accessors, including `ensureAverageContribution`.                                                   |
| `averagingAnalyser.criterionAccumulation.ts` | Criterion-level display/contribution accumulation and per-item overall computation.                                                    |
| `averagingAnalyser.metricResolution.ts`      | `resolveAggregateMetric` (contribution precedence) and `resolveDisplayMetric` (display evidence).                                      |
| `averagingAnalyser.taskProjection.ts`        | `buildPerStudentTaskMetrics` and the `toTaskDisplayMetric` guard that rejects `excluded` at task level.                                |
| `averagingAnalyser.composite.ts`             | `computeOverallComposite` (40/40/20 weighting with SPaG renormalisation and overall aggregate precedence).                             |
| `rollupMetric.ts`                            | Single shared roll-up precedence for task-display `MetricResult` values.                                                               |
| `averagingAnalyser.rows.ts`                  | Per-student and per-task row builders; a per-task composite that would resolve to `excluded` falls back to the task's display overall. |
| `averagingAnalyser.types.ts`                 | Shared accumulator and assessment-score types.                                                                                         |
| `averagingAnalyser.ts`                       | Public analyser entry point.                                                                                                           |
| `resolveAssignmentDefinition.ts`             | Live assignment/task weighting resolution from the partial registry.                                                                   |

The task-heatmap presentation was kept feature-local. Zero-weight header
rendering and group-edge class construction live in
`features/taskHeatmap/taskHeatmapZeroWeightHeader.tsx`
(`buildTaskHeaderPresentation`, `getZeroWeightMetricEdgeClass`), consumed by
`taskHeatmapTableColumns.tsx`, which remains the column-construction
composition facade. The edge classes are defined in `src/frontend/src/index.css`.

## Non-goals

- Changing stored weight values or their validation.
- Changing criterion weighting or SPaG renormalisation.
- Re-keying `perStudentTaskMetrics` by assignment instance.
- Adding a weight-editing workflow, a new route, endpoint, or persistence
  model.
