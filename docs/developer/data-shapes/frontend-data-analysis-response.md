# Contract: Frontend Data Analysis Response

## Status

**Implemented.** This is the canonical contract for the frontend-only, in-memory
data-analysis response delivered for the GitHub issue #307 zero-weight
remediation. It is validated entirely inside the frontend and has **no backend
API, persistence collection, transport envelope, or migration**. The later
ABClass metadata lifecycle additions are implemented and independently review-clean
through checkpoint 5C (**PASS — CLEAN 5C**), and Section 5 is complete: production consumer
activation (5D) is independently review-clean (**PASS — CLEAN 5D**), with the section-end
comparison reporting 0 regressions, 0 new failures and 5 fixes. Frontend Section 6's test-only
browser and dispatcher acceptance work is complete and independently review-clean (**CLEAN —
Section 6**), with fresh reviewer runs passing the complete browser suite at **313 tests** with
`--retries=0`, the full synthetic project at **34 files / 384 tests**, all-project
type-checking and verify-only frontend lint (zero errors / 19 baseline warnings). The persisted
Section 6 comparison at `2026-10-21T00:43:04.269Z` reports **0 regressions, 0 new failures and
5 fixes**; only the six baseline backend-lint warnings remain, so overall status stays baseline
**FAILING**. The Section 7 canonical documentation audit is complete and independently
review-clean (**CLEAN — Section 7**,
`.opencode/scratchpad/review-final-frontend-abclass-metadata.md`); its source-comment follow-up
is resolved (the shared class-read schemas now document request `metadata` as optional by
omission, strict when present, `null` clearing and object replacement). The final regression
comparison follows this documentation-only closure and is retained under the session runs; the
latest recorded Section 6 delivery comparison remains the run at `2026-10-21T00:43:04.269Z` (0
regressions, 0 new failures and 5 fixes), with the later batch-1 parent comparison recorded
below. The aggregate gate finding is recorded in
[Contract: ABClass](abclass.md); it changes no wire, validation or data-contract shape and is not
a contract discrepancy.

Batch-1 remediation (21 October 2026) adds the required `selectedClassId` ownership argument,
readiness-independent feedback retention, the required App notification host and bounded
`confirmedPersistence: true` refresh diagnostics. Its Class-page delayed-list browser case is
independently browser-verified: the reviewer's full run passed all **314** browser tests and the
parent comparison at `2026-10-21T12-48-56.194Z` reports **0 regressions, 0 new failures and 0
fixes** across seven passing checks, with only the six baseline backend-lint warnings failing.
These changes affect local frontend execution only. Overall review sign-off, commit and push
remain outstanding and are not claimed here.

Frontend schema: `src/frontend/src/services/dataAnalysis/dataAnalysis.zod.ts`
Frontend service: `src/frontend/src/services/dataAnalysis/dataAnalysisService.ts`
Analyser: `src/frontend/src/services/dataAnalysis/analysers/`
Class-page adapter schema: `src/frontend/src/features/classPage/classPageAdapter.zod.ts`
Heatmap adapters: `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`, `src/frontend/src/services/dataAnalysis/heatmapAdapter.merged.ts`
Metric display: `src/frontend/src/services/dataAnalysis/metricDisplay/`

Sibling contracts:

- [Contract: AssignmentDefinition](assignment-definition.md) — owns the live
  assignment and task weighting inputs used by this derived response.
- [Contract: ABClass](abclass.md) — supplies the analysed class (including the
  required nullable `metadata` field on the read schema) and assignments.

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
no stored document. Analysis results and the local execution companions below are
in-memory values. Only explicitly projected ABClass metadata crosses persistence,
through the existing [ABClass contract](abclass.md#implemented-metadata-writer-projection-and-task).

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
`z.number().nullable()`). The shared `computeEffectiveWeight` helper therefore
fails fast when the resolved effective product is negative or non-finite,
including overflow from two finite factors, before it can be recorded in
analyser contribution metadata or reach either heatmap task-column descriptor.
`AverageContributionSchema.effectiveWeight` independently enforces the same
finite, non-negative output invariant through `z.number().min(0)`. Both heatmap
adapters remain direct TypeScript projections rather than Zod parses, but their
shared weighting boundary prevents an invalid `effectiveWeight` from
escaping.

## Response shapes

### Assignment task summaries (#277)

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

### ABClass mutation boundary (implemented frontend prerequisite)

