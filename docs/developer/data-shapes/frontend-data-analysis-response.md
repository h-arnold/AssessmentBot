# Contract: Frontend Data Analysis Response

## Status

**Implemented.** This is the canonical contract for the frontend-only, in-memory
data-analysis response delivered for the GitHub issue #307 zero-weight
remediation. It is validated entirely inside the frontend and has **no backend
API, persistence collection, transport envelope, or migration**.

Frontend schema: `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`
Frontend service: `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`
Analyser: `src/frontend/src/services/dataAnalysis/analysers/`
Class-page adapter schema: `src/frontend/src/features/classPage/classPageAdapter.zod.ts`
Heatmap adapters: `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`, `src/frontend/src/services/dataAnalysis/heatmapAdapter.merged.ts`
Metric display: `src/frontend/src/services/dataAnalysis/metricDisplay/`

Sibling contracts:

- [Contract: AssignmentDefinition](assignment-definition.md) — owns the live
  assignment and task weighting inputs used by this derived response.
- [Contract: ABClass](abclass.md) — supplies the analysed class and assignments.

Related frontend documents:

- [`data-analysis-architecture.md`](../frontend/data-analysis-architecture.md)
- [`TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md`](../../../TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md)

---

## Boundary

This is an in-memory frontend validation and service contract. It has **no
persistence, backend API endpoint, transport envelope, or migration**.
`DataAnalysisService.analyse()` validates its input with
`AveragingAnalyserInputSchema` and its derived `DataAnalysisResponse` output with
`DataAnalysisResponseSchema`. The shared API envelope documented in
[transport-envelope.md](transport-envelope.md) does not apply to this contract.

## Persistence

None. There is no collection, no `toJSON()`/`toPartialJSON()` serialisation, and
no stored document. Every shape below exists only for the lifetime of one
`DataAnalysisService.analyse()` call.

## Transport

None. There is no `z_Api` handler, controller, response mapper, API endpoint, or
`ALLOWLISTED_METHOD_HANDLERS` entry for this contract.

## Effective weighting

For each task observation whose `taskId` exists in the live partial:

```text
effectiveWeight = live assignment weighting × live task weighting
includedInAverage = effectiveWeight > 0
```

The live assignment-definition partial is the sole weighting source. A `null`
`assignmentWeighting` intentionally resolves to `1` before the product is
calculated. `TaskPartial.taskWeighting` is required, so a missing task ID is not
treated as a missing-weight default: `computeEffectiveWeight` returns
`undefined`, and the analyser emits a structured warn and drops that submission
item before any display or average accumulator is updated. The shared helper is
used by both analyser accumulation and heatmap column projection.

The partial wire schemas deliberately do not enforce a weighting range
(`TaskPartialSchema.taskWeighting` is `z.number()`;
`AssignmentDefinitionPartialSchema.assignmentWeighting` is
`z.number().nullable()`), so a negative effective weight is not rejected on
input. On the analyser path it is caught on output:
`AverageContributionSchema.effectiveWeight` is `z.number().min(0)`, and the
analyser only accumulates contribution weight when `weight > 0`, so a negative
effective weight contributes nothing and fails output validation rather than
producing a negative `totalWeight`.

> **Caveat — the heatmap adapter path is not Zod-validated.** `buildTaskColumns`
> (`heatmapAdapter.ts`) computes `averageContribution` with the same shared
> `computeEffectiveWeight` helper but projects it straight onto the
> `HeatmapTaskColumn` / `MergedHeatmapTaskColumn` descriptor without running
> `AverageContributionSchema`. `includedInAverage` is always
> `effectiveWeight > 0`, so the truth-table relationship holds by construction;
> however, a negative `effectiveWeight` would reach the descriptor unchecked.
> The `z.number().min(0)` guarantee applies only where output validation
> (`DataAnalysisResponseSchema`) actually runs.

## Response shapes

### `DataAnalysisResponse`

`DataAnalysisResponseSchema = z.array(AveragingResultSchema)`.

### `AveragingResult`

