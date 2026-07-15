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

- Page dataset-state hook and pure helpers: `src/frontend/src/hooks/usePageDataset.ts`

### 3.2 Error and transport helpers

- Unknown-error normalisation: `src/frontend/src/errors/normaliseUnknownError.ts`
- Blocking-load trust-boundary helper: `src/frontend/src/errors/blockingLoadError.ts`
- Transport error contract: `src/frontend/src/errors/apiTransportError.ts`
- Frontend logger and redaction/normalisation flow: `src/frontend/src/logging/frontendLogger.ts`

### 3.3 Feature-shared helpers (existing local precedents)

- Classes table shaping/filtering helpers: `src/frontend/src/features/classes/table/ClassesTable.helpers.ts`
- Classes bulk-mutation orchestration helper (sequential FIFO): `src/frontend/src/features/classes/bulk/runQueuedBatchMutation.ts`
- Classes batch-mutation shared types: `src/frontend/src/features/classes/bulk/batchMutationEngine.ts`
- Classes metadata bulk-update helper: `src/frontend/src/features/classes/bulk/bulkMetadataUpdateFlow.ts`
- Classes query refresh and invalidation contract helpers: `src/frontend/src/features/classes/bulk/queryInvalidation.ts`
- Reference-data workflow helpers: `src/frontend/src/features/referenceData/manageReferenceDataHelpers.ts`

Feature-scoped helpers should stay feature-scoped unless there is proven cross-feature reuse.

### 3.4 Shared test helpers

- Frontend provider render helper: `src/frontend/src/test/renderWithFrontendProviders.tsx`
- `google.script.run` harness: `src/frontend/src/test/googleScriptRunHarness.ts`
- Shared classes test fixtures/builders: `src/frontend/src/test/classes/classesTestHelpers.ts`
- Classes Page test fixtures and rendering helpers (including `createFixtureClassPartial`, `createFixtureYearGroup`, `renderClassesPage`, `toPlainClassPartials`, and shared fixture constants): `src/frontend/src/test/classes/classesPageTestHelpers.tsx`

- Shared data-analysis test fixtures and assertion helpers: `src/frontend/src/test/dataAnalysis/` (fixtures, averaging analyser assertions). Placement follows the shared test helpers convention; cross-referenced from `docs/developer/frontend/frontend-testing.md`.

Test helper placement rules remain governed by `docs/developer/frontend/frontend-testing.md`.

### 3.5 Shared presentational components (planned)

- `ImageRenderer` (planned, status: Not implemented): shared presentational component at `src/frontend/src/components/ImageRenderer/ImageRenderer.tsx`. Renders a base64 data URL as a constrained `<img>` (maxWidth 100%, height auto, maxHeight 400, default alt "Student response image"). Introduced for the Task Preview Card; expected to be reused across the project.
- `MarkdownRenderer` (planned, status: Not implemented): shared presentational component at `src/frontend/src/components/MarkdownRenderer/MarkdownRenderer.tsx`. Renders markdown text and tables via `react-markdown` + `remark-gfm` (no `rehype-raw`, for XSS safety). Co-located CSS for basic table styling. Introduced for the Task Preview Card; expected to be reused across the project.

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

## 7. Review and PR checks

For frontend changes that add or modify helpers, include a short helper audit in the PR description:

- which existing helpers were checked
- whether logic was reused, extended, kept local, or extracted
- why extraction was justified when a new helper was introduced

Reviewer checks:

1. no unjustified one-caller abstraction extraction
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

## 9. Frontend de-sloppification helper outcomes

These entries record the resolved helper and abstraction decisions from the frontend de-sloppification pass.
Keep them aligned with the current implementation if later cleanup extends, reverts, or supersedes these outcomes.

### 9.1 Assignments page filter cleanup

1. Helper or contract: assignments column-filter descriptor and single typed filter setter

- Decision: keep local
- Owning path: `src/frontend/src/pages/AssignmentsPage.tsx`
- Status: `Implemented`
- Rationale: the repeated filter callbacks and column wiring now collapse into page-local descriptors plus one typed setter path, without introducing a speculative cross-feature helper

### 9.2 Shell navigation cleanup

1. Helper or contract: navigation page renderer source of truth

- Decision: reuse
- Owning path: `src/frontend/src/navigation/appNavigation.tsx`
- Status: `Implemented`
- Rationale: `renderNavigationPage(...)` is now the single runtime source of truth for navigation-key-to-page rendering, and `AppShell` consumes that contract instead of keeping a second page-selection switch

### 9.3 Settings page tab cleanup

1. Helper or contract: settings tab item construction

- Decision: keep local
- Owning path: `src/frontend/src/pages/SettingsPage.tsx`
- Status: `Implemented`
- Rationale: the two fixed Settings tabs now stay local to `SettingsPage`, so the page no longer preserves the removed one-caller wrapper chain

### 9.4 Classes bulk-action cleanup

1. Helper or contract: bulk action descriptor feeding shared orchestration

- Decision: extend
- Owning path: `src/frontend/src/features/classes/ClassesManagementPanel.tsx`, `src/frontend/src/features/classes/bulk/queryInvalidation.ts`
- Status: `Implemented`
- Rationale: the panel now drives top-level bulk actions through descriptor-shaped action data while preserving `runMutationWithRequiredClassPartialsRefresh(...)` as the shared mutation-boundary helper in `bulk/queryInvalidation.ts`

2. Helper or contract: metadata bulk-update contract for editable existing rows

- Decision: new
- Owning path: `src/frontend/src/features/classes/bulk/bulkMetadataUpdateFlow.ts`
- Status: `Implemented`
- Rationale: cohort, year-group, and course-length updates now converge on one feature-local metadata contract for eligibility filtering, payload validation, and batch mutation dispatch

3. Helper or contract: selected-row derivation for toolbar consumers

- Decision: keep local
- Owning path: `src/frontend/src/features/classes/ClassesManagementPanel.tsx`
- Status: `Implemented`
- Rationale: the feature root now derives `selectedRows` once and passes that subset into `ClassesToolbar` instead of recomputing it in the child

### 9.5 Backend settings validation cleanup

1. Helper or contract: local schema-aware field descriptor path for backend settings fields

- Decision: keep local
- Owning path: `src/frontend/src/features/settings/backend/BackendSettingsPanel.tsx`
- Status: `Implemented`
- Rationale: repeated `Form.Item` wiring now flows through a local descriptor-driven render path inside the panel, and Ant Design form meta remains the single validation-error source of truth

### 9.6 Page copy reuse in tests

1. Helper or contract: page copy source of truth for frontend tests

- Decision: reuse
- Owning path: `src/frontend/src/pages/pageContent.ts`
- Status: `Implemented`
- Rationale: touched tests now reuse `pageContent` where they only need the stable production headings and summaries, rather than mirroring that copy in a separate helper

### 9.7 Classes bulk modal-shell extraction

1. Helper or contract: shared modal submit shell for classes bulk-edit dialogs

- Decision: defer
- Owning path: `src/frontend/src/features/classes/BulkCreateModal.tsx`, `src/frontend/src/features/classes/BulkSetSelectModal.tsx`
- Status: `Deferred`
- Rationale: the current pair still shares similar shell structure, but this pass intentionally kept the duplication local rather than introducing a speculative wrapper without a clearer third caller or tighter shared contract

### 9.8 Classes modal-family compliance refactor

These entries record the delivered helper decisions for the classes modal-family compliance refactor.
This section supersedes the earlier Section 9.7 defer decision for the specific three-caller refactor now in scope.

1. Helper or contract: classes bulk form modal scaffold

- Decision: new
- Owning path: `src/frontend/src/features/classes/bulk/BulkFormModalScaffold.tsx`
- Status: `Implemented`
- Rationale: `BulkCreateModal.tsx`, `BulkSetSelectModal.tsx`, and `BulkSetCourseLengthModal.tsx` now present a justified three-caller family for a narrow feature-local shell that owns reset-on-cancel, submit-on-OK, inline submission error rendering, and modal busy semantics without becoming a generic wrapper

2. Helper or contract: classes reference-data modal helper family