Frontend Section 3C adds strict request schemas and queued `upsertABClass` / `updateABClass`
services under `services/abClass/`; their fields and omission/null/whole-replacement semantics
are owned by [Contract: ABClass — mutation schemas and queued services](abclass.md#implemented-mutation-schemas-and-queued-services).
The wrappers validate before the shared `CLASSES_BULK_MUTATION_JOB_NAME`
(`classesBulkMutation`) enqueue and parse real
`ClassPartialSchema` responses. Section 3 is complete and independently review-clean, including
Section 3C's **PASS — CLEAN 3C** verdict. The Section 3 comparison at
`2026-10-20T06:21:48.763Z` reports **0 regressions, 0 new failures and 5 fixes**; backend lint
alone retains six baseline warnings with zero errors, so the overall status remains baseline
**FAILING**, not an all-green gate. Review and comparison paths are recorded in
[ABClass — frontend delivery status](abclass.md#frontend-metadata-counterpart-shared-schema-and-class-read-adoption-implemented).

The audit's upsert null-admission mismatch is resolved by the frontend request schema:
`cohortKey` and `yearGroupKey` are required non-null strings, matching the unchanged backend
required-parameter guard. Null rejects before enqueue; read/response keys and optional update
keys remain nullable. Optional whole `metadata` replacement remains nullable on both mutations.
The audit history is retained in [ABClass known discrepancy 8](abclass.md#known-discrepancies).

This changes no analyser input/output shape and does not persist analysis automatically.
Section 4's metadata writer/projection/task and local execution types are **complete and
independently review-clean, with zero new regressions**. Independent verdict:
**PASS — CLEAN Section 4**, `.opencode/scratchpad/review-section4-final-docs-clean.md`.
The subsequent persisted comparison at `2026-10-20T07:26:18.292Z` reports **0 regressions,
0 new failures and 5 fixes**:
`.ts-regression-checker/reports/session-frontend-abclass-metadata/runs/2026-10-20T07-26-18.292Z/comparison.txt`.
Seven of eight checks passed; backend lint alone retains the same six baseline `max-lines`
warnings with zero errors. Overall status remains baseline **FAILING**, not an all-green gate.
No Section 4 blocker remains. Checkpoint 5A is review-clean and introduces no functional
data-shape change. Checkpoint **5B is independently review-clean**: shared
context/outcome Zod, ordered runner/descriptor factory and mount-owned hook are documented below.
Verdict: **PASS — CLEAN 5B**, `.opencode/scratchpad/review-section5b-final-clean.md`
(47 lifecycle cases). 5C is implemented and independently review-clean:
**PASS — CLEAN 5C**, `.opencode/scratchpad/review-section5c-independent.md`, with no
Critical, Improvement or Nitpick findings in scope. Fresh reviewer validation passed frontend
coverage **294 files / 2,840 tests** with all thresholds met, `npm run typecheck:all`,
verify-only frontend lint (**zero errors / 19 baseline `max-lines` warnings**) and
`git diff --check`. Supplied handoff evidence recorded 72 lifecycle cases and 336 combined
focused tests passed; the independent re-run above supersedes it as sign-off. Both production
consumers invoke the shared page hook `usePagePostAnalysisTasks` (5D complete and independently
review-clean; the Section 5 comparison reports 0 regressions, 0 new failures and 5 fixes).
Frontend Section 6's test-only browser/dispatcher acceptance work is complete and independently
review-clean (**CLEAN — Section 6**), with fresh reviewer runs passing the complete browser suite
at **313 tests** with `--retries=0`, the full synthetic project at **34 files / 384 tests**,
all-project type-checking and verify-only frontend lint (zero errors / 19 baseline warnings).
Its persisted comparison at `2026-10-21T00:43:04.269Z` reports **0 regressions, 0 new failures
and 5 fixes**; only the six baseline backend-lint warnings remain, so overall status stays
baseline **FAILING**. The Section 7 canonical documentation audit is complete and independently
review-clean (**CLEAN — Section 7**,
`.opencode/scratchpad/review-final-frontend-abclass-metadata.md`); the final regression
comparison follows this documentation-only closure and is retained under the session runs.
`DataAnalysisService` is unchanged, synchronous and I/O-free.
`runApiQueuedTask` in the actual queue owner `services/api/apiQueue.ts` accepts a local callback,
not wire data; no callback/context transport schema is introduced here. Actual transport stays
in `services/apiService.ts`, with direct-owner imports and no facade/barrel.

### Metadata refresh execution contracts (implemented)

These are local TypeScript execution contracts, **not** API requests/responses or additions
to `DataAnalysisResponseSchema`. The Section 4 task's types remain unchanged; the 5B shared
lifecycle now validates its context and serialisable outcome data through `postAnalysis.zod.ts`
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
[ABClass — implemented writer](abclass.md#implemented-metadata-writer-projection-and-task).
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

Shared registration/lifecycle is independently review-clean (5B); feedback/invalidation is
implemented and independently review-clean (5C, **PASS — CLEAN 5C**). Consumer activation
(5D) is complete and independently review-clean (**PASS — CLEAN 5D**); the Section 5
comparison reports 0 regressions, 0 new failures and 5 fixes. Frontend Section 6's test-only
browser/dispatcher acceptance work is complete and independently review-clean (**CLEAN —
Section 6**), with fresh reviewer runs passing the complete browser suite at **313 tests** with
`--retries=0`, the full synthetic project at **34 files / 384 tests**, all-project type-checking
and verify-only frontend lint (zero errors / 19 baseline warnings). Its persisted comparison at
`2026-10-21T00:43:04.269Z` reports **0 regressions, 0 new failures and 5 fixes**; only the six
baseline backend-lint warnings remain, so overall status stays baseline **FAILING**. The
Section 7 canonical documentation audit is complete and independently review-clean (**CLEAN —
Section 7**, `.opencode/scratchpad/review-final-frontend-abclass-metadata.md`); the final
regression comparison follows this documentation-only closure and is retained under the session
runs. Helper discovery/status is owned by
[Frontend shared helpers](../frontend/frontend-shared-helpers-and-abstraction-standards.md#928-frontend-abclass-metadata-and-post-analysis-frontend-abclass-metadata).

### Shared post-analysis lifecycle

**Checkpoint 5B: PASS — CLEAN**, recorded in
`.opencode/scratchpad/review-section5b-final-clean.md`. **Checkpoint 5C: PASS — CLEAN**,
recorded in `.opencode/scratchpad/review-section5c-independent.md**. This extends only frontend
in-memory validation/execution; backend shapes and analyser output are unchanged.
Class-page/standalone Heatmaps activation (5D) is complete and independently review-clean, and
both surfaces call the shared page hook `usePagePostAnalysisTasks`with an unsliced class, live
definitions and the successful averaged result. Frontend Section 6's test-only browser/dispatcher
acceptance work is complete and independently review-clean (**CLEAN — Section 6**), with fresh
reviewer runs passing the complete browser suite at **313 tests** with`--retries=0`, the full
synthetic project at **34 files / 384 tests**, all-project type-checking and verify-only frontend
lint (zero errors / 19 baseline warnings). Its persisted comparison (the Section 6 run at
`2026-10-21T00:43:04.269Z`) reports **0 regressions, 0 new failures and 5 fixes**; only the six
baseline backend-lint warnings remain, so overall status stays baseline **FAILING**. The
Section 7 canonical documentation audit is complete and independently review-clean (**CLEAN —
Section 7**; report: `.opencode/scratchpad/review-final-frontend-abclass-metadata.md`); the final
regression comparison follows this documentation-only closure and is retained under the session
runs.

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
[Metadata refresh execution contracts](#metadata-refresh-execution-contracts-implemented)).

#### Serialisable outcome data

Same schema owner → `PostAnalysisTaskOutcomeDataSchema`, a
`z.discriminatedUnion('status', ...)` of strict objects; inferred type
`PostAnalysisTaskOutcomeData`. **Serialisable does not mean wire data:** none is sent to GAS.

| Field                  | Type                                          | Frontend Zod                 | Notes                                                                                                                                                                        |
| ---------------------- | --------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `taskId`               | `string`                                      | `z.string().min(1)`          | Required in every variant; no trimming or identifier-safety refinement.                                                                                                      |
| `status`               | `'pending'\|'succeeded'\|'skipped'\|'failed'` | Respective `z.literal(...)`  | Required discriminator; `saved` remains a writer-only status.                                                                                                                |
| `confirmedPersistence` | `true\|undefined`                             | `z.literal(true).optional()` | Succeeded and failed variants only; absence is valid, false/null reject. Failed may retain a confirmed save after refresh failure (5C). No query-refresh success is implied. |
| `reason`               | `'noAssignments'\|'unchanged'\|'staleSource'` | `z.enum(SKIPPED_REASONS)`    | Required only for skipped; other variants reject it. `SKIPPED_REASONS` is the pinned tuple.                                                                                  |

Pending contains exactly taskId/status; failed additionally permits optional
`confirmedPersistence: true`. No technical Error, callback, user-copy or class partial
field is accepted. The hook publishes pending with a separate null Error before awaiting
each ordered result. Task results remain strictly succeeded/skipped: the 5C failed-data
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
  mount across navigation. New source keys/new unkeyed context objects or a remount permit
  another attempt; mere rerenders/state changes do not retry cached work.
- Class ownership is committed by a separate `navigate(selectedClassId)` effect, not by
  `attach`. Only a changed selected class (including a transition to `null`) starts a new
  feedback generation and destroys that owner's visible warnings; passing a `null` context
  for the same selected class is analysis readiness, not departure. Both production
  consumers pass their committed `classId`, so a blocking detail refetch cannot be mistaken
  for navigation.
- Effects start after commit; StrictMode replay reattaches to the same cached pending
  promises. Outcomes remain in descriptor order, with incremental publication as tasks
  settle. Cleanup detaches old-effect state publication; work continues, including later
  tasks in that execution. It never aborts or claims to cancel an active queued write.
  Effect detachment does not suppress independently owned same-class feedback; each
  settled outcome is offered to feedback with the feedback generation captured at attach,
  and only a class-generation change suppresses a late warning.
- This is attempt storage, not a second server-data cache. Same-version work from distinct
  mounts still relies on the writer's fresh in-lane recheck. 5C extends the cached attempt
  promise through required post-save invalidation before settlement; reattachment does not
  repeat invalidations or warnings. Both production surface owners are active and 5D
  review-clean.
- Both 5D consumers call the shared page hook `hooks/usePagePostAnalysisTasks.ts`, which
  memoises the non-null context per input set and creates the descriptor list once per mount.
  The feature hooks keep no per-feature context, descriptor list or status alias. A fresh
  context object per render would manufacture a new unkeyed attempt every render; the page
  hook's memoisation is the production loop guard, not a shared global metadata eligibility gate
  (supplied evidence: 2 RED identity regressions). A non-ready surface passes `null` explicitly,
  which requests no work but does not revoke the selected-class owner.

#### Confirmed persistence and refresh settlement

Owner: `hooks/postAnalysisInvalidation.ts` → `completePostAnalysisInvalidation`.
Only `refreshABClassMetadata` with succeeded data and `confirmedPersistence: true`
invalidates `queryKeys.abClass(classId)` and `queryKeys.classPartials()`, once each per
new attempt, after parsed save confirmation. Both calls use `{ throwOnError: true }`;
`Promise.allSettled` observes both even if one rejects. Inactive queries are marked stale,
not forcibly fetched; no imperative read, assignment/definition invalidation or rollback
is added. Skipped/failed/unconfirmed and other-task outcomes pass through unchanged.

If both invalidations fulfil, retain the succeeded outcome. Otherwise return
`{ data: { taskId, status: 'failed', confirmedPersistence: true }, error }`, retaining
the first normalised refresh Error locally. Every distinct normalised Error object is
logged through the bounded diagnostic owner; both settlements remain observed even when
the same Error instance is deduplicated. Each refresh failure is logged through
`logPostAnalysisFailure` with the bounded scalar `confirmedPersistence: true`,
distinguishing it from a pre-save task failure without expanding the diagnostic payload.
Both required settlements complete before the attempt settles, even when the surface has
meanwhile become readiness-blocking and passes a `null` context for the same class; that
readiness change does not detach the pending attempt. Save confirmation is not withdrawn
and the successful display analysis is not replaced by this task failure. This extension
affects only lifecycle outcome data and bounded diagnostics, not task returns, writer
`RefreshOutcome`, or any wire shape.

#### Feedback ownership and safe copy

Owner: `hooks/postAnalysisFeedback.ts` → `PostAnalysisFeedback`, using the required existing
`App.useApp().notification` host. Only a mounted metadata failed outcome for the committed
selected class offers a warning:

| Failure data                 | Title                          | Description                                                                                           | Notes                                                                                          |
| ---------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| No confirmed persistence     | `Class summary not saved`      | `Analysis is ready, but the class summary could not be saved. Reload the page to try again.`          | Does not prove that no backend write occurred; response parsing may have failed after a write. |
| `confirmedPersistence: true` | `Class summary refresh failed` | `The class summary was saved, but refreshed data could not be loaded. Reload the page to refresh it.` | Distinguishes confirmed persistence from refresh failure.                                      |

Warnings use `duration: 0`, `closable: true`, `role: 'status'`, no retry action and no
technical Error rendering. The host is the required existing `App.useApp().notification`
context: production code declares no no-host fallback and emits no substitute channel, so a
missing or incomplete host fails loudly at the completion boundary. Identity is JSON of
mount-owned React `useId`, the committed selected classId, taskId and source identity.
Keyed tasks use their attempt key; the unkeyed fallback uses the raw assignment ID/time
list in supplied order. Shown-key memory lasts the mount, including after dismissal or navigation, so
same-version effect replay does not reopen a notice. Closing removes only visible-key
ownership; a committed class change/deselection and actual unmount destroy only this owner's
visible keys. Microtask disposal tolerates synchronous StrictMode replay.

Feedback ownership tracks the committed selected class rather than analysis readiness. A
same-class readiness-null context does not destroy a visible warning or suppress a pending
attempt's settlement, so a confirmed-save warning still appears after both required query
refreshes settle when the surface became blocking in the meantime. Genuine navigation,
unmount or a different class generation still suppresses late feedback; state publication
alone is detached with the effect. This does not abort queued work or required refresh
settlement. No success/unchanged warning is emitted. Notification hosts, callback/clock
handles, React mount IDs, Maps/Sets and technical Errors stay local and have no serialised
persistence/transport representation.

#### Frontend Section 6 test-only acceptance boundary (implemented; original set review-clean; batch-1 addition independently browser-verified)

Section 6 adds browser and dispatcher acceptance coverage only. It introduces **no** new
execution context, outcome, request or response field, and the lifecycle contracts above are
unchanged.

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
  warning. That last case was added in batch-1 remediation and is independently
  browser-verified by the reviewer's full run (all **314** browser tests passed; the
  actual-consumer delayed-list case is recorded in `.opencode/scratchpad/batch1-review-e2e.txt`).
  Overall review sign-off, commit and push remain outstanding.
- The Node real-dispatcher bridge and round-trip suite are ABClass transport coverage; their
  test-only contract and the explicit limitation that they are not real
  controller/persistence/integrity proof are recorded in
  [Contract: ABClass — Frontend Section 6](abclass.md#frontend-section-6-test-only-round-trip-and-browser-scenario-contracts-implemented-original-set-review-clean-batch-1-addition-independently-browser-verified).

The original ten Section 6 browser cases are green in the independent reviewer's full run:
**313** browser tests passed with `--retries=0` (8.8 minutes), alongside **34** synthetic files /
**384** tests, all-project type-checking and verify-only frontend lint with zero errors / 19 baseline
`max-lines` warnings. The persisted Section 6 comparison at `2026-10-21T00:43:04.269Z` reports
**0 regressions, 0 new failures and 5 fixes** across seven passing checks; only the six
baseline backend-lint warnings remain, so overall status stays baseline **FAILING**. Independent
review is **CLEAN — Section 6**
(`.opencode/scratchpad/review-section6-independent.md`). The Section 7 canonical documentation
audit is complete and independently review-clean (**CLEAN — Section 7**,
`.opencode/scratchpad/review-final-frontend-abclass-metadata.md`); the final regression
comparison follows this documentation-only closure and is retained under the session runs.

That **313**-test run is historical for the original set and predates the batch-1 addition. The
batch-1 Class-page delayed-list case is covered separately by the later reviewer run of **314**
browser tests and by the parent comparison in the reviewer's regression session at
`.ts-regression-checker/reports/session-feat-frontend-abclass-metadata/runs/2026-10-21T12-48-56.194Z/comparison.txt`
(**0 regressions, 0 new failures and 0 fixes** across seven passing checks; only the six baseline
backend-lint warnings fail). Its historical acceptance count remains ten cases in the 313-test
run; the reviewer's current run contains eleven browser cases including the batch-1 addition.

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

## Task preview derived shapes

> **Status: Implemented (issue #19).** Both types below now carry one required
> `readonly sourceUrl: string | null` field. It is resolved once in the lookup and
> carried unchanged through assembly and merge. Neither type is persisted and
> neither is added to any API request or response, so the standard
> [transport envelope](transport-envelope.md) still does not apply.

These are frontend-only derived types in the task-preview pipeline. They are
in-memory companions to the derived `DataAnalysisResponse`, not analyser output,
and are not validated by a Zod schema.

### `CellPreviewData` (implemented)

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
    readonly sourceUrl: string | null;
  };
}[ArtifactType];
```

| #   | Field             | Type                                     | Notes                                                                                                                                                         |
| --- | ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `artifactType`    | `ArtifactType`                           | Discriminator derived from `BaseTaskArtifactSchema['type']`, so the two cannot drift.                                                                         |
| 2   | `artifactContent` | `ArtifactContentByType<K>`               | `TEXT`/`TABLE`/`IMAGE` → `string \| null`; `SPREADSHEET` → 2D array or `null`; `base` → `unknown`.                                                            |
| 3   | `reasoning`       | `Record<HeatmapMetricKey, string\|null>` | Per-metric reasoning strings; `null` when the assessment is absent for that metric.                                                                           |
| 4   | `sourceUrl`       | `string\|null`                           | **Implemented (issue #19).** Editor link derived in the lookup, or `null` when the source is unavailable. Never persisted and never added to an API response. |

### `TaskPreviewData` (implemented)

Owner: `src/frontend/src/features/taskHeatmap/TaskPreviewCard.tsx` →
`TaskPreviewData`.

Assembled by `assembleTaskPreviewData.ts` from a `CellPreviewData` (or `null`) plus
the analyser's [`TaskDisplayMetric`](#metricresult) and metric key, then consumed by
`TaskPreviewCard`. In merged heatmaps, `assembleMergedPreviewData.ts` merges
per-assignment lookups first-wins; `sourceUrl` travels with its cell and is never
re-derived during merge.

```ts
interface TaskPreviewData {
  readonly taskId: string;
  readonly artifactType: 'IMAGE' | 'TEXT' | 'TABLE';
  readonly artifactContent: string;
  readonly metricKey: 'completeness' | 'accuracy' | 'spag';
  readonly reasoning: string;
  readonly metric: TaskDisplayMetric;
  readonly sourceUrl: string | null;
}
```

| #   | Field             | Type                                     | Notes                                                                                                                                          |
| --- | ----------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `taskId`          | `string`                                 | The heatmap column's task ID, forwarded unchanged.                                                                                             |
| 2   | `artifactType`    | `'IMAGE' \| 'TEXT' \| 'TABLE'`           | Narrowed from `CellPreviewData['artifactType']`: `SPREADSHEET` → `TABLE`, `base` → `TEXT`.                                                     |
| 3   | `artifactContent` | `string`                                 | Rendered form; `SPREADSHEET` is converted to a Markdown table, `base` becomes `''`.                                                            |
| 4   | `metricKey`       | `'completeness' \| 'accuracy' \| 'spag'` | Which metric column the preview is for.                                                                                                        |
| 5   | `reasoning`       | `string`                                 | `cellData.reasoning[metricKey] ?? ''`; empty string when no reasoning exists.                                                                  |
| 6   | `metric`          | `TaskDisplayMetric`                      | The analyser's task-display metric, except the no-submission branch substitutes the frozen `NOT_ATTEMPTED_METRIC`.                             |
| 7   | `sourceUrl`       | `string\|null`                           | **Implemented (issue #19).** Carried unchanged from the source `CellPreviewData`; `null` when `cellData` is `null` or no usable source exists. |

> **`sourceUrl` semantics (implemented, issue #19).** `sourceUrl` is an editor
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
> [Contract: Assignment §BaseTaskArtifact](assignment.md#basetaskartifact).

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
- `src/frontend/src/services/dataAnalysis/postAnalysis/postAnalysis.zod.ts` →
  `PostAnalysisContextSchema`, `PostAnalysisTaskResultSchema`,
  `PostAnalysisTaskOutcomeDataSchema` — 5B local context, strict succeeded/skipped task
  returns and serialisable lifecycle state; 5B and 5C independently review-clean (**PASS —
  CLEAN 5B** and **PASS — CLEAN 5C**), with 5C's optional failed-outcome save confirmation
  implemented. Function/Error handles remain separate typed execution values, never transport
  fields.

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

The Batch 1 reconciliation
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
4. **Aligned** — Section 4 projects the analyser's four-state union into the distinct
   ABClass score union explicitly, mapping excluded/null to literal `excluded`. The
   metadata schema enforces finite 0–5 computed values, while `MetricResultSchema.value`
   remains `z.number()` without those bounds; out-of-range projection fails metadata
   validation, never clamps or rounds. Assignment refresh timestamps are intentionally
   stricter than the existing nullable-string read shape; see
   [ABClass known discrepancy 9](abclass.md#known-discrepancies).

   > Previously undocumented boundary narrowing — surfaced during the 20 October 2026
   > Section 4 data-shapes audit. Origin: the new frontend projection/writer, with no
   > analyser or backend schema change.

5. **Aligned** — 5B's metadata descriptor translates writer `saved`/`classPartial` into shared
   `succeeded`/`confirmedPersistence` state, without persisting the display result or
   transporting local Errors/functions. Context identity equality is checked by the
   hook; completeness and successful-run provenance remain caller responsibilities.
6. **Aligned (resolved)** — `PostAnalysisTaskResultSchema` now admits only strict
   succeeded/skipped results, and the runner parses it before adding descriptor-owned
   `taskId` and validating outcome data. The former wider outcome-only parse accepted
   untyped pending/failed task returns with `error: null`; both now become runner-owned
   failed outcomes with non-null local Errors, without blocking later tasks. Types derive
   from the result schema, whose variants are reused by the outcome schema.

   > Previously undocumented — surfaced during the 20 October 2026 5B data-shapes audit.
   > Origin: the new runner reusing the state schema for execution results. Resolved by
   > the subsequent frontend audit fix; two red-first runner cases cover pending/failed
   > rejection and continued execution. This documentation pass changes no production code;
   > independent 5B review subsequently returned **PASS — CLEAN** in
   > `.opencode/scratchpad/review-section5b-final-clean.md`.

7. **Aligned** — 5C permits `confirmedPersistence?: true` on failed lifecycle data,
   without widening `PostAnalysisTaskResultSchema`. Post-save query refresh failure
   retains a non-null local normalised Error and save confirmation; feedback selects
   saved-but-refresh-failed copy instead of claiming the save failed. False/null flags,
   failed/pending task returns and serialised technical handles remain invalid.

   > Surfaced during the 20 October 2026 5C data-shapes audit. Origin: the intentional
   > frontend-only refresh-settlement extension. No backend, envelope or analyser shape
   > change; 5C independent review is **PASS — CLEAN** (`.opencode/scratchpad/review-section5c-independent.md`).

8. **Aligned** — Batch 1 makes class ownership explicit and independent of analysis
   readiness. `usePostAnalysisTasks` requires the committed `selectedClassId` as its third
   argument; a `null` context for the same class clears published state but does not destroy
   feedback or detach a pending attempt, while a changed/deselected class and unmount still
   suppress late feedback. The notification host is the required
   `App.useApp().notification` context with no production no-host fallback. Refresh-failure
   diagnostics also carry the bounded scalar `confirmedPersistence: true`. This changes local
   lifecycle execution only: no persistence, request, response, envelope or analyser shape
   changes.

   > Surfaced during batch-1 remediation of the 21 October 2026 pre-PR review (EH-1/RRC-1).
   > No wire or persistence change; the added Class-page browser case is independently
   > browser-verified by the reviewer's full 314-test run, with 0 regressions and 0 new
   > failures in the parent comparison at `2026-10-21T12-48-56.194Z`. Overall review sign-off,
   > commit and push remain outstanding.

## Planned contract additions (Not implemented, issue #305)

**Status: `Not implemented`** — planned-only entries to support the top-decile
attempt-baseline analysis mode. These describe the target contract; update this
section to remove the marker as each addition is implemented and verified.

1. **`AnalysisFilterSchema.analysisMode`** — required enum field
   `z.enum(['absolute', 'topDecileBaseline'])` on the existing strict filter
   object. There is no default; every caller states the mode explicitly.
   `'absolute'` is the explicit representation of current behaviour.

2. **`AveragingResultSchema.appliedAnalysisMode`** — required echo enum
   (same two values) recording the mode actually applied to the per-class
   result.

3. **`AveragingResultSchema.attemptBaseline`** — optional strict object present
   only when `appliedAnalysisMode` is `'topDecileBaseline'`:

   ```ts
   attemptBaseline: z.strictObject({
     poolStudentIds: z.array(z.string()).min(2),
     baselineTaskKeys: z.array(z.string().min(1)).min(1),
   }).optional(),
   ```

   Domain rules (produced by the planned baseline-selection
   post-accumulation derivation; not Zod refinements):
   - Candidates = roster students with at least one attempted task within the
     analysis input's in-scope assignments; pool = top
     `min(|candidates|, max(2, ceil(0.1 × rosterSize)))` candidates by count of
     **distinct** attempted task keys (same `buildTaskKey` unit as
     `baselineTaskKeys`); ranking ties break by `studentId` ascending. The mode
     is unavailable when fewer than 2 candidates exist or the roster is below
     3 students.
   - Attempted = the submission item yields at least one numeric criterion
     score; all-`N` items, missing assessment criteria (the `E` condition), and
     absent items are not attempts. Criterion weighting plays no part.
   - Baseline task keys = intersection of the attempt sets across the whole
     pool. An empty intersection throws (descriptive error naming the class)
     before any result is produced, so the schema `min(1)` is protected.
   - The baseline-selection derivation is recommended as a
     **post-accumulation** pass over the analyser's accumulators (whose
     per-criterion `displayCount` already encodes the attempt signal); it is
     not a separate raw-data pre-pass.
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

4. **`PerTaskRowSchema.includedInAttemptBaseline`** — required boolean always
   present on task rows. `true` for every row in `absolute` mode; in baseline
   mode it marks baseline-set membership. Per-task row _values_ stay absolute
   in both modes. **Per-student cell metrics carry no flag:** columns are the
   only marked heatmap unit (column-level marking in v1; see item 8), so
   `PerStudentTaskMetric` is unchanged. The array's **contents are also
   mode-independent**: baseline filtering restricts only the aggregation step,
   so `perStudentTaskMetrics` carries every observed (student, task) pair in
   both modes (byte-identical arrays, pinned by a red-first analyser test) —
   availability and heatmap substitution paths therefore see identical
   evidence regardless of mode.

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
   with the same observed-evidence semantics as
   item 3; an already-`excluded` zero-weight rollup keeps its weighting
   cause. Criteria with no observed evidence stay `error` (no `excluded` is
   synthesised), the existing `rows.length === 0 → N` no-per-task-rows
   placeholder branch is untouched, and the converted **per-criterion**
   results flow through the existing `computeOverallComposite` (the composite
   itself is never converted): the card `average`'s resolved `totalDataPoints`
   is the sum of the converted criteria's counts, all-`error` rows stay
   `error`, and any mixture with a converted criterion converges on
   `excluded`.

7. **Display-only additions (no schema change):** the `excluded` aggregate
   state now legitimately carries two causes (zero weighting vs baseline
   exclusion); the accessible label is made mode-aware at the `metricDisplay`
   layer (`metricTone`/`MetricPill`/`studentAveragesTableColumns`) without
   widening any shape — in baseline mode the label names **both** possible
   causes in one truthful wording, so no cause field exists. The Heatmaps-page
   pipeline (`heatmapsPipeline.ts`)
   never enters baseline mode (its input states
   `analysisMode: 'absolute'`), so its `includedInAttemptBaseline` flags are
   always `true` there. The Class page's embedded single-assignment heatmap
   inherits the Class page's analysis result and therefore may render `false`
   markers in baseline mode while keeping absolute cell values.

8. **Heatmap projection addition (planned, `Not implemented`):**
   `HeatmapTaskColumn` gains `includedInAttemptBaseline: boolean`, set in
   `heatmapAdapter.ts` from a required second `buildTaskColumns` parameter
   typed `ReadonlySet<string> | null` (`null` = absolute mode: every column
   included). **The supplier is `adaptMetricsToHeatmap`** — the only caller
   that receives a mode-bearing `analyserResult` and therefore the only
   caller that can supply a non-null baseline set: baseline mode →
   `new Set(analyserResult.attemptBaseline.baselineTaskKeys)` under the
   Baseline narrowing rule's fail-fast; absolute mode → `null`. No props
   change hands because `adaptMetricsToHeatmap` is called only from
   `TaskHeatmapPage`, which runs only inside the Class page. The merged chain
   (three links: `adaptMetricsToMergedHeatmap` →
   `buildMergedTaskColumnsInClassOrder` → `buildMergedTaskColumns` →
   `buildTaskColumns`) passes `null` explicitly at each hop.
   `MergedHeatmapTaskColumn` inherits the field via
   its existing spread of the base projection. `HeatmapCell` is unchanged:
   marking is **column-level only in v1**, and cell values stay absolute in
   both modes.

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

Metadata refresh execution companions (Section 4 complete and independently review-clean; zero new regressions):
├── `src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.ts` → pure decision, shared newest-first comparator, metric mapping, non-nullable rolling merge; `MetadataRefreshSkipped`, `MetadataRefreshDecision`
├── `src/frontend/src/services/dataAnalysis/postAnalysis/refreshABClassMetadata.ts` → task entrypoint consuming the shared `PostAnalysisContext`; no task-local context type
└── `src/frontend/src/services/abClass/abClassMetadataService.ts` → reserved-slot writer; `MetadataRefreshInput`, `RefreshOutcome`, shared lane constant reservation

Shared lifecycle companions (5B and 5C independently review-clean):
├── `src/frontend/src/services/dataAnalysis/postAnalysis/postAnalysis.zod.ts` → `PostAnalysisContextSchema`, `PostAnalysisTaskResultSchema`, `PostAnalysisTaskOutcomeDataSchema`, inferred data types
├── `src/frontend/src/services/dataAnalysis/postAnalysis/runPostAnalysisTasks.ts` → ordered runner, ID validation, local descriptor/result/outcome types
├── `src/frontend/src/services/dataAnalysis/postAnalysis/postAnalysisTasks.ts` → canonical metadata task ID, clock-injected metadata-only descriptor factory, shared source-version signature and attempt key
├── `src/frontend/src/services/dataAnalysis/postAnalysis/postAnalysisDiagnostics.ts` → bounded task/refresh failure identifiers, shared comparator, available correlation and optional `confirmedPersistence: true`
├── `src/frontend/src/hooks/usePostAnalysisTasks.ts` → post-commit mount-owned attempt/state lifecycle with required selected-class ownership, including post-save settlement
├── `src/frontend/src/hooks/usePagePostAnalysisTasks.ts` → shared ready-only page eligibility/context wrapper; memoised context and once-per-mount descriptor list for both averaging surfaces
├── `src/frontend/src/hooks/postAnalysisInvalidation.ts` → both required query invalidations; refresh failures log bounded `confirmedPersistence: true` and return a confirmed-persistence failed outcome
└── `src/frontend/src/hooks/postAnalysisFeedback.ts` → mount/selected-class/task/source-owned persistent warnings with required App host, dismissal memory and cleanup

Production consumer activation (5D): **complete and independently review-clean**; both
averaging surfaces invoke the shared page hook `usePagePostAnalysisTasks` with memoised unsliced
context, and the Section 5 comparison reports 0 regressions, 0 new failures and 5 fixes.
Frontend Section 6's test-only browser and dispatcher acceptance work is complete and
independently review-clean (**CLEAN — Section 6**), with fresh reviewer runs passing the
complete browser suite at **313 tests** with `--retries=0`, the full synthetic project at
**34 files / 384 tests**, all-project type-checking and verify-only frontend lint (zero errors /
19 baseline warnings). Its persisted comparison at `2026-10-21T00:43:04.269Z` reports
**0 regressions, 0 new failures and 5 fixes**; only the six
baseline backend-lint warnings remain, so overall status stays baseline **FAILING**. The
Section 7 canonical documentation audit is complete and independently review-clean (**CLEAN —
Section 7**, `.opencode/scratchpad/review-final-frontend-abclass-metadata.md`); the final
regression comparison follows this documentation-only closure and is retained under the session
runs.

Frontend Section 6 test-only acceptance (implemented; original set independently review-clean;
batch-1 addition independently browser-verified; historical comparison 0 regressions / 0 new
failures / 5 fixes, baseline FAILING only for backend lint):
├── `src/frontend/e2e-tests/helpers/post-analysis-metadata-scenarios.ts` → canonical small class-2 historical-boundary and later-version browser queues
├── `src/frontend/e2e-tests/post-analysis-metadata.persistence.spec.ts` → three changed-write journeys
└── `src/frontend/e2e-tests/post-analysis-metadata.feedback.spec.ts` → eight save/refresh feedback and viewport/theme cases (the Class-page delayed-list readiness case is independently browser-verified in the reviewer's 314-test run)

Task preview derived shapes (implemented, issue #19):
├── `src/frontend/src/features/taskHeatmap/buildCellPreviewLookup.ts` → `CellPreviewData` (owner)
├── `src/frontend/src/features/taskHeatmap/assembleTaskPreviewData.ts` → `TaskPreviewData` assembly
├── `src/frontend/src/features/taskHeatmap/assembleMergedPreviewData.ts` → merged lookup/status
└── `src/frontend/src/features/taskHeatmap/TaskPreviewCard.tsx` → `TaskPreviewData` (owner)
