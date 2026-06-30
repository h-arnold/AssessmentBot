# Class Page Preparation Specification

## Status

- Draft v1.0
- Source of truth for the two lead deliverables that must land before the Class page: (1) the `AssignmentPartial` `lastUpdated` → `updatedAt` rename, and (2) the data analysis service contract change (new `MetricResult` discriminated union, new `rollupMetric` helper, accumulator and row-builder updates, and the new shared `metricDisplay/` display helpers).
- Companion document: `SPEC_CLASS_PAGE.md` (the Class page that consumes these contracts).
- The action plan for this prep work is drafted separately; this spec is intentionally implementation-agnostic and does not prescribe file ordering or red-first test cases.

## Purpose

The Class page (see `SPEC_CLASS_PAGE.md`) requires two data-layer changes before it can be built:

1. A stable, non-nullable per-assignment-instance "last assessed" timestamp.
2. A richer `MetricResult` shape that distinguishes "computed" from "not attempted" from "processing error", with a shared rollup helper that is used at every aggregation level.

This document defines the agreed contracts for both changes, plus the shared display helpers (`metricTone`, `MetricPill`) that downstream surfaces (the Class page first, then future cohort / trend / distribution analyses per `docs/pedagogy/data-analysis-scoring.md:92-99`) will consume.

The prep work is **not** intended to:

- Change the public surface of the data analysis service's `analyse(input, analyserKey)` orchestrator. The `MetricResult` shape changes internally; the entry point, the registry, and the per-class / per-student / per-task row layouts stay the same.
- Add UI for any feature. The display helpers are pure functions and presentational components; the page composition is owned by the Class page spec.
- Migrate historical data or preserve backwards compatibility with the old `lastUpdated` field name. The rename is a deliberate breaking change.

## Agreed product decisions

1. **`AssignmentPartial.lastUpdated` is renamed to `AssignmentPartial.updatedAt` as a deliberate breaking schema change.** The field semantically already represents the per-assignment-instance activity timestamp; the rename brings the assignment model in line with the rest of the codebase (`StudentSubmissionPartial.updatedAt`, `AssignmentDefinitionPartial.updatedAt`). No backwards-compat shim, no deprecation alias, no migration helper. Every frontend and backend caller must be updated in the same change. The `—` placeholder for unparseable timestamps is removed for the "Last Assessed" line; a null or unparseable `updatedAt` on a candidate assignment is a data bug that fails fast at the adapter boundary (the page renders a blocking state).
2. **The N vs E distinction is a data analysis service concern, not a display concern.** The current analyser conflates "not attempted" (raw `score === 'N'`), "no data points", and "processing error" into a single `value: null` state. After the change, the analyser preserves and surfaces `N` (legitimate not-attempted) and `E` (processing error / no usable data) as first-class states. The display layer consumes the resulting richer `MetricResult` and renders each state distinctly.
3. **`MetricResult` is a discriminated union by `state`.** The three states are `computed` (numeric value with the RAG band), `notAttempted` (literal `'N'`, no data points), and `error` (literal `'E'`, no usable data). The discriminator is `state`; consumers branch on it. The numeric invariant `value === null ⇔ applicableDataPoints === 0` is replaced by the discriminated union.
4. **The rollup rule is shared via a single `rollupMetric` helper.** Per-metric sub-task states are classified into `computed` / `notAttempted` / `error`. The rollup precedence is `error` > `notAttempted` > `computed`: if at least one sub-task is `computed`, the rollup is `computed` and a weighted average is computed over `computed` and `notAttempted` sub-tasks only; `error` sub-tasks are excluded. If no sub-task is `computed` but at least one is `notAttempted`, the rollup is `notAttempted`. Otherwise, the rollup is `error`. The rule is extracted to `rollupMetric.ts` and called by both the analyser's row builders and the Class page's adapter.
5. **The per-metric handling of `notAttempted` in the rollup is metric-specific, for the three criterion rollups (`completeness`, `accuracy`, `spag`).** For accuracy and completeness, `notAttempted` contributes a score of `0` — its weight is included in the denominator, zero in the numerator. For SPAG, `notAttempted` is excluded (its weight is not counted in the denominator; SPAG cannot be assessed on unsubmitted work). `error` sub-tasks are excluded from the calculation in all three criteria. The **`rollupMetric` helper only handles these three criteria**; the `average` (overall) is **not** in the helper's `RollupMetric` type because the "average" is a composite of the three per-criterion rollups at every aggregation level, not a fourth independent weighted average. The composite logic is implemented at each aggregation level by the consumer (the analyser's per-task, per-student, and per-class row builders; the Class page adapter's per-assignment rollup) using the same 40/40/20 weighting (with the SPaG-renormalisation rule when SPaG is `notAttempted`).
6. **Hard-throw failure modes propagate, not `error` state.** Divide-by-zero during weighted averaging, `NaN`/`Infinity` in the result, and unexpected schema-shape violations propagate as exceptions from the data analysis service. The page surfaces them as a blocking state via the existing fail-closed pattern. The accumulator's contract is the three-state assignment; defensive guards for `NaN`/`Infinity` are not added in v1.
7. **Pill band boundaries are dynamic, derived from a configurable scoring range.** The helper takes an optional `{ lower, upper }` range (default `{ lower: 0, upper: 5 }`) and computes the boundaries as midpoints: `red/amber = (3·lower + upper) / 4`, `amber/green = (lower + 3·upper) / 4`. Boundary inclusivity: `red: value < (3·lower + upper) / 4`; `amber: (3·lower + upper) / 4 ≤ value < (lower + 3·upper) / 4`; `green: value ≥ (lower + 3·upper) / 4`. The amber band is the middle 50% of the range; red and green are 25% each. The helper validates `range.upper > range.lower` and throws if violated (fail-fast in development).
8. **The shared `metricDisplay/` subfolder is created for `metricTone` and `MetricPill` with no `index.ts` barrel.** Consumers import directly (`import { resolveMetricTone } from '.../metricDisplay/metricTone';`). The two files share the `metricDisplay` domain prefix; the direct-import preference follows `src/frontend/AGENTS.md` §13 ("Barrel exports are optional; prefer direct imports for clarity unless a service domain exports many unrelated symbols"). This is a deliberate v1 simplification; a barrel may be added in a later de-sloppification pass if call sites get noisy.
9. **The shared `formatUpdatedAtLabel` helper is extracted from `src/frontend/src/pages/AssignmentsPage.tsx` to `src/frontend/src/utils/dateFormatting.ts`.** The helper is a pure formatting function with no React / antd deps. It is the only file in the new `utils/` folder. The helper preserves the `en-GB` locale and the existing `—` fallback for `AssignmentsPage`'s use; the Class page adapter throws on null or unparseable input (per decision 1) because the data integrity bar for the "Last Assessed" line is higher than for a generic table cell. The extraction is a mandatory sub-task of the rename deliverable.