| #   | Field                        | Type                                       | Persistence | Transport | Frontend Zod                                     | Notes                                                                                                                                                |
| --- | ---------------------------- | ------------------------------------------ | ----------- | --------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `classId`                    | `string`                                   | —           | —         | `z.string()`                                     |                                                                                                                                                      |
| 2   | `className`                  | `string\|null`                             | —           | —         | `z.string().nullable()`                          |                                                                                                                                                      |
| 3   | `perStudent`                 | `PerStudentRow[]`                          | —           | —         | `z.array(PerStudentRowSchema)`                   | Aggregate scope; may contain `excluded`.                                                                                                             |
| 4   | `perTask`                    | `PerTaskRow[]`                             | —           | —         | `z.array(PerTaskRowSchema)`                      | Task display scope; never `excluded`.                                                                                                                |
| 5   | `perClass`                   | `PerClassResult`                           | —           | —         | `PerClassResultSchema`                           | Aggregate scope.                                                                                                                                     |
| 6   | `appliedCriterionWeightings` | `{ completeness, accuracy, spag: number }` | —           | —         | `AppliedCriterionWeightingsSchema`               | Echoes the weightings actually applied.                                                                                                              |
| 7   | `perStudentTaskMetrics`      | `PerStudentTaskMetric[] \| undefined`      | —           | —         | `z.array(PerStudentTaskMetricSchema).optional()` | Heatmap-facing. The analyser always emits it (an empty array when no per-(student, task) accumulators exist); `.optional()` only tolerates omission. |

### `PerStudentRow`

Aggregate scope. Uses the shared four-state `MetricResultSchema`; it does **not**
carry `averageContribution`.

| #   | Field          | Type           | Frontend Zod            | Notes                                                                                                      |
| --- | -------------- | -------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | `studentId`    | `string`       | `z.string()`            |                                                                                                            |
| 2   | `studentName`  | `string\|null` | `z.string().nullable()` | A `null` name is a data-source bug; the row builder throws immediately and names the offending student ID. |
| 3   | `completeness` | `MetricResult` | `MetricResultSchema`    | Contribution roll-up over the student's per-task accumulators.                                             |
| 4   | `accuracy`     | `MetricResult` | `MetricResultSchema`    | Contribution roll-up.                                                                                      |
| 5   | `spag`         | `MetricResult` | `MetricResultSchema`    | Contribution roll-up.                                                                                      |
| 6   | `overall`      | `MetricResult` | `MetricResultSchema`    | Composite of the three criterion roll-ups.                                                                 |

### `PerTaskRow`

Task display scope. Uses the narrow three-state `TaskDisplayMetricSchema` and
carries `averageContribution`.

| #   | Field                 | Type                  | Frontend Zod                | Notes                                                                                                  |
| --- | --------------------- | --------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | `definitionKey`       | `string`              | `z.string()`                |                                                                                                        |
| 2   | `taskId`              | `string`              | `z.string()`                |                                                                                                        |
| 3   | `taskTitle`           | `string\|null`        | `z.string().nullable()`     | Always `null` in v1; reserved for cross-reference resolution.                                          |
| 4   | `averageContribution` | `AverageContribution` | `AverageContributionSchema` | Derived from live definition weights.                                                                  |
| 5   | `completeness`        | task display metric   | `TaskDisplayMetricSchema`   | Display accumulation.                                                                                  |
| 6   | `accuracy`            | task display metric   | `TaskDisplayMetricSchema`   | Display accumulation.                                                                                  |
| 7   | `spag`                | task display metric   | `TaskDisplayMetricSchema`   | Display accumulation.                                                                                  |
| 8   | `overall`             | task display metric   | `TaskDisplayMetricSchema`   | Composite; falls back to the display overall when the composite would otherwise resolve to `excluded`. |

### `PerClassResult`

Aggregate scope. Uses the shared four-state `MetricResultSchema`.

| #   | Field          | Type           | Frontend Zod         | Notes                                      |
| --- | -------------- | -------------- | -------------------- | ------------------------------------------ |
| 1   | `completeness` | `MetricResult` | `MetricResultSchema` | Contribution roll-up for the class.        |
| 2   | `accuracy`     | `MetricResult` | `MetricResultSchema` | Contribution roll-up for the class.        |
| 3   | `spag`         | `MetricResult` | `MetricResultSchema` | Contribution roll-up for the class.        |
| 4   | `overall`      | `MetricResult` | `MetricResultSchema` | Composite of the three criterion roll-ups. |

