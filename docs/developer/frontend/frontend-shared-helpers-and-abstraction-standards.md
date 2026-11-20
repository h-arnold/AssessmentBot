# Frontend Shared Helpers and Abstraction Standards

This document is the policy for shared-helper discovery and abstraction decisions in `src/frontend`. For topic-specific docs, see [Other canonical docs](#8-relationship-to-other-canonical-docs).

## 1. Purpose and scope

Use this policy to decide whether to:

- reuse an existing helper
- extend an existing helper
- keep logic local
- extract a new shared helper

It applies to production frontend source under `src/frontend/src/**`.

## 2. Reuse-first rule

Before creating any new helper, you must:

1. identify the behaviour you want to share
2. check the [canonical helper map](#canonical-helper-map-check-these-first)
3. prefer extending an existing helper when it keeps that helper coherent
4. create a new helper only when no suitable helper exists

Do not create a new helper only to move code out of a large file.

## Canonical helper map (check these first)

### 3.1 Server-state and query contracts

- Query keys: `src/frontend/src/query/queryKeys.ts`
- Shared query definitions and warm-up contracts: `src/frontend/src/query/sharedQueries.ts`
- `getStartupWarmupQueryOptions()` public export: `src/frontend/src/query/sharedQueries.ts`
- Query invalidation helpers: `src/frontend/src/query/queryInvalidationHelpers.ts`
- Query client foundation/provider: `src/frontend/src/query/queryClient.ts`, `src/frontend/src/query/AppQueryProvider.tsx`

### 3.1a Hooks and derivation helpers

- Page dataset-state hook: `src/frontend/src/hooks/usePageDataset.ts`.
- Shared neutral blocking-reason resolver: `computeDatasetBlockingReason` / `DatasetBlockingReason`, also in `usePageDataset.ts`. The discriminated reason (`none` | `failed` | `untrustworthy` | `queryError`) lets `classPage` (`useClassPageData.helpers`) and the standalone Heatmaps surface (`heatmapsSurfaceState`) derive feature-specific blocking errors from one precedence decision.
- Once-only conditional callback hook (React 19 StrictMode-safe): `src/frontend/src/hooks/useLogOnce.ts`.
- Shared post-analysis extension point: `src/frontend/src/hooks/usePostAnalysisTasks.ts` owns the generic context/outcome lifecycle; schemas and the ordered runner live under `services/dataAnalysis/postAnalysis/`.
- Page eligibility wrapper: `src/frontend/src/hooks/usePagePostAnalysisTasks.ts` builds a memoised context only when the surface is `ready` with complete class, live definitions and a successful averaging result, creates the descriptor list once per mount and forwards the committed selected class ID. Both averaging surfaces call it directly. Register future tasks once in `createPostAnalysisTaskDescriptors` and import actual owners directly, without a facade or barrel. See [lifecycle and registration rules](data-analysis-architecture.md#shared-post-analysis-lifecycle-and-extension).
- Post-analysis feedback: `hooks/postAnalysisFeedback.ts` owns mount/class-scoped notification identity and dismissal memory using the required `App.useApp().notification` host. See the [feedback contract](frontend-logging-and-error-handling.md#post-analysis-metadata-failures).
- Post-analysis invalidation: `hooks/postAnalysisInvalidation.ts` completes confirmed metadata saves with both required query settlements inside the cached attempt. See the [query contract](frontend-react-query-and-prefetch.md#post-analysis-metadata-invalidation).
- Task diagnostics: `services/dataAnalysis/postAnalysis/postAnalysisDiagnostics.ts`.

### 3.2 Error and transport helpers

- Unknown-error helpers: `src/frontend/src/errors/normaliseUnknownError.ts` exports `normaliseUnknownError` (plain payload) and `toError` (concrete `Error` instance).
- Blocking-load trust-boundary helper: `src/frontend/src/errors/blockingLoadError.ts`
- Shared blocking-error → `Result` config resolver and `BlockingConfig` type: `src/frontend/src/errors/blockingConfig.ts` (per-feature copy maps supply the error-specific titles; the resolver mechanism is shared)
- Transport error contract: `src/frontend/src/errors/apiTransportError.ts`
- Frontend logger and redaction/normalisation flow: `src/frontend/src/logging/frontendLogger.ts`.
- Heatmaps pipeline and assembly diagnostics route through the bounded-dedupe `logPipelineError` wrapper in `src/frontend/src/features/taskHeatmap/heatmapsPipeline.ts`, so an identical diagnostic raised on a memo recomputation is logged once.
- API transport: `callApi`, `parseApiResponse` and `ApiRequestSchema` in `src/frontend/src/services/apiService.ts`. Import transport symbols directly from this owner.
- Sequential API request/local-task queue: `callApiQueued`, `runApiQueuedTask`, `getQueueState`, `cancelApiQueued` and `QueueState` in `src/frontend/src/services/api/apiQueue.ts`. Import directly from this owner and extend this queue rather than adding a parallel one.
- Ordinary calls and local tasks share one Map/Set registry with FIFO ordering per job name; different jobs run in parallel. `runApiQueuedTask(jobName, task)` reserves the lane across the callback's full operation, including awaited read/merge/write work. Synchronous throws and asynchronous rejections preserve the original failure and release the lane. Cancellation rejects pending entries with `{ reason: 'CANCELLED' }` without executing their callbacks while active work continues.
- Callbacks and their results stay local, never GAS payloads. Network work inside a task uses `callApi` directly. Never await another enqueue on the same lane inside a task: it deadlocks behind the reserved slot.

### 3.3 Feature-shared helpers (existing local precedents)

- Class-page assignment warm-up: `src/frontend/src/features/classPage/useClassPageAssignmentPrefetch.ts` owns the ready-only effect, per-instance class guard and top-three limit; `useClassPageData` calls it directly. Keep it feature-local. See the [prefetch contract](frontend-react-query-and-prefetch.md#current-view-entry-prefetches).
- Heatmaps preview-query support: `src/frontend/src/features/taskHeatmap/heatmapsPreviewQueries.ts` owns `buildDisabledQueryOptions<T>(queryKey)` (`skipToken`, returning `UseQueryOptions<T, Error>` without a cast), `buildPreviewInput`, `buildPreviewInputsByAssignmentId` (id-keyed pairing that synthesises a pending input for a deferred assignment with no urgent-keyed result), the stable empty lookup and `AssignmentPreviewCombined`.
- Query callbacks, memoised assembly, refresh wiring and diagnostics stay in `useHeatmapsPageData`; live definition analysis stays in its existing pipeline. Keep this support feature-local.
- Classes table shaping/filtering helpers: `src/frontend/src/features/classes/table/ClassesTable.helpers.ts`
- Classes bulk-mutation orchestration helper (sequential FIFO): `src/frontend/src/features/classes/bulk/runQueuedBatchMutation.ts`
- Classes batch-mutation shared types: `src/frontend/src/features/classes/bulk/batchMutationEngine.ts`
- Classes metadata bulk-update helper: `src/frontend/src/features/classes/bulk/bulkMetadataUpdateFlow.ts`
- Classes query refresh and invalidation contract helpers: `src/frontend/src/features/classes/bulk/queryInvalidation.ts`
- Classes bulk-mutation outcome resolution: `src/frontend/src/features/classes/bulk/bulkMutationResolution.ts` — turns settled batch results into the alert, close and refresh-required UI state.
- Classes bulk-mutation failure copy: `src/frontend/src/features/classes/bulk/bulkMutationFailureMessages.ts` owns `BulkFailureMessageCopy` and the action-specific failure-message builders (shared, create, delete, set-active, set-inactive, metadata) plus their user-facing copy.
- `bulkMutationResolution.ts` re-exports these bindings for existing consumers; new call sites import them from the owning module.
- Reference-data workflow helpers: `src/frontend/src/features/referenceData/manageReferenceDataHelpers.ts`
- Year-group presentation ordering: `src/frontend/src/features/referenceData/yearGroupSorting.ts` — source of truth for immutable, natural year-group ordering.
- Classes bulk form modal scaffold: `src/frontend/src/features/classes/bulk/BulkFormModalScaffold.tsx` — three-caller shell owning reset-on-cancel, submit-on-OK, inline submission error rendering, and busy semantics.
- Reference-data modal family: `ReferenceDataManagementModalScaffold.tsx`, `manageReferenceDataDialogs.tsx`, `InlineDialog.tsx`, and `ReferenceDataInitialLoadingState.tsx` (under `src/frontend/src/features/referenceData/`) — extend this family for new reference-data modals rather than composing a fresh shell.
- Cross-feature re-run entry contract: `src/frontend/src/features/shared/reRunAssessmentContext.ts` — `ReRunContext` lives in `features/shared` so `features/taskHeatmap/**` never imports `features/classPage/**`.
- Cross-feature baseline-availability type: `src/frontend/src/features/shared/baselineAvailability.ts` — `BaselineAvailability` lives in `features/shared` (resolved by `classPage`, consumed by `taskHeatmap` and the shared control) under the same dependency rule.
- Cross-feature averages-basis mode props: `src/frontend/src/features/shared/averagesBasisModeProps.ts` — `AveragesBasisModeProps` (optional `analysisMode`, `onAnalysisModeChange`, `baselineAvailability`) lives in `features/shared` (threaded by `classPage`, consumed by `taskHeatmap` and the shared control) under the same dependency rule.

Feature-scoped helpers should stay feature-scoped unless there is proven cross-feature reuse.

### 3.4 Shared test helpers

Shared test-helper modules (fixtures, mock setup, harnesses, assertion helpers) are inventoried once in [Frontend Testing](frontend-testing.md#shared-test-helpers); add new modules there.

- Production page copy for assertions: `src/frontend/src/pages/pageContent.ts` — reuse the stable headings and summaries from here instead of mirroring them in tests.

Test helper placement rules remain governed by `docs/developer/frontend/frontend-testing.md`.

### 3.5 Shared presentational components

- `PageNavCard` `wrapActions`: opt-in action wrapping on `components/PageHeader/PageHeader.tsx`. True enables outer Flex wrapping with `gap={APP_GAP_SM}` (8px) and action Space wrapping with existing tight spacing; omitted/false keeps current layout. Only `TaskHeatmapPage`'s normal navigation opts in; its title-error branch stays unchanged. Wrapped single-item rows are left-aligned.

- `ImageRenderer`: shared presentational component at `src/frontend/src/components/ImageRenderer/ImageRenderer.tsx`. Renders a base64 data URL as a constrained `<img>` (maxWidth 100%, height auto, maxHeight 400, default alt "Student response image").
- `MarkdownRenderer`: shared presentational component at `src/frontend/src/components/MarkdownRenderer/MarkdownRenderer.tsx`. Renders markdown text and tables via `react-markdown` + `remark-gfm` (no `rehype-raw`, for XSS safety), with co-located CSS for basic table styling.
- `AveragesBasisControl`: shared presentational component at `src/frontend/src/components/AveragesBasisControl/AveragesBasisControl.tsx`, with `renderAveragesBasisControlExtra.tsx` guarding the host-card `extra`. Promoted to `components/` because two features host it — `classPage`'s Student Averages card and `taskHeatmap`'s table card. Its visible label is `sr-only`; the accessible name stays `Averages basis`.

### 3.6 Student-name helpers

- `splitStudentName` and `compareStudentNamePart`: `src/frontend/src/utils/splitStudentName.ts`. See their JSDoc for signatures and behaviour.
- Consumers: the Student Averages table (`features/classPage/studentAveragesTableColumns.tsx` and `features/classPage/classPageModel.ts`) and the Task Heatmap table (`features/taskHeatmap/TaskHeatmapTable.tsx`).
- **Standing requirement:** all tables displaying a student name use Forename and Surname columns derived via this shared helper. Default ordering stays full-name ascending through `compareStudentNames`.
- Shared Forename/Surname Ant Design columns: `buildStudentNameColumns<Row>()` at `src/frontend/src/features/shared/studentNameTableColumns.tsx`, the column counterpart consumed by the two tables above. It takes no column options and always emits `fixed: 'start'` on both columns, which every consumer needs.
- `splitStudentName.ts` is pure: no React, Ant Design, I/O, or state dependencies. `studentNameTableColumns.tsx` imports Ant Design `Typography` and renders JSX.

### 3.7 Data analysis display and projection helpers

- Metric display family: `src/frontend/src/services/dataAnalysis/metricDisplay/` — `resolveMetricTone` and `MetricPill.tsx` (colour and tone), `metricDisplayText.ts` (`formatMetricDisplayText`), `metricComparator.ts` and `metricStateRank.ts` (state-aware column ordering), and the score-range filter helpers (`metricRangeKey.ts`, `metricRangeFilter*.tsx`). One shared vocabulary for metric colour, text, ordering and filtering across the Class page and the task heatmap. The colour and label contract (including the `MetricToneColor` union) is shared across specs; do not restate or retype it per feature.
- Student-name row ordering: `src/frontend/src/services/dataAnalysis/compareStudentNames.ts`. Callers consume it directly; the Forename/Surname column comparator stays in [Student-name helpers](#36-student-name-helpers).
- Heatmap projection: `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts` and `heatmapAdapter.merged.ts` define the shared `AveragingResult` → heatmap boundaries; feature-local heatmap helpers stay under `src/frontend/src/features/taskHeatmap/`. The analyser package and `taskKey.ts` inventory lives in `docs/developer/frontend/data-analysis-architecture.md`.

### 3.8 Assignment and definition helpers

- Assignment transport: `src/frontend/src/services/assignmentAssessment/` — the `getAssignment` service (`assignmentAssessmentService.ts`) plus `AssignmentFullSchema` / `AssignmentFullResponseSchema` validation (`assignmentAssessment.zod.ts`).
- Assignment-read normalisation owners: `src/frontend/src/services/assignmentAssessment/assignmentReadNormalisation.ts` (`normaliseAssignmentRead` / `normaliseClassRead`), `assignmentReadItemValidation.ts` (per-item/source validation, corruption replacement, safe diagnostic paths) and `assessmentResult.zod.ts` (full/partial result, score and cause schemas).
- Each read service performs a cheap root-only `parseApiResponse` stub parse with the collection emptied, then calls the normaliser, which validates each item once and assembles the typed result. Import these owners directly; there is no barrel.
- Effective weighting: `src/frontend/src/services/assignmentDefinition/assignmentDefinitionUtilities.ts` — `TaskWeightingIndex` and `computeEffectiveWeight`, the single effective-weight resolver for analyser accumulation and heatmap column projection.
- Assignment-weighting coercion: `src/frontend/src/services/assignmentDefinition/assignmentDefinitionUtilities.ts` — `coerceAssignmentWeighting(value: unknown): number`, which returns every primitive number unchanged and falls back to the schema-owned `DEFAULT_WEIGHTING_VALUE` only for non-numbers. It is **distinct from `computeEffectiveWeight`** (different nullable/validation semantics) and is the form-level coercion consumed by the wizard dirty checks, the save/reparse builders and recovery approval. The legacy `assignmentWizardFormState.ts` export path re-exports the same binding and must be retained for existing consumers.

### 3.9 Shared input components

- `SelectWithAddNew`: Ant Design `Select` wrapper at `src/frontend/src/components/SelectWithAddNew/SelectWithAddNew.tsx` that appends one `Add new` sentinel option. Consumers: `features/classes/bulk/BulkCreateModal.tsx`, `features/classes/bulk/BulkSetSelectModal.tsx` and `features/assignmentWizard/AssignmentDefinitionWizardReviewContent.tsx`.
- Selecting the sentinel is an immediate **command**, not a value: `onAddNew` is called synchronously and the sentinel is never forwarded through `onChange`. The wrapper has no `debounceMs` prop; `useDebounce` keeps its other callers.
- A controlled `value` prop (detected by property presence, so explicit `undefined` counts) stays authoritative, and a nullish value reaches Ant Design as `null` so its internal sentinel cannot leak. Without `value`, the wrapper tracks the normal selection itself, seeded from `defaultValue`; `onChange`, `allowClear` and `labelInValue` payloads keep their original shape, including the labelled `{ value, label }` object.
- The caller owns the manager-modal open state and its open transition is idempotent. The wrapper belongs in `components/` because it is cross-feature; its value handling stays local to it.

<a id="928-frontend-abclass-metadata-and-post-analysis"></a>

### 3.10 ABClass metadata schema

- ABClass metadata schema family: `src/frontend/src/services/abClass/abClassMetadata.zod.ts` is the frontend owner of the ABClass wire metadata contract. `ABClassMetadataSchema` validates the nullable whole value; `NonNullableABClassMetadataSchema` validates a complete non-null snapshot for merge/write paths.
- `ClassAveragesSchema`, `AverageScoresSchema`, `RecentAssignmentSchema`, `CanonicalMetadataTimestampSchema` and their inferred types are exported for the class-read, mutation and post-analysis owners.
- Raw own-key/plain-prototype checks run before Zod copies input. Validation enforces canonical UTC timestamps, the numeric-or-`N`/`E`/`excluded` score union, dense zero-to-three recent entries, unique assignment IDs and newest-first non-increasing timestamps. Do not duplicate these rules in a consumer.
- `ClassPartialSchema` and `ClassFullSchema` require metadata as a whole and nullable, with no frontend default.
- Mutation request schemas: `src/frontend/src/services/abClass/abClassMutations.zod.ts` exports `UpsertABClassRequestSchema`, `UpdateABClassRequestSchema` and inferred request types.
- Upsert requires `classId`, non-null string `cohortKey`/`yearGroupKey` and a positive safe-integer `courseLength`; null keys reject, matching backend `Validate.requireParams`. Update requires `classId` and permits optional nullable cohort/year-group keys, optional positive safe-integer `courseLength` and optional nullable boolean `active`. Explicit nulls survive only for nullable update fields.
- Strict own-key checks reject supplied undefined, protected roster/assignment fields and unknown keys before enqueue; no coercion or defaults apply. Metadata remains optional and nullable for both mutations: omission preserves the stored value, null clears it, and a supplied snapshot replaces it whole through the shared metadata schema, detached before queueing. Nested metadata patches reject.
- Queued mutation wrappers: `src/frontend/src/services/abClass/abClassMutationService.ts` exports `upsertABClass`, `updateABClass` and the `CLASSES_BULK_MUTATION_JOB_NAME` lane symbol. Both wrappers validate before admission to the `classesBulkMutation` FIFO, then parse the response through `parseApiResponse(ClassPartialSchema, ...)`. Reserved-slot owners import the lane constant instead of repeating the string; import these owners directly. Await these wrappers only outside an active reservation on the same lane.
- Pure metadata refresh helpers: `services/dataAnalysis/postAnalysis/metadataProjection.ts` owns `getMetadataRefreshDecision`, `compareAssignmentNewestFirst`, `projectAverageScores` and `mergeClassMetadata`: canonical source-time gating, shared newest-first/ID ordering, unrounded score/marker projection and stable newest-first rolling history capped at three assignment instances. `mergeClassMetadata` validates its replacement through `NonNullableABClassMetadataSchema` and returns the non-null snapshot directly.
- Metadata task identity: `services/dataAnalysis/postAnalysis/postAnalysisTasks.ts` owns `REFRESH_AB_CLASS_METADATA_TASK_ID`, `createPostAnalysisTaskDescriptors`, `sourceVersionSignature` and the metadata attempt key. Feedback, invalidation and diagnostics import the task-ID constant; diagnostics reuse the metadata comparator. Do not duplicate the task-ID literal or the canonical newest-first ordering.
- Metadata task entry: `services/dataAnalysis/postAnalysis/refreshABClassMetadata.ts` owns `refreshABClassMetadata(context: PostAnalysisContext, now)`, which skips unchanged/stale/empty cached sources before enqueue, calculation or clock access. It uses the shared schema-derived context and delegates changed candidates to `services/abClass/abClassMetadataService.ts` (`refreshABClassMetadataInQueue`).
- The writer reserves the `CLASSES_BULK_MUTATION_JOB_NAME` lane across fresh full read, authoritative recheck, full-class and isolated-target standard-weight analysis, complete metadata update and real partial-response parsing. Both averaging surfaces call the shared page hook directly with the unsliced class and committed class ID. See [Data Analysis Architecture](data-analysis-architecture.md#metadata-refresh-task-and-persistence) for cache limitations and session-local guarantees.

## Extraction decision rules

### 4.1 Keep logic local when

- there is one call site and no clear independent contract
- extraction would only rename existing code without removing duplication
- extraction introduces a large prop or argument pass-through surface

### 4.2 Extend an existing helper when

- the new behaviour matches the helper's existing responsibility
- call sites already depend on that helper contract
- extension reduces repeated logic in active call paths

### 4.3 Create a new helper when

- at least two active call sites need the same behaviour now, or
- one call site exists now but a documented near-term second call site is in the accepted scope, and
- the helper owns a coherent contract (not only a pass-through wrapper)

## 5. Anti-patterns to reject

Reject these patterns during implementation and review:

- single-caller wrapper extraction that does not own an independent contract
- duplicated orchestration skeletons copied across handlers instead of descriptor-driven derivation
- a parallel derivation, preview or query path beside an existing owner
- duplicated routing render sources for the same navigation key set
- mirrored validation error state where two stores track the same errors without distinct responsibilities
- ad-hoc helper modules created without checking the canonical helper map

### Library behaviour notes

- `Select.optionRender` exposes no `selected` flag; derive option state from controlled-value membership.
- Expose a disabled control's reason both as a hover `Tooltip` and an sr-only `aria-describedby` node, with an intermediate `<span>` around the `Tooltip`'s cloned child so the binding survives.
- `Table.defaultSortOrder` does not apply the initial sort in the installed version; pre-sort `dataSource` (for example `rows.toSorted(compareStudentNames)`).
- A disabled `Button` needs a `<span>` wrapper for its tooltip, because `Tooltip` does not trigger on a disabled button.
- Ant Design `Select` advances its internal selection before `onChange` runs, so intercepting the `Add new` sentinel in `onChange` alone cannot stop it appearing as the displayed label; `SelectWithAddNew` owns its own selection.

## 6. Placement and naming

- Keep cross-feature helpers in stable shared domains (`query`, `errors`, `logging`, `services`) when the contract is genuinely cross-feature.
- Keep feature-specific helpers inside the owning feature folder.
- Name helpers by the contract they provide, not by where they were extracted from.
- Prefer explicit function exports and typed return contracts.
- Folder conventions, including service-folder grouping and the `utils/` layout: `docs/developer/frontend/frontend-architecture.md`.

## 7. Review and PR checks

For frontend changes that add or modify helpers, include a short helper audit in the PR description:

- which existing helpers were checked
- whether logic was reused, extended, kept local, or extracted
- why extraction was justified when a new helper was introduced

Reviewer checks:

1. no unjustified one-caller abstraction extraction, and no duplicated shared-helper logic (treat duplicated helper logic as a Critical review issue)
2. no duplicated orchestration added where descriptor/config derivation is feasible
3. no duplicate source of truth for routing/render mapping
4. no duplicated validation-error source of truth without explicit contract boundaries

## 8. Relationship to other canonical docs

This document defines helper discovery and abstraction rules.

Use topic-specific docs for runtime policy details:

- Frontend component agent guidance: `src/frontend/AGENTS.md`
- React Query and prefetch policy: `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- Loading, width, and busy-state semantics: `docs/developer/frontend/frontend-loading-and-width-standards.md`
- Logging and error-handling policy: `docs/developer/frontend/frontend-logging-and-error-handling.md`
- Testing helper and harness policy: `docs/developer/frontend/frontend-testing.md`
- Shell navigation and motion policy: `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

## 9. Planned helper entries

### 9.28 Class summary and ABClass metadata enrichment

All entries below are delivered. Apply the reuse-first rule above when reviewing them.

- Metadata schema owner (`extend`): `src/frontend/src/services/abClass/abClassMetadata.zod.ts` — the single frontend ABClass metadata schema owner referenced by `ClassFullSchema`, `ClassPartialSchema` and the mutation schemas, extended in place rather than duplicated in a second schema. Both `ABClassMetadataSchema` and `NonNullableABClassMetadataSchema` accept the legacy two-field and current five-field inputs and emit the five-field shape with three enumerable `null` placeholders, matching backend read normalisation. See the [ABClass metadata contract](../data-shapes/abclass.md#sub-entity-abclassmetadata).
- `ClassSummaryAnalyser` (`new`): `src/frontend/src/services/dataAnalysis/classSummaryAnalyser.ts` with adjacent `classSummary.zod.ts` — single owner for summary calculation, registered in `DataAnalysisService` in its own `classSummaryAnalyser` field so the writer and future consumers call `analyseClassSummary()`. It composes `AveragingAnalyser` and reuses its exported `rollupMetric`, `computeOverallComposite` and `convertToBaselineExcluded` helpers; all new calculation stays in the service.
- `mergeClassMetadata` (`extend`): `src/frontend/src/services/dataAnalysis/postAnalysis/metadataProjection.ts` — single owner of rolling history, now `mergeClassMetadata(previous: ABClassMetadata, summary: ClassSummary, summaryUpdatedAt: string)`. It maps all five metadata fields from the `ClassSummary` through `projectAverageScores()` (class averages and baseline averages with the summary clock, always-non-null `allTaskStandings`, nullable baseline standings, and the rolling `recentAssignments`), keeps the rolling-three, target replacement and newest-first rules unchanged, trims each standing's `recentAssignmentScores` to the persisted history length newest-first, and validates the replacement through `NonNullableABClassMetadataSchema`.