- Decision: reuse
- Owning path: `src/frontend/src/features/referenceData/manageReferenceDataDialogs.tsx`, `src/frontend/src/features/referenceData/manageReferenceDataHelpers.ts`, `src/frontend/src/features/referenceData/InlineDialog.tsx`
- Status: `Implemented`
- Rationale: the current helper split already covers the shared reference-data workflow and should not be replaced or widened during this refactor

3. Helper or contract: one-off destructive confirmation modals

- Decision: keep local
- Owning path: `src/frontend/src/features/classes/bulk/BulkDeleteModal.tsx`, `src/frontend/src/pages/AssignmentsPage.tsx`
- Status: `Implemented`
- Rationale: both confirmation flows remain workflow-specific one-offs whose copy and footer semantics do not yet justify a shared abstraction

### 9.9 Classes reference-data modal add-action standard

1. Helper or contract: reference-data modal scaffold

- Decision: new
- Owning path: `src/frontend/src/features/referenceData/ReferenceDataManagementModalScaffold.tsx`
- Status: `Implemented`
- Rationale: `ManageCohortsModal.tsx` and `ManageYearGroupsModal.tsx` now reuse the extracted scaffold for modal shell composition, standard Cancel/close wiring, start-aligned content-width create-action presentation, and slot placement; a topic reference-data modal is an accepted next sibling caller

2. Helper or contract: existing inline dialog and reference-data helper family

- Decision: reuse
- Owning path: `src/frontend/src/features/referenceData/manageReferenceDataDialogs.tsx`, `src/frontend/src/features/referenceData/manageReferenceDataHelpers.ts`, `src/frontend/src/features/referenceData/InlineDialog.tsx`
- Status: `Implemented`
- Rationale: the extracted scaffold composes the existing dialog and workflow helper family rather than replacing it, because those modules already own the inner-dialog contract and reference-data workflow helpers coherently; the scaffold uses these helpers for inline form and delete dialog slots

3. Helper or contract: `ReferenceDataTrustBoundary` type extension in `manageReferenceDataHelpers.ts`

- Decision: extend
- Owning path: `src/frontend/src/features/referenceData/manageReferenceDataHelpers.ts`
- Status: `Implemented`
- Rationale: the `ReferenceDataTrustBoundary` union type now covers `'cohorts' | 'yearGroups' | 'assignmentTopics'` — `'assignmentTopics'` was added when the topic reference-data modal caller (`ManageTopicsModal.tsx`) was implemented, so the blocking-load trust-boundary helpers (`getPersistedBlockingLoadError`, `setPersistedBlockingLoadError`, `clearPersistedBlockingLoadError`, `syncReferenceDataModalBusyState`) work correctly for the topic entity

### 9.10 Section 5 de-sloppification: classes reference-data loading and test constants

1. Helper or contract: ReferenceDataInitialLoadingState (shared loading skeleton component)

- Decision: new
- Owning path: `src/frontend/src/features/referenceData/ReferenceDataInitialLoadingState.tsx`
- Status: `Implemented`
- Rationale: Extracted from duplicated ManageCohortsInitialLoadingState and ManageYearGroupsInitialLoadingState functions

2. Helper or contract: Classes CRUD test constants (ALIGNMENT_TOLERANCE_PX, MIN_WIDTH_DIFFERENCE_PX)

- Decision: new
- Owning path: `src/frontend/e2e-tests/classes-crud.shared.ts`
- Status: `Implemented`
- Rationale: Extracted from duplicated definitions in classes-crud-manage-cohorts.spec.ts and classes-crud-manage-year-groups.spec.ts

### 9.11 Classes page planning decisions

1. Helper or contract: navigation page renderer source of truth for the top-level Classes page

- Decision: reuse
- Owning path: `src/frontend/src/navigation/appNavigation.tsx`
- Status: `Implemented`
- Rationale: the new top-level Classes page must extend the existing shell navigation and page-render contract rather than introducing a second source of truth for navigation keys, labels, or page routing

2. Helper or contract: Classes page grouped view-model builder

- Decision: keep local
- Owning path: `src/frontend/src/pages/classesPageModel.ts` or an equivalent page-adjacent local helper
- Status: `Implemented`
- Rationale: the grouping, deterministic ordering, and fail-closed trust rules are specific to the dedicated Classes browse page and should not widen the existing Settings Classes helper family that serves different merge and workflow needs

3. Helper or contract: shared Playwright GAS runtime mock for Classes page journeys

- Decision: reuse
- Owning path: `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts`
- Status: `Implemented`
- Rationale: the existing deferred-success queue, method-call tracker, and per-method response queues already provide the right browser harness for the Classes page, so implementation should extend that shared mock surface instead of creating a parallel runtime mock layer

### 9.12 Dataset-state deduplication helpers

1. Helper or contract: `getStartupWarmupQueryOptions`

- Decision: new
- Owning path: `src/frontend/src/query/sharedQueries.ts`
- Status: `Implemented`
- Rationale: resolves a `StartupWarmupDatasetKey` to its shared query options without duplicating the internal `startupWarmupQueryDefinitions` mapping; consumed by `usePageDataset` and by any future page or hook that needs typed query options for a warm-up dataset

2. Helper or contract: `usePageDataset` hook

- Decision: new
- Owning path: `src/frontend/src/hooks/usePageDataset.ts`
- Status: `Implemented`
- Rationale: centralises the per-dataset query setup — calls `useStartupWarmupState`, `getStartupWarmupQueryOptions`, and `useQuery` with `enabled: isDatasetReady || isDatasetFailed` and `refetchOnMount: false` — so pages do not repeat this boilerplate for each warm-up-backed dataset; consumed by `ClassesPage` and `AssignmentsPage`

3. Helper or contract: `computePageDatasetState`

- Decision: new
- Owning path: `src/frontend/src/hooks/usePageDataset.ts`
- Status: `Implemented`
- Rationale: pure function that derives `PageDatasetState` (six boolean flags) from a query result, warm-up state, and dataset key; called by `usePageDataset` and available for direct composition by pages that need per-dataset state outside the hook

4. Helper or contract: `computePageSurfaceBlocking`

- Decision: new
- Owning path: `src/frontend/src/hooks/usePageDataset.ts`
- Status: `Implemented`
- Rationale: pure function that decides whether a single dataset should block the page surface — blocks on warm-up failure without recoverable data, untrustworthy-but-ready datasets, and ready datasets with query errors; pages compose their own blocking surface from this per-dataset decision

5. Helper or contract: `computeDatasetRenderable`

- Decision: new
- Owning path: `src/frontend/src/hooks/usePageDataset.ts`
- Status: `Implemented`
- Rationale: pure function that decides whether a dataset is renderable — true when trustworthy or recovered after warm-up failure; pages compose their own loading and content decisions from this per-dataset signal

6. Helper or contract: `computePageSurfaceBusy`

- Decision: new
- Owning path: `src/frontend/src/hooks/usePageDataset.ts`
- Status: `Implemented`
- Rationale: pure function returning `true` when any fetch or mutation flag is truthy; provides the common busy signal for `aria-busy` and spinner affordances; pages with additional busy triggers layer those on top

7. Helper or contract: `refetchAfterStaleInvalidate`

- Decision: new
- Owning path: `src/frontend/src/query/queryInvalidationHelpers.ts`
- Status: `Implemented`
- Rationale: wraps the invalidate-then-explicit-refetch pattern required for queries that may be disabled at invalidation time (e.g. warm-up-gated queries with `enabled: isDatasetReady || isDatasetFailed`); called from manual retry and post-mutation refresh flows; not the general invalidation pattern — plain `invalidateQueries` is preferred for actively-observed queries per `frontend-react-query-and-prefetch.md` §7

8. Helper or contract: `PageDatasetState` type

- Decision: new
- Owning path: `src/frontend/src/hooks/usePageDataset.ts`
- Status: `Implemented`
- Rationale: typed contract for the six derived boolean flags (`hasQueryData`, `isQueryError`, `isDatasetFailed`, `isDatasetReady`, `isDatasetTrustworthy`, `hasTrustworthyDataset`) shared between the `usePageDataset` hook and the pure derivation helpers