## Existing system constraints

### Backend / API constraints

- `getABClass({ classId })` returns `ClassFull | null` via `callApi('getABClass', { classId })`. The transport shape is unchanged by this prep work; only the field name on the inner `AssignmentPartial` changes from `lastUpdated` to `updatedAt`.
- `DateUtils.normaliseDateFields(response, [...])` is the canonical backend utility for date serialisation at the transport boundary. After the rename, the field list passed to `normaliseDateFields` for the `getABClass` handler must include `'updatedAt'` instead of `'lastUpdated'`.
- The backend `Assignment` model carries the underlying field that becomes the `updatedAt` serialised value. The model's `toPartialJSON()` is the sole serialisation point for the per-assignment fields on the wire.

### Data analysis constraints

- `DataAnalysisService.analyse(input, analyserKey = 'averaging')` is a pure orchestrator. The entry point and registry stay unchanged. The internal `MetricResult` shape changes per the new discriminated union.
- `AveragingAnalyserInput`, `AveragingResult`, `PerStudentRow`, `PerTaskRow`, and `PerClassResult` thread the new `MetricResult` shape through.
- `assignmentDefinitionPartials` is already in startup warmup (see `sharedQueries.ts` `startupWarmupQueryDefinitions`).
- The data analysis service has no production consumers in the codebase outside the Class page (searches for `DataAnalysisService` and `analyse(` in `src/frontend/src/**/*.tsx` return zero matches). All existing callers are tests. This makes the contract change low-risk.

### Frontend / architecture constraints

- Zod is the canonical validation framework. The new `MetricResult` schema is defined first, then TypeScript types are derived from `z.infer<typeof ...>` to avoid duplicated declarations.
- Default values live in the module's constructor or function signature only (per `src/frontend/AGENTS.md` §12). Helper defaults (`range`, `precision`, `errorColor`) are set in the function signature.
- The shared helpers have no React, Ant Design, I/O, or state dependencies. They are pure functions or pure presentational components.

## Domain and contract recommendations

### Naming recommendation

- The new field is `updatedAt` (not `lastUpdatedAt`, not `lastUpdated`, not `modifiedAt`). This matches the existing `StudentSubmissionPartial.updatedAt` and `AssignmentDefinitionPartial.updatedAt` naming.
- The new `MetricResult` states are `computed` / `notAttempted` / `error` (lowercase, single words, present-tense for the first two, noun for the third).
- The shared helper module is `metricDisplay/`. The tone resolver is `metricTone.ts`; the presentational component is `MetricPill.tsx`. No barrel export; direct imports only.

### Why this approach is preferable

- **Reusing `updatedAt` removes a per-domain naming inconsistency** that has already caused confusion between per-instance, per-submission, and per-definition timestamps.
- **The three-state `MetricResult` makes a pedagogical distinction explicit.** A teacher looking at a class page should be able to tell "the student did not attempt this" from "we have no data for this" from "the assessor could not compute this". Collapsing them into a single null value hides a real distinction.
- **A shared `rollupMetric` helper eliminates the risk of the analyser and the adapter drifting.** The two call sites share the exact same precedence and per-metric `notAttempted` handling. A change is made once.
- **The shared `metricDisplay/` helpers are designed for reuse.** The Class page is the first caller; cohort, trend, and distribution analyses (per `docs/pedagogy/data-analysis-scoring.md:92-99`) are the near-term second caller.

## Feature architecture

### Placement

- The new `rollupMetric` helper lives at `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`. It is a peer of `averagingAnalyser.accumulation.ts` and `averagingAnalyser.rows.ts`. The helper has no React / antd deps.
- The shared display helpers live at `src/frontend/src/services/dataAnalysis/metricDisplay/`. The folder contains `metricTone.ts` and `MetricPill.tsx` plus their co-located `.spec.ts` companions. No `index.ts` barrel.
- The `formatUpdatedAtLabel` helper lives at `src/frontend/src/utils/dateFormatting.ts`. New `utils/` folder entry; first user. Full contract in the "`formatUpdatedAtLabel` shared helper contract" subsection under the rename deliverable above.

### Files affected by the rename deliverable

