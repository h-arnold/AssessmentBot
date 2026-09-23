# Zero-Weight Assessment Display and Aggregation Specification

## Status

- v1.0 — implemented for GitHub issue #307.
- Defines the agreed remediation for GitHub issue #307.

## Purpose

This specification defines how the data-analysis service must distinguish an
assessment score that is displayed from an assessment score that contributes to
an average.

The feature will be used to:

- retain teachers' assessed numeric scores for zero-weight tasks and assignments;
- preserve genuine not-attempted (`N`) assessment semantics;
- prevent zero-weight work from affecting student, task, assignment, or class
  averages; and
- make an aggregate with no contributing work visibly distinct from an
  unattempted assessment.

This feature is **not** intended to:

- change persisted assignment or task weighting values, their validation, or
  their live-partial resolution;
- change criterion weighting or SPaG renormalisation rules;
- introduce a new analysis endpoint, storage model, route, or user workflow; or
- alter the existing assignment-instance keying of `perStudentTaskMetrics`.

## Agreed product decisions

1. A numeric assessment recorded for a task whose effective weighting is zero
   must remain a numeric, displayed score.
2. Effective weighting is the product of the live assignment weighting and the
   live task weighting. A zero assignment weighting therefore excludes every
   task in that assignment from averages; a zero task weighting excludes only
   that task.
3. A raw `N` is a genuine not-attempted/not-applicable result. It must continue
   to display as `N` and retain the existing positive-weight aggregation rules.
4. Zero weighting is an aggregation policy, not a metric state. It must never
   manufacture an `N` or an `E` value for an assessed numeric result.
5. Each displayed task-level result must expose explicit average-contribution
   metadata so consumers can identify whether its score affected parent
   averages.
6. Per-student and per-class aggregate metrics must use contribution data only.
   A zero-weight observation contributes neither a numerator, denominator, nor
   a not-attempted penalty.
7. A parent aggregate with observations but no positive-weight contribution must
   use a distinct `excluded` metric state, displayed as an excluded/no-average
   result. It must not display as `N`, `E`, or a numeric average.
8. The task-level heatmap and per-task analysis views must continue to show
   numeric zero-weight assessments and genuine raw `N` values. They must not
   replace either with the aggregate-only `excluded` state.
9. The frontend must present an `excluded` result as a non-numeric status with
   accessible text that explains that no score contributed to the average. It
   must not use the visual treatment or wording for not attempted.
10. When multiple numeric zero-weight observations resolve to the same
    task-level display metric, the displayed value is their unweighted
    arithmetic mean. This is display-only and never becomes an average
    contribution.
11. Every zero-effective-weight task header in a task table or heatmap must
    provide a non-interactive accessible tooltip: “Zero weighting — scores are
    shown but do not contribute to averages.” The rule applies whether zero
    weighting originates from the task or its assignment.
12. State-aware table ordering places `excluded` after `notAttempted` and
    before `error`; users can include or exclude it through its own filter
    option.
13. A zero-effective-weight task group in the task heatmap must have a subtle,
    theme-aware 2px vertical accent border on its left and right edges, spanning
    the grouped header and its metric cells. Conditional-format score
    backgrounds must remain unchanged.
14. A Recent Assignment card's criterion and overall values are aggregate
    results. When its represented assignment has observations but no
    positive-weight contribution, it must display `Excluded` using the same
    precedence as student and class aggregates; it must not fail the Class page
    or use a task-level numeric display result as its card average.

## Existing system constraints

### Backend or API constraints already in place

- Assignment and task weightings are persisted and exposed through the live
  assignment-definition partial registry. Valid zero task weightings are
  already preserved by the AssignmentDefinition contract.
- `AveragingAnalyser` resolves assignment and task weightings from those live
  partials; it does not own persistence or API transport.
- `DataAnalysisService` is a pure frontend orchestrator. It validates input and
  output with Zod and delegates analysis to `AveragingAnalyser`.

### Current data-shape constraints

- `MetricResult` is currently a discriminated union of `computed`,
  `notAttempted`, and `error`. The planned `excluded` state is an additive
  frontend validation and consumer contract change; it does not cross a
  backend API boundary.