9. Helper or contract: `PageDatasetResult<TData>` type

- Decision: new
- Owning path: `src/frontend/src/hooks/usePageDataset.ts`
- Status: `Implemented`
- Rationale: generic typed contract for the hook return shape — bundles a typed `UseQueryResult<TData>` with a `PageDatasetState` so consuming pages can access typed `query.data` without casts

### 9.13 Assess Task Happy Path

1. Helper or contract: `findMatchingDefinition`

- Decision: new
- Owning path: `src/frontend/src/features/classes/AssessTaskModal/matchDefinitionForAssignment.ts`
- Status: `Implemented`
- Rationale: pure matching logic extracted for independent unit testing; no existing helper covers this combination of title, topic, and year-group lookups

### 9.14 Assess Task No-Match — Topic Existence Check

1. Helper or contract: topic existence check (`topics.some(t => t.key === selectedAssignment.topicId)`)

- Decision: `keep local`
- Owning path: `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx`
- Status: `Implemented`
- Rationale: single-caller, one-liner lookup; no existing helper matches this contract. Implementation at line 91 of AssessTaskModal.tsx: `assignmentTopics?.some((t) => t.key === selectedAssignment.topicId)`

### 9.15 API queueing system

1. Helper: `QueueState` interface

- Decision: `new`
- Owning module/path: `src/frontend/src/services/apiService.ts`
- Call-site rationale: exported type consumed by `getQueueState` callers (ABClass creation progress bar in v1; future consumers)
- Status: `Implemented`

2. Helper: `callApiQueued` function

- Decision: `new`
- Owning module/path: `src/frontend/src/services/apiService.ts`
- Call-site rationale: ABClass creation (sequentially enqueue class creation calls to avoid race condition); Google Classroom pre-fetch (sequentially enqueue background fetch calls to stay under concurrent ceiling)
- Status: `Implemented`

3. Helper: `getQueueState` function

- Decision: `new`
- Owning module/path: `src/frontend/src/services/apiService.ts`
- Call-site rationale: ABClass creation progress bar polls this for `{ pending, active }` to derive completion metrics
- Status: `Implemented`

4. Helper: `cancelApiQueued` function

- Decision: `extend`
- Owning module/path: `src/frontend/src/services/apiService.ts`
- Call-site rationale: small additive function that clears pending entries for a job name; consumed only by the classes bulk queue in v1
- Status: `Implemented`

### 9.16 AssessTask "Link to Existing Definition" helpers

1. Helper: `caseInsensitiveTrimmedEquals` feature-local pure helper

- Decision: `new`
- Owning module/path: `src/frontend/src/features/classes/AssessTaskModal/stringComparison.ts`
- Call-site rationale: provides case-insensitive trimmed string equality (`a.trim().toLowerCase() === b.trim().toLowerCase()`) shared by the matcher (`findMatchingDefinition`) and the picker derivation helper (`getLinkableDefinitionsForModal`). The helper is feature-local (not exported from the modal feature directory) per §3.4 because it has exactly two in-scope callers now. Not `private` to a single file because both callers are in separate sibling files.
- Status: `Implemented`

2. Helper: `getLinkableDefinitionsForModal` pure helper

- Decision: `new`
- Owning module/path: `src/frontend/src/features/classes/AssessTaskModal/getLinkableDefinitionsForModal.ts`
- Call-site rationale: derives the `LinkableDefinition[]` for the picker by filtering cached `AssignmentDefinitionPartial[]` to the class's `yearGroupKey` and sorting by `fuse.js` fuzzy title rank with `updatedAt` desc as the tie-breaker. The helper is colocated with the matcher (separate file), exported for unit testing, and has exactly one caller (`AssessTaskModal`).
- Status: `Implemented`

3. Helper: `LinkableDefinitionList` presentational component

- Decision: `new`
- Owning module/path: `src/frontend/src/features/classes/AssessTaskModal/LinkableDefinitionList.tsx`
- Call-site rationale: renders the picker as an Ant Design `Radio.Group` with vertical orientation, block width, and JSX children (rich per-row content with title and subtitle). The component is presentational (no state, no side effects); it receives the derived `LinkableDefinition[]` and the current selection, and emits `onSelect(definitionKey)`. All rows are always selectable. The component has exactly one caller (`AssessTaskModal`) and is not promoted to a shared component.
- Status: `Implemented`

### 9.16a AssessTaskModal loading skeleton extraction

1. Helper: `AssignmentSelectSkeleton` presentational component

- Decision: `new`
- Owning module/path: `src/frontend/src/features/classes/AssessTaskModal/AssignmentSelectSkeleton.tsx`
- Call-site rationale: renders the shape-matched loading skeleton for the assignment selection panel — a label skeleton (`Skeleton active title={{ width: '30%' }} paragraph={false}`) and a full-width input skeleton (`Skeleton.Input active style={{ width: '100%' }}`) wrapped in an accessible `<output>` element with an `ariaLabel`. The component is presentational (no state, no side effects); it accepts an `ariaLabel` prop for accessibility. Extracted from two identical inline JSX blocks in `renderFetchBody` and `renderLinkingBody` within `AssessTaskModal.tsx`, eliminating duplicated skeleton markup. The component is feature-local (not promoted to a shared component) because it has exactly two callers within the same modal and the skeleton shape is specific to the assignment selection panel.
- Status: `Implemented`
- Rationale: satisfies §4.3 (two active call sites need the same behaviour now); the `<output>` element's implicit `status` role satisfies the accessibility requirement in `frontend-loading-and-width-standards.md` §8 without an explicit `role="status"` attribute, which also resolved two SonarCloud `typescript:S6822` code smells (redundant implicit role)

### 9.17 Class page data analysis display helpers

These entries record the planned shared display helpers for the Class page feature. The Class page is the first caller; cohort, trend, and distribution analyses (per `docs/pedagogy/data-analysis-scoring.md:92-99`) are the near-term second caller, so the helpers are planned as **shared** rather than feature-local.

1. Helper: `resolveMetricTone(metric: MetricResult, range?: MetricToneRange, errorColor?: MetricToneColor): MetricToneResolution` — pure tone resolver

- Decision: `new`
- Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/metricTone.ts`
- Call-site rationale: maps the data analysis service's `MetricResult` discriminated union (`state: 'computed' | 'notAttempted' | 'error'`) to a `{ color, cellStyle, displayValue, muted }` resolution that the Ant Design `Tag` (and table cells) consume. For `computed` values the colour is a **continuous gradient**: the normalised position `t = (value - lower) / (upper - lower)` (clamped to `[0, 1]`) maps to an `hsl` colour whose hue sweeps red (`0`) → amber (`60`) → green (`120`), with lightness darker at the range ends (darkest red at the floor, darkest green at the ceiling) and lighter in the middle. `cellStyle` carries the matching light-background / dark-text pair for table cells. `notAttempted` returns `'#434343'` (dark grey with light grey cell background) and `error` returns the `errorColor` token (default `'volcano'`), both with their preset `cellStyle`. Pure function, no React or antd imports. Validates `range.upper > range.lower` and throws on violation.
- Status: `Implemented`
- Implementation notes:
  - Added `errorColor: MetricToneColor` parameter (not in the planning-time signature) per the spec reconciliation in Section 1 and `SPEC_CLASS_PAGE_PREPARATION.md`. The default (`'volcano'`) lives in `resolveMetricTone`; `MetricPill` is a pass-through with no `errorColor`-level default.
  - Computed values use a continuous gradient (no fixed band boundaries), so adjacent integer scores such as `4` and `5` or `2` and `3` now render with visibly different colours. Discrete states keep their fixed `Tag` colour tokens and cell styles.
  - Exported types: `MetricToneColor`, `MetricToneRange`, `MetricToneResolution`.
  - `MetricToneColor = 'red' | 'gold' | 'green' | 'default' | 'volcano'` remains the union for discrete `notAttempted` (`'default'`) and `error` (`errorColor`) states; the column **score-range filter** (see helper 4) is the consumer of filter values, not the continuous gradient. Any future revision to `MetricToneColor` is a cross-spec breaking change.
  - The `error` color (`volcano`) is the existing Ant Design preset for "important but not fatal" — `red` is reserved for the lowest end of the `computed` gradient to keep visual hierarchy clear.
  - File size: ~223 lines (under 550; no separation needed).
- Planned doc reconciliation: confirmed the resolver remains pure (no antd imports), the range parameter is honoured, and the `errorColor` default is set in `resolveMetricTone` (not in `MetricPill`) per the spec contract — the default-value rule "defaults must be set in a module's constructor only" is moot here because `resolveMetricTone` is a pure function, not a module constructor, and the default is set in the function parameter signature.

2. Helper: `MetricPill` presentational component

- Decision: `new`
- Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/MetricPill.tsx`
- Call-site rationale: renders a single `MetricResult` as a coloured Ant Design `Tag` using the output of `resolveMetricTone`. Exposes `precision` (default 2), `emphasised` (default false), `range` (pass-through), and `errorColor` (pass-through; no `MetricPill`-level default — the default lives in `resolveMetricTone`). Consumed by `RecentAssignmentCard` (four instances per card) and by the four metric columns of `StudentAveragesTable` (via the column `render` function). Future consumers: cohort, trend, and distribution analyses.
- Status: `Implemented`
- Implementation notes:
  - Renders Ant Design `Tag` with the resolved color. No explicit `variant="filled"` prop — the default filled variant is used. The `bordered` prop is left at its default (`true`).
  - The `emphasised` flag applies `fontSize: '17.5px'` (1.25× default) and `fontWeight: 600` via the `style` prop, merged with the muted opacity (`0.55`) when both are active.
  - The `precision` prop is ignored for `notAttempted` and `error` (the literal `'N'` and `'E'` are rendered as-is).
  - No `Tooltip` or `aria-label` in v1 (signed-off accessibility gap per `SPEC_CLASS_PAGE_PREPARATION.md`).
  - No interactivity: no `onClick`, no `cursor: pointer`, no focus ring.
  - File size: 125 lines (under 550; no separation needed).