- **`src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.ts`** — rename `lastUpdated` to `updatedAt` in `AssignmentPartialSchema`. The field stays `z.string().nullable()`; the cardinality (always present, may be null) is preserved. The null-handling _semantics_ change: a null `updatedAt` on a candidate assignment is a data bug, not a soft signal. Update the JSDoc to note the rename and the new fail-fast contract.
- **`src/frontend/src/test/dataAnalysis/fixtures.ts`** — update `createAssignmentPartial` to emit `updatedAt: null` (or a real ISO string in tests that need a valid value).
- **`src/frontend/src/services/googleClassrooms/classDetail/classDetailService.zod.spec.ts`** — update any test fixtures that use `lastUpdated`.
- **`src/frontend/src/services/googleClassrooms/classDetail/classDetailService.spec.ts`** — update any test fixtures that use `lastUpdated`.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`** — update any test fixtures that use `lastUpdated` on `AssignmentPartial`.
- **`src/backend/AssignmentProcessor/Assignment.js`** — rename `this.lastUpdated` to `this.updatedAt`; update **`toPartialJSON()` and `toJSON()`** (both used by `getABClass` and `getAssignment` respectively) to emit `updatedAt`; rename methods `getLastUpdated` → `getUpdatedAt`, `setLastUpdated` → `setUpdatedAt`; update `touchUpdated()` to call the renamed `setUpdatedAt()` internally; update `knownFields` to reflect the new field name. Update the JSDoc comment at line 366–368 ("Updates the lastUpdated timestamp...") to reference `updatedAt`. **The rename is applied to both the `getABClass` / `toPartialJSON()` path and the `getAssignment` / `toJSON()` path**, so the `Assignment` class uses `updatedAt` as the field name everywhere and the wire shape is consistent on both the `getABClass` and `getAssignment` responses. The earlier v1 scope limitation (which excluded the `toJSON()` path) was expanded by the user on 2026-06-30 to apply the rename to the entire codebase, overriding the "intentionally not updated" framing in the original spec draft. The motivation is consistency: the `updatedAt` field name must be the same on both responses and on the `Assignment` class itself. The wire-shape break on the `getAssignment` response is accepted as a deliberate v1 cost. Implementation must verify there are no other consumers of the `getAssignment` response in the codebase before the rename lands (the only known consumer is the test suite, which is updated in the same change).
- **`src/backend/y_controllers/AssignmentController.js`** — update the stale comment at line 152 (`// Update lastUpdated value and persist assignment data`) to reference `updatedAt`.
- **`src/backend/z_Api/assignmentAssessment.js`** — update `DateUtils.normaliseDateFields(response, ['dueDate', 'lastUpdated', 'createdAt'])` (line 141) to use `'updatedAt'` instead of `'lastUpdated'`. Missing this rename would silently skip the date-normalisation step for the renamed field and leave live `Date` objects in the response that violate `google.script.run` serialisation constraints.
- **Backend test fixtures** — search `src/backend/tests/` (or the equivalent test directories) for `lastUpdated` and update any fixture that uses the field name. The `getABClass` test must assert the new field name on the wire.
- **Documentation** — any canonical doc that references `Assignment.lastUpdated` (e.g., `docs/developer/backend/`, `docs/architecture/`) must be updated.

**Explicitly out of scope for the rename:**

- `scripts/builder/vendor/` `CollectionMetadata` and `99_MasterIndex.js` — these use `lastUpdated` in a different domain (builder metadata), not `Assignment` model data.
- `StudentSubmissionPartial.updatedAt` — this is a different field on a different model (per-submission timestamp, already named `updatedAt`; no rename needed).
- `AssignmentDefinitionPartial.updatedAt` — this is a different field on a different model (per-definition template timestamp, already named `updatedAt`; no rename needed). The naming choice for the rename is precisely to align `AssignmentPartial` with these existing per-domain timestamp fields.

### Files affected by the data analysis service deliverable