### `AppliedCriterionWeightings`

| #   | Field          | Type     | Frontend Zod | Notes                                           |
| --- | -------------- | -------- | ------------ | ----------------------------------------------- |
| 1   | `completeness` | `number` | `z.number()` | Defaults to `0.4`; may be overridden by filter. |
| 2   | `accuracy`     | `number` | `z.number()` | Defaults to `0.4`.                              |
| 3   | `spag`         | `number` | `z.number()` | Defaults to `0.2`.                              |

### `PerStudentTaskMetric`

Task display scope. Uses the narrow three-state `TaskDisplayMetricSchema` and
carries `averageContribution`.

| #   | Field                 | Type                  | Frontend Zod                | Notes                                                                                   |
| --- | --------------------- | --------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| 1   | `classId`             | `string`              | `z.string()`                | Echoed from the input class.                                                            |
| 2   | `studentId`           | `string`              | `z.string()`                |                                                                                         |
| 3   | `taskKey`             | `string`              | `z.string()`                | Built by `buildTaskKey(definitionKey, taskId)`; no assignment-instance component in v1. |
| 4   | `averageContribution` | `AverageContribution` | `AverageContributionSchema` | Derived from live definition weights.                                                   |
| 5   | `completeness`        | task display metric   | `TaskDisplayMetricSchema`   | Display accumulation.                                                                   |
| 6   | `accuracy`            | task display metric   | `TaskDisplayMetricSchema`   | Display accumulation.                                                                   |
| 7   | `spag`                | task display metric   | `TaskDisplayMetricSchema`   | Display accumulation.                                                                   |
| 8   | `overall`             | task display metric   | `TaskDisplayMetricSchema`   | Display accumulation.                                                                   |

### Input shapes

`AveragingAnalyserInputSchema` is a strict object of `filter`, `classes`, and
`assignmentDefinitionPartials`. `AnalysisFilterSchema` requires a non-empty
`classIds` array and permits optional `dateRange`, `topicKeys`,
`assignmentDefinitionKeys`, and `criterionWeightings` (which must sum to `1`
within a `1e-9` float-drift tolerance). These input shapes are unchanged by the
zero-weight feature and are documented here only for boundary completeness.

## Sub-entities

### `AverageContribution`

Backend model: none (frontend schema only).
Frontend Zod: `AverageContributionSchema` in
`src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`.

```ts
type AverageContribution = {
  effectiveWeight: number;
  includedInAverage: boolean;
};
```

The schema is a strict object with a refinement. The required relationship is a
truth table, not a free pairing:

| `effectiveWeight` | `includedInAverage` | Result                          |
| ----------------- | ------------------- | ------------------------------- |
| `> 0`             | `true`              | Accepted                        |
| `> 0`             | `false`             | Rejected — contradictory        |
| `0`               | `false`             | Accepted                        |
| `0`               | `true`              | Rejected — contradictory        |
| `< 0`             | any                 | Rejected by `z.number().min(0)` |

The refinement message is
`includedInAverage must be true exactly when effectiveWeight > 0`.

The following public shapes require `averageContribution`:

| Shape                     | Owner schema                 | Purpose                              |
| ------------------------- | ---------------------------- | ------------------------------------ |
| `PerStudentTaskMetric`    | `PerStudentTaskMetricSchema` | Per-student heatmap cell evidence    |
| `PerTaskRow`              | `PerTaskRowSchema`           | Per-task analysis display evidence   |
| `HeatmapTaskColumn`       | `heatmapAdapter.ts` (TS)     | Embedded heatmap task-group metadata |
| `MergedHeatmapTaskColumn` | `heatmapAdapter.merged.ts`   | Merged heatmap task-group metadata   |

`PerStudentRow` and `PerClassResult` remain aggregate shapes and do not expose
task-level contribution metadata.

### `MetricResult`

Backend model: none (frontend schema only).
Frontend Zod: `MetricResultSchema` (exported, four states) and
`TaskDisplayMetricSchema` (exported, three states) in
`src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`.

```ts
type MetricResult =
  | {
      state: 'computed';
      value: number;
      totalWeight: number; // non-negative in domain terms; no .min(0) on the schema
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
      totalWeight: number; // >= 0
      applicableDataPoints: 0;
      totalDataPoints: number; // integer >= 0
    };
```

