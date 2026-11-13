# Frontend Shared Helpers and Abstraction Standards

This document is the canonical policy for shared-helper discovery and abstraction decisions in `src/frontend`.

Use it alongside:

- `src/frontend/AGENTS.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

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
2. check the canonical helper locations in Section 3
3. prefer extending an existing helper when it keeps that helper coherent
4. create a new helper only when no suitable helper exists

Do not create a new helper only to move code out of a large file.

## 3. Canonical helper map (check these first)

### 3.1 Server-state and query contracts

- Query keys: `src/frontend/src/query/queryKeys.ts`
- Shared query definitions and warm-up contracts: `src/frontend/src/query/sharedQueries.ts`
- `getStartupWarmupQueryOptions()` public export: `src/frontend/src/query/sharedQueries.ts`
- Query invalidation helpers: `src/frontend/src/query/queryInvalidationHelpers.ts`
- Query client foundation/provider: `src/frontend/src/query/queryClient.ts`, `src/frontend/src/query/AppQueryProvider.tsx`

### 3.1a Hooks and derivation helpers

- Page dataset-state hook and pure helpers: `src/frontend/src/hooks/usePageDataset.ts` — also hosts the shared neutral `computeDatasetBlockingReason` / `DatasetBlockingReason` resolver (a discriminated reason: `none` | `failed` | `untrustworthy` | `queryError`) used by both `classPage` (`useClassPageData.helpers`) and the standalone Heatmaps surface (`heatmapsSurfaceState`) to derive their feature-specific blocking errors from a single precedence decision; this resolved a three-way drift
- Once-only conditional callback hook (React 19 StrictMode-safe): `src/frontend/src/hooks/useLogOnce.ts`
- Shared post-analysis extension point: `src/frontend/src/hooks/usePostAnalysisTasks.ts` owns the generic context/outcome lifecycle, with schemas and the ordered runner under `services/dataAnalysis/postAnalysis/`. `src/frontend/src/hooks/usePagePostAnalysisTasks.ts` is the canonical page eligibility/context wrapper: it builds a memoised context only when the surface is `ready` with complete class, live definitions and a successful averaging result, creates the descriptor list once per mount and forwards the committed selected class ID. Both averaging surfaces call it directly. Register future tasks once in `createPostAnalysisTaskDescriptors` and import actual owners directly, without a facade/barrel. See [lifecycle and registration rules](data-analysis-architecture.md#shared-post-analysis-lifecycle-and-extension).
- Post-analysis feedback/invalidation: `hooks/postAnalysisFeedback.ts` owns mount/class-scoped notification identity and dismissal memory, using the required `App.useApp().notification` host, and `hooks/postAnalysisInvalidation.ts` completes confirmed metadata saves with both required query settlements inside the cached attempt. See the canonical [feedback](frontend-logging-and-error-handling.md#post-analysis-metadata-failures) and [query](frontend-react-query-and-prefetch.md#post-analysis-metadata-invalidation) contracts. Task diagnostics belong to `services/dataAnalysis/postAnalysis/postAnalysisDiagnostics.ts`, not per-feature loggers.

### 3.2 Error and transport helpers

- Unknown-error normalisation: `src/frontend/src/errors/normaliseUnknownError.ts`
- Unknown → `Error` normalisation: `toError(unknown): Error` in `src/frontend/src/errors/normaliseUnknownError.ts` — the canonical `unknown → Error` helper (S-N4) used across features; complements `normaliseUnknownError` (which returns a plain payload) when a caller needs a concrete `Error` instance
- Blocking-load trust-boundary helper: `src/frontend/src/errors/blockingLoadError.ts`
- Shared blocking-error → `Result` config resolver and `BlockingConfig` type: `src/frontend/src/errors/blockingConfig.ts` (per-feature copy maps supply the error-specific titles; the resolver mechanism is shared)
- Transport error contract: `src/frontend/src/errors/apiTransportError.ts`
- Frontend logger and redaction/normalisation flow: `src/frontend/src/logging/frontendLogger.ts`; the standalone Heatmaps feature's pipeline and assembly diagnostics route through the bounded-dedupe `logPipelineError` wrapper in `src/frontend/src/features/taskHeatmap/heatmapsPipeline.ts` rather than calling the sink directly, so an identical diagnostic raised on a memo recomputation is logged once.
- API transport: `callApi`, `parseApiResponse` and `ApiRequestSchema` in `src/frontend/src/services/apiService.ts` — the actual transport owner, not a facade. Import transport symbols here directly.
- Sequential API request/local-task queue: `callApiQueued`, `runApiQueuedTask`, `getQueueState`, `cancelApiQueued`, and `QueueState` in `src/frontend/src/services/api/apiQueue.ts` — import directly from this owner. Ordinary calls and local tasks share one Map/Set registry with FIFO ordering per job name; different jobs may run in parallel. `runApiQueuedTask(jobName, task)` reserves the lane across the callback's full operation, including awaited read/merge/write work. Synchronous throws and asynchronous rejections preserve the original failure and release the lane. Cancellation rejects pending entries with `{ reason: 'CANCELLED' }` without executing their callbacks; active work continues.
  - Callbacks and their results stay local, never GAS payloads. Network work inside a task uses `callApi` directly; central transport retry ownership is unchanged. Never await another enqueue on the same lane inside a task: it deadlocks behind the reserved slot. Extend this queue rather than adding a parallel queue.

### 3.3 Feature-shared helpers (existing local precedents)

- Class-page assignment warm-up: `src/frontend/src/features/classPage/useClassPageAssignmentPrefetch.ts` owns the ready-only effect, per-instance class guard and top-three limit; `useClassPageData` calls it directly. See the [prefetch contract](frontend-react-query-and-prefetch.md#current-view-entry-prefetches). This remains feature-local, not a generic prefetch hook.
- Heatmaps preview-query support: `src/frontend/src/features/taskHeatmap/heatmapsPreviewQueries.ts` owns the typed `buildDisabledQueryOptions<T>(queryKey)` (`skipToken`, returning `UseQueryOptions<T, Error>` without a cast), `buildPreviewInput`, the stable empty lookup and `AssignmentPreviewCombined`. `useHeatmapsPageData` retains query callbacks, memoised assembly, refresh wiring and diagnostics; live definition analysis stays in its existing pipeline. This is feature-local support, not a global query-helper family.
- Classes table shaping/filtering helpers: `src/frontend/src/features/classes/table/ClassesTable.helpers.ts`
- Classes bulk-mutation orchestration helper (sequential FIFO): `src/frontend/src/features/classes/bulk/runQueuedBatchMutation.ts`
- Classes batch-mutation shared types: `src/frontend/src/features/classes/bulk/batchMutationEngine.ts`
- Classes metadata bulk-update helper: `src/frontend/src/features/classes/bulk/bulkMetadataUpdateFlow.ts`
- Classes query refresh and invalidation contract helpers: `src/frontend/src/features/classes/bulk/queryInvalidation.ts`
- Classes bulk-mutation outcome resolution: `src/frontend/src/features/classes/bulk/bulkMutationResolution.ts` — turns settled batch results into the alert, close and refresh-required UI state.
- Classes bulk-mutation failure copy: `src/frontend/src/features/classes/bulk/bulkMutationFailureMessages.ts` — owns the `BulkFailureMessageCopy` type and the six pure action-specific failure-message builders (shared, create, delete, set-active, set-inactive, metadata) plus their user-facing copy. `bulkMutationResolution.ts` re-exports these bindings unchanged for compatibility, so existing consumers keep importing through it; new call sites import the failure-copy helpers from the owning module.
- Reference-data workflow helpers: `src/frontend/src/features/referenceData/manageReferenceDataHelpers.ts`
- Year-group presentation ordering: `src/frontend/src/features/referenceData/yearGroupSorting.ts` — source of truth for immutable, natural year-group ordering.
- Classes bulk form modal scaffold: `src/frontend/src/features/classes/bulk/BulkFormModalScaffold.tsx` — three-caller shell owning reset-on-cancel, submit-on-OK, inline submission error rendering, and busy semantics.
- Reference-data modal family: `ReferenceDataManagementModalScaffold.tsx`, `manageReferenceDataDialogs.tsx`, `InlineDialog.tsx`, and `ReferenceDataInitialLoadingState.tsx` (under `src/frontend/src/features/referenceData/`) — extend this family for new reference-data modals rather than composing a fresh shell.
- Cross-feature re-run entry contract: `src/frontend/src/features/shared/reRunAssessmentContext.ts` — `ReRunContext` lives in `features/shared` so `features/taskHeatmap/**` never imports `features/classPage/**`.

Feature-scoped helpers should stay feature-scoped unless there is proven cross-feature reuse.

### 3.4 Shared test helpers

- Frontend provider render helper: `src/frontend/src/test/renderWithFrontendProviders.tsx`
- `google.script.run` harness: `src/frontend/src/test/googleScriptRunHarness.ts`
- API transport/queue suite support: `src/frontend/src/test/api/apiServiceTransportTestHelpers.ts` shares harness/envelope factories and dynamic owner loaders after module resets; transport loads from `@/services/apiService`, queue from `@/services/api/apiQueue`. `apiServiceTestMocks.ts` supplies the transport mock scaffold and owner-derived types. No facade or barrel is involved.
- Shared classes test fixtures/builders: `src/frontend/src/test/classes/classesTestHelpers.ts`
- Classes Page test helpers: `src/frontend/src/test/classes/classesPageTestHelpers.ts` is the compatibility facade and owns `toPlainClassPartials`. The split responsibilities live in `classesPageTestFixtures.ts` (fixture factories and constants, including `createFixtureClassPartial` and `createFixtureYearGroup`), `classesPageRenderHelpers.tsx` (`renderClassesPage` and query-client helpers), `classesPageModelAssertions.ts` (`verifyClassesPageModel` and type guards) and `classesPageScreenAssertions.tsx` (DOM/screen assertions). Existing imports through the facade stay valid; new call sites may import from the owning module.
- Classes Page grouped view-model test support: `src/frontend/src/test/classes/classesPageModelTestSupport.ts` — shared factories and assertion helpers for `classesPageModel.base.spec.ts`, `classesPageModel.sorting.spec.ts` and `classesPageModel.validation.spec.ts`.
- Classes Page component suite support: `src/frontend/src/test/classes/ClassesPage.mockSetup.ts` registers the shared doubles; `classesPageComponentTestSetup.ts` binds typed handles and seeds per-test service/selection behaviour; `classesPageWarmupFixtures.ts` owns independent readiness, failure and trust fixtures. Used by `ClassesPage.spec.tsx` and its grouping/cards/refresh/shell companions; the refresh-only query override stays local to that suite.
- Classes panel and bulk test infrastructure: registration-only mock setup modules (`*.mockSetup.ts` under `src/frontend/src/test/`) register identical `vi.mock` doubles once per spec family (pattern detail in `docs/developer/frontend/frontend-testing.md`); the panel family's doubles come from `createClassesManagementPanelMocks` (`classes/classesManagementPanelMockFactories.tsx`) and the bulk-panel factories `createBulkPanelMocks` / `createBulkQueueModuleMock` / `BULK_PANEL_COMPONENT_MOCKS` alongside `makeRow`, `assertQueuedBatchMutationCalledOnce` and `assertSingleSelectedRowEdit` in `classes/bulkFlowTestHelpers.ts`. The panel harness `createClassesManagementPanelHarness` (`classes/classesManagementPanelHarness.tsx`) owns the `ClassesManagementPanel.*.spec.tsx` `reset()` queue/modal behaviour, the `buildClassesManagementState` binding, the dynamic panel render, and the shared `MutableQueueState` type.
- Class-page fixtures and hook helpers: `src/frontend/src/test/classPage/classPageFixtures.ts` (ready `ClassPageData` and adapter fixtures, imported statically by the Class page composition specs), `useClassPageDataTestFixtures.ts` (pure query/dataset builders plus the shared `createClassPageDataWrapper` provider wrapper, imported statically by the hook specs), and `useClassPageDataMockHandles.ts` (`createUseClassPageDataMockHandles()` binds the typed mocked hook dependencies for the main, blocking, and memoisation hook specs; the assignment-queries spec keeps its own bindings and the diagnostics spec declares local hoisted mocks).
- Auth gate test helpers: `src/frontend/src/test/auth/appAuthGateTestHelpers.tsx` — the access-result fixtures, `EMPTY_STARTUP_WARMUP_RESULT`, and `createQueryWrapper()`, imported statically by the auth-gate specs; `auth/appAuthGate.mockSetup.ts` registers their doubles (`AppAuthGate.auth` keeps its local hoisted mocks).
- Shared data-analysis test fixtures and assertion helpers: `src/frontend/src/test/dataAnalysis/` (fixtures, averaging analyser assertions), including the focused one-class/one-student `buildSingleStudentInput` builder. Placement follows the shared test helpers convention; cross-referenced from `docs/developer/frontend/frontend-testing.md`.
- Heatmap adapter suite setup: `src/frontend/src/test/dataAnalysis/heatmapAdapterTestSetup.ts` — shared class/definition/averaging-result builders for `heatmapAdapter.spec.ts` and `heatmapAdapter.weighting.spec.ts`.
- Heatmaps hook suite support: `src/frontend/src/test/taskHeatmap/useHeatmapsPageData.mockSetup.ts` registers the hook doubles and exports nothing; `useHeatmapsPageDataMockHandles.ts` owns the typed slot the setup module fills; `useHeatmapsPageDataSpecMocks.ts` binds `heatmapsPageDataMocks` and exports `installUseQueriesMock`, `createHeatmapsPageDataHarness` and `mockWarmupDatasetsReady`. Import the setup module before `./useHeatmapsPageData`. Used by `useHeatmapsPageData.knownErrorPreview.spec.ts`. See the inventory in `docs/developer/frontend/frontend-testing.md#shared-test-helpers`.
- Class-detail schema wire fixtures: `src/frontend/src/test/abClass/classDetailSchemaFixtures.ts` — shared wire payloads for `classDetailService.zod.full.spec.ts`, `.submissions.spec.ts`, `.definitions.spec.ts` and `.metadataIntegration.spec.ts`; `validClassFull` carries a detached canonical metadata snapshot.
- Shared document-order button-name helpers for placement assertions: `src/frontend/src/test/shared/buttonOrderingTestHelpers.ts` (exports `getAccessibleButtonNames` and `getAccessibleButtonIndex`), so specs assert relative action placement against the same accessible names.
- Shared DOM guards for query results: `src/frontend/src/test/shared/domGuards.ts` (exports `requireElement` and `requireTableElement`), which assert-and-narrow queried DOM elements and throw a descriptive `TypeError` instead of relying on non-null assertions.
- ABClass metadata test selectors: `src/frontend/src/test/abClass/abClassMetadataFixtures.ts` — Vitest-only `METADATA_PROFILE_CLASS_PARTIALS` parses committed `small`, `medium` and `large-representative` views through `?raw`; `cloneMetadata` returns detached copies. Runner-neutral `abClassMetadataSharedFixtures.ts` owns `CANONICAL_NON_NULL_METADATA` / `createCanonicalMetadataFixture()` using direct JSON loading, schema validation, freezing and cloning. The raw selector re-exports these bindings for compatibility; helpers reached by Playwright import the neutral owner directly.
- Focused full-class fixture defaults: `src/frontend/src/test/abClass/classFullFixtureDefaults.ts` — constructor-owned defaults for `classPageAdapterTestFixtures.classFull` and `dataAnalysis/fixtures.createClassFull`; omitted/undefined metadata gets a detached canonical snapshot, while explicit null and supplied metadata survive unchanged. No production schema default is implied.
- ABClass mutation fixtures: `src/frontend/src/test/abClass/abClassMutationFixtures.ts` — required upsert configuration selects canonical `small` class-0, whose cohort/year-group keys are both non-null strings. Detached partial responses are selected independently and may retain nullable configuration keys; complete metadata replacement requests use the shared canonical metadata factory.
- Metadata refresh test support: `src/frontend/src/test/abClass/metadataRefreshFixtures.ts` owns detached historical-source boundary clones and untouched canonical failure inputs; `metadataRefreshTransport.ts` uses the shared GAS harness with real transport/validation/queue; `metadataEvidenceOracle.ts` calculates independent numeric expectations from assessment evidence, not supplied metadata. See the synthetic guide for the newest-instance null-name limitation.
- Post-analysis rendered-owner support: `src/frontend/src/test/abClass/postAnalysisHookTestSupport.tsx` observes committed lifecycle state under the required real `App` host; `postAnalysisFeedbackTestSupport.tsx` renders independent owners under one real App host and query client. Its `completeNotificationLeave` handles HappyDOM's missing CSS animation completion only after a real leave starts. See [lifecycle tests](frontend-testing.md#shared-post-analysis-lifecycle-tests).
- Post-analysis metadata browser scenarios: `src/frontend/e2e-tests/helpers/post-analysis-metadata-scenarios.ts` builds canonical `small` class-2 historical-source, changed-write and newer-version runtime scenarios for `post-analysis-metadata.persistence.spec.ts` and `post-analysis-metadata.feedback.spec.ts`. Reuse it; do not duplicate the canonical setup.
- Production page copy for assertions: `src/frontend/src/pages/pageContent.ts` — reuse the stable headings and summaries from here instead of mirroring them in tests.

Test helper placement rules remain governed by `docs/developer/frontend/frontend-testing.md`.

### 3.5 Shared presentational components

- `PageNavCard` `wrapActions`: opt-in action wrapping on `components/PageHeader/PageHeader.tsx`. True enables outer Flex wrapping with `gap={APP_GAP_SM}` (8px), and action Space wrapping with existing tight spacing. Omitted/false keeps current layout. Only `TaskHeatmapPage`'s normal navigation opts in; its title-error branch stays unchanged. Wrapped single-item rows are left-aligned. No new tag helper or navigation component is needed.

- `ImageRenderer`: shared presentational component at `src/frontend/src/components/ImageRenderer/ImageRenderer.tsx`. Renders a base64 data URL as a constrained `<img>` (maxWidth 100%, height auto, maxHeight 400, default alt "Student response image"). Introduced for the Task Preview Card and reused there.
- `MarkdownRenderer`: shared presentational component at `src/frontend/src/components/MarkdownRenderer/MarkdownRenderer.tsx`. Renders markdown text and tables via `react-markdown` + `remark-gfm` (no `rehype-raw`, for XSS safety). Co-located CSS for basic table styling. Introduced for the Task Preview Card, using `react-markdown` + `remark-gfm`, no `rehype-raw`, and a co-located `MarkdownRenderer.module.css`.

### 3.6 Student-name helpers

- `splitStudentName`: shared deterministic helper module at `src/frontend/src/utils/splitStudentName.ts`. It exports:
  - `splitStudentName(studentName: string): { forename: string; surname: string }` — the first whitespace-separated token becomes `forename`; the remaining tokens are joined with single spaces as `surname`. Leading, trailing, and repeated internal whitespace is collapsed; an empty or whitespace-only name returns two empty strings. Honourifics are never special-cased.
  - `compareStudentNamePart(part: 'forename' | 'surname', a, b): number` — selects the requested derived part of two `Readonly<{ studentName: string; studentId: string }>` rows, compares them locale-aware and case-insensitively, and tie-breaks by ascending `studentId`. The comparison is direction-neutral; call sites apply direction inversion.
- Consumers: the Student Averages table (`features/classPage/studentAveragesTableColumns.tsx` column renderers and per-column sorters, and `features/classPage/classPageModel.ts` explicit derived sort) and the Task Heatmap table (`features/taskHeatmap/TaskHeatmapTable.tsx` two fixed name columns and their sorters). No duplicate per-feature name-splitting logic is permitted.
- **Standing requirement:** all tables displaying a student name use Forename and Surname columns derived via this shared helper. Default ordering stays full-name ascending through the unchanged `compareStudentNames` comparator.
- Shared Forename/Surname Ant Design columns: `buildStudentNameColumns<Row>()` at `src/frontend/src/features/shared/studentNameTableColumns.tsx` — the column counterpart consumed by the two tables above. It takes no column options and always emits `fixed: 'start'` on Forename and Surname, because both consumers need fixed name columns and no caller needs the non-fixed variant (SPEC decision 5). The former `options` parameter, `StudentNameTableColumnsOptions` type and `sticky`-option JSDoc are removed; do not reintroduce them.
- `src/frontend/src/utils/splitStudentName.ts` is pure: no React, Ant Design, I/O, or state dependencies. `studentNameTableColumns.tsx` is not: it imports Ant Design `Typography` and renders JSX.

### 3.7 Data analysis display and projection helpers

- Metric display family: `src/frontend/src/services/dataAnalysis/metricDisplay/` — `resolveMetricTone` and `MetricPill.tsx` (colour and tone), `metricDisplayText.ts` (`formatMetricDisplayText`), `metricComparator.ts` and `metricStateRank.ts` (state-aware column ordering), and the score-range filter helpers (`metricRangeKey.ts`, `metricRangeFilter*.tsx`). One shared vocabulary for metric colour, text, ordering, and filtering across the Class page and the task heatmap; these were planned as shared because cohort, trend, and distribution analyses are the accepted second caller. The colour and label contract (including the `MetricToneColor` union) is cross-spec — do not restate or retype it per feature.
- Student-name row ordering: `src/frontend/src/services/dataAnalysis/compareStudentNames.ts` — callers consume it directly; do not add a feature-local wrapper. The Forename/Surname column comparator stays in Section 3.6.
- Heatmap projection: `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts` and `heatmapAdapter.merged.ts` — the shared `AveragingResult` → heatmap boundaries; feature-local heatmap helpers stay under `src/frontend/src/features/taskHeatmap/`. The analyser package and `taskKey.ts` inventory lives in `docs/developer/frontend/data-analysis-architecture.md`; do not duplicate it here.

### 3.8 Assignment and definition helpers

- Assignment transport: `src/frontend/src/services/assignmentAssessment/` — the `getAssignment` service (`assignmentAssessmentService.ts`) plus `AssignmentFullSchema` / `AssignmentFullResponseSchema` validation (`assignmentAssessment.zod.ts`).
- Assignment-read normalisation: `src/frontend/src/services/assignmentAssessment/assignmentReadNormalisation.ts` owns the pure full/partial `normaliseAssignmentRead`/`normaliseClassRead` entry points, `assignmentReadItemValidation.ts` owns pure per-item/source validation, corruption replacement and safe diagnostic paths, and `assessmentResult.zod.ts` owns the shared full/partial result, score and cause schemas. Both assignment read services consume the normaliser before their final `parseApiResponse` validation. Import these owners directly from the assignment-assessment folder; there is no barrel or facade. Activation status is recorded in §9.29.
- Effective weighting: `src/frontend/src/services/assignmentDefinition/assignmentDefinitionUtilities.ts` — `TaskWeightingIndex` and `computeEffectiveWeight`, the single effective-weight resolver for analyser accumulation and heatmap column projection.
- Assignment-weighting coercion: `src/frontend/src/services/assignmentDefinition/assignmentDefinitionUtilities.ts` — `coerceAssignmentWeighting(value: unknown): number`, which returns every primitive number unchanged and falls back to the schema-owned `DEFAULT_WEIGHTING_VALUE` only for non-numbers. It is **distinct from `computeEffectiveWeight`** (different nullable/validation semantics) and is the form-level coercion consumed by the wizard dirty checks, the save/reparse builders and recovery approval. The legacy `assignmentWizardFormState.ts` export path re-exports the same binding and must be retained for existing consumers.

### 3.9 Shared input components

- `SelectWithAddNew`: Ant Design `Select` wrapper at `src/frontend/src/components/SelectWithAddNew/SelectWithAddNew.tsx` that appends one `Add new` sentinel option. Selecting it is an immediate **command**, not a value. Consumers: `features/classes/bulk/BulkCreateModal.tsx`, `features/classes/bulk/BulkSetSelectModal.tsx` and `features/assignmentWizard/AssignmentDefinitionWizardReviewContent.tsx`. Contract:
  - **Dispatch is immediate.** The wrapper calls `onAddNew` synchronously from the selection change and never forwards the sentinel through the caller's `onChange`. It has no `debounceMs` prop; do not reintroduce a delay on this modal-open command. `src/frontend/src/hooks/useDebounce.ts` is unchanged for its other callers.
  - **Value ownership.** A controlled `value` prop (detected by property presence, so explicit `undefined` counts) stays authoritative, and a nullish value is passed to Ant Design as `null` so its internal uncontrolled sentinel cannot leak. Without a `value` prop the wrapper tracks the normal selection itself, seeded from `defaultValue`; normal `onChange`, `allowClear` and `labelInValue` payloads keep their original shape, including the labelled `{ value, label }` object.
  - **State stays with the caller.** The wrapper keeps no timers, callback registry or created-entity state. The caller owns the manager-modal open state, and its open transition is idempotent.
  - Placement rationale: the wrapper is a cross-feature shared component with three active callers, so it belongs in `components/`; its value handling is not a general helper and must stay local to it.

### 3.10 ABClass metadata schema

- ABClass metadata schema family: `src/frontend/src/services/abClass/abClassMetadata.zod.ts` — the single frontend owner of the ABClass wire metadata contract. `ABClassMetadataSchema` validates the nullable whole value; `NonNullableABClassMetadataSchema` validates a complete non-null snapshot and is the merge/write-path schema. `ClassAveragesSchema`, `AverageScoresSchema`, `RecentAssignmentSchema`, `CanonicalMetadataTimestampSchema` and their inferred types are exported for the class-read, mutation and post-analysis owners that consume them. Raw own-key/plain-prototype checks run before Zod copies input, and validation enforces canonical UTC timestamps, the numeric-or-`N`/`E`/`excluded` score union, dense zero-to-three recent entries, unique assignment IDs and newest-first non-increasing timestamps. Never duplicate these record rules in a consumer. Both class-read schemas require this schema: `ClassPartialSchema` and `ClassFullSchema` treat metadata as required and nullable as a whole, with no frontend default.
- Mutation request schemas: `src/frontend/src/services/abClass/abClassMutations.zod.ts` exports `UpsertABClassRequestSchema`, `UpdateABClassRequestSchema` and inferred request types. Upsert requires `classId`, non-null string `cohortKey`/`yearGroupKey` and a positive safe-integer `courseLength`; null keys reject, matching backend `Validate.requireParams`. Update requires `classId` and permits optional nullable cohort/year-group keys, optional positive safe-integer `courseLength` and optional nullable boolean `active`. Explicit nulls survive only for nullable update fields. Strict own-key checks reject supplied undefined, protected roster/assignment fields and unknown keys before enqueue; no coercion or defaults apply. Metadata remains optional and nullable for both mutations: omission preserves the stored value, null clears it, and a supplied snapshot replaces it whole through the shared metadata schema, detached before queueing. Nested metadata patches reject.
- Queued mutation wrappers: `src/frontend/src/services/abClass/abClassMutationService.ts` exports `upsertABClass`, `updateABClass` and the `CLASSES_BULK_MUTATION_JOB_NAME` lane symbol. Both wrappers validate before admission to the actual `classesBulkMutation` FIFO, then parse the response through `parseApiResponse(ClassPartialSchema, ...)`; transport errors and retry ownership are unchanged. Reserved-slot owners import the lane constant instead of repeating the string. Import these owners directly, without a facade or barrel. Never await these queued wrappers inside an active reservation on the same lane.
- Pure metadata refresh helpers: `services/dataAnalysis/postAnalysis/metadataProjection.ts` owns `getMetadataRefreshDecision`, `compareAssignmentNewestFirst`, `projectAverageScores` and `mergeClassMetadata`: canonical source-time gating, shared newest-first/ID ordering, unrounded score/marker projection and stable newest-first rolling history capped at three assignment instances. `mergeClassMetadata` validates its replacement through `NonNullableABClassMetadataSchema` and returns the non-null snapshot directly.
- Metadata task identity: `services/dataAnalysis/postAnalysis/postAnalysisTasks.ts` owns `REFRESH_AB_CLASS_METADATA_TASK_ID`, `createPostAnalysisTaskDescriptors`, `sourceVersionSignature` and the metadata attempt key. Feedback, invalidation and diagnostics import the task-ID constant; diagnostics reuse the metadata comparator. Do not duplicate the task-ID literal or the canonical newest-first ordering.
- Metadata task entry: `services/dataAnalysis/postAnalysis/refreshABClassMetadata.ts` owns `refreshABClassMetadata(context: PostAnalysisContext, now)`, which skips unchanged/stale/empty cached sources before enqueue, calculation or clock access. It uses the shared schema-derived context and declares no narrowed task-local type. It delegates changed candidates to `services/abClass/abClassMetadataService.ts` (`refreshABClassMetadataInQueue`). The writer reserves the `CLASSES_BULK_MUTATION_JOB_NAME` lane across fresh full read, authoritative recheck, full-class and isolated-target standard-weight analysis, complete metadata update and real partial-response parsing. No nested enqueue, upsert, rollback or task retry exists. See [Data Analysis Architecture](data-analysis-architecture.md#metadata-refresh-task-and-persistence) for cache limitations and session-local guarantees. Both averaging surfaces call the shared page hook directly with the unsliced class and committed class ID. Test-only browser and Node dispatcher coverage lives in the suites listed in [Frontend Testing](frontend-testing.md#shared-post-analysis-lifecycle-tests).

## 4. Extraction decision rules

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
- duplicated routing render sources for the same navigation key set
- mirrored validation error state where two stores track the same errors without distinct responsibilities
- ad-hoc helper modules created without checking the canonical helper map

## 6. Placement and naming

- Keep cross-feature helpers in stable shared domains (`query`, `errors`, `logging`, `services`) when the contract is genuinely cross-feature.
- Keep feature-specific helpers inside the owning feature folder.
- Name helpers by the contract they provide, not by where they were extracted from.
- Prefer explicit function exports and typed return contracts.
- Service-folder grouping conventions: `docs/developer/frontend/frontend-architecture.md`.

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

- React Query and prefetch policy: `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- Loading, width, and busy-state semantics: `docs/developer/frontend/frontend-loading-and-width-standards.md`
- Logging and error-handling policy: `docs/developer/frontend/frontend-logging-and-error-handling.md`
- Testing helper and harness policy: `docs/developer/frontend/frontend-testing.md`
- Shell navigation and motion policy: `docs/developer/frontend/frontend-shell-navigation-and-motion.md`

## 9. Helper decision register

Section 3 lists what exists; this section records what was **decided** — especially what the code cannot show: helpers deliberately not extracted, designs rejected or superseded, and delivered decisions whose reasoning must not be undone.

Rules for new entries:

- Record one line: entry ID, decision, owning path, and a brief why. Add the why only when Section 4 would not give the same answer.
- Durable helper facts (path and contract) belong in Section 3. Implementation detail belongs in code JSDoc or the owning feature folder.
- Entry numbers are stable; retired entries leave gaps. Entries that only restate delivered code do not belong here.

### Decisions not to extract

- **9.1 Assignments page column filters** — keep local to `src/frontend/src/pages/AssignmentsPage.tsx`: page-local descriptors plus one typed filter setter; a cross-feature filter helper would be speculative.
- **9.3 Settings tabs** — keep local to `src/frontend/src/pages/SettingsPage.tsx`.
- **9.4 Selected-row derivation** — the Classes feature root derives `selectedRows` once and passes the subset to `ClassesToolbar`; no child recomputation.
- **9.5 Backend settings field descriptors** — keep local to `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`; Ant Design form meta remains the single validation-error source of truth.
- **9.7 / 9.8 Classes bulk modal shell** — do not add a generic shared wrapper; the accepted outcome is the narrow three-caller `src/frontend/src/features/classes/bulk/BulkFormModalScaffold.tsx`.
- **9.8 One-off destructive confirmations** — `src/frontend/src/features/classes/bulk/BulkDeleteModal.tsx` and `src/frontend/src/pages/AssignmentsPage.tsx` stay workflow-specific; no shared confirmation wrapper.
- **9.11 Classes page grouped view-model** — keep local to `src/frontend/src/pages/classesPageModel.ts`; do not widen the Settings Classes helper family, which serves different merge and workflow needs.
- **9.14 Topic existence check** — single-caller one-liner in `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`; no existing helper matches the contract.
- **9.16 / 9.16a AssessTask link and skeleton helpers** — `matchDefinitionForAssignment.ts`, `getLinkableDefinitionsForModal.ts`, `LinkableDefinitionList.tsx` (which also exports the `LinkExistingDefinitionButton` availability leaf), `AssignmentSelectSkeleton.tsx`, and `stringComparison.ts` stay in `src/frontend/src/features/classes/AssessTaskModal/`; two or three in-modal callers each, so they are not promoted.
- **9.19 Class page and task-heatmap surface** — every adapter, model, hook, dispatcher, presentational component, column-marking header, and E2E scenario helper under `src/frontend/src/features/classPage/**` and `src/frontend/src/features/taskHeatmap/**` stays feature-local per Section 6; promotion requires a documented cross-feature caller. The embedded heatmap's class-partial preview lookup (`buildClassPartialPreviewLookup.ts`) is feature-local under the same rule.

### Rejected and superseded designs

- **9.24 Generic wizard orchestrator hook and entry-intent taxonomy — rejected.** `useAssessTaskRecoveryFlow` owns stale recovery; only `buildReparseRequest` remains, in `src/frontend/src/features/assignmentWizard/assignmentWizardOrchestrator.ts`. Do not re-propose `resolveWizardEntryMode`, `useAssignmentWizardOrchestrator` or a generic `{kind: ...}` entry intent.
- **9.27 Debounced `Add new` dispatch — rejected.** Opening a caller-owned modal is an immediate, idempotent state transition, so `src/frontend/src/components/SelectWithAddNew/SelectWithAddNew.tsx` dispatches synchronously and has no `debounceMs` prop. `useDebounce` and its other callers are unchanged. Do not reinstate a debounce on this command path.

### Delivered decisions

- **9.30 Always-fixed student-name columns** — `src/frontend/src/features/shared/studentNameTableColumns.tsx` always emits `fixed: 'start'` on Forename and Surname and takes no column options. Both consumers need fixed name columns and no caller needs a non-fixed variant (SPEC decision 5), so the `options` parameter, the `StudentNameTableColumnsOptions` type and the `sticky`-option JSDoc are removed.

### Cross-referenced decisions

- **9.24 Stale-definition recovery (issue #301)** — `useAssessTaskFlow`, `AssignmentDefinitionWizardReviewContent`, `assignmentWizardFormState`, and `AssignmentDiscardConfirm`. The modal contract is recorded in `frontend-modal-patterns.md` §3.4 and §3.5.
- **9.25 Explicit assessment re-run entry (issue #298)** — `ReRunContext` (`src/frontend/src/features/shared/`), `resolveReRunTarget`, `useAssessTaskReRunFlow`, and `AssessTaskReRunSurface`. The modal contract is recorded in `frontend-modal-patterns.md` §3.6.

### Retained non-obvious implementation notes

Behaviour that the code alone does not explain:

- **antd v6 `Select` `optionRender`** exposes no `selected` flag; derive checkbox option state from controlled-value membership (`value` in the current selection), not from a `selected` argument.
- **Disabled-reason accessibility**: expose a disabled control's reason both as a hover `Tooltip` and as an sr-only `aria-describedby` node; mediate the antd `Tooltip` `cloneElement` wrapper with an intermediate `<span>` so the described-by binding survives.
- **antd `Table` `defaultSortOrder`** does not apply the initial sort in the installed version; pre-sort the `dataSource` instead (for example `rows.toSorted(compareStudentNames)`).
- **Disabled `Button` tooltips** need a `<span>` wrapper: antd v6 `Tooltip` does not trigger on a disabled button. This is the established codebase pattern.
- **antd `Select` advances its internal selection before the wrapper's `onChange` runs.** Intercepting the `Add new` sentinel inside `onChange` is therefore too late to stop it becoming the displayed label unless the wrapper owns the value. `SelectWithAddNew` consequently tracks its own uncontrolled selection (seeded from `defaultValue`) and passes the parent value, or `null` when absent, so an intercepted command never renders as a selected value.

### 9.26 Task preview source link decisions (issue #19)

- Extend the existing preview derivation owners (`buildCellPreviewLookup`, `assembleTaskPreviewData`, `assembleMergedPreviewData`) rather than adding a parallel path.
- Keep source-URL resolution private to `features/taskHeatmap/buildCellPreviewLookup.ts`; do not generalise it or widen the assignment wizard.
- Split the metric-cell popover into `TaskMetricPreviewCell` (trigger and open state) and `TaskMetricPreviewContent` (ready/loading/error body); do not create a generic popover abstraction.
- Reuse the Lucide `ExternalLink` icon at 16px and stroke 1.5 through the existing decorative-icon wrapper.
- Share the preview fixtures and source-link E2E journeys; the E2E expected-URL oracle stays independent of the production resolver.

### 9.27 Attempt-baseline analysis mode (issue #305)

- Baseline selection and the shared attempt predicate live in `services/dataAnalysis/analysers/attemptBaselineSelection.ts`, as a post-accumulation derivation over per-(student, task) metrics.
- `AnalysisModeSchema` in `dataAnalysis.zod.ts` has no default: every caller states `analysisMode`, and the result echoes `appliedAnalysisMode`.
- Pass the mode to `MetricPill` and the student-averages column builder explicitly; do not introduce React context.
- `buildTaskColumns` takes a required `ReadonlySet<string> | null`; `adaptMetricsToHeatmap` supplies the baseline set or `null` for absolute mode, and the merged chain passes `null` explicitly at each hop.
- `resolveBaselineAvailability` stays in `useClassPageData.helpers.ts`; its reason strings are module constants.
- Load the `medium` synthetic views at each call site with `?raw`; do not add a shared loader.
- The shared `buildInput`/`buildSingleStudentInput` fixture pins `analysisMode: 'absolute'`.

### 9.28 Frontend ABClass metadata and post-analysis

- Contracts and owners are recorded in Section 3.10. Do not add a second metadata schema, mutation wrapper or post-analysis lifecycle.
- The backend-parity and round-trip suites are test-only; they compare the frontend Zod contract with the real backend validator through existing dispatcher seams.

### 9.29 Explicit assessment errors: response normalisation and E preview

- Shared result schemas and read normalisation live in `services/assignmentAssessment/`: `assessmentResult.zod.ts`, `assignmentReadNormalisation.ts` and `assignmentReadItemValidation.ts`. Import these owners directly; there is no barrel.
- Both read paths isolate per-item corruption and replace unidentifiable items with the three-criterion `CORRUPT_RECORD` shape.
- E preview reuses the existing preview owners; do not add a generic popover, preview or query helper. E contributes no numeric weight or data-point count.
- The preview-only E override and known-partial fallback stay feature-local to `features/taskHeatmap/`.

## 10. Frontend utils folder convention

The `src/frontend/src/utils/` folder exists for pure formatting / utility functions that are shared across the frontend. This folder is a separate convention from the service-folder rules in `frontend-architecture.md`, which govern only `services/` subfolder organisation.

### Rules

- **Pure functions only.** Files in `utils/` must have no React, Ant Design, I/O, or state dependencies. They are plain TypeScript modules exporting typed pure functions.
- **No service-folder governance.** The subfolder-by-domain-prefix rule in `frontend-architecture.md` applies only to `services/`. The `utils/` folder is a flat namespace; files are named by the domain they format (e.g. `dateFormatting.ts`). A future subfolder reorganisation may be considered if the folder exceeds 5–6 files, but no barrel exports (`index.ts`) are created in v1 — consumers import directly.
- **First entry:** `dateFormatting.ts` — exports `formatUpdatedAtLabel(updatedAt: string | null): string` (`en-GB`, date-only, rendered in UTC; em-dash fallback for null or unparseable input). The Class page adapter deliberately does not use the fallback: it throws upstream on null or unparseable input.