- **`src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`** — replace the `MetricResultSchema` definition with the new discriminated union. Thread the new `MetricResult` shape through `AveragingAnalyserInput`, `AveragingResult`, `PerStudentRow`, `PerTaskRow`, `PerClassResult`, and `DataAnalysisResponseSchema`.
- **`src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`** (new) — the shared `rollupMetric` helper. Pure function, no React / antd deps. Co-located `.spec.ts` covering the three-criterion × sub-task-state-combination matrix.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts`** — update `accumulateMetricsToTarget` to track `'N'` scores via a new `nCount` field on each sub-accumulator. Update `accumToMetric` to map the accumulator state to a `MetricResult` discriminated union value using the three-way check (`applicableDataPoints > 0` → `computed`, `nCount > 0` → `notAttempted`, otherwise `error`).
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`** — update `buildPerStudentRows` and `buildPerTaskRows` to call the shared `rollupMetric` helper when aggregating across sub-accumulators, rather than calling `accumToMetric` directly on each sub-accumulator. This ensures both row builders apply the same precedence rule.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.types.ts`** — extend the `MetricAccumulator` interface with an `nCount: number` field (initialised to 0 in `createAccumulator`) so the accumulator can distinguish `notAttempted` (`nCount > 0`) from `error` (`nCount === 0` and `applicableDataPoints === 0`). The `AssessmentScore` type stays `number | 'N' | undefined`; the `'E'` literal does not appear here because it is a `MetricResult`-output concept, not a raw-score concept. **`'E'` is intentionally excluded from `AssessmentScore`:** the raw-score type is the input to the analyser (a numeric score or an `'N'` from the LLM service); the analyser is the only component that produces `'E'` (a derived output state when no usable data points exist for a metric). The new `nCount` field is the analyser's internal mechanism for distinguishing `notAttempted` (`nCount > 0`) from `error` (`nCount === 0` and `applicableDataPoints === 0`); it is not a raw-score type. This is a one-line interface addition (the file is currently 18 lines); the substantial work is in `accumulation.ts` (the new `nCount` tracking in `createAccumulator`, `accumulateMetricsToTarget`, and the three-way `accumToMetric` check).
- **`src/frontend/src/services/dataAnalysis/dataAnalysis.zod.spec.ts`** — rewrite the `MetricResultSchema` test cases for the discriminated union. Add explicit tests for each of the three states.
- **`src/frontend/src/services/dataAnalysis/analysers/rollupMetric.spec.ts`** (new) — co-located spec covering the three-criterion × sub-task-state-combination matrix.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.spec.ts`** — rewrite the accumulator tests to assert the state output.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.spec.ts`** — rewrite the per-student / per-task rollup tests with the new state.
- **`src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.spec.ts`** — update the end-to-end analyser tests to assert the new state shape.
- **`src/frontend/src/services/dataAnalysis/dataAnalysisService.spec.ts`** — update the orchestrator tests.
- **`src/frontend/src/test/dataAnalysis/fixtures.ts`** — extend with builders that produce `'N'`-shaped and `'E'`-shaped `MetricResult` outputs.

### Files affected by the shared helpers deliverable

- **`src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`** (new) — the tone resolver. Co-located `metricTone.spec.ts`.
- **`src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`** (new) — the presentational Ant Design `Tag` component. Co-located `MetricPill.spec.tsx`.
- **`src/frontend/src/utils/dateFormatting.ts`** (new) — the `formatUpdatedAtLabel` helper. Pure formatting function, no React / antd deps. Co-located `dateFormatting.spec.ts`. Full contract below.
- **`src/frontend/src/pages/AssignmentsPage.tsx`** — remove the private `formatUpdatedAtLabel` function and import it from the new `utils/dateFormatting.ts` module. No behaviour change for `AssignmentsPage`.

### `formatUpdatedAtLabel` shared helper contract

**Purpose.** Formats an ISO timestamp for table display and filtering. The helper is currently a private function in `AssignmentsPage.tsx` and is extracted as part of the rename deliverable because the Class page's adapter needs the same formatter (and the two call sites must not drift).

**Signature.**

```ts
function formatUpdatedAtLabel(updatedAt: string | null): string;
```

**Behaviour.**

- **Locale:** `en-GB`.
- **Format:** date only, no time, rendered in UTC (consistent with the existing `AssignmentsPage` behaviour: `parsedDate.toLocaleDateString('en-GB', { timeZone: 'UTC' })`).
- **Null input:** returns the em-dash fallback (`UNAVAILABLE_VALUE = '—'`, a local constant in the new module). The constant mirrors the existing `UNAVAILABLE_VALUE` in `AssignmentsPage.tsx:44`; the extracted helper defines its own constant rather than importing it (so the helper has no back-reference to `AssignmentsPage`). This is the existing `AssignmentsPage` behaviour; the Class page adapter does **not** call the helper with null because it throws on null `updatedAt` upstream (per decision 1).
- **Unparseable ISO string:** returns the em-dash fallback (`UNAVAILABLE_VALUE = '—'`). Same rationale: the Class page adapter throws on unparseable input upstream; `AssignmentsPage` keeps the soft fallback because its table is a generic dashboard view that may legitimately receive unparseable data.
- **Pure function:** no side effects, no React / antd imports, no I/O, no state.

**Call-site divergence.** Both call sites import the same function from the same module. The divergence is in call-site error handling:

- `AssignmentsPage` calls the helper directly and renders the result, including the em-dash fallback.
- `classPageAdapter` calls the helper only after a null / unparseable check has thrown upstream; the helper is therefore always called with a valid ISO string in that path.

The em-dash fallback is a helper concern (kept for the soft case) and a call-site concern (the Class page's stricter contract is enforced by the adapter's throw).

### Out of scope for this surface

- The Class page itself (its components, hooks, adapter, model, and page composition). Those live in `SPEC_CLASS_PAGE.md`.
- The shell / routing changes (the `AppNavigationKey` enum, `getBreadcrumbItems`, the `AppShell`, the `ClassesPage.tsx` `selectedClassId` state). Those live in `SPEC_CLASS_PAGE.md`.
- Backend persistence changes beyond the rename. The rename is a wire-shape change; the underlying storage model is unchanged.
- New analysis pipelines. The data analysis service change is a contract refinement of the existing `averaging` analyser, not a new analyser.

## Data loading and orchestration

### Required datasets or dependencies

- The data analysis service change has no new external dependencies. The existing `assignmentDefinitionPartials` warm-up-backed read and the existing per-class `getABClass` query are sufficient.
- The rename deliverable has no new external dependencies. It is a one-shot string substitution across the schema, the backend model, all callers, and all test fixtures.

### Query or transport additions

- None for the prep work. The new `rollupMetric` helper is a pure function. The new display helpers are pure functions or presentational components. The rename is a wire-shape change to an existing field.

## Core behavioural model

### `MetricResult` discriminated union (replaces the current `value: number | null` shape)

```ts
const ComputedMetricSchema = z.strictObject({
  state: z.literal('computed'),
  value: z.number(),
  totalWeight: z.number(),
  applicableDataPoints: z.number().int().min(0),
  totalDataPoints: z.number().int().min(0),
});

const NotAttemptedMetricSchema = z.strictObject({
  state: z.literal('notAttempted'),
  value: z.literal('N'),
  totalWeight: z.number(),
  applicableDataPoints: z.literal(0),
  totalDataPoints: z.number().int().min(1), // at least one 'N' was seen
});

const ErrorMetricSchema = z.strictObject({
  state: z.literal('error'),
  value: z.literal('E'),
  totalWeight: z.number().min(0),
  applicableDataPoints: z.literal(0),
  totalDataPoints: z.number().int().min(0), // may be > 0 when submissions exist but have no assessments
});

