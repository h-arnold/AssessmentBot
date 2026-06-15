# Data Analysis Service Specification

## Status

- Draft v1.0 (released 2026-06-15 for hand-off during preparatory backend work)
- This v1 is intentionally cut before the `Planner Reviewer` review loop, per user request, to allow the user to begin building the preparatory backend endpoints. The user will return to this branch to run the review, produce `ACTION_PLAN.md`, and begin implementation once those endpoints are in place.
- The pre-existing repository-root `SPEC.md` and `ACTION_PLAN.md` are scoped to a different, unrelated feature (the `getAssignment` read endpoint and the `AssignmentNotFoundError` typed error) and remain authoritative for that work. This document is the source of truth for the Data Analysis Service.

## Purpose

This document defines the intended behaviour for the **frontend Data Analysis Service** — a modular, pure analysis layer that processes assessment data from full `ABClass` instances and emits pure-domain result types in readiness for future display.

The feature will be used to:

- Compute weighted averages for completeness, accuracy, SPaG, and a configurable overall metric per student, per task, and per class, scoped to one or more `ABClass` instances.
- Filter the underlying data by date range, topic key(s), and assignment definition key(s).
- Form the foundation for a future family of analyses (cohort, trend, distribution, comparison, etc.) added as plug-in analysers without changing the existing contract.

This feature is **not** intended to:

- Render data, choose Ant Design components, or own any UI behaviour. (That work is a separate, deferred work stream.)
- Compute or persist any data on the backend. (The new full-class endpoint is a thin data-assembly read; the analysis maths is on the frontend.)
- Mutate any backend state. (The service is read-only.)
- Replace or modify the existing `getAssignment` read endpoint (see root `SPEC.md`).
- Define a future "cohort" or cross-class analysis (deferred to a future analyser / work stream).
- Persist user-configured criterion weightings (deferred to a future "scoring profile" work stream).

## Agreed product decisions

(All decisions locked during planning rounds 1 and 2, 2026-06-15.)