`totalWeight` remains the sum of contribution weights, not display weights. A
numeric zero-weight task display can therefore have `totalWeight: 0`.

#### Aggregate-only `excluded` validation

`excluded` is the only aggregate-only state. `ExcludedMetricSchema` enforces:

- `value` is exactly `null`;
- `totalWeight` is exactly `0`;
- `applicableDataPoints` is exactly `0`;
- `totalDataPoints` is an integer of at least `1`, so an `excluded` result always
  represents at least one observed but non-contributing data point;
- placement: `excluded` is a member of the shared `MetricResultSchema` only.
  `PerTaskRow` and `PerStudentTaskMetric` use the narrow task display union,
  which omits it.

The schema does **not** encode the domain conditions "no input contributed for
any reason" or "not composed entirely of errors". Those are resolved by the
analyser's aggregate state precedence before the result is produced. A
`notAttempted` shape with `totalDataPoints: 0` (the Class-page no-data
placeholder) fails `MetricResultSchema` and is accepted only through the
adapter-local union described below.

#### Narrow task display union

`TaskDisplayMetricSchema` is an exported discriminated union of `computed`,
`notAttempted`, and `error`. Its inferred `TaskDisplayMetric` type is propagated
through analyser task projection, both heatmap adapters, heatmap table cells,
and task-preview assembly. It deliberately omits `excluded` so task displays
keep numeric zero-weight scores and genuine raw `N` values visible.

| Shape                  | Metric field schema       |
| ---------------------- | ------------------------- |
| `PerTaskRow`           | `TaskDisplayMetricSchema` |
| `PerStudentTaskMetric` | `TaskDisplayMetricSchema` |
| `PerStudentRow`        | `MetricResultSchema`      |
| `PerClassResult`       | `MetricResultSchema`      |

The analyser's `resolveDisplayMetric` return type is the schema-derived
`TaskDisplayMetric`, so task projection cannot emit `excluded`; the output
schemas reject it at runtime as a second boundary. Task-preview state/score
properties are also a discriminated pairing, so `computed` with `null` is not
representable.

### `ClassPageDisplayMetric` (adapter-local exception)

Frontend Zod: `ClassPageDisplayMetricSchema` in
`src/frontend/src/features/classPage/classPageAdapter.zod.ts`.

`ClassPageNoDataMetricSchema` is an exact, adapter-local presentation shape:

```ts
{
  state: 'notAttempted';
  value: 'N';
  totalWeight: 0;
  applicableDataPoints: 0;
  totalDataPoints: 0;
}
```

`ClassPageDisplayMetricSchema` is
`z.union([MetricResultSchema, ClassPageNoDataMetricSchema])`. It is deliberately a
plain `z.union` rather than a discriminated union because the placeholder shares
the `notAttempted` state literal with the shared union.

This zero-data shape is **not** an analyser `MetricResult`, is **not** a raw `N`,
and must not become `excluded`. It fails the shared `MetricResultSchema`
(`totalDataPoints` must be at least `1` there), so the shared raw-`N` invariant is
not weakened. The placeholder is local to the Class-page adapter model and never
crosses the analyser, persistence, or transport boundary. `classMetrics` on
`ClassPageAdapterResultSchema` uses the strict four-state `MetricResultSchema`, so
it accepts `excluded` but rejects the no-data placeholder; only
`recentAssignments` and `studentAverages` use the display union.

#### Heatmap missing-cell `N` placeholder (intentionally different)

A second presentation-only `N` shape exists on the heatmap path. The frozen
`NOT_ATTEMPTED_METRIC` fallback in `heatmapAdapter.ts`
(`buildCellsForStudent`) uses `totalDataPoints: 1`. It is deliberately different
from the Class-page zero-data placeholder:

- The heatmap fallback stands in for a missing `(studentId, taskKey)` metric on a
  task column that is otherwise in scope, so it must satisfy the task-level
  `notAttempted` invariant (`totalDataPoints >= 1`) and is reused directly as a
  `TaskDisplayMetric` across all three criteria.