const MetricResultSchema = z.discriminatedUnion('state', [
  ComputedMetricSchema,
  NotAttemptedMetricSchema,
  ErrorMetricSchema,
]);
```

**Note on the `'E'` literal:** The `'E'` literal exists **only** in the `MetricResult` discriminated union (the analyser's output). It is **not** added to `PartialAssessmentScoreSchema` (`classDetailService.zod.ts:10-13`), which validates backend wire data and stays `number | 'N'`. The backend storage model does not produce `'E'` — a failed assessment simply has no entry in the `assessments` dict (`{}`). The `'E'` state is produced by the analyser when it has seen zero usable data points for a particular metric at a particular aggregation level.

### State assignment rules (v1)

The accumulator in `averagingAnalyser.accumulation.ts` produces one of the three states based on the data it has seen. The `MetricAccumulator` interface is extended with an `nCount: number` field (initialised to 0 in `createAccumulator`) that tracks how many raw `'N'` scores were seen per criterion, so the accumulator can distinguish `notAttempted` from `error` at conversion time.

| Condition                                                                          | State          | Value         |
| ---------------------------------------------------------------------------------- | -------------- | ------------- |
| At least one numeric score (`applicableDataPoints > 0`)                            | `computed`     | weighted mean |
| No numeric scores but at least one raw `'N'` score (`nCount > 0`)                  | `notAttempted` | `'N'`         |
| No scores at all — `nCount === 0` and `applicableDataPoints === 0`                 | `error`        | `'E'`         |
| (submissions exist, no assessments performed, or all scores structurally unusable) |                |               |

A "mixed" case (e.g., a student with one numeric score and one `'N'`) produces `computed` — the `'N'` is dropped from the average, consistent with the existing SPaG-renormalisation rule (`data-analysis-scoring.md:71-77`).

### `rollupMetric` helper contract

```ts
// Sketch only — the canonical signature lives in rollupMetric.ts
// Note: 'average' is intentionally NOT in RollupMetric. The average is a
// composite of the three per-criterion rollups at every aggregation level,
// not a fourth independent weighted average. See decision 5.
type RollupMetric = 'completeness' | 'accuracy' | 'spag';

function rollupMetric(subTasks: ReadonlyArray<MetricResult>, metric: RollupMetric): MetricResult;
```

- The function is pure. No side effects, no React / antd imports, no I/O, no state.
- The function applies the precedence (decision 4) and per-metric `notAttempted` handling for the three criteria (decision 5).
- Default values: none. All inputs are required.
- The function throws (does not return an `error` state) for invalid combinations that should not occur in well-formed data (e.g. a `subTasks` array containing a structurally invalid `MetricResult`). Hard-throw failure modes propagate.

### Assignment-level rollup rule (consumed by the Class page adapter)

The Class page's adapter calls the same `rollupMetric` helper to roll per-task `MetricResult` values into per-assignment values for each of the **three criteria** (`completeness`, `accuracy`, `spag`). The rule is identical to the analyser's per-student / per-class rollup for the same three criteria. The two call sites cannot drift because they call the same function.

The per-assignment `average` is **not** computed by `rollupMetric`. The adapter computes the per-assignment `average` as a composite of the three rolled-up criterion metrics, using the same 40/40/20 weighting as the analyser's per-task "overall" (with the SPaG-renormalisation rule when SPaG is `notAttempted`). The composite rule is:

1. Take the per-assignment `completeness`, `accuracy`, `spag` `MetricResult` values from the three `rollupMetric` calls.
2. If any of the three is `error`, the per-assignment `average` is `error` (the `error` state escalates).
3. If all three are `notAttempted` (and none is `computed`), the per-assignment `average` is `notAttempted`.
4. Otherwise, compute the weighted average over the `computed` criteria, treating `notAttempted` criteria as excluded (consistent with SPaG's exclusion rule). The default weighting is 0.4 completeness + 0.4 accuracy + 0.2 spag, with the SPaG-renormalisation rule when spag is `notAttempted` (renormalise the weighting to completeness + accuracy over 0.8).

The analyser implements the same composite rule for the per-student and per-class "average" — the composite lives at the consumer level, not in the helper. The helper is uniform across all three criteria and all three call sites (analyser row builders, analyser per-class rollup, Class page adapter).

## Main user-facing surface (shared display helpers)

### `metricTone` — pure tone resolver

**Purpose.** Maps a `MetricResult` plus an optional scoring range to a `MetricToneResolution` describing the Ant Design `Tag` color, the raw display value, and a muted flag. Pure function; no React / antd imports.

```ts
type MetricToneRange = { lower: number; upper: number };

// Local type alias (not an Ant Design export). The set matches the
// Ant Design v6 `Tag` preset color tokens supported by `metricTone` and
// `MetricPill`; the literal union is exported from this module so the
// column filter in the Class page can use it as the filter value set.
type MetricToneColor = 'red' | 'gold' | 'green' | 'default' | 'volcano';

type MetricToneResolution = {
  color: MetricToneColor;
  displayValue: number | 'N' | 'E';
  muted: boolean; // true for notAttempted, false otherwise
};

