# Architectural Verdict: Task Heatmap Filtering Infrastructure

**Reviewer:** Staff engineer (pre-implementation)
**Status:** Neither architect is fully right. Both made errors the other correctly identified but
each missed things the other caught — and both missed the elephant in the room.
**Scope:** Adjudicates between `SPEC.md` (Alice) and `HEATMAP_ARCHITECTURE_CRITIQUE.md` (Bob) on the
correct data-filtering and analysis architecture for the heatmap feature and the downstream
multi-axis analysis future it is meant to anchor.

---

## Table of Contents

1. [Summary judgement](#1-summary-judgement)
2. [What Alice got wrong](#2-what-alice-got-wrong)
3. [What Bob got wrong](#3-what-bob-got-wrong)
4. [What both missed](#4-what-both-missed)
5. [The correct architecture](#5-the-correct-architecture)
6. [Migration path](#6-migration-path)
7. [Cost-benefit summary](#7-cost-benefit-summary)

---

## 1. Summary judgement

**Bob has the sharper eye for what is wrong** but his proposed fix is wrong too — and he is
wrong about several details. **Alice's spec has the right user-facing product thinking** (view
state, breadcrumbs, accessibility, navigation) but her architecture is a dead end that will
require the exact refactor she claims to be avoiding.

Neither architect correctly identified the real gap in the existing pipeline — the
`perStudentTaskAccums` intermediate representation — which means both proposed solutions are
incomplete. Alice builds a parallel system that duplicates everything. Bob says "just reuse the
analyser output" without realising the analyser output is already too aggregated for what the
heatmap needs.

The heatmap needs **per-(student, task, criterion) MetricResult values**, not the rolled-up
per-student or per-task averages the `AveragingAnalyser` currently produces. The existing
pipeline already _computes_ these values (inside `accumulateDataPoints`, stored in
`perStudentTaskAccums` at `averagingAnalyser.accumulation.ts:268`) but they are converted to
`MetricResult` and then immediately rolled up by `rollupAccumulators` and thrown away. Neither
proposal noticed this gap.

---

## 2. What Alice got wrong

### 2.1 The `FilterVisitor` / `FilterEngine` pattern is the wrong abstraction (critical)

Alice proposes a `FilterVisitor` OOP interface, a `FilterEngine` registry, and a concrete
`AssignmentFilterVisitor` — all operating over raw `ClassFull` data (SPEC.md:38, 114-116,
191-192, 381). This is architecturally wrong on three independent grounds:

**2.1.1 Pattern mismatch with the cited consistency argument**

Alice claims the visitor pattern is "consistent with `AveragingAnalyser` and backend patterns"
(SPEC.md:38, 67). This claim is false.

- The `DataAnalysisService` uses a **strategy/registry** pattern (`dataAnalysisService.ts:19-33`):
  it holds a `Map<string, AveragingAnalyser>` and dispatches by string key. That is a registry of
  strategies, not a visitor hierarchy. A visitor pattern would involve an element hierarchy with
  `accept(visitor)` methods — none of that exists.
- The backend has **zero visitor-pattern code**. A `grep` for `Visitor` or `FilterVisitor` across
  all `.js` files in `src/backend` returns no results. The backend uses singletons (`Class.getInstance()`),
  facades, plain GAS functions, and collection registries (LokiJS). The word "registry" in the
  backend refers to data-storage registries (`assignment_definitions` collection), not behavioural
  patterns.

The consistency argument is Alice's headline rationale. It is factually incorrect. When the
justification collapses, the `FilterVisitor` approach loses its primary support.

**2.1.2 Visitor is the wrong pattern for predicate composition**

The visitor pattern earns its keep when you have a **stable data structure** and a **growing
family of operations** over it (double-dispatch). Here the axis of change is the reverse:

- The data structure (`ClassFull`) is wide but stable-ish.
- The operations are **few and uniform**: each filter is a predicate `T → boolean`
  ("does this assignment match topic X?", "fall in date range Y?", "equal assignment Z?").

A `FilterVisitor` whose only behaviour is `assignment.id === selectedId` is a class wrapping a
one-line predicate. The `FilterEngine` becomes a `for` loop calling `.visit()` on each visitor.
This is a predicate list wearing a trench coat — it adds class-count, registry boilerplate, and
indirection with no behavioural payoff. The engine is less extensible than adding one optional
array field to the existing `AnalysisFilter` Zod schema (`dataAnalysis.zod.ts:19`):

```typescript
// existing — AnalysisFilterSchema at dataAnalysis.zod.ts:19-43
classIds: z.array(z.string().min(1)).min(1),
dateRange: ...,  // optional
topicKeys: ...,  // optional
assignmentDefinitionKeys: ...,  // optional

// Alice's way for new axis → new class + registry registration + engine change
// Right way → one line:
assignmentIds: z.array(z.string().min(1)).optional(),
```

**2.1.3 Conflates data selection with display filtering**

Alice's spec says "All columns filterable with band filters (red/gold/green/default/volcano)"
(SPEC.md:34, 257) and places these band filters inside the `FilterEngine` alongside data
selection filters. This is an architectural category error.

Band filters operate on _derived_ `MetricResult` values — specifically on the `computed` state's
numeric `value` field, binned into `red`/`gold`/`green` (`metricTone.ts:69-83`). These `MetricResult`
values only exist _after_ the analyser has run. Band filtering is therefore a **presentation-layer
column filter on derived metrics**, not a data-source selection filter.

The existing Class page already solves this correctly (`studentAveragesTableColumns.tsx:110-116`):

```typescript
onFilter: (value, record): boolean => {
  const metric = getStudentMetric(record.metrics, key);
  const { color } = resolveMetricTone(metric, DEFAULT_TONE_RANGE);
  return color === String(value);
},
```

This is an Ant Design `Table` column `filters`/`onFilter` predicate, operating over the already-
computed `MetricResult`. It is clean, it works, and it required no `FilterEngine` at all.
Recommending a parallel approach for the heatmap ignores the existing, battle-tested pattern.

### 2.2 `HeatmapTransform` re-implements the analyser (critical)

The spec proposes extracting raw scores from `ClassFull.assignments[].submissions[].items[].assessments`
and wrapping them in new `MetricResult` objects (SPEC.md:228-230):

```
"Extract assessments.{completeness|accuracy|spag}.{score} from submission items"
"Wrap raw scores in MetricResult objects (computed or notAttempted)"
```

This duplicates the entire `accumToMetric` → `computeOverallComposite` chain
(`averagingAnalyser.accumulation.ts:40-418`) including:

- Criterion weighting resolution
- SPaG renormalisation
- `nCount`/`applicableDataPoints` accounting
- Error-precedence logic (`error > notAttempted > computed`)
- `overall` composite computation with its three-way state machine

Two independent implementations of the same invariant will drift. The heatmap's will be the
lower-fidelity one because it will inevitably skip edge cases the analyser handles (zero-weight
tasks, missing assignment definitions, etc.). The spec acknowledges this would be a "second,
independent implementation" (SPEC.md:229) and treats it as acceptable — but it is the exact
refactor liability Alice claims to be avoiding.

### 2.3 Redundant Zod vocabulary (medium)

`TaskHeatmapCell` (SPEC.md:73-85) re-declares:

```typescript
metrics: {
  completeness: MetricResult;
  accuracy: MetricResult;
  spag: MetricResult;
}
```

This is an exact copy of `PerTaskRow`/`PerStudentRow` (`dataAnalysis.zod.ts:120-149`), which
already hold:

```typescript
completeness: MetricResultSchema,
accuracy: MetricResultSchema,
spag: MetricResultSchema,
overall: MetricResultSchema,
```

`TaskHeatmapRow` and `TaskHeatmapResult` (SPEC.md:87-107) are thin repackagings of
`AveragingResult` (`dataAnalysis.zod.ts:181-190`). Adding new schema families means a new
trust-boundary validator (SPEC.md:128 mandates Zod validation "after transform"), a new place
for the `MetricResult` invariant to be duplicated, and new drift surface between the heatmap's
shape and the canonical one.

### 2.4 V1 scope backs into a dead end (medium)

Alice deliberately scopes v1 to "single assignment × single class" and defers cross-class,
cohort, topic, time-range, and student-characteristic filtering to later (SPEC.md:29, 165-172,
391-400). This sounds prudent but is self-defeating.

The existing `AnalysisFilter` + `AveragingAnalyser` pipeline already operates over
`classes: ClassFull[]` and `classIds: string[]` — multi-class by construction
(`dataAnalysis.zod.ts:57-63`; `averagingAnalyser.ts:69-71` maps over `sortedClasses`). The
heatmap's `AssignmentFilterVisitor` is a strictly narrower code path that cannot express any
of the deferred axes. When cohorts finally arrive, Alice has two choices:

1. Throw the `FilterVisitor`/`FilterEngine`/`AssignmentFilterVisitor` work away — the very
   refactor she is trying to avoid.
2. Bolt cohort support onto a visitor hierarchy that was never shaped for it — which is the
   same refactor, just spread over two releases.

The cheapest path to extensibility is **not to special-case v1 at the architecture level**:
use the general `AnalysisFilter` you already have, and let "single assignment" be _just a value
in the filter_ (`assignmentIds: [id]`), not a separate code path. The generality is free because
it already exists.

### 2.5 What Alice got right

- **Product thinking is sound.** The entry point (click RecentAssignmentCard), navigation pattern
  (view-state inside ClassPage), breadcrumb updates, accessibility requirements, and rendering
  states (loading/empty/ready) are well-specified and consistent with the existing ClassPage code.
- **MetricPill compact mode.** The spec correctly identifies that `MetricPill` needs a compact
  rendering mode for the dense heatmap layout. This is a genuine new requirement that neither
  the `AveragingAnalyser` nor the `ClassPageAdapter` addresses.
- **View-state management.** The `selectedView: 'overview' | { type: 'heatmap', assignmentId: string }`
  pattern is consistent with how `ClassPage.tsx` already manages its surface state.

---

## 3. What Bob got wrong

### 3.1 Recommends a `HeatmapAnalyser` in the registry — wrong tool (critical)

Bob's central proposal (critique §8, item 3) is: "Add a `HeatmapAnalyser` (a new key in the
existing `DataAnalysisService` registry)." This is architecturally wrong.

The `DataAnalysisService` registry holds `AveragingAnalyser` instances (`dataAnalysisService.ts:21`):

```typescript
private readonly registry: Map<string, AveragingAnalyser>;
```

The registry's type signature is `Map<string, AveragingAnalyser>`. A `HeatmapAnalyser` would
need a different output type (heatmap-specific view model vs. `DataAnalysisResponse`), which
means either:

1. Making the registry generic (`Map<string, Analyser<any>>`) — widening a stable interface
   for a single consumer, violating YAGNI.
2. Making the heatmap call the averaging analyser internally and then transform its output —
   which is exactly what Bob says not to do, but inside a thin class wrapper that adds nothing.
3. Creating a separate non-registered analyser — which is what an adapter/projection function
   is, not a new analyser.

The `DataAnalysisService` is a **pipeline** not a **menu**. The analyser registry exists to
support different _computation strategies_ for the same output contract. The heatmap doesn't
need a different computation strategy — it needs the same computation results projected into
a different shape. That is an **adapter** function, not an analyser. Creating a registry entry
for a different-shaped output is the wrong tool.

### 3.2 Asserts a 30-line adapter — undercounts by an order of magnitude (medium)

Bob claims the heatmap adapter is "roughly 30 lines" (critique §3). This is naive.

The heatmap's view model — per-student rows × per-task columns × per-criterion sub-columns in a
2-row grouped Ant Design header — is structurally different from `PerStudentRow`/`PerTaskRow`.
The existing `classPageAdapter.ts` is 495 lines for a simpler transformation (flat metric columns).
A heatmap adapter must:

- Build a matrix of students × tasks (n² complexity in the general case)
- Resolve per-(student, task, criterion) MetricResults from perStudentTaskAccums
- Handle missing student-task combinations (students not in a task's submission set)
- Construct the 2-row grouped Ant Design column configuration
- Produce student rows with a cells array that mirrors the column structure

This is not 30 lines. It is 150-250 lines minimum. Bob's estimate undermines confidence in his
understanding of the problem's complexity.

### 3.3 Overlooks that `AveragingResult` does not contain what the heatmap needs (critical)

Bob's core claim is that the heatmap "should consume `AveragingResult.perTask`/`perStudent`"
(critique §3, §8). But `PerTaskRow` and `PerStudentRow` contain _aggregated_ values:

```typescript
// PerTaskRow (dataAnalysis.zod.ts:139-149)
{ definitionKey, taskId, taskTitle, completeness: MetricResult, accuracy: MetricResult, ... }
```

This `completeness` MetricResult is a **rollup across all students**, not a per-student value.
The heatmap needs **per-(student, task, criterion) MetricResults** — one value for each student
for each task for each criterion. That intermediate representation is not exposed by the current
`AveragingResult` shape.

Bob assumes the analyser output contains granular per-student per-task data. It does not. The
`perStudentTaskAccums` map inside `accumulateDataPoints` contains exactly this granular data
but it is consumed internally by `rollupAccumulators` in `buildPerTaskRows`/`buildPerStudentRows`
and then discarded. Bob's recommendation to "project `AveragingResult`" would produce the wrong
data unless `AveragingResult` is extended first.

### 3.4 Does not address the `perStudentTaskAccums` exposure gap (critical)

The root cause of the mismatch: the `AveragingAnalyser` produces rolled-up MetricResults but
the heatmap needs the pre-rollup individual values. The `DataPointAccumulator` map at
`averagingAnalyser.accumulation.ts:268` is exactly the intermediate structure needed:

```typescript
const perStudentTaskAccums = new Map<string, Map<string, DataPointAccumulator>>();
// outer key: studentId
// inner key: `${definitionKey}::${taskId}`
// value: { completeness: MetricAccumulator, accuracy: MetricAccumulator, spag: MetricAccumulator, overall: MetricAccumulator }
```

Neither Alice nor Bob identified this gap. Alice's spec proposes re-walking `ClassFull` from
scratch to rebuild these values. Bob's critique says the analyser already produces them but
doesn't notice they are _rolled up_ and the granular version is internal. Both miss the correct
solution: expose these accumulators (or their `accumToMetric`-converted MetricResults) as an
optional field on `AveragingResult`.

### 3.5 Tone and framing undermine technical credibility (minor)

Bob's critique calls the spec's approach a "toy" engine, says Alice "invents" things, and
frames every disagreement as an objective failure. While rhetorically effective, this conceals
important nuance:

- The spec got several things right (product scope, view-state management, accessibility,
  cell rendering, MetricPill mode) that Bob does not acknowledge.
- Bob's own proposal has the critical flaw identified above (3.1, 3.3).
- A critique that does not acknowledge correct elements in its target is a polemic, not a review.
  It makes the reader question whether Bob is evaluating the architecture or settling a score.

In a staff-level conversation, you concede what the other person got right even while
challenging their foundation. Bob does not do this, and it weakens his analysis.

### 3.6 What Bob got right

- **The existing `AnalysisFilter` is the correct foundation.** Bob correctly identifies that
  the filter system already exists, is type-safe, multi-class, and extensible via Zod fields.
- **Band filters are a UI concern.** Bob correctly identifies that band filtering belongs in
  the Ant Design `Table` column `filters`/`onFilter` layer, not in a data-layer filter engine.
- **The consistency claim is false.** Bob correctly checks the backend and finds no visitor
  pattern, and checks the frontend analyser to find it uses registry-of-strategies. His
  evidence-based debunking of Alice's headline rationale is well-supported.
- **V1 should not special-case at the architecture level.** Bob correctly argues that using
  the general pipeline for v1 is cheaper than building a parallel narrower system.

---

## 4. What both missed

### 4.1 The `perStudentTaskAccums` bridge (critical)

As described above, `accumulateDataPoints` builds per-(student, task) accumulators at
`averagingAnalyser.accumulation.ts:268` which are then consumed by `rollupAccumulators` in
`buildPerTaskRows` and `buildPerStudentRows`. These accumulators contain exactly the granular
data the heatmap needs — but they are currently private to `analyseClass` and their values are
rolled up (aggregated) before being included in `AveragingResult`.

The correct solution: expose these granular MetricResults (converted from `DataPointAccumulator`
to `MetricResult` via `accumToMetric`) as an optional field on `AveragingResult`. The heatmap
adapter consumes this field. Every other consumer ignores it. No re-walking of `ClassFull`,
no duplicated metric logic, no parallel accumulator system.

### 4.2 Selection vs. projection (important)

Neither architect cleanly separates **selection** (which data enters the pipeline) from
**projection** (how that data is shaped for a specific view):

| Stage       | What it does                                                          | Who owns it                                                        |
| ----------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Selection   | `AnalysisFilter` chooses which assignments/classes enter the analysis | `dataAnalysis.zod.ts:19-43` + `averagingAnalyser.filters.ts:18-49` |
| Computation | `AveragingAnalyser` computes MetricResults from selected data         | `averagingAnalyser.ts:68-134`                                      |
| Projection  | An adapter reshapes computation output for a specific view            | A new `adaptMetricsToHeatmap` function                             |

Alice conflates selection and projection inside a single `FilterEngine`/`HeatmapTransform`
pipeline. Bob conflates them by saying "AveragingResult already produces what you need"
without acknowledging the projection gap. The missing piece is a projection step that takes
the granular MetricResults and builds the 2-row grouped-header view model.

### 4.3 The heatmap is a matrix, not a list (important)

The Student Averages table is a list of students with flat metric columns. The heatmap is a
**matrix**: rows = students, columns = tasks, sub-columns = criteria per task. This structural
difference means:

- The column configuration is dynamic (one set of 3 sub-columns per task), not static (4 fixed
  metric columns like the Student Averages table).
- Sorting is by student name (sorting by metric value across all tasks is a meaningful UX question
  for v1 that neither document addresses).
- The grouped header (2-row: task name spans 3 sub-columns) uses Ant Design's `children` column
  property, which changes how column definitions are constructed.

Neither architect analysed this structural difference in sufficient depth.

### 4.4 MetricPill compact mode is real work (medium)

Both documents mention "compact MetricPill mode" but neither analyses what it requires:

- Reduced horizontal padding
- Smaller font size (maybe `11px` instead of `14px`)
- No border radius change (already minimal)
- Integer display (`precision: 0`) per SPEC.md:136

This requires changes to `MetricPill.tsx` and should be planned as a discrete piece of work,
not mentioned as an aside. The existing `MetricPill` component has no "compact" variant; adding
one is a small but real change that both documents underplay.

---

## 5. The correct architecture

### 5.1 Principles

1. **One filter system, not two.** Extend the existing `AnalysisFilter` with new fields as needed.
   Do not create `FilterVisitor`/`FilterEngine`. The existing `filterAssignments` function
   (`averagingAnalyser.filters.ts:18-49`) is the single executor.
2. **One metric computation path, not two.** Do not re-wrap raw scores in `HeatmapTransform`.
   Expose the granular-per-student-task accumulators from the existing analyser.
3. **Band filters in the UI, not in data code.** Follow the Class page's existing pattern
   (`studentAveragesTableColumns.tsx:110-116`) — Ant Design `Table` column `filters`/`onFilter`.
4. **Selection before computation, projection after.** The analyser selects + computes. An adapter
   projects. The adapter does not select or compute.

### 5.2 Concrete changes

#### Step 1: Extend `AnalysisFilter` (one Zod field)

Add `assignmentIds?: string[]` to `AnalysisFilterSchema` in `dataAnalysis.zod.ts:19`:

```typescript
export const AnalysisFilterSchema = z.strictObject({
  classIds: z.array(z.string().min(1)).min(1),
  dateRange: ...,
  topicKeys: ...,
  assignmentDefinitionKeys: ...,
  assignmentIds: z.array(z.string().min(1)).optional(),  // ← new field
  criterionWeightings: ...,
});
```

#### Step 2: Extend `filterAssignments` (one clause)

Add an `assignmentIds` filter clause to `averagingAnalyser.filters.ts:18-49`:

```typescript
const assignmentIdSet: Set<string> | undefined = input.filter.assignmentIds?.length
  ? new Set(input.filter.assignmentIds)
  : undefined;

if (assignmentIdSet && !assignmentIdSet.has(assignment.assignmentId)) {
  return false;
}
```

#### Step 3: Expose granular per-student-task MetricResults

Add an optional `perStudentTaskMetrics` field to `AveragingResultSchema` in
`dataAnalysis.zod.ts:181-190`. Define a new schema for it:

```typescript
export const PerStudentTaskMetricSchema = z.strictObject({
  studentId: z.string(),
  taskKey: z.string(),  // `${definitionKey}::${taskId}`
  completeness: MetricResultSchema,
  accuracy: MetricResultSchema,
  spag: MetricResultSchema,
  overall: MetricResultSchema,
});

// Add to AveragingResultSchema:
perStudentTaskMetrics: z.array(PerStudentTaskMetricSchema).optional(),
```

In `averagingAnalyser.ts:88-134`, after `accumulateDataPoints`, convert the
`perStudentTaskAccums` map to `MetricResult` values via `accumToMetric` and attach
to the result:

```typescript
// Inside analyseClass, after accumulateDataPoints:
const perStudentTaskMetrics: PerStudentTaskMetric[] = [];
for (const [studentId, taskMap] of accumulators.perStudentTaskAccums) {
  for (const [taskKey, accumulator] of taskMap) {
    perStudentTaskMetrics.push({
      studentId,
      taskKey,
      completeness: accumToMetric(accumulator.completeness),
      accuracy: accumToMetric(accumulator.accuracy),
      spag: accumToMetric(accumulator.spag),
      overall: accumToMetric(accumulator.overall),
    });
  }
}
```

**This is the key architectural move.** The per-student-task accumulators already contain
exactly the data the heatmap needs — granular criterion scores before any rollup — accumulated
by the exact same `accumulateCriterion`/`accumulateMetricsToTarget` path that feeds every
other metric output. The heatmap gets authoritative MetricResults with zero duplication of
the metric logic.

#### Step 4: Write `adaptMetricsToHeatmap` (new file, ~200 lines)

A pure adapter in `src/frontend/src/features/heatmap/` that accepts `AveragingResult` with
`perStudentTaskMetrics` and produces a heatmap-specific view model:

```typescript
export interface HeatmapCell {
  completeness: MetricResult;
  accuracy: MetricResult;
  spag: MetricResult;
}

export interface HeatmapRow {
  studentId: string;
  studentName: string;
  cells: HeatmapCell[];
}

export interface HeatmapResult {
  assignmentId: string;
  assignmentName: string;
  className: string;
  rows: HeatmapRow[];
  taskColumns: Array<{ taskKey: string; taskTitle: string }>;
}

export function adaptMetricsToHeatmap(
  averagingResult: AveragingResult,
  classFull: ClassFull
): HeatmapResult { ... }
```

The adapter:

1. Takes the filtered `AveragingResult` (single assignment after `assignmentIds` filter)
2. Extracts `perStudentTaskMetrics` for the in-scope task
3. Groups by studentId, builds cells array matching task order
4. Handles missing student-task combinations (synthesises `notAttempted`)
5. Returns the heatmap view model

No new Zod families needed — types are inferred from `AveragingResult` and `MetricResult`.
No validation boundary duplication.

#### Step 5: Band filters in Ant Design `Table` column config

Follow the existing `studentAveragesTableColumns.tsx` pattern. The heatmap's column config
uses `resolveMetricTone` inside `onFilter` predicates, applied to each per-criterion
`MetricResult` sub-column.

#### Step 6: `useTaskHeatmapData` hook

A thin hook that:

1. Calls `useClassPageData` internally (reuses cached `ClassFull`)
2. Runs `DataAnalysisService.analyse()` with the extended filter
3. Calls `adaptMetricsToHeatmap`
4. Manages surface state (loading/blocking/ready) per ClassPage patterns

This is not a `DataAnalysisService`-level change. It is a feature-level hook.

### 5.3 What is eliminated

| Spec component             | Status         | Reason                                                              |
| -------------------------- | -------------- | ------------------------------------------------------------------- |
| `FilterVisitor` interface  | **Eliminated** | Replaced by extending `AnalysisFilter`                              |
| `FilterEngine` class       | **Eliminated** | Replaced by `filterAssignments`                                     |
| `AssignmentFilterVisitor`  | **Eliminated** | Single `assignmentIds` field + one `Set.has` clause                 |
| `HeatmapTransform`         | **Eliminated** | Replaced by `adaptMetricsToHeatmap` consuming granular accumulators |
| `TaskHeatmapCell` schema   | **Eliminated** | Type inferred from `PerStudentTaskMetric` + `MetricResult`          |
| `TaskHeatmapRow` schema    | **Eliminated** | Structural type in adapter output                                   |
| `TaskHeatmapResult` schema | **Eliminated** | Structural type in adapter output                                   |

| Kept / new | Component                                    | Reason                                      |
| ---------- | -------------------------------------------- | ------------------------------------------- |
| **Kept**   | `AnalysisFilter` + `filterAssignments`       | Single shared filter pipeline               |
| **Kept**   | `AveragingAnalyser`                          | Unchanged — only adds optional output field |
| **Kept**   | `MetricPill` + `resolveMetricTone`           | Band filters in Ant Design Table columns    |
| **New**    | `perStudentTaskMetrics` on `AveragingResult` | Exposes granular data the heatmap needs     |
| **New**    | `adaptMetricsToHeatmap`                      | Pure projection adapter                     |
| **New**    | `useTaskHeatmapData`                         | Feature hook, not service-level change      |

---

## 6. Migration path

### Phase 1: Foundation (no visible change)

1. Add `assignmentIds` to `AnalysisFilterSchema` and `filterAssignments`.
2. Add `perStudentTaskMetrics` to `AveragingResultSchema` and populate it in `analyseClass`.
3. Write tests for both changes.

### Phase 2: Adapter

4. Write `adaptMetricsToHeatmap` and test it comprehensively.
5. Write `useTaskHeatmapData` hook.

### Phase 3: UI

6. Add compact mode to `MetricPill`.
7. Build `TaskHeatmapTable` with Ant Design `Table` + grouped headers.
8. Wire navigation in `ClassPage` (view-state, breadcrumb, click handler on
   `RecentAssignmentCard`).

### Phase 4: Future extension

9. To add cohort filtering → one optional array field on `AnalysisFilter`.
10. To add topic filtering → one optional array field on `AnalysisFilter` (already exists).
11. To add time-range filtering → one optional dateRange field on `AnalysisFilter` (already exists).
12. To add a new view → a new adapter function.

---

## 7. Cost-benefit summary

| Approach        | Lines of new code | New files | Duplicated metric logic                             | Extensible to cohorts/topics/time?                                  | Refactor risk when cohorts arrive                         |
| --------------- | ----------------- | --------- | --------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| Alice (SPEC.md) | ~600-800          | 8-10      | Yes — `HeatmapTransform` duplicates `accumToMetric` | No — `AssignmentFilterVisitor` cannot express cross-class filtering | High — throwaway or bolt-on                               |
| Bob (critique)  | ~300-500          | 4-6       | No (if done right) — but proposed wrong fix         | Yes (via `AnalysisFilter`) but needs granular data exposed          | Medium — needs `perStudentTaskMetrics` anyway             |
| **This report** | **~250-400**      | **2-3**   | **None** — reuses `accumToMetric`                   | **Yes** — every future axis is a field on `AnalysisFilter`          | **None** — same filter system, same analyser, new adapter |

**Bottom line:** Build the filter as a data-structure extension (new optional array fields on
the existing Zod schema), not as a behavioural abstraction (new visitor class hierarchy).
Extend the analyser's output to expose granular per-student-task MetricResults instead of
re-walking raw `ClassFull`. Keep projection in a dedicated adapter. The heatmap becomes a
consumer of the general pipeline, not a parallel implementation that gets thrown away.

Neither Alice nor Bob had all the pieces. Alice has the better instinct for what the user-facing
surface needs but chose the wrong foundation. Bob diagnosed the foundation correctly but his
proposed fix was both wrong (new analyser registry key) and incomplete (did not identify the
granular data gap). The correct architecture is a hybrid: Bob's critique direction (extend
existing pipeline) plus exposing the internal per-student-task accumulators that neither
document noticed.