- The Class-page placeholder represents a genuinely empty aggregate surface and
  uses `totalDataPoints: 0`, accepted only through
  `ClassPageDisplayMetricSchema`.

Neither shape is a raw analyser `N`, and neither can become `excluded`. The
`totalDataPoints` difference is intentional and must not be normalised away.

## State resolution

Task-level metrics resolve from display evidence; parent aggregates resolve from
contribution evidence. For a parent aggregate, the analyser applies this strict
order:

1. no observed evidence at all (all errors) → `error`;
2. at least one numeric positive-weight contribution → `computed`;
3. no numeric contribution and at least one positive-weight raw `N` →
   `notAttempted`;
4. otherwise, observations exist but none contributed → `excluded`.

Raw `N` is never generated from zero weighting. Numeric zero-weight scores are
retained as numeric display evidence and do not affect numerator, denominator, or
not-attempted handling. A mixed set of errors and zero-weight observations
resolves to `excluded`, because the observed zero-weight evidence is non-error.

When an aggregate roll-up consumes task-display `MetricResult` values rather than
the internal accumulators, it preserves the same distinction using the public
fields: a `computed` value contributes only when `totalWeight > 0`; a raw
`notAttempted` value can affect the parent only when `totalWeight > 0`; and
zero-weight `computed` or `notAttempted` inputs count as observed non-error
display evidence but no contribution. An all-error result is determined from the
input states. This lets an observed all-zero-weight task set resolve to `excluded`
rather than an all-error result.

The overall composite follows the same precedence across the three criteria and
excludes errors, not-attempted criteria, and zero-weight computed criteria from
the numeric composite. When a task-level composite would resolve to `excluded`,
`buildPerTaskRows` substitutes the task's display overall so the row retains a
valid narrow display state.

Recent Assignment card averages are aggregate scope. They apply this same
contribution-aware roll-up over their per-task display inputs and resolve an
all-zero-weight assignment to `excluded`, not a throw or a numeric task result.

## Heatmap projection contract

Heatmap adapters resolve `AverageContribution` from the live
assignment-definition partial and emit it on task-column descriptors. UI code
must consume that descriptor and must not derive weighting from displayed scores
or duplicate definition resolution.

| Field                 | `HeatmapTaskColumn`   | `MergedHeatmapTaskColumn` |
| --------------------- | --------------------- | ------------------------- |
| `taskKey`             | `string`              | `string`                  |
| `taskId`              | `string`              | `string`                  |
| `taskTitle`           | `string\|null`        | `string\|null`            |
| `averageContribution` | `AverageContribution` | `AverageContribution`     |
| `assignmentId`        | —                     | `string`                  |
| `definitionKey`       | —                     | `string`                  |
| `assignmentName`      | —                     | `string`                  |

`MergedHeatmapTaskColumn` is produced by spreading the shared `buildTaskColumns`
projection and adding the full assignment identity, so the contribution metadata
is inherited unchanged. In merged heatmaps, a definition-scoped duplicate
`taskKey` has one unambiguous contribution value: duplicate columns are collapsed
by `taskKey`, and every collapsed instance shares the same definition-scoped
effective weighting.

## Display contract

The `excluded` state is displayed as **Excluded** with accessible text:

> Excluded from average: displayed work had zero weighting.

- `MetricPill` renders the literal label `Excluded` for the state, with
  `role="img"` and the shared accessible name.
- Its neutral treatment is the Ant Design `default` Tag colour with a
  theme-aware neutral cell style supplied as the `metric-tone-excluded-cell`
  stylesheet class (defined in `index.css` as
  `--ant-color-fill-quaternary` background, `--ant-color-text-secondary` text);
  it is not muted and does not reuse the not-attempted or error treatment.
- Ascending order is `computed → notAttempted → excluded → error`; descending
  order is the exact reverse.
- It is never classified numerically by range filters; it has a separate
  `includeExcluded` filter toggle, appended as the fifth `|`-separated field of
  the encoded filter key. Legacy four-field keys decode with `includeExcluded`
  set to `false`.
- Zero-effective-weight heatmap task headers show the explanatory text specified
  by [`TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md`](../../../TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md).

## Validation

**Frontend Zod:**

- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` →
  `AverageContributionSchema`, `MetricResultSchema` (four states),
  `TaskDisplayMetricSchema` (exported, three states), `PerStudentRowSchema`,
  `PerTaskRowSchema`, `PerClassResultSchema`, `PerStudentTaskMetricSchema`,
  `AveragingResultSchema`, `DataAnalysisResponseSchema`,
  `AveragingAnalyserInputSchema`, `AnalysisFilterSchema`,
  `AppliedCriterionWeightingsSchema`.
- `src/frontend/src/features/classPage/classPageAdapter.zod.ts` →
  `ClassPageNoDataMetricSchema`, `ClassPageDisplayMetricSchema`,
  `RecentAssignmentCardModelSchema`, `StudentAverageRowModelSchema`,
  `ClassPageAdapterResultSchema`.

**Backend transport validation:**

- None. No backend model, `z_Api` handler, controller, or transport change is
  associated with this contract.

**Key domain validation rules** (enforced by the analyser or adapters, not visible
from the schemas alone):

- `includedInAverage` must equal `effectiveWeight > 0`.
- A submission task ID absent from the live partial is warned and dropped; it
  never receives a default task weight or contributes to any accumulator.
- `excluded` is valid for aggregate scopes only; task display shapes use the
  exported narrow union, and task-preview state/score pairs are correlated by
  their schema-derived discriminator.
- A zero-weight raw `N` remains `notAttempted`, not `excluded`, at task level.
- A zero-weight numeric result remains numeric at task level, with
  `totalWeight: 0` and `includedInAverage: false`.
- Multiple numeric zero-weight observations resolving to one task display value
  use their unweighted arithmetic mean.
- The Class-page no-data placeholder is the only accepted `notAttempted` shape
  with `totalDataPoints: 0`, and only through `ClassPageDisplayMetricSchema`.

**Contract notes:**

- The schemas enforce field-level invariants and shape placement only. The
  aggregate-only `excluded` domain conditions ("no input contributed" and "not
  all errors") and cross-field relationships such as
  `totalDataPoints >= applicableDataPoints` are produced and enforced by the
  analyser's accumulation, roll-up, and composite logic, not by a Zod refinement.
- `ClassPageNoDataMetricSchema` deliberately fails `MetricResultSchema`
  (`totalDataPoints: 0`) and is accepted only through
  `ClassPageDisplayMetricSchema`; `ClassPageAdapterResultSchema.classMetrics`
  uses the strict shared union and rejects it.
- `PerTaskRow.taskTitle` is always `null` in v1 because `buildPerTaskRows` does
  not project titles into the analyser's `perTask` display rows. The live
  `TaskPartial` does carry `taskTitle`, and the heatmap adapters read it
  separately from the live partial (`buildTaskColumns`); the analyser field is
  reserved for future cross-reference resolution.
- `MergedHeatmapTaskColumn.averageContribution` is inherited from the shared
  base projection; merged dedupe-by-`taskKey` guarantees one definition-scoped
  value per collapsed column.

## File Index

Persistence model: none (frontend-only contract).

Frontend schema: `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`
Frontend service: `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`
Effective-weight helper: `src/frontend/src/services/assignmentDefinition/assignmentDefinitionUtilities.ts`
Task-key helper: `src/frontend/src/services/dataAnalysis/taskKey.ts`
Analyser: `src/frontend/src/services/dataAnalysis/analysers/`
├── `averagingAnalyser.ts`
├── `averagingAnalyser.accumulation.ts`
├── `averagingAnalyser.accumulatorRegistry.ts`
├── `averagingAnalyser.composite.ts`
├── `averagingAnalyser.criterionAccumulation.ts`
├── `averagingAnalyser.filters.ts`
├── `averagingAnalyser.metricResolution.ts`
├── `averagingAnalyser.rows.ts`
├── `averagingAnalyser.taskProjection.ts`
├── `averagingAnalyser.types.ts`
├── `resolveAssignmentDefinition.ts`
└── `rollupMetric.ts`

Heatmap adapters: `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`, `src/frontend/src/services/dataAnalysis/heatmapAdapter.merged.ts`
Metric display: `src/frontend/src/services/dataAnalysis/metricDisplay/`
Class-page adapter schema: `src/frontend/src/features/classPage/classPageAdapter.zod.ts`