function resolveMetricTone(
  metric: MetricResult,
  range: MetricToneRange = { lower: 0, upper: 5 },
  errorColor: MetricToneColor = 'volcano'
): MetricToneResolution;
```

**Field notes.**

- `metric` is the `MetricResult` discriminated union. The function branches on `metric.state`.
- `range` defines the scoring scale's lower and upper bounds. The function uses the dynamic midpoint rule (decision 7) to derive the red / amber / green band thresholds from the range. For the default range `{ lower: 0, upper: 5 }`, the thresholds are red below `1.25`, amber `[1.25, 3.75)`, green `[3.75, ∞)`. For a 0-100 range, the thresholds are red below `25`, amber `[25, 75)`, green `[75, 100]`.
- `errorColor` is the Ant Design `Tag` color token used for the `error` state. Default `'volcano'`. Exposed for testability and for future visual revisions. `MetricPill` does not set its own `errorColor` default; the default lives in `metricTone` and `MetricPill` is a pass-through.
- The function validates `range.upper > range.lower` at function entry and throws an `Error` if the range is degenerate. A `range.upper <= range.lower` would invert the band logic silently; the team should see the bug immediately. The thrown `Error` message references the supplied `range` for diagnostics.

**Tone resolution rules (v1).**

| `state`        | Value range condition                                   | `color`                            | `displayValue` | `muted` |
| -------------- | ------------------------------------------------------- | ---------------------------------- | -------------- | ------- |
| `computed`     | `value < (3·lower + upper) / 4`                         | `red`                              | `metric.value` | `false` |
| `computed`     | `(3·lower + upper) / 4 ≤ value < (lower + 3·upper) / 4` | `gold`                             | `metric.value` | `false` |
| `computed`     | `value ≥ (lower + 3·upper) / 4`                         | `green`                            | `metric.value` | `false` |
| `notAttempted` | (any)                                                   | `default`                          | `'N'`          | `true`  |
| `error`        | (any)                                                   | `errorColor` (default `'volcano'`) | `'E'`          | `false` |

The `error` color (`volcano`) is the existing Ant Design preset for "important but not fatal" — `red` is reserved for the lowest band of `computed` values to keep the visual hierarchy clear (worst score = red, processing error = volcano). `errorColor` is exposed for testability and future visual revisions.

**Behaviour.**

- No `NaN` / `Infinity` guards. The data analysis service throws on divide-by-zero or invalid results before producing a `MetricResult`; `metricTone` is therefore only ever called with valid `computed` values.
- No caching / memoisation. The function is cheap to call; `MetricPill` invokes it on every render. If a future caller discovers a hot path, memoisation is a localised change inside `MetricPill`.
- The function is not called by the data analysis service or the Class page adapter. Those modules deal in `MetricResult` values, not `MetricToneResolution` values. The mapping from `MetricResult` to `MetricToneResolution` happens in the presentational layer (`MetricPill`).

### `MetricPill` — presentational Ant Design `Tag`

**Purpose.** Renders a `MetricResult` as an Ant Design `Tag` with the resolved color, the formatted display value, and optional emphasis / muted styles. Pure presentational React component; no state, no data fetching, no callbacks.

```ts
type MetricPillProps = {
  metric: MetricResult;
  range?: { lower: number; upper: number };
  emphasised?: boolean;
  precision?: number;
  /**
   * Optional override of the Ant Design `Tag` color token used for the
   * `error` state. In v1 only `'volcano'` is accepted (the design
   * contract reserves `red` for the lowest band of `computed` values
   * to keep the visual hierarchy clear). The type is widened to
   * `MetricToneColor` so future revisions can swap the error color
   * without a type break; the v1 default and v1 contract are
   * `'volcano'`.
   */
  errorColor?: MetricToneColor;
};
```

**Field notes.**

- `metric` is required.
- `range` is optional, default `{ lower: 0, upper: 5 }`. Passed through to `resolveMetricTone`.
- `emphasised` is optional, default `false`. When `true`, the pill is larger (~1.25x font size) and bolder (weight 600). Used by the `Average` cell in the Class page's `RecentAssignmentCard` and by the `Average` column in the Student Averages table.
- `precision` is optional, default `2`. Ignored for `notAttempted` and `error` (the literal `'N'` and `'E'` are always rendered as-is).
- `errorColor` is optional, no `MetricPill`-level default. When omitted, the default is supplied by `resolveMetricTone` (which owns the `'volcano'` default). Exposed for testability and for future visual revisions.
- The component renders a single Ant Design `Tag` with the resolved color (no `variant` prop is exposed; the filled/solid/outlined look is achieved by the `MetricToneColor` preset token, e.g. `red`, `gold`, `green`, `default`, `volcano`). The `bordered` prop is left at its default (bordered) for v1; the implementation agent may set `bordered={false}` if a specific design calls for a borderless look.

**Rendering rules per `MetricResult` state.**

| `state`        | Pill display                             | Pill color                                                     | `muted` |
| -------------- | ---------------------------------------- | -------------------------------------------------------------- | ------- |
| `computed`     | `value.toFixed(precision)` (e.g. `2.18`) | `red` / `gold` / `green` based on the range (see `metricTone`) | `false` |
| `notAttempted` | `N` (uppercase)                          | `default` (grey)                                               | `true`  |
| `error`        | `E` (uppercase)                          | `errorColor` (default `'volcano'`)                             | `false` |

**Behaviour.**

- The pill renders the color and label even when the cell is "degraded" (`notAttempted` or `error`). It does not collapse the cell or hide the pill. A teacher's eye should land on every cell and recognise the state's meaning from the colour + label.
- The pill does not add extra copy (e.g. "No data", "Not attempted", "Error"). The label and color are the only signal. This keeps the layout compact and consistent across the cards and the table.
- The pill does not add a `Tooltip` in v1. A future iteration may add a `Tooltip` wrapper with screen-reader-friendly copy (e.g. "Completeness: 2.18 out of 5 — Green band"). This is a v1.1+ follow-up; see the Class page spec's accessibility notes for the product sign-off on the v1 gap.
- The `emphasised` flag applies to the pill's font size and weight only. It does not change the color, the precision, or the display value.
- The `muted` flag (from `resolveMetricTone`) applies a lower opacity to the pill. It is set only for `notAttempted`; the `computed` and `error` pills are always fully opaque.
- No interactivity. No `onClick`, no `cursor: pointer`, no focus ring. The pill is informational only.

### Composition

- `metricTone` is called only by `MetricPill` in v1. Future callers (cohort, trend, distribution analyses) import it directly: `import { resolveMetricTone } from '.../metricDisplay/metricTone';`. No barrel.
- `MetricPill` is called by the Class page's `RecentAssignmentCard` (four pills per card) and `studentAveragesTableColumns` (one pill per metric cell in the Student Averages table).
- `formatUpdatedAtLabel` is called by the Class page's `classPageAdapter` and by `AssignmentsPage`. Full contract in the "`formatUpdatedAtLabel` shared helper contract" subsection under the rename deliverable above. The helper is unchanged; the divergence between the two call sites is in call-site error handling, not helper implementation.

## Error, loading, and empty-state rules

The prep work introduces no new error / loading / empty-state surface of its own. The data analysis service still throws on hard-failures; the Class page's hook (owned by `SPEC_CLASS_PAGE.md`) catches those throws and surfaces them as a blocking state.

The fail-fast semantics for the renamed `AssignmentPartial.updatedAt` field (a null or unparseable value is a data bug, the adapter throws) are documented in the Class page spec; the underlying decision is captured in decision 1 of this spec.

## Accessibility and usability notes

- The shared display helpers do not add `aria-label` or `Tooltip` wrappers in v1. The pill label (`2.18`, `N`, `E`) and color are the affordance. The v1 accessibility gap (screen-reader and color-blind users cannot distinguish the three states from the label alone) is explicitly signed off by the product. A v1.1+ follow-up will add a `Tooltip` wrapper with screen-reader-friendly copy (e.g. `aria-label="Completeness: Not Attempted"`).
- The default Ant Design `Tag` accessibility behaviour is preserved. The `bordered` prop is left at its default (bordered) for v1; the implementation agent may set `bordered={false}` if a specific design calls for a borderless look.

## Backend changes required

The Class page itself requires no backend changes. However, the prep work modifies backend files in two places:

1. **The rename deliverable** — `src/backend/AssignmentProcessor/Assignment.js`, `src/backend/y_controllers/AssignmentController.js`, `src/backend/z_Api/assignmentAssessment.js`, and any backend test fixtures that use the field name. The full file list is in "Files affected by the rename deliverable" above.
2. **The data analysis service deliverable** — no backend changes. The data analysis service is frontend-only.

The `getABClass` and `getAssignment` API surfaces are unchanged at the method-signature / response-envelope level. The wire shape changes (the field name changes from `lastUpdated` to `updatedAt` on both responses), but the method signature and response envelope are the same. The `getAssignment` response change is a deliberate v1 cost of applying the rename consistently across the codebase (see the user scope expansion note in "Files affected by the rename deliverable" above); the implementation must verify there are no other consumers of the `getAssignment` response before the rename lands.

## Planning handoff notes

- **Sequencing constraint.** The rename is sequenced before the data analysis service change because the data analysis service change touches fixtures and downstream code that share the property name. Doing the rename first avoids a mixed intermediate state in the test fixtures. The full ordering is: (1) rename, (2) data analysis service change, (3) shared display helpers. The shared display helpers come last because they consume the new `MetricResult` discriminated union; they can be built in parallel with the data analysis service change but cannot be exercised by tests until the new shape is in place.
- **The shared `formatUpdatedAtLabel` extraction is sequenced after the rename** (the helper formats `updatedAt`, the new field name) and **before the Class page work** (the page's adapter imports the helper). The extraction is a mandatory sub-task of the rename deliverable, not a separate deliverable. Full contract in the "`formatUpdatedAtLabel` shared helper contract" subsection under the rename deliverable above.
- **The new `rollupMetric` helper is sequenced as part of the data analysis service change.** The action plan must include the helper as its own section, with red-first tests for the three-criterion × sub-task-state-combination matrix. Both the analyser's spec and the Class page adapter's spec exercise the same helper.
- **The `averagingAnalyser.accumulation.ts` facade decomposition is not required for v1.** The post-change size is ~500–530 lines, under the 550-line threshold. Per `src/frontend/AGENTS.md` §13 (service domain folder organisation) and the facade-pattern guidance in the per-component AGENTS files, "Do not pre-emptively split files that are approaching 550 lines; wait until the threshold is crossed or a concrete maintenance need arises". The action plan should record the projected post-change size and defer the split until the threshold is crossed or a concrete maintenance need arises (e.g. the three-way state assignment logic is hard to test in isolation). **Conflict note (location + signature + scope):** the canonical shared-helpers doc (`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9.17 item 4) records the planned `rollupMetric` helper as `accumulation/accumulationPolicies.ts` with the signature `rollupMetric(subAccumulators: MetricAccumulator[]): MetricResult` (operating on internal accumulators with no `metric` discriminator). The prep spec diverges on **three** axes: (1) **location** — the helper lives at `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts` (standalone) in v1 because the facade decomposition is deferred; (2) **signature** — the prep spec's signature is `rollupMetric(subTasks: ReadonlyArray<MetricResult>, metric: 'completeness' | 'accuracy' | 'spag'): MetricResult`, operating on the public `MetricResult` discriminated union with a metric discriminator (the `MetricResult[]` type, not the `MetricAccumulator[]` type); (3) **scope** — the prep spec's `RollupMetric` type is `'completeness' | 'accuracy' | 'spag'` only (the three criteria). The `'average'` metric is NOT in the helper's type because the average is a composite of the three per-criterion rollups at every aggregation level (per decision 5), not a fourth independent weighted average. The composite logic is implemented at the consumer level (the analyser's per-task, per-student, and per-class row builders; the Class page adapter's per-assignment rollup), not in the shared helper. The action plan must implement the helper per the **prep spec's signature and scope** (not the shared-helpers doc's) and update the shared-helpers doc's `Planned doc reconciliation` note to: (a) reflect the deferred decomposition, (b) record the corrected signature, (c) record the corrected scope (three criteria only, no `'average'`), and (d) note that the helper operates on `MetricResult[]` not `MetricAccumulator[]`. The `rollupMetric` helper therefore lives at `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts` in v1; if the decomposition lands in a later iteration, the helper moves to `accumulation/accumulationPolicies.ts` with the same signature and scope.
- **The `metricDisplay/` subfolder creation is justified under `src/frontend/AGENTS.md` §13** (≥2 files sharing the `metricDisplay` domain prefix). The Class page is the first caller; cohort / trend / distribution analyses are the near-term second caller.
- **`MetricToneColor` is a cross-spec contract.** The local type alias `'red' | 'gold' | 'green' | 'default' | 'volcano'` is exported from `metricTone.ts` and consumed by the Class page's `studentAveragesTableColumns` as the column filter `value` set. Both specs must agree on the union; a change to the `MetricToneColor` union in the prep spec silently breaks the Class page's column filters. Any future revision of the union is a cross-spec breaking change that must update both specs and the column filter entries.
- **The new `src/frontend/src/utils/` folder is created for the `formatUpdatedAtLabel` extraction.** This is the first entry in the new top-level `utils/` folder under `src/frontend/src/`. The folder is not justified under `src/frontend/AGENTS.md` §13 (which only governs the `services/` subfolders); the `utils/` folder is a separate convention for pure formatting / utility functions shared across the frontend. The action plan must record the new folder as a deliberate v1 addition and update the frontend AGENTS / shared-helpers doc if a `utils/`-folder rule is needed for future helpers.
- **No backwards-compat shim for the rename.** The action plan must include a one-shot rename across the frontend Zod schema, the backend source model, all callers, and all test fixtures. No aliasing, no deprecation period, no migration helper.

## Testing expectations

- **`rollupMetric.spec.ts` (new)** — covers the three-criterion × sub-task-state-combination matrix. For each of the three criteria (`completeness`, `accuracy`, `spag`), the test exercises the relevant sub-task-state combinations: all-`computed` (weighted mean); all-`notAttempted` (rollup is `notAttempted`); all-`error` (rollup is `error`); mixed `computed` + `notAttempted` + `error` (precedence: `error` > `notAttempted` > `computed`, with `error` sub-tasks excluded from the weighted average). The per-metric `notAttempted` handling is also tested: for accuracy and completeness, `notAttempted` contributes 0; for SPAG, `notAttempted` is excluded. Edge cases: empty `subTasks` array (throws — invalid input); structurally invalid sub-task (throws). The `average` composite is tested separately in the analyser and adapter specs (not in `rollupMetric.spec.ts`).
- **`dataAnalysis.zod.spec.ts`** — rewrite the `MetricResultSchema` test cases for the discriminated union. Each of the three states round-trips; the schema rejects mismatches (e.g. `state: 'computed'` with `value: 'N'`).
- **`averagingAnalyser.accumulation.spec.ts`** — rewrite the accumulator tests to assert the state output. Each of the three state assignment rules in the table above is covered, plus the mixed (numeric + `'N'`) → `computed` case.
- **`averagingAnalyser.rows.spec.ts`** — rewrite the per-student / per-task rollup tests with the new state. The rollup precedence (error wins over notAttempted wins over computed) and the all-`notAttempted` → `notAttempted` rollup are covered.
- **`averagingAnalyser.spec.ts` and `dataAnalysisService.spec.ts`** — update the end-to-end analyser and orchestrator tests to assert the new state shape on the public output.
- **`fixtures.ts`** — extend with builders that produce `'N'`-shaped and `'E'`-shaped `MetricResult` outputs.
- **`metricTone.spec.ts` (new)** — for each state, the resolver returns the expected color, display value, and muted flag. For `computed`, boundary cases at the red/amber and amber/green edges are covered (using the default range and a custom range). Range validation: `range.upper <= range.lower` throws.
- **`MetricPill.spec.tsx` (new)** — renders the right Ant Design `Tag` color and label for each state. The `emphasised` prop produces a larger / bolder tag. The `precision` prop formats the number correctly.
- **`dateFormatting.spec.ts` (new)** — covers the helper's `en-GB` formatting behaviour. The `—` fallback is a `AssignmentsPage` concern, not a helper concern.
- **Rename regression** — the rename must be applied as a single breaking change; no test should pass with the old name present, and no test should pass with the new name absent. The `getABClass` test must assert the new field name on the wire.
- **Backend test fixtures** — any backend test fixture that uses the field name must be updated to use `updatedAt`.

## Documentation and rollout notes

- **`docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`** — record the planned `resolveMetricTone`, `MetricPill`, and `metricDisplay/` subfolder decisions in §9.17 ("Class page data analysis display helpers") as **deferred / not yet implemented** entries (reconciled against the actual implementation during the documentation pass). Also record the planned `formatUpdatedAtLabel` extraction from `AssignmentsPage.tsx` to `src/frontend/src/utils/dateFormatting.ts` (new file; first entry in the `utils/` folder) as a new planned-only helper entry.
- **`docs/pedagogy/data-analysis-scoring.md`** — update the "Understanding the numbers in the results table" section (the table is at lines 83–88 of the current file) to describe the three states. The "Value" row needs to distinguish the number case from the `N` case from the `E` case. The pedagogy is the right place to explain to teachers what each state means.
- **No change to `docs/architecture/`** is expected for the prep work. The architecture doc is unaffected by the rename or the `MetricResult` discriminated union.

## V1 scope recommendation

### Include in v1

- The `AssignmentPartial` `lastUpdated` → `updatedAt` rename across the frontend Zod schema, the backend source model, all callers, and all test fixtures.
- The new `MetricResult` discriminated union.
- The new `rollupMetric` helper.
- The accumulator and row-builder updates for the three-state assignment.
- The shared `metricDisplay/` display helpers (`metricTone`, `MetricPill`).
- The `formatUpdatedAtLabel` extraction to `src/frontend/src/utils/dateFormatting.ts`.

### Defer from v1

- The `averagingAnalyser.accumulation.ts` facade decomposition. Deferred until the 550-line threshold is crossed or a concrete maintenance need arises.
- A `Tooltip` / `aria-label` wrapper on `MetricPill` for accessibility. Deferred to v1.1; the v1 gap is explicitly signed off.
- A new `metricDisplay/` consumer beyond the Class page. The first external caller is the Class page; cohort, trend, and distribution analyses land in their own iteration.
- Alternative `MetricToneColor` palettes. The `errorColor` parameter is exposed for testability and future visual revisions; the default `'volcano'` is the v1 contract.

## Open questions

None for v1. All decisions for the prep work are captured above. The new `MetricResult` discriminated union, the shared `rollupMetric` helper, the shared display helpers, and the rename are all fully specified and ready to be planned in detail by the action plan.
