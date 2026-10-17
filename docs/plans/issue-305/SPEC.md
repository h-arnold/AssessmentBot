# Top-Decile Attempt Baseline Analysis Specification

## Status

- Draft v1.0 — planned for GitHub issue h-arnold/AssessmentBot#305 ("Add option to calculate completeness based on top 10th percentile of students").

## Purpose

This document defines the intended behaviour for an optional **attempt-baseline analysis mode** in the frontend Data Analysis service, exposed by a labelled control on the Class page — the page whose aggregates the mode changes.

The feature will be used to:

- stop untaught or deliberately skipped lesson tasks from unfairly lowering student score averages;
- compare students within a class against the work that _should_ have been set in the circumstances;
- make comparisons between classes at different stages of teaching fairer.

This feature is **not** intended to:

- change how individual task scores are produced or displayed (task-level scores and heatmap cells stay absolute);
- persist the mode selection between sessions or pages;
- introduce any backend, transport, or persistence change;
- implement cohort, trend, or distribution analyses (existing deferred plans, unchanged).

## Agreed product decisions

1. **A labelled control lives on the Class page only** — the single page whose aggregates (recent-assignment cards and the student averages table) change under baseline mode. It toggles between `absolute` (current behaviour) and `topDecileBaseline` mode. There is no global switch and no persistence. The embedded Class-page heatmap inherits baseline marking at **task-column level** through the heatmap projection of the page's `analyserResult` (see decision 8 and the planned `HeatmapTaskColumn.includedInAttemptBaseline` entry) — cell values stay absolute and no separate switch exists. The Heatmaps page never enters baseline mode — its pipeline pins `absolute` — and displays no control. The control is disabled, with an explanatory tooltip on hover, when the mode cannot be used (see decisions 6 and 6a).
2. **Mode is an explicit analysis input.** `analysisMode` is a required field on the analysis filter with values `'absolute' | 'topDecileBaseline'` — there is no default; every call site (and the output echo, see below) states the mode explicitly. The Heatmaps page, which has no control, states `'absolute'` at its two input construction sites.
3. **Attempt definition.** A student _attempted_ a task when their submission item for that task yields at least one numeric criterion score. Items where every criterion is raw `N` (not applicable / not attempted), where no usable assessment was produced (the `E` condition), and submission items absent from the response graph are **not** attempts. Criterion weighting plays no part in the attempt definition; effective-weighting rules continue to govern contribution downstream exactly as today.
4. **Baseline pool selection.** Only students with **at least one attempted task** within the in-scope assignments are candidates (decision 3 defines attempted): a student whose attempt count is zero can never be in the baseline and including them would structurally guarantee an empty intersection. The pool is the top `min(candidateCount, max(2, ceil(0.1 × roster size)))` candidates ranked by count of **distinct attempted task keys** (the same unit as `baselineTaskKeys` / `buildTaskKey`), capped at the candidate count. Ranking ties are broken deterministically by `studentId` ascending (count descending first). The mode is unavailable when fewer than 2 students are candidates (additional availability criterion, tooltip explains the lack of engaged students). Only attempts counted this way are usable evidence: raw `N` items, the `E` condition, and absent items do not count.
5. **Baseline task set.** The baseline is the **intersection** of the attempt sets of all pool members: a task is in the baseline set when _every_ pool member attempted it. Intersection protects the baseline against a minority of enterprising students who rush ahead of the taught sequence.
6. **Availability rule (Class page only).** The control is available when two conditions hold: (i) at least 3 students are in the class (roster size ≥ 3), and (ii) at least 2 students attempted at least one in-scope task. Availability is derived through the **shared attempt predicate** (helper register §9.27.2) from **two inputs**: the **last successful analysis result retained inside `useClassPageData`** (attempt evidence) and the **current `classFull`** (roster size); it resolves to `'awaiting-data'` whenever either input is absent — including a shape-legal result whose optional `perStudentTaskMetrics` field is missing, which also resolves `'awaiting-data'` (absence never produces `'ineligible'`, and no non-null assertion is allowed). - The baseline aggregate filtering restricts **only the aggregation step**: `perStudentTaskMetrics` (and the per-(student, task) cell evidence) carries **every observed (student, task) pair in both modes** — byte-identical arrays for the same input — because the heatmap substitution path silently renders a missing `(student, taskKey)` pair as the frozen `notAttempted` cell, which would violate decision 8 without any error. A red-first analyser test asserts the two modes emit identical `perStudentTaskMetrics` (same input). Consequently the shared attempt predicate and the availability derivation see identical evidence in both modes: availability **cannot change when the toggle changes**, which is what makes the retention/recovery path sound. Roster ids are matched by `classFull.students[].id`. Retention follows React's documented **previous-render state pattern** (React docs, "Storing information from previous renders"): two `useState` pairs (`seenAnalyserResult`, `retainedAnalyserResult`) updated during render, guarded so it converges —

```ts
if (analyserResult !== null && analyserResult !== seenAnalyserResult) {
  setRetainedAnalyserResult(analyserResult);
  setSeenAnalyserResult(analyserResult);
}
```

— so a baseline-mode throwing render reads the previous render's retained value. This mechanism is a verified **lint requirement**: `react-hooks/refs` (error in `src/frontend/eslint.config.js`'s flat `recommended` set) forbids reading a ref during render, and `react-hooks/set-state-in-effect` (also error) forbids the effect+`useState` substitute; the previous-render state pattern trips neither. **Status enumeration (all reachable states, beyond the throw case):** `'awaiting-data'` until at least one successful analysis result has been produced within the current mount (`analyserResult === null` in every pre-ready render, when `shouldRunPipeline` is false — `classFull` or ADP null, dataset failed or untrustworthy — and when the adapter step throws); `'ready'`/`'ineligible'` from result-or-retained + `classFull` evidence **only** from the first successful result onward. The availability unit test table covers the dataset-blocked case explicitly (control shows "Waiting for class data", never `'ineligible'`, while no successful analysis is possible). **Evidence precedence:** `baselineAvailability` is computed **during render** as a derived part of `ClassPageData` (never via an effect-driven state update), with `analyserResult ?? retainedAnalyserResult` semantics — the current render's successful result always wins; the retained state supplies attempt evidence **only** when the current render's result is `null` (a baseline-mode throw, an adapter throw, or a pre-ready/pipeline-not-run render — see the status enumeration above). The first success render therefore reports correct availability immediately (the state is set during that render), and retention is not dead machinery. The result is exposed as a named `ClassPageData.baselineAvailability` field with the literal shape `{ status: 'ready' | 'awaiting-data' | 'ineligible'; reason: string | null }`, where `reason` is display copy produced by the hook (single source feeding both the Tooltip and the sr-only described-by node) and is populated for **both** disabled statuses — `'awaiting-data'` carries the neutral copy "Waiting for class data", `'ineligible'` carries the named unmet condition — and is `null` only for `'ready'`; the sr-only node renders whenever the control is disabled. Retention lifecycle: the last-good result survives a later baseline-mode blocking failure **within one mounted class** (the analysis memo nulls `analyserResult`/`adapterResult` on throw, so without retention the control would strand the user in baseline mode — the exact failure this prevents); a class change remounts the page and clears it. This contract lands before or with the control-rendering work, and the automated recovery test (enter baseline → throw → control still enabled → toggle `absolute` → page recovers) pins it. The control renders **disabled with the neutral "awaiting data" reason** only when the header is rendered but no successful result exists yet (for example a blocking failure from the initial mount); during the initial skeleton load the header itself is not rendered, so the control is simply absent (see decision 6a for the host). On an eligibility failure the control renders disabled with a hover tooltip naming the unmet condition. The Heatmaps page does not enter baseline mode and exposes no control (decision 1). Availability never silently falls back to absolute results while showing baseline-mode copy.