1. The Data Analysis Service is a **pure analysis layer**. It performs no transport, owns no React Query state, and does not import Ant Design. The hook layer in a future `features/dataAnalysis/` directory will own data fetching and feed pre-fetched data to the service.
2. The service is organised as an **orchestrator + pluggable analysers** (strategy pattern). The v1 analyser is `AveragingAnalyser`. New analyses are added by writing a new analyser class and registering it with the orchestrator; the existing analyser contract and `AveragingResult` shape are not modified.
3. The orchestrator (`DataAnalysisService`) is a thin module that owns filter validation, dispatches to one or more registered analysers, and returns their typed results. It has no state.
4. The analyser contract is: `analyse(input) → output` where `input` is a fully-assembled, already-fetched dataset (full `ABClass` instances, pre-fetched `AssignmentDefinitionPartial`s, filter) and `output` is a pure-domain typed result. The analyser is pure and synchronous.
5. The data source is **one new backend endpoint (TBC) that returns a full `ABClass` instance per class**. The frontend does the maths. The endpoint is a read-only data-assembly wrapper that delegates to the existing `ABClassController.loadClass`; it does not implement any analysis. The exact method name in `ALLOWLISTED_METHOD_HANDLERS` is TBC pending the user's backend implementation.
6. The full `ABClass` data shape assumed by this service is the existing `ABClass.toJSON()` output (`src/backend/Models/ABClass.js:272-285`), extended with a **planned-only** `assignment.createdAt` field on each `Assignment` (semantics: "the timestamp at which the first assessment run was triggered for this assignment instance"). See Backend changes required.
7. The per-data-point weight is `assignmentWeighting × taskWeighting`, sourced from the embedded `assignment.assignmentDefinition`. Both fields are nullable on the partial; the analyser's input contract treats a `null` `assignmentWeighting` as `1` (the backend's constructor default) and a missing `taskWeighting` as `1` (the backend's constructor default), matching the backend constructors in `src/backend/Models/AssignmentDefinition.js` and `src/backend/Models/TaskDefinition.js`. This is the only place defaults are applied, per AGENTS §3.12 / frontend §11.
8. Criterion weightings are `{ completeness, accuracy, spag }`, defaulting to `40 / 40 / 20` (i.e. `0.4 / 0.4 / 0.2`), overridable via an optional analyser parameter. Validated by Zod: non-negative, finite, sum to `1.0` within a small float-drift tolerance (`1e-9`). The defaults are set in the analyser constructor only.
9. The "overall" metric is computed as the **renormalised weighted mean of available criteria per data point**: `overall_i = (w_C × C_i + w_A × A_i + w_S × S_i) / (w_C + w_A + w_S)`. When `S_i` is `'N'` (formulae tasks), the denominator shrinks to `w_C + w_A`. The data point's contribution to the per-criterion metrics is governed by the standard `applicableDataPoints` rule.
10. SPaG `'N'` is handled by **renormalisation, not exclusion**. Each metric result includes `value`, `totalWeight`, `applicableDataPoints`, and `totalDataPoints` so the page can render honest sample-size context (e.g. tooltips) without ambiguity.
11. The filter contract supports:
    - `classIds: string[]` — required. The classes to analyse. Sourced from the pre-fetched `getABClassPartials`.
    - `dateRange?: { from: ISO 8601 string, to: ISO 8601 string }` — optional. Filter assignments by `assignment.createdAt`. `from` is inclusive, `to` is exclusive. Assignments with `createdAt === null` are excluded when a `dateRange` is supplied.
    - `topicKeys?: string[]` — optional. Match against `assignment.assignmentDefinition.primaryTopicKey` only. `alternateTopics` are not consulted (the embedded `primaryTopicKey` already normalises Classroom-stored variants).
    - `assignmentDefinitionKeys?: string[]` — optional. Match against `assignment.assignmentDefinition.definitionKey`. `undefined` or `[]` means "no assignment filter".
12. The result shape is **per-class** (`AveragingResult[]` indexed by `classId`), each containing per-student / per-task / per-class breakdowns. Cross-class / cohort analysis is a separate, future analyser.
13. No layout spec, no page, no Ant Design adapter, no UI work in v1. The page and the chart/table adapter module are a separate work stream. This service emits stable, chart/table-friendly field names (`studentId`, `taskId`, `classId`, numeric criterion values) so the future adapter layer is trivial.

## Existing system constraints

### Backend or API constraints already in place

- `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js` currently exposes `getABClassPartials`, `getAssignmentDefinitionPartials`, `getAssignmentDefinition`, `getAssignment` (TBC pending the in-flight `getAssignment` `SPEC.md`), `getAssignmentTopics`, and the standard reference-data and config endpoints. There is **no full-class endpoint** today; one is required (see Backend changes required).
- `getGoogleClassroomAssignments(classId)` returns only `{ assignmentId, title, topicId, topicName }` metadata. It is **not** a substitute for the full-class endpoint and does not return assessment data.
- Backend transport prohibits live `Date` objects in return values (per `src/backend/AGENTS.md` §8 and `src/frontend/AGENTS.md` §4.3). All timestamps on the wire are ISO 8601 strings.
- The `submission.updatedAt` field has a `#N` counter suffix for monotonicity. The analyser **does not** consume `submission.updatedAt` for v1 date filtering (the date filter is against `assignment.createdAt`, which is never given the counter suffix), but the analyser must remain tolerant of the suffix in any future change that does consult it.

### Current data-shape constraints

- The `ABClass` model (`src/backend/Models/ABClass.js`) already includes `students` and `assignments` in its full `toJSON()`. The new endpoint must return this full shape; the analyser's input type is anchored to it.
- `Assignment.toJSON()` (`src/backend/AssignmentProcessor/Assignment.js:44-79`) emits `submissions` and the embedded `assignmentDefinition` with `tasks` (including `taskWeighting` per task) and `assignmentWeighting`. This is sufficient for the analyser's per-data-point weight calculation without an extra `getAssignmentDefinition` call.
- `StudentSubmissionItem.toJSON()` (`src/backend/Models/StudentSubmission.js:104-115`) emits `feedback` keyed by `completeness | accuracy | spag`, with `score` (number `0..5`) and `reasoning`. SPaG may be `'N'` for formulae tasks.
- `AssignmentDefinitionPartial` (`src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts:184-204`) carries `primaryTopic`, `primaryTopicKey`, `alternateTopics` (display names only — no keys). The full `AssignmentDefinition` carries the same plus `tasks: AssignmentDefinitionTask[]` with `taskWeighting`. The analyser uses the full definition (embedded in the full class) for weightings; the partial is used only for cross-checking the topic filter against the pre-fetched reference data.
- `AssignmentTopic` (`src/frontend/src/services/referenceData/referenceData.zod.ts:114-124`) is separate reference data, keyed by `key`. The page is expected to resolve user-visible topic names to keys before calling the analyser.

### Frontend or consumer architecture constraints

- Per `src/frontend/AGENTS.md` §2.2, async orchestration and side effects live in feature hooks; service modules own transport and validation; components delegate to hooks. The `DataAnalysisService` is therefore a pure-analysis module — no `callApi` — and the future `useDataAnalysis` hook in `features/dataAnalysis/` will own the React Query + transport work.
- Per `src/frontend/AGENTS.md` §12, the natural home for this service is `src/frontend/src/services/dataAnalysis/` once the Zod companion file is added (≥ 2 files justifies a folder). If the v1 cut ships with a single service file before its Zod companion, it may live flat at `src/frontend/src/services/dataAnalysisService.ts` per the AGENTS §12 rule and be promoted to a subfolder when the Zod file is added.
- Per `src/frontend/AGENTS.md` §8, all schemas are Zod-first; types via `z.infer`; `.strict()` on objects; `z.void().nullable()` for void responses (none expected in v1).
- Per `src/frontend/AGENTS.md` §3.12 (and AGENTS.md §11), default values are set in the analyser constructor only.
- The "first reusable, second-extract, third-create" helper rule applies: no new shared helpers are needed in v1. The orchestrator and the analyser are the only new code units.

## Domain and contract recommendations

### Why this approach is preferable

- **Open/closed extension** — adding a new analysis (cohort, trend, distribution) does not modify the existing analyser or the orchestrator. The orchestrator's analyser registry is the single extension point.
- **Pure functions are trivially testable** — the analyser has no I/O, no time, no randomness beyond what is injected. TDD with synthetic `ABClass` fixtures is straightforward and the tests run in milliseconds.
- **No coupling to Ant Design** — the result type uses stable, generic field names. The future adapter layer is a thin `toChartData(result)`-style function and can be swapped or rewritten without touching the service.

### Recommended data shapes

#### `AnalysisFilter` (Zod-first, source of truth)

```ts
const AnalysisFilterSchema = z
  .object({
    classIds: z.array(z.string().min(1)).min(1),
    dateRange: z
      .object({
        from: z.string().datetime({ offset: true }),
        to: z.string().datetime({ offset: true }),
      })
      .strict()
      .refine((r) => r.from <= r.to, { message: 'dateRange.from must be <= dateRange.to' })
      .optional(),
    topicKeys: z.array(z.string().min(1)).min(1).optional(),
    assignmentDefinitionKeys: z.array(z.string().min(1)).min(1).optional(),
    criterionWeightings: z
      .object({
        completeness: z.number().nonnegative().finite(),
        accuracy: z.number().nonnegative().finite(),
        spag: z.number().nonnegative().finite(),
      })
      .strict()
      .refine((w) => Math.abs(w.completeness + w.accuracy + w.spag - 1) < 1e-9, {
        message: 'criterionWeightings must sum to 1.0 (within float-drift tolerance)',
      })
      .optional(),
  })
  .strict();
```

#### `AveragingResult` (per-class output)

```ts
const MetricResultSchema = z
  .object({
    value: z.number().nullable(), // null iff applicableDataPoints === 0
    totalWeight: z.number(), // sum of per-data-point weights contributing
    applicableDataPoints: z.number().int().nonnegative(),
    totalDataPoints: z.number().int().nonnegative(),
  })
  .strict();

const PerStudentRowSchema = z
  .object({
    studentId: z.string(),
    studentName: z.string().nullable(),
    completeness: MetricResultSchema,
    accuracy: MetricResultSchema,
    spag: MetricResultSchema,
    overall: MetricResultSchema,
  })
  .strict();

const PerTaskRowSchema = z
  .object({
    definitionKey: z.string(),
    taskId: z.string(),
    taskTitle: z.string().nullable(),
    completeness: MetricResultSchema,
    accuracy: MetricResultSchema,
    spag: MetricResultSchema,
    overall: MetricResultSchema,
  })
  .strict();

const PerClassResultSchema = z
  .object({
    completeness: MetricResultSchema,
    accuracy: MetricResultSchema,
    spag: MetricResultSchema,
    overall: MetricResultSchema,
  })
  .strict();

const AppliedCriterionWeightingsSchema = z
  .object({
    completeness: z.number(),
    accuracy: z.number(),
    spag: z.number(),
  })
  .strict();

const AveragingResultSchema = z
  .object({
    classId: z.string(),
    className: z.string().nullable(),
    perStudent: z.array(PerStudentRowSchema),
    perTask: z.array(PerTaskRowSchema),
    perClass: PerClassResultSchema,
    appliedCriterionWeightings: AppliedCriterionWeightingsSchema,
  })
  .strict();

const DataAnalysisResponseSchema = z.array(AveragingResultSchema);
```

### Naming recommendation

Prefer:

- `criterionWeightings` (not `weights` / `scoreWeights`)
- `assignmentDefinitionKeys` (not `definitionKeys`)
- `applicableDataPoints` (not `n` / `sampleSize`)
- `AveragingResult` (not `ClassAverages` / `AnalysisResult`)
- `MetricResult` (not `Metric` / `ScoreResult`)
- `totalDataPoints` / `applicableDataPoints` (not `count` / `size` / `n`)

Avoid:

- `dataAnalysisFilter` (too generic — the orchestrator may host non-averaging analysers later)
- `weights` (ambiguous — assignment weighting vs task weighting vs criterion weighting)

The naming rule that prevents future ambiguity: a "weight" or "weighting" is always qualified — `assignmentWeighting`, `taskWeighting`, `criterionWeighting` — except inside the analyser's internal helpers where the local variable is documented in `@remarks`.

### Validation recommendation

#### Frontend (Zod schemas in `dataAnalysis.zod.ts`)

- `classIds` must be a non-empty array of non-empty strings.
- `dateRange.from` and `dateRange.to` must be valid ISO 8601 with offset; `from` must be ≤ `to`.
- `topicKeys` and `assignmentDefinitionKeys` are non-empty arrays of non-empty strings when present.
- `criterionWeightings` is a non-negative finite triple summing to `1.0` within float-drift tolerance.
- `AveragingResult.value` is `null` only when `applicableDataPoints === 0`.
- The input type for the analyser is `z.infer<typeof AnalysisFilterSchema>` and the output type is `z.infer<typeof DataAnalysisResponseSchema>`.

#### Backend (no analysis-side validation; data-assembly validation lives on the new endpoint's transport layer)

- The new full-class endpoint follows the existing `z_Api` transport-validation pattern (`src/backend/AGENTS.md` §0.1 / §0.2): parameter shape validation in the trailing-underscore handler, domain invariants in the controller.
- The new `assignment.createdAt` field is emitted as `ISO 8601 string | null`. The `#N` counter convention does NOT apply to `assignment.createdAt` (it applies to `submission.updatedAt` only).

## Feature architecture

### Placement

- **Service**: `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts` (orchestrator) and `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts` (v1 analyser).
- **Zod schemas**: `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` (filter + result types).
- **Tests**: co-located `.spec.ts` files (per AGENTS §7 / frontend §7). One for the orchestrator, one for the analyser, one for the Zod schemas.
- **Deferred** (separate work stream): `src/frontend/src/features/dataAnalysis/` for the hook, page, and Ant Design adapters.
- **Forbidden in v1**: a parallel service module outside `services/dataAnalysis/`, a wrapper layer that translates result types before the analyser emits them, any Ant Design import inside `services/dataAnalysis/`, any `callApi` import inside `services/dataAnalysis/`.

### Proposed high-level tree

```text
src/frontend/src/services/dataAnalysis/
├── dataAnalysisService.ts              # Orchestrator. Filter validation, dispatch, no state.
├── dataAnalysisService.spec.ts
├── dataAnalysis.zod.ts                 # AnalysisFilter, MetricResult, AveragingResult, etc.
├── dataAnalysis.zod.spec.ts
└── analysers/
    ├── averagingAnalyser.ts            # v1: per-student / per-task / per-class weighted averages
    └── averagingAnalyser.spec.ts

(Deferred, separate work stream)
src/frontend/src/features/dataAnalysis/
├── useDataAnalysis.ts                  # Owns React Query + transport for the new full-class endpoint
├── useDataAnalysis.spec.ts
├── DataAnalysisPage.tsx                # Thin composition root (when the page work stream begins)
└── adapters/
    ├── toChartData.ts                  # Ant Design chart shape adapters (deferred)
    └── toChartData.spec.ts
```

### Out of scope for this surface

- The hook, the page, the navigation entry, the Ant Design adapters — all deferred.
- Cohort / cross-class analysis — a future analyser work stream.
- Persistence of user-configured criterion weightings — a future "scoring profile" work stream.
- Time-series / trend / distribution analyses — future analysers.
- Visualisation of the result — a future work stream.

## Data loading and orchestration

### Required datasets or dependencies

- The pre-fetched `ClassPartial[]` (via `getABClassPartials` — already in startup warm-up per `frontend-react-query-and-prefetch.md` §4).
- The pre-fetched `AssignmentDefinitionPartial[]` (via `getAssignmentDefinitionPartials` — already in startup warm-up).
- The pre-fetched `AssignmentTopic[]` (via `getAssignmentTopics` — already in startup warm-up).
- The new **full-class endpoint (TBC)** — one call per `classId` from `classIds`. Returns the existing `ABClass.toJSON()` shape, extended with `assignment.createdAt` (planned-only field, TBC).
- A new React Query key in `src/frontend/src/query/queryKeys.ts` and a `getFullClassQueryOptions(classId)` factory in `src/frontend/src/query/sharedQueries.ts` (both in the deferred hook work stream).

### Prefetch or initialisation policy

#### Startup

- No change. The existing startup warm-up is unchanged. The new full-class dataset is **not** added to startup warm-up — analysis is on-demand only.

#### Feature entry

- The deferred `useDataAnalysis` hook fetches a full class only for the `classIds` in the current filter (not the full catalogue). It runs in parallel via React Query; the orchestrator receives the assembled data only after all queries resolve.

#### Manual refresh

- Out of scope for the service. The hook layer (deferred) owns refresh behaviour, per the existing React Query policy (`docs/developer/frontend/frontend-react-query-and-prefetch.md`).

### Query or transport additions

- **Planned-only**: a new `getABClassFull_(classId)` (or similarly named) trailing-underscore handler in `src/backend/z_Api/`, registered in `ALLOWLISTED_METHOD_HANDLERS`. The handler delegates to the existing `ABClassController.loadClass` and applies `DateUtils.normaliseDateFields` per `src/backend/AGENTS.md` §8.
- **Planned-only**: the new `assignment.createdAt` field on the `Assignment` model. Populated by the backend on the first `persistAssignmentRun` call (or whichever site the user decides makes sense). Once set, it does not change. Serialised in both `toJSON()` and `toPartialJSON()`.
- **Planned-only**: a new `src/frontend/src/services/dataAnalysis/` folder containing the orchestrator, the analyser, and the Zod schemas (≥ 2 files justifies a folder per AGENTS §12).

## Core view model or behavioural model

### Suggested shape

See `AveragingResultSchema`, `MetricResultSchema`, and `PerClassResultSchema` in the Recommended data shapes section above. The shape is anchored to chart/table-friendly field names so the deferred adapter layer is trivial.

### Derivation or merge rules

#### `MetricResult.value` (per metric, per group)

- For each data point `(student S, task T of assignment A, criterion C)`:
  - If `C === 'spag'` and `S_i === 'N'`: the data point does NOT contribute to the SPaG metric.
  - Otherwise: the data point contributes `score_i` with `weight_i = assignmentWeighting(A) × taskWeighting(T)`.
- `value = sum(weight_i × score_i) / sum(weight_i)` over contributing data points.
- `value === null` if and only if `applicableDataPoints === 0`.
- `totalWeight` is `sum(weight_i)` over contributing data points.
- `applicableDataPoints` is the count of data points that contributed.
- `totalDataPoints` is the count of data points in the group (per-student total, per-task total, or per-class total).

#### `MetricResult.overall` (per metric, per group)

- For each data point:
  - Compute `overall_i = (w_C × C_i + w_A × A_i + w_S × S_i) / (w_C + w_A + w_S)` (denominator shrinks when `S_i === 'N'`).
  - `overall_i` is `null` if all three criteria are unavailable for that data point (defensive — should not happen in practice).
- `overall` follows the same `value` / `totalWeight` / `applicableDataPoints` / `totalDataPoints` rules, with `applicableDataPoints` counting data points that contributed at least one criterion.
- The `overall` row uses the **same weight** as the per-criterion metrics (`assignmentWeighting × taskWeighting`).

#### `appliedCriterionWeightings`

- Echoes the actual weights the analyser used. When the caller omits `criterionWeightings`, the default `40 / 40 / 20` (normalised to sum to 1: `0.4 / 0.4 / 0.2`) is echoed. This makes the result self-describing — the page does not have to remember the default.

#### `perStudent` rows

- One row per distinct `studentId` that appears in any qualifying submission. The `studentName` is resolved from the embedded `StudentSubmission.studentName`; `null` if absent.
- A student with no qualifying submissions (e.g. all their submissions fall outside the date filter) is **excluded** from `perStudent`.

#### `perTask` rows

- One row per distinct `(definitionKey, taskId)` pair. The composite key is needed because `taskId` is not guaranteed to be unique across definitions. The `taskTitle` is resolved from the embedded `TaskDefinition.taskTitle`; `null` if absent.

#### `perClass`

- A single object with one `MetricResult` per metric (completeness, accuracy, spag, overall) over the entire class's qualifying data points.

### Sort order or priority rules

1. `perStudent` is sorted by `studentName` ascending, then `studentId` ascending as a deterministic tie-breaker.
2. `perTask` is sorted by `(definitionKey, taskId)` ascending.
3. `perClass` is not sorted (it is a single object).
4. `AveragingResult[]` is sorted by `classId` ascending.

These deterministic sort rules make the analyser's output testable without `Set` ordering non-determinism.

## Main user-facing surface specification

**Not applicable to v1.** The service has no UI surface. The page, navigation entry, and Ant Design adapter layer are a deferred work stream (see `Out of scope` above and the agreed decisions).

When the deferred page work stream begins, the surface will be guided by a future layout spec (per the `LAYOUT_SPEC_TEMPLATE.md`) built against the chart/table-friendly result shape defined here.

## Workflow specification

**Not applicable to v1.** The service is a pure function with no user-facing workflow. The workflow surface (filter UI, table interactions, drill-down) is a deferred work stream.

## Error, loading, and empty-state rules

### Blocking failure

The service throws a typed error when:

- `AnalysisFilter` fails Zod validation. The thrown value is the Zod `ZodError` (rethrown unchanged).
- A class referenced by `classIds` is missing from the input data. The hook layer is responsible for ensuring data is present; the service does not re-fetch.
- The input data violates an invariant the analyser cannot recover from (e.g. an `Assignment` with `assignmentDefinition === null` or a `TaskDefinition` with `taskWeighting === undefined`). The error message is actionable and includes the `classId` / `assignmentId` / `taskId` for debuggability.

### Partial-load or partial-success failure

The service does **not** produce partial results. If a single class's data is malformed, the analysis either succeeds (with the affected data points excluded and the sample-size fields reflecting that) or throws. There is no "best-effort" mode.

The hook layer (deferred) is responsible for catching transport errors and rendering the appropriate error surface per the React Query / frontend error-handling policy (`docs/developer/frontend/frontend-logging-and-error-handling.md`).

### Empty states

- If `perStudent` is empty, the per-class metrics are still computed (and reported as `value: null` with `applicableDataPoints: 0`).
- If `perTask` is empty, the same rule applies.
- If no class has any qualifying data points, the analyser returns an empty `AveragingResult[]`. The hook / page layer (deferred) is responsible for rendering the empty state.

## Accessibility and usability notes

- **Not applicable to v1.** No UI surface in this delivery.
- The result type's stable field names (`studentId`, `taskId`, `classId`) and the per-metric `applicableDataPoints` / `totalDataPoints` are designed to make the future page's accessibility story (tooltips, screen-reader summaries, etc.) straightforward.

## Backend changes required to support agreed behaviour

These are the **planned-only** changes. They are not part of this v1 spec's delivery; the user has confirmed they will be built in a separate preparatory work stream before this branch is revisited.

1. **New `getABClassFull_(classId)` endpoint (method name TBC).**
   - Add a trailing-underscore handler in `src/backend/z_Api/` (file placement TBC; either `abClassFull.js` or as a new method on the existing class-partials transport file).
   - Register in `ALLOWLISTED_METHOD_HANDLERS` in `z_apiHandler.js`.
   - Delegate to `ABClassController.loadClass(classId)`.
   - Apply `DateUtils.normaliseDateFields` to the response per `src/backend/AGENTS.md` §8.
   - Strip `progressTracker` from the response (defence-in-depth, per the same convention as the in-flight `getAssignment` spec).
   - Return the full `ABClass.toJSON()` shape, including `assignments[]`, `students[]`, `submissions[]`, `items[taskId].feedback[criterion]`, embedded `assignmentDefinition.tasks[taskId].taskWeighting`, and `assignmentWeighting`.
   - One Vitest suite for the new handler: parameter validation, delegation identity, defence-in-depth for date normalisation and `progressTracker` strip, error re-throw, `loadClass` re-throw.
2. **New `Assignment.createdAt` field on the `Assignment` model.**
   - Add `this.createdAt = null` to the `Assignment` constructor in `src/backend/AssignmentProcessor/Assignment.js`.
   - Set the field on the first `persistAssignmentRun` call (or whichever site the user decides makes sense). Once set, it does not change.
   - Serialise in both `toJSON()` and `toPartialJSON()` as `ISO 8601 string | null`.
   - Update `Assignment.fromJSON` to restore the field from the persisted JSON, defaulting to `null` if absent.
3. **No frontend-side Zod schema changes for the `ABClass` type itself.** The analyser's input type uses the existing `ABClass.toJSON()` shape, and the new `assignment.createdAt` field is treated as optional (`| null`) by the analyser's input type so existing tests do not need to fabricate it until the backend lands it.

## Planning handoff notes

- The deferred page work stream must:
  - Add the hook (`useDataAnalysis`) in `features/dataAnalysis/`.
  - Add the new React Query key in `src/frontend/src/query/queryKeys.ts` (factory: `dataAnalysisFullClass: (classId) => [...]`).
  - Add the shared query factory in `src/frontend/src/query/sharedQueries.ts`.
  - Add the `pages/DataAnalysisPage.tsx` composition root, the navigation entry, and the `pageContent.ts` copy.
  - Build the Ant Design adapter layer (e.g. `adapters/toChartData.ts`) using the stable field names defined here.
  - Produce a layout spec at that point (per `LAYOUT_SPEC_TEMPLATE.md`).
- The future "cohort / cross-class" analysis work stream must:
  - Add a new analyser class (e.g. `cohortAveragingAnalyser.ts`) in `src/frontend/src/services/dataAnalysis/analysers/`.
  - Register it with the orchestrator's analyser registry.
  - Not modify the existing `averagingAnalyser.ts` or `AveragingResult` shape.
- The future "scoring profile" work stream (criterion weightings persistence) must:
  - Add a new endpoint pair (e.g. `getScoringProfile_` / `setScoringProfile_`).
  - Add a `useScoringProfile` hook.
  - The analyser signature does not change — the hook resolves the profile and passes it as the `criterionWeightings` argument.
- **No `ACTION_PLAN.md` is produced for this v1 cut.** The user will return to this branch to run the `Planner Reviewer` review loop, produce `ACTION_PLAN.md`, and begin implementation once the preparatory backend endpoints are in place.

## Testing expectations

- **Analyser (Vitest, unit)**: pure-function tests against synthetic `ABClass` fixtures.
  - Empty input → empty `AveragingResult[]`.
  - Single class, single assignment, single student, single task → exact expected averages.
  - Multiple students / tasks / assignments with non-trivial weights → exact expected weighted means (use small integer weights and scores to make arithmetic exact in tests).
  - `criterionWeightings` parameter overrides the default.
  - `criterionWeightings` fails the sum-to-1 refinement → Zod error.
  - SPaG `'N'` for a formulae task → renormalised overall, `applicableDataPoints < totalDataPoints` for SPaG and overall.
  - Date range filter excludes out-of-range assignments; `createdAt === null` is excluded when a range is supplied.
  - Topic filter excludes non-matching definitions.
  - Assignment definition-key filter excludes non-matching definitions.
  - Missing `assignmentDefinition` (defensive) → typed error.
  - `appliedCriterionWeightings` is echoed correctly when the default is used and when an override is supplied.
- **Orchestrator (Vitest, unit)**: tests that the orchestrator dispatches to the registered analyser(s), validates the filter via Zod, and returns the typed result.
- **Zod schemas (Vitest, unit)**: tests for the `AnalysisFilterSchema` valid / invalid cases and the `AveragingResultSchema` round-trip.
- **No Playwright tests in v1** (no UI).
- **No backend tests in v1** (the preparatory backend work is a separate work stream with its own tests).

## Documentation and rollout notes

- Update `docs/developer/DATA_SHAPES.md` with the new full-class endpoint contract once the backend lands.
- Update `docs/developer/frontend/frontend-react-query-and-prefetch.md` with the new dataset's invalidation rule once the hook exists.
- No new canonical doc is required for the analyser itself; this `DATA_ANALYSIS_SERVICE.md` is the source of truth for this delivery.
- The v1 spec is a **draft**; the user will return to this branch to update the status to `Implemented v1.0` after the backend work lands and the orchestrator + analyser are implemented.

## V1 scope recommendation

### Include in v1

- `AveragingAnalyser` (per-student / per-task / per-class weighted averages).
- `DataAnalysisService` orchestrator with analyser registration.
- `AnalysisFilter`, `MetricResult`, `AveragingResult`, and related Zod schemas in `dataAnalysis.zod.ts`.
- Vitest unit tests for the analyser, the orchestrator, and the Zod schemas.
- This `DATA_ANALYSIS_SERVICE.md`.

### Defer from v1

- The hook (`useDataAnalysis`) — deferred hook work stream.
- The page, navigation entry, and copy — deferred page work stream.
- The Ant Design adapter layer (`adapters/toChartData.ts` and friends) — deferred page work stream.
- The layout spec for the page — deferred page work stream.
- The new full-class endpoint and the `Assignment.createdAt` field — **planned-only, TBC**, the user's separate preparatory work stream.
- Cohort / cross-class analysis — future analyser work stream.
- Trend / time-series / distribution analyses — future analyser work streams.
- Persisted "scoring profile" (configurable criterion weightings via UI) — future work stream.
- The `Planner Reviewer` review of this spec, the `ACTION_PLAN.md`, and the implementation — deferred to the user's return to this branch.

## Open questions

None. All material questions were settled during planning. The only unresolved item is the **planned-only / TBC** backend work, which is owned by the user and explicitly out of scope for this v1 spec.
