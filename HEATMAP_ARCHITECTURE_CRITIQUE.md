# Critique of the Task Heatmap Filtering Architecture (SPEC.md)

**Author:** Architecture review (pre-implementation)
**Status:** Blocking — the spec's filtering/data-extraction architecture is the wrong foundation for the stated long-term goal and should be revised before implementation.
**Scope:** This document critiques the data-filtering and analysis architecture proposed in `SPEC.md` (the Task Heatmap spec at the repo root). The spec has **not** been implemented yet, so this is a pre-implementation architecture challenge.

---

## 0. The actual goal (as stated by the user)

> "I'm designing some critical data filtering infrastructure which will be used to filter and analyse data in every way possible, across cohorts, by student, teacher, topic, time range, student characteristic. As such, I want as open, extensible and reusable approach as possible from now, even though the initial scope is limited to avoid a time consuming refactor later. I've opted for the approach in the spec."

The Task Heatmap is therefore a **v1 trojan horse** to lock in the _general_ filtering/analysis architecture. The architecture must serve the broad, multi-axis analysis future — not just one assignment × one class.

**Verdict up front:** The spec's `FilterVisitor` + `FilterEngine` + `HeatmapTransform` + `AssignmentFilterVisitor` design is the wrong foundation for that goal. It introduces a _second, narrower, divergent_ filter system that the codebase's existing general-purpose filter+analysis layer already supersedes, and it re-implements metric logic the existing analyser already owns. That is the exact refactor the user is trying to pre-empt — just deferred and made more expensive.

Every claim below is backed by a citation into the code or docs that already exist in this repo.

---

## 1. You already have a real, shared, typed filter pipeline — and the spec ignores it

The codebase already has a general analysis filter and executor:

- `AnalysisFilter` is defined in `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts:19-45`. It already supports:
  - `classIds: z.array(z.string()).min(1)` — i.e. **cohort / class selection** (multiple classes by design).
  - `dateRange` (`from`/`to`, ISO-with-timezone) — **time-range filtering**.
  - `topicKeys` — **topic filtering**.
  - `assignmentDefinitionKeys` — **assignment-definition filtering**.
  - `criterionWeightings` — configurable per-call.
- `filterAssignments(cls, input)` in `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.filters.ts:18-49` is the **executor** that applies that filter over `ClassFull` assignments, including `assertAssignmentDefinition` (`:59`) and `isFilteredByDateRange` (`:78`).
- `AveragingAnalyser.analyse` (`averagingAnalyser.ts:68`) consumes `AveragingAnalyserInput` (`dataAnalysis.zod.ts:57-63`) whose `filter` field is `AnalysisFilterSchema`. So the filter is already wired end-to-end and is **multi-class by construction** (`classes: z.array(ClassFullSchema)`, `dataAnalysis.zod.ts:59`).

The spec invents a **parallel, competing** `FilterEngine`/`FilterVisitor` hierarchy (SPEC.md:38, 114-116, 191-192) that does _none_ of the above. The only concrete visitor named is `AssignmentFilterVisitor`, whose entire job is "extract single assignment data" (SPEC.md:191, 381). So the heatmap would ship with two filter systems:

1. The real, general one (`AnalysisFilter` + `filterAssignments`) used by `AveragingAnalyser`.
2. A toy one (`FilterVisitor`/`FilterEngine`) used only by the heatmap, which cannot filter by cohort, topic, or time range at all.

That is the **opposite** of "reusable across future features (multi-class analysis, cohort reports)" (SPEC.md:68). The future cohort/topic/time-range analysis the user explicitly wants will naturally extend `AnalysisFilter` — so the heatmap's OOP engine becomes dead weight the moment the feature the user actually cares about is built.

**Source citations:**