6a. **Mode state lifecycle and ownership (Class page only).** `ClassPage` owns `useState<AnalysisMode>` (importing the named `AnalysisMode` type from `services/dataAnalysis/dataAnalysis.zod.ts`; initial `'absolute'`, no persistence) and passes it into `useClassPageData(classId, analysisMode)`; `analysisMode` joins the analysis memo dependency list. A class change remounts the Class-page component tree; to make the mode reset **guaranteed** rather than incidental to the render ternary, `ClassesPage` passes `key={selectedClassId}` to `ClassPage`. **The control's host is a new always-rendered slot inside `ClassPageHeader`, alongside `PageTitleCard`** (which itself stays action-free per its documented contract; the `PageNavCard` actions slot is not used because it renders only in the overview child view). The three new `ClassPageHeader` props are named for the red-phase component test: `analysisMode` (current mode value), `onAnalysisModeChange` (change handler), and `baselineAvailability` (the `ClassPageData.baselineAvailability` object). Consequences: during the initial skeleton load the header is not rendered and the control is absent with it; once the header renders (any view, including the embedded heatmap child view and blocking states) the control is present — enabled per decision 6 or disabled with the neutral "awaiting data" reason when no successful result exists. This keeps the escape route to `absolute` reachable through any baseline-mode hard failure; `Retry` triggers the existing network refetch and memo recomputation in the currently selected mode — for a deterministic baseline throw it observably re-enters blocking, so **recovery is solely via the mode change** and an action-plan test must not assert a guaranteed re-run escape. The embedded `TaskHeatmapPage` inherits baseline marking through the existing `analyserResult` data only. `features/taskHeatmap/` owns no mode state and receives no mode props; Heatmaps-page mode plumbing is neither required nor permitted under this scope.

7. **Mode echo and transparency.** Each per-class result echoes `appliedAnalysisMode` and, in baseline mode, carries an `attemptBaseline` block (`poolStudentIds`, `baselineTaskKeys`) so surfaces can explain how the baseline was derived (for example "task set agreed by the top 3 of 24 students"). No new aggregate value is user-visible without the ability to see that baseline mode is active.
8. **Scope of recalculation — all four metrics.** In baseline mode, the per-student and per-class aggregates for completeness, accuracy, SPaG, and Overall are built from per-(student, task) observations restricted to the baseline task set. Per-task rows and heatmap task columns carry `includedInAttemptBaseline` while their values remain absolute in both modes (per-student cell metrics carry no flag — see the planned contract additions; column-level marking only). **The filtering restricts only aggregation:** `perStudentTaskMetrics` and per-(student, task) cell evidence keep every observed pair in both modes (byte-identical for the same input — pinned by a red-first test), so availability and cell rendering see identical evidence regardless of mode. **Downstream aggregates are not automatic:** the Class-page recent-assignment cards aggregate from per-task evidence via `classPageAdapter` (which reads `analyserResult.appliedAnalysisMode`), so the adapter must filter to `includedInAttemptBaseline: true` tasks when the applied mode is baseline, with the observed-evidence `excluded` conversion rules from the display-resolution section; the student averages table derives from the averaging result's already-filtered per-student rows. Descriptive task summaries (assignment summary cards) intentionally stay absolute (see decision 9). The `excluded` state's two causes (zero weighting vs baseline exclusion) are covered by a **mode-aware accessible label** that in baseline mode names **both** possible causes in one truthful wording — no new state, no cause field, no widened schema (shared-helper planning entry, `Not implemented`).
9. **Assignment summary analyser stays task-level and mode-independent in its outputs.** Its shapes describe per-task evidence, which does not change under baseline filtering, so its schema is unchanged. Its internal averaging delegation (which isolates one assignment and builds its own filter) states `analysisMode: 'absolute'` explicitly: task-level evidence must never invoke baseline selection, because an assignment-scoped re-derivation of the baseline could empty-intersect and throw for inputs where the class-wide baseline is valid. The public summary input still validates the caller's supplied `analysisMode`; only the internal delegation is fixed to absolute. Summary values are therefore identical in both modes.
10. **Baseline is per class.** Each class derives its own pool and baseline set from its own students. There is no pooled cross-class baseline; adding multi-class Heatmaps selection is out of scope.
11. **Empty baseline set is a hard failure.** If the intersection across the pool is empty for a class, the analyser throws a descriptive error naming the class, per the fail-fast policy; it is not absorbed by any silent fallback. This is **not** a data-corruption guard: ordinary conditions can produce it — pool members with disjoint attempt sets, or a newly assessed class whose top-engagement students have sparse numeric evidence. Representative tests must cover both triggering scenarios.
12. **Absolute mode is byte-for-byte identical to current behaviour** except for the new, always-true `includedInAttemptBaseline` flags and the added `appliedAnalysisMode: 'absolute'` echo.
13. **Baseline constants are fixed in v1:** percentile fraction `0.1`, minimum pool size `2`, minimum class size `3`. They live as named constants in the baseline-derivation module; making them configurable later is out of scope.

## Existing system constraints

### Backend or API constraints already in place

- None affected. All score aggregation lives client-side in `src/frontend/src/services/dataAnalysis/`; the backend only supplies raw class/assignment data (`getABClass`, `getAssignmentDefinitionPartials`). The canonical data-shape doc records that analysis output has no backend, transport, or persistence boundary.

### Current data-shape constraints

- `docs/developer/data-shapes/frontend-data-analysis-response.md` is the canonical contract for `DataAnalysisResponse`, `MetricResult`, `AverageContribution`, `PerStudentRow`, `PerTaskRow`, `PerStudentTaskMetric`, `PerClassResult`, and the assignment summary shapes. Any mode or flag addition must be recorded there before code-review sign-off.
- `MetricResult` is a four-state discriminated union (`computed` / `notAttempted` / `excluded` / `error`); task-level display shapes use a narrower three-state union (no `excluded`). The mode addition must not break these invariants.
- `averageContribution.includedInAverage` must be `true` exactly when `effectiveWeight > 0`; this rule is untouched.
- `AnalysisFilterSchema` is a `z.strictObject`; adding `analysisMode` tightens the contract — every existing input construction site and test must supply it.