- Planned doc reconciliation: confirmed the Tag color choices: `computed` uses `red` / `gold` / `green` bands; `notAttempted` uses `default` (grey); `error` uses `volcano` (default) with `errorColor` pass-through. The `error` color (`volcano`) is agreed and closed per Section 1 spec reconciliation — `red` is reserved for the lowest band of `computed` values to keep visual hierarchy clear.

3. Helper: `metricDisplay/` subfolder under `services/dataAnalysis/`

- Decision: `new`
- Owning module/path: `src/frontend/src/services/dataAnalysis/metricDisplay/`
- Call-site rationale: at least two production files (`metricTone.ts`, `MetricPill.tsx`) plus their spec companions share the `metricDisplay` domain prefix, satisfying `src/frontend/AGENTS.md` §13 ("Create a subfolder when at least 2 files share a common domain prefix"). No `index.ts` barrel is created in v1 per spec decision 8; consumers import directly (e.g. `import { resolveMetricTone } from '.../metricDisplay/metricTone'`). This is a deliberate v1 simplification; a barrel may be added in a later de-sloppification pass if call sites get noisy.
- Status: `Implemented`
- Implementation notes:
  - Folder created at the planned path. Contains `metricTone.ts`, `MetricPill.tsx`, `metricTone.spec.ts`, `MetricPill.spec.tsx` (4 files).
  - No `index.ts` barrel confirmed. Direct imports only.
  - The existing `services/dataAnalysis/` directory structure (`analysers/`, flat files) is preserved.
- Planned doc reconciliation: confirmed the subfolder is created at the planned path and the existing directory structure is preserved.

4. Helper: `rollupMetric(subTasks: ReadonlyArray<MetricResult>, metric: 'completeness' | 'accuracy' | 'spag'): MetricResult` — shared rollup precedence function

- Decision: `new`
- Owning module/path: `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts` (standalone; not in `accumulation/` subfolder)
- Call-site rationale: called by both `buildPerStudentRows` and `buildPerTaskRows` in `averagingAnalyser.rows.ts`, and by the Class page's `classPageAdapter`, applying the same three-way rollup precedence across all aggregation levels. The function operates on the public `MetricResult` discriminated union (not internal `MetricAccumulator` values) and takes a metric discriminator to apply per-metric `notAttempted` handling (for accuracy and completeness, `notAttempted` contributes 0; for SPaG, `notAttempted` is excluded). The `RollupMetric` type is `'completeness' | 'accuracy' | 'spag'` only — `'average'` is intentionally excluded because the average is a composite of the three per-criterion rollups at the consumer level, not a fourth independent weighted average. Pure function, no React or antd imports.
- Status: `Implemented`
- Implementation notes:
  - Implemented in Section 3 of the action plan as part of the MetricResult discriminated-union refactor.
  - At aggregation levels above the per-(student, task) cell, `error` entries are **excluded** from the rollup. The result is `error` only when **every** input is `error`; otherwise it is `computed` (over non-error entries) or `notAttempted` (when no computed entries remain). Error entries are excluded from both numerator and denominator.
  - Per-metric `notAttempted` handling: for accuracy and completeness, `notAttempted` contributes 0; for SPaG, `notAttempted` is excluded from numerator/denominator.
  - The function is called from `averagingAnalyser.rows.ts` row builders and will be consumed by the Class page adapter.
  - Standalone file (not in `accumulation/` subfolder) per the spec reconciliation; the facade decomposition of `averagingAnalyser.accumulation.ts` is deferred to a future pass (see §9.18 item 3).
- Planned doc reconciliation: confirmed the rollup is called from both analyser row builders, errors are **excluded** at aggregation levels above the per-(student, task) cell (the result is `error` only when every input is `error`), and per-metric `notAttempted` handling matches the `SPEC_CLASS_PAGE_PREPARATION.md` contract.

### 9.18 Class page feature-local helpers

These entries record the feature-local helpers for the Class page. Per `frontend-shared-helpers-and-abstraction-standards.md` §4.4 ("Keep feature-specific helpers inside the owning feature folder"), these stay in `src/frontend/src/features/classPage/` and are not promoted to shared scope unless a documented cross-feature reuse emerges. All entries in this section are now `Implemented` as part of the Class page v1 deliverable.

#### 9.18.1 Pure adapter: `classPageAdapter`