- `PerStudentTaskMetric` is the heatmap-facing task-cell shape and currently
  contains only identifiers and the four `MetricResult` values.
- `MetricResult.totalWeight` remains the sum of average contribution weights.
  A displayed numeric zero-weight result may therefore have `totalWeight: 0`;
  its displayed value is derived from display accumulation, not from division
  by `totalWeight`.

### Frontend or consumer architecture constraints

- The data-analysis service remains independent of React, Ant Design, network
  transport, and persistence.
- `heatmapAdapter` maps `perStudentTaskMetrics` into heatmap cells. Class-page
  and task-heatmap views consume the common `MetricResult` display modules.
- `heatmapAdapter` and `heatmapAdapter.merged` own heatmap task-column
  contribution metadata. The table must not reimplement weighting resolution.
- `MetricPill`, metric tones, range filters, sort ranks, comparators, and table
  cell renderers must handle every `MetricResult` state exhaustively.
- The current zero-weight path in `processAssignment` creates synthetic
  not-attempted data and skips the real assessment. That behaviour is obsolete
  under this specification.

## Domain and contract recommendations

### Why this approach is preferable

- Display evidence and aggregate contribution are different domain facts. A
  dual accumulation model represents both without overloading `N`.
- Explicit contribution metadata lets adapters and future analysis surfaces
  explain why a numeric task score was not included in an average.
- An aggregate-only `excluded` state prevents the existing `N` and `E` meanings
  from being weakened or redefined.

### Recommended data shapes

#### Average contribution

```ts
{
  effectiveWeight: number; // assignmentWeighting × taskWeighting
  includedInAverage: boolean; // true exactly when effectiveWeight > 0
}
```

`effectiveWeight` is the live assignment weighting multiplied by the live task
weighting for each represented observation and is non-negative.
`includedInAverage` must be `true` exactly when `effectiveWeight > 0`; a
contradictory pair is invalid. The task-level keys are definition-scoped, so
every observation in one current task-level result has the same configured
effective weighting. Internal roll-ups, rather than this display metadata,
remain authoritative for summed contribution weight.

#### Metric result

```ts
type MetricResult =
  | {
      state: 'computed';
      value: number;
      totalWeight: number;
      applicableDataPoints: number;
      totalDataPoints: number;
    }
  | {
      state: 'notAttempted';
      value: 'N';
      totalWeight: number;
      applicableDataPoints: 0;
      totalDataPoints: number;
    }
  | {
      state: 'error';
      value: 'E';
      totalWeight: number;
      applicableDataPoints: 0;
      totalDataPoints: number;
    }
  | {
      state: 'excluded';
      value: null;
      totalWeight: 0;
      applicableDataPoints: 0;
      totalDataPoints: number;
    };
```

`excluded` is valid only for aggregate output where at least one observation
exists but none contributes to the average and the observations are not all
errors. `totalDataPoints` is an integer of at least one. It is not a substitute
for a raw task score.

The visible label for `excluded` is **Excluded**. Its accessible name is
“Excluded from average: displayed work had zero weighting.”

#### Task-level analysis result

```ts
{
  classId: string;
  studentId: string;
  taskKey: string;
  averageContribution: {
    effectiveWeight: number;
    includedInAverage: boolean;
  }
  completeness: MetricResult;
  accuracy: MetricResult;
  spag: MetricResult;
  overall: MetricResult;
}
```

Both `PerStudentTaskMetricSchema` and `PerTaskRowSchema` must add the
`averageContribution` field. Per-student and per-class aggregate rows do not
expose task-level contribution metadata.

The code block above illustrates `PerStudentTaskMetric`. `PerTaskRow` retains
its existing `{ definitionKey, taskId, taskTitle }` identity fields and adds the
same `averageContribution` field alongside its metric fields; it does not gain
`classId`, `studentId`, or `taskKey`.

#### Heatmap task column

```ts
{
  taskKey: string;
  taskId: string;
  taskTitle: string | null;
  averageContribution: {
    effectiveWeight: number;
    includedInAverage: boolean;
  }
}
```

