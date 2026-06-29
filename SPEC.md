# Data Analysis Service Specification

## Status

- **Implemented v1.0** (all sections delivered: backend `toPartialJSON()` extension, `StudentSubmissionPartialSchema` fix, `AssignmentDefinitionPartialSchema` unification, shared `TaskPartialSchema`, `dataAnalysis.zod.ts`, `AveragingAnalyser`, `DataAnalysisService` orchestrator, teacher-facing scoring documentation.)
- Draft v1.5 (updated 2026-06-19 — reconciled two deferred divergences into v1 scope: fixed the `StudentSubmissionPartialSchema` in `classDetailService.zod.ts` (correct nested dictionary shape replacing the flat buggy one); unified `AssignmentDefinitionPartialSchema` into a single canonical schema in `assignmentDefinitionPartials.zod.ts` (removed the duplicate lenient copy in `classDetailService.zod.ts`). All production consumers verified — zero consumers of the buggy flat submission schema; the duplicate definition schema has a known, small consumer set that is updated in-line. The analyser's input schemas are simplified to import shapes from the now-correct `classDetailService.zod.ts` and the canonical `assignmentDefinitionPartials.zod.ts` instead of defining their own.)
- Draft v1.4 (updated 2026-06-19 — simplified per planner-reviewer feedback: removed the planned `AssignmentDefinitionPartialExtendedSchema`; the analyser's `assignmentDefinitionPartials` input reuses the existing `AssignmentDefinitionPartialsResponseSchema`; renamed `TaskWeightingSummarySchema` to `TaskPartialSchema`; extracted `TaskPartialSchema` to a small shared file in the `assignmentDefinition/` domain so the two downstream partial Zod files do not have to invert the data-load layering; dateRange validation reuses the existing strict ISO-with-timezone schema; deployment is assumed to be atomic — both the backend and frontend ship in a single release, so there is no production window requiring a temporary union type that accepts both the old `null` and the new `Array<TaskPartial>` shapes).
- Draft v1.3 (updated 2026-06-19 — added teacher-facing algorithm documentation requirement: `docs/pedagogy/data-analysis-scoring.md` with required topics, location, integration point, and ownership).
- Draft v1.2 (updated 2026-06-19 — reviewed and cleaned up: eliminated duplicate AssignmentDefinitionPartial schema, reordered TaskWeightingSummarySchema before consumers, removed empty Open Questions section).
- v1.1 (updated 2026-06-19 — corrected against verified codebase state).
- v1.0 was released 2026-06-15 for hand-off during preparatory backend work. v1.1 corrects inaccuracies discovered during implementation-readiness verification: `assignment.createdAt` already exists; `taskWeighting` is not in the partial shape; the existing `getABClass` endpoint is used instead of a planned new full-class endpoint; `AssignmentDefinitionPartial.tasks` is extended to carry lightweight task-weighting summaries; the analyser input type is updated to accept the partial shape + pre-fetched partials cross-reference.
- The previous repository-root `SPEC.md`/`ACTION_PLAN.md` for the `getAssignment` read endpoint and `AssignmentNotFoundError` were superseded by PR #256 and are no longer in the working tree. This document is the source of truth for the Data Analysis Service.

## Purpose

This document defines the intended behaviour for the **frontend Data Analysis Service** — a modular, pure analysis layer that processes assessment data from `ABClass` instances (sourced via the existing `getABClass` endpoint) and emits pure-domain result types in readiness for future display.

The feature will be used to:

- Compute weighted averages for completeness, accuracy, SPaG, and a configurable overall metric per student, per task, and per class, scoped to one or more `ABClass` instances.
- Filter the underlying data by date range, topic key(s), and assignment definition key(s).
- Form the foundation for a future family of analyses (cohort, trend, distribution, comparison, etc.) added as plug-in analysers without changing the existing contract.

This feature is **not** intended to:

- Render data, choose Ant Design components, or own any UI behaviour. (That work is a separate, deferred work stream.)
- Compute or persist any data on the backend. (The analysis maths is on the frontend.)
- Mutate any backend state. (The service is read-only.)
- Replace or modify the existing `getABClass` or `getAssignment` read endpoints.
- Define a future "cohort" or cross-class analysis (deferred to a future analyser / work stream).
- Persist user-configured criterion weightings (deferred to a future "scoring profile" work stream).

## Agreed product decisions

(All decisions locked during planning rounds 1 and 2, 2026-06-15. Updated in v1.1 per codebase verification. Updated 2026-06-29 with M3 matched-flow stale-recovery decision.)

1. The Data Analysis Service is a **pure analysis layer**. It performs no transport, owns no React Query state, and does not import Ant Design. The hook layer in a future `features/dataAnalysis/` directory will own data fetching and feed pre-fetched data to the service.
2. The service is organised as an **orchestrator + pluggable analysers** (strategy pattern). The v1 analyser is `AveragingAnalyser`. New analyses are added by writing a new analyser class and registering it with the orchestrator; the existing analyser contract and `AveragingResult` shape are not modified.
3. The orchestrator (`DataAnalysisService`) is a thin module that owns filter validation, dispatches to one or more registered analysers, and returns their typed results. It has no state.
4. The analyser contract is: `analyse(input) → output` where `input` is a fully-assembled, already-fetched dataset (`ABClass` instances sourced via `getABClass`, pre-fetched `AssignmentDefinitionPartialsResponse` for task weightings, filter) and `output` is a pure-domain typed result. The analyser is pure and synchronous.
5. The data source is the **existing `getABClass` endpoint** (`ALLOWLISTED_METHOD_HANDLERS.getABClass`), which returns the `ABClass` read-view shape with partial assignments. The frontend does the maths. The endpoint is a read-only data-assembly wrapper that delegates to `ABClassController.readClass`; it does not implement any analysis. No new backend endpoint is required.
6. The `ABClass` data shape used by this service is the existing read-view shape returned by `getABClass` (produced by `ABClassController.readClass` → `ABClassResponseMapper._toReadView`). Each assignment is serialised via `Assignment.toPartialJSON()`, which includes `assignment.createdAt` (already implemented — sourced from `courseWork.creationTime` via `fetchAssignmentName()`), `submissions` (with `items[taskId].assessments[criterion].score`), and an embedded `assignmentDefinition` partial (with `assignmentWeighting` and `tasks: Array<TaskPartial>` after the backend extension). See Current data-shape constraints.
7. The per-data-point weight is `assignmentWeighting × taskWeighting`. `assignmentWeighting` is sourced from the embedded `assignment.assignmentDefinition.assignmentWeighting` in the partial data. `taskWeighting` is **not** present in the partial assignment's embedded definition (which carries the lightweight `tasks: Array<TaskPartial>`); it is instead sourced from the pre-fetched `AssignmentDefinitionPartialsResponse` collection, which after the backend extension also carries the same `tasks: Array<TaskPartial>` shape. Both downstream partial Zod schemas (`assignmentDefinitionPartials.zod.ts` and `classDetailService.zod.ts`) are updated in place to use the new shape. The analyser's input contract treats a `null` `assignmentWeighting` as `1` (the backend's constructor default) and a missing `taskWeighting` as `1` (the backend's constructor default), matching the backend constructors in `src/backend/Models/AssignmentDefinition.js` and `src/backend/Models/TaskDefinition.js`. This is the only place defaults are applied, per AGENTS §3.12 / frontend §11.
8. Criterion weightings are `{ completeness, accuracy, spag }`, defaulting to `40 / 40 / 20` (i.e. `0.4 / 0.4 / 0.2`), overridable via an optional analyser parameter. Validated by Zod: non-negative, finite, sum to `1.0` within a small float-drift tolerance (`1e-9`). The defaults are set in the analyser constructor only.
9. The "overall" metric is computed as the **renormalised weighted mean of available criteria per data point**: `overall_i = (w_C × C_i + w_A × A_i + w_S × S_i) / (w_C + w_A + w_S)`. When `S_i` is `'N'` (formulae tasks), the denominator shrinks to `w_C + w_A`. The data point's contribution to the per-criterion metrics is governed by the standard `applicableDataPoints` rule.
10. SPaG `'N'` is handled by **renormalisation, not exclusion**. Each metric result includes `value`, `totalWeight`, `applicableDataPoints`, and `totalDataPoints` so the page can render honest sample-size context (e.g. tooltips) without ambiguity.
11. The filter contract supports:
    - `classIds: string[]` — required. The classes to analyse. Sourced from the pre-fetched `getABClassPartials`.
    - `dateRange?: { from: ISO 8601 string, to: ISO 8601 string }` — optional. Filter assignments by `assignment.createdAt`. `from` is inclusive, `to` is exclusive. `createdAt` is a required ISO 8601 string on the wire (never `null` for persisted assignments).
    - `topicKeys?: string[]` — optional. Match against `assignment.assignmentDefinition.primaryTopicKey` only. `alternateTopics` are not consulted (the embedded `primaryTopicKey` already normalises Classroom-stored variants).
    - `assignmentDefinitionKeys?: string[]` — optional. Match against `assignment.assignmentDefinition.definitionKey`. `undefined` or `[]` means "no assignment filter".
12. The result shape is **per-class** (`AveragingResult[]` indexed by `classId`), each containing per-student / per-task / per-class breakdowns. Cross-class / cohort analysis is a separate, future analyser.
13. No layout spec, no page, no Ant Design adapter, no UI work in v1. The page and the chart/table adapter module are a separate work stream. This service emits stable, chart/table-friendly field names (`studentId`, `taskId`, `classId`, numeric criterion values) so the future adapter layer is trivial.
14. **Matched-flow `DEFINITION_STALE` recovery (M3).** When `startAssessmentRun` rejects with `DEFINITION_STALE` from either the matched flow or the link flow, the `AssessTaskModal` transitions to the wizard's `'creating'` state to let the user re-derive the stale definition. Both flows invalidate the assignment definition partials cache before the transition. (Added 2026-06-29 per `ACTION_PLAN.md` Section 7.)

## Existing system constraints

### Backend or API constraints already in place

- `ALLOWLISTED_METHOD_HANDLERS` in `src/backend/z_Api/z_apiHandler.js` already exposes `getABClass` (delegates to `getABClass_` in `abclass/abclassRead.js`), `getABClassPartials`, `getAssignmentDefinitionPartials`, `getAssignmentDefinition`, `getAssignment`, `getAssignmentTopics`, and the standard reference-data and config endpoints. **No new endpoint is required** — the existing `getABClass` provides the data shape the analyser needs.
- `getGoogleClassroomAssignments(classId)` returns only `{ assignmentId, title, topicId, topicName }` metadata. It is **not** a substitute for `getABClass` and does not return assessment data.
- Backend transport prohibits live `Date` objects in return values (per `src/backend/AGENTS.md` §8 and `src/frontend/AGENTS.md` §4.3). All timestamps on the wire are ISO 8601 strings. This is why the analyser's `dateRange` field uses the same strict ISO-with-timezone string validation as the rest of the data-load layer, not Zod's `z.string().datetime({ offset: true })` helper.
- The `submission.updatedAt` field has a `#N` counter suffix for monotonicity. The analyser **does not** consume `submission.updatedAt` for v1 date filtering (the date filter is against `assignment.createdAt`, which is never given the counter suffix), but the analyser must remain tolerant of the suffix in any future change that does consult it.

### Current data-shape constraints

- The `ABClass` model (`src/backend/Models/ABClass.js`) already includes `students` and `assignments` in its full `toJSON()`. The existing `getABClass` endpoint returns the read-view shape via `ABClassResponseMapper._toReadView`, which calls `assignment.toPartialJSON()` on each assignment instance and strips `_hydrationLevel` / `progressTracker`.
- `Assignment.toPartialJSON()` (`src/backend/AssignmentProcessor/Assignment.js:116-134`) emits:
  - `courseId`, `assignmentId`, `assignmentName`, `dueDate`, `lastUpdated`, `createdAt`
  - `documentType` (from `_extractPartialRootFields` — the only definition-root field included in the partial)
  - `submissions` (array of `StudentSubmission.toPartialJSON()`, see below)
  - `assignmentDefinition` (from `AssignmentDefinition.toPartialJSON()`, see below)
- `AssignmentDefinition.toPartialJSON()` (`src/backend/Models/AssignmentDefinition.js:320-338`) emits all metadata fields **including `assignmentWeighting`**, and after the §1 backend extension also emits `tasks: Array<TaskPartial>` (where `TaskPartial = { id: string, taskWeighting: number }`). The extension replaces the current `tasks: null` literal in the partial — see Backend changes required §1.
- `StudentSubmission.toPartialJSON()` (`src/backend/Models/StudentSubmission.js:330-336`) emits:
  - `studentId`, `studentName`, `assignmentId`, `documentId`
  - `items: { [taskId]: StudentSubmissionItem.toPartialJSON() }` — a **dictionary** keyed by `taskId` (the `TaskDefinition.id`, a stable `t_`-prefixed hash)
  - `createdAt`, `updatedAt`
- `StudentSubmissionItem.toPartialJSON()` (`src/backend/Models/StudentSubmission.js:121-126`) emits:
  - `id`, `taskId`, `artifact` (partial), `assessments` (with reasoning stripped), `feedback`
  - `assessments` is a dictionary keyed by criterion (`completeness` | `accuracy` | `spag`), each value being `{ score }` (reasoning stripped in partial). SPaG `score` may be `'N'` for formulae tasks.
- The existing frontend `StudentSubmissionPartialSchema` in `classDetailService.zod.ts` currently models submissions as a **flat object** (a single `StudentSubmissionItem`) — a pre-existing bug that does not match the backend's nested `items` dictionary. **This is fixed in v1** — the schema is replaced with the correct nested-dictionary shape matching the wire. No production consumers rely on the buggy flat shape (verified via codebase search), so this is a safe breaking change scoped to test-fixture updates. The analyser then imports the corrected schema from `classDetailService.zod.ts` rather than defining its own.
- `AssignmentDefinitionPartial` (`src/frontend/src/services/assignmentDefinition/assignmentDefinitionPartials.zod.ts:184-204`) is the **single canonical schema** for the partial-definition wire shape. It carries `primaryTopic`, `primaryTopicKey`, `alternateTopics` and all metadata fields. **The duplicate lenient copy in `classDetailService.zod.ts` is removed in v1** — the `classDetailService.zod.ts` `AssignmentPartialSchema.assignmentDefinition` field imports the canonical schema. To make this unification safe, `referenceDocumentId` and `templateDocumentId` are made `.nullable()` in the canonical schema (the backend `AssignmentDefinition.toPartialJSON()` passes through instance values that can be null, and the test suite at `classDetailService.zod.spec.ts` documents that `getABClass` can return null for these fields). The two affected feature consumers (`matchDefinitionForAssignment.ts` and `getLinkableDefinitionsForModal.ts`) already access these fields and are updated to handle `string | null` types. After the §1 backend extension, the canonical `tasks` field carries `Array<TaskPartial>`.
- `AssignmentTopic` (`src/frontend/src/services/referenceData/referenceData.zod.ts:114-124`) is separate reference data, keyed by `key`. The page is expected to resolve user-visible topic names to keys before calling the analyser.
- `assignment.createdAt` is **already fully implemented**. It is set during `Assignment` construction via `fetchAssignmentName()` from `courseWork.creationTime` (Google Classroom creation time). It is serialised in both `toJSON()` and `toPartialJSON()` as a required `string` (ISO 8601). The `_baseFromJSON` deserializer throws if `createdAt` is missing. The semantics are "the Google Classroom creation time for the assignment", **not** "the timestamp at which the first assessment run was triggered".

### Frontend or consumer architecture constraints

- Per `src/frontend/AGENTS.md` §2.2, async orchestration and side effects live in feature hooks; service modules own transport and validation; components delegate to hooks. The `DataAnalysisService` is therefore a pure-analysis module — no `callApi` — and the future `useDataAnalysis` hook in `features/dataAnalysis/` will own the React Query + transport work.
- Per `src/frontend/AGENTS.md` §12, the natural home for this service is `src/frontend/src/services/dataAnalysis/` (≥ 2 files justifies a folder per AGENTS §12).
- Per `src/frontend/AGENTS.md` §8, all schemas are Zod-first; types via `z.infer`; `.strict()` on objects; `z.void().nullable()` for void responses (none expected in v1).
- Per `src/frontend/AGENTS.md` §11 (and AGENTS.md §11), default values are set in the analyser constructor only.
- The "first reusable, second-extract, third-create" helper rule applies: no new shared helpers are needed in v1 except the `TaskPartialSchema` (see Placement), which is the single shared helper introduced in this delivery. The orchestrator and the analyser are the only new code units beyond the schemas.

## Domain and contract recommendations

### Why this approach is preferable

- **Open/closed extension** — adding a new analysis (cohort, trend, distribution) does not modify the existing analyser or the orchestrator. The orchestrator's analyser registry is the single extension point.
- **Pure functions are trivially testable** — the analyser has no I/O, no time, no randomness beyond what is injected. TDD with synthetic `ABClass` fixtures is straightforward and the tests run in milliseconds.
- **No coupling to Ant Design** — the result type uses stable, generic field names. The future adapter layer is a thin `toChartData(result)`-style function and can be swapped or rewritten without touching the service.

### Recommended data shapes

#### `TaskPartialSchema` (shared, in `taskPartial.zod.ts`)

The lightweight task-weighting summary emitted by the extended `AssignmentDefinition.toPartialJSON()` (see Backend changes required §1). Lives in `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts` as a shared helper imported by the two downstream partial Zod files (`assignmentDefinitionPartials.zod.ts`, `classDetailService.zod.ts`) and by the analyser's schemas.

```ts
import { z } from 'zod';

export const TaskPartialSchema = z
  .object({
    id: z.string().min(1), // stable TaskDefinition.id (t_-prefixed hash, never empty)
    taskWeighting: z.number(), // no range enforced at the wire-schema level; range enforcement is the analyser's job
  })
  .strict();

export type TaskPartial = z.infer<typeof TaskPartialSchema>;
```

#### Analyser input type (`AveragingAnalyserInput`)

The analyser receives three things: the ABClass data, the pre-fetched `AssignmentDefinitionPartialsResponse` (for task weightings), and the filter. The `assignmentDefinitionPartials` field reuses the existing `AssignmentDefinitionPartialsResponseSchema` from `assignmentDefinitionPartials.zod.ts` so there is one source of truth for the partial wire shape.

The analyser does **not** define its own submission/assignment shapes. After the v1.5 reconciliation of the two deferred divergences (see Status), `classDetailService.zod.ts` carries the corrected nested `StudentSubmissionPartialSchema` and imports the canonical `AssignmentDefinitionPartialSchema`, so the analyser imports its core shapes from the existing data-load layer:

- `StudentSubmissionPartialSchema` and `StudentSubmissionItemPartialSchema` from `classDetailService.zod.ts` (now fixed to the nested-dictionary wire shape)
- `AssignmentDefinitionPartialSchema` from `assignmentDefinitionPartials.zod.ts` (single canonical schema, post-extension)
- The `ClassFullSchema` from `classDetailService.zod.ts` as the ABClass shape

The analyser wraps these in its own `AveragingAnalyserInputSchema`:

```ts
import { ClassFullSchema } from '../googleClassrooms/classDetail/classDetailService.zod';
import { AssignmentDefinitionPartialsResponseSchema } from '../assignmentDefinition/assignmentDefinitionPartials.zod';

const AveragingAnalyserInputSchema = z
  .object({
    classes: z.array(ClassFullSchema),
    assignmentDefinitionPartials: AssignmentDefinitionPartialsResponseSchema,
    filter: AnalysisFilterSchema,
  })
  .strict();
```

#### `AnalysisFilter` (Zod-first, source of truth)

The `dateRange` fields reuse the existing `IsoDateTimeWithTimezoneSchema` from `assignmentDefinitionPartials.zod.ts` so the analyser's date filter validates against the same strict `YYYY-MM-DDTHH:mm:ss.SSSZ|±HH:MM` pattern the rest of the data-load layer uses. This is consistent with the rule that `google.script.run` does not allow `Date` objects in payloads, so all dates on the wire are ISO 8601 strings.

```ts
import { IsoDateTimeWithTimezoneSchema } from '../assignmentDefinition/assignmentDefinitionPartials.zod';

const AnalysisFilterSchema = z
  .object({
    classIds: z.array(z.string().min(1)).min(1),
    dateRange: z
      .object({
        from: IsoDateTimeWithTimezoneSchema,
        to: IsoDateTimeWithTimezoneSchema,
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

#### `AveragingAnalyserInput`

The analyser's `assignmentDefinitionPartials` field reuses the existing `AssignmentDefinitionPartialsResponseSchema` from `assignmentDefinitionPartials.zod.ts` (post-extension). The `classes` field reuses the existing `ClassFullSchema` from `classDetailService.zod.ts` — the `StudentSubmissionPartialSchema` divergence has been reconciled as part of v1.5 (see Status), so the analyser does not need its own class/submission shapes.

```ts
import { AssignmentDefinitionPartialsResponseSchema } from '../assignmentDefinition/assignmentDefinitionPartials.zod';
import { ClassFullSchema } from '../googleClassrooms/classDetail/classDetailService.zod';

const AveragingAnalyserInputSchema = z
  .object({
    classes: z.array(ClassFullSchema),
    assignmentDefinitionPartials: AssignmentDefinitionPartialsResponseSchema,
    filter: AnalysisFilterSchema,
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
- `dateRange.from` and `dateRange.to` must be valid strict-ISO 8601 with timezone info and offset (reusing the imported `IsoDateTimeWithTimezoneSchema`); `from` must be ≤ `to`.
- `topicKeys` and `assignmentDefinitionKeys` are non-empty arrays of non-empty strings when present.
- `criterionWeightings` is a non-negative finite triple summing to `1.0` within float-drift tolerance.
- `AveragingResult.value` is `null` only when `applicableDataPoints === 0`.
- The input type for the analyser is `z.infer<typeof AveragingAnalyserInputSchema>` and the output type is `z.infer<typeof DataAnalysisResponseSchema>`.

#### Backend (no analysis-side validation; only the AssignmentDefinition partial extension is needed)

- The `AssignmentDefinition.toPartialJSON()` extension must include `tasks` as `Array<{ id, taskWeighting }>` (see Backend changes required).

## Feature architecture

### Placement

- **Service**: `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts` (orchestrator) and `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.ts` (v1 analyser).
- **Shared helper**: `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts` (the `TaskPartialSchema` shared by the two downstream partial Zod files and the analyser's schemas).
- **Zod schemas**: `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts` (filter + input + result types; imports `AssignmentDefinitionPartialsResponseSchema` and `IsoDateTimeWithTimezoneSchema` from the existing partials file, and `TaskPartialSchema` from the new shared file).
- **Tests**: co-located `.spec.ts` files (per AGENTS §7 / frontend §7). One for the orchestrator, one for the analyser, one for the Zod schemas, one for the shared `TaskPartialSchema`.
- **Deferred** (separate work stream): `src/frontend/src/features/dataAnalysis/` for the hook, page, and Ant Design adapters.
- **Forbidden in v1**: a parallel service module outside `services/dataAnalysis/`, a wrapper layer that translates result types before the analyser emits them, any Ant Design import inside `services/dataAnalysis/`, any `callApi` import inside `services/dataAnalysis/`, and any new "extended" partial schema that duplicates the existing `AssignmentDefinitionPartial` shape. No separate analyser-owned ABClass/submission shapes — the analyser imports from `classDetailService.zod.ts` and `assignmentDefinitionPartials.zod.ts`.

### Proposed high-level tree

```text
src/frontend/src/services/assignmentDefinition/
├── assignmentDefinition.zod.ts
├── assignmentDefinition.zod.spec.ts
├── assignmentDefinitionPartials.zod.ts        # updated: tasks: Array<TaskPartial>
├── assignmentDefinitionPartials.zod.spec.ts
├── assignmentDefinitionPartialsContract.guard.spec.ts
├── ...
├── taskPartial.zod.ts                          # NEW: shared TaskPartialSchema
└── taskPartial.zod.spec.ts                     # NEW: spec for the shared helper

src/frontend/src/services/dataAnalysis/
├── dataAnalysisService.ts              # Orchestrator. Filter validation, dispatch, no state.
├── dataAnalysisService.spec.ts
├── dataAnalysis.zod.ts                 # AnalysisFilter, AveragingAnalyserInput, AveragingResult, etc.
├── dataAnalysis.zod.spec.ts
└── analysers/
    ├── averagingAnalyser.ts            # v1: per-student / per-task / per-class weighted averages
    └── averagingAnalyser.spec.ts

(Deferred, separate work stream)
src/frontend/src/features/dataAnalysis/
├── useDataAnalysis.ts                  # Owns React Query + transport for getABClass
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
- The pre-fetched `AssignmentDefinitionPartialsResponse` (via `getAssignmentDefinitionPartials` — already in startup warm-up). After the Backend changes required §1 is implemented, this collection will carry lightweight task-weighting summaries, enabling the analyser to look up `taskWeighting` per task without additional per-definition API calls.
- The pre-fetched `AssignmentTopic[]` (via `getAssignmentTopics` — already in startup warm-up).
- The **existing `getABClass` endpoint** — one call per `classId` from `classIds`. Returns the `ABClass` read-view shape (partial assignments with submissions).
- A new React Query key in `src/frontend/src/query/queryKeys.ts` and a `getABClassFullQueryOptions(classId)` factory (both in the deferred hook work stream). **Note:** `sharedQueries.ts` does not yet exist; it is planned for the future hook work stream.

### Prefetch or initialisation policy

#### Startup

- No change. The existing startup warm-up is unchanged. The per-class `getABClass` data is **not** added to startup warm-up — analysis is on-demand only.

#### Feature entry

- The deferred `useDataAnalysis` hook fetches a class via `getABClass` only for the `classIds` in the current filter (not the full catalogue). It runs in parallel via React Query; the orchestrator receives the assembled data only after all queries resolve.

#### Manual refresh

- Out of scope for the service. The hook layer (deferred) owns refresh behaviour, per the existing React Query policy (`docs/developer/frontend/frontend-react-query-and-prefetch.md`).

### Query or transport additions

- No new backend endpoint is required. The existing `getABClass` endpoint provides the data the analyser needs.
- **Backend change required**: extend `AssignmentDefinition.toPartialJSON()` to include lightweight task-weighting summaries (see Backend changes required §1).
- **Frontend service layer**: a new `src/frontend/src/services/dataAnalysis/` folder containing the orchestrator, the analyser, and the Zod schemas (≥ 2 files justifies a folder per AGENTS §12), plus a new shared `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts` for the `TaskPartialSchema` helper.

## Core view model or behavioural model

### Suggested shape

See `AveragingResultSchema`, `MetricResultSchema`, and `PerClassResultSchema` in the Recommended data shapes section above. The shape is anchored to chart/table-friendly field names so the deferred adapter layer is trivial.

### Derivation or merge rules

#### Task weighting resolution

The analyser resolves `taskWeighting` for each task via the pre-fetched `AssignmentDefinitionPartialsResponse`:

1. For each qualifying assignment in the ABClass data, extract `assignment.assignmentDefinition.definitionKey`.
2. Look up the matching `AssignmentDefinitionPartial` from the `assignmentDefinitionPartials` input by `definitionKey`.
3. From the matching partial's `tasks` array, find the entry with `id === taskId` to obtain `taskWeighting`.
4. If no matching partial or no matching task entry is found, use `taskWeighting = 1` (the backend default). If the matching partial exists but its `tasks` array is missing or not an array (defensive — the backend extension guarantees `tasks: []` for empty cases), treat it as an empty array and fall back to `taskWeighting = 1`.
5. `assignmentWeighting` is read directly from `assignment.assignmentDefinition.assignmentWeighting` in the ABClass data, defaulting to `1` if `null`.

This cross-reference strategy avoids N+1 `getAssignmentDefinition` API calls and leverages data already present in the frontend's React Query cache. After the §1 backend extension, the embedded `assignmentDefinition.tasks` in each assignment also carries the same `Array<TaskPartial>` data. The analyser uses the **pre-fetched `assignmentDefinitionPartials` collection as the authoritative source** for task weightings, not the embedded copy — the two are expected to be consistent (both are serialised by `AssignmentDefinition.toPartialJSON()` from the same model instance), but the pre-fetched collection is the single source of truth the analyser reads from.

#### `MetricResult.value` (per metric, per group)

- For each data point `(student S, task T of assignment A, criterion C)`:
  - If `C === 'spag'` and `score === 'N'`: the data point does NOT contribute to the SPaG metric.
  - Otherwise: the data point contributes `score_i` with `weight_i = assignmentWeighting(A) × taskWeighting(T)`.
- Navigation to the score: `assignment.submissions[].items[taskId].assessments[criterion].score`.
- `value = sum(weight_i × score_i) / sum(weight_i)` over contributing data points.
- `value === null` if and only if `applicableDataPoints === 0`.
- `totalWeight` is `sum(weight_i)` over contributing data points.
- `applicableDataPoints` is the count of data points that contributed.
- `totalDataPoints` is the count of data points in the group (per-student total, per-task total, or per-class total).

#### `MetricResult.overall` (per metric, per group)

- For each data point:
  - Compute `overall_i = (w_C × C_i + w_A × A_i + w_S × S_i) / (w_C + w_A + w_S)` (denominator shrinks when `score === 'N'` for SPaG).
  - `overall_i` is `null` if all three criteria are unavailable for that data point (defensive — should not happen in practice).
- `overall` follows the same `value` / `totalWeight` / `applicableDataPoints` / `totalDataPoints` rules, with `applicableDataPoints` counting data points that contributed at least one criterion.
- The `overall` row uses the **same weight** as the per-criterion metrics (`assignmentWeighting × taskWeighting`).

#### `appliedCriterionWeightings`

- Echoes the actual weights the analyser used. When the caller omits `criterionWeightings`, the default `40 / 40 / 20` (normalised to sum to 1: `0.4 / 0.4 / 0.2`) is echoed. This makes the result self-describing — the page does not have to remember the default.

#### `perStudent` rows

- One row per distinct `studentId` that appears in any qualifying submission. The `studentName` is resolved from the embedded `StudentSubmission.studentName`; `null` if absent.
- A student with no qualifying submissions (e.g. all their submissions fall outside the date filter) is **excluded** from `perStudent`.

#### `perTask` rows

- One row per distinct `(definitionKey, taskId)` pair. The composite key is needed because `taskId` is not guaranteed to be unique across definitions. The `taskTitle` field is **always `null` in v1** because the post-extension `AssignmentDefinitionPartial` only carries `{ id, taskWeighting }` per task — there is no `taskTitle` on the wire. The field is retained in the output shape so the deferred page work stream can resolve it via a future cross-reference (e.g. per-definition full-definition lookup via `getAssignmentDefinition`) without an output-shape change. A future enhancement may add `taskTitle` to the partial.

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
- A class referenced by `classIds` is missing from the input data. The hook layer is responsible for ensuring data is present; the service does not re-fetch. Throws a plain `Error` with a message including the missing `classId`.
- The input data violates an invariant the analyser cannot recover from (e.g. an `Assignment` with `assignmentDefinition === null`). Throws a plain `Error` with an actionable message including the `classId` / `assignmentId` / `taskId` for debuggability.

### Partial-load or partial-success failure

The service does **not** produce partial results. If a single class's data is malformed, the analysis either succeeds (with the affected data points excluded and the sample-size fields reflecting that) or throws. There is no "best-effort" mode.

The hook layer (deferred) is responsible for catching transport errors and rendering the appropriate error surface per the React Query / frontend error-handling policy (`docs/developer/frontend/frontend-logging-and-error-handling.md`).

### Empty states

- If `perStudent` is empty, the per-class metrics are still computed (and reported as `value: null` with `applicableDataPoints: 0`).
- If `perTask` is empty, the same rule applies.
- If no class has any qualifying data points, the analyser returns an empty `AveragingResult[]`. The hook / page layer (deferred) is responsible for rendering the empty state.

### Matched-flow stale-recovery (M3)

When `startAssessmentRun` rejects with `DEFINITION_STALE` from the matched flow, the `AssessTaskModal` transitions `noMatchResolution` to `'creating'`, resets `assessmentState` to `'idle'`, clears the assessment error, and invalidates the assignment definition partials cache. This mirrors the existing link-flow stale-recovery behaviour so both flows provide a symmetric path to re-derive the stale definition. The cache invalidation is performed before the state transitions. (Added 2026-06-29 per `ACTION_PLAN.md` Section 7.)

## Accessibility and usability notes

- **Not applicable to v1.** No UI surface in this delivery.
- The result type's stable field names (`studentId`, `taskId`, `classId`) and the per-metric `applicableDataPoints` / `totalDataPoints` are designed to make the future page's accessibility story (tooltips, screen-reader summaries, etc.) straightforward.

## Backend changes required to support agreed behaviour

These are the **only** backend changes required. No new endpoint is needed.

1. **Extend `AssignmentDefinition.toPartialJSON()` to include lightweight task-weighting summaries.**
   - Currently, `toPartialJSON()` sets `tasks: null` (`src/backend/Models/AssignmentDefinition.js:334`).
   - Change it to emit `tasks: Array<{ id: string, taskWeighting: number }>` (a.k.a. `TaskPartial` on the frontend) — a minimal summary of each task's stable `id` (the `t_`-prefixed hash from `TaskDefinition._deriveId`) and its `taskWeighting`.
   - When `this.tasks` is `null`, `undefined`, or an empty object `{}`, emit `tasks: []` (an empty array) so the frontend Zod schema can reliably expect an array. The `!this.tasks || Object.keys(this.tasks).length === 0` check covers all three cases.
   - No other task fields (no `taskTitle`, no `pageId`, no `taskNotes`, no `taskMetadata`, no `artifacts`) are included — the partial stays intentionally lightweight.
   - This avoids the need for the analyser to make additional `getAssignmentDefinition` API calls per definition — the data is already available in the pre-fetched `AssignmentDefinitionPartialsResponse` collection.
   - One Vitest suite for the `toPartialJSON()` change: verify the task summary shape, verify no extraneous fields, verify empty-tasks and null-tasks edge cases.
   - This is a contract change to `AssignmentDefinitionPartial.tasks`. The canonical frontend `DATA_SHAPES.md` (which currently states "Partial definitions use `tasks: null`") must be updated to reflect the new `tasks: Array<{id, taskWeighting}>` shape, including removal of the "fail-fast on `tasks === null`" guidance.
2. **No changes to `Assignment.createdAt`** — it is already fully implemented (set from `courseWork.creationTime` in `fetchAssignmentName()`, serialised in both `toJSON()` and `toPartialJSON()`, required on deserialisation with a strict throw-on-missing check).
3. **No new backend endpoint** — the existing `getABClass` endpoint (registered as `getABClass` in `ALLOWLISTED_METHOD_HANDLERS`, delegating to `getABClass_` in `src/backend/z_Api/abclass/abclassRead.js`) returns the data shape the analyser needs.

## Planning handoff notes

- The deferred page work stream must:
  - Add the hook (`useDataAnalysis`) in `features/dataAnalysis/`.
  - Add a new React Query key in `src/frontend/src/query/queryKeys.ts` (factory: `dataAnalysisClass: (classId) => [...]`).
  - Add a shared query factory (in `sharedQueries.ts` or equivalent) for the `getABClass` call.
  - Add the `pages/DataAnalysisPage.tsx` composition root, the navigation entry, and the `pageContent.ts` copy.
  - Build the Ant Design adapter layer (e.g. `adapters/toChartData.ts`) using the stable field names defined here.
  - Produce a layout spec at that point (per `LAYOUT_SPEC_TEMPLATE.md`).
  - Surface the teacher-facing algorithm documentation (`docs/pedagogy/data-analysis-scoring.md`) via an info panel, help tooltip, or linked help article so teachers can understand how scores are calculated. The layout spec must account for this integration point.
- The future "cohort / cross-class" analysis work stream must:
  - Add a new analyser class (e.g. `cohortAveragingAnalyser.ts`) in `src/frontend/src/services/dataAnalysis/analysers/`.
  - Register it with the orchestrator's analyser registry.
  - Not modify the existing `averagingAnalyser.ts` or `AveragingResult` shape.
- The future "scoring profile" work stream (criterion weightings persistence) must:
  - Add a new endpoint pair (e.g. `getScoringProfile_` / `setScoringProfile_`).
  - Add a `useScoringProfile` hook.
  - The analyser signature does not change — the hook resolves the profile and passes it as the `criterionWeightings` argument.

## Testing expectations

- **Analyser (Vitest, unit)**: pure-function tests against synthetic `ABClass` fixtures (partial shape).
  - Empty input → empty `AveragingResult[]`.
  - Single class, single assignment, single student, single task → exact expected averages.
  - Multiple students / tasks / assignments with non-trivial weights → exact expected weighted means (use small integer weights and scores to make arithmetic exact in tests).
  - `criterionWeightings` parameter overrides the default.
  - `criterionWeightings` fails the sum-to-1 refinement → Zod error.
  - SPaG `'N'` for a formulae task → renormalised overall, `applicableDataPoints < totalDataPoints` for SPaG and overall.
  - Date range filter excludes out-of-range assignments (based on `assignment.createdAt`).
  - Topic filter excludes non-matching definitions.
  - Assignment definition-key filter excludes non-matching definitions.
  - Task weighting resolution from pre-fetched `AssignmentDefinitionPartialsResponse` cross-reference (including fallback to `1` when no match is found).
  - Missing `assignmentDefinition` (defensive) → typed error.
  - `appliedCriterionWeightings` is echoed correctly when the default is used and when an override is supplied.
  - `taskTitle` is `null` in v1 (the post-extension partial does not carry `taskTitle`); the resolution path is reserved for a future cross-reference enhancement. See §"Core view model or behavioural model — perTask rows" for the rationale.
- **Orchestrator (Vitest, unit)**: tests that the orchestrator dispatches to the registered analyser(s), validates the filter via Zod, and returns the typed result.
- **Zod schemas (Vitest, unit)**: tests for the `AnalysisFilterSchema` valid / invalid cases (including the strict ISO-with-timezone dateRange validation), the `AveragingAnalyserInputSchema` round-trip (using the imported `AssignmentDefinitionPartialsResponseSchema`), and the `DataAnalysisResponseSchema` round-trip.
- **Shared helper (Vitest, unit)**: tests for `TaskPartialSchema` in `taskPartial.zod.spec.ts` — valid `{ id, taskWeighting }` parses; empty string `id` fails (`.min(1)`); extra fields fail (strict); missing fields fail; non-numeric `taskWeighting` fails; out-of-range `taskWeighting` is allowed at the schema level (range enforcement is the analyser's job, not the wire schema's).
- **No Playwright tests in v1** (no UI).
- **Backend tests for `AssignmentDefinition.toPartialJSON()` extension (Vitest)**: one focused test suite verifying the task-weighting summary shape. The pre-existing test that asserted `tasks: null` (`tests/models/assignmentDefinition.test.js:171-175`) must be updated to reflect the new shape; it is expected to fail when the backend change lands (Section 1) and is fixed in the same section.

## Documentation and rollout notes

- Update `docs/developer/DATA_SHAPES.md` with the updated `AssignmentDefinitionPartial` shape once the backend lands the task-weighting extension. This includes:
  - Adding a new "Partial Task (`TaskPartial`)" entry for `{ id: string, taskWeighting: number }`, with status `Not implemented` until the backend extension ships.
  - Updating the "Partial Definition" entry to reflect the new `tasks: Array<TaskPartial>` shape (no longer `tasks: null`).
  - Removing or rewriting the line _"Partial definitions use `tasks: null` (not `undefined` or `{}`). This explicit marker enables fail-fast behavior when tasks are accessed without proper rehydration."_ — the partial-vs-full distinction is no longer encoded by `tasks === null` on the wire (the constructor-side distinction in `AssignmentDefinition._validatePartial` is unaffected, but JSON output is `[]`).
- Update `docs/developer/frontend/frontend-react-query-and-prefetch.md` with the new dataset's invalidation rule once the hook exists.
- No new canonical doc is required for the analyser itself; this `SPEC.md` is the source of truth for this delivery.
- **Teacher-facing algorithm documentation**: a standalone help-focused document must be written as part of this delivery, explaining how the averaging algorithm computes scores so that teachers can understand and trust the results. This is **not** a developer doc — it is written for teachers and must be accessible, jargon-free, and include worked examples. The document must cover at minimum:
  - What the four metrics are (completeness, accuracy, SPaG, overall) and what each measures at a high level.
  - How criterion weightings work (the default 40 / 40 / 20 split, that they can be overridden, and what the override means).
  - How assignment weighting and task weighting affect which data points carry more influence (plain-language explanation, not formula code).
  - How SPaG `'N'` (not applicable) is handled — renormalisation, not exclusion — and what `applicableDataPoints < totalDataPoints` means in practice.
  - How the overall metric is derived from the three criteria (renormalised weighted mean), with a simple worked example showing a student who has SPaG `'N'` on a formulae task.
  - What `MetricResult.value`, `totalWeight`, `applicableDataPoints`, and `totalDataPoints` mean when rendered in the future page (tooltips, cell annotations, etc.).
  - A note that cohort / cross-class, trend, and distribution analyses are planned future additions, not yet available.
  - **Location**: `docs/pedagogy/data-analysis-scoring.md` (alongside the existing pedagogical overview at `docs/pedagogy/README.md` — consistent with the repo's teacher-facing documentation convention).
  - **Integration point**: the deferred page work stream will surface this content via an info panel, help tooltip, or linked help article when the `DataAnalysisPage` is built. The spec for that work stream must reference this document as the source of truth for teacher-facing scoring explanations.
  - **Ownership**: this content is not UI copy (that lives in `pageContent.ts`); it is a durable reference document that the page work stream links to or embeds.
- The v1.4 spec is a **draft**; the status will be updated to `Implemented v1.0` after the backend extension lands, the two downstream partial Zod files are updated, the shared `TaskPartialSchema` is in place, and the orchestrator + analyser are implemented.

## V1 scope recommendation

### Include in v1

- `AveragingAnalyser` (per-student / per-task / per-class weighted averages).
- `DataAnalysisService` orchestrator with analyser registration.
- `AnalysisFilter`, `AveragingAnalyserInput`, `MetricResult`, `AveragingResult`, and related Zod schemas in `dataAnalysis.zod.ts` (importing shapes from the now-correct `classDetailService.zod.ts` and `assignmentDefinitionPartials.zod.ts` rather than defining its own).
- Shared `TaskPartialSchema` helper in `src/frontend/src/services/assignmentDefinition/taskPartial.zod.ts` (imported by `assignmentDefinitionPartials.zod.ts`, `classDetailService.zod.ts`, and `dataAnalysis.zod.ts`).
- **Fix `StudentSubmissionPartialSchema`** in `classDetailService.zod.ts`: replace the flat buggy schema with the correct nested-dictionary shape matching `StudentSubmission.toPartialJSON()` wire output. No production consumers — test-fixture updates only. The analyser imports the corrected schema instead of defining its own.
- **Unify `AssignmentDefinitionPartialSchema`**: remove the duplicate lenient copy from `classDetailService.zod.ts` and make it import the single canonical schema from `assignmentDefinitionPartials.zod.ts`. Make `referenceDocumentId` and `templateDocumentId` `.nullable()` in the canonical schema to match the backend wire. Update affected feature consumers (`matchDefinitionForAssignment.ts`, `getLinkableDefinitionsForModal.ts`) to handle `string | null`.
- Vitest unit tests for the analyser, the orchestrator, the analyser's Zod schemas, the shared `TaskPartialSchema`, and the updated downstream partial Zod schemas (including the reconciled `classDetailService.zod.ts`).
- Backend: `AssignmentDefinition.toPartialJSON()` extension to include task-weighting summaries.
- Backend: Vitest tests for the `toPartialJSON()` extension (including the rewrite of the pre-existing `tasks: null` assertion at `tests/models/assignmentDefinition.test.js:171-175`).
- Teacher-facing algorithm documentation at `docs/pedagogy/data-analysis-scoring.md` (see Documentation and rollout notes).
- `DATA_SHAPES.md` update: new `TaskPartial` entry, updated partial-definition entry, removal of the obsolete "Partial definitions use `tasks: null`" line; note the `StudentSubmissionPartialSchema` reconciliation.
- This `SPEC.md`.

### Defer from v1

- The hook (`useDataAnalysis`) — deferred hook work stream.
- The page, navigation entry, and copy — deferred page work stream.
- The Ant Design adapter layer (`adapters/toChartData.ts` and friends) — deferred page work stream.
- The layout spec for the page — deferred page work stream.
- Cohort / cross-class analysis — future analyser work stream.
- Trend / time-series / distribution analyses — future analyser work streams.
- Persisted "scoring profile" (configurable criterion weightings via UI) — future work stream.