### Frontend or consumer architecture constraints

- Three consuming pipelines must stay consistent: `useClassPageData` (Class page), `heatmapsPipeline` (Heatmaps page), and the `analyseAssignmentSummary` call sites (`TaskHeatmapPage`, `useHeatmapSelectionSummary`).
- `AssignmentSummaryAnalyser.analyse` builds its own internal filter `{ classIds: [classId] }`; once `analysisMode` is required, this internal delegation states `analysisMode: 'absolute'` explicitly — it must never re-derive a baseline for a single assignment (see decision 9).
- **All five non-test analysis-filter construction sites** (inside five `AveragingAnalyserInput` inputs) supply `analysisMode` explicitly (root `AGENTS.md` §2.1 forbids un-instructed defaults; the test-fixture blast radius — 26 `classIds:` occurrences across 7 frontend spec files plus the synthetic round-trip bridge — is listed in the handoff notes): `useClassPageData.ts` receives the Class page's current mode as a hook parameter; the **four non-`useClassPageData` sites pin `'absolute'`** — `heatmapsPipeline.ts`, `TaskHeatmapPage.tsx` (its `analyseAssignmentSummary` call — note `TaskHeatmapPage` executes inside the Class page's embedded heatmap child view, so "non-Class-page" would be wrong; it is a non-`useClassPageData` site), `useHeatmapSelectionSummary.ts`, and `assignmentSummaryAnalyser.ts`'s internal delegation. No mode prop is added to `TaskHeatmapPage` or anywhere in `features/taskHeatmap/`: the embedded Class-page heatmap inherits baseline marking through the heatmap projection of the Class page's `analyserResult` (`heatmapAdapter.ts` projecting `includedInAttemptBaseline` onto `HeatmapTaskColumn`), not through mode plumbing.
- Defaults belong in a module's constructor only (root `AGENTS.md` §2.1); mode selection is page state threaded explicitly, never a hidden default.
- All new validation is Zod-first with types derived via `z.infer` (frontend §9).
- `useClassPageData.ts` (498 lines) is near the 550-line decomposition threshold of `src/frontend/AGENTS.md` §15; the action plan must state a split plan if the wiring is projected to exceed it.

## Domain and contract recommendations

### Why this approach is preferable

- Attempt-count ranking directly encodes the pedagogical signal: the students with the most attempts define which work was actually set. Score-threshold selection was rejected because raw scores conflate teaching coverage with marking severity.
- Intersection-derived baseline tasks are robust against one or two eager students jumping ahead; majority and union rules would let partially-adopted tasks into the baseline.
- Deriving the baseline inside the analyser from already-fetched input keeps the change frontend-only, synchronous, and testable without backend coordination, matching the existing derived-contract status of the analysis shapes.

### Recommended data shapes

All additions are frontend-only (in-memory validation contract; no transport or persistence).

#### Named mode enum

```ts
export const AnalysisModeSchema = z.enum(['absolute', 'topDecileBaseline']);
export type AnalysisMode = z.infer<typeof AnalysisModeSchema>;
```

Exported from `dataAnalysis.zod.ts` beside `AppliedCriterionWeightingsSchema`; components and hooks import the type from there — no feature-local union duplicates it.

#### Analysis filter addition

```ts
AnalysisFilterSchema = z.strictObject({
  // ...existing fields...
  analysisMode: z.enum(['absolute', 'topDecileBaseline']),
});
```

The field is required for both modes; `'absolute'` is the explicit representation of today's behaviour.

#### Per-class result additions

```ts
AveragingResultSchema = z.strictObject({
  // ...existing fields...
  appliedAnalysisMode: z.enum(['absolute', 'topDecileBaseline']),
  attemptBaseline: z
    .strictObject({
      poolStudentIds: z.array(z.string()).min(2),
      baselineTaskKeys: z.array(z.string().min(1)).min(1),
    })
    .optional(),
});
```

`attemptBaseline` is present only in `topDecileBaseline` mode and absent in `absolute` mode; the discriminating echo is `appliedAnalysisMode`.

#### Task-level and heatmap-column flag addition

```ts
PerTaskRowSchema = z.strictObject({
  // ...existing fields...
  includedInAttemptBaseline: z.boolean(),
});
```

The flag is required on every task row: `true` for every row in `absolute` mode; in `topDecileBaseline` mode it marks whether the task is inside that class's baseline set. Per-student cell metrics carry **no** flag: columns are the only marked heatmap unit (v1 column-level marking), so no `PerStudentTaskMetric` consumer needs and none uses one.

**Baseline narrowing rule (contract discipline).** `attemptBaseline` is optional on the result by construction (absolute mode omits it), but the analyser **always emits it in baseline mode**. Consumers must narrow by mode and treat a baseline-mode result without `attemptBaseline` as an invariant violation — fail fast with a throw. An `attemptBaseline?.baselineTaskKeys ?? []` fallback is an un-instructed default (root `AGENTS.md` §2.1 rule 7) that would silently mark every column excluded; it is forbidden.

### Naming recommendation

Prefer:

- `analysisMode`, `appliedAnalysisMode`, `attemptBaseline`, `baselineTaskKeys`, `poolStudentIds`, `includedInAttemptBaseline`
- `topDecileBaseline` / `absolute` as the two enum values

Avoid:

- `percentileBaseline`, `relative`, `top10`, or wording that implies score-relative scaling (no score is rescaled)
- reusing `excluded` (already defined by weighting semantics) for baseline exclusion

### Validation recommendation

#### Frontend

- `analysisMode` must be supplied by every caller; a missing mode is a Zod failure at `DataAnalysisService.analyse` / `analyseAssignmentSummary` input parsing (fail fast, loud).
- `attemptBaseline.poolStudentIds` has `min(2)` — the pool structurally cannot be smaller; `baselineTaskKeys` has `min(1)` because an empty baseline set throws before results are produced.
- Output validation hashes on the existing `DataAnalysisResponseSchema.parse` in both `analyse` and `analyseAssignmentSummary`, so a producer omitting the new echo fails loudly.

### Display-resolution recommendation