1. Helper: `classPageAdapter` pure adapter module

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/classPageAdapter.ts`
- Call-site rationale: the only module that knows how to translate the data analysis service's `AveragingResult` (with the new `MetricResult` discriminated union) plus the raw `ClassFull` into the view-model shapes the Class page consumes (`RecentAssignmentCardModel[]`, `StudentAverageRowModel[]`, `classMetrics`). Rolls up each criterion via the shared `rollupMetric` helper (which excludes errors at aggregation levels above the per-cell level) and computes the per-assignment `average` by delegating to the shared `computeOverallComposite` helper (40/40/20 weighting with SPaG renormalisation; also excludes error criteria). Also handles the `updatedAt`-based recent-assignment selection (top 3, sorted descending via the shared `compareAssignmentUpdatedAtDesc` comparator — replaced the previous inline stable sort), the no-data row synthesis for unassessed students, and trust validation (null `updatedAt` throws, duplicate `studentId`/`assignmentId` throws, unparseable `updatedAt` throws). Has exactly one caller (`useClassPageData`); promotion to a shared adapter would only make sense if a second consumer surface appears.
- Status: `Implemented`
- Implementation notes:
  - 495 lines (well under the 500-line threshold; no file separation required).
  - Pure function — no I/O, no React imports, no Ant Design imports. The only side effect is throwing on data integrity violations.
  - Calls `rollupMetric` (shared helper at `src/frontend/src/services/dataAnalysis/analysers/rollupMetric.ts`) for each of the three criteria.
  - Calls `formatUpdatedAtLabel` (shared helper at `src/frontend/src/utils/dateFormatting.ts`) for date formatting.
  - Per-assignment `average` is computed by delegating to the shared `computeOverallComposite` helper (40/40/20 weighting with SPaG renormalisation); that helper excludes `error` and `notAttempted` criteria, matching the analyser's per-student and per-task overall behaviour. The average is a composite of three per-criterion rollups, not a fourth independent weighted average.
  - Trust validation: `validateUpdatedAt` throws `TypeError` on null or unparseable `updatedAt`; `findDuplicateStudentId` / `findDuplicateAssignmentId` check uniqueness.
  - Co-located spec: `classPageAdapter.spec.ts` (15 tests covering all contract behaviours).
- Planned doc reconciliation: confirmed the rollup precedence is documented inline in the adapter JSDoc (`@remarks` blocks); `MetricResult` discriminated union is consumed via `.state` property checks (not nullable checks, consistent with the discriminated union contract).

#### 9.18.10 Shared comparator: `compareStudentNames`

14. Helper: `compareStudentNames(a, b): number` — shared student-name comparator

- Decision: `extract`
- Owning module/path: `src/frontend/src/features/classPage/classPageModel.ts`
- Call-site rationale: replaces two identical inline comparators — one in `buildClassPageViewModel` (studentName sort path) and one in `studentAveragesTableColumns.tsx` (`studentName` column `sorter.compare`). Both implement the same locale-aware, case-insensitive name comparison with `studentId` ascending tie-break. The model is the canonical owner of sorting logic.
- Status: `Implemented`
- Implementation notes:
  - Signature: `export function compareStudentNames(a: StudentAverageRowModel, b: StudentAverageRowModel): number`
  - Returns `a.studentName.localeCompare(b.studentName, undefined, { sensitivity: 'base' })` tie-broken by `a.studentId.localeCompare(b.studentId)`.
  - Single source of truth for student-name ordering; call sites apply direction via `direction === 'asc' ? cmp : -cmp`.

#### 9.18.11 Heatmap row comparator: `compareHeatmapStudentName`

15. Helper: `compareHeatmapStudentName(a: HeatmapRow, b: HeatmapRow): number` — `HeatmapRow`-typed student-name comparator

- Decision: `extract`
- Owning module/path: `src/frontend/src/features/classPage/classPageModel.ts`
- Call-site rationale: the heatmap table (`TaskHeatmapPage`, built in Section 5b) must not import the `StudentAverageRowModel`-typed `compareStudentNames` directly because `HeatmapRow` and `StudentAverageRowModel` have different shapes (`HeatmapRow` carries `cells`, not `metrics`). This helper provides the same locale-aware, case-insensitive name ordering with `studentId` ascending tie-break, typed for `HeatmapRow`, so the heatmap's student-name sort has a single source of truth that mirrors `compareStudentNames` semantics exactly.
- Status: `Implemented`
- Implementation notes:
  - Signature: `export function compareHeatmapStudentName(a: HeatmapRow, b: HeatmapRow): number`
  - Delegates to the canonical `compareStudentNames` logic (locale-aware, `sensitivity: 'base'`, `studentId` ascending tie-break) via a type cast, avoiding `sonarjs/no-identical-functions` while preserving exact semantics. Both `HeatmapRow` and `StudentAverageRowModel` expose `studentName` and `studentId` identically.
  - Co-located spec: `classPageModel.spec.ts` (`compareHeatmapStudentName` describe block — ordering, `studentId` tie-break, case-insensitivity).

#### 9.18.2 Pure view-model builder: `classPageModel`

2. Helper: `classPageModel` pure view-model builder

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/classPageModel.ts`
- Call-site rationale: pure view-model builder that applies user-controlled filtering and sorting (search term, column sort) on top of the adapter output. Has exactly one caller (`StudentAveragesTableCard`); kept local because the search / sort surface is specific to the Class page's owned region and does not generalise to other features.
- Status: `Implemented`
- Implementation notes:
  - 201 lines. Pure function — no React imports, no Ant Design imports, no I/O.
  - Search filter: case-insensitive substring on `studentName`; empty `searchTerm` → no filter.
  - State-aware metric sort: rank-based with `METRIC_STATE_RANK_ASC`/`METRIC_STATE_RANK_DESC` Maps. `asc`: computed (by value) → notAttempted → error. `desc`: error → notAttempted → computed (by value). Tie-break by `studentId` ascending. `METRIC_STATE_RANK_ASC` is now exported (consumed by `TaskHeatmapTable`'s `HeatmapRow`-typed metric comparator in Section 4 — the heatmap reuses the canonical rank map instead of declaring a second copy).
  - Student name sort: locale-aware, case-insensitive, `studentId` tie-breaker.
  - Passes through `recentAssignments` and `classMetrics` unchanged.
  - Default sort: `studentName` ascending.
  - Co-located spec: `classPageModel.spec.ts` (12 test cases).
- Planned doc reconciliation: confirmed the model is a pure function with no React or React Query imports. The `viewing` field is absent from v1 (static `Typography.Text` label instead of a `Select`).

#### 9.18.3 Data orchestrator hook: `useClassPageData`

3. Helper: `useClassPageData` data orchestrator hook

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/useClassPageData.ts`
- Call-site rationale: sole data-fetching entry point for the Class page. Wires together `getABClass` query (view-entry fetch), `usePageDataset('assignmentDefinitionPartials')` (warm-up-backed), synchronous `DataAnalysisService.analyse(...)`, and `adaptClassPageToViewModel(...)`. Produces a typed `ClassPageData` result with `surfaceState` as a discriminated union. Has exactly one caller (`ClassPage.tsx`); promotion to a shared hook would only make sense if a second consumer page needs the same orchestration.
- Status: `Implemented`
- Implementation notes:
  - 447 lines (well under the 500-line threshold).
  - Side-effect-light hook: one fire-and-forget prefetch `useEffect` alongside the existing data-orchestration logic. The effect gates on `surfaceState.status === 'ready'`, sorts top-3 assignments via the shared `compareAssignmentUpdatedAtDesc` comparator, and fires `queryClient.prefetchQuery` with `.catch(() => undefined)` for each. A `useRef` guard ensures single dispatch per classId. No I/O beyond React Query calls and synchronous analyser/adapter calls.
  - Surface state is a discriminated union: `{ status: 'loading' }` | `{ status: 'blocking'; error: ClassPageError }` | `{ status: 'ready' }`.
  - Error precedence (top to bottom): `classNotFound` > `classQueryError` > `assignmentDefinitionPartialsFailed` > `assignmentDefinitionPartialsUntrustworthy` > `adapterError` > `analyserError`.
  - `shouldRunPipeline` guard ensures analyser/adapter do not run when the dataset is untrustworthy or has failed.
  - `refetch` uses `useCallback` with destructured `queryRefetch` to avoid stale-closure bugs.
  - Module-level `createAnalysisService()` factory avoids test workaround in production code.
  - Co-located spec: `useClassPageData.spec.ts` (16 tests covering all error states, memoisation, and refetch).
  - Projected size in spec was ~300–350 lines; the post-prefetch actual is ~447 lines (the prefetch `useEffect` and `useRef` guard added lines, but de-sloppification compressed others, landing below the original 473). No splitting needed.

#### 9.18.4 Page composition root: `ClassPage`

4. Helper: `ClassPage` page composition root

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/ClassPage.tsx`
- Call-site rationale: thin composition root for the Class page. Owns `isAssessModalOpen` state, breadcrumb `Classes` link wiring, and per-state content dispatcher (`ClassPageContent`). Has exactly one caller (`ClassesPage.tsx`, inline render when `selectedClassId` is set).
- Status: `Implemented`
- Implementation notes:
  - 114 lines. Thin composition root.
  - Renders a three-segment `Breadcrumb` (`AssessmentBot Frontend / Classes / {className}`) in-page — accepted v1 visual duplication with the shell's two-segment breadcrumb. When `selectedView.view === 'heatmap'`, a fourth `Task Heatmap` segment is appended.
  - Owns the `selectedView` state (`{ view: 'overview' | 'heatmap'; assignmentId?: string }`, default `overview`); `handleOpenHeatmap(assignmentId)` sets the heatmap view, `handleBack()` resets to overview. Destructures `analyserResult` from the single `useClassPageData(classId)` call and passes it (plus `classFull`, `onOpenHeatmap`, `onBack`, `refetch`, `selectedView`) into `ClassPageContent` — no second analysis call.
  - Renders `ClassPageContent` with per-state content (loading/blocking/ready/heatmap).
  - Renders `AssessTaskModal` at the page root (not inside `ClassPageContent`) because the modal state spans loading/blocking/ready transitions.
  - Co-located spec: `ClassPage.spec.tsx` (7 test cases covering breadcrumb, modal state, and navigation).

#### 9.18.5 Per-state content dispatcher: `ClassPageContent`

5. Component: `ClassPageContent` per-state content dispatcher

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/ClassPageContent.tsx`
- Call-site rationale: thin `switch (status)` dispatcher that delegates to `ClassPageLoading`, `ClassPageBlocking`, or `ClassPageReady`. Extracted to keep `ClassPage.tsx` thin. Has exactly one caller (`ClassPage.tsx`).
- Status: `Implemented`
- Implementation notes:
  - 295 lines. Three co-located sub-components:
    - `ClassPageLoading`: shape-matched `Skeleton` (heading + 3-card row + table paragraph), wrapped in `role="status"` and `aria-live="polite"`. Uses a deliberate shape-matched pattern (not the paragraph-row pattern prescribed in `CLASS_PAGE_LAYOUT.md`) because the three distinct content regions benefit from visible card-shaped placeholders.
    - `ClassPageBlocking`: single Ant Design `Result` per `error.type`. Retryable errors (`classQueryError`, `analyserError`, `assignmentDefinitionPartialsFailed`, `assignmentDefinitionPartialsUntrustworthy`) show `Retry` + `Back to Classes`. Non-retryable errors (`classNotFound`, `adapterError`) show only `Back to Classes`.
    - `ClassPageReady`: full content tree — `ClassPageHeaderActions`, `RecentAssignmentsSection`, `StudentAveragesTableCard`; forwards the new `onOpenHeatmap` prop into `RecentAssignmentsSection` so a card click can open the heatmap.
  - The `ready` branch additionally renders `TaskHeatmapPage` (instead of `ClassPageReady`) when `selectedView.view === 'heatmap' && selectedView.assignmentId !== undefined && analyserResult && classFull` — gated on the `ready` surface state and narrowed to non-null `analyserResult`/`classFull`/`assignmentId` before passing them to `TaskHeatmapPage` (no `?? ''` default on the id, per core principle #7).
  - Co-located spec: `ClassPageContent.spec.tsx` (8 test cases covering all three states + the new required props).

#### 9.18.6 Presentational components

6. Component: `ClassPageHeaderActions`

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/ClassPageHeaderActions.tsx`
- Status: `Implemented`
- Implementation notes: 56 lines. Pure presentational — renders disabled `Edit Student Details` (wrapped in `Tooltip` via `<span>`) and enabled `Start New Assessment`. Ant Design v6 `Tooltip` does not trigger on a disabled `Button` directly; the `<span>`-wrapper pattern is the established codebase convention (matches `AssessTaskModal`).

7. Component: `RecentAssignmentCard`

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/RecentAssignmentCard.tsx`
- Status: `Implemented`
- Implementation notes: 87 lines. Renders assignment name as card title, "Last Assessed" date line, and four `MetricPill` instances (Completeness, Accuracy, SpAG, Average). Average cell uses `emphasised={true}`. Card width is a feature-local constant (`RECENT_ASSIGNMENT_CARD_WIDTH_PX = 320`); promotion to a shared width token is deferred until a second consumer emerges. Conditional interactivity — when `onOpenHeatmap` is supplied the card becomes an activatable button (`role="button"`, `tabIndex={0}`, mouse click + Enter/Space activation, `cursor: 'pointer'`); when absent it stays a static display card. No `hoverable` prop in v1.

8. Component: `RecentAssignmentsSection`

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/RecentAssignmentsSection.tsx`
- Status: `Implemented`
- Implementation notes: 73 lines. Pure presentational — section `Card` (`size="small"`, `title="Recent Assignments"`) wrapping either a centre-aligned `Flex` row of up to 3 `RecentAssignmentCard` components, or an `Empty` with CTA button. Empty state description sourced from `pageContent.classDetail.recentAssignmentsEmpty`. Forwards an optional `onOpenHeatmap?: (assignmentId: string) => void` prop to every `RecentAssignmentCard`, enabling the heatmap drill-down entry point (wired by `ClassPage` in Section 5b).

9. Component: `StudentAveragesTableCard`

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/StudentAveragesTableCard.tsx`
- Status: `Implemented`
- Implementation notes: 205 lines. Owns `searchTerm`, `sort`, and `filters` state. Uses `Space.Compact` + `Input` with `SearchOutlined` prefix instead of `Input.Search` — the layout spec requires no submit button, but Ant Design v6.3.1 always renders a `<button>` in `Input.Search` regardless of `enterButton`. Memoised `buildClassPageViewModel` (keyed on `[adapterResult, searchTerm, sort]`) and `buildStudentAveragesTableColumns` (keyed on `[filters]`). Table has `pagination={false}`, `size="small"`, `scroll={{ x: 'max-content' }}`. `Table.onChange` maps Ant Design's `'ascend'`/`'descend'` to model's `'asc'`/`'desc'`; clears to default `studentName` ascending when `sorter.order` is `null` (third-click clear-sort).

10. Component: `studentAveragesTableColumns`

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/studentAveragesTableColumns.tsx`
- Status: `Implemented`
- Implementation notes: Pure function exporting `buildStudentAveragesTableColumns(filters)` — no React hooks. Five columns: `studentName` (locale-aware sort, no filters), `completeness`/`accuracy`/`spag`/`average` (metric columns with a numeric **score-range filter** via `buildMetricRangeFilter`, gradient cell colour via `resolveMetricTone(...).cellStyle`, `MetricPill` render). The `filters` prop is `StudentAveragesTableFilters` (`readonly number[]` per column, the active `[min, max]` range or `[]`).

#### 9.18.7 Zod trust-boundary schema: `classPageAdapter.zod`

11. Schema: `classPageAdapter.zod` — adapter output Zod schema

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/classPageAdapter.zod.ts`
- Status: `Implemented`
- Implementation notes: Defines `RecentAssignmentCardModelSchema`, `StudentAverageRowModelSchema`, and `ClassPageAdapterResultSchema`. All types derived via `z.infer`. Reuses `MetricResult` from `src/frontend/src/services/dataAnalysis/dataAnalysis.zod`. Co-located spec: `classPageAdapter.zod.spec.ts`.

3. Structural change: extraction of `averagingAnalyser.criterionAccumulation.ts`

- Decision: `extract`
- Owning module/path: `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.criterionAccumulation.ts` (new sibling file)
- Call-site rationale: `averagingAnalyser.accumulation.ts` reached 649 lines (above the 550-line threshold in `src/frontend/AGENTS.md` §13), triggering a concrete maintenance need. Five criterion-accumulation functions (`accumulateCriterion`, `accumulateMetricsToTarget`, `computeOverall`, `processSubmissionItem`, `processItemAssessments`) were extracted to a new sibling module. The extraction preserved exact function bodies; no logic changes. `accumulation.ts` was reduced to 440 lines (under the threshold).
- Status: `Implemented`
- Planned doc reconciliation: confirmed the decomposition boundary (criterion-level accumulation only) is correct and the extracted module is under 550 lines (223 LOC).

#### 9.18.8 Generic duplicate-detection helper extracted from duplicate validators

12. Helper: `findFirstDuplicate<T>(items: readonly T[], keyFunction: (item: T) => string): string | null`

- Decision: `extract`
- Owning module/path: `src/frontend/src/features/classPage/classPageAdapter.ts` (private, kept local)
- Call-site rationale: replaces two near-identical functions (`findDuplicateStudentId` and `findDuplicateAssignmentId`) with a single generic iterator over an array of typed items, accepting a key-extraction function. Both callers now invoke `findFirstDuplicate` with an inline lambda instead of maintaining separate strongly-typed iterators.
- Status: `Implemented`
- Implementation notes:
  - Private inside `classPageAdapter.ts`; not exposed as a shared helper.
  - Uses `readonly T[]` for broader type compatibility.
  - Throws the same `TypeError` for duplicate IDs as the original functions via the same caller-site check.

#### 9.18.9 Shared `getStudentMetric` accessor extracted from duplicated switch statements

13. Helper: `getStudentMetric(metrics, key): MetricResult` — shared metric accessor

- Decision: `extract`
- Owning module/path: `src/frontend/src/features/classPage/classPageAdapter.zod.ts`
- Call-site rationale: replaces two identical 4-case switch statements in `studentAveragesTableColumns.tsx` (`getMetric`) and `classPageModel.ts` (`getMetricForColumn`) with a single exported accessor. Both existed solely to satisfy the `security/detect-object-injection` lint rule. The owning module is the Zod trust-boundary schema file (not a new `helpers.ts`) because both callers already depend on it for types, and the accessor operates on the schema's `StudentAverageRowModel['metrics']` contract.
- Status: `Implemented`
- Implementation notes:
  - Uses a `switch` statement (not computed property access) to satisfy the `security/detect-object-injection` lint rule.
  - JSDoc explains the lint-rule motivation and the switch-statement pattern.
  - `@remarks` documents the switch-statement rationale.
  - Exported function signature: `getStudentMetric(metrics: StudentAverageRowModel['metrics'], key: 'completeness' | 'accuracy' | 'spag' | 'average'): MetricResult`

#### 9.18.12 Heatmap table component: `TaskHeatmapTable`

16. Component: `TaskHeatmapTable` — presentational heatmap table (grouped headers, score-range filters, sorters)

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/TaskHeatmapTable.tsx`
- Call-site rationale: pure presentational table built from a `HeatmapResult`. Owns the Ant Design `Table<HeatmapRow>` column definitions (`buildHeatmapTableColumns` is internal): a sticky `Student Name` top-level column (`fixed: 'start'`, `width: 200`, `sorter` via the exported `compareHeatmapStudentName`, `defaultSortOrder: 'ascend'`), and one grouped column per `taskColumn` (title = `taskId`, since `taskTitle` is `null` in v1) with `Completeness`/`Accuracy`/`SPaG` children. Each metric sub-column uses `buildMetricRangeFilter` (a numeric score-range `filterDropdown` + `onFilter` over a two-thumb `Slider`), a SPEC-ordered `sorter` built on the exported `METRIC_STATE_RANK_ASC` (computed by value asc → `notAttempted` → `error`, `studentId` tie-break), and renders a `compact` `MetricPill` inside a gradient-coloured cell (`resolveMetricTone(...).cellStyle`) whose `aria-label` is `"[Student Name], [Task ID], [Metric]: [Score]"`. `pagination={false}`, `bordered`, `scroll={{ x: 'max-content' }}`, `aria-label="Task Heatmap"`.
- Status: `Implemented`
- Implementation notes:
  - Reuses `compareHeatmapStudentName` and `METRIC_STATE_RANK_ASC` from `classPageModel.ts`, and the shared `buildMetricRangeFilter` (with its `MetricRangeFilterDropdown` UI and `metricRangeKey` encode/decode helpers) from `metricDisplay/` — no second copy of the filter predicate. The `HeatmapRow`-typed metric comparator (`heatmapMetricComparator`) reads the canonical rank map so the heatmap and averages tables share one ordering definition.
  - Initial ascending student-name order is achieved by pre-sorting the `dataSource` with `.toSorted(compareHeatmapStudentName)` because `defaultSortOrder` does not auto-apply the initial sort in the installed Ant Design version; this is a non-mutating copy.
  - Empty-state: a "No submissions yet" caption renders above the table only when `taskColumns.length > 0 && rows.length > 0 &&` every cell is `notAttempted`; the guard suppresses the caption for the zero-tasks variant (`taskColumns: []` → only the Student Name column renders).
  - Cell access uses a safe `.find` by `taskKey` (not computed-index injection) plus a `switch`-based metric accessor, mirroring the `getStudentMetric` pattern to satisfy `security/detect-object-injection`.
  - Co-located spec: `TaskHeatmapTable.spec.tsx` (6 tests: grouped header; Green-band filter removes non-green rows; Student Name sort via `compareHeatmapStudentName`; per-cell `aria-label` format; no-submissions caption; zero-tasks variant).

#### 9.18.13 Heatmap page composition: `TaskHeatmapPage`

17. Component: `TaskHeatmapPage` — heatmap view composition root (header, control, table regions)

- Decision: `keep local`
- Owning module/path: `src/frontend/src/features/classPage/TaskHeatmapPage.tsx`
- Call-site rationale: rendered by `ClassPageContent` when `selectedView.view === 'heatmap'`. It is a pure presentational view that receives the already-computed `analyserResult` + `classFull` (it must NOT call `useClassPageData` — a second hook instance would re-run the analyser, violating the "no new analysis call" contract). It projects the view model via `adaptMetricsToHeatmap(analyserResult, classFull, assignmentId)`.
- Status: `Implemented`
- Implementation notes:
  - `adaptMetricsToHeatmap` is computed exactly once via a `useState` lazy initializer (not re-run on every render). On throw (unknown `assignmentId`), it logs via `logFrontendError('TaskHeatmapPage', error)` inside a `useEffect` and then calls `onBack()` — auto-navigating back to the overview with NO in-view `Alert`/error UI (per `SPEC.md`/`TASK_PREVIEW_CARD_LAYOUT.md`). The error is logged, never silently ignored, and never via `console.*`.
  - Renders a `Flex` (`vertical`, `gap=16`) with three `Card`s (`size="small"`): a header `Card` (`Typography.Title` assignment name + back `Button` `aria-label="Back to Class overview"` + secondary class name), a control `Card` (refresh `Button` → `refetch`), and the table `Card` (`TaskHeatmapTable`). The breadcrumb (with the `Task Heatmap` segment) is owned by `ClassPage`, not duplicated here.
  - Co-located integration spec: `ClassPageHeatmapView.spec.tsx` (3 tests: card click opens heatmap; Back returns to overview; unknown `assignmentId` auto-navigates back via `logFrontendError` + `onBack`, no in-view error).

#### 9.18.14 E2E scenario helper: `task-heatmap-end-to-end-helpers`

18. Helper (test-only): `createHeatmapScenario` — Playwright runtime-scenario factory for the Task Heatmap end-to-end journey

- Decision: `new` (test-only helper, co-located with the E2E spec)
- Owning module/path: `src/frontend/e2e-tests/helpers/task-heatmap-end-to-end-helpers.ts`
- Call-site rationale: builds the `RuntimeScenario` (auth + reference data + `getAssignmentDefinitionPartials` warm-up + two identical `getABClass` StrictMode entries + a real `getABClassPartials` so the class card renders) that drives the full journey in `task-heatmap.spec.ts`. It self-builds the `ClassFull` fixture from `anon-test-data.json` via an internal `buildClassFullDocument` (deriving `assignmentDefinition.tasks` from submission item keys), keeping the E2E independent of the unit fixture builders. `HEATMAP_ASSIGNMENT_NAME` (`'4. …'`) is the fixture `assignmentName`; `HEATMAP_ASSIGNMENT_DISPLAY_TITLE` (`'7. Video Plan'`) is the `primaryTitle` the UI actually renders and must be used for card-click + header locators.
- Status: `Implemented` (ACTION_PLAN.md Section 6 — `task-heatmap.spec.ts` + `task-heatmap-end-to-end-helpers.ts` added; 6 required cases, 7 passing tests).
- Implementation notes:
  - `createHeatmapScenario` exposes `deferredClass` (via `deferredSuccess`/`releaseNextDeferredSuccess`) for the loading-skeleton test, while always keeping two `getABClass` queue entries for StrictMode safety.
  - A scoped-parent overload was added to `applyColumnFilterOption` in `src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts` so the band-filter test can target the first task group's `Completeness` columnheader without tripping Playwright strict mode (string callers are unchanged).

#### 9.18.15 ClassPage assignment prefetch support helpers

These entries record the helpers introduced to support the ClassPage assignment prefetch feature (see `ACTION_PLAN.md`). All entries delivered in the ClassPage Assignment Prefetch cycle.

19. Helper: `getAssignment` service function

- Decision: `new`
- Owning module/path: `src/frontend/src/services/assignmentAssessment/assignmentAssessmentService.ts`
- Call-site rationale: wraps the backend `getAssignment_` allowlisted method; the prefetch effect in `useClassPageData` and future per-assignment query hooks call this function. Routes through `callApi('getAssignment', ...)` and validates the response through `AssignmentFullResponseSchema`.
- Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9
- Status: `Implemented`

20. Helper: `AssignmentFullSchema` / `AssignmentFullResponseSchema` Zod schemas

- Decision: `new`
- Owning module/path: `src/frontend/src/services/assignmentAssessment/assignmentAssessment.zod.ts`
- Call-site rationale: validates the full `Assignment.toJSON()` response at the transport boundary; required by the `getAssignment` service function. `AssignmentFullResponseSchema` is the nullable wrapper (`null` = assignment not found).
- Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9
- Status: `Implemented`

21. Helper: `queryKeys.assignment(courseId, assignmentId)` query key factory

- Decision: `new`
- Owning module/path: `src/frontend/src/query/queryKeys.ts`
- Call-site rationale: scoped query key factory for per-assignment full reads; consumed by `getAssignmentQueryOptions` and future invalidation calls.
- Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9
- Status: `Implemented`

22. Helper: `getAssignmentQueryOptions(courseId, assignmentId)` shared query options

- Decision: `new`
- Owning module/path: `src/frontend/src/query/sharedQueries.ts`
- Call-site rationale: shared query options for the `prefetchQuery` call in `useClassPageData` and future `useQuery` consumers. Declares `staleTime: 5 * 60 * 1000` and `retry: false`.
- Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9
- Status: `Implemented`

23. Helper: `compareAssignmentUpdatedAtDesc(a, b)` shared comparator

- Decision: `new` (shared between the prefetch and the adapter's `recentAssignments` pipeline)
- Owning module/path: `src/frontend/src/features/classPage/classPageModel.ts`
- Call-site rationale: ensures the prefetched top-3 and the adapter's displayed `recentAssignments` use identical ordering (updatedAt desc, assignmentId asc tie-break); prevents divergence when `updatedAt` values are equal.
- Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md` §9
- Status: `Implemented`

### 9.19 Frontend pure formatting helpers

These entries record the planned pure formatting helpers extracted from feature code into shared utility modules.
Per `SPEC_CLASS_PAGE_PREPARATION.md` line 382, the canonical home for these helpers is `src/frontend/src/utils/` — a new top-level folder for pure formatting / utility functions shared across the frontend. The folder is not governed by `src/frontend/AGENTS.md` §13 (which covers `services/` subfolders only); this is a separate convention for helpers that have no React, Ant Design, I/O, or state dependencies.

1. Helper: `formatUpdatedAtLabel(updatedAt: string | null): string` — date formatting helper

- Decision: `new`
- Owning module/path: `src/frontend/src/utils/dateFormatting.ts` (new `utils/` folder, first entry)
- Call-site rationale: extracted from `AssignmentsPage.tsx` as part of the rename deliverable because the Class page's `classPageAdapter` needs the same formatter. `en-GB` locale, date-only, rendered in UTC. The em-dash fallback (`UNAVAILABLE_VALUE = '—'`) is defined locally in the new module (does not import from `AssignmentsPage.tsx`). Pure formatting function, no React / antd / I/O / state. The Class page adapter does not use the fallback; it throws upstream on null or unparseable input. The helper preserves the fallback for the `AssignmentsPage` caller.
- Status: `Implemented`
- Implementation notes:
  - Implemented in Section 2 of the action plan alongside the `lastUpdated` → `updatedAt` rename.
  - The helper lives at `src/frontend/src/utils/dateFormatting.ts` (first entry in the new `utils/` folder).
  - `UNAVAILABLE_VALUE = '—'` is defined locally in `dateFormatting.ts`.
  - The helper preserves the existing `AssignmentsPage` behaviour (em-dash fallback for null/unparseable) while the Class page adapter (`classPageAdapter`) throws upstream on null.
  - Pure function: en-GB locale, date-only, rendered in UTC. No React / antd / I/O / state.
- Planned doc reconciliation: confirmed the helper lives at the planned path, preserves the existing `AssignmentsPage` behaviour, and the `UNAVAILABLE_VALUE` constant is defined locally (not imported from `AssignmentsPage.tsx`).

### 9.20 Data analysis accumulator helpers

1. Helper: `rollupAccumulators` exported from `averagingAnalyser.rows.ts`

- Decision: `extend` (existing function, now exported)
- Owning module/path: `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.rows.ts`
- Call-site rationale: `rollupAccumulators` was previously private to `averagingAnalyser.rows.ts` and duplicated in `averagingAnalyser.ts` (`analyseClass`). By exporting it, the per-class rollup path in `analyseClass` now reuses the same `rollupAccumulators` call that the row builders use, eliminating the dual-path bug described in CRITICAL-2.
- Status: `Implemented`

2. Helper: `buildPerStudentTaskMetrics` — convert per-(student, task) accumulators to `PerStudentTaskMetric[]`

- Decision: `new` (feature-local helper, kept inside the analyser package)
- Owning module/path: `src/frontend/src/services/dataAnalysis/analysers/averagingAnalyser.accumulation.ts` (or `averagingAnalyser.perStudentTaskMetrics.ts` if `accumulation.ts` crosses the 500-LOC threshold)
- Call-site rationale: converts `perStudentTaskAccums` (`Map<string, Map<string, DataPointAccumulator>>`) into the validated `PerStudentTaskMetric[]` array on `AveragingResult`, calling the existing `accumToMetric` path for each criterion (`completeness`, `accuracy`, `spag`, `overall`). Consumed by `analyseClass` in `averagingAnalyser.ts`. `taskKey` is `\`${definitionKey}::${taskId}\``; `classId` is echoed from the input class.
- Status: `Implemented` (ACTION_PLAN.md Section 1 — `buildPerStudentTaskMetrics` added to `averagingAnalyser.accumulation.ts`, called by `analyseClass`; `PerStudentTaskMetricSchema` added to `dataAnalysis.zod.ts`).

3. Helper: `adaptMetricsToHeatmap` — pure projection adapter (`AveragingResult` + `ClassFull` + `assignmentId` → `HeatmapResult`)

- Decision: `new` (single-file service module; flat under `services/dataAnalysis/`)
- Owning module/path: `src/frontend/src/services/dataAnalysis/heatmapAdapter.ts`
- Call-site rationale: the single projection boundary consumed by `TaskHeatmapPage`. Filters `perStudentTaskMetrics` to the selected assignment's `taskKey`s (derived from `assignment.assignmentDefinition.definitionKey`), groups by `studentId` into `HeatmapRow`s, and derives `taskColumns` from `assignment.assignmentDefinition.tasks`. `assignmentName` from `primaryTitle`, `className` from `classFull.className` (fallback `'Class Overview'`), `taskTitle` always `null` in v1. Throws on unknown `assignmentId` (fail fast).
- Status: `Implemented` (ACTION_PLAN.md Section 2 — `adaptMetricsToHeatmap` added to `heatmapAdapter.ts`; `HeatmapResult`/`HeatmapRow`/`HeatmapCell`/`HeatmapTaskColumn` interfaces exported).

## 10. Frontend utils folder convention

The `src/frontend/src/utils/` folder exists for pure formatting / utility functions that are shared across the frontend. This folder is a separate convention from `src/frontend/AGENTS.md` §13, which governs only `services/` subfolder organisation.

### Rules

- **Pure functions only.** Files in `utils/` must have no React, Ant Design, I/O, or state dependencies. They are plain TypeScript modules exporting typed pure functions.
- **No `src/frontend/AGENTS.md` §13 governance.** The §13 subfolder-by-domain-prefix rule applies only to `services/`. The `utils/` folder is a flat namespace; files are named by the domain they format (e.g. `dateFormatting.ts`). A future subfolder reorganisation may be considered if the folder exceeds 5–6 files, but no barrel exports (`index.ts`) are created in v1 — consumers import directly.
- **First entry:** `dateFormatting.ts` — exports `formatUpdatedAtLabel(updatedAt: string | null): string`. See §9.19 item 1 above for the full contract.
