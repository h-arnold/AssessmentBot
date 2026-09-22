# Data Analysis Architecture

## Status

**Planned — Not implemented.** This document records the target architecture
for the zero-weight assessment remediation in GitHub issue #307. It must be
reconciled with implementation when that work lands.

## Purpose

The data-analysis domain must preserve two independent facts about an assessed
observation:

1. its **display evidence** (the score a teacher should see); and
2. its **average contribution** (whether and how it changes an aggregate).

A zero effective weight changes the second fact only. It must not turn an
assessed numeric score into `N` or `E`.

This architecture mirrors the agreed behaviour in [`SPEC.md`](../../../SPEC.md).
The canonical contract is
[`frontend-data-analysis-response.md`](../data-shapes/frontend-data-analysis-response.md).

## Boundaries and ownership

| Layer                                                                  | Owned responsibility                                                              | Must not own                                   |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| Assignment-definition partials                                         | Authoritative live assignment and task weightings                                 | Analysis display state                         |
| `resolveAssignmentDefinition.ts`                                       | Resolve live assignment/task weighting inputs                                     | UI metadata or metric-state presentation       |
| `averagingAnalyser.accumulation.ts` and extracted accumulation modules | Preserve display evidence and accumulate positive-weight contributions separately | React, Ant Design, persistence, or transport   |
| `averagingAnalyser.rows.ts` / `rollupMetric.ts`                        | Build task, student, and class rows; apply aggregate-state precedence             | Re-resolving assignment-definition data        |
| `dataAnalysis.zod.ts`                                                  | Validate public analyser input and output                                         | Heatmap layout decisions                       |
| `heatmapAdapter*.ts`                                                   | Project analyser results and live definitions into heatmap view models            | Duplicate accumulation or weighting resolution |
| `metricDisplay/`                                                       | Shared metric state labels, tones, filtering, and ordering                        | Feature-specific table layout                  |
| `features/taskHeatmap/`                                                | Render adapter-provided data, including zero-weight explanation and marker        | Infer contribution from a displayed score      |

There is no backend API, persistence, route, or transport change in this work.

## Effective weighting and dual accumulation

For each observation, the analyser resolves:

```text
effectiveWeight = live assignment weighting × live task weighting
includedInAverage = effectiveWeight > 0
```

The analyser must retain two accumulators:

- **display accumulator**: consumes every assessed numeric score regardless of
  effective weighting. For multiple zero-weight numeric observations resolving
  to one task result, it returns their unweighted arithmetic mean.
- **contribution accumulator**: consumes only observations with a positive
  effective weight. It supplies aggregate numerator, denominator, and genuine
  positive-weight `N` handling.

Raw `N` remains a property of the source assessment. It retains its existing
positive-weight aggregation semantics and must never be manufactured because a
weight is zero. A numeric zero-weight observation contributes neither a
numerator nor denominator and cannot create a not-attempted penalty.

## Public result rules

`MetricResult` has four states: `computed`, `notAttempted`, `excluded`, and
`error`.

- Task-level displays use their display evidence and therefore keep numeric
  zero-weight scores and genuine raw `N` values visible.
- Aggregate rows use contribution evidence only.
- An aggregate with observations but no positive-weight contribution resolves
  to `excluded` unless all observations are errors.
- Aggregate precedence is: all errors → `error`; any computed contribution →
  `computed`; any positive-weight raw `N` → `notAttempted`; otherwise →
  `excluded`.

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
3. A zero-effective-weight task header receives the approved non-actionable,
   focusable Tooltip and an inset, theme-aware 2px group-edge marker. It leaves
   score-band backgrounds unchanged.
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

## Required modular boundaries

The current 509-line `averagingAnalyser.accumulation.ts` will exceed the
550-line frontend limit if dual accumulation is added in place. The remediation
must extract coherent, analyser-local responsibilities before or while adding
the behaviour:

- display/contribution accumulator types and update functions;
- metric-result resolution from those accumulators; and
- the thin assignment-processing facade that coordinates existing iteration.

The current 439-line `taskHeatmapTableColumns.tsx` must likewise remain below
550 lines. Zero-weight header rendering and group-edge class construction must
be separated into a feature-local column-header/style helper if their addition
would cross the limit. Existing column construction remains the composition
facade.

## Non-goals

- Changing stored weight values or their validation.
- Changing criterion weighting or SPaG renormalisation.
- Re-keying `perStudentTaskMetrics` by assignment instance.
- Adding a weight-editing workflow, a new route, endpoint, or persistence
  model.