Both heatmap adapters must emit this metadata on their task-column descriptors.
`TaskHeatmapTable` consumes the descriptor rather than deriving weighting from
scores or independently resolving assignment-definition partials. In merged
heatmaps, duplicate task keys are intentionally collapsed by definition key;
their assignment and task weighting are definition-scoped, so every collapsed
instance has the same effective weighting and therefore one unambiguous
column-level contribution value.

### Naming recommendation

Prefer:

- `averageContribution` for the explicit task-level metadata;
- `effectiveWeight` for the product of assignment and task weighting; and
- `excluded` for an aggregate with no contributing score.

Avoid:

- `notAttempted` for a zero-weight numeric assessment;
- `ignored`, which does not state whether the score is displayed; and
- `displayWeight`, which could be confused with a score's influence on an
  average.

### Validation recommendation

#### Frontend

- Extend the shared Zod `MetricResult` union with a strict `excluded` member.
- Add a strict `AverageContribution` schema and require it on task-level
  result schemas.
- Validate that `includedInAverage` agrees with `effectiveWeight`.
- Retain the existing strict validation of the three established metric states.

#### Backend

- No backend validation, persistence, controller, or transport changes are
  required. Existing weight validation and transport remain authoritative.

### Display-resolution recommendation

- Task-cell and per-task displays resolve their values from display
  accumulation, irrespective of average contribution.
- Parent averages resolve from average accumulation only.
- `excluded` is valid for average scopes only: per-student, per-class, and a
  Class-page result shaped to one assignment, including a Recent Assignment
  card. It is never valid for a
  per-student-task cell or per-task row, both of which remain display scopes.
- When an aggregate roll-up consumes task-display `MetricResult` values, it
  must use `totalWeight` and state as contribution evidence: a `computed` value
  contributes only when `totalWeight > 0`; a raw `notAttempted` result affects
  parent handling only when `totalWeight > 0`; and a zero-weight `computed` or
  raw `notAttempted` result records observed display evidence but no
  contribution. All-error detection is based on input states, so observed
  zero-weight non-error values resolve to `excluded`, not `error`.
- The Class-page recent-assignment roll-up is aggregate scope, not a typed
  display passthrough. It must apply the same contribution-aware precedence as
  student and class rows; it must replace the current all-zero-weight throw
  with `excluded`.
- `excluded` must render as an explicit no-average status and be excluded from
  numeric range filtering and numeric sorting calculations. State-aware sorting
  and filters must expose it as its own state rather than grouping it with `N`
  or `E`. It ranks after `N` and before `E`, and has its own include/exclude
  filter control and encoded filter state.
- The metric display layer must use an intentionally distinct neutral excluded
  treatment and widen its display-value contract for the non-numeric `null`
  value. It must not reuse the not-attempted muted treatment or error colour.

## Feature architecture

### Placement

- The feature belongs in `src/frontend/src/services/dataAnalysis/`, with the
  existing `DataAnalysisService` → `AveragingAnalyser` composition retained.
- Metric-state presentation belongs in the existing
  `services/dataAnalysis/metricDisplay/` domain and its current consumers.
- No parallel analyser, frontend service, or presentation-only calculation may
  recreate weighting logic.

### High-level relationships

```text
DataAnalysisService
└── AveragingAnalyser
    ├── resolveAssignmentDefinitionData (live weighting source)
    ├── scoped assessment accumulators
    │   └── criterion accumulators
    │       ├── display accumulation
    │       └── average-contribution accumulation
    ├── task-level metric projection
    └── aggregate roll-up
        ├── per-student rows
        ├── per-task rows
        └── per-class result

Metric display consumers
├── MetricPill and metric display helpers
├── Class-page adapters, Recent Assignment cards, and tables
└── heatmap adapters and tables
```

### Out of scope for this surface

- Weighting-edit UI changes.
- A new dedicated zero-weight badge, tooltip, or interaction beyond the agreed
  `excluded` aggregate presentation and accessible text.
- Migration of unrelated analysis tests or an analyser-wide object-oriented
  refactor unrelated to dual accumulation.

## Core behavioural model

### Assessment recording

For every submission item, the analyser must record its raw criterion scores in
display accumulation. It must record the same data in average accumulation only
when its effective weight is greater than zero.

Raw score meaning is unchanged:

- a numeric score is assessed evidence;
- `N` is genuine not attempted/not applicable evidence; and
- an absent or unusable score follows the existing `error` rules.

For task-level display scopes, `applicableDataPoints` is the count of numeric
display observations and `totalDataPoints` is the count of numeric and raw
`N` display observations. A numeric zero-weight cell therefore remains valid
with at least one applicable data point and `totalWeight: 0`. For average
scopes, `applicableDataPoints` counts numeric contributing observations only,
while `totalDataPoints` counts every numeric or raw `N` observed input,
including displayed excluded observations. Absent or unusable assessment
values retain the existing error-count behaviour.

### Task-level output

- A zero-weight numeric task produces a numeric metric in the task-level
  output, with `averageContribution.includedInAverage: false` and
  `effectiveWeight: 0`.
- When more than one numeric zero-weight observation resolves to one task-level
  display value, that value is the unweighted arithmetic mean of those numeric
  raw scores. Raw `N` observations remain non-numeric and follow their existing
  criterion rules; they are not converted to zero for display arithmetic.
- A zero-weight raw `N` produces `notAttempted`, not `excluded`, with the same
  false contribution metadata.
- A positive-weight raw `N` remains `notAttempted` with true contribution
  metadata and retains its current per-criterion roll-up behaviour.
- Per-student-task cells and per-task rows are display scopes. They never
  produce `excluded`: numeric values use display accumulation, raw `N` uses
  existing not-attempted semantics, and no observations use existing error
  semantics.

### Aggregate output

- A positive-weight numeric result contributes to the weighted numerator and
  denominator.
- A zero-weight observation contributes nothing to aggregate numerator,
  denominator, not-attempted weight, applicable count, or aggregate state
  selection. It does remain included in aggregate `totalDataPoints`, so the
  result accurately reports that evidence was displayed but not weighted.
- Existing `N` treatment remains unchanged for contributing observations:
  completeness and accuracy include its positive weight as a zero score;
  SPaG excludes it and renormalises the overall score.
- Existing `error` treatment remains unchanged: errors are excluded when other
  usable aggregate inputs exist.
- Aggregate state precedence is, per criterion:
  1. `error` when every observed input is an error;
  2. `computed` when at least one positive-weight numeric input contributes;
  3. `notAttempted` when no numeric input contributes and the existing
     criterion roll-up rules resolve at least one positive-weight raw `N` to
     not attempted. This expressly preserves SPaG's current `N` behaviour;
     and
  4. `excluded` when observations exist, no input contributes for any reason
     (including zero weighting alongside excluded errors), and the
     observations are not all errors.
- If contributing observations exist, the aggregate is determined exclusively
  by those contributing observations. Excluded observations cannot change its
  value or state.

### Overall metric

- Individual task overall values continue to use the configured criterion
  weighting and existing SPaG renormalisation based on display observations.
- Aggregate overall values are composed from contributing criterion aggregates
  only.
- Overall aggregate state precedence is:
  1. `error` when every candidate criterion observation is an error;
  2. `computed` when at least one contributing criterion aggregate is
     computed;
  3. `notAttempted` when no criterion aggregate is computed but at least one
     criterion aggregate is `notAttempted` from a positive-weight raw `N`; and
  4. `excluded` when no criterion aggregate contributes a numeric score or a
     positive-weight raw `N`, and the candidate observations are not all
     errors.

### Sort order and filtering

1. Numeric comparisons apply only to `computed` results.
2. `excluded` is a distinct non-numeric state.
3. Existing `notAttempted` and `error` state ordering remains unchanged relative
   to each other; `excluded` ranks after `notAttempted` and before `error`.
   Descending state ordering is the exact reverse: `error`, `excluded`,
   `notAttempted`, then computed results.
4. Range filters must not classify `excluded` as numeric, `N`, or `E`; they
   expose a dedicated excluded-state option.

## Main user-facing surface specification

### Rendering rules

#### Zero-weight task with a numeric score

- Show the numeric score in the task heatmap and per-task result.
- Do not downgrade the value to `N` or `E`.
- Exclude the value from every parent average.
- When a task-level result represents several numeric zero-weight observations,
  show their unweighted arithmetic mean.