- `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts:19-63` (AnalysisFilter + AveragingAnalyserInput)
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.filters.ts:18-84`
- `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts:68-72`

---

## 2. "FilterVisitor / Open-Closed" is the wrong pattern for _selection_ filters

The visitor pattern earns its keep when you have a **stable data structure** and a **growing family of operations** over it (double-dispatch). Here the axis of change is the reverse:

- The data structure (`ClassFull`) is wide and stable-ish.
- The operations are **few and uniform**: each filter is just a predicate `T -> boolean` (does this assignment match topic X? fall in date range Y? equal assignment Z?).

A `FilterVisitor` whose only behaviour is `assignment.id === x` is a class wrapping a one-line predicate. The `FilterEngine` then becomes a `for` loop calling `.visit()` on each. That is a predicate list wearing a trench coat — it adds class-count, registry boilerplate, and indirection with no behavioural payoff, and it is _less_ extensible than a single Zod schema field because adding a new axis means writing a new class + registering it, versus adding one optional array to `AnalysisFilter`.

**Worse category error:** The spec's "band filters (red/gold/green/default/volcano)" (SPEC.md:34, 257) are **not data-selection filters at all**. By the spec's own display-resolution rules (SPEC.md:139) the bands are derived from _computed_ `MetricResult` values: red (< 1.75), gold (1.75–4.25), green (≥ 4.25). The `MetricResult` type is a discriminated union — `computed` (numeric `value`), `notAttempted` (`'N'`), `error` (`'E'`) — defined in `dataAnalysis.zod.ts:82-112`. Band filtering therefore operates on **already-derived** `MetricResult`s, which only exist _after_ the analyser runs.

So band filtering is a **presentation-layer column filter** on derived metrics, not a data-source filter. It belongs in the Ant Design `Table` column `onFilter`/`filters` API (operating over `MetricResult`), not in a "FilterEngine" that walks raw `ClassFull`. Conflating band-filtering (UI concern over derived values) with assignment-selection (data concern over raw input) is an architectural category error baked into the spec.

**Source citations:**

- `SPEC.md:34` ("All columns filterable with band filters (red/gold/green/default/volcano)")
- `SPEC.md:139` (band thresholds on numeric `MetricResult.value`)
- `SPEC.md:257` (metric columns filterable with band filters)
- `dataAnalysis.zod.ts:82-112` (`MetricResult` discriminated union)
- Ant Design Table column filtering: see `src/frontend/AGENTS.md:68` (mandate to use built-in Ant Design behaviour rather than hand-rolling).

---

## 3. `HeatmapTransform` re-implements the analyser's own output

What the heatmap actually needs: **per-student, per-task, per-criterion scores** as `MetricResult`s. That output **already exists**:

- `AveragingAnalyser` produces `AveragingResult` with `perStudent: PerStudentRow[]` and `perTask: PerTaskRow[]` (`dataAnalysis.zod.ts:120-149`, `181-190`). Each row already carries `completeness | accuracy | spag | overall` as `MetricResult`.
- `accumulateDataPoints` (`averagingAnalyser.accumulation.ts:249-301`) already:
  - walks `assignment.submissions[].items[taskId].assessments` (`:200-225`),
  - resolves task weightings via a two-level `Map` for O(1) lookup (`:271-278`),
  - handles `'N'` scores and the `notAttempted`/`error`/`computed` state machine in `accumToMetric` (`accumulation.ts:40-68`),
  - applies the `computeOverallComposite` precedence (error > notAttempted > computed) with SPaG renormalisation (`accumulation.ts:328-418`).

The spec's `HeatmapTransform` + `TaskHeatmapCell` propose **re-walking `ClassFull.assignments[].submissions[].items[].assessments` from scratch** (SPEC.md:228-230) to extract raw scores and re-wrap them in `MetricResult` ("Wrap raw scores in `MetricResult` objects", SPEC.md:229). That means a **second, independent implementation** of "raw score → MetricResult", but without the criterion weighting, SPaG-renormalisation precedence, and `nCount`/`applicableDataPoints` accounting that `accumToMetric`/`computeOverallComposite` encode. Two implementations of the same core invariant will drift, and the heatmap's will be the _lower-fidelity_ one.

**The heatmap is a projection of existing analyser output, not a fresh ingestion of `ClassFull`.** It should consume `AveragingResult.perTask`/`perStudent` (already grouped, already `MetricResult`-typed), with single-assignment selection handled by the filter. The only new code required is a small adapter reshaping `perTask` rows into the 2-row grouped-header view model — roughly 30 lines, fully testable, and reusing the authoritative metric logic.

**Source citations:**

- `dataAnalysis.zod.ts:120-149` (`PerStudentRow`, `PerTaskRow`, `MetricResult`)
- `averagingAnalyser.accumulation.ts:200-301` (`processAssignment`, `accumulateDataPoints`)
- `averagingAnalyser.accumulation.ts:40-68` (`accumToMetric`)
- `averagingAnalyser.accumulation.ts:328-418` (`computeOverallComposite`)
- `SPEC.md:208-230` (`HeatmapTransform`, `TaskHeatmapCell` re-extraction)
- `SPEC.md:355` ("FilterEngine must be implemented before TaskHeatmapTransform")

---

## 4. The spec's data shapes are redundant with the canonical Zod models

`TaskHeatmapCell` re-declares `metrics: { completeness: MetricResult; accuracy: MetricResult; spag: MetricResult }` (SPEC.md:79-83) — an **exact copy** of `PerTaskRow`/`PerStudentRow` (`dataAnalysis.zod.ts:120-149`). `TaskHeatmapRow` (SPEC.md:89-95) and `TaskHeatmapResult` (SPEC.md:99-107) are thin re-packagings. And `MetricResult` is a discriminated union where "Handle 'N' scores as notAttempted state" (SPEC.md:230) is _literally just_ reusing `MetricResultSchema` (`dataAnalysis.zod.ts:106-112`).

Conclusion: the heatmap needs **zero new data-shape vocabulary**. New Zod schema families (`TaskHeatmapResult`, `TaskHeatmapCell`, `TaskHeatmapRow`) mean:

- a new trust-boundary validator (SPEC.md:128 mandates Zod validation "after transform"),
- a new place for the `MetricResult` invariant to be duplicated,
- new drift surface between the heatmap's `MetricResult` wrapper and the canonical one.

For no benefit.

**Source citations:**

- `SPEC.md:73-107` (TaskHeatmapCell / Row / Result)
- `SPEC.md:128` (Zod validation at trust boundary)
- `dataAnalysis.zod.ts:82-190` (canonical `MetricResult`, `PerTaskRow`, `PerStudentRow`, `AveragingResult`)

---

## 5. "Single assignment × single class for v1" is the wrong v1 to protect the generality you want

The spec deliberately scopes v1 to one class + one assignment and explicitly **defers** cross-class, cohort, topic, time-range, student-characteristic filtering to later (SPEC.md:29, 165-172, 391-400). Yet the **existing** `DataAnalysisService` already operates over `classes: ClassFull[]` and `classIds: string[]` (multi-class, by construction — `dataAnalysis.zod.ts:57-63`; `AveragingAnalyser.analyse` maps over `sortedClasses` in `averagingAnalyser.ts:69-71`).

Building a narrower, separate `FilterVisitor` engine for the single-assignment case **backs you into a corner**: when cohorts finally arrive, you will either (a) throw the `FilterVisitor`/`FilterEngine` work away, or (b) bolt cohort support onto a visitor design that was never shaped for it — producing the very refactor the user is trying to avoid, only larger.

The cheapest path to "open and extensible" is to **not special-case v1 at the architecture level**: use the general `AnalysisFilter` + `AveragingAnalyser` you already have, and let the heatmap's "single assignment" be _just a value in the filter_ (`assignmentIds: [id]`), not a separate code path. The generality is free because it already exists.

**Source citations:**

- `SPEC.md:29`, `SPEC.md:165-172`, `SPEC.md:391-400` (deferred scope)
- `dataAnalysis.zod.ts:57-63` (multi-class `AveragingAnalyserInput`)
- `averagingAnalyser.ts:69-71` (`sortedClasses.map(...)` — already multi-class)

---

## 6. The "consistency with AveragingAnalyser and backend patterns" justification is false

SPEC.md:38 and SPEC.md:67 claim the FilterVisitor approach is "consistent with `AveragingAnalyser` and backend patterns." It is not:

- **Frontend analyser:** `AveragingAnalyser` is dispatched through a **registry-of-strategies** — `DataAnalysisService` holds `private readonly registry: Map<string, AveragingAnalyser>` and registers the v1 analyser under the key `'averaging'` (`dataAnalysisService.ts:21-33`). If you wanted OOP _consistency_, you would add a `HeatmapAnalyser` to that **same registry** (a new key, e.g. `'heatmap'`), not invent `FilterVisitor`/`FilterEngine`. The spec's pattern is inconsistent with the one it cites.
- **Backend:** `src/backend/AGENTS.md` documents the backend's actual patterns: singletons via `Class.getInstance()` (§6), facade-pattern file decomposition (§11), registry-style controllers, plain GAS functions, numeric load-order prefixes. There is **no visitor pattern anywhere in the backend** to be "consistent with." The claim is unfounded.

So the spec's headline rationale collapses: the pattern it picks is inconsistent with both the frontend analyser it cites and the backend it cites.

**Source citations:**

- `SPEC.md:38` ("Full OOP (FilterVisitor classes) — consistent with `AveragingAnalyser` and backend patterns")
- `SPEC.md:67` ("Consistency: Same patterns as `AveragingAnalyser` and backend controllers")
- `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts:19-33` (registry-of-strategies, not visitor)
- `src/backend/AGENTS.md` §6 (singletons), §11 (facade decomposition) — no visitor pattern documented

---

## 7. Integration with the existing ClassPage pipeline is already solved

The heatmap's "data loading and orchestration" section (SPEC.md:174-201) describes a `useTaskHeatmapData` hook that fetches `ClassFull` (already cached) and runs a filter → transform pipeline. But `useClassPageData` (`src/frontend/src/features/classPage/useClassPageData.ts`) **already** runs exactly this pipeline: it calls `_analysisService.analyse(...)` with `filter: { classIds: [classId] }` (`:107-132`), then `adaptClassPageToViewModel` (`:144-161`). The existing adapter (`classPageAdapter.ts`) already consumes `AveragingResult.perTask`/`perStudent` and builds UI models.

So the integration work the spec treats as novel is **already implemented and battle-tested** (including surface-state discrimination — loading/blocking/ready — at `useClassPageData.ts:297-349`, and dual-refetch for trustworthiness at `:385-388`). Re-deriving a parallel `useTaskHeatmapData` + `HeatmapTransform` throws away that maturity.

**Source citations:**

- `src/frontend/src/features/classPage/useClassPageData.ts:107-161` (existing analyse → adapt pipeline)
- `src/frontend/src/features/classPage/useClassPageData.ts:297-349` (surface-state machine)
- `src/frontend/src/features/classPage/classPageAdapter.ts:401-495` (existing adapter consuming analyser output)
- `SPEC.md:189-192` (proposed parallel `useTaskHeatmapData` + FilterEngine + HeatmapTransform)

---

## 8. Recommended alternative architecture (concrete)

Keep the heatmap a **consumer** of the general-purpose filter + analysis layer that already exists. Concretely:

1. **Extend `AnalysisFilter`** (`dataAnalysis.zod.ts:19`) with `assignmentIds?: string[]` (and, when the time comes, `cohortKeys`, `yearGroupKeys`, `teacherIds`, `studentCharacteristic`). One Zod schema, validated once at the trust boundary. This is the single shared filter contract for _every_ future surface.
2. **Extend `filterAssignments`** (`averagingAnalyser.filters.ts:18`) to honour `assignmentIds`. This becomes the single shared executor. (Or compose a small `filterByAnalysisFilter` wrapper — but do not create a parallel engine.)
3. **Add a `HeatmapAnalyser`** (a new key in the existing `DataAnalysisService` registry, `dataAnalysisService.ts:32`) that runs the _existing_ `accumulateDataPoints` / `buildPerTaskRows` (`averagingAnalyser.rows.ts:152`) over the filtered single-assignment input. Reuse, don't re-implement. The heatmap's per-task/per-student `MetricResult`s are then produced by the authoritative accumulation path.
4. **Write a thin `adaptHeatmapToViewModel`** (mirror of `adaptClassPageToViewModel`, `classPageAdapter.ts:401`) that reshapes `AveragingResult.perTask`/`perStudent` into the 2-row grouped-header view model. Infer its type from `AveragingResult` — no new Zod shape family.
5. **Put band / column filtering in the Ant Design `Table`** `filters`/`onFilter` layer, operating over `MetricResult` (already a discriminated union). It is a UI concern over derived values, not a data filter — see §2.

Net effect: the heatmap becomes a _projection_ of the exact general-purpose filter+analysis layer you want everywhere. Every future surface (cohort reports, topic analysis, student-characteristic breakdowns, teacher views) reuses the same code instead of a heatmap-specific engine that gets thrown away.

**Why this is more open/extensible than the spec:**

- Adding a new analysis axis = one optional array on `AnalysisFilter` (Zod) + one clause in `filterAssignments`. The spec's way = a new `FilterVisitor` class + registry registration + engine change.
- Adding a new _view_ (e.g. cohort heatmap) = a new analyser key in the existing registry + a new adapter. The spec's way = a new `FilterEngine` instance because the heatmap's engine is single-assignment-shaped.
- Metric fidelity is guaranteed identical across all views because there is exactly one `accumToMetric`/`computeOverallComposite` path.

---

## 9. Summary of failures against the user's stated goal

| User goal                                                                 | Spec approach                                                                                                                                                                   | Verdict                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Filter/analyse across cohorts, topics, time range, student characteristic | Builds a separate `FilterVisitor`/`FilterEngine` that only does single-assignment selection; ignores existing `AnalysisFilter` which _already_ has classIds/topicKeys/dateRange | Fails — reinvents a narrower subset        |
| Avoid a time-consuming refactor later                                     | Creates a divergent filter system that the real multi-class engine supersedes; will be thrown away or bolted onto when cohorts arrive                                           | Fails — defers a larger refactor           |
| Maximum reuse                                                             | `HeatmapTransform` re-walks `ClassFull` to re-wrap `MetricResult` instead of reusing `AveragingAnalyser` output                                                                 | Fails — duplicates core metric logic       |
| Open/extensible                                                           | Visitor-per-predicate is more boilerplate than a Zod field; band filters mis-framed as data filters                                                                             | Fails — less extensible, wrong abstraction |
| Consistency with existing patterns                                        | Claims consistency with `AveragingAnalyser` (registry, not visitor) and backend (no visitor pattern exists)                                                                     | Fails — claim is false                     |

---

## 10. Open questions the spec should answer before implementation

1. Why maintain two filter systems (`AnalysisFilter` + `FilterVisitor`) instead of one? (§1)
2. Why re-derive `MetricResult`s in `HeatmapTransform` instead of projecting `AveragingResult`? (§3)
3. Where do band filters actually live — data layer or `Table` column filter? (§2)
4. If the goal is generality, why is v1 scoped to a code path (`AssignmentFilterVisitor`) that cannot express the future axes? (§5)
5. If consistency with `AveragingAnalyser` is desired, why not add a `HeatmapAnalyser` key to the existing registry? (§6)

---

_Citations reference the repository state at review time. Key files: `SPEC.md`; `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`; `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`; `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts`; `averagingAnalyser.filters.ts`; `averagingAnalyser.accumulation.ts`; `averagingAnalyser.rows.ts`; `src/frontend/src/features/classPage/useClassPageData.ts`; `src/frontend/src/features/classPage/classPageAdapter.ts`; `src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`; `src/backend/AGENTS.md`; `src/frontend/AGENTS.md`._