- Aggregate display values in baseline mode come only from baseline-scope accumulators; tables show the recalculated averages with no visual downgrade of the numbers themselves. The accessibility copy for `excluded` must be made mode-aware as recorded in the shared-helper planning entry above (because the state now legitimately carries two causes).
- Tasks outside the baseline remain fully visible (task rows, heatmap task columns) and are marked — **column-level marking only in v1** (mirroring the existing zero-weight column-annotation pattern; cell-level marking is out of scope). The plumbing is a projection change in `services/dataAnalysis/heatmapAdapter.ts` with **no props changing hands**: `buildTaskColumns` gains a **required second parameter** — a baseline-membership source typed as `ReadonlySet<string> | null`, where `null` means "absolute mode: every column included" — and sets `HeatmapTaskColumn.includedInAttemptBaseline` from it. **The supplier is `adaptMetricsToHeatmap`** — the only caller that receives a mode-bearing `analyserResult` and therefore the only caller that can supply a non-null baseline set — which derives the set itself under the Baseline narrowing rule: baseline mode → `new Set(analyserResult.attemptBaseline.baselineTaskKeys)` (fail-fast if absent); absolute mode → `null`. This works precisely because `adaptMetricsToHeatmap` is called only from `TaskHeatmapPage`, and `TaskHeatmapPage` runs only inside the Class page — the analyser result the adapter projects already carries the page's mode. The **merged** chain is three links deep — `adaptMetricsToMergedHeatmap` → `buildMergedTaskColumnsInClassOrder` → `buildMergedTaskColumns` → `buildTaskColumns` — and those three merged-path links pass the `null` argument **explicitly** at each hop (an omitted or defaulted argument would be an un-instructed default, root `AGENTS.md` §2.1). `MergedHeatmapTaskColumn` inherits the field via its existing spread; `HeatmapCell` is unchanged. `features/taskHeatmap/` renders the flag as a presentational change driven by data — no mode props or mode state enter that feature. The concrete presentation is defined in the layout spec.
- A student whose observed tasks fall entirely outside the baseline set resolves each aggregate metric to the existing aggregate-only `excluded` state (observations exist, none contributed to the baseline aggregates). The excluded result uses **observed** evidence semantics — never the weight-gated `totalDataPoints` counter, which would be zero for zero-weight-only work and produce schema-invalid output. Concretely: roll up the student's **unfiltered per-(student, task) accumulators** per criterion with the existing `rollupMetric` path (the rollup resolves `totalDataPoints` itself — from `allTotalDataPoints` on the `error`/`notAttempted`/`excluded` terminal states and `Math.max(finalTotalDataPoints, observedDataPoints)` on the `computed` path) and convert **only `computed` and `notAttempted`** results to `excluded` while **preserving the resolved `totalDataPoints`** — reuse the resolved value; do not hand-roll a display-count sum — and constructing the `ExcludedMetricSchema` literals explicitly (`value: null`, `totalWeight: 0`, `applicableDataPoints: 0`; the conversion is constructed, not inferred). The conversion assumes a source rollup whose resolved `totalDataPoints` is ≥ 1 — the accumulator path guarantees this (`ComputedMetricSchema` itself permits 0, so any violation would surface loudly at output validation). An unfiltered rollup that is **already `excluded`** (every observation carried zero effective weight) is left untouched — the conversion never launders an existing cause; in baseline mode the mode-aware accessible label names both possible causes (zero weighting and outside the baseline task set) in one truthful wording, so no cause field or schema change is needed. **The row's `overall` composite is never converted directly:** it is derived from the converted criteria through the existing `computeOverallComposite`, so its resolved `totalDataPoints` is the sum of the converted criteria's resolved counts (≥ 1 whenever any criterion converted, keeping the schema valid); the mixed cases follow the existing resolver — all-`error` stays `error`, and a mixture converges on `excluded` whenever any criterion is converted. A criterion with **no observed evidence** keeps today's `error` resolution and is never converted. A student with **no per-(student, task) accumulators at all** (every submission item unresolvable) follows today's absolute-mode path unchanged (the `studentAccums` fallback branch, which yields `error` metrics because no data points exist) — the new excluded conversion does not apply to them. The absolute-mode fallback otherwise does **not** apply in baseline mode.
- Recent-assignment card aggregates recompute from baseline-restricted per-task evidence via `classPageAdapter.buildRecentAssignment`. The adapter reads `analyserResult.appliedAnalysisMode` (single source of truth; the adapter stays a pure function of `analyserResult`) and applies one uniform rule to the filtered row set: roll up the **baseline-filtered rows**; when that set is empty, roll up the **unfiltered rows** per criterion and convert **only `computed` and `notAttempted`** results to `excluded` while preserving the resolved `totalDataPoints` (observed-evidence semantics as above; an already-`excluded` zero-weight rollup keeps its weighting cause). This dedicated branch is distinct from the existing `rows.length === 0 → N` placeholder branch — which handles assignments with **no per-task rows at all** (definition has no tasks, or the definition partial is unresolved so accumulation skipped the assignment) — and from zero-weight `Excluded` derivation; an assignment whose definition has tasks but no attempts anywhere has rows whose metrics are all `error` with `totalDataPoints: 0`, and the conversion rule correctly leaves them `error` (no `excluded` is synthesised without observed evidence, keeping `ExcludedMetricSchema`'s `totalDataPoints >= 1` satisfied by construction). The **per-criterion** results are converted exactly as the per-student rule above (already-`excluded` rollups are left untouched); the card's `average` metric is then derived from the converted criteria through the existing `computeOverallComposite` (via `computeAverageMetric` — the composite itself is never converted), so its resolved `totalDataPoints` is the sum of the converted criteria's resolved counts: all-`error` sets stay `error`, and any mixture containing a converted criterion converges on `excluded`.

## Feature architecture

### Placement

- Baseline derivation and filtering live inside `services/dataAnalysis/` (analysers layer) as a **post-accumulation derivation over the averaging analyser's `perStudentTaskAccums`**, used by the averaging analyser only (no second raw-data walk exists for attempt selection). The assignment summary analyser stays outside baseline selection entirely (decision 9).
- Mode selection state lives in the Class page feature (`classPage`): `ClassPage` owns `useState<AnalysisMode>` and passes it into `useClassPageData(classId, analysisMode)`; `analysisMode` joins the analysis memo dependency list. `features/taskHeatmap/` owns no mode state and receives no mode props. Pages stay thin composition roots.
- No duplicate or parallel analysis entry point is permitted; the mode flows through `DataAnalysisService.analyse` / `analyseAssignmentSummary` exactly as weightings and filters do today.

### Proposed high-level tree

```text
services/dataAnalysis/
├── dataAnalysis.zod.ts               (+ AnalysisModeSchema, analysisMode,
│                                      appliedAnalysisMode, attemptBaseline,
│                                      includedInAttemptBaseline)
├── dataAnalysisService.ts            (unchanged behaviour; schema carries new field)
├── heatmapAdapter.ts                 (+ HeatmapTaskColumn.includedInAttemptBaseline
│                                      projection; MergedHeatmapTaskColumn inherits)
└── analysers/
    ├── averagingAnalyser.*           (baseline-aware accumulation filtering)
    └── attemptBaselineSelection.ts   (new: pool + intersection derivation)
```

### Out of scope for this surface

- Persisting or sharing the mode across sessions, pages, or users
- Any backend handler, query, or persistence change
- Configurable pool fraction, thresholds, or per-surface overrides
- Rescaling or renormalising individual task scores
- Multi-class selection on the Heatmaps page (selection is and stays single-class)
- A mode control on the Heatmaps page or any heatmap surface (they never enter baseline mode; decision 1)

## Data loading and orchestration

### Required datasets or dependencies

- Unchanged: `getABClassQueryOptions(classId)` class detail, `assignmentDefinitionPartials` warm-up, and the existing input assembly in `useClassPageData` and `heatmapsPipeline`.

### Prefetch or initialisation policy

- No new datasets. Mode toggling re-runs the existing synchronous analysis with the alternate `analysisMode`; no re-fetch is required, so toggling must not trigger network requests.

#### Startup

- Unchanged (React Query baseline and warm-up policy untouched).

#### Feature entry

- Nothing renders both modes simultaneously: each toggle state renders exactly one analysis run.

#### Manual refresh

- No refresh control exists today and none is added.

### Query or transport additions

- None. Mode is component/page state, not server state — no query keys, no invalidation, no `callApi` changes.

## Core view model or behavioural model

### Derivation rules

#### Attempted (per student, per task, within analysis filter scope)

- `true` — the submission item exists and at least one criterion assessment (`completeness`, `accuracy`, `spag`) has a numeric score.
- `false` — item absent, or no criterion has a numeric score (all-`N` or the `E` condition).

#### Baseline pool (per class)

- Roster size `n = |class.students|`; candidate set = roster students with ≥ 1 attempted task (decision 4). Pool size = `min(|candidates|, max(2, ceil(0.1 × n)))`; the mode is unavailable when `|candidates| < 2` (or `n < 3`).
- Members: candidates ranked by count of **distinct** attempted task keys within the in-scope assignments (same taskKey unit as `baselineTaskKeys`); ties broken by `studentId` ascending.

#### Baseline task set (per class)

- `attemptBaseline.baselineTaskKeys` = intersection over pool members of each member's attempted task-key set, restricted to tasks resolvable through the live assignment definitions (unresolvable tasks are already dropped by accumulation logging and cannot enter the set).

#### Aggregate filtering (baseline mode)

- Per-student and per-class rollups include only per-(student, task) accumulators whose task key is in the baseline task set, for all four metrics; Overall composites are computed from the filtered criterion rollups with existing SPaG-renormalisation.
- The absolute-mode `studentAccums` fallback in `buildPerStudentRows` does not apply in baseline mode (except for students with no per-(student, task) accumulators at all, who keep today's path per the display-resolution rules); a student with zero in-scope baseline accumulators but unfiltered observations resolves each metric to the aggregate-only `excluded` state preserving the resolved `totalDataPoints` from the unfiltered rollup, and a student with no observations at all is absent from analyser rows exactly as today.
- Per-class and per-student rollups keep today's all-accumulator scope (including submission studentIds outside the roster) in **both** modes; the pool is the only roster-scoped step. This preserves absolute-mode equivalence and is intentional.
- Per-task rows and per-(student, task) cells keep absolute values; `averageContribution` semantics unchanged.

### Sort order or priority rules

1. Output array sort (`classId` asc), per-student sort (name asc, then `studentId` asc), per-task sort, and cell sort remain unchanged.
2. Pool ranking: attempted-task count descending, then `studentId` ascending, first `poolSize` retained.

## Main user-facing surface specification

### Recommended components or primitives

- A labelled toggle control on the Class page (component choice — `Switch` vs `Segmented` — is settled in the layout spec against Ant Design guidance; `Segmented` is the working recommendation).
- Task-level and notice treatments follow the existing zero-weight annotation and summary-card idioms.

### Fields, columns, or visible sections

1. Class page: recent-assignment cards, student averages table, embedded heatmap view — aggregates reflect the page's selected mode through the single analysis run; heatmap summary cards are descriptive task evidence and stay absolute in both modes (decision 9). The embedded heatmap's task columns carry `includedInAttemptBaseline` marking (column-level; cell values unchanged).
2. Heatmaps page: **no mode control** — that surface never enters baseline mode (decision 1); its analysis input states `analysisMode: 'absolute'` explicitly and its heatmap table, summary cards, and selection summary are unchanged from current behaviour.
3. Surfaces must make the active mode unmistakable (label state and/or baseline task-set indication); no student-facing copy silently changes data meaning.

### Sorting, filtering, or navigation rules

- Metric column sorting, range filters, search, and view switching (`overview | heatmap`) behave identically in both modes and operate on whichever values are rendered.

### Rendering rules

#### Baseline mode active

- Aggregates show recalculated values; non-baseline tasks stay visible with their absolute values, marked as outside the baseline; the mode is indicated in the control and (on data surfaces, including the embedded heatmap task columns) by the task marking.

#### Mode unavailable (Class page: fewer than 3 students, or fewer than 2 attempters)

- The control renders disabled with a hover tooltip naming the unmet condition; toggling is impossible.

#### Eligibility loss

- Not applicable: the only in-page class change path remounts the Class page, which already resets the mode to `absolute` on load. No Heatmaps-page reset is needed because that surface never runs baseline mode.

#### Absolute mode

- Identical values and presentation to current behaviour.

## Workflow specification

## Toggle baseline mode

### Eligible inputs or preconditions

- Class page: the loaded class has at least 3 students and at least 2 of them attempted at least one in-scope task.

### Behaviour

- Selecting the baseline option re-runs the synchronous analysis with `analysisMode: 'topDecileBaseline'`; results replace the rendered aggregates immediately with no loading state (pure client computation).
- Selecting the absolute option re-runs with `analysisMode: 'absolute'`, producing pre-feature behaviour.
- Toggling does not refetch, does not change filters, and does not persist on navigation or reload.
- A class change remounts the page and resets the mode to `absolute` on load.
- The heatmap surfaces never run baseline mode: they receive the `includedInAttemptBaseline` marker only through shared pipeline data and cannot change aggregates.

### Failure rule

- An empty derived baseline set throws with a descriptive error naming the class; the page joins the Class page's existing blocking treatment (Ant Design `Result`, retryable for `analyserError`; frontend logging and error-handling policy). No silent fallback exists.

## Error, loading, and empty-state rules

### Blocking failure

- Analysis pipeline failures already bubble as top-level hard-failure states per surface; the empty-baseline throw joins this existing path. Baseline-mode failures do not silently render absolute values.
- **The mode control must remain reachable during a blocking failure**: it lives in the always-rendered `ClassPageHeader` region (decision 6a), so a baseline throw can never strand the user in baseline mode — switching to `absolute` from the header recovers the page. `Retry` refetches and recomputes in the currently selected mode (decision 6a: recovery is solely via the mode change). An E2E/regression test pins this recovery path.

### Partial-load or partial-refresh failure

- Unchanged; mode toggling introduces no fetches and therefore no new partial-load states.

### Empty states

#### Student with observed tasks entirely outside the baseline

- Per-student aggregates resolve to `excluded` (per decision 8 / display-resolution rules); existing `excluded` presentation on tables and cards applies.

#### Roster student with no observations at all

- Unchanged behaviour in both modes: no analyser row; the Class-page adapter's no-per-task-rows placeholder (definition has no tasks / unresolved definition) continues to apply.

#### Assignment with no baseline tasks (recent-assignment card)

- Class-level card aggregate shows `excluded`; the card's descriptive per-task content stays absolute.

#### Baseline task set covering every task (unchanged set)

- Baseline output equals absolute output apart from the echo/flag fields; no special notice is required.

## Accessibility and usability notes

- The mode control requires an accessible label; a hover tooltip alone must never be the only carrier of the disabled reason. A tooltip on a disabled control fires only when the control is wrapped (per the documented Ant Design constraint that Tooltip children must expose mouse/focus events) and must be paired with an always-present screen-reader description node (`aria-describedby`), following the `HeatmapSelectionBar.tsx` precedent recorded in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.
- Keyboard focus and activation follow the chosen Ant Design component's documented behaviour (`Segmented` renders radio-style inputs; `name` keeps arrow-key group semantics).
- The mode-aware `excluded` accessible label (shared-helper planning entry) keeps assistive text truthful in both modes.
- Toggling must not shift page layout or cause scroll jumps.

## Backend changes required to support agreed behaviour

1. None. The analysis contract remains a derived, frontend-only shape; no backend handler, model, persistence, or transport change is required.

## Planning handoff notes

- **Planned data-shape entries are recorded:** `docs/developer/data-shapes/frontend-data-analysis-response.md` carries a "Planned contract additions (Not implemented, issue #305)" section covering the filter field, result echo + `attemptBaseline` block, task-row/column flag, summary mode-independence, and downstream aggregate rules. The implementation agent updates those entries — removing the `Not implemented` marker — as each addition is delivered.
- **Shared-helper planning** (recorded as planned-only `Not implemented` entries in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.27 — the canonical register; the action plan's per-section shared-helper blocks reference those entries and reconcile statuses at delivery):
  - `attemptBaselineSelection.ts` (new, `src/frontend/src/services/dataAnalysis/analysers/attemptBaselineSelection.ts`): **post-accumulation derivation** (decided; not a pre-pass), because the analyser's `perStudentTaskAccums` already encode both the attempt signal (`DataPointAccumulator.{completeness,accuracy,spag}.displayCount` counts only numeric scores, and `resolvedApplicable > 0`/`computed` ⟺ `displayCount > 0`) and definition resolution (only resolvable tasks are accumulated). A second raw-data walk would duplicate the attempt definition beside the analyser's candidacy — forbidden duplication (§9.27).
  - **Shared attempt predicate** — **new export from `attemptBaselineSelection.ts`**, with input type **`ReadonlyArray<PerStudentTaskMetric>`**: the availability side consumes the retained result's `perStudentTaskMetrics` directly, and the analyser's candidacy projects its internal accumulators through the existing `buildPerStudentTaskMetrics` before the predicate runs, so one function serves both consumers with one shared test. Roster-scoped by intersecting the metrics' student ids with `classFull.students`. Planned-only, `Not implemented`.
  - Mode-aware accessible label for `excluded` (`services/dataAnalysis/metricDisplay/`, touching **three** files: `metricTone.ts` (`EXCLUDED_METRIC_ACCESSIBLE_LABEL`), `MetricPill.tsx`, and `studentAveragesTableColumns.tsx` (students-table `aria-label` builder — the primary surface where "student entirely outside the baseline" renders)). `MetricPill` gains an **optional `analysisMode` prop**: absent renders today's weighting wording — correct for the three-state task-display metrics `TaskPreviewCard.tsx` (the other consumer, in `features/taskHeatmap/`) renders, which structurally cannot be `excluded`. **Class-page consumers pass it explicitly**, enforced by a red-phase unit assertion on `RecentAssignmentCard` rather than by the type system; no React context. Full threading chain: `ClassPage` → `ClassPageContent` → `renderReadyContent` (options object) → `ClassPageReady` (properties) → `RecentAssignmentsSection` → `RecentAssignmentCard`, and `ClassPageReady` → `StudentAveragesTableCard` → `studentAveragesTableColumns.tsx` column builder. `features/taskHeatmap/**` stays untouched. **Baseline-mode wording**: chosen by mode alone (no cause field, no schema change) and must name **both** possible causes — zero weighting and outside the baseline task set — in one truthful sentence, so an already-`excluded` zero-weight rollup left unconverted by the baseline rules is still announced truthfully.
  - **Availability resolver** — a **pure function extended into the existing `src/frontend/src/features/classPage/useClassPageData.helpers.ts`** (alongside `computeQueryBlockingError`/`computeDatasetBlockingError` — an existing helper surface, not a new abstraction): composes the shared attempt predicate (services side) with `classFull.students[].id` rostering and retention into the `baselineAvailability` literal. Counted in the hook's §15 projected line budget, keeping the resolver out of `useClassPageData.ts` growth. Planned-only, `Not implemented`.
  - Reuses, rather than duplicates: `buildTaskKey` (`taskKey.ts`) and `resolveAssignmentDefinitionData`/`createTaskWeightingIndex` (`resolveAssignmentDefinition.ts`).
  - Planned helper entries belong in `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.27 marked `Not implemented`.
- Canonical documentation updates in the same change: `docs/pedagogy/data-analysis-scoring.md` (teacher-facing explanation of the mode), `docs/developer/frontend/data-analysis-architecture.md` (post-accumulation baseline derivation ownership, accumulation-filter flow), `docs/developer/frontend/navigation-consistency-status.md` (the Class-page header gains a third always-rendered element — the mode-control slot — so the tracker's header-design section must record it), and the data-shape doc above.
- **Canonical synthetic fixtures (assessed, issue #305, including the reviewer's degenerate-intersection finding):** the corpus's factual claims are verified — `medium` has 12 students / 6 assignments with participation plans giving students 0–2 five of six assignments, 3–4 four, 5–11 three; non-attempt canonical evidence comes **only from the `E` condition** — 36 empty-assessment items (9 per class, all roster index 1); the corpus contains **no all-`N` item** (its single raw `N` is roster index 0's `spag`, always alongside a numeric `completeness`, so those items are attempts under decision 3); the all-`N` non-attempt and shared-`taskKey` cases below are therefore local fixtures; the most recent assignment (`assignment-0-5`, latest `updatedAt`) uses the partial-only `definition-partial-0` — a single task — among the three recent cards, so card/heatmap tests must not assume three full definitions; `buildSubmissionItems` emits an item per declared task; `small` is hard-coded in the round-trip bridge. However, working the numbers through: a `medium` class exposes 9 distinct taskKeys, the top attempters (roster indices 0 and 2, tied at 9) have **identical attempt sets**, and the pool size is `max(2, ceil(0.1 × 12)) = 2` — so the canonical corpus yields a **degenerate full-set baseline**: every row/cell is `includedInAttemptBaseline: true`, no all-outside-baseline student, no filtering behaviour. The assignment-with-no-baseline-tasks card state is unreachable **because the canonical baseline covers all 9 task keys**; likewise the `rows.length === 0 → N` placeholder branch is unreachable from canonical data because recent-assignment cards are keyed by `definitionKey` — the zero-submission assignment index 0 shares `definition-0-slides` with the five-submission `assignment-0-4` (second-most-recent by `updatedAt`), so that definition's card appears in the top 3 with rows. Pool sizes above 2 are likewise unreachable from compact profiles. Consequently: use `medium` `classesById` for what it genuinely supports — pool sizing at min 2, ranking/tie-break (indices 0 vs 2 attempt-count tie broken by `studentId`), the echo/flag round-trip, `E`-condition non-attempt evidence (plus the raw-`N`-alongside-numeric attempt case at roster index 0), and eligibility thresholds — and cover the behavioural core with local fixtures split by the canonical-fixture policy's three rules — **(a) realistic cases permitted under the recorded generator-extension plan** (student whose attempts fall entirely outside the baseline; disjoint pool attempt sets; per-task partial attempts); **(b) cases the corpus cannot express, hand-built locally** (the all-`N` non-attempt case; pool sizes > 2 including `ceil` growth — a pure unit-level `ceil` computation, with the option of extending the generator plan with a roster-size ≥ 21 parameter if realistic coverage is later wanted; fewer than 2 attempters; fewer than 3 roster students). **Generator extension plan (not required for v1):** per-task partial attempts _within one assignment_ (a teacher skipping part of a lesson while some students attempted others) are not producible — `buildSubmissionItems` in `scripts/synthetic-test-data/generateSubmissions.js` emits an item for every declared task. If a future iteration needs that realism, add a per-task participation stage/parameter to `generateSubmissions.js` (plus invariant-guard updates) and regenerate/commit fixtures (`npm run fixtures:synthetic`, byte-for-byte check enforced by `syntheticCommittedFixtureRegeneration.test.ts`). Migration of existing fixtures is opportunistic and limited to touched tests.
- `useClassPageData.ts` (498 lines) and `ClassPageContent.tsx` (449 lines) are both on the `src/frontend/AGENTS.md` §15 watchlist: exceeding 550 lines makes in-change decomposition **mandatory**, not optional. The availability retention and mode prop threading are the most likely growth drivers, with the availability resolver itself pre-placed in `useClassPageData.helpers.ts` (helper planning entry) to keep the hook's growth to wiring and retention only — the action plan must state the projected line impact for both files and concrete split plans (the hook's analysis/orchestration split; the content component's region split) so the trigger is never hit unmanaged.
- Test-mocking seams that construct analyser inputs all need the new required `analysisMode` field. Verified **input-side** blast radius: 26 `classIds:` occurrences across 7 frontend spec files — `dataAnalysis.zod.spec.ts` (11), `dataAnalysisService.spec.ts` (3), `averagingAnalyser.filters.spec.ts` (6), `averagingAnalyser.spec.ts`, `averagingAnalyser.rows.spec.ts`, `averagingAnalyser.metricResolution.spec.ts`, `useHeatmapsPageData.spec.ts` (2) — plus `tests/synthetic-analysis/syntheticApiRoundTripBridge.test.ts` (constructs the input directly) and the **programmatic input builders `buildInput()`/`buildSingleStudentInput()` in `src/frontend/src/test/dataAnalysis/fixtures.ts` — the shared fix point**: adding `analysisMode: 'absolute'` once inside the factory (constructor-like scope, root `AGENTS.md` §2.1.10) fixes 14 consuming files' 54 call-site occurrences at once; the literal ` classIds:` grep list above is the residue that needs manual threading. The **direct single-argument `buildTaskColumns` test callers** `averagingAnalyser.assignmentProcessing.spec.ts` and `heatmapAdapter.weighting.spec.ts` (lines 14, 23) also update for the required second parameter. Heatmaps-side sites always pass `'absolute'`. Verified **output-side** blast radius from the required `includedInAttemptBaseline` on `PerTaskRowSchema` and `HeatmapTaskColumn` (per-student cell metrics carry no flag, shrinking their fixture surface): `src/frontend/src/test/dataAnalysis/fixtures.ts`, `src/frontend/src/test/dataAnalysis/heatmapFixtures.ts`, `src/frontend/src/test/taskHeatmapTableTestHelpers.ts` (`TASK_COLUMNS`), `src/frontend/src/test/taskHeatmapPageFixtures.ts`, `src/frontend/src/test/heatmapsPageDataFixtures.ts`, `src/frontend/src/test/classPage/classPageAdapterTestFixtures.ts`, plus inline row literals in roughly ten further specs (`dataAnalysis.zod.result.spec.ts`, `buildCellPreviewLookup.parity.spec.ts`, `classPageAdapter.zod.spec.ts`, the `heatmapAdapter.*.spec.ts` family, and others). The five `useClassPageData` hook suites plus `useClassPageDataTestFixtures.ts`, `useClassPageDataMockHandles.ts`, and `useClassPageData.mockSetup.ts` update for the hook's second parameter and the new `ClassPageData.baselineAvailability` field.
- **Ant Design consultation for the layout phase (official docs read; re-verify live docs during layout work since `segmented.md` is absent from the in-repo cache):** `Segmented` is the preferred control primitive — verified against the installed antd 6.6.5 types: whole-control `disabled`, per-option `disabled`, per-option `tooltip` (`SegmentedLabeledOption.tooltip`), controlled `value`/`onChange`, radio-style keyboard group via `name`. During the layout phase, **empirically confirm whether a hover Tooltip fires on a whole-`disabled` `Segmented`** (its root is a `div`, unlike a disabled `Button`, so the `<span>`-wrapper rule from `frontend-shared-helpers-and-abstraction-standards.md` — written for disabled Buttons — may be unnecessary): keep the wrapper only if the tooltip does not fire on its own, and consider per-item `disabled` + per-item `tooltip` as the simpler expression of "baseline unavailable". **This empirical check is an explicit layout-spec deliverable** so it cannot survive unresolved into the action plan. The sr-only `aria-describedby` description-node requirement stands independently of the wrapper question (`.sr-only` exists in `index.css`). `Switch` only with both `checkedChildren`/`unCheckedChildren` labels if later preferred. Sole control location: the Class page header region (decisions 1 and 6a).

## Testing expectations

- **Analyser unit coverage (Vitest):** attempt definition (numeric vs `N` vs missing vs `E`-condition items); pool sizing (`ceil`, minimum 2, cap at roster, class size < 3 excluded); ranking count desc / `studentId` tie-break; intersection semantics; per-class independence; mode echo and `attemptBaseline` presence/absence; `excluded`-state and zero-weight interplay; `includedInAttemptBaseline` flagging on task rows and heatmap task columns; empty-baseline throw **including both ordinary triggering scenarios** (disjoint pool attempt sets; sparse-evidence newly assessed class); absolute-mode equivalence to current behaviour.
- **Schema coverage:** filter requires `analysisMode`; result schema accepts the echo + optional baseline block and rejects an empty baseline set; summary schema untouched.
- **Summary coverage:** summary values identical in both modes; the internal delegation states `analysisMode: 'absolute'` explicitly and never invokes baseline selection (including for assignments without numeric assessments or submissions — existing summary tests keep passing).
- **Aggregate consumer coverage (Class page only):** recent-assignment card aggregates recompute from baseline-restricted per-task evidence; assignment with no baseline tasks shows `excluded` with observed-evidence `totalDataPoints` (distinct from the no-per-task-rows `N` placeholder branch); **zero-evidence variants pinned red-first**: (a) an assignment whose definition has tasks but no attempts anywhere stays `error` on its card (no `excluded` synthesised — `ExcludedMetricSchema`'s `totalDataPoints >= 1` must never be violated); (b) a student whose every submission item is unresolvable follows today's `error` path (no excluded conversion without per-(student, task) accumulators); **two-cause label truthful red-first**: an already-`excluded` zero-weight rollup is left unconverted, keeps its resolved `totalDataPoints`, and the baseline-mode accessible label names both causes (zero weighting and outside the baseline) so the announcement stays truthful without a schema change; **composite derived red-first**: the baseline-`excluded` row's `overall`/card `average` comes from `computeOverallComposite` over the converted criteria — `totalDataPoints` equals the sum of the converted criteria's counts, all-`error` stays `error`, no mixed case shows a numeric value with `excluded` criteria; student averages table reflects filtered per-student aggregates; embedded heatmap task columns carry correct `includedInAttemptBaseline` marking with unchanged cell values.
- **Pipeline/consumer coverage:** `useClassPageData` receives `analysisMode` as a hook parameter, includes it in the analysis memo dependency list, retains the last successful result for availability, and re-runs the analysis on toggle without refetching; the four non-`useClassPageData` sites (`heatmapsPipeline.ts`, `TaskHeatmapPage.tsx`, `useHeatmapSelectionSummary.ts`, `assignmentSummaryAnalyser.ts` internal) pin `'absolute'`; no mode state or props exist in `features/taskHeatmap/`; the embedded heatmap renders `includedInAttemptBaseline: false` **task-column** markers from Class-page data in baseline mode while keeping absolute cell values; `HeatmapCell` unchanged; `MergedHeatmapTaskColumn` inherits the flag.
- **Availability/control coverage:** shared attempt predicate (roster-scoped) drives `ClassPageData.baselineAvailability` via the previous-render retention pattern in `useClassPageData` (current result wins; retained state supplies evidence only when the current result is `null`; survives a later baseline blocking failure within one mounted class; cleared on remount); `'awaiting-data'` for every state before the first successful result in the mount — including the dataset-blocked case (never `'ineligible'`); initial skeleton load renders no header and therefore no control; both eligibility failures disable with the named reason; **blocking-failure recovery**: enter baseline → empty-intersection throw → control still enabled in the header region → toggle to `absolute` → page recovers (E2E/regression).
- **Surface coverage:** control rendering (enabled/disabled + tooltip; wrapper-span only if the live-doc verification requires it), mode indication, embedded heatmap column marking, and `excluded` accessible-label mode-awareness (including the students-table `aria-label` path) per the layout spec.
- **Canonical-evidence cases made explicit:** roster index 1 in every `medium` class has nine submission items whose assessments are all empty — **zero attempts despite participating in five assignments** — the canonical evidence for "has submissions but is not a candidate"; the canonical tie-break (indices 0 and 2, nine attempts each, identical attempt sets) changes only `poolStudentIds` order rather than the baseline set, so the ranking test must assert **pool-array order** explicitly.
- **Boundary (local hand-built):** a task whose `definitionKey::taskId` taskKey is shared by two in-scope assignments of the same definition counts once as an attempt and once as a baseline key — local, because the canonical corpus's one shared definition is fact definition-scoped but no student submits to both of its assignments in any class, so the collapse-unit is not exercised by canonical data.
- **Contract/regression:** synthetic-corpus round-trip bridge must round-trip the new required field end-to-end; existing suites updated to pass the mode explicitly and to assert `includedInAttemptBaseline: true` in absolute mode where they touch rows/heatmap task columns.
- Browser E2E coverage for the visible toggle behaviour per the layout spec and existing Playwright conventions. **Committed screenshot baselines re-capture is an explicit deliverable:** the Class-page header renders inside two committed Playwright baselines — `src/frontend/e2e-tests/navigation-screenshots.spec.ts-snapshots/class-page-overview-chromium-linux.png` and `src/frontend/e2e-tests/navigation-screenshots.spec.ts-snapshots/task-heatmap-chromium-linux.png` — and the new header slot changes both; re-capture explicitly rather than leaning on the spec's `maxDiffPixelRatio: 0.1` tolerance. **Scenario extension:** the E2E heatmap scenario (one assignment, ten students each submitting every task — `HEATMAP_STUDENTS` in `task-heatmap-fixtures.ts`) yields the same degenerate full-set baseline as the synthetic corpus, so any E2E assertion of a `false` column marker needs an extended scenario option (students that skip tasks).

## Documentation and rollout notes

- Update `docs/pedagogy/data-analysis-scoring.md` with a teacher-facing section describing the mode, its selection rule in plain language, and its limits.
- Update `docs/developer/frontend/data-analysis-architecture.md` (post-accumulation baseline derivation ownership, accumulation-filter flow) and `docs/developer/data-shapes/frontend-data-analysis-response.md` (contract).
- No rollout/migration requirement: purely computed alternative view; no persisted state.

## V1 scope recommendation

### Include in v1

- Required `analysisMode` on the analysis filter; Class-page labelled control (`Segmented` per AntD consultation) with availability rule, tooltip, and remount-based lifecycle; attempt-count pool over ≥1-attempt candidates with min 2 / fraction 0.1; intersection baseline set; four-metric aggregate filtering with `excluded` resolution for fully-outside-baseline students, the mode-aware `excluded` accessible label, and baseline-restricted recent-assignment card aggregates; echo + `attemptBaseline` transparency block; `includedInAttemptBaseline` flags on task rows and heatmap task columns; assignment-summary absolute internal delegation with unchanged public schema; Heatmaps page absolute-only with no control; full analyser/schema/pipeline/surface test coverage; canonical docs and pedagogy updates; recorded planned-only data-shape and helper entries reconciled at delivery.

### Defer from v1

- Configurable pool fraction, pool size, or minimum class size
- Persisting mode preference (any storage layer)
- Pool/baseline visual exploration UI beyond the transparency indication
- Cohort-, trend-, or distribution-analysis plans already deferred elsewhere
