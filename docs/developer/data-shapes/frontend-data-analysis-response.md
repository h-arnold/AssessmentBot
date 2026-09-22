# Contract: Frontend Data Analysis Response

## Status

**Planned — Not implemented.** This is the canonical target contract for the
GitHub issue #307 zero-weight remediation. Implementation must remove this
marker only after the Zod schemas and all consumers conform.

Frontend schema: `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`
Frontend service: `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`
Analyser: `src/frontend/src/services/dataAnalysis/analysers/`

Sibling contracts:

- [Contract: AssignmentDefinition](assignment-definition.md) — owns the live
  assignment and task weighting inputs used by this derived response.
- [Contract: ABClass](abclass.md) — supplies the analysed class and assignments.

---

## Boundary

This is an in-memory frontend validation and service contract. It has **no
persistence, backend API endpoint, or transport envelope**. `DataAnalysisService`
validates the input and the derived `DataAnalysisResponse` output with Zod.

## Effective weighting

For each task observation:

```text
effectiveWeight = live assignment weighting × live task weighting
includedInAverage = effectiveWeight > 0
```

`effectiveWeight` is non-negative. `includedInAverage` must be exactly
equivalent to `effectiveWeight > 0`; any contradictory pair is invalid.

## `AverageContribution`

```ts
type AverageContribution = {
  effectiveWeight: number;
  includedInAverage: boolean;
};
```

The following public shapes require `averageContribution`:

| Shape                                           | Purpose                                        |
| ----------------------------------------------- | ---------------------------------------------- |
| `PerStudentTaskMetric`                          | Per-student heatmap cell evidence              |
| `PerTaskRow`                                    | Per-task analysis display evidence             |
| `HeatmapTaskColumn` / `MergedHeatmapTaskColumn` | Adapter-owned metadata for heatmap task groups |

`PerStudentRow` and `PerClassResult` remain aggregate shapes and do not expose
task-level contribution metadata.

## `MetricResult`

```ts
type MetricResult =
  | {
      state: 'computed';
      value: number;
      totalWeight: number;
      applicableDataPoints: number; // integer >= 1
      totalDataPoints: number; // integer >= 0
    }
  | {
      state: 'notAttempted';
      value: 'N';
      totalWeight: number;
      applicableDataPoints: 0;
      totalDataPoints: number; // integer >= 1
    }
  | {
      state: 'excluded';
      value: null;
      totalWeight: 0;
      applicableDataPoints: 0;
      totalDataPoints: number; // integer >= 1
    }
  | {
      state: 'error';
      value: 'E';
      totalWeight: number; // non-negative
      applicableDataPoints: 0;
      totalDataPoints: number; // integer >= 0
    };
```

`excluded` is valid only for an aggregate result that has observations but no
positive-weight average contribution and is not composed entirely of errors.
It is not valid as a replacement for a numeric or raw-`N` task-level score.

`totalWeight` remains the sum of contribution weights, not display weights. A
numeric zero-weight task display can therefore have `totalWeight: 0`.

### Class-page no-data synthesis

`ClassPageAdapter` may synthesise a presentation-only no-data row for a student
with no analysed work. That existing UI-only placeholder remains
`{ state: 'notAttempted', value: 'N', totalWeight: 0, applicableDataPoints: 0,
totalDataPoints: 0 }`. It is **not** an analyser `MetricResult`, is not a raw
`N`, and must not become `excluded` under this feature.

`classPageAdapter.zod.ts` must validate that placeholder through a narrow
Class-page display-metric union that adds only this exact zero-data shape to the
shared `MetricResultSchema`. It must not weaken `MetricResultSchema`'s raw-`N`
invariant or fabricate a data point. The no-data display union is local to the
Class-page adapter model and never crosses the analyser, persistence, or
transport boundary.

## State resolution

Task-level metrics resolve from display evidence; parent aggregates resolve
from contribution evidence. For a parent aggregate, apply this strict order:

1. all observations are errors → `error`;
2. at least one numeric positive-weight contribution → `computed`;
3. no numeric contribution and at least one positive-weight raw `N` →
   `notAttempted`;
4. otherwise, observations exist but none contributed → `excluded`.

Raw `N` is never generated from zero weighting. Numeric zero-weight scores are
retained as numeric display evidence and do not affect numerator, denominator,
or not-attempted handling.

When an aggregate roll-up consumes task-display `MetricResult` values rather
than the internal accumulators, it must preserve the same distinction using the
public fields: a `computed` value contributes only when `totalWeight > 0`; a
raw `notAttempted` value can affect the parent only when `totalWeight > 0`; and
zero-weight `computed` or `notAttempted` inputs count as observed non-error
display evidence but no contribution. An all-error result is determined from
the input states. This lets an observed all-zero-weight task set resolve to
`excluded` rather than an all-error result.

Recent Assignment card averages are aggregate scope. They apply this same
contribution-aware roll-up over their per-task display inputs and must resolve
an all-zero-weight assignment to `excluded`, not throw or display a numeric
task result.

## Heatmap projection contract

Heatmap adapters resolve `AverageContribution` from the live
assignment-definition partial and emit it on task-column descriptors. UI code
must consume that descriptor and must not derive weighting from displayed
scores or duplicate definition resolution. In merged heatmaps, a definition-
scoped duplicate task key has one unambiguous contribution value.

## Display contract

The `excluded` state is displayed as **Excluded** with accessible text:

> Excluded from average: displayed work had zero weighting.

It sorts after `notAttempted` and before `error`, and has a separate filter
option. Zero-effective-weight heatmap task headers show the explanatory text
specified by `TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md`.
