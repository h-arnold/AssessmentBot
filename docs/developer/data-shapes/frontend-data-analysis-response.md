# Contract: Frontend Data Analysis Response

## Status

**Implemented.** Canonical contract for the frontend-only, in-memory data-analysis response.
It has **no backend API, persistence collection, transport envelope or migration**. The ABClass
metadata lifecycle, the shared post-analysis contracts, both consumer surfaces and the
error-aware task-preview view models are implemented and described below. The attempt-baseline
analysis mode is being delivered incrementally (tracking issue: h-arnold/AssessmentBot#305):
its schema contracts (filter field, result echo and optional baseline block, task-row flag),
the analyser's baseline-mode behaviour and the heatmap column projection are implemented,
while the summary reconciliation and the Class-page mode control remain planned
(see [Attempt-baseline contract changes](#attempt-baseline-contract-changes)).

Sibling contracts:

- [Contract: AssignmentDefinition](assignment-definition.md) — owns the live
  assignment and task weighting inputs used by this derived response.
- [Contract: ABClass](abclass.md) — supplies the analysed class (including the
  required nullable `metadata` field on the read schema) and assignments.

Related frontend documents:

- [`data-analysis-architecture.md`](../frontend/data-analysis-architecture.md)

---

## Persistence

None. There is no collection, no `toJSON()`/`toPartialJSON()` serialisation, and no stored
document. Analysis results and the local execution companions below are in-memory values. Only
explicitly projected ABClass metadata crosses persistence, through the existing
[ABClass contract](abclass.md#metadata-writer-projection-and-task).

There is likewise no transport boundary: no `z_Api` handler, controller, response mapper, API
endpoint, or `ALLOWLISTED_METHOD_HANDLERS` entry for this contract. `DataAnalysisService.analyse()`
validates its input with `AveragingAnalyserInputSchema` and its derived `DataAnalysisResponse`
output with `DataAnalysisResponseSchema`. The shared API envelope documented in
[transport-envelope.md](transport-envelope.md) does not apply to this contract.

### Effective weighting

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
`z.number().nullable()`). The shared `computeEffectiveWeight` helper therefore
fails fast when the resolved effective product is negative or non-finite,
including overflow from two finite factors, before it can be recorded in
analyser contribution metadata or reach either heatmap task-column descriptor.
`AverageContributionSchema.effectiveWeight` independently enforces the same
finite, non-negative output invariant through `z.number().min(0)`. Both heatmap
adapters remain direct TypeScript projections rather than Zod parses, but their
shared weighting boundary prevents an invalid `effectiveWeight` from
escaping.

### Response shapes

### Assignment task summaries

`DataAnalysisService.analyseAssignmentSummary(input, classId, assignmentId)`
validates the existing `AveragingAnalyserInput` and returns a separate
`AssignmentSummarySchema` result from `assignmentSummary.zod.ts`. This does not
add fields to `AveragingResult` or change backend transport/persistence.

The result carries `classId`, `assignmentId`, `totalStudents`, explicit
`thresholds` (`completeness`, `accuracy`, `incompleteProportion`), `tasks`, and
all tied `mostAccurateTaskKeys` / `leastAccurateTaskKeys`.

Each task carries its definition-scoped `taskKey`, completeness counts
(`completedCount`, `belowThresholdCount`, `notAttemptedCount`,
`completenessErrorCount`), `incompleteAcrossMostStudents`, nullable
`accuracyAverage`, accuracy counts (`accuracyAssessedCount`,
`accuracyNotAttemptedCount`, `accuracyErrorCount`), and
`belowAccuracyThreshold`. Counts describe the class roster, not raw observation
counts. Each criterion partitions the roster; missing cells follow the existing
heatmap N rule. Errors remain separate from N and numeric zero.

This call deliberately summarises the complete requested assignment and roster,
independently of the input's global averaging filters. It isolates that
assignment before reusing `AveragingAnalyser`, preventing shared-definition
assignments from being mixed in the summary. It averages numeric per-student
display scores equally, including zero-weight evidence, rather than returning a
weighted assignment grade. No numeric evidence yields `accuracyAverage: null`.
Ranking and threshold checks use unrounded values; the adaptor formats averages
to two decimal places. The constructor's first-version policy is completeness
at least 4 points out of 5, accuracy strictly below 3 points out of 5, and
incompleteness strictly above 50%. `completedCount` counts students meeting the
completeness threshold; it does not imply that their tasks are fully completed.

Presentation lives in `assignmentSummaryAdapter.ts` and
`features/taskHeatmap/TaskHeatmapSummaryCards.tsx`; see
the [single-assignment presentation flow](../frontend/data-analysis-architecture.md#single-assignment-summaries-277).

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
within a `1e-9` float-drift tolerance).

`classes` is `z.array(ClassFullSchema)`, so each analysed class now requires the
shared nullable `ABClassMetadataSchema` owned by
[Contract: ABClass](abclass.md). The analyser does not read metadata: analysis
scores and derived outputs are unchanged. Legacy backend absence arrives as
explicit `null`; a missing or malformed metadata field fails input validation
rather than being stripped. `dataAnalysis.zod.ts` itself is unchanged; the
stricter class input comes from `ClassFullSchema`. Its unrelated unknown-field
stripping is unchanged, as is the separate nullable not-found response wrapper.
These input shapes are documented here only for boundary completeness; the
zero-weight feature did not change them. The required metadata field is the
later ABClass read-contract adoption, not part of that feature.

### ABClass mutation boundary

Frontend strict request schemas and queued `upsertABClass` / `updateABClass`
services under `services/abClass/`; their fields and omission/null/whole-replacement semantics
are owned by [Contract: ABClass — mutation schemas and queued services](abclass.md#mutation-schemas-and-queued-services).
The wrappers validate before the shared `CLASSES_BULK_MUTATION_JOB_NAME`
(`classesBulkMutation`) enqueue and parse real
`ClassPartialSchema` responses.

`cohortKey` and `yearGroupKey` are required non-null strings in the frontend request schema,
matching the unchanged backend required-parameter guard. Null rejects before enqueue;
read/response keys and optional update keys remain nullable. Optional whole `metadata`
replacement remains nullable on both mutations.

This changes no analyser input/output shape and does not persist analysis automatically.
`DataAnalysisService` is unchanged, synchronous and I/O-free.
`runApiQueuedTask` in the actual queue owner `services/api/apiQueue.ts` accepts a local callback,
not wire data; no callback/context transport schema is introduced here. Actual transport stays
in `services/apiService.ts`, with direct-owner imports and no facade/barrel.

### Metadata refresh execution contracts

These are local TypeScript execution contracts, **not** API requests/responses or additions
to `DataAnalysisResponseSchema`. The shared lifecycle validates its context and serialisable
outcome data through `postAnalysis.zod.ts`
(see [Shared post-analysis lifecycle](#shared-post-analysis-lifecycle)).
Existing class, definition, analysis and metadata schemas retain their own validation boundaries.
Callbacks and Errors never become wire data.

| Type / actual owner                                                                                                             | Field                          | Type                                          | Notes                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PostAnalysisContext` — `services/dataAnalysis/postAnalysis/postAnalysis.zod.ts`; consumed directly by `refreshABClassMetadata` | `classFull`                    | `ClassFull`                                   | Complete validated class, never a Heatmaps selection or display slice.                                                                                                   |
| Same                                                                                                                            | `assignmentDefinitionPartials` | `AssignmentDefinitionPartial[]`               | Live registry used for recalculation.                                                                                                                                    |
| Same                                                                                                                            | `averagingResult`              | `AveragingResult`                             | Successful validated analysis authorises invocation; this field is not read or reparsed by the task, nor persisted as class scores. Caller supplies the trusted context. |
| `MetadataRefreshInput` — `services/abClass/abClassMetadataService.ts`                                                           | `classId`                      | `string`                                      | Identity for authoritative fresh read.                                                                                                                                   |
| Same                                                                                                                            | `assignmentDefinitionPartials` | `AssignmentDefinitionPartial[]`               | Every fresh class assignment must resolve before calculation.                                                                                                            |
| `MetadataRefreshSkipped` — `services/dataAnalysis/postAnalysis/metadataProjection.ts`                                           | `status`                       | `'skipped'`                                   | Shared no-op variant.                                                                                                                                                    |
| Same                                                                                                                            | `reason`                       | `'noAssignments'\|'unchanged'\|'staleSource'` | Empty assignments, matching source version, or source older than stored history; the tuple is compile-time pinned to `MetadataRefreshSkipped['reason']`.                 |
| `MetadataRefreshDecision` — same projection owner, changed variant                                                              | `status`                       | `'changed'`                                   | Union alternative to `MetadataRefreshSkipped`.                                                                                                                           |
| Same                                                                                                                            | `target`                       | `AssignmentPartial`                           | Newest assignment instance after all candidate timestamps validate; selected object, not a detached wire snapshot.                                                       |
| `RefreshOutcome` — `services/abClass/abClassMetadataService.ts`, saved variant                                                  | `status`                       | `'saved'`                                     | Union alternative to `MetadataRefreshSkipped`.                                                                                                                           |
| Same                                                                                                                            | `confirmedPersistence`         | `true`                                        | Returned only after successful update and real partial-response parsing; no query refresh has occurred.                                                                  |
| Same                                                                                                                            | `classPartial`                 | `ClassPartial`                                | `parseApiResponse(ClassPartialSchema, 'updateABClass', data)` output, including required nullable metadata.                                                              |

`refreshABClassMetadata(context: PostAnalysisContext, now: () => string)` consumes the shared
lifecycle type directly and declares no task-local context type. It passes `classFull` to the
cheap freshness gate and forwards `assignmentDefinitionPartials` plus the class identity to the
reserved-slot writer, which re-reads and recomputes from the complete unsliced class.
`averagingResult` authorises invocation but is never reparsed or persisted as display scores.

Exact unions:

```ts
type MetadataRefreshDecision =
  MetadataRefreshSkipped | { status: 'changed'; target: AssignmentPartial };

type RefreshOutcome =
  | MetadataRefreshSkipped
  | { status: 'saved'; confirmedPersistence: true; classPartial: ClassPartial };
```

`refreshABClassMetadata(context, now: () => string): Promise<RefreshOutcome>` performs
the cheap complete-class timestamp gate before enqueueing.
`refreshABClassMetadataInQueue(input, now: () => string): Promise<RefreshOutcome>` owns
the full `CLASSES_BULK_MUTATION_JOB_NAME` (`classesBulkMutation`) reservation: fresh validated
read → target/freshness recheck → all-assignment live-definition coverage → full-class and
isolated-target analysis → detached rolling merge → validated whole update → real
partial-response parse. The lane constant is exported once from `abClassMutationService.ts` and
imported by `abClassMetadataService.ts`, so both queued mutation wrappers and the reserved-slot
writer share one lane symbol; no import cycle exists. The queue, transport, projection and
persistence owners are imported directly, without a facade or second queue.

No-op decisions make no calculation/write/clock call; the cheap gate also makes no network
call. Every candidate partial timestamp must be canonical UTC; selection is timestamp
descending then assignment ID ascending via `localeCompare`. Equal stored ID/timestamp
returns `unchanged` first; otherwise older than its matching entry or any stored recent entry
returns `staleSource`. Equal timestamps on different IDs remain eligible. This intentionally
does not refresh after score/weighting/definition/roster-only changes. The three task-owned
reasons are compile-time pinned in `postAnalysis.zod.ts`: `SKIPPED_REASONS` is declared with
`satisfies readonly MetadataRefreshSkipped['reason'][]`, and its single tuple feeds the skipped
result enum reused by both task-result and outcome schemas. Reason drift therefore fails
compilation instead of turning a legitimate no-op into a lifecycle parse failure.

The successful display result is never the persistence oracle. Both calculations use the
unchanged synchronous service with only `{ classIds: [classId] }` as filter and the
constructor's standard 0.4/0.4/0.2 criterion weights. The second class copy contains only the
target assignment instance, preventing definition-scoped task keys from merging another
instance into its summary. Both project all four weighted `perClass` metrics, including
`overall`, through `projectAverageScores()`:

| `MetricResult.state` | Metadata `AverageScore`   | Notes                                                                                         |
| -------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `computed`           | `metric.value` (`number`) | Preserve zero and fractions without rounding; shared metadata validation requires finite 0–5. |
| `notAttempted`       | `'N'`                     | Never substitute zero.                                                                        |
| `error`              | `'E'`                     | Distinct from N and excluded.                                                                 |
| `excluded`           | `'excluded'`              | Explicit mapping from the analyser's `value: null`; metadata metric null is invalid.          |

The exact source timestamp, summary clock, stable immutable rolling-three merge and
`{ classId, metadata }` update are owned by
[ABClass — implemented writer](abclass.md#metadata-writer-projection-and-task).
The rolling merge validates through the non-nullable `NonNullableABClassMetadataSchema` and
returns `NonNullable<ABClassMetadata>`, so the write path has no nullable-union branch;
`UpdateABClassRequestSchema` validates the whole replacement. The nullable read/request
contract is unchanged, and no nested validation rules are duplicated in the writer.

Failures reject rather than returning a `failed` outcome: calculation/validation/read/write
failures propagate, not-found is not an upsert, and there is no repair/rollback/per-feature
retry. Existing analyser failures (including null student-name invariants) remain failures;
corpus calculation-capability limits do not change production shapes or authorise repairs.
The shared runner now catches these rejections as individual failed outcomes, separately from
the unchanged task's `RefreshOutcome` union. No query/cache access, invalidation, warning or
automatic surface invocation exists in these three owners. `confirmedPersistence` is not query-refresh success; a response-parse
failure can reject after a backend write without producing the saved variant.

Helper discovery/status is owned by
[Frontend shared helpers](../frontend/frontend-shared-helpers-and-abstraction-standards.md#928-frontend-abclass-metadata-and-post-analysis-frontend-abclass-metadata).

### Shared post-analysis lifecycle

This extends only frontend in-memory validation/execution; backend shapes and analyser output
are unchanged.

#### Validated context

Owner: `services/dataAnalysis/postAnalysis/postAnalysis.zod.ts` →
`PostAnalysisContextSchema`; `PostAnalysisContext` derives with `z.infer`.

| Field                          | Type                            | Frontend Zod                                 | Notes                                                                                                                                          |
| ------------------------------ | ------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `classFull`                    | `ClassFull`                     | `ClassFullSchema`                            | Required complete unsliced source class, including required nullable metadata. Completeness is caller-owned, not provable from array contents. |
| `assignmentDefinitionPartials` | `AssignmentDefinitionPartial[]` | `AssignmentDefinitionPartialsResponseSchema` | Required live definitions; the metadata writer separately checks all-assignment coverage.                                                      |
| `averagingResult`              | `AveragingResult`               | `AveragingResultSchema`                      | Required successful validated display result; may be selected/filtered and is never the persistence oracle.                                    |

The outer `z.strictObject` rejects extra keys and refines equality of
`classFull.classId` and `averagingResult.classId`. Missing/null inputs reject; parsing
copies schema-owned nested data. Nested owners retain their existing strict/strip rules;
this is not metadata-style raw-prototype validation. The hook parses non-null context
after commit before any task starts. The runner accepts a trusted typed context and does
not independently parse it. Invalid context or descriptor-list validation rejects the lifecycle
boundary, not an individual task. Passing `null` to the hook explicitly requests no work and clears
published outcomes; it is not a nullable member of `PostAnalysisContextSchema`. A `null`
context for the unchanged `selectedClassId` indicates analysis readiness only, not class
departure: it clears published outcomes but leaves feedback ownership and a pending
same-class attempt intact. The metadata refresh task consumes this shared type directly and
declares no narrowed context (see
[Metadata refresh execution contracts](#metadata-refresh-execution-contracts)).

#### Serialisable outcome data

Same schema owner → `PostAnalysisTaskOutcomeDataSchema`, a
`z.discriminatedUnion('status', ...)` of strict objects; inferred type
`PostAnalysisTaskOutcomeData`. **Serialisable does not mean wire data:** none is sent to GAS.

| Field                  | Type                                          | Frontend Zod                 | Notes                                                                                                                                                                   |
| ---------------------- | --------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `taskId`               | `string`                                      | `z.string().min(1)`          | Required in every variant; no trimming or identifier-safety refinement.                                                                                                 |
| `status`               | `'pending'\|'succeeded'\|'skipped'\|'failed'` | Respective `z.literal(...)`  | Required discriminator; `saved` remains a writer-only status.                                                                                                           |
| `confirmedPersistence` | `true\|undefined`                             | `z.literal(true).optional()` | Succeeded and failed variants only; absence is valid, false/null reject. Failed may retain a confirmed save after refresh failure. No query-refresh success is implied. |
| `reason`               | `'noAssignments'\|'unchanged'\|'staleSource'` | `z.enum(SKIPPED_REASONS)`    | Required only for skipped; other variants reject it. `SKIPPED_REASONS` is the pinned tuple.                                                                             |

Pending contains exactly taskId/status; failed additionally permits optional
`confirmedPersistence: true`. No technical Error, callback, user-copy or class partial
field is accepted. The hook publishes pending with a separate null Error before awaiting
each ordered result. Task results remain strictly succeeded/skipped: the failed-data
extension does not permit a descriptor to return pending/failed.

#### Validated task results

Same schema owner → `PostAnalysisTaskResultSchema`, a strict
`z.discriminatedUnion('status', [SucceededResultSchema, SkippedResultSchema])`;
`PostAnalysisTaskResult` derives with `z.infer` and is re-exported as a type by the
runner. The outcome-data schema reuses these variants with required `taskId` added.

| Field                  | Type                                          | Frontend Zod                 | Notes                                                        |
| ---------------------- | --------------------------------------------- | ---------------------------- | ------------------------------------------------------------ |
| `status`               | `'succeeded'\|'skipped'`                      | Respective `z.literal(...)`  | Pending/failed belong to the lifecycle, never a task return. |
| `confirmedPersistence` | `true\|undefined`                             | `z.literal(true).optional()` | Succeeded only; false/null reject.                           |
| `reason`               | `'noAssignments'\|'unchanged'\|'staleSource'` | `z.enum(SKIPPED_REASONS)`    | Required for skipped only.                                   |

Results reject extra keys, including task-supplied `taskId` and technical Errors.
The runner validates the awaited result **before** constructing outcome data with
the authoritative descriptor-owned `taskId`. Returning pending/failed is a parse
failure: the runner records failed data with a non-null local Error and continues
later independent tasks. The wider outcome schema does not admit extra task-return states.

#### Local typed execution handles

Owner: `services/dataAnalysis/postAnalysis/runPostAnalysisTasks.ts`. Descriptor/function/Error
handles have **no Zod/wire representation**; the schema-derived task result above is
serialisable local data, not a function handle or wire payload.

| Contract                     | Field             | Type                                                                                        | Notes                                                                                                                                                                                |
| ---------------------------- | ----------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PostAnalysisTaskDescriptor` | `id`              | `string` (readonly)                                                                         | Task-list validation rejects empty or duplicate IDs before any task starts.                                                                                                          |
| Same                         | `run`             | `(context: PostAnalysisContext) => PostAnalysisTaskResult\|Promise<PostAnalysisTaskResult>` | Required local operation; no function enters a payload.                                                                                                                              |
| Same                         | `getAttemptKey`   | `((context: PostAnalysisContext) => string)\|undefined`                                     | Optional task-owned mount-local identity; not a global metadata freshness gate.                                                                                                      |
| `PostAnalysisTaskResult`     | `status`          | `'succeeded'\|'skipped'`                                                                    | Succeeded permits optional `confirmedPersistence?: true`; skipped requires the same three-value reason union above. Failure is thrown/rejected, not returned by this typed contract. |
| `PostAnalysisTaskOutcome`    | `data`            | `PostAnalysisTaskOutcomeData`                                                               | Parsed result plus descriptor-owned `taskId`, or runner-created failed data.                                                                                                         |
| Same                         | `error`           | `Error\|null`                                                                               | `toError` normalises failures; successful/skipped/pending outcomes have null. Technical Error stays local, not user-safe copy.                                                       |
| Hook `PostAnalysisState`     | `outcomes`        | `PostAnalysisTaskOutcome[]`                                                                 | Ordered state; constructor initialises an empty list.                                                                                                                                |
| Hook `usePostAnalysisTasks`  | `selectedClassId` | `string\|null`                                                                              | Required third argument; committed class ownership, independent of analysis readiness.                                                                                               |

`runPostAnalysisTasks(context, tasks)` takes a readonly ordered descriptor list, validates
IDs, awaits each task, validates its result before adding descriptor-owned taskId and retains each
failure without blocking later independent tasks. Throws, rejections and result-parse
failures become failed outcomes. `postAnalysisDiagnostics.ts` owns the shared bounded
diagnostic: taskId/classId, optional newest canonical source assignmentId for metadata (ordered
by the shared `compareAssignmentNewestFirst` comparator), optional `confirmedPersistence: true`
on post-save refresh failures, and available
`ApiTransportError` requestId/errorCode. No full analysis/context payload,
student/roster data or raw metadata snapshot is added to task-owned diagnostics.
Existing transport parameter/debug and bounded response-preview diagnostics are unchanged.
There is no task retry policy, dependency graph or abort handle.

`postAnalysisTasks.ts` → `createPostAnalysisTaskDescriptors(now: () => string)` returns the
stable descriptor list containing only `refreshABClassMetadata`. Creating descriptors starts no
work; the injected clock remains read only when preparing an actual changed write. The
descriptor maps writer `saved` to `{ status: 'succeeded', confirmedPersistence: true }`,
forwarding skipped results unchanged; the writer's returned `classPartial` is not included in
lifecycle outcome data. The same module exports `REFRESH_AB_CLASS_METADATA_TASK_ID` as the
single task-ID constant consumed by feedback, invalidation and diagnostics, and
`sourceVersionSignature(assignments)` as the shared raw ID/time identity, preserving
supplied values and order, used by both the metadata attempt key and the unkeyed
feedback fallback. Newest-first ordering is owned once by
`compareAssignmentNewestFirst` in `metadataProjection.ts` and applies to canonical
target selection and diagnostics, not to source serialisation.

#### Attempt identity and ownership

`hooks/usePostAnalysisTasks.ts` owns one `PostAnalysisOwner` per mount, backed by
`Map<string, Map<string | PostAnalysisContext, Promise<PostAnalysisTaskOutcome>>>`.
The hook requires three arguments: `context`, `tasks`, and `selectedClassId`
(`string | null`). The first key is task ID. Keyed tasks supply the second key; unkeyed tasks
use the **original input context object's identity**, not its freshly parsed copy. Future
tasks are therefore independent of metadata source versions.

- Metadata's key is JSON of classId plus newest target assignmentId/updatedAt, or
  `noAssignments`. It computes selection with metadata set to null, ignoring stored
  metadata, scores and live weightings. Invalid candidate timestamps instead key by
  classId and the raw assignment ID/time list in supplied order, letting the task fail
  normally without blocking independent tasks.
- Key-function failure is routed through the runner as a task failure and cached using
  input-object identity. Every settled outcome, including failure, stays cached for this
  mount; new source keys, new unkeyed context objects or a remount permit another attempt.
- Class ownership is committed by a separate `navigate(selectedClassId)` effect, not by
  `attach`; only a changed selected class (including a transition to `null`) starts a new
  feedback generation for that owner. Both production consumers pass their committed
  `classId`, so a blocking detail refetch cannot be mistaken for navigation.
- Outcomes are published incrementally as each task settles, and remain in descriptor order.
  Post-commit mount lifecycle, StrictMode reattachment and cleanup rules are owned by
  [Data Analysis Architecture § Shared post-analysis lifecycle and extension](../frontend/data-analysis-architecture.md#shared-post-analysis-lifecycle-and-extension).
- This is attempt storage, not a second server-data cache; same-version work from distinct
  mounts still relies on the writer's fresh in-lane recheck.
- Both averaging surfaces call the shared page hook `hooks/usePagePostAnalysisTasks.ts`, which
  memoises the non-null context per input set and creates the descriptor list once per mount.
  The feature hooks keep no per-feature context, descriptor list or status alias. Eligibility,
  memoisation and loop-guard semantics are owned by the same architecture section.

#### Confirmed persistence and refresh settlement

Owner: `hooks/postAnalysisInvalidation.ts` → `completePostAnalysisInvalidation`.
Only `refreshABClassMetadata` with succeeded data and `confirmedPersistence: true` proceeds
to invalidation; skipped, failed and unconfirmed outcomes pass through unchanged. The two
required invalidations (`queryKeys.abClass(classId)` and `queryKeys.classPartials()`), their
settlement handling and the no-imperative-read rule are owned by the
[query contract](../frontend/frontend-react-query-and-prefetch.md#post-analysis-metadata-invalidation);
the bounded refresh-failure diagnostic is owned by the
[logging contract](../frontend/frontend-logging-and-error-handling.md#post-analysis-metadata-failures).

If either required refresh rejects, the attempt settles as
`{ data: { taskId, status: 'failed', confirmedPersistence: true }, error }`, retaining the
first normalised refresh Error locally. Save confirmation is not withdrawn and the successful
display analysis is not replaced by this task failure. This extension affects only lifecycle
outcome data and bounded diagnostics, not task returns, writer `RefreshOutcome`, or any wire
shape.

#### Feedback ownership and safe copy

Owner: `hooks/postAnalysisFeedback.ts` → `PostAnalysisFeedback`, using the required existing
`App.useApp().notification` host. Only a mounted metadata failed outcome for the committed
selected class offers a warning; the two warning variants, their exact copy, host usage,
persistence, dismissal and diagnostic behaviour are owned by the
[logging contract](../frontend/frontend-logging-and-error-handling.md#post-analysis-metadata-failures).

Warning identity is JSON of mount-owned React `useId`, the committed selected classId, taskId
and source identity. Keyed tasks use their attempt key; the unkeyed fallback uses the raw
assignment ID/time list in supplied order. Shown-key memory lasts the mount, including after
dismissal or navigation, so same-version effect replay does not reopen a notice. Closing removes
only visible-key ownership; a committed class change/deselection and actual unmount destroy only
this owner's visible keys. Notification hosts, callback/clock handles, React mount IDs, Maps/Sets
and technical Errors stay local and have no serialised persistence/transport representation.

#### Frontend test-only acceptance boundary

Browser and dispatcher acceptance coverage only. It adds no production helper or
contract, introduces **no** new execution context, outcome, request or response field, and the
lifecycle contracts above are unchanged.

- `src/frontend/e2e-tests/helpers/post-analysis-metadata-scenarios.ts` derives its inputs from
  the canonical `small` class `class-2`, starting from `metadata: null` and a historical source
  that omits only the final null-name assignment. Replacement values come from the standard
  `DataAnalysisService` full-class and isolated-target analyses with explicit metric-state
  mapping; supplied metadata scores are not used as an oracle.
- `post-analysis-metadata.persistence.spec.ts` has three journeys covering both averaging
  surfaces, a full fresh read that produces no repeat write, and a later source version that
  produces exactly one further write.
- `post-analysis-metadata.feedback.spec.ts` has eight cases: save-failure warning on standalone
  Heatmaps with keyboard dismissal and no reopening on rerender; Class-page save failure with
  analysis intact and navigation cleanup; confirmed-save refresh-failure copy; four desktop/
  narrow × light/dark containment cases; and a Class-page confirmed-save refresh-failure
  journey where the detail refresh fails while the list refresh remains deferred, proving that
  readiness-driven blocking (a `null` context for the same class) does not suppress the settled
  warning.
- The Node real-dispatcher bridge and round-trip suite are ABClass transport coverage. They
  prove frontend consumer compatibility and envelope/error propagation only: the seams supply
  prepared controller/mutation data, so they are **not** evidence that the real controller,
  persistence layer or stored-integrity validator ran. Their test-only contract is recorded in
  [Contract: ABClass — frontend test-only contracts](abclass.md#test-only-synthetic-capability).

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

| `effectiveWeight`   | `includedInAverage` | Result                          |
| ------------------- | ------------------- | ------------------------------- |
| `> 0`               | `true`              | Accepted                        |
| `> 0`               | `false`             | Rejected — contradictory        |
| `0`                 | `false`             | Accepted                        |
| `0`                 | `true`              | Rejected — contradictory        |
| `< 0`               | any                 | Rejected by `z.number().min(0)` |
| `NaN` / `±Infinity` | any                 | Rejected as non-finite          |

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

At aggregate scopes, `totalDataPoints` retains every observed numeric and raw `N`
input, including zero-weight display observations that contribute nothing to the
average. Computed and not-attempted aggregate results therefore report their
contributing observations plus any additional non-contributing observed inputs,
so `totalDataPoints` can exceed `applicableDataPoints`. The retained
observations never change the result value, `totalWeight`, `applicableDataPoints`,
or the resolved state; the overall composite is the widest case, summing
`totalDataPoints` across all three criteria even when a criterion is an error or
has zero configured weighting.

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
schemas reject it at runtime as a second boundary. Task-preview data carries
that same `TaskDisplayMetric` on its single discriminated `metric` field, so
`computed` with `null` is not representable. The no-submission override is a
separate mechanism: when `cellData` is `null`, `assembleTaskPreviewData`
substitutes the frozen `NOT_ATTEMPTED_METRIC` even when the analyser reported
`computed`, so a `computed` metric is never shown against a cell with no
submission.

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

A second presentation-only `N` shape exists on the heatmap path. The frozen,
exported `NOT_ATTEMPTED_METRIC` in `heatmapAdapter.ts` uses
`totalDataPoints: 1`. It has two consumers and is deliberately different from
the Class-page zero-data placeholder:

- `buildCellsForStudent` uses it as the fallback for a missing
  `(studentId, taskKey)` metric on a task column that is otherwise in scope, and
  reuses it directly as a `TaskDisplayMetric` across all three criteria.
- `assembleTaskPreviewData` uses it in the task-preview no-submission branch when
  `cellData` is `null`, standing in for the absent `(student, task)` submission on
  the `metric` field even when the analyser reported `computed`.
- Both consumers stand in for an absent submission or metric at task display
  scope, so the value must satisfy the task-level `notAttempted` invariant
  (`totalDataPoints >= 1`); `totalDataPoints: 1` is the schema-valid choice. The
  "intentionally different from the Class-page zero-data placeholder" reasoning
  is unchanged by the task-preview consumer.
- The Class-page placeholder represents a genuinely empty aggregate surface and
  uses `totalDataPoints: 0`, accepted only through
  `ClassPageDisplayMetricSchema`.

Neither shape is a raw analyser `N`, and neither can become `excluded`. The
`totalDataPoints` difference is intentional and must not be normalised away.

### State resolution

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

The overall composite resolves its terminal state across criteria with a positive
configured criterion weighting only. A criterion configured with zero criterion
weight is ignored by the all-error test, the positive-weight raw `N` test, and
the numeric composite, so it can never, on its own, force the overall to `error`
or `notAttempted`. Contribution metadata stays contribution-based: a computed
composite sums `totalWeight` and `applicableDataPoints` only from contributing
computed entries with positive configured weighting. `totalDataPoints` is the
exception: it sums the observed points of all three criteria on every composite
path, including non-contributing error, zero-effective-weight, and
zero-configured criteria, so the result reports every displayed observation. An
`error` or `notAttempted` composite likewise retains the summed `totalWeight` and
`totalDataPoints` across all three criteria. When a task-level composite would
resolve to `excluded`, `buildPerTaskRows` substitutes the task's display overall
so the row retains a valid narrow display state.

Recent Assignment card averages are aggregate scope. They apply this same
contribution-aware roll-up over their per-task display inputs and resolve an
all-zero-weight assignment to `excluded`, not a throw or a numeric task result.

### Heatmap projection contract

Heatmap adapters resolve `AverageContribution` from the live
assignment-definition partial and emit it on task-column descriptors. UI code
must consume that descriptor and must not derive weighting from displayed scores
or duplicate definition resolution.

| Field                       | `HeatmapTaskColumn`   | `MergedHeatmapTaskColumn` |
| --------------------------- | --------------------- | ------------------------- |
| `taskKey`                   | `string`              | `string`                  |
| `taskId`                    | `string`              | `string`                  |
| `taskTitle`                 | `string\|null`        | `string\|null`            |
| `averageContribution`       | `AverageContribution` | `AverageContribution`     |
| `includedInAttemptBaseline` | `boolean`             | `boolean`                 |
| `assignmentId`              | —                     | `string`                  |
| `definitionKey`             | —                     | `string`                  |
| `assignmentName`            | —                     | `string`                  |

`MergedHeatmapTaskColumn` is produced by spreading the shared `buildTaskColumns`
projection and adding the full assignment identity, so the contribution metadata
is inherited unchanged. `includedInAttemptBaseline` is set by the same shared
projection from the caller's baseline set: `adaptMetricsToHeatmap` derives the
set from its own result's mode echo under the Baseline narrowing rule's
fail-fast, while the merged chain passes `null` (absolute mode), so every merged
column is included. In merged heatmaps, a definition-scoped duplicate
`taskKey` has one unambiguous contribution value: duplicate columns are collapsed
by `taskKey`, and every collapsed instance shares the same definition-scoped
effective weighting.

### Task preview derived shapes

> **Status: implemented.** Both types below carry one required
> `readonly sourceUrl: string | null` field. It is resolved once in the lookup and
> carried unchanged through assembly and merge. `CellPreviewData` also carries the
> per-criterion `errors` map, and `TaskPreviewData` the selected criterion's
> `error` plus `sourceState`. None of these fields is persisted or added to any
> API request or response, so the standard
> [transport envelope](transport-envelope.md) still does not apply.

These are frontend-only derived types in the task-preview pipeline. They are
in-memory companions to the derived `DataAnalysisResponse`, not analyser output,
and are not validated by a Zod schema.

### `CellPreviewData`

Owner: `src/frontend/src/features/taskHeatmap/buildCellPreviewLookup.ts` →
`CellPreviewData`.

Derived from an `AssignmentFull` submission item's artifact and assessments:
`buildCellPreviewLookup()` transforms the payload into a
`studentId → taskKey → CellPreviewData` lookup. A discriminated union keyed on
`artifactType`, so `artifactContent` narrows with the discriminator.

```ts
type CellPreviewData = {
  [K in ArtifactType]: {
    readonly artifactType: K;
    readonly artifactContent: ArtifactContentByType<K>;
    readonly reasoning: Record<HeatmapMetricKey, string | null>;
    readonly errors: Record<HeatmapMetricKey, AssessmentError | null>;
    readonly sourceUrl: string | null;
  };
}[ArtifactType];
```

`AssessmentError` is `Extract<Assessment, { score: 'E' }>['error']`, derived from the
shared `AssessmentSchema` union so the preview cause cannot drift from the read
contract.

| #   | Field             | Type                                              | Notes                                                                                                                                                                        |
| --- | ----------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `artifactType`    | `ArtifactType`                                    | Discriminator derived from `BaseTaskArtifactSchema['type']`, so the two cannot drift.                                                                                        |
| 2   | `artifactContent` | `ArtifactContentByType<K>`                        | `TEXT`/`TABLE`/`IMAGE` → `string \| null`; `SPREADSHEET` → 2D array or `null`; `base` → `unknown`.                                                                           |
| 3   | `reasoning`       | `Record<HeatmapMetricKey, string\|null>`          | Per-metric reasoning strings; `null` when the assessment is absent for that metric.                                                                                          |
| 4   | `errors`          | `Record<HeatmapMetricKey, AssessmentError\|null>` | Per-metric cause. Every canonical criterion has an entry; an explicit `E` contributes its own `{ stage, code }`, and a numeric, `N` or absent assessment contributes `null`. |
| 5   | `sourceUrl`       | `string\|null`                                    | Editor link derived in the lookup, or `null` when the source is unavailable. Never persisted and never added to an API response.                                             |

Each criterion's cause is derived from that criterion's own validated assessment, not
from the artefact type. An assessment-only error therefore keeps its surviving source
content beside the error.

### `TaskPreviewData`

Owner: `src/frontend/src/features/taskHeatmap/TaskPreviewCard.tsx` →
`TaskPreviewData`.

Assembled by `assembleTaskPreviewData.ts` from a `CellPreviewData` (or `null`) plus
the analyser's [`TaskDisplayMetric`](#metricresult) and metric key, then consumed by
`TaskPreviewCard`. In merged heatmaps, `assembleMergedPreviewData.ts` merges
per-assignment lookups first-wins; `sourceUrl`, `reasoning` and `errors` travel with
their cell and are never re-derived during merge.

```ts
interface TaskPreviewData {
  readonly taskId: string;
  readonly artifactType: 'IMAGE' | 'TEXT' | 'TABLE';
  readonly artifactContent: string;
  readonly metricKey: 'completeness' | 'accuracy' | 'spag';
  readonly reasoning: string;
  readonly metric: TaskDisplayMetric;
  readonly error: AssessmentError | null;
  readonly sourceState: TaskPreviewSourceState;
  readonly sourceUrl: string | null;
}
```

`TaskPreviewSourceState` is `'loading' | 'available' | 'unavailable'`.

| #   | Field             | Type                                     | Notes                                                                                                              |
| --- | ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | `taskId`          | `string`                                 | The heatmap column's task ID, forwarded unchanged.                                                                 |
| 2   | `artifactType`    | `'IMAGE' \| 'TEXT' \| 'TABLE'`           | Narrowed from `CellPreviewData['artifactType']`: `SPREADSHEET` → `TABLE`, `base` → `TEXT`.                         |
| 3   | `artifactContent` | `string`                                 | Rendered form; `SPREADSHEET` is converted to a Markdown table, `base` becomes `''`.                                |
| 4   | `metricKey`       | `'completeness' \| 'accuracy' \| 'spag'` | Which metric column the preview is for.                                                                            |
| 5   | `reasoning`       | `string`                                 | `cellData.reasoning[metricKey] ?? ''`; empty string when no reasoning exists.                                      |
| 6   | `metric`          | `TaskDisplayMetric`                      | The analyser's task-display metric, except the no-submission branch substitutes the frozen `NOT_ATTEMPTED_METRIC`. |
| 7   | `error`           | `AssessmentError\|null`                  | The selected criterion's cause: `cellData.errors[metricKey]`, or `null` when that criterion is not an error.       |
| 8   | `sourceState`     | `TaskPreviewSourceState`                 | Readiness of the source region, derived from the selected cause (see below).                                       |
| 9   | `sourceUrl`       | `string\|null`                           | Carried unchanged from the source `CellPreviewData`; `null` when `cellData` is `null` or no usable source exists.  |

> **`sourceState` derivation.** Assembly yields only `available` or `unavailable`;
> the query/preview composition supplies `loading`. A cause whose `stage` is not
> `assessment` (acquisition, extraction or validation) means no renderable source
> remains, so assembly resolves `unavailable`; an assessment-stage cause, or no
> cause, resolves `available`. `available` does not claim a document exists: a
> confirmed no-submission is the ready `N` placeholder with
> `artifactContent: ''`, `error: null`, `sourceUrl: null` and `sourceState: 'available'`.
> `loading` is set only by `TaskMetricPreviewContent` while a known class-partial
> `E`'s full fetch is pending, and is never terminal: any `hasError` on the owning
> column resolves that fallback to `unavailable`, whether the read failed or
> returned `null`, so the known reasoning stays visible beside the inline Alert.
>
> **Known `E` with null content.** A known `E` whose full `IMAGE`/`SPREADSHEET`
> content is `null` assembles as `artifactContent: ''` with
> `sourceState: 'unavailable'` rather than invoking the throwing coercion. This is
> not a successful blank extraction. Unexpected non-`E` null content that bypasses
> read validation still throws.

> **`sourceUrl` semantics.** `sourceUrl` is an editor
> link to the displayed submission artifact's source document. It is **distinct
> from image-export `artifact.metadata.sourceUrl`** — the PNG export URL consumed
> by `src/backend/RequestHandlers/ImageManager.js` to hydrate image content — and
> is never copied from that metadata field. Resolution prefers a non-blank
> artifact `documentId`, otherwise the parent submission's non-blank
> `documentId`; a usable `pageId` supplies the fragment anchor. The format comes
> from the root full assignment's `documentType` (`SLIDES` → presentation
> `/edit#slide=id.<pageId>`; `SHEETS` → spreadsheet `/edit#gid=<pageId>`), with a
> bare `/edit` root fallback when no usable page ID exists. An unknown document,
> or a `null`/unsupported format, yields `sourceUrl: null`; so does missing cell
> data. It depends on the implemented nullable artefact `pageId`/`documentId`
> alignment recorded in
> [Component Shape: BaseTaskArtifact](base-task-artifact.md).

### Display contract

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
- Zero-effective-weight heatmap task headers show explanatory text; the layout
  plan document that originally specified this behaviour has been retired, and
  the behaviour is display-only with no data-shape impact.

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
- `src/frontend/src/services/dataAnalysis/postAnalysis/postAnalysis.zod.ts` →
  `PostAnalysisContextSchema`, `PostAnalysisTaskResultSchema`,
  `PostAnalysisTaskOutcomeDataSchema` — cover the local context, strict succeeded/skipped
  task returns and serialisable lifecycle state, including the optional failed-outcome save
  confirmation. Function/Error handles remain separate typed execution values, never
  transport fields.

**Backend transport validation:**

- None. No backend model, `z_Api` handler, controller, or transport change is
  associated with this contract.

**Key domain validation rules** (enforced by the analyser or adapters, not visible
from the schemas alone):

- `includedInAverage` must equal `effectiveWeight > 0`.
- A resolved negative or non-finite effective weight is rejected by the shared
  `computeEffectiveWeight` boundary before it can reach analyser contribution
  metadata or a heatmap task-column descriptor.
- A submission task ID absent from the live partial is warned and dropped; it
  never receives a default task weight or contributes to any accumulator.
- `excluded` is valid for aggregate scopes only; task display shapes use the
  exported narrow union, and task-preview data carries that union on its single
  `metric` field except in the no-submission branch, which substitutes the frozen
  `NOT_ATTEMPTED_METRIC`.
- A zero-weight raw `N` remains `notAttempted`, not `excluded`, at task level.
- A zero-weight numeric result remains numeric at task level, with
  `totalWeight: 0` and `includedInAverage: false`.
- Multiple numeric zero-weight observations resolving to one task display value
  use their unweighted arithmetic mean.
- The overall composite resolves its terminal state over criteria with positive
  configured criterion weighting only; a zero-configuration criterion affects
  summed `totalDataPoints` but not state selection or contribution metadata.
- Computed and not-attempted aggregate results retain non-contributing observed
  inputs in `totalDataPoints`, without changing the result value, `totalWeight`,
  `applicableDataPoints`, or state. The computed overall composite is the widest
  case: its `totalDataPoints` sums all three criteria, including error and
  zero-effective-weight criteria, while `totalWeight` and `applicableDataPoints`
  stay contribution-based.
- The Class-page no-data placeholder is the only accepted `notAttempted` shape
  with `totalDataPoints: 0`, and only through `ClassPageDisplayMetricSchema`.

**Explicit `E` analyser input:**

The analyser input accepts `'E'` explicitly instead of inferring failure from absent
assessments or missing numeric contributions:

| Contract                 | Position                                                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AssessmentScore`        | `number \| 'N' \| 'E' \| undefined` (`averagingAnalyser.types.ts`). `'E'` is explicit known-error evidence from the Assessment union.                                                                                                                    |
| `processItemAssessments` | Reads `assessments[criterion]?.score`; an absent criterion remains `undefined`, while a provided `'E'` is recognised rather than relying on absence.                                                                                                     |
| `accumulateCriterion`    | Handles numeric and `'N'`; `'E'` (like `undefined`) contributes no numeric sum, no `N` evidence, no denominator weight, no `totalDataPoints` increment and no weight-counter increment. It is error evidence only.                                       |
| `MetricAccumulator`      | `nCount` still distinguishes `notAttempted` from `error`; the type comment records that explicit error scores are accepted by `AssessmentScore`. Internal accumulator counter names are implementation-local and not part of this data-shape contract.   |
| Metric resolution        | A wholly errored task resolves all display metrics to `E` from explicit evidence. A lone `E` display has zero applicable/total data points and zero weight. Existing numeric, genuine `N`, zero-weight and aggregate `excluded` semantics are unchanged. |

Aggregate rules:

- Explicit `E` increments no numeric/`N` evidence, `totalDataPoints` or weight counter, matching
  the existing missing-assessment error accounting. No new coverage counter is introduced.
- `E` contributes neither a numeric zero nor denominator weight to averages. Erroneous evidence
  is excluded from averages while healthy sibling data is retained.
- The public `MetricResult` and `TaskDisplayMetric` output shapes gain no error-history or
  reasoning fields. `error` already carries value `'E'`; no new state member is added.
- Existing mixed valid/error aggregate treatment is preserved; this change does not redesign
  coverage counts, weighting or ranking.
- A genuine no-submission contributes no observed item to the analyser and keeps the existing
  no-data `N` display placeholder. Do not insert raw `N` observations that would change existing
  average denominators.
- A version-1 canonical completed fixture never contains an empty assessment map.
  Missing-criterion and empty-map cases remain local corruption probes, not realistic success
  data. See
  [Synthetic Test Data § Generated content: artefacts, contract marker and outcomes](../testing/synthetic-test-data.md#generated-content-artefacts-contract-marker-and-outcomes).
- A version-1 item whose criterion map is incomplete or contains an extra key is an isolated
  all-three validation `CORRUPT_RECORD` `E` on both full and partial reads; see
  [Component Shape: Assessment § Persistence](assessment.md#persistence). This is read-time
  isolation before analysis, not an analyser input rule or a new baseline feature.
- A missing lookup entry must never be reinterpreted as `N` when an explicit `E` is available
  from class-summary data. A failed/unavailable full query cannot hide known `E` reasoning.
- A preview's `sourceState` is derived from the selected criterion's cause, not from
  whether content happens to be present. An assessment-stage cause keeps the response
  renderer; any other cause suppresses it. `loading` is supplied only by the
  query/preview composition and never by a full-read builder.

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

**Known discrepancies:**

The reconciliation
semantics are aligned across the analyser, both heatmap adapters, and the
Class-page adapter:

1. **Aligned** — a negative or non-finite resolved effective weight is rejected
   by the shared `computeEffectiveWeight` helper before analyser contribution
   metadata or a heatmap task-column descriptor is produced. The partial wire
   schemas still accept negative finite weighting values, and multiplication of
   finite factors can overflow, so the helper is the single product-validity
   boundary and `AverageContributionSchema.effectiveWeight` is a second
   analyser boundary.
2. **Aligned** — `computeOverallComposite` restricts its terminal (`error`,
   `notAttempted`) state tests to criteria with positive configured criterion
   weighting. It sums `totalDataPoints` across all three criteria on every path,
   while keeping `totalWeight` and `applicableDataPoints` contribution-based on
   the computed path and summing `totalWeight` across all three on the terminal
   paths.
3. **Aligned** — `resolveAggregateMetric` and `rollupMetric` retain zero-weight
   observed numeric and raw `N` inputs in computed and not-attempted aggregate
   `totalDataPoints`.
4. **Aligned** — the metadata projection maps the analyser's four-state union into the distinct
   ABClass score union explicitly, mapping excluded/null to literal `excluded`. The
   metadata schema enforces finite 0–5 computed values, while `MetricResultSchema.value`
   remains `z.number()` without those bounds; out-of-range projection fails metadata
   validation, never clamps or rounds. Assignment refresh timestamps are intentionally
   stricter than the existing nullable-string read shape; see
   [ABClass known discrepancy 9](abclass.md#known-discrepancies).

5. **Aligned** — the metadata descriptor translates writer `saved`/`classPartial` into shared
   `succeeded`/`confirmedPersistence` state, without persisting the display result or
   transporting local Errors/functions. Context identity equality is checked by the
   hook; completeness and successful-run provenance remain caller responsibilities.
6. **Aligned** — `PostAnalysisTaskResultSchema` admits only strict
   succeeded/skipped results, and the runner parses it before adding descriptor-owned
   `taskId` and validating outcome data. The former wider outcome-only parse accepted
   untyped pending/failed task returns with `error: null`; both now become runner-owned
   failed outcomes with non-null local Errors, without blocking later tasks. Types derive
   from the result schema, whose variants are reused by the outcome schema.

7. **Aligned** — failed lifecycle data permits `confirmedPersistence?: true`,
   without widening `PostAnalysisTaskResultSchema`. Post-save query refresh failure
   retains a non-null local normalised Error and save confirmation; feedback selects
   saved-but-refresh-failed copy instead of claiming the save failed. False/null flags,
   failed/pending task returns and serialised technical handles remain invalid.

8. **Aligned** — class ownership is explicit and independent of analysis
   readiness. `usePostAnalysisTasks` requires the committed `selectedClassId` as its third
   argument; a `null` context for the same class clears published state but does not destroy
   feedback or detach a pending attempt, while a changed/deselected class and unmount still
   suppress late feedback. The notification host is the required
   `App.useApp().notification` context with no production no-host fallback. Refresh-failure
   diagnostics also carry the bounded scalar `confirmedPersistence: true`. This changes local
   lifecycle execution only: no persistence, request, response, envelope or analyser shape
   changes.

## Legacy assignment display

Delivered: valid legacy scores are included in analysis through the existing heatmap/averaging and E rules, with no version-based filtering or new analyser/card-model field, and the task-heatmap `Reassessment required` tag is shown from the `'legacy'` marker (task-heatmap-only, by explicit user decision, with no field added to persisted metadata). The remaining planned work is the top-decile attempt-baseline analysis mode (tracking issue: h-arnold/AssessmentBot#305); complete the existing attempt-baseline plan independently.

## Attempt-baseline contract changes

### Attempt-baseline analysis mode

The top-decile attempt-baseline analysis mode is delivered incrementally (tracking issue:
h-arnold/AssessmentBot#305). The explicit-`E` analyser input, the preview `sourceUrl` field and
every other previously planned addition are implemented and documented in the sections above.
The schema contracts for items 1–4 below are implemented as recorded (Section 1 of the
attempt-baseline action plan: required filter field, result echo and optional baseline block,
required task-row flag), as is the analyser's baseline-mode behaviour (Section 2:
post-accumulation baseline selection, baseline-restricted aggregation, the baseline-mode
per-student `excluded` conversion and the `attemptBaseline` echo); item 5 is partially
delivered. The heatmap column projection (Section 3) is delivered. The summary
reconciliation (Section 4) and the Class-page mode control (Section 5) remain planned.

1. **`AnalysisFilterSchema.analysisMode`** — required enum field
   `z.enum(['absolute', 'topDecileBaseline'])` on the existing strict filter
   object. There is no default; every caller states the mode explicitly.
   `'absolute'` is the explicit representation of current behaviour.
   **Implemented (Section 1):** the schema requires the field and every
   input-construction site supplies it.

2. **`AveragingResultSchema.appliedAnalysisMode`** — required echo enum
   (same two values) recording the mode actually applied to the per-class
   result. **Implemented (Section 1):** the schema requires the echo; the
   analyser emits the input's mode — `'absolute'` since Section 1, and
   `'topDecileBaseline'` with the baseline block since Section 2.

3. **`AveragingResultSchema.attemptBaseline`** — optional strict object present
   only when `appliedAnalysisMode` is `'topDecileBaseline'`:

   ```ts
   attemptBaseline: z.strictObject({
     poolStudentIds: z.array(z.string()).min(2),
     baselineTaskKeys: z.array(z.string().min(1)).min(1),
   }).optional(),
   ```

   Intended domain rules (produced by a post-accumulation baseline-selection derivation; not
   Zod refinements):
   - Candidates = roster students with at least one attempted task within the
     analysis input's in-scope assignments; pool = top
     `min(|candidates|, max(2, ceil(0.1 × rosterSize)))` candidates by count of
     **distinct** attempted task keys (same `buildTaskKey` unit as
     `baselineTaskKeys`); ranking ties break by `studentId` ascending. The mode
     is unavailable when fewer than 2 candidates exist or the roster is below
     3 students.
   - Attempted = the submission item yields at least one numeric criterion
     score; all-`N` items, missing assessment criteria (the historical
     `E` condition), and absent items are not attempts. An explicit `E` result
     also yields no numeric criterion score and is therefore not an attempt.
     Criterion weighting plays no part.
   - Baseline task keys = intersection of the attempt sets across the whole
     pool. An empty intersection throws (descriptive error naming the class)
     before any result is produced, so the schema `min(1)` is protected. The
     failure has two deliberate sites, both naming the class: the derivation
     throws when the ten-percent bound truncated the pool to the structural
     minimum of 2 while unused candidates remained, and the averaging analyser
     throws for every other empty intersection.
   - The derivation is a **post-accumulation** pass over the analyser's accumulators
     (whose per-criterion `displayCount` already encodes the attempt signal); it is not a
     separate raw-data pre-pass.
   - Applies to all four metric aggregates (per-student, per-class) built from
     per-(student, task) accumulators restricted to the baseline task set.
   - Students whose observed tasks fall entirely outside the baseline resolve
     each aggregate metric to the existing aggregate-only `excluded` state
     using **observed** evidence semantics — roll up the unfiltered
     per-(student, task) accumulators per criterion with the existing
     `rollupMetric` path (which resolves `totalDataPoints` itself: from
     `allTotalDataPoints` on the `error`/`notAttempted`/`excluded` terminal
     states, and `Math.max(finalTotalDataPoints, observedDataPoints)` on the
     `computed` path) and convert **only `computed` and `notAttempted`**
     results to `excluded`, **preserving the resolved `totalDataPoints`**
     (never the weight-gated counter, which would violate
     `totalDataPoints >= 1` for zero-weight-only work, and never a hand-rolled
     display-count sum). An already-`excluded` zero-weight rollup is left
     untouched (its cause survives; the baseline-mode accessible label names
     both causes). The row's `overall` composite is never converted directly:
     it is derived from the converted criteria through the existing
     `computeOverallComposite`, so its resolved `totalDataPoints` is the sum
     of the converted criteria's resolved counts (>= 1 whenever any criterion
     converted); all-`error` rows stay `error` and any mixture with a
     converted criterion converges on `excluded`. A criterion with no
     observed evidence keeps `error`; a student with no per-(student, task)
     accumulators at all follows today's absolute-mode path (`error` metrics)
     and is never converted.

   **Implemented (Section 2):** the optional block validates exactly as recorded
   and the analyser emits it in every baseline-mode result (absolute mode omits
   it); baseline selection is the post-accumulation derivation recorded above.

4. **`PerTaskRowSchema.includedInAttemptBaseline`** — required boolean always
   present on task rows. `true` for every row in `absolute` mode; in baseline
   mode it marks baseline-set membership. Per-task row _values_ stay absolute
   in both modes. **Per-student cell metrics carry no flag:** columns are the
   only marked heatmap unit (column-level marking in v1; see item 8), so
   `PerStudentTaskMetric` is unchanged. The array's **contents are also
   mode-independent**: baseline filtering restricts only the aggregation step,
   so `perStudentTaskMetrics` carries every observed (student, task) pair in
   both modes — availability and heatmap substitution paths therefore see
   identical evidence regardless of mode.

   **Implemented (Section 1):** the flag is required on every task row and the
   analyser sets it `true` in absolute mode; the heatmap-column projection is
   implemented with the column descriptors (item 8).

   **Baseline narrowing rule.** `attemptBaseline` is optional on the result
   because absolute mode omits it; the analyser always emits it in baseline
   mode. Consumers narrow by mode and treat a baseline-mode result without
   `attemptBaseline` as an invariant violation — fail fast with a throw; an
   `attemptBaseline?.baselineTaskKeys ?? []` fallback is forbidden (it would
   silently mark every column excluded).

5. **Assignment summary contract unchanged.** `AssignmentSummarySchema` and the
   summary analyser remain mode-independent: task summaries are absolute
   per-task evidence in both modes. The summary analyser's internal averaging
   delegation states `analysisMode: 'absolute'` explicitly (task-level
   evidence must never invoke baseline selection), while the public summary
   input continues to validate the caller's supplied `analysisMode`.

   **Partially delivered (Section 1):** the internal delegation pin and the
   required public filter field are in place; final reconciliation is
   Section 4.

6. **Downstream aggregate consumers.** Per-assignment aggregates on the Class
   page (recent-assignment cards) are recomputed in baseline mode from
   baseline-restricted per-task evidence: the adapter reads
   `analyserResult.appliedAnalysisMode` and rolls up the filtered rows; when
   the filtered set is empty it rolls up the unfiltered rows per criterion and
   converts **only `computed` and `notAttempted`** results to `excluded`,
   preserving observed `totalDataPoints` and constructed with the
   `ExcludedMetricSchema` literals (`value: null`, `totalWeight: 0`,
   `applicableDataPoints: 0`; the conversion assumes a source rollup whose
   resolved `totalDataPoints` is ≥ 1 — the accumulator path guarantees this)
   with the same observed-evidence semantics as item 3; an already-`excluded`
   zero-weight rollup keeps its weighting cause. Criteria with no observed
   evidence stay `error` (no `excluded` is synthesised), the existing `rows.length === 0 → N` no-per-task-rows
   placeholder branch is untouched, and the converted **per-criterion**
   results flow through the existing `computeOverallComposite` (the composite
   itself is never converted): the card `average`'s resolved `totalDataPoints`
   is the sum of the converted criteria's counts, all-`error` rows stay
   `error`, and any mixture with a converted criterion converges on
   `excluded`.

7. **Display-only additions (no schema change):** the `excluded` aggregate
   state would carry two causes (zero weighting vs baseline exclusion); the
   accessible label becomes mode-aware at the `metricDisplay` layer
   (`metricTone`/`MetricPill`/`studentAveragesTableColumns`) without widening
   any shape — in baseline mode the label names **both** possible causes in one
   truthful wording, so no cause field exists. The Heatmaps-page pipeline
   (`heatmapsPipeline.ts`) never enters baseline mode (its input states
   `analysisMode: 'absolute'`), so its `includedInAttemptBaseline` flags are
   always `true` there. The Class page's embedded single-assignment heatmap
   inherits the Class page's analysis result and may therefore render `false`
   markers in baseline mode while keeping absolute cell values.

8. **Heatmap projection addition:** `HeatmapTaskColumn` gains `includedInAttemptBaseline: boolean`, set in
   `heatmapAdapter.ts` from a required second `buildTaskColumns` parameter
   typed `ReadonlySet<string> | null` (`null` = absolute mode: every column
   included). **The supplier is `adaptMetricsToHeatmap`** — the only caller
   that receives a mode-bearing `analyserResult`: baseline mode →
   `new Set(analyserResult.attemptBaseline.baselineTaskKeys)` under the
   Baseline narrowing rule's fail-fast; absolute mode → `null`. The merged chain
   (`adaptMetricsToMergedHeatmap` → `buildMergedTaskColumnsInClassOrder` →
   `buildMergedTaskColumns` → `buildTaskColumns`) passes `null` explicitly at
   each hop. `MergedHeatmapTaskColumn` inherits the field via its existing spread
   of the base projection. `HeatmapCell` is unchanged: marking is
   **column-level only in v1**, and cell values stay absolute in both modes.
   **Implemented (Section 3):** both column descriptors require the field and
   the adapter derives the set from its own analyser result; the fail-fast
   throws name `appliedAnalysisMode` (missing or unrecognised echo) and
   `attemptBaseline` (baseline-mode result without the block), as the Baseline
   narrowing rule requires.

9. **Preview error fields — implemented.** The derived preview shapes now distinguish an
   assessment-only error whose source is available, an unavailable/corrupt source, and a
   `null` `artifactContent` caused by deliberate partial redaction. These fields are
   in-memory only; they are never added to backend artefacts, persistence, API
   requests/responses or the transport envelope, and `CellPreviewData`/`TaskPreviewData`
   remain TS-only, non-Zod. See
   [Task preview derived shapes](#task-preview-derived-shapes) for the current field
   tables.

   - `CellPreviewData.errors` — required
     `Record<HeatmapMetricKey, AssessmentError | null>`; every canonical criterion has an
     entry and non-`E` entries are `null`.
   - `TaskPreviewData.error` — required `AssessmentError | null` carrying the selected
     criterion's cause.
   - `TaskPreviewData.sourceState` — required `'loading' | 'available' | 'unavailable'`:
     `available` = normal source region ready (usable content, or a confirmed no-submission
     with no known `E` showing the legitimate `N` placeholder); `unavailable` = an error
     source only (unavailable/corrupt/known-invalid source, a terminally failed or
     `null`/not-found fallback fetch, or a known `E` with null `IMAGE`/`SPREADSHEET` content —
     suppress the response renderer and show an inline error explanation); `loading` = pending
     only, while a known partial `E` fallback's full fetch is in flight, never terminal.

   Derivation as implemented: `buildCellPreviewLookup` derives each criterion's cause from
   that criterion's own validated assessment. `assembleTaskPreviewData` yields only
   `available`/`unavailable`; `TaskMetricPreviewContent` supplies `loading` only while the
   fallback full fetch is pending, and resolves it to `unavailable` on a terminal failure or
   `null` result. A known `E` with null `IMAGE`/`SPREADSHEET` full content assembles as
   `artifactContent: ''` with `sourceState: 'unavailable'`; non-`E` unexpected null content
   still throws. Precedence in an opened preview:
   1. explicit full-record validation error; 2. the class-partial `E` for that criterion;
   2. the selected full item's `E`; 4. the existing analyser metric. A full-read-only
      corruption overrides the affected preview's score/reasoning with `E` even when the
      class-derived heatmap cell still shows a historic numeric value, stating
      `Source preview unavailable. Displayed scores are unchanged; reassess the assignment to refresh them.`
      This override is preview-local: it must not mutate class-query data, recompute analysed
      class scores/averages, or persist a read repair. The public `MetricResult` output is
      unchanged.

## File Index

Persistence model: none (frontend-only contract).

Frontend schema: `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`
Frontend service: `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`
Effective-weight helper: `src/frontend/src/services/assignmentDefinition/assignmentDefinitionUtilities.ts`
Task-key helper: `src/frontend/src/services/dataAnalysis/taskKey.ts`
Analyser: `src/frontend/src/services/dataAnalysis/analysers/`
├── `attemptBaselineSelection.ts`
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

Metadata refresh execution companions:
├── `src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.ts` → pure decision, shared newest-first comparator, metric mapping, non-nullable rolling merge; `MetadataRefreshSkipped`, `MetadataRefreshDecision`
├── `src/frontend/src/services/dataAnalysis/postAnalysis/refreshABClassMetadata.ts` → task entrypoint consuming the shared `PostAnalysisContext`; no task-local context type
└── `src/frontend/src/services/abClass/abClassMetadataService.ts` → reserved-slot writer; `MetadataRefreshInput`, `RefreshOutcome`, shared lane constant reservation

Shared lifecycle companions:
├── `src/frontend/src/services/dataAnalysis/postAnalysis/postAnalysis.zod.ts` → `PostAnalysisContextSchema`, `PostAnalysisTaskResultSchema`, `PostAnalysisTaskOutcomeDataSchema`, inferred data types
├── `src/frontend/src/services/dataAnalysis/postAnalysis/runPostAnalysisTasks.ts` → ordered runner, ID validation, local descriptor/result/outcome types
├── `src/frontend/src/services/dataAnalysis/postAnalysis/postAnalysisTasks.ts` → canonical metadata task ID, clock-injected metadata-only descriptor factory, shared source-version signature and attempt key
├── `src/frontend/src/services/dataAnalysis/postAnalysis/postAnalysisDiagnostics.ts` → `logPostAnalysisFailure`; bounded task/refresh failure identifiers, shared comparator, available correlation and optional `confirmedPersistence: true`
├── `src/frontend/src/hooks/usePostAnalysisTasks.ts` → post-commit mount-owned attempt/state lifecycle with required selected-class ownership, including post-save settlement
├── `src/frontend/src/hooks/usePagePostAnalysisTasks.ts` → shared ready-only page eligibility/context wrapper; memoised context and once-per-mount descriptor list for both averaging surfaces
├── `src/frontend/src/hooks/postAnalysisInvalidation.ts` → both required query invalidations; refresh failures log bounded `confirmedPersistence: true` and return a confirmed-persistence failed outcome
└── `src/frontend/src/hooks/postAnalysisFeedback.ts` → mount/selected-class/task/source-owned persistent warnings with required App host, dismissal memory and cleanup

Frontend test-only acceptance:
├── `src/frontend/e2e-tests/helpers/post-analysis-metadata-scenarios.ts` → canonical small class-2 historical-boundary and later-version browser queues
├── `src/frontend/e2e-tests/post-analysis-metadata.persistence.spec.ts` → three changed-write journeys
└── `src/frontend/e2e-tests/post-analysis-metadata.feedback.spec.ts` → eight save/refresh feedback and viewport/theme cases

Task preview derived shapes:
├── `src/frontend/src/features/taskHeatmap/buildCellPreviewLookup.ts` → `CellPreviewData`, `AssessmentError` (owners)
├── `src/frontend/src/features/taskHeatmap/assembleTaskPreviewData.ts` → `TaskPreviewData` assembly and `sourceState` derivation
├── `src/frontend/src/features/taskHeatmap/assembleMergedPreviewData.ts` → merged lookup/status
├── `src/frontend/src/features/taskHeatmap/TaskMetricPreviewContent.tsx` → pending/failed/ready popover body; supplies `loading`
└── `src/frontend/src/features/taskHeatmap/TaskPreviewCard.tsx` → `TaskPreviewData` and `TaskPreviewSourceState` (owners)