- Attach a non-interactive tooltip to the corresponding task header with the
  exact text: “Zero weighting — scores are shown but do not contribute to
  averages.”

#### Genuine raw `N`

- Show `N` using the existing not-attempted treatment.
- Apply existing roll-up behaviour only when the task has positive effective
  weighting.

#### Excluded aggregate

- Show the visible label **Excluded**, not a numeric score, `N`, or `E`.
- Provide the accessible name “Excluded from average: displayed work had zero
  weighting.”

#### Zero-weight task heatmap group

- Retain every score-cell's existing conditional-format background and score
  colour.
- Add a subtle, theme-aware 2px vertical accent border to the group's left and
  right edges, from the grouped task header through all metric cells.
- Apply the same task-header tooltip and accessible explanation as every other
  zero-effective-weight task header.

### Accessibility and usability notes

- The excluded status must have an accessible name distinct from the literal
  `N` and `E` labels.
- Existing task heatmap cell labels must include the actual raw score for a
  zero-weight numeric task.
- The zero-weight task-header tooltip must open on hover and keyboard focus.
  Its non-actionable focusable header label adds one tab stop for each
  zero-weight task group and must not activate sorting, preview, filtering, or
  any other table action.
- The accent border is a non-interactive group marker. It must not conceal,
  override, or reduce the contrast of conditional-format score backgrounds.
- Existing keyboard, focus, and table navigation behaviour is unchanged.

## Error, loading, and empty-state rules

- `excluded` is a valid analysed result, not a loading, transport, or error
  state. It must not trigger an alert or fallback UI.
- Existing malformed-data and missing-assessment handling continues to use
  `error`.
- A class with no assignments or no observations remains governed by existing
  empty/error semantics; it must not be reclassified as `excluded`.
- A pre-registered task with no observations remains `error`; it is not
  `excluded` merely because its configured weighting is zero.

## Backend changes required to support agreed behaviour

None. The feature changes frontend analysis and its validated output contract
only; backend weighting persistence and live-partial transport already support
zero values.

## Planning handoff notes

- Create a canonical data-shape specification for the frontend data-analysis
  response before implementation and mark the planned additions `Not
implemented`.
- Use a dual display/average accumulator design; do not implement separate
  weighting calculations in adapters or components.
- Preserve the current service/analyser entry points and live weighting
  resolution helper.
- Follow `TASK_HEATMAP_ZERO_WEIGHT_LAYOUT.md` for the material heatmap
  presentation changes: the focusable explanatory header tooltip and the
  zero-weight task-group accent border. It is required because these alter
  visible table status treatment, although they do not alter page navigation or
  workflow.

## Testing expectations

- Add red-first analyser tests for zero task weighting, zero assignment
  weighting, mixed positive/zero weighting, and genuine raw `N` at both zero
  and positive effective weights.
- Assert scores independently of analyser internals from a cloned canonical
  `small` synthetic profile. Apply zero weight as the narrow local boundary
  mutation, then pre-compute expected display and aggregate values outside the
  service under test. This uses canonical realistic data while retaining a
  local boundary fixture as permitted by the synthetic-fixture policy.
- Add schema contract tests for contribution metadata and `excluded` metrics.
- Add adapter, display-helper, component, filtering, and sorting tests for the
  new valid state.
- Add Playwright coverage for the visible excluded aggregate and retained
  zero-weight numeric task score, because both are user-visible outcomes.

## Documentation and rollout notes

- Add the planned frontend data-analysis response contract under
  `docs/developer/data-shapes/` and register it in the index before code
  changes.
- Update the teacher-facing scoring guide to distinguish zero weighting,
  not-attempted `N`, error `E`, and excluded aggregates.
- No persistence migration, feature flag, or backend deployment sequence is
  required.

## V1 scope recommendation

### Include in v1

- Dual display and average accumulation in the existing analyser.
- Explicit task-level contribution metadata.
- The aggregate-only `excluded` metric state and all existing frontend metric
  consumers.
- Focused canonical synthetic-profile regression coverage and visible browser
  coverage.

### Defer from v1

- New weighting controls or bulk weighting workflows.
- A teacher-configurable display label or separate explanatory tooltip for
  every zero-weight task cell.
- Re-keying task metrics by assignment instance.
